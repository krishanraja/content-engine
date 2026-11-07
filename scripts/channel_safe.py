#!/usr/bin/env python3
"""channel_safe: nothing a viewer must read sits under a channel's own buttons and text.

Krish, 2026-11-03, on Monday 2 Nov's Instagram Reel: "It looks cramped. It looks like you almost didn't design this
thoughtfully for the format or the channel." The headline slab sat under Instagram's back arrow and camera, the
ladder graphic under the handle and caption, the caption beside the like rail. The platform safe zones existed in
config/studio.json, but neither maker (quick-edit, ve) read them and nothing checked a finished frame.

The zones are config/channel-safe-zones.json: one table, measured on his phone where it can be, the union over every
channel a shape is filed for (a tall cut goes to Instagram, TikTok and YouTube Shorts). Two checks use it:

  box_violations(boxes, shape)      exact: a maker that knows where it drew things (ve's props, quick-edit's caption
                                    bands) passes its boxes;
  frame_violations(path, shape)     any finished video or image: reads the words in sampled frames (tesseract) and
                                    fails any word inside a zone. Graphics without words are left to the box check
                                    and the reviewer.

    python3 scripts/channel_safe.py FILE [--shape tall] [--every 1.0]     exit 1 when anything is in a zone
    python3 scripts/channel_safe.py COVER.png --shape cover_tall              a tall cut's cover: also the 3:4 profile
                                                                              grid crop and the account row (7 Nov)
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'config' / 'channel-safe-zones.json'
MIN_CONF = 70        # tesseract confidence a word needs to count
MIN_CHARS = 3        # shorter tokens are noise (a logo edge, a button glyph)
VIDEO_SUFFIXES = {'.mp4', '.mov', '.mkv', '.webm'}


def load(path: Path = CONFIG) -> dict:
    return json.loads(Path(path).read_text(encoding='utf-8'))


def zones(shape: str = 'tall', table: dict | None = None) -> list[dict]:
    table = table or load()
    out = []
    for channel in table['shapes'][shape]:
        for zone in table['channels'][channel]['zones']:
            out.append({'channel': channel, 'name': zone['name'], 'box': tuple(zone['box']), 'cut': bool(zone.get('cut'))})
    return out


def overlap(a, b) -> int:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return max(0, min(ax + aw, bx + bw) - max(ax, bx)) * max(0, min(ay + ah, by + bh) - max(ay, by))


def box_violations(boxes, shape: str = 'tall', table: dict | None = None) -> list[dict]:
    """boxes: [(what, (x, y, w, h))] on the 1080x1920 canvas. One row per box per zone it enters."""
    hits = []
    for what, box in boxes:
        for zone in zones(shape, table):
            if overlap(box, zone['box']):
                hits.append({'what': what, 'box': list(box), 'channel': zone['channel'], 'zone': zone['name']})
    return hits


def tesseract_words(png: Path) -> list[tuple[str, float, tuple[int, int, int, int]]]:
    exe = shutil.which('tesseract')
    if not exe:
        raise OSError('tesseract is not on PATH')
    tsv = subprocess.run([exe, str(png), 'stdout', '--psm', '11', 'tsv'], capture_output=True, text=True, check=True).stdout
    words = []
    for line in tsv.splitlines()[1:]:
        cols = line.split('\t')
        if len(cols) < 12 or not cols[11].strip():
            continue
        try:
            conf = float(cols[10])
        except ValueError:
            continue
        words.append((cols[11].strip(), conf, tuple(int(c) for c in cols[6:10])))
    return words


def frames(path: Path, every: float, out: Path) -> list[tuple[float, Path]]:
    out.mkdir(parents=True, exist_ok=True)
    if path.suffix.lower() not in VIDEO_SUFFIXES:
        target = out / 'frame-0.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(path), '-vf', 'scale=1080:1920', str(target)], check=True)
        return [(0.0, target)]
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(path), '-vf', f'fps=1/{every},scale=1080:1920',
                    str(out / 'frame-%04d.png')], check=True)
    return [((i) * every, p) for i, p in enumerate(sorted(out.glob('frame-*.png')))]


def frame_violations(path, shape: str = 'tall', every: float = 1.0, read=None, workdir: Path | None = None,
                     table: dict | None = None) -> dict:
    """Words read inside a zone, per sampled frame. read(png) -> [(text, conf, (x, y, w, h))]."""
    import tempfile
    read = read or tesseract_words
    target = 'no readable word inside any channel zone'
    try:
        with tempfile.TemporaryDirectory() as temp:
            hits = []
            for at, png in frames(Path(path), every, Path(workdir or temp)):
                for text, conf, box in read(png):
                    if conf < MIN_CONF or len(text) < MIN_CHARS:
                        continue
                    for zone in zones(shape, table):
                        # Under a button, a word counts when most of it is covered; at a crop line (the profile
                        # grid), a word that crosses the line at all is cut.
                        share = 0 if zone['cut'] else 0.5 * box[2] * box[3]
                        if overlap(box, zone['box']) > share:
                            hits.append({'at_s': round(at, 2), 'word': text, 'box': list(box),
                                         'channel': zone['channel'], 'zone': zone['name']})
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        # A missing or failing reader never crashes the maker that called it, and never passes.
        return {'value': None, 'target': target, 'pass': None, 'status': 'not_run', 'reason': str(error)[:300]}
    return {'value': {'in_zones': hits[:20], 'count': len(hits)}, 'target': target, 'pass': not hits}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split('\n\n')[0])
    parser.add_argument('file')
    parser.add_argument('--shape', default='tall', choices=sorted(load()['shapes']))
    parser.add_argument('--every', type=float, default=1.0)
    args = parser.parse_args(argv)
    result = frame_violations(args.file, args.shape, args.every)
    if result['pass'] is None:
        print(f"channel_safe: not run ({result['reason']})")
        return 2
    for hit in result['value']['in_zones']:
        print(f"  {hit['at_s']:>6} s  '{hit['word']}' under {hit['channel']}'s {hit['zone']}")
    print(f"channel_safe: {'clear' if result['pass'] else str(result['value']['count']) + ' word(s) under a channel'}")
    return 0 if result['pass'] else 1


if __name__ == '__main__':
    sys.exit(main())
