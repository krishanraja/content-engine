#!/usr/bin/env python3
"""learner: the weekly voice learner. It proposes; it never applies.

Krish, 2026-10-31: "start the weekly voice learner too". It reads what Krish
changed when he read his scripts aloud (spoken_delta.py backfill's report) and
turns what repeats into candidate rules, each with its evidence:

  - a word or phrase he swaps the same way in MIN_TAKES pieces or more
    ("firms" said as "companies");
  - a word he adds in MIN_TAKES pieces or more (an opener such as "look");
  - a scripted word or phrase he drops in MIN_TAKES pieces or more;
  - a direction across the takes: contractions he adds outnumbering those he
    spells out, or a cut or ad-lib rate well above the swap rate.

A candidate is a proposal. It changes no rule, no skill and no taste: the
route for each is Krish's yes, a general rule through ai-harness krish-voice
and a makeyourmindup one through his taste ledger. Nothing here calls a model,
sends, posts or writes outside its own output file.

    python scripts/voice/learner.py [--report .cache/spoken/backfill.json] [--out FILE.md] [--json]

Signals still to join (each needs its own source first): his copy edits on
drafts (draft against approved), rejections on the floor, and engagement per
piece from growth-makeyourmindup.
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_REPORT = ROOT / '.cache' / 'spoken' / 'backfill.json'
MIN_TAKES = 3
# Words too common to make a rule of on their own.
STOP = {'the', 'a', 'an', 'and', 'of', 'to', 'in', 'is', 'it', 'that', 'this', 'for', 'on', 'with', 'as', 'at', 'be',
        'are', 'was', 'or', 'but', 'by', 'from', 'i', 'you', 'we', 'they', 'he', 'she', 'which', 'what', 'who', 'its',
        'their', 'his', 'her', 'our', 'your', 'my', 'me', 'us', 'them', 'have', 'has', 'had', 'do', 'does', 'did', 'will',
        'would', 'can', 'could', 'just', 'there', 'here', 'then', 'than', 'if', 'not', 'no', 'all', 'about', 'up', 'out'}


def piece_of(name):
    """The piece a take belongs to: its day and title, whatever its length. The long and short take of one piece are
    one piece of evidence, never two."""
    parts = [p.strip() for p in str(name).rsplit('.', 1)[0].split(' - ')]
    key = ' - '.join([parts[0]] + parts[2:]) if len(parts) >= 3 else parts[0]
    return key.replace(' (1)', '').replace('~2', '').strip()


def _phrase(text):
    return ' '.join(str(text).replace(' ...', '').split()).strip()


def _meaningful(phrase):
    words = phrase.split()
    return bool(words) and not all(w in STOP for w in words)


def candidates(report, min_takes=MIN_TAKES):
    """The candidate rules the matched takes support, strongest first. Pure."""
    takes = [t for t in (report.get('takes') or {}).values() if t.get('status') == 'matched' and t.get('delta')]
    swaps, adds, cuts = defaultdict(set), defaultdict(set), defaultdict(set)
    for t in takes:
        ex, name = t['delta'].get('examples') or {}, piece_of(t['name'])
        for e in ex.get('swapped', []):
            pair = (_phrase(e['script']), _phrase(e['said']))
            if _meaningful(pair[0]) or _meaningful(pair[1]):
                swaps[pair].add(name)
        for e in ex.get('added', []):
            for w in set(_phrase(e['said']).split()[:2]):  # what he opens an aside with
                if w not in STOP:
                    adds[w].add(name)
        for e in ex.get('cut', []):
            p = _phrase(e['script'])
            if _meaningful(p):
                cuts[p].add(name)
    out = []
    for (script, said), names in swaps.items():
        if len(names) >= min_takes:
            out.append({'kind': 'swap', 'rule': f'In a spoken script, write "{said}" where the draft has "{script}".',
                        'takes': sorted(names)})
    for word, names in adds.items():
        if len(names) >= min_takes:
            out.append({'kind': 'added', 'rule': f'He adds "{word}" when he speaks; a spoken script may carry it where it lands naturally.',
                        'takes': sorted(names)})
    for phrase, names in cuts.items():
        if len(names) >= min_takes:
            out.append({'kind': 'cut', 'rule': f'He drops "{phrase}" reading aloud; leave it out of spoken scripts.',
                        'takes': sorted(names)})
    pieces = {piece_of(t['name']) for t in takes}
    if len(pieces) >= min_takes:
        con = sum(t['delta']['contracted'] for t in takes)
        exp = sum(t['delta']['expanded'] for t in takes)
        with_con = sorted({piece_of(t['name']) for t in takes if t['delta']['contracted'] > t['delta']['expanded']})
        if con > exp and len(with_con) >= min_takes:
            out.append({'kind': 'direction', 'rule': f'Contract more in spoken scripts: he contracted {con} times and spelled out {exp} across {len(takes)} takes.',
                        'takes': sorted(with_con)})
        words = sum(t['delta']['words_script'] for t in takes)
        rates = {k: round(100 * sum(t['delta'][k] for t in takes) / words, 1) for k in ('swapped', 'cut', 'added')} if words else {}
        if rates and rates['cut'] >= 2 * max(rates['swapped'], 1):
            out.append({'kind': 'direction', 'rule': f'Scripts run long for how he speaks: he cuts {rates["cut"]} words per 100 against {rates["swapped"]} swapped. Write tighter.',
                        'takes': sorted({piece_of(t['name']) for t in takes})})
        if rates and rates['added'] >= 2 * max(rates['swapped'], 1):
            out.append({'kind': 'direction', 'rule': f'He ad-libs {rates["added"]} words per 100 script words: leave room for asides rather than scripting every link.',
                        'takes': sorted({piece_of(t['name']) for t in takes})})
    out.sort(key=lambda c: (-len(c['takes']), c['kind'], c['rule']))
    return {'matched_takes': len(takes), 'pieces': len(pieces), 'min_takes': min_takes, 'candidates': out}


def markdown(result):
    lines = ['# Voice learner: proposals', '',
             f"From {result['matched_takes']} takes of {result['pieces']} pieces matched to their scripts; a candidate needs {result['min_takes']} pieces or more.",
             'Each is a proposal for Krish. Nothing here changes a rule until he says yes.', '']
    if not result['candidates']:
        lines.append('No pattern repeats often enough yet.')
    for n, c in enumerate(result['candidates'], 1):
        lines.append(f"{n}. **{c['rule']}** ({c['kind']}, {len(c['takes'])} pieces)")
        lines.append('   Evidence: ' + '; '.join(c['takes'][:6]) + (' ...' if len(c['takes']) > 6 else ''))
    return '\n'.join(lines) + '\n'


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--report', default=str(DEFAULT_REPORT), help='spoken_delta.py backfill output')
    ap.add_argument('--out', help='write the proposals as Markdown here (default: print them)')
    ap.add_argument('--min-takes', type=int, default=MIN_TAKES)
    ap.add_argument('--json', action='store_true')
    args = ap.parse_args(argv)
    try:
        report = json.loads(Path(args.report).read_text(encoding='utf-8'))
    except (OSError, ValueError) as error:
        print(f'learner: cannot read {args.report}: {error}', file=sys.stderr)
        return 2
    result = candidates(report, args.min_takes)
    text = json.dumps(result, indent=2) if args.json else markdown(result)
    if args.out:
        Path(args.out).write_text(text, encoding='utf-8')
    else:
        print(text)
    return 0


if __name__ == '__main__':
    sys.exit(main())
