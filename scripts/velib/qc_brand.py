"""Greyscale normalised cross-correlation of the mandatory mark at beat midpoints."""
from __future__ import annotations

import re
import subprocess

import numpy as np

from .common import ffmpeg
from .qc import frame_span, gray_frames, measurement, pixel_box


def _ncc(image: np.ndarray, template: np.ndarray) -> float:
    """Search a box without materialising every 2D window into a huge array."""
    h, w = template.shape
    if h > image.shape[0] or w > image.shape[1]:
        return 0.0
    centered = template.astype(np.float64)
    centered -= centered.mean()
    energy = float(np.sum(centered * centered))
    if energy < 1e-10:
        raise ValueError('Mark template has no contrast')
    best = -1.0
    for y in range(image.shape[0] - h + 1):
        windows = np.lib.stride_tricks.sliding_window_view(image[y:y + h], (h, w))[0].astype(np.float64)
        sums = windows.sum(axis=(1, 2))
        variance = np.maximum(0, np.sum(windows * windows, axis=(1, 2)) - sums * sums / (h * w))
        numerator = np.einsum('ijk,jk->i', windows, centered)
        scores = np.divide(numerator, np.sqrt(variance * energy),
                           out=np.zeros_like(numerator), where=variance > 1e-10)
        best = max(best, float(scores.max()))
    return min(1.0, max(-1.0, best))


def mark_tile(render, mark_png, beats, aspect) -> dict:
    """Aspect is 9:16/16:9, or resolved {mark_box, mark_width} in render pixels.

    String aspects use house geometry scaled to the encoded dimensions. A resolved
    box lets the compiler pass the exact approved placement without a new QC path.
    The template is fit, preserving its aspect ratio, to the mark's image width.
    """
    if isinstance(aspect, dict):
        box = pixel_box(aspect['mark_box'])
        width = int(aspect.get('mark_width', box[2]))
    else:
        if aspect not in ('9:16', '16:9'):
            raise ValueError('Unknown aspect')
        info = subprocess.run([ffmpeg(), '-hide_banner', '-i', str(render)], capture_output=True,
                              text=True, errors='replace').stderr
        dimensions = re.search(r'Video:.*?\b(\d{2,5})x(\d{2,5})\b', info)
        if not dimensions:
            raise ValueError('Cannot read render dimensions')
        video_w, video_h = map(int, dimensions.groups())
        scale = min(video_w / (1080 if aspect == '9:16' else 1920),
                    video_h / (1920 if aspect == '9:16' else 1080))
        box = tuple(round(v * scale) for v in (72, 150 if aspect == '9:16' else 54, 136, 136))
        width = max(1, round(96 * scale))
    _, _, box_w, box_h = box
    if width <= 0 or width > box_w:
        raise ValueError('Invalid mark image width')
    # PGM carries dimensions, so no image library or ffprobe dependency is needed.
    result = subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-i', str(mark_png), '-vf',
                             f'scale={width}:-1,format=gray', '-frames:v', '1', '-f', 'image2pipe',
                             '-vcodec', 'pgm', '-'], capture_output=True, check=True)
    header = re.match(rb'P5\s+(\d+)\s+(\d+)\s+255\s', result.stdout)
    if not header:
        raise ValueError('Cannot decode mark template')
    tw, th = map(int, header.groups())
    template = np.frombuffer(result.stdout[header.end():], np.uint8).reshape(th, tw)
    if th > box_h:
        raise ValueError('Mark template is taller than its box')
    rows = []
    for index, beat in enumerate(beats):
        first, last = frame_span(beat)
        frame = (first + last - 1) // 2
        score = _ncc(gray_frames(render, frame, frame, box)[0], template)
        rows.append({'beat': beat.get('id', index), 'frame': frame, 'score': score, 'pass': score >= 0.8})
    return measurement(rows, 'mark NCC >= 0.8 at every beat midpoint')
