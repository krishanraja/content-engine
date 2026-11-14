"""The filtered chat backstop (Wave 3, W3.3): a Claude Code SessionEnd hook.

At the end of a session in this repository it reads the session's transcript
and keeps only Krish's own typed lines that a local filter flags as a
correction or a rejection. Each is scrubbed with secret-guard patterns,
tagged with this repository's venture and posted to Control Center's
backstop route (POST /api/taste/backstop, the route Control Center's own hook
uses) when TASTE_BACKSTOP_TOKEN is set, or in a cloud session, whose network
proxy injects that key (I-33, Ruling, Krish, 2026-11-14, D24).
Without the key, or when the post fails, the lines are appended to the
ignored `.scratch/taste/backstop.jsonl` with their digest instead, so a line
is never kept twice and the runner (Krish's choice, 29 October 2026: "Local
file, runner posts") takes them on from that file. It never keeps a whole
chat. Tool output, pasted material, system notes and the assistant's words
are never read as his. Posting to his own taste ledger is exempt from the
approval wall (Ruling, Krish, 2026-10-26).

It always exits 0: a hook must never break the end of a session.

    python scripts/taste_backstop.py            # as the hook, reading the hook JSON on stdin
    python scripts/taste_backstop.py --dry-run TRANSCRIPT   # print what would be kept
"""
import argparse
import datetime as dt
import hashlib
import json
from pathlib import Path
import os
import re
import sys
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
OUTBOX = Path('.scratch') / 'taste' / 'backstop.jsonl'
VENTURE = 'makeyourmindup'
REPO = 'krishanraja/content-engine'
MAX_LINE = 600
MAX_TRANSCRIPT = 50 * 1024 * 1024
ORIGIN = 'https://controlcenter.krishraja.com'
BATCH = 50
# In a Claude Code cloud session the key is a network secret the proxy injects for Control Center's host, so
# the session sends this placeholder and never holds the value. Elsewhere TASTE_BACKSTOP_TOKEN is the key.
PROXY_PLACEHOLDER = 'injected-by-network-proxy'
# The route's two kinds, as Control Center's own hook names them (scripts/hooks/taste-backstop.mjs).
REJECTION = re.compile(r"\b(no,|nope|don'?t like|do not like|hate|dislike|reject|not this|kill (it|this)|drop (it|this)|"
                       r"scrap|ugly|cheesy|cringe|doesn'?t fly|won'?t fly|never (use|do|again|put))\b", re.I)

# A correction or rejection in his words. Plain phrases only: a line must say it, not hint at it.
FLAGS = re.compile(
    r"\b(?:no[,.!]|nope\b|don'?t\b|do not\b|never\b|stop\b|wrong\b|not (?:that|this|what|right|good|quite)\b|"
    r"that'?s not\b|isn'?t (?:right|it|good)\b|i said\b|i asked\b|instead\b|rather\b|reject|doesn'?t fly\b|"
    r"hate\b|too (?:long|short|much|many|busy|loud|generic|salesy)\b|why (?:did|would) you\b|undo\b|revert\b|"
    r"cut (?:it|that|this)\b|remove (?:it|that|this)\b|change (?:it|that|this)\b|less\b|ugly\b|cringe\b|"
    r"off[- ]brand\b|not on brand\b|sounds like ai\b|ai slop\b)", re.I)

# Secret-guard patterns: anything shaped like a key, token, address or number is replaced.
SECRETS = [
    (re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----', re.S), '[private key]'),
    (re.compile(r'\b(?:sk|pk|rk)-[A-Za-z0-9_-]{16,}\b'), '[key]'),
    (re.compile(r'\b(?:ghp|gho|ghu|ghs|ghr|github_pat)_[A-Za-z0-9_]{20,}\b'), '[key]'),
    (re.compile(r'\bgen1_[A-Za-z0-9_-]{8,}\b'), '[key]'),
    (re.compile(r'\bxox[abprs]-[A-Za-z0-9-]{10,}\b'), '[key]'),
    (re.compile(r'\bAKIA[0-9A-Z]{16}\b'), '[key]'),
    (re.compile(r'\bAIza[0-9A-Za-z_-]{30,}\b'), '[key]'),
    (re.compile(r'\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b'), '[token]'),
    (re.compile(r'\b[Bb]earer\s+[A-Za-z0-9._~+/=-]{12,}'), 'Bearer [token]'),
    (re.compile(r'(?i)\b(?:api[_-]?key|token|secret|password|passwd|pwd)\s*[:=]\s*\S+'), '[credential]'),
    (re.compile(r'\b[A-Fa-f0-9]{32,}\b'), '[hex]'),
    (re.compile(r'\b[A-Za-z0-9+/]{40,}={0,2}'), '[blob]'),
    (re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'), '[email]'),
    (re.compile(r'(?<!\w)\+?\d[\d ().-]{8,}\d'), '[number]'),
    (re.compile(r'https?://\S*[?&](?:token|key|sig|signature|code|auth)=\S*', re.I), '[signed link]'),
]


def scrub(text):
    for pattern, mask in SECRETS:
        text = pattern.sub(mask, text)
    return text


def his_texts(record):
    """The text Krish typed in one transcript record: never tool results, pasted material or system notes."""
    if not isinstance(record, dict) or record.get('type') != 'user' or record.get('isMeta') or record.get('isSidechain'):
        return []
    message = record.get('message')
    content = message.get('content') if isinstance(message, dict) else None
    if isinstance(content, str):
        parts = [content]
    elif isinstance(content, list):
        parts = [c.get('text') for c in content if isinstance(c, dict) and c.get('type') == 'text'
                 and isinstance(c.get('text'), str)]
    else:
        return []
    out = []
    for text in parts:
        text = re.sub(r'<pasted_content\b.*?</pasted_content[^>]*>', ' ', text, flags=re.S)
        text = re.sub(r'<(system-reminder|command-[a-z-]+|local-command-[a-z-]+|task-notification)\b.*?</\1>', ' ',
                      text, flags=re.S)
        if text.lstrip().startswith(('<', '[Request interrupted', 'Caveat:')):
            continue
        out.append(text)
    return out


def lines_from(texts):
    for text in texts:
        for line in re.split(r'(?<=[.!?])\s+|\n+', text):
            line = ' '.join(line.split())
            if 3 <= len(line) and FLAGS.search(line):
                yield line[:MAX_LINE]


def flagged(transcript_path):
    """Flagged, scrubbed lines from one transcript, in order, without repeats."""
    path = Path(transcript_path)
    if not path.is_file() or path.stat().st_size > MAX_TRANSCRIPT:
        return []
    seen, out = set(), []
    with path.open(encoding='utf-8', errors='replace') as handle:
        for raw in handle:
            try:
                record = json.loads(raw)
            except ValueError:
                continue
            for line in lines_from(his_texts(record)):
                clean = scrub(line)
                if clean not in seen:
                    seen.add(clean)
                    out.append(clean)
    return out


def entries(lines, session_id, now=None):
    at = (now or dt.datetime.now(dt.timezone.utc)).strftime('%Y-%m-%dT%H:%M:%SZ')
    session = scrub(str(session_id or ''))[:80] or None
    return [{'schema': 'growth-taste-backstop/1', 'venture': VENTURE, 'repository': REPO, 'kind': 'correction_or_rejection',
             'line': line, 'line_sha256': hashlib.sha256(line.encode('utf-8')).hexdigest(), 'session': session,
             'noted_at': at, 'posted': False} for line in lines]


def append(rows, root=ROOT):
    """Append new rows to the outbox; a line already kept (by digest) is never kept twice."""
    if not rows:
        return 0
    path = Path(root) / OUTBOX
    path.parent.mkdir(parents=True, exist_ok=True)
    known = set()
    if path.is_file():
        for raw in path.read_text(encoding='utf-8', errors='replace').splitlines():
            try:
                known.add(json.loads(raw).get('line_sha256'))
            except ValueError:
                continue
    fresh = [r for r in rows if r['line_sha256'] not in known]
    with path.open('a', encoding='utf-8') as handle:
        for row in fresh:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + '\n')
    return len(fresh)


def kind_of(line):
    """The route's kind for one flagged line: a rejection when it turns something down, else a correction."""
    return 'rejection' if REJECTION.search(line) else 'correction'


def http_post(url, headers, body):
    request = urllib.request.Request(url, data=body.encode('utf-8'), headers=headers, method='POST')
    with urllib.request.urlopen(request, timeout=8) as response:  # noqa: S310 (a fixed https origin)
        text = response.read().decode('utf-8', errors='replace')
    try:
        return response.status, json.loads(text) if text.strip() else None
    except ValueError:
        return response.status, None


def send(rows, token, origin=ORIGIN, post=http_post):
    """Post rows to Control Center in batches; the digests it accepted. Never raises, never logs the key."""
    url = origin.rstrip('/') + '/api/taste/backstop'
    headers = {'authorization': 'Bearer ' + token, 'content-type': 'application/json'}
    accepted = set()
    for i in range(0, len(rows), BATCH):
        batch = rows[i:i + BATCH]
        body = json.dumps({'schema': 'growth-taste-backstop/1', 'rows': [
            {'venture': r['venture'], 'repository': r['repository'], 'kind': kind_of(r['line']), 'line': r['line'],
             'line_sha256': r['line_sha256'], 'session': r['session'] or 'unknown-session',
             'noted_at': r['noted_at'], 'posted': False} for r in batch]}, ensure_ascii=False)
        try:
            status, reply = post(url, headers, body)
        except Exception:
            continue
        if 200 <= status < 300 and not (isinstance(reply, dict) and reply.get('ok') is False):
            accepted.update(r['line_sha256'] for r in batch)
    return accepted


def main(argv=None, stdin=None, root=ROOT, out=print, env=None, post=None):
    # post is None unless the hook itself runs (the __main__ line below): any other caller, a test above all,
    # keeps the lines locally whatever the environment says. Invented test lines reached the real ledger from a
    # cloud container on 14 Nov 2026 when a test called main() with the session's own environment.
    parser = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    parser.add_argument('--dry-run', metavar='TRANSCRIPT')
    try:
        args = parser.parse_args(argv)
        if args.dry_run:
            for line in flagged(args.dry_run):
                out(line)
            return 0
        raw = (stdin or sys.stdin).read()
        hook = json.loads(raw) if raw.strip() else {}
        transcript = hook.get('transcript_path') if isinstance(hook, dict) else None
        if not isinstance(transcript, str):
            return 0
        rows = entries(flagged(transcript), hook.get('session_id'))
        env = os.environ if env is None else env
        token = env.get('TASTE_BACKSTOP_TOKEN') or (PROXY_PLACEHOLDER if env.get('CLAUDE_CODE_REMOTE') == 'true' else '')
        sent = send(rows, token, env.get('CONTROL_CENTER_ORIGIN') or ORIGIN, post) if post and token and rows else set()
        kept = append([r for r in rows if r['line_sha256'] not in sent], root)
        if sent:
            out('taste backstop: ' + str(len(sent)) + ' sent to Control Center, ' + str(kept) + ' kept locally')
        else:
            out('taste backstop: ' + str(kept) + ' flagged line' + ('' if kept == 1 else 's') + ' kept locally; nothing sent')
    except Exception:  # a hook never breaks the end of a session, and never prints what it read
        return 0
    return 0


if __name__ == '__main__':
    sys.exit(main(post=http_post))
