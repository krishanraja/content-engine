#!/usr/bin/env python3
"""spoken_rules: the read-aloud rules Krish kept, live, for drafting a spoken script.

Krish, 2026-10-31: "you know that I want the ability to make this better
iteratively". The Sunday learning compiler proposes what he changes reading his
scripts aloud (learning/compile.ts, scope key spoken:*); he keeps, rewords or
turns each down on his list. This prints the ones he kept, his own wording
first where he reworded one, so the Scripts step of make-piece applies them the
week he decides, with no code change. They are folded into ai-harness
krish-voice's voice profile (Spoken script) as they settle, which is where
every other repository reads them.

    python scripts/voice/spoken_rules.py [--json]

Exit 0 with the rules, or "none kept yet"; exit 2 when the engine cannot be read
(then draft from krish-voice alone and say so).
"""
import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'post-pack'))
import making  # noqa: E402

PATH = '/api/video-studio/learning-proposals?decided=spoken'


def rules(call=None):
    """[(rule, decided_at, reworded)] the rules he kept, the newest first."""
    data = (call or making._engine_call)('GET', PATH, None)
    if isinstance(data, tuple):
        data = data[1]
    if isinstance(data, (str, bytes)):
        data = json.loads(data)
    out = []
    for r in (data or {}).get('rules') or []:
        if isinstance(r, dict) and isinstance(r.get('rule'), str) and r['rule'].strip():
            out.append({'rule': r['rule'].strip(), 'decided_at': r.get('decided_at'), 'reworded': bool(r.get('decision_note'))})
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args(argv)
    try:
        kept = rules()
    except Exception as error:  # noqa: BLE001 - any failure to read is the same answer: draft without them, and say so
        print(f'spoken_rules: the engine could not be read ({error}); draft from krish-voice alone and say so', file=sys.stderr)
        return 2
    if args.json:
        print(json.dumps(kept, indent=2))
    elif not kept:
        print('none kept yet')
    else:
        for r in kept:
            print(f"- {r['rule']}" + (' (his wording)' if r['reworded'] else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
