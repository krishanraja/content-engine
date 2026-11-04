"""picture.as_shot: his face and room look as they were shot (advisory).

The floor, approved 4 Nov 2026: "Never apply an untested darkened-and-softened treatment to the background of his room"
(his words: "I look like I am in some sort of green fire"). ghost-editor checks the same thing on every reel (`as_shot`:
the speaker's plate within |L| 5, |b| 4, |a| 4 of the footage as shot). This compares, on beats whose plate is his
take, the lower quarter of the frame (his body and the room) in the cut with the rows of the conformed take that the
cut shows there, as median CIE L*a*b*. On a SPLIT beat the renderer draws his take into the box under the seam, cropped
at the beat's position (FormatMaster: objectFit cover, objectPosition), so those are not the take's own lower quarter.
A treatment shows as a shift.

Advisory: listed in QC, never counted (no rule makes it a gate; F14). It names the beats that moved.
"""
from __future__ import annotations

import subprocess

from .common import ffmpeg

TOLERANCE = {'L': 5.0, 'a': 4.0, 'b': 4.0}
PER_BEAT = 3
WIDTH = 120
FRAME = (1080, 1920)          # a 9:16 cut, the only aspect SPLIT draws (layouts/index.ts)
SEAM_Y = 760                  # FWP_SPLIT_SEAM_Y: his take sits in the box below it on a SPLIT beat
DEFAULT_CROP = '50% 88%'      # FWP_POSTER_POSITIONS.proof, what splitPlatePosition falls back to
KEYWORDS = {'left': 0.0, 'top': 0.0, 'center': 0.5, 'right': 1.0, 'bottom': 1.0}


def _lab(rgb, keep=None):
    """Median L*, a*, b* of an RGB array (sRGB, D65), over the pixels `keep` marks when given."""
    import numpy as np  # noqa: PLC0415
    c = (rgb[keep] if keep is not None else rgb.reshape(-1, 3)).astype(np.float64) / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    xyz = c @ np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]]).T
    xyz /= np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    lab = np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], axis=1)
    return [float(v) for v in np.median(lab, axis=0)]


def _frame(video: str, at_s: float):
    import numpy as np  # noqa: PLC0415
    raw = subprocess.run([ffmpeg(), '-v', 'error', '-ss', f'{at_s:.3f}', '-i', str(video), '-frames:v', '1',
                          '-vf', f'scale={WIDTH}:-2', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    height = len(raw) // (WIDTH * 3)
    if height == 0:
        return None   # past the end of the file: no sample
    return np.frombuffer(raw[:height * WIDTH * 3], np.uint8).reshape(height, WIDTH, 3)


def lower_quarter(frame):
    return frame[int(frame.shape[0] * 0.75):, :, :]


def _offset(token: str, free: float) -> float:
    if token.endswith('%'):
        return float(token[:-1]) / 100 * free
    if token.endswith('px'):
        return float(token[:-2])
    return KEYWORDS.get(token, 0.0 if token == '0' else 0.5) * free


def _position(crop: str | None) -> tuple[str, str]:
    tokens = (crop or DEFAULT_CROP).split()
    if not 1 <= len(tokens) <= 2:
        tokens = DEFAULT_CROP.split()
    if len(tokens) == 1:
        return (tokens[0], 'center') if tokens[0] not in ('top', 'bottom') else ('center', tokens[0])
    return (tokens[1], tokens[0]) if tokens[0] in ('top', 'bottom') else (tokens[0], tokens[1])


def shown_rows(beat: dict, take_w: float, take_h: float) -> tuple[float, float, float, float]:
    """The part of his take (left, top, right, bottom, in take pixels) that the cut's lower quarter shows."""
    width, height = FRAME
    if beat.get('layout') != 'SPLIT':
        return 0.0, take_h * 0.75, take_w, take_h
    box_w, box_h = width, height - SEAM_Y
    scale = max(box_w / take_w, box_h / take_h)
    x_token, y_token = _position((beat.get('plate') or {}).get('crop'))
    x0, y0 = _offset(x_token, take_w * scale - box_w), _offset(y_token, take_h * scale - box_h)
    top_in_box = height * 0.75 - SEAM_Y
    return x0 / scale, (top_in_box + y0) / scale, (x0 + box_w) / scale, (box_h + y0) / scale


def take_part(frame, beat: dict):
    """Those rows of a decoded take frame (any decoded size; the take's own aspect)."""
    rows, cols = frame.shape[0], frame.shape[1]
    take_w, take_h = float(FRAME[0]), FRAME[0] * rows / cols
    left, top, right, bottom = shown_rows(beat, take_w, take_h)
    k = cols / take_w
    return frame[max(0, int(top * k)):min(rows, int(round(bottom * k))), max(0, int(left * k)):min(cols, int(round(right * k))), :]


def uncaptioned(part, frame_h: int, frame: int, pages: list[dict] | None):
    """Which pixels of the cut's lower quarter no caption page covers at this frame (a caption is drawn over his room,
    it is not a treatment of it). Page regions are (left, top, width, height) in frame pixels (qc.inputs_from_props)."""
    import numpy as np  # noqa: PLC0415
    keep = np.ones(part.shape[:2], dtype=bool)
    k = part.shape[1] / FRAME[0]
    quarter_top = frame_h - part.shape[0]
    for page in pages or []:
        region = page.get('region')
        if not region or not page.get('fromFrame', 0) <= frame < page.get('toFrame', 0):
            continue
        left, top, width, height = region
        r0, r1 = int(top * k) - quarter_top, int(round((top + height) * k)) - quarter_top
        keep[max(0, r0):max(0, r1), max(0, int(left * k)):max(0, int(round((left + width) * k)))] = False
    return keep


def as_shot(cut: str, plate: str, beats: list[dict], fps: int = 30, plate_offset_frames: int = 0,
            pages: list[dict] | None = None) -> dict:
    """The advisory row: per take beat, the largest L*, a*, b* shift of the lower quarter against the conformed take,
    leaving out what a caption page covers."""
    rows, moved = {}, []
    for beat in beats:
        if ((beat.get('plate') or {}).get('source') or 'take') != 'take' or beat.get('layout') == 'STAGE':
            continue
        span = int(beat['toFrame']) - int(beat['fromFrame'])
        if span <= 0:
            continue
        worst = {'L': 0.0, 'a': 0.0, 'b': 0.0}
        for k in range(PER_BEAT):
            frame = int(beat['fromFrame']) + int(span * (k + 1) / (PER_BEAT + 1))
            seen, shot = _frame(cut, frame / fps), _frame(plate, (frame + plate_offset_frames) / fps)
            if seen is None or shot is None:
                continue
            ours, theirs = lower_quarter(seen), take_part(shot, beat)
            h, w = min(ours.shape[0], theirs.shape[0]), min(ours.shape[1], theirs.shape[1])
            ours, theirs = ours[:h, :w], theirs[:h, :w]
            keep = uncaptioned(ours, seen.shape[0], frame, pages)
            if keep.mean() < 0.25:
                continue   # captions cover most of the quarter: too little of his room to read
            cut_lab, take_lab = _lab(ours, keep), _lab(theirs, keep)
            for axis, a, b in zip('Lab', cut_lab, take_lab):
                worst[axis] = max(worst[axis], round(abs(a - b), 2))
        rows[beat['id']] = worst
        if any(worst[axis] > TOLERANCE[axis] for axis in worst):
            moved.append(beat['id'])
    return {'value': rows, 'moved': moved, 'target': f'his take as shot: the lower quarter within L {TOLERANCE["L"]}, '
            f'a {TOLERANCE["a"]}, b {TOLERANCE["b"]} of the rows of the conformed take it shows (median L*a*b*)',
            'pass': None, 'status': 'advisory'}
