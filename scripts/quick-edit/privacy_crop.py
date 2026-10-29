#!/usr/bin/env python3
"""Screen recordings with a privacy crop (truth and rights).

A screen recording is real, dated proof (docs/production/THE_BAR.md), and it
also shows whatever else was on the screen: tabs, bookmarks, notifications,
an inbox, a name. Each recording a piece uses carries a privacy entry: the one
region of the screen that may show ("allowed", x y w h in the recording's own
pixels) and any boxes inside it to blur ("blur", the same units). Nothing
outside the allowed region is ever written.

  apply   crops the recording to the allowed region and blurs each box;
  check   proves the treated file shows only that: it is exactly the allowed
          region's size, its picture matches the recording's allowed region
          (so the crop sits where it was declared), and each blur box has
          lost its fine detail (so a blur that was asked for is really there).

The entry, as a piece's "screen_privacy" list or a file of its own:

    {"file": "screen-deepseek.mp4", "sha256": "<the recording's sha256>",
     "allowed": [0, 120, 1920, 840], "blur": [[1500, 10, 380, 60]],
     "why": "the browser's tab strip and his signed-in avatar"}

    python privacy_crop.py apply ENTRY.json SRC DST
    python privacy_crop.py check ENTRY.json SRC DST
"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

MIN_MATCH_PSNR_DB = 30.0   # the treated picture against the recording's allowed region, blur boxes masked
MAX_BLUR_DETAIL = 0.35     # a blurred box keeps at most this share of the recording's fine detail there
BLUR_RADIUS = 24
SAMPLE_FRACTIONS = (0.25, 0.75)


class PrivacyError(ValueError):
    pass


def sha256(path):
    with open(path, 'rb') as f:
        return hashlib.file_digest(f, 'sha256').hexdigest()


def probe(path):
    out = json.loads(subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                                     'stream=width,height:format=duration', '-of', 'json', str(path)],
                                    capture_output=True, text=True, check=True).stdout)
    return int(out['streams'][0]['width']), int(out['streams'][0]['height']), float(out['format']['duration'])


def validate(entry, size=None):
    """The entry's problems as sentences; [] when it is whole."""
    problems = []
    box = entry.get('allowed')
    if not (isinstance(box, list) and len(box) == 4 and all(isinstance(v, int) and v >= 0 for v in box) and box[2] > 0 and box[3] > 0):
        return ['"allowed" is [x, y, w, h] in whole pixels of the recording']
    if box[2] % 2 or box[3] % 2:
        problems.append('"allowed" needs an even width and height (the encoder halves the colour planes)')
    if size and (box[0] + box[2] > size[0] or box[1] + box[3] > size[1]):
        problems.append(f'"allowed" {box} reaches outside the {size[0]} x {size[1]} recording')
    for b in entry.get('blur') or []:
        if not (isinstance(b, list) and len(b) == 4 and all(isinstance(v, int) and v >= 0 for v in b) and b[2] > 0 and b[3] > 0):
            problems.append(f'blur box {b} is not [x, y, w, h] in whole pixels')
        elif b[0] < box[0] or b[1] < box[1] or b[0] + b[2] > box[0] + box[2] or b[1] + b[3] > box[1] + box[3]:
            problems.append(f'blur box {b} is not inside the allowed region {box}')
    if not isinstance(entry.get('sha256'), str) or not re.fullmatch(r'[0-9a-f]{64}', entry['sha256']):
        problems.append('"sha256" names the recording the entry was written for')
    return problems


def relative(entry):
    x, y = entry['allowed'][:2]
    return [[b[0] - x, b[1] - y, b[2], b[3]] for b in entry.get('blur') or []]


def filter_graph(entry, src='0:v', out='v'):
    """The crop to the allowed region, then a blur over each box, as one filter graph."""
    x, y, w, h = entry['allowed']
    parts, cur = [f'[{src}]crop={w}:{h}:{x}:{y}[c0]'], 'c0'
    for k, (bx, by, bw, bh) in enumerate(relative(entry)):
        radius = max(1, min(BLUR_RADIUS, bw // 2 - 1, bh // 2 - 1))
        parts.append(f'[{cur}]split[b{k}][k{k}]')
        parts.append(f'[k{k}]crop={bw}:{bh}:{bx}:{by},boxblur={radius}:3[z{k}]')
        parts.append(f'[b{k}][z{k}]overlay={bx}:{by}[c{k + 1}]')
        cur = f'c{k + 1}'
    parts.append(f'[{cur}]format=yuv420p[{out}]')
    return ';'.join(parts)


def apply(entry, src, dst):
    size = probe(src)[:2]
    problems = validate(entry, size)
    if not problems and sha256(src) != entry['sha256']:
        problems.append('the recording is not the one this privacy entry was written for (sha256 differs)')
    if problems:
        raise PrivacyError('; '.join(problems))
    Path(dst).parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-nostdin', '-i', str(src), '-filter_complex', filter_graph(entry),
                    '-map', '[v]', '-map', '0:a?', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-c:a', 'copy', str(dst)],
                   check=True)
    return dst


def _gray(path, at, crop=None, mask=()):
    """One frame as 8-bit grey bytes (w, h, data), optionally cropped first and with boxes filled black."""
    chain = [f'crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]}'] if crop else []
    chain += [f'drawbox=x={b[0]}:y={b[1]}:w={b[2]}:h={b[3]}:color=black:t=fill' for b in mask]
    chain.append('format=gray')
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-nostdin', '-ss', f'{at:.3f}', '-i', str(path), '-frames:v', '1',
                          '-vf', ','.join(chain), '-f', 'rawvideo', 'pipe:1'], capture_output=True, check=True).stdout
    return raw


def psnr(a, b):
    if len(a) != len(b) or not a:
        return 0.0
    mse = sum((x - y) ** 2 for x, y in zip(a, b)) / len(a)
    return 99.0 if mse == 0 else round(10 * __import__('math').log10(255 * 255 / mse), 2)


def detail(raw, w, h, box):
    """Mean absolute second difference along each row inside box: fine detail (text, icons), near zero on a
    smooth gradient or a blur."""
    x, y, bw, bh = box
    total, n = 0, 0
    for row in range(y, y + bh):
        line = raw[row * w + x: row * w + x + bw]
        total += sum(abs(2 * line[i] - line[i - 1] - line[i + 1]) for i in range(1, len(line) - 1))
        n += max(0, len(line) - 2)
    return total / n if n else 0.0


def check(entry, src, dst):
    """{'status': 'pass'|'fail', 'problems': [...], ...}: nothing outside the allowed region shows."""
    problems = validate(entry, probe(src)[:2])
    if problems:
        return {'status': 'fail', 'problems': problems}
    if sha256(src) != entry['sha256']:
        return {'status': 'fail', 'problems': ['the recording is not the one this privacy entry was written for']}
    x, y, w, h = entry['allowed']
    dw, dh, duration = probe(dst)
    if (dw, dh) != (w, h):
        return {'status': 'fail', 'problems': [f'the treated file is {dw} x {dh}, not the {w} x {h} allowed region: '
                                                'something outside it may show']}
    blurs, samples = relative(entry), []
    for fraction in SAMPLE_FRACTIONS:
        at = duration * fraction
        mine = _gray(dst, at, mask=blurs)
        theirs = _gray(src, at, crop=entry['allowed'], mask=blurs)
        row = {'at_s': round(at, 3), 'match_psnr_db': psnr(mine, theirs), 'blur': []}
        if row['match_psnr_db'] < MIN_MATCH_PSNR_DB:
            problems.append(f'at {at:.2f} s the picture does not match the allowed region ({row["match_psnr_db"]} dB): '
                            'the crop is not where the entry says')
        if blurs:
            treated, original = _gray(dst, at), _gray(src, at, crop=entry['allowed'])
            for b in blurs:
                before, after = detail(original, w, h, b), detail(treated, w, h, b)
                share = None if before < 1 else round(after / before, 3)
                row['blur'].append({'box': b, 'detail_before': round(before, 2), 'detail_after': round(after, 2), 'kept': share})
                if share is not None and share > MAX_BLUR_DETAIL:
                    problems.append(f'at {at:.2f} s the blur box {b} keeps {share:.0%} of its detail: it is not blurred')
        samples.append(row)
    return {'status': 'fail' if problems else 'pass', 'problems': problems, 'allowed': entry['allowed'], 'samples': samples,
            'treated_sha256': sha256(dst), 'recording_sha256': entry['sha256'],
            'line': f'screen recording {Path(entry.get("file") or src).name}: privacy crop to {w} x {h} at ({x}, {y}), '
                    f'{len(blurs)} blurred box(es): {"pass" if not problems else "fail"}'}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('cmd', choices=['apply', 'check'])
    ap.add_argument('entry')
    ap.add_argument('src')
    ap.add_argument('dst')
    a = ap.parse_args(argv)
    entry = json.loads(Path(a.entry).read_text(encoding='utf-8'))
    if a.cmd == 'apply':
        apply(entry, a.src, a.dst)
    result = check(entry, a.src, a.dst)
    print(json.dumps(result, indent=1))
    return 0 if result['status'] == 'pass' else 2


if __name__ == '__main__':
    raise SystemExit(main())
