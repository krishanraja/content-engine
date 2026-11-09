"""The eye contact review: a blind before/after sheet of every flagged moment on a take, and the numbers that go into
docs/ve/STATUS.md, measured on the files themselves, never taken from the pass's own plan.

Krish, 9 Nov 2026: "Highest of high standards we're going to need some significant work on the eye gaze." The pass is
cleared for published video only when a fresh blind reviewer (never the producer) passes this sheet on his takes.

    python -m velib.eyeline_review TAKE CORRECTED --out DIR [--readings DIR]

Writes into DIR:
  sheet.<stem>.<n>.jpg   moments, at most MAX_SHEET_H tall so a reader sees them at full size, each as two panels X and Y in a random order (one the take as filmed, one corrected),
                         both eyes at 2x and the face at 1x, labelled only with its time and a moment number
  key.<stem>.json        which panel is which, per moment: for whoever scores the review, never for the reviewer
  numbers.<stem>.json    (with --copy, how far each eye sits from Maxine's lens point, before and after) per corrected frame and eye, read back from CORRECTED: iris colour change (CIE76, the iris
                         where it is now against the iris where it was), catchlight (the brightest spot in the iris
                         over the iris's median, after against before), lid opening (after over before, and the two
                         eyes' ratio after against before), and over the take: blinks, off-lens time and moves

A moment is flagged when the take shows it (never when the pass did something): every window off the lens, every
blink, every look up or down and every head turn, plus the frames the pass moved most. Nothing here is a verdict.
"""
from __future__ import annotations

import argparse
import json
import math
import pickle
import random
import sys
from pathlib import Path

if __package__ in (None, ''):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    __package__ = 'velib'  # noqa: A001

from . import eyeline  # noqa: E402

MAX_SHEET_H = 1990   # a reviewer's image reader scales anything taller: a sheet must be seen at full size (9 Nov)
ZOOM = 2
MIN_GAP_S = 0.8


def cached_read(media: Path, info: dict, cache: Path | None) -> list[dict]:
    """eyeline.read, kept beside the review so a second look costs nothing."""
    if cache is not None:
        st = Path(media).stat()                     # keyed by the file itself: two corrected files share a name
        path = cache / f'readings.{media.stem}.{st.st_size}.{int(st.st_mtime)}.pkl'
        if path.is_file():
            return pickle.loads(path.read_bytes())
    rows = eyeline.read(media, info)
    if cache is not None:
        cache.mkdir(parents=True, exist_ok=True)
        path.write_bytes(pickle.dumps(rows))
    return rows


def _windows(mask, fps: float, min_frames: int = 3) -> list[tuple[int, int]]:
    out, start = [], None
    for i, on in enumerate(list(mask) + [False]):
        if on and start is None:
            start = i
        elif not on and start is not None:
            if i - start >= min_frames:
                out.append((start, i))
            start = None
    return out


def flagged(readings: list[dict], fps: float, moved: list[float]) -> list[tuple[int, str]]:
    """Frames to show, each with why the take flagged it: the middle and the peak of every off-lens window, every blink,
    every look up or down, every head turn, and the frames the pass moved most."""
    import numpy as np  # noqa: PLC0415
    decided = eyeline.plan(readings)
    n = len(readings)
    off = np.array([max((max(abs(a) for a in e['off']) for e in d['eyes'].values()), default=0.0) for d in decided])
    picks: list[tuple[int, str]] = []
    for a, b in _windows(off > eyeline.ON_LENS_DEG, fps):
        peak = a + int(np.argmax(off[a:b]))
        picks.append((peak, f'off the lens {off[peak]:.0f} deg'))
    for a, b in _windows([bool(r.get('face')) and r.get('blink', 0) >= eyeline.BLINK for r in readings], fps, 1):
        picks.append((max(0, a - 2), 'into a blink'))
    looks = eyeline.look_flags(readings, decided)
    for a, b in _windows([x >= 0.5 for x in looks], fps):
        picks.append(((a + b) // 2, 'a look up or down'))
    for a, b in _windows([d['why'] == 'head turned' for d in decided], fps):
        picks.append(((a + b) // 2, 'head turned'))
    order = np.argsort(-np.asarray(moved)) if len(moved) else []
    top = 0
    for i in order:
        if moved[i] <= 0 or top >= 6:
            break
        picks.append((int(i), 'moved most'))
        top += 1
    picks.sort()
    out: list[tuple[int, str]] = []
    for i, why in picks:
        if out and i - out[-1][0] < MIN_GAP_S * fps:
            if why not in out[-1][1]:
                out[-1] = (out[-1][0], out[-1][1] + '; ' + why)
            continue
        if 0 <= i < n and readings[i].get('face'):
            out.append((i, why))
    return out


def _eye_box(r: dict, pad: float = 0.35):
    pts = [p for s in ('L', 'R') for p in r['contour'][s]]
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    w = max(xs) - min(xs)
    return int(min(xs) - pad * w * 0.5), int(min(ys) - pad * w), int(max(xs) + pad * w * 0.5), int(max(ys) + pad * w)


def _face_box(r: dict):
    x0, y0, x1, y1 = _eye_box(r, 0.0)
    w = x1 - x0
    return int(x0 - 0.45 * w), int(y0 - 0.55 * w), int(x1 + 0.45 * w), int(y1 + 1.1 * w)


def _crop(img, box, scale: float):
    import cv2  # noqa: PLC0415
    h, w = img.shape[:2]
    x0, y0, x1, y1 = max(0, box[0]), max(0, box[1]), min(w, box[2]), min(h, box[3])
    return cv2.resize(img[y0:y1, x0:x1], None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA)


def _panel(img, r, label: str):
    import cv2  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415
    eyes = _crop(img, _eye_box(r), ZOOM)
    face = _crop(img, _face_box(r), 1.0)
    fh = eyes.shape[0]
    face = cv2.resize(face, (int(face.shape[1] * fh / face.shape[0]), fh), interpolation=cv2.INTER_AREA)
    row = np.concatenate([eyes, np.full((fh, 6, 3), 255, np.uint8), face], axis=1)
    band = np.full((34, row.shape[1], 3), 24, np.uint8)
    cv2.putText(band, label, (10, 25), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)
    return np.concatenate([band, row], axis=0)


def _lab_disc(img, cx, cy, rad):
    import cv2  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415
    h, w = img.shape[:2]
    r = max(2, int(math.ceil(rad)))
    x0, y0, x1, y1 = max(0, int(cx) - r), max(0, int(cy) - r), min(w, int(cx) + r + 1), min(h, int(cy) + r + 1)
    crop = img[y0:y1, x0:x1]
    ys, xs = np.mgrid[y0:y1, x0:x1]
    disc = np.hypot(xs + 0.5 - cx, ys + 0.5 - cy) < 0.7 * rad
    lab = cv2.cvtColor(crop, cv2.COLOR_BGR2LAB).astype(np.float32)
    lab[..., 0] *= 100 / 255
    lab[..., 1:] -= 128
    grey = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY).astype(np.float32)
    return lab[disc], grey[disc]


def _opening(r: dict, side: str) -> float:
    c = r['contour'][side]
    ew = math.hypot(c[8][0] - c[0][0], c[8][1] - c[0][1]) or 1e-6
    return math.hypot(c[12][0] - c[4][0], c[12][1] - c[4][1]) / ew


def measure(take: Path, corrected: Path, info: dict, before: list[dict], after: list[dict]):
    """Per frame: how much the eyes changed (for choosing frames), and per changed frame and eye, the numbers."""
    import numpy as np  # noqa: PLC0415
    moved, rows = [], []
    for i, (a, b) in enumerate(zip(eyeline.frames(take, info['width'], info['height']),
                                   eyeline.frames(corrected, info['width'], info['height']))):
        rb, ra = before[i] if i < len(before) else {}, after[i] if i < len(after) else {}
        if not rb.get('face'):
            moved.append(0.0)
            continue
        x0, y0, x1, y1 = _eye_box(rb, 0.1)
        x0, y0 = max(0, x0), max(0, y0)
        diff = float(np.abs(a[y0:y1, x0:x1].astype(np.int16) - b[y0:y1, x0:x1].astype(np.int16)).mean())
        moved.append(diff)
        if diff < 0.05 or not ra.get('face'):
            continue
        row = {'frame': i}
        for s in ('L', 'R'):
            lb, gb = _lab_disc(a, *rb['iris'][s], rb['iris_r'][s])
            la, ga = _lab_disc(b, *ra['iris'][s], ra['iris_r'][s])
            if len(lb) < 6 or len(la) < 6:
                continue
            row[s] = {'delta_e': round(float(np.linalg.norm(np.median(la, 0) - np.median(lb, 0))), 2),
                      'catchlight': round(float((np.percentile(ga, 98) - np.median(ga)) / max(1.0, np.percentile(gb, 98) - np.median(gb))), 3),
                      'opening': round(_opening(ra, s) / max(1e-6, _opening(rb, s)), 3)}
        if 'L' in row and 'R' in row:
            pair_b = _opening(rb, 'L') / max(1e-6, _opening(rb, 'R'))
            pair_a = _opening(ra, 'L') / max(1e-6, _opening(ra, 'R'))
            row['pair'] = round(pair_a / max(1e-6, pair_b), 3)
        rows.append(row)
    return moved, rows


def summary(rows: list[dict], before: list[dict], after: list[dict], fps: float) -> dict:
    import numpy as np  # noqa: PLC0415
    from .qc_eyeline import _events  # noqa: PLC0415
    vals = lambda key: [r[s][key] for r in rows for s in ('L', 'R') if s in r]  # noqa: E731
    out = {'changed_frames': len(rows)}
    for key in ('delta_e', 'catchlight', 'opening'):
        v = vals(key)
        if v:
            out[key] = {'median': round(float(np.median(v)), 3), 'p10': round(float(np.percentile(v, 10)), 3),
                        'p90': round(float(np.percentile(v, 90)), 3), 'worst': round(float(max(v) if key == 'delta_e' else min(v, key=lambda x: -abs(math.log(max(x, 1e-6))))), 3)}
    pair = [r['pair'] for r in rows if 'pair' in r]
    if pair:
        out['pair'] = {'p10': round(float(np.percentile(pair, 10)), 3), 'p90': round(float(np.percentile(pair, 90)), 3)}
    for name, rd in (('before', before), ('after', after)):
        dec = eyeline.plan(rd)
        off = [max(max(abs(a) for a in e['off']) for e in d['eyes'].values()) for d in dec if d['eyes']]
        out[name] = {'blinks': _events(rd, lambda r: r.get('blink', 0) >= eyeline.BLINK),
                     'off_lens_s': round(sum(1 for x in off if x > eyeline.ON_LENS_DEG) / fps, 2),
                     'off_lens_mean_deg': round(float(np.mean([x for x in off if x > eyeline.ON_LENS_DEG] or [0])), 2)}
    return out


def sheets(take: Path, corrected: Path, info: dict, before: list[dict], moments: list[tuple[int, str]], out: Path,
           seed: int) -> tuple[list[Path], dict]:
    import cv2  # noqa: PLC0415
    import numpy as np  # noqa: PLC0415
    num, den = (int(x) for x in info['rate'].split('/'))
    fps = num / den
    want = {i for i, _ in moments}
    got = {}
    for i, (a, b) in enumerate(zip(eyeline.frames(take, info['width'], info['height']),
                                   eyeline.frames(corrected, info['width'], info['height']))):
        if i in want:
            got[i] = (a.copy(), b.copy())
    rng = random.Random(seed)
    key, blocks = {}, []
    for k, (i, why) in enumerate(moments, 1):
        a, b = got[i]
        flip = rng.random() < 0.5
        x, y = (b, a) if flip else (a, b)
        key[str(k)] = {'time_s': round(i / fps, 2), 'frame': i, 'flagged_for': why, 'X': 'corrected' if flip else 'as filmed',
                       'Y': 'as filmed' if flip else 'corrected'}
        px, py = _panel(x, before[i], f'{k}  {i / fps:.2f} s   X'), _panel(y, before[i], f'{k}  {i / fps:.2f} s   Y')
        w = max(px.shape[1], py.shape[1])
        pad = lambda p: np.pad(p, ((0, 0), (0, w - p.shape[1]), (0, 0)), constant_values=255)  # noqa: E731
        blocks.append(np.concatenate([pad(px), np.full((4, w, 3), 255, np.uint8), pad(py), np.full((18, w, 3), 255, np.uint8)], 0))
    groups, cur = [], []
    for b in blocks:
        if cur and sum(x.shape[0] for x in cur) + b.shape[0] > MAX_SHEET_H:
            groups.append(cur)
            cur = []
        cur.append(b)
    if cur:
        groups.append(cur)
    paths = []
    for g, part in enumerate(groups, 1):
        w = max(p.shape[1] for p in part)
        sheet = np.concatenate([np.pad(p, ((0, 0), (0, w - p.shape[1]), (0, 0)), constant_values=255) for p in part], 0)
        path = out / f'sheet.{take.stem}.{g:03d}.jpg'
        cv2.imwrite(str(path), sheet, [cv2.IMWRITE_JPEG_QUALITY, 95])
        paths.append(path)
    return paths, key


def lens_offsets(before: list[dict], after: list[dict], there: list[dict], fps: float) -> dict:
    """How far his eyes sit from the lens, before and after, in degrees: the lens point per eye is where Maxine puts
    the iris (its median over the take, along and across the eye, in eye widths: the same calibration eyeline.aims
    uses), and each frame's distance from it is read on the take and on the corrected file. Frames with a blink or no
    face are left out."""
    import numpy as np  # noqa: PLC0415
    lens = {}
    for s in eyeline.IRIS:
        pos = [_eye_pos(t, s) for t in there if t.get('face')]
        lens[s] = np.median(np.array(pos), 0) if pos else None
    out = {}
    for name, rows in (('before', before), ('after', after)):
        deg = []
        for r in rows:
            if not r.get('face') or r.get('blink', 0) >= eyeline.BLINK or any(lens[s] is None for s in lens):
                continue
            far = max(float(np.hypot(*(_eye_pos(r, s) - lens[s]))) for s in eyeline.IRIS)
            deg.append(math.degrees(math.asin(min(1.0, far / eyeline.EYEBALL))))
        deg = np.array(deg)
        out[name] = {'median_deg': round(float(np.median(deg)), 2), 'p90_deg': round(float(np.percentile(deg, 90)), 2),
                     'within_3deg': round(float((deg <= 3).mean()), 3), 'within_5deg': round(float((deg <= 5).mean()), 3)}
    return out


def _eye_pos(r: dict, side: str):
    import numpy as np  # noqa: PLC0415
    c, u, v, w = eyeline._eye_axes(r['eyes'][side])  # noqa: SLF001
    d = np.asarray(r['iris'][side]) - c
    return np.array((d @ u / w, d @ v / w))


def review(take, corrected, out, cache=None, seed: int = 11, copy=None) -> dict:
    take, corrected, out = Path(take), Path(corrected), Path(out)
    out.mkdir(parents=True, exist_ok=True)
    info = eyeline.probe(take)
    num, den = (int(x) for x in info['rate'].split('/'))
    fps = num / den
    before = cached_read(take, info, Path(cache) if cache else None)
    after = cached_read(corrected, info, Path(cache) if cache else None)
    moved, rows = measure(take, corrected, info, before, after)
    moments = flagged(before, fps, moved)
    paths, key = sheets(take, corrected, info, before, moments, out, seed)
    numbers = {'take': take.name, 'corrected': corrected.name, 'summary': summary(rows, before, after, fps), 'frames': rows}
    if copy is not None:
        numbers['summary']['lens'] = lens_offsets(before, after, cached_read(Path(copy), info, Path(cache) if cache else None), fps)
    (out / f'key.{take.stem}.json').write_text(json.dumps(key, indent=1))
    (out / f'numbers.{take.stem}.json').write_text(json.dumps(numbers, indent=1))
    return {'sheets': [str(p) for p in paths], 'moments': len(moments), 'summary': numbers['summary']}


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    p.add_argument('take')
    p.add_argument('corrected')
    p.add_argument('--out', required=True)
    p.add_argument('--readings', help='folder to keep the take\'s landmarker readings in')
    p.add_argument('--seed', type=int, default=11)
    p.add_argument('--copy', help='the Maxine copy: also report each eye\'s distance from its lens point, before and after')
    a = p.parse_args(argv)
    print(json.dumps(review(a.take, a.corrected, a.out, a.readings, a.seed, a.copy), indent=1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
