#!/usr/bin/env python3
"""asset_routes: which v5 Library command makes an asset, and a clear refusal when the Library is not here.

Ruling (Krish, 2026-11-26): "I believe that growth should move all asset production to Content Engine." Every asset
kind growth-makeyourmindup used to make is a row in config/asset-routes.json, mapped to the Library command and set that
makes it now. The Library templates are the only artwork: covers and thumbnails come only from
scripts/covers/make_covers.py, carousels only from scripts/library/make_piece.py --set <set>, always through
scripts/carousel_make.py, which holds the deck and the drawn slides to config/carousel-format.json. Both land with the v5
Library (on content-engine main since #984, b0cf8943); on a checkout without them this refuses with the config's
`absent` words, and never falls back to another renderer.

    python3 scripts/post-pack/asset_routes.py list                          every kind, its status and its command
    python3 scripts/post-pack/asset_routes.py command KIND --piece P --out O [--deck D]  the command, or the refusal (exit 2)
    python3 scripts/post-pack/asset_routes.py run KIND --piece P --out O       run it (local render, no spend)
    python3 scripts/post-pack/asset_routes.py check [--library library.json]  the routes file, against the registry

Exit 0 done; 1 the routes file is wrong (check); 2 the Library is not on this checkout; 3 the kind has no Library
command yet (a gap) or is retired. Nothing here posts, sends, publishes or spends.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
ROUTES = ROOT / 'config' / 'asset-routes.json'
STATUSES = ('route', 'fixed', 'retired', 'gap')


class Refused(Exception):
    """A plain-words refusal and its exit code."""

    def __init__(self, message, code):
        super().__init__(message)
        self.code = code


def load(path=ROUTES):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def kind_row(routes, kind):
    for row in routes['kinds']:
        if row['kind'] == kind:
            return row
    raise Refused(f'no asset kind "{kind}" in config/asset-routes.json (python3 scripts/post-pack/asset_routes.py list)', 3)


def library_present(routes, command, root=ROOT):
    """None when the command's script is on the checkout, else the refusal in the config's own words."""
    script = routes['commands'][command]['script']
    if (Path(root) / script).is_file():
        return None
    return routes['absent'] + ': ' + routes['absent_detail'].format(script=script)


def command_for(routes, kind, piece, out, root=ROOT, deck=None):
    """The argv that makes `kind` for the piece, or Refused: absent Library (2), a gap or a retired kind (3)."""
    row = kind_row(routes, kind)
    status = row['status']
    if status == 'gap':
        raise Refused(f'{kind}: no Library command makes it yet. {row["gap"]} Nothing else may make it.', 3)
    if status == 'retired':
        raise Refused(f'{kind} is retired. {row["reason"]}', 3)
    if status == 'fixed':
        raise Refused(f'{kind} is fixed Library artwork ({row.get("library_template")}). {row.get("note", "")}'.strip(), 3)
    refusal = library_present(routes, row['command'], root)
    if refusal:
        raise Refused(refusal, 2)
    fill = {'piece': str(piece), 'out': str(out), 'set': row.get('set') or '', 'deck': str(deck or '<DECK.json>')}
    # A carousel goes through scripts/carousel_make.py ("via"), which checks the deck against the carousel format before
    # make_piece.py draws anything (Krish, 2026-11-26: enforce the carousel format); never make_piece.py alone.
    spec = routes['commands'][row['command']]
    return [part.format(**fill) for part in spec.get('via') or spec['argv']]


def problems(routes, library=None):
    """Why the routes file is wrong, [] when it is right. With `library` (library.json), also against the registry."""
    out = []
    commands = routes.get('commands') or {}
    sets = set((commands.get('carousel') or {}).get('sets') or [])
    outputs = set((commands.get('covers') or {}).get('outputs') or {})
    seen = set()
    for row in routes.get('kinds') or []:
        kind = row.get('kind')
        if not kind or kind in seen:
            out.append(f'{kind!r}: every kind is named once')
        seen.add(kind)
        status = row.get('status')
        if status not in STATUSES:
            out.append(f'{kind}: status is one of {", ".join(STATUSES)}')
            continue
        if not row.get('growth'):
            out.append(f'{kind}: says what Growth used to make it with')
        if status == 'route':
            command = row.get('command')
            if command not in commands:
                out.append(f'{kind}: names a command in "commands"')
            elif command == 'carousel' and row.get('set') not in sets:
                out.append(f'{kind}: names one of the carousel sets ({", ".join(sorted(sets))})')
            elif command == 'covers' and not set(row.get('outputs') or []) <= outputs:
                out.append(f'{kind}: names cover outputs make_covers.py writes ({", ".join(sorted(outputs))})')
        if status == 'gap' and not row.get('gap'):
            out.append(f'{kind}: a gap says what is missing')
        if status == 'retired' and not row.get('reason'):
            out.append(f'{kind}: a retired kind says why')
    if library is not None:
        out += registry_problems(routes, library)
    return out


def registry_problems(routes, library):
    """Each route against the Library's own registry: its set exists with these templates, and every template named is
    a Library item."""
    out = []
    lib_sets = library.get('carousel_sets') or {}
    items = {i.get('id') for i in library.get('items') or [] if isinstance(i, dict)}
    declared = set(routes['commands']['carousel']['sets'])
    if declared != set(lib_sets):
        out.append(f'the carousel sets are the Library\'s ({", ".join(sorted(lib_sets))}), not {", ".join(sorted(declared))}')
    for row in routes['kinds']:
        kind = row['kind']
        if row['status'] == 'route' and row.get('command') == 'carousel' and row.get('set') in lib_sets:
            s = lib_sets[row['set']]
            in_set = {s.get('cover'), s.get('close'), *(s.get('inside') or [])}
            for t in row.get('templates') or []:
                if t not in in_set:
                    out.append(f'{kind}: {t} is not in the Library set {row["set"]}')
        for t in list(row.get('templates') or []) + ([row['library_template']] if row.get('library_template') else []):
            if t not in items:
                out.append(f'{kind}: {t} is not a Library template')
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    sub = ap.add_subparsers(dest='cmd', required=True)
    sub.add_parser('list')
    for name in ('command', 'run'):
        p = sub.add_parser(name)
        p.add_argument('kind')
        p.add_argument('--piece', required=True)
        p.add_argument('--out', required=True)
        p.add_argument('--deck', help='a carousel\'s carousel-deck/3 file (config/carousel-format.json)')
    c = sub.add_parser('check')
    c.add_argument('--library', type=Path, help='a library.json to check the routes against (default: the checkout\'s, when present)')
    a = ap.parse_args(argv)
    routes = load()
    if a.cmd == 'list':
        for row in routes['kinds']:
            how = (f'{row["command"]}' + (f' --set {row["set"]}' if row.get('set') else '')) if row['status'] == 'route' else row['status']
            print(f'{row["kind"]:<24} {how}')
        return 0
    if a.cmd == 'check':
        lib_path = a.library or (ROOT / routes['library']['registry'])
        library = json.loads(lib_path.read_text(encoding='utf-8')) if lib_path.is_file() else None
        bad = problems(routes, library)
        for line in bad:
            print('FAIL  ' + line)
        if library is None:
            print(f'(not checked against the registry: {routes["absent"]})')
        print('ok' if not bad else f'{len(bad)} problem(s)')
        return 1 if bad else 0
    try:
        argv_out = command_for(routes, a.kind, a.piece, a.out, deck=a.deck)
        if a.cmd == 'run' and kind_row(routes, a.kind).get('command') == 'carousel' and not a.deck:
            raise Refused(f'{a.kind}: a carousel is made from its deck (--deck, a carousel-deck/3 file); '
                          'scripts/carousel_make.py checks it before anything is drawn', 1)
    except Refused as r:
        print(str(r), file=sys.stderr)
        return r.code
    if a.cmd == 'command':
        print(' '.join(argv_out))
        return 0
    return subprocess.run([sys.executable, *argv_out[1:]], cwd=ROOT).returncode


if __name__ == '__main__':
    raise SystemExit(main())
