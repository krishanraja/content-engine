#!/usr/bin/env python3
"""post_binding: a post's library folder is bound to its piece, its name freezes at the first send, and a weekly report
flags any piece spread across folders (W3.5).

Krish's asset library keeps one folder per post (library.py). Until now nothing tied the folder to the piece: a piece
re-packed under a new title got a second folder, and a test pack could land beside the real ones. Three rules now:

1. Bound to its piece: the piece's making record holds its post folder (pack.folder, written by build.py and send.py).
2. Frozen at the first send: once pack.sent_at is on the record, a send under any other folder name is refused; the
   folder he already has stays the one (frozen_problem, called by send.py before it sends).
3. Canary and test folders never reach the real library, and a rendered video lands only in 3 Video (library.refusal,
   path_test_folder and path_render_outside_video, the same rule as the engine's routes).

    python3 scripts/post-pack/post_binding.py report --records RECORDS.json --files FILES.json [--out REPORT.md]
        RECORDS.json: [{"id", "meta": {"making": {"pack": {"folder", "sent_at"}}}}] (the pieces, as the engine holds them);
        FILES.json: [{"path"}] (the library's files). Flags every piece whose files sit in more than one post folder, or
        in a folder other than the one bound to it, and every post folder no piece holds. Read-only.
    python3 scripts/post-pack/post_binding.py self-test
"""
import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import library  # noqa: E402


class BindingError(Exception):
    pass


def bound_folder(record):
    pack = ((record or {}).get('pack') or {}) if isinstance(record, dict) else {}
    return pack.get('folder') or None, pack.get('sent_at') or None


def frozen_problem(record, folder):
    """Why this piece may not be sent under this folder name, or None. Its name freezes at the first send."""
    if library.TEST_SUBJECT.search(str(folder).split(' - ', 1)[-1]):
        return f'"{folder}" is a canary or test post: it never goes into the real library'
    held, sent_at = bound_folder(record)
    if sent_at and held and held != folder:
        return (f'this piece was first sent as "{held}" on {sent_at[:10]}; its folder name is frozen. '
                f'Build the pack under that name, never as "{folder}"')
    return None


def spread(records, files):
    """(pieces spread across folders: {piece: [folders]}, files outside the bound folder: {piece: [folders]},
    folders no piece holds: [folder])."""
    by_folder = defaultdict(list)
    for f in files:
        parts = str((f or {}).get('path') or '').split('/')
        if len(parts) >= 3 and parts[0] == library.POSTS:
            by_folder[parts[1]].append(f['path'])
    bound = {}
    for r in records:
        folder, _ = bound_folder(((r or {}).get('meta') or {}).get('making'))
        if folder:
            bound.setdefault(r['id'], set()).add(folder)
    folder_to_piece = defaultdict(set)
    for piece, folders in bound.items():
        for f in folders:
            folder_to_piece[f].add(piece)
    # A folder whose subject and date match a bound folder's but whose name differs is the same piece, spread.
    def key(name):
        head, _, subject = name.partition(' - ')
        return head[:10], ' '.join(subject.lower().split())[:24]
    spread_pieces, outside = defaultdict(set), defaultdict(set)
    for name in by_folder:
        if name in folder_to_piece:
            continue
        for piece, folders in bound.items():
            if any(key(name)[0] == key(b)[0] and (key(name)[1][:12] == key(b)[1][:12]) for b in folders):
                spread_pieces[piece].update(folders | {name})
                outside[piece].add(name)
    orphans = sorted(n for n in by_folder if n not in folder_to_piece and not any(n in v for v in outside.values()))
    return ({p: sorted(v) for p, v in spread_pieces.items()}, {p: sorted(v) for p, v in outside.items()}, orphans)


def report(records, files):
    spread_pieces, outside, orphans = spread(records, files)
    lines = ['# Post folders: the weekly spread report (W3.5)', '']
    if not spread_pieces and not orphans:
        lines.append('Every piece\'s files are in the one folder bound to it, and every post folder is held by a piece.')
    for piece, folders in sorted(spread_pieces.items()):
        lines.append(f'- Spread: piece `{piece}` is in {len(folders)} folders: ' + '; '.join(f'"{f}"' for f in folders)
                     + '. Its bound folder is the one its record holds; the others are for Krish to consolidate.')
    for name in orphans:
        lines.append(f'- No piece holds "{name}".')
    return '\n'.join(lines) + '\n'


def self_test():
    bad = []
    check = lambda name, ok: bad.append(name) if not ok else None
    sent = {'pack': {'folder': '2026-10-26 Mon follow.the.money - Who walks away', 'sent_at': '2026-10-27T09:00:00Z'}}
    check('the folder it was first sent as may be sent again', frozen_problem(sent, '2026-10-26 Mon follow.the.money - Who walks away') is None)
    check('a new name after the first send is refused', 'frozen' in (frozen_problem(sent, '2026-10-26 Mon follow.the.money - Who walks away now') or ''))
    check('before the first send a name may change', frozen_problem({'pack': {'folder': 'x'}}, '2026-10-26 Mon follow.the.money - Y') is None)
    check('a canary folder is refused', 'canary' in (frozen_problem({}, '2026-10-26 Mon follow.the.money - Canary run') or ''))
    check('the library refuses a test post and a render outside 3 Video',
          library.refusal('3 Posts/2026-10-05 Mon follow.the.money - Test pack/READ ME.txt') == 'path_test_folder'
          and library.refusal('3 Posts/2026-10-05 Mon follow.the.money - Who gets paid/4 Social/clip.mp4') == 'path_render_outside_video')
    records = [{'id': 'p1', 'meta': {'making': sent}},
               {'id': 'p2', 'meta': {'making': {'pack': {'folder': '2026-10-28 Wed under.the.hood - Duet gate'}}}}]
    P = '3 Posts/'
    files = [{'path': P + '2026-10-26 Mon follow.the.money - Who walks away/3 Video/a.mp4'},
             {'path': P + '2026-10-26 Mon follow.the.money - Who walks away now/3 Video/b.mp4'},
             {'path': P + '2026-10-28 Wed under.the.hood - Duet gate/READ ME.txt'},
             {'path': P + '2026-10-30 Fri mind.the.gap - Hiring data/READ ME.txt'}]
    spread_pieces, _, orphans = spread(records, files)
    check('a piece filed twice is flagged with both folders', spread_pieces == {'p1': ['2026-10-26 Mon follow.the.money - Who walks away',
                                                                                     '2026-10-26 Mon follow.the.money - Who walks away now']})
    check('a folder no piece holds is listed', orphans == ['2026-10-30 Fri mind.the.gap - Hiring data'])
    text = report(records, files)
    check('the report names the spread piece and the orphan', 'Spread: piece `p1`' in text and 'No piece holds "2026-10-30' in text)
    clean = report(records[1:], files[2:3])
    check('a clean library says so', 'Every piece' in clean)
    return bad


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd')
    r = sub.add_parser('report')
    r.add_argument('--records', required=True)
    r.add_argument('--files', required=True)
    r.add_argument('--out')
    sub.add_parser('self-test')
    a = ap.parse_args(argv)
    if a.cmd == 'self-test':
        bad = self_test()
        print('post_binding self-test ' + ('FAILED:\n  ' + '\n  '.join(bad) if bad else 'passed'))
        return 1 if bad else 0
    if a.cmd == 'report':
        text = report(json.loads(Path(a.records).read_text(encoding='utf-8')), json.loads(Path(a.files).read_text(encoding='utf-8')))
        if a.out:
            Path(a.out).write_text(text, encoding='utf-8')
        print(text, end='')
        return 0
    ap.print_help()
    return 2


if __name__ == '__main__':
    raise SystemExit(main())
