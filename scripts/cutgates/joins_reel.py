#!/usr/bin/env python3
"""Each cut's joins reel, and the board input that lists it on the Monday board.

F09 (27 Oct): Krish heard the ten-join reel and rejected it ("clipping after answered all the"). Every cut now
comes with its own reel: the sound one and a half seconds either side of every join, in order, with a short
silence between, so he can hear each join in under a minute. It is listed on the day's tab through the board's
existing --materials input (scripts/post-pack/board_materials.py); week_board.py is not changed.

    python3 scripts/cutgates/joins_reel.py build --video CUT.mp4 [--receipt CUT.mp4.validation.json] [--out DIR]
        writes CUT.joins-reel.m4a and CUT.joins-reel.json (reel time to cut time, the words either side, each
        join's gap check) beside the cut, or in DIR
    python3 scripts/cutgates/joins_reel.py board --piece UUID --reel long=URL[,INDEX.json] --reel short=URL[,INDEX.json]
        [--materials EXISTING.json] --out materials.json
        then: week_board.py ... --materials mon=materials.json

The URL is where filing put the reel (an https link, or a board asset under /api/board/). The reel is built from
the finished file's own decoded sound, never from the take.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

PAD_S = 1.5
SILENCE_S = 0.6
SECTION = 'joins-reel'


def _ffmpeg():
    return shutil.which('ffmpeg') or 'ffmpeg'


def joins_of(receipt: dict) -> list[dict]:
    """The joins a receipt's checks.joins measured, each with its gap result."""
    rows = ((receipt.get('checks') or {}).get('joins') or {}).get('joins')
    if not isinstance(rows, list):
        raise ValueError('the receipt has no checks.joins: make the cut with make.py (or ve qc) so its joins are measured')
    return rows


def build(video, joins, out_dir=None, *, pad: float = PAD_S, silence: float = SILENCE_S) -> dict:
    """The reel and its index. joins: seconds or checks.joins rows ({at_s, status, before, after})."""
    video = Path(video)
    out_dir = Path(out_dir or video.parent)
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = [j if isinstance(j, dict) else {'at_s': float(j)} for j in joins]
    reel = out_dir / f'{video.stem}.joins-reel.m4a'
    index = {'video': video.name, 'reel': reel.name, 'pad_s': pad, 'silence_s': silence, 'joins': []}
    if not rows:
        index['note'] = 'this cut has no joins: one uninterrupted take'
        (out_dir / f'{video.stem}.joins-reel.json').write_text(json.dumps(index, indent=1), encoding='utf-8')
        return index
    parts, cursor = [], 0.0
    for n, row in enumerate(rows):
        start = max(0.0, float(row['at_s']) - pad)
        length = float(row['at_s']) + pad - start
        parts.append(f'[0:a]atrim=start={start:.3f}:duration={length:.3f},asetpts=PTS-STARTPTS,'
                     f'aresample=48000,aformat=channel_layouts=stereo[c{n}]')
        index['joins'].append({'n': n + 1, 'cut_s': round(float(row['at_s']), 3), 'reel_s': round(cursor + float(row['at_s']) - start, 3),
                               **{k: row[k] for k in ('status', 'before', 'after', 'gap_ms', 'message') if k in row}})
        cursor += length + silence
    gaps = ''.join(f'anullsrc=r=48000:cl=stereo,atrim=duration={silence}[s{n}];' for n in range(len(rows)))
    chain = ''.join(f'[c{n}][s{n}]' for n in range(len(rows)))
    graph = ';'.join(parts) + ';' + gaps + f'{chain}concat=n={2 * len(rows)}:v=0:a=1[a]'
    subprocess.run([_ffmpeg(), '-nostdin', '-y', '-v', 'error', '-i', str(video), '-filter_complex', graph, '-map', '[a]',
                    '-c:a', 'aac', '-b:a', '160k', str(reel)], check=True)
    index['seconds'] = round(cursor, 3)
    (out_dir / f'{video.stem}.joins-reel.json').write_text(json.dumps(index, indent=1), encoding='utf-8')
    return index


def section(cut: str, url: str, index: dict | None = None) -> dict:
    """One board materials section for one cut's reel (board_materials.validate's shape)."""
    joins = (index or {}).get('joins') or []
    failed = [j for j in joins if j.get('status') == 'fail']
    note = (f'{len(joins)} join(s), each heard 1.5 seconds either side, in order. '
            + (f'{len(failed)} sit outside an agreed gap: ' + '; '.join(j.get('message', f'join {j["n"]}') for j in failed[:4])
               if failed else 'Every join measured in an agreed gap; your ear is the last check.')) if joins else \
        'No join list came with this reel.'
    return {'id': f'{SECTION}-{cut}', 'title': f'Joins reel, {cut} cut', 'note': note,
            'files': [{'label': f'Play the {cut} cut\'s joins reel', 'url': url}]}


def materials(piece: str, reels: list[tuple[str, str, dict | None]], existing: dict | None = None) -> dict:
    """The day's materials with one joins-reel section a cut. An existing materials file keeps everything else;
    a reel section of the same cut is replaced, never doubled."""
    data = dict(existing or {'piece_id': piece, 'status': 'review',
                             'note': 'Listen to each cut\'s joins reel before the cut is passed.', 'sections': []})
    if data.get('piece_id') != piece:
        raise ValueError('the existing materials belong to another piece')
    keep = [s for s in data.get('sections', []) if not str(s.get('id', '')).startswith(SECTION + '-')]
    data['sections'] = keep + [section(cut, url, index) for cut, url, index in reels]
    return data


def main(argv=None):
    ap = argparse.ArgumentParser(description='Each cut\'s joins reel, and its board input.')
    sub = ap.add_subparsers(dest='cmd', required=True)
    b = sub.add_parser('build')
    b.add_argument('--video', required=True)
    b.add_argument('--receipt', help="the cut's .validation.json (default: beside the video)")
    b.add_argument('--out')
    m = sub.add_parser('board')
    m.add_argument('--piece', required=True)
    m.add_argument('--reel', action='append', required=True, metavar='CUT=URL[,INDEX.json]')
    m.add_argument('--materials', help='the day\'s materials file already made; its other sections are kept')
    m.add_argument('--out', required=True)
    a = ap.parse_args(argv)
    if a.cmd == 'build':
        receipt = Path(a.receipt or str(a.video) + '.validation.json')
        index = build(a.video, joins_of(json.loads(receipt.read_text(encoding='utf-8'))), a.out)
        print(json.dumps(index, indent=1))
        return 0
    reels = []
    for item in a.reel:
        cut, _, rest = item.partition('=')
        url, _, index = rest.partition(',')
        reels.append((cut, url, json.loads(Path(index).read_text(encoding='utf-8')) if index else None))
    existing = json.loads(Path(a.materials).read_text(encoding='utf-8')) if a.materials else None
    data = materials(a.piece, reels, existing)
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'post-pack'))
    import board_materials
    board_materials.validate(data, a.piece)
    Path(a.out).write_text(json.dumps(data, indent=1), encoding='utf-8')
    print(a.out)
    return 0


if __name__ == '__main__':
    sys.exit(main())
