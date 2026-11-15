#!/usr/bin/env python3
"""A tall post is centred on the screen (Ruling, Krish, 2026-11-15: tall memes are centred).

Krish, 15 Nov 2026: "The POV computer meme, it's not centralized on the screen." The meme that went out on 13 Nov (a
9:16 cut on Reels, Facebook, Threads, X and Shorts) sat 40 px left and 107 px high, with an empty third below it.

    python3 scripts/layout_centre.py FILE.mp4|FILE.png [...]    exit 1 with every reason
    python3 scripts/layout_centre.py --self-test

Measured on the 1080x1920 frame (a video at 0.5 s and then every 2 s), against the background (the median of the four
corners), content being every pixel that differs from it by more than 40 summed over the channels. Rows with content
form bands (gaps under 12 px merged); the picture is the tallest band, the rest are the words and marks. The bars, set
from the measured file and the channels' measured zones (config/brand-palette.json formats.meme_tall carries them):

  C1  the picture's centre within 4 px of the middle across, and the group's left and right margins within 16 px;
  C2  the picture's centre within 48 px (2.5% of the height) of y 920, where Growth's tall templates centre the clip;
  C3  every word and mark inside the clear box x 200 to 880, y 270 to 1320 and clear of every channel's buttons and
      caption area (config/channel-safe-zones.json, the same table scripts/channel_safe.py reads), the picture inside
      x 120 to 960;
  C4  no empty band above the group taller than 25% of the height.

It runs in ve qc on a tall meme (velib/qc.py) and before filing (scripts/post-pack/send.py); a proxy, never approval.
Standard library plus Pillow and NumPy, and ffmpeg for a video.
"""
from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PALETTE = ROOT / 'config' / 'brand-palette.json'
ZONES = ROOT / 'config' / 'channel-safe-zones.json'
VIDEO = {'.mp4', '.mov', '.m4v', '.webm'}


def bars() -> dict:
    return json.loads(PALETTE.read_text(encoding='utf-8'))['formats']['meme_tall']['centre']


def zones() -> list[tuple[str, tuple[int, int, int, int]]]:
    doc = json.loads(ZONES.read_text(encoding='utf-8'))
    out = []
    for ch, c in doc['channels'].items():
        for z in c.get('zones') or []:
            x, y, w, h = z['box']
            out.append((f'{ch}: {z["name"]}', (x, y, x + w, y + h)))
    return out


def frames(path: Path, tmp: str) -> list[Path]:
    if path.suffix.lower() not in VIDEO:
        return [path]
    probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(path)],
                           capture_output=True, text=True, check=True)
    duration = float(probe.stdout.strip() or 0)
    times = [0.5] + [t for t in range(2, int(duration), 2)]
    out = []
    for i, t in enumerate(times):
        f = Path(tmp) / f'f{i}.png'
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', str(t), '-i', str(path), '-frames:v', '1', str(f)], check=True)
        if f.exists():
            out.append(f)
    return out


def measure(img_path: Path) -> dict:
    import numpy as np
    from PIL import Image
    a = np.asarray(Image.open(img_path).convert('RGB')).astype(np.int16)
    h, w, _ = a.shape
    corners = np.concatenate([a[:16, :16].reshape(-1, 3), a[:16, -16:].reshape(-1, 3),
                              a[-16:, :16].reshape(-1, 3), a[-16:, -16:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    mask = np.abs(a - bg).sum(-1) > 40
    rows = mask.any(1)
    bands, start = [], None
    for y, on in enumerate(list(rows) + [False]):
        if on and start is None:
            start = y
        elif not on and start is not None:
            if y - start > 2:
                bands.append([start, y - 1])
            start = None
    merged = []
    for b in bands:
        if merged and b[0] - merged[-1][1] < 12:
            merged[-1][1] = b[1]
        else:
            merged.append(list(b))
    boxes = []
    for y0, y1 in merged:
        cols = np.where(mask[y0:y1 + 1].any(0))[0]
        boxes.append((int(cols.min()), int(y0), int(cols.max()), int(y1)))
    if not boxes:
        return {'size': [w, h], 'empty': True}
    picture = max(boxes, key=lambda b: b[3] - b[1])
    gx0, gy0 = min(b[0] for b in boxes), min(b[1] for b in boxes)
    gx1, gy1 = max(b[2] for b in boxes), max(b[3] for b in boxes)
    return {'size': [w, h], 'empty': False, 'picture': picture, 'words': [b for b in boxes if b != picture],
            'picture_centre': [round((picture[0] + picture[2]) / 2, 1), round((picture[1] + picture[3]) / 2, 1)],
            'margins': [gx0, w - 1 - gx1], 'top_gap_pct': round(gy0 / h * 100, 1),
            'bottom_gap_pct': round((h - 1 - gy1) / h * 100, 1)}


def problems_of(m: dict, b: dict | None = None, zone_list=None) -> list[str]:
    b = b or bars()
    if m.get('empty'):
        return ['the frame is empty']
    w, h = m['size']
    sx, sy = w / 1080, h / 1920
    out = []
    cx, cy = b.get('picture_centre', [540, 960])
    dx = round(m['picture_centre'][0] - cx * sx, 1)
    dy = round(m['picture_centre'][1] - cy * sy, 1)
    if abs(dx) > b['picture_dx_px'] * sx:
        out.append(f'the picture sits {dx} px off the middle across (within {b["picture_dx_px"]})')
    if abs(m['margins'][0] - m['margins'][1]) > b['margin_diff_px'] * sx:
        out.append(f'the margins are {m["margins"][0]} px left and {m["margins"][1]} px right (within '
                   f'{b["margin_diff_px"]} of each other): the column is not centred')
    if abs(dy) > b['picture_dy_px'] * sy:
        out.append(f'the picture sits {dy} px off its centre at y {cy} (within {b["picture_dy_px"]}, 2.5% of the height)')
    if m['top_gap_pct'] > b['top_gap_max_pct']:
        out.append(f'an empty band of {m["top_gap_pct"]}% above the content (at most {b["top_gap_max_pct"]}%)')
    px0, _, px1, _ = m['picture']
    if px0 < b['picture_x'][0] * sx or px1 > b['picture_x'][1] * sx:
        out.append(f'the picture runs x {px0} to {px1}, outside x {b["picture_x"][0]} to {b["picture_x"][1]}')
    wx0, wy0, wx1, wy1 = b.get('words_box', [0, 0, 1080, 1920])
    for box in m['words']:
        scaled = (box[0] / sx, box[1] / sy, box[2] / sx, box[3] / sy)
        if scaled[0] < wx0 or scaled[2] > wx1 or scaled[1] < wy0 or scaled[3] > wy1:
            out.append(f'words or a mark at x {box[0]} to {box[2]}, y {box[1]} to {box[3]} sit outside the clear box '
                       f'x {wx0} to {wx1}, y {wy0} to {wy1}')
            continue
        for name, (zx0, zy0, zx1, zy1) in zone_list if zone_list is not None else zones():
            if scaled[0] < zx1 and scaled[2] > zx0 and scaled[1] < zy1 and scaled[3] > zy0:
                out.append(f'words or a mark at x {box[0]} to {box[2]}, y {box[1]} to {box[3]} sit under {name}')
                break
    return out


def check(paths: list[str]) -> list[str]:
    found = []
    with tempfile.TemporaryDirectory() as tmp:
        for p in paths:
            path = Path(p)
            seen = set()
            for f in frames(path, tmp):
                for problem in problems_of(measure(f)):
                    if problem not in seen:
                        seen.add(problem)
                        found.append(f'{path.name}: {problem}')
    return found


def self_test() -> int:
    from PIL import Image, ImageDraw
    ok = True
    with tempfile.TemporaryDirectory() as tmp:
        good = Image.new('RGB', (1080, 1920), (10, 20, 17))
        d = ImageDraw.Draw(good)
        d.rectangle([240, 400, 840, 500], fill=(246, 240, 226))      # the headline, centred
        d.rectangle([160, 600, 920, 1240], fill=(120, 90, 200))      # the picture, centred on y 920
        g = Path(tmp) / 'good.png'
        good.save(g)
        bad = Image.new('RGB', (1080, 1920), (10, 20, 17))
        d = ImageDraw.Draw(bad)
        d.rectangle([122, 308, 867, 472], fill=(246, 240, 226))      # the 13 Nov layout: left column, high
        d.rectangle([114, 571, 885, 1135], fill=(120, 90, 200))
        d.rectangle([560, 1176, 879, 1213], fill=(126, 240, 192))
        bpath = Path(tmp) / 'bad.png'
        bad.save(bpath)
        ok = ok and check([str(g)]) == []
        found = ' | '.join(check([str(bpath)]))
        ok = ok and 'off the middle across' in found and 'off its centre' in found and 'margins' in found
    print('layout_centre self-test: ' + ('ok' if ok else 'FAILED'))
    return 0 if ok else 1


def main(argv=None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    if argv[:1] == ['--self-test']:
        return self_test()
    if not argv:
        print(__doc__)
        return 2
    found = check(argv)
    for p in found:
        print(f'layout_centre: {p}')
    if not found:
        print('layout_centre: centred on the screen and clear of every channel\'s buttons (a proxy: look at it on the phone)')
    return 1 if found else 0


if __name__ == '__main__':
    sys.exit(main())
