#!/usr/bin/env python3
"""The one voice check on words this engine makes, before they reach Krish's board or a pack.

Krish, 2026-11-09: "we need to make sure everything goes through the same voice
system. Absolutely everything." Control Center owns the check (krish-voice's
kill list in ai-harness, and Make Your Mind Up's canon on the publication's
channels). This script asks it through the engine's own route
(POST /api/voice/check on the engine, on the engine key), keeps no list of its
own, and prints only rule names and messages, never a credential.

    python3 scripts/post-pack/voice_gate.py --channel script long.md short.md
    python3 scripts/post-pack/voice_gate.py --channel article draft-body.md
    python3 scripts/post-pack/voice_gate.py --spec manifest-spec.json      # every channel's words

Exit 0: every file passed. Exit 1: a hard fail, named; rewrite and run again.
Exit 2: not checked (no engine key, or Control Center could not answer); the
step holds and says so on the day's tab, never a pass.
"""

import argparse
import json
import sys
from pathlib import Path

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
import engine  # noqa: E402  scripts/engine.py: the engine's address and key

CHANNELS = ('article', 'script', 'caption', 'carousel', 'substack', 'linkedin', 'x', 'threads', 'substack_note', 'instagram', 'comment', 'email')
# Growth's channels (piece_manifest.CHANNELS) -> the voice check's, by whose account each is
# (growth-makeyourmindup social/channels account_context, the same map as its engine/voice.py).
MANIFEST_CHANNEL = {
    'linkedin': 'linkedin', 'x': 'x', 'threads': 'threads', 'substack-notes': 'substack_note', 'tiktok': 'instagram',
    'instagram': 'caption', 'facebook': 'caption', 'youtube': 'caption',
}


def check(text, channel, call=None, key=None):
    """(checked, [messages]) for one text. checked False means Control Center could not be asked."""
    if not text.strip():
        return True, []
    try:
        token = key if key is not None else engine.operator_key()
    except engine.NoKey:
        return False, []
    try:
        status, body = (call or engine.call)('POST', '/api/voice/check', {'text': text, 'channel': channel}, token, timeout=30)
    except engine.Unreachable:
        return False, []
    try:
        j = json.loads(body)
    except ValueError:
        return False, []
    if status != 200 or j.get('ok') is not True or j.get('checked') is not True:
        return False, []
    return True, sorted({h.get('message', h.get('rule', '')) for h in j.get('hard') or []})


def spec_texts(spec):
    """[(label, channel, text)] for every channel's words and alt text in a manifest SPEC."""
    out = []
    for ch, entry in (spec.get('channels') or {}).items():
        if not isinstance(entry, dict) or ch not in MANIFEST_CHANNEL:
            continue
        words = '\n\n'.join([entry.get('words') or ''] + [a for a in (entry.get('alt_text') or []) if isinstance(a, str)])
        out.append((ch, MANIFEST_CHANNEL[ch], words))
    return out


def run(items, call=None, key=None, out=print):
    """0 pass, 1 a hard fail, 2 something not checked."""
    failed = unchecked = False
    for label, channel, text in items:
        checked, found = check(text, channel, call, key)
        if not checked:
            unchecked = True
            out(f'NOT CHECKED  {label}: Control Center could not be asked; this step holds.')
        elif found:
            failed = True
            out(f'FAIL  {label} ({channel}): ' + ' '.join(found))
        else:
            out(f'ok    {label} ({channel})')
    return 1 if failed else 2 if unchecked else 0


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--channel', choices=CHANNELS)
    ap.add_argument('--spec')
    ap.add_argument('files', nargs='*')
    a = ap.parse_args(argv)
    if a.spec:
        items = spec_texts(json.loads(Path(a.spec).read_text(encoding='utf-8')))
    elif a.channel and a.files:
        items = [(f, a.channel, Path(f).read_text(encoding='utf-8')) for f in a.files]
    else:
        ap.error('give --spec, or --channel and files')
    return run(items)


if __name__ == '__main__':
    raise SystemExit(main())
