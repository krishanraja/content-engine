"""A judge that can watch: Gemini describes a video, shot by shot, cheaply.

Krish, 2026-10-09: "build gemini video cheaply". The engine's judges read
text; none can watch a cut. This sends a finished video (ours, or a
competitor's that is public) to Gemini's cheapest video-capable model once,
and gets back a shot list with timings, what is on screen and said in each,
where attention would drop, and the one change that would hold it. The
answer is a judge's opinion: it is logged beside the real 7-day result
(docs/TOOL_BANK.md, H1 and the Gemini row) and never decides anything alone.

Cheap by construction: one upload, one generation, the Flash tier, a short
answer. A 3-minute video is a few cents. No key, no call: it says so and
stops.

    python scripts/signals/video.py FILE.mp4 [--model gemini-2.5-flash] [--question "..."]
    python scripts/signals/video.py --self-test

Needs GEMINI_API_KEY in the environment (docs/INTEGRATIONS.md). Output is
JSON on stdout. The video is uploaded to Google's Files API, which keeps it
for about 48 hours; never send a recording Krish has not approved for the
tools (a published or approved cut, or a public competitor's video).
"""

import argparse
import json
import mimetypes
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

API = "https://generativelanguage.googleapis.com"
DEFAULT_MODEL = "gemini-2.5-flash"
TIMEOUT = 120

PROMPT = (
    "You are a film editor judging a short talking-head video for a publication called makeyourmindup. "
    "Answer in JSON with these keys only: "
    '"shots": a list of {"start": "m:ss", "end": "m:ss", "on_screen": "...", "said": "..."} for every distinct shot or graphic; '
    '"drops": a list of {"at": "m:ss", "why": "..."} for the moments a viewer would most likely stop watching; '
    '"hook_seconds": the number of seconds before the video states the question it will answer; '
    '"ends_on_outro": true or false, whether it ends on a spoken sign-off rather than a number; '
    '"one_change": the single edit that would most increase how many viewers reach the end; '
    '"logo_first_3s": true or false, whether the publication\'s logo appears in the first three seconds. '
    "Be concrete and brief. No preamble."
)


class NoKey(RuntimeError):
    pass


def _key():
    v = os.environ.get("GEMINI_API_KEY", "").strip()
    if not v:
        raise NoKey("GEMINI_API_KEY is not set in this environment (docs/INTEGRATIONS.md)")
    return v


def _request(url, data=None, headers=None, method=None):
    req = urllib.request.Request(url, data=data, method=method or ("POST" if data else "GET"), headers=headers or {})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        body = r.read()
        return r.headers, body


def upload(path, key):
    """Resumable upload to the Files API; returns the file's uri and name."""
    p = Path(path)
    mime = mimetypes.guess_type(p.name)[0] or "video/mp4"
    size = p.stat().st_size
    start_headers, _ = _request(
        f"{API}/upload/v1beta/files?key={key}",
        data=json.dumps({"file": {"display_name": p.name}}).encode(),
        headers={
            "X-Goog-Upload-Protocol": "resumable",
            "X-Goog-Upload-Command": "start",
            "X-Goog-Upload-Header-Content-Length": str(size),
            "X-Goog-Upload-Header-Content-Type": mime,
            "Content-Type": "application/json",
        },
    )
    upload_url = start_headers.get("X-Goog-Upload-URL")
    if not upload_url:
        raise RuntimeError("the Files API gave no upload address")
    _, body = _request(
        upload_url,
        data=p.read_bytes(),
        headers={"Content-Length": str(size), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize"},
    )
    info = json.loads(body.decode()).get("file", {})
    name, uri, state = info.get("name"), info.get("uri"), info.get("state")
    # A video is processed before it can be read; wait for ACTIVE.
    waited = 0
    while state == "PROCESSING" and waited < 300:
        time.sleep(5)
        waited += 5
        _, b = _request(f"{API}/v1beta/{name}?key={key}")
        state = json.loads(b.decode()).get("state")
    if state != "ACTIVE":
        raise RuntimeError(f"the uploaded video never became readable (state {state})")
    return {"name": name, "uri": uri, "mime": mime, "bytes": size}


def judge(path, model=DEFAULT_MODEL, question=None):
    key = _key()
    f = upload(path, key)
    body = {
        "contents": [{"role": "user", "parts": [
            {"file_data": {"file_uri": f["uri"], "mime_type": f["mime"]}},
            {"text": (question or PROMPT)},
        ]}],
        "generationConfig": {"temperature": 0.2, "response_mime_type": "application/json", "max_output_tokens": 1500},
    }
    _, out = _request(f"{API}/v1beta/models/{model}:generateContent?key={key}",
                      data=json.dumps(body).encode(), headers={"Content-Type": "application/json"})
    j = json.loads(out.decode())
    text = "".join(p.get("text", "") for c in j.get("candidates", []) for p in c.get("content", {}).get("parts", []))
    usage = j.get("usageMetadata", {})
    try:
        answer = json.loads(text)
    except json.JSONDecodeError:
        answer = {"raw": text}
    return {"source": "gemini", "model": model, "file": {"name": f["name"], "bytes": f["bytes"]},
            "tokens": {"in": usage.get("promptTokenCount"), "out": usage.get("candidatesTokenCount")},
            "judgement": answer}


def _self_test():
    """Without a key this proves the prompt and the shapes; with one it proves
    the reader against a tiny synthetic video it writes itself."""
    checks = []
    checks.append(("prompt asks for JSON keys", all(k in PROMPT for k in ("shots", "drops", "one_change", "ends_on_outro"))))
    try:
        _key()
        has_key = True
    except NoKey:
        has_key = False
    if not has_key:
        for label, good in checks:
            print(f"  {'ok ' if good else 'BAD'} {label}")
        print("  -- gemini skipped: GEMINI_API_KEY is not set")
        return 0 if all(g for _, g in checks) else 1
    print("  key present; a live run needs a real video file: python scripts/signals/video.py FILE.mp4")
    for label, good in checks:
        print(f"  {'ok ' if good else 'BAD'} {label}")
    return 0 if all(g for _, g in checks) else 1


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("file", nargs="?")
    ap.add_argument("--model", default=DEFAULT_MODEL)
    ap.add_argument("--question")
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args(argv)
    if args.self_test:
        return _self_test()
    if not args.file:
        ap.print_help()
        return 2
    try:
        print(json.dumps(judge(args.file, args.model, args.question), indent=2, ensure_ascii=False))
    except NoKey as e:
        print(f"skipped: {e}", file=sys.stderr)
        return 3
    except urllib.error.HTTPError as e:
        print(f"Gemini answered {e.code}: {e.read().decode()[:300]}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
