"""Evidence for the eye gaze pass (velib/eyeline.py), for the Critic and for Krish's eye. It proves nothing by itself
(config/failures.json cut-called-done-unheard): a separate reviewer and Krish watch the eyes at full size.

  strips.<stem>.jpg     before | after at 100%, both eyes, at the most corrected moments, at blinks, at head turns
                        and at ten even points, each row labelled with its time, strength and why
  loop.<stem>.mp4       before | after of the eyes for the whole take at half speed, to see flicker
  numbers              eye_flicker_ratio: frame-to-frame change inside the eyes after over before (1.0 is no added
                        flicker); seam_ratio: edge strength on the mask's feathered band after over before (1.0 is
                        no visible seam); blinks and off-lens time before and after, the corrected file read
                        again at full rate by the pinned landmarker, never taken from the pass's own plan.

The proposed limits (FLICKER_MAX, SEAM_MAX) are uncalibrated: they say where to look, not that it passed.
"""
from __future__ import annotations

import subprocess
from pathlib import Path

from .common import ffmpeg

FLICKER_MAX = 1.10
SEAM_MAX = 1.10
EVEN_SAMPLES = 10
TOP_SAMPLES = 6
LOOP_EYE_W = 360


class QC:
    def __init__(self):
        self.samples, self.rows = {}, []
        self.prev = None
        self.diff_before, self.diff_after, self.seam_before, self.seam_after = [], [], [], []
        self.loop = None

    # ---------------------------------------------------------------- choosing frames
    def start(self, decided: list[dict], info: dict, loop_path: Path | None = None):
        import numpy as np  # noqa: PLC0415
        self.decided, self.info = decided, info
        num, den = (int(x) for x in info['rate'].split('/'))
        self.fps = num / den
        n = len(decided)
        strength = np.array([d['strength'] for d in decided])
        pick = {}
        gap = int(self.fps)                          # at least a second between the most corrected samples
        for i in np.argsort(-strength):
            if strength[i] <= 0 or sum(1 for k, v in pick.items() if v == 'most corrected') >= TOP_SAMPLES:
                break
            if all(abs(int(i) - k) >= gap for k in pick):
                pick[int(i)] = 'most corrected'
        for why, limit in (('blink', 3), ('head turned', 2)):
            found = [i for i, d in enumerate(decided) if d['why'] == why]
            starts = [i for k, i in enumerate(found) if k == 0 or found[k - 1] != i - 1][:limit]
            for i in starts:
                pick.setdefault(i, why)
        for k in range(EVEN_SAMPLES):
            pick.setdefault(int(round((k + 0.5) * n / EVEN_SAMPLES)), 'even')
        self.pick = pick
        boxes = [self._pair_box(d) for d in decided if d['eyes']]
        if boxes and loop_path is not None:
            w = int(np.median([b[2] - b[0] for b in boxes]))
            h = int(np.median([b[3] - b[1] for b in boxes]))
            self.loop_size = (w, h)
            scale = LOOP_EYE_W / max(1, w)
            self.loop_out = (int(round(w * scale / 2)) * 2, int(round(h * scale / 2)) * 2)
            self.loop = subprocess.Popen(
                [ffmpeg(), '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
                 '-s', f'{self.loop_out[0] * 2}x{self.loop_out[1]}', '-framerate', info['rate'], '-i', '-',
                 '-vf', 'setpts=2*PTS', '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', str(loop_path)],
                stdin=subprocess.PIPE)
            self.loop_path = loop_path

    @staticmethod
    def _pair_box(d):
        pts = [p for e in d['eyes'].values() for p in e['points']]
        xs, ys = [p[0] for p in pts], [p[1] for p in pts]
        width = max(xs) - min(xs)
        pad_x, pad_y = 0.25 * width, 0.35 * width
        return [int(min(xs) - pad_x), int(min(ys) - pad_y), int(max(xs) + pad_x), int(max(ys) + pad_y)]

    # ---------------------------------------------------------------- each frame
    def frame(self, index: int, before, after, d: dict):
        import cv2  # noqa: PLC0415
        import numpy as np  # noqa: PLC0415
        from . import eyeline  # noqa: PLC0415
        if d['eyes']:
            grey_b, grey_a = [], []
            for side, eye in sorted(d['eyes'].items()):
                geo = eyeline.eye_frame(eye['points'])
                if eyeline.bbox(geo, before.shape) is None:
                    continue
                pb, pa = eyeline.patch_of(before, geo), eyeline.patch_of(after, geo)
                gb, ga = cv2.cvtColor(pb, cv2.COLOR_BGR2GRAY).astype(np.float32), cv2.cvtColor(pa, cv2.COLOR_BGR2GRAY).astype(np.float32)
                grey_b.append(gb)
                grey_a.append(ga)
                if d['strength'] > 0:
                    ys, xs = np.mgrid[0:eyeline.PATCH_H, 0:eyeline.PATCH_W] + 0.5
                    m = eyeline.mask_of(xs, ys)
                    band = (m > 0.05) & (m < 0.95)
                    edge = lambda g: np.hypot(cv2.Sobel(g, cv2.CV_32F, 1, 0), cv2.Sobel(g, cv2.CV_32F, 0, 1))  # noqa: E731
                    self.seam_before.append(float(edge(gb)[band].mean()))
                    self.seam_after.append(float(edge(ga)[band].mean()))
            if self.prev is not None and self.prev[0] == index - 1 and len(self.prev[1]) == len(grey_b) and grey_b:
                self.diff_before.append(float(np.mean([np.abs(b - p).mean() for b, p in zip(grey_b, self.prev[1])])))
                self.diff_after.append(float(np.mean([np.abs(a - p).mean() for a, p in zip(grey_a, self.prev[2])])))
            self.prev = (index, grey_b, grey_a)
        else:
            self.prev = None
        if self.loop is not None:
            self.loop.stdin.write(self._loop_frame(before, after, d).tobytes())
        if index in self.pick and d['eyes']:
            x0, y0, x1, y1 = self._pair_box(d)
            h, w = before.shape[:2]
            x0, y0, x1, y1 = max(0, x0), max(0, y0), min(w, x1), min(h, y1)
            row = np.concatenate([before[y0:y1, x0:x1], np.full((y1 - y0, 6, 3), 255, np.uint8), after[y0:y1, x0:x1]], axis=1)
            label = f"{index / self.fps:6.2f} s  strength {d['strength']:.2f}  {d['why'] or 'corrected'}  ({self.pick[index]})"
            band = np.full((28, row.shape[1], 3), 24, np.uint8)
            cv2.putText(band, label, (8, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
            self.rows.append((index, np.concatenate([band, row], axis=0)))

    def _loop_frame(self, before, after, d):
        import cv2  # noqa: PLC0415
        import numpy as np  # noqa: PLC0415
        w, h = self.loop_size
        if d['eyes']:
            x0, y0, x1, y1 = self._pair_box(d)
            cx, cy = (x0 + x1) // 2, (y0 + y1) // 2
            self.loop_centre = (cx, cy)
        cx, cy = getattr(self, 'loop_centre', (before.shape[1] // 2, before.shape[0] // 3))
        x0 = int(min(max(0, cx - w // 2), before.shape[1] - w))
        y0 = int(min(max(0, cy - h // 2), before.shape[0] - h))
        pair = [cv2.resize(img[y0:y0 + h, x0:x0 + w], self.loop_out, interpolation=cv2.INTER_AREA) for img in (before, after)]
        return np.ascontiguousarray(np.concatenate(pair, axis=1))

    # ---------------------------------------------------------------- after the take
    def finish(self, out_dir: Path, stem: str, before: list[dict] | None = None, after: Path | None = None) -> dict:
        import cv2  # noqa: PLC0415
        import numpy as np  # noqa: PLC0415
        if self.loop is not None:
            self.loop.stdin.close()
            self.loop.wait()
        out = {'samples': len(self.rows)}
        if self.rows:
            width = max(r.shape[1] for _, r in self.rows)
            sheet = np.concatenate([np.pad(r, ((0, 4), (0, width - r.shape[1]), (0, 0)), constant_values=255)
                                    for _, r in sorted(self.rows, key=lambda x: x[0])], axis=0)
            path = Path(out_dir) / f'strips.{stem}.jpg'
            cv2.imwrite(str(path), sheet, [cv2.IMWRITE_JPEG_QUALITY, 94])
            out['strips'] = str(path)
        if self.loop is not None:
            out['loop'] = str(self.loop_path)
        if self.diff_before:
            out['eye_flicker_ratio'] = round(float(np.mean(self.diff_after) / max(1e-6, np.mean(self.diff_before))), 3)
        if self.seam_before:
            out['seam_ratio'] = round(float(np.mean(self.seam_after) / max(1e-6, np.mean(self.seam_before))), 3)
        out['limits'] = {'eye_flicker_ratio': FLICKER_MAX, 'seam_ratio': SEAM_MAX, 'calibrated': False}
        out['look_here'] = [k for k, limit in (('eye_flicker_ratio', FLICKER_MAX), ('seam_ratio', SEAM_MAX))
                            if out.get(k, 0) > limit]
        if before is not None and after is not None and Path(after).is_file():
            out['faces'] = read_back(before, after, self.info)
        return out


def _events(readings: list[dict], test) -> int:
    count, inside = 0, False
    for r in readings:
        on = bool(r.get('face')) and test(r)
        if on and not inside:
            count += 1
        inside = on
    return count


def read_back(before_readings: list[dict], after, info: dict) -> dict:
    """Blinks and off-lens time before and after, from a fresh full-rate reading of the corrected file by the same
    pinned landmarker: the pass is judged by a reading of its output, not by its own plan. (`ve faces` samples every
    0.2 s and keeps windows of 0.4 s or more, which misses a blink.)"""
    from . import eyeline  # noqa: PLC0415
    after_readings = eyeline.read(after, info)
    num, den = (int(x) for x in info['rate'].split('/'))
    fps = num / den
    out = {}
    for name, readings in (('before', before_readings), ('after', after_readings)):
        decided = eyeline.plan(readings)
        off = sum(1 for d in decided if d['eyes'] and max(max(abs(a) for a in e['off']) for e in d['eyes'].values())
                  > eyeline.ON_LENS_DEG)
        out[name] = {'blinks': _events(readings, lambda r: r.get('blink', 0) >= eyeline.BLINK),
                     'off_lens_s': round(off / fps, 2), 'face_frames': sum(1 for r in readings if r.get('face'))}
    out['blinks_match'] = out['before']['blinks'] == out['after']['blinks']
    return out
