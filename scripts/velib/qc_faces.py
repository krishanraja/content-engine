"""captions.off_face: no caption page may sit on his face.

Krish, 2026-11-03: "The subtitles just go straight over my face." For every caption page the renderer draws, the
check reads the frame the OCR check reads, finds the face in it, and fails the page when the caption's box overlaps
the face box. The caption box comes from the renderer's own geometry (WordCaption.tsx for the word build, the
region QC already holds for house and SPLIT pages), never a copy. A beat with no face (a graphics beat) passes.

The detector is OpenCV's frontal face cascade, the one the quick-edit sync check uses, or mediapipe when that is
the Python's detector; the check reports not_run (never pass) on a machine that has neither.
"""
from __future__ import annotations

import re
import subprocess

import numpy as np

from .common import ROOT, ffmpeg

MARGIN = 0.10  # the face box grows by this share each side: hair, chin and a moving head stay clear too
CHAR_WIDTH = 0.62  # an Archivo bold glyph is about this share of the font size wide


def word_geometry(aspect: str) -> dict:
    source = (ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'chrome' / 'WordCaption.tsx').read_text(encoding='utf-8')
    row = re.search(r'\b' + ('tall' if aspect == '9:16' else 'wide') + r': \{([^}]*)\}', source).group(1)
    return {key: int(value) for key, value in re.findall(r'(\w+): (\d+)', row)}


def page_text(page: dict) -> str:
    return ' '.join(str(w.get('text') or w.get('word') or '') for w in page.get('words', [])).strip()


def caption_box(page: dict, style: str, aspect: str, region) -> tuple[int, int, int, int]:
    """x, y, w, h of the caption as drawn."""
    if style == 'word':
        g = word_geometry(aspect)
        width = min(g['width'], max(g['size'], int(len(page_text(page)) * g['size'] * CHAR_WIDTH)))
        return (g['width'] - width) // 2, int(g['centerY'] - g['size'] * 0.6), width, int(g['size'] * 1.2)
    box = page.get('region') or region
    if isinstance(box, dict):
        box = [box[k] for k in ('x', 'y', 'width', 'height')] if 'x' in box else [box[k] for k in ('left', 'top', 'width', 'height')]
    return tuple(int(v) for v in box)


def overlap(a, b) -> int:
    ax, ay, aw, ah = a
    bx, by, bw, bh = b
    return max(0, min(ax + aw, bx + bw) - max(ax, bx)) * max(0, min(ay + ah, by + bh) - max(ay, by))


def grown(face, margin=MARGIN):
    x, y, w, h = face
    return int(x - w * margin), int(y - h * margin), int(w * (1 + 2 * margin)), int(h * (1 + 2 * margin))


def sampled_frame(page: dict) -> int:
    first, last = page['fromFrame'], page['toFrame']
    revealed = max(first, max((int(w['atFrame']) for w in page.get('words', [])), default=first) + 2)
    return (revealed + last - 1) // 2


def frame_at(video: str, frame: int, fps: float, size: tuple[int, int]) -> np.ndarray:
    w, h = size
    raw = subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-ss', f'{frame / fps:.3f}', '-i', video,
                          '-frames:v', '1', '-vf', f'scale={w}:{h}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(h, w, 3)


def default_detector():
    """A function rgb -> [x, y, w, h] faces, or None when this Python has no face detector."""
    try:
        import cv2  # noqa: PLC0415
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')

        def detect(rgb):
            gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
            found = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=6, minSize=(gray.shape[1] // 10,) * 2)
            return [tuple(int(v) for v in f) for f in found]
        return detect
    except (ImportError, AttributeError):  # OpenCV 5 moved the cascade out of the main package
        pass
    try:
        import mediapipe as mp  # noqa: PLC0415
        model = mp.solutions.face_detection.FaceDetection(model_selection=1, min_detection_confidence=0.5)

        def detect(rgb):
            h, w = rgb.shape[:2]
            result = model.process(rgb)
            boxes = []
            for d in result.detections or []:
                b = d.location_data.relative_bounding_box
                boxes.append((int(b.xmin * w), int(b.ymin * h), int(b.width * w), int(b.height * h)))
            return boxes
        return detect
    except (ImportError, AttributeError):
        return None


def off_face(video: str, pages: list, *, style: str = 'house', aspect: str = '9:16', region=None,
             fps: float = 30, detector=None, grab=None) -> dict:
    detector = detector or default_detector()
    target = 'no caption page overlaps the face box (+10%)'
    if detector is None:
        return {'value': None, 'target': target, 'pass': None, 'status': 'not_run',
                'reason': 'no face detector in this Python (opencv-python or mediapipe)'}
    size = (1080, 1920) if aspect == '9:16' else (1920, 1080)
    grab = grab or (lambda frame: frame_at(video, frame, fps, size))
    on_face = []
    for page in pages:
        frame = sampled_frame(page)
        box = caption_box(page, style, aspect, region)
        faces = detector(grab(frame))
        hits = [f for f in faces if overlap(box, grown(f))]
        if hits:
            on_face.append({'at_s': round(frame / fps, 2), 'text': page_text(page)[:40], 'caption': list(box),
                            'face': list(hits[0])})
    return {'value': {'pages': len(pages), 'on_face': on_face[:12], 'count': len(on_face)}, 'target': target,
            'pass': not on_face}
