"""captions.off_face: no caption page may sit on his face.

Krish, 2026-11-03: "The subtitles just go straight over my face." For every caption page the renderer draws, the
check reads the frame the OCR check reads, finds the face in it, and fails the page when the caption's box overlaps
the face box. The caption box comes from the renderer's own geometry (WordCaption.tsx for the word build, the
region QC already holds for house and SPLIT pages), never a copy. When beats are supplied, only a take plate
is checked for faces; graphics pages count as checked without invoking the detector.

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


def word_geometry(aspect: str, layout: str | None = None, plate=None) -> dict:
    source = (ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'chrome' / 'WordCaption.tsx').read_text(encoding='utf-8')
    row = re.search(r'\b' + ('tall' if aspect == '9:16' else 'wide') + r': \{([^}]*)\}', source).group(1)
    seam_source = (ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'layouts' / 'splitGeometry.ts').read_text(encoding='utf-8')
    seam = re.search(r'export const SPLIT_SEAM_Y = (\d+)', seam_source).group(1)
    row = row.replace('SPLIT_SEAM_Y', seam)
    geometry = {}
    for key, expression in re.findall(r'(\w+): ([^,]+)', row):
        factors = expression.strip().split('*')
        geometry[key] = float(factors[0]) * (float(factors[1]) if len(factors) == 2 else 1)
    geometry['centerY'] = (geometry['splitCenterY'] if layout == 'SPLIT' else
                           geometry['graphicsCenterY'] if plate == 'none' else geometry['centerY'])
    return geometry


def page_text(page: dict) -> str:
    return ' '.join(str(w.get('text') or w.get('word') or '') for w in page.get('words', [])).strip()


def caption_box(page: dict, style: str, aspect: str, region, *, layout=None, plate=None) -> tuple[int, int, int, int]:
    """x, y, w, h of the caption as drawn."""
    if style == 'word':
        # qc.py already marks sampled SPLIT pages with their own region.
        if layout is None and page.get('region') is not None:
            source = (ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'layouts' / 'splitGeometry.ts').read_text(encoding='utf-8')
            zone = re.search(r'export const SPLIT_CAPTION_ZONE = \{([^}]*)\}', source).group(1)
            split_region = tuple(int(n) for n in re.findall(r': (\d+)', zone))
            region_box = page['region']
            if isinstance(region_box, dict):
                keys = ('x', 'y', 'width', 'height') if 'x' in region_box else ('left', 'top', 'width', 'height')
                region_box = [region_box[k] for k in keys]
            if tuple(region_box) == split_region:
                layout = 'SPLIT'
        g = word_geometry(aspect, layout or page.get('layout'), plate or page.get('plate'))
        width = min(g['width'], max(g['size'], int(len(page_text(page)) * g['size'] * CHAR_WIDTH)))
        return int((g['width'] - width) // 2), int(g['centerY'] - g['size'] * 0.6), width, int(g['size'] * 1.2)
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
             fps: float = 30, detector=None, grab=None, beats=None) -> dict:
    target = 'no caption page overlaps the face box (+10%)'
    eligible = [p for p in pages if beats is None or any(
        b['fromFrame'] <= sampled_frame(p) < b['toFrame'] and (b.get('plate') or {}).get('source') == 'take'
        for b in beats)]
    detector = (detector or default_detector()) if eligible else detector
    if eligible and detector is None:
        return {'value': None, 'target': target, 'pass': None, 'status': 'not_run',
                'reason': 'no face detector in this Python (opencv-python or mediapipe)'}
    size = (1080, 1920) if aspect == '9:16' else (1920, 1080)
    grab = grab or (lambda frame: frame_at(video, frame, fps, size))
    on_face = []
    for page in eligible:
        frame = sampled_frame(page)
        beat = next((b for b in (beats or []) if b['fromFrame'] <= frame < b['toFrame']), {})
        box = caption_box(page, style, aspect, region, layout=beat.get('layout'),
                          plate=(beat.get('plate') or {}).get('source'))
        faces = detector(grab(frame))
        # An art-directed page is measured row by row as drawn (qc.inputs_from_props drawn_rows), never by the zone's width.
        rows = page.get('drawn_rows') or [box]
        hits = [f for f in faces if any(overlap(tuple(r), grown(f)) for r in rows)]
        if hits:
            on_face.append({'at_s': round(frame / fps, 2), 'text': page_text(page)[:40], 'caption': list(box),
                            'face': list(hits[0])})
    return {'value': {'pages': len(pages), 'on_face': on_face[:12], 'count': len(on_face)}, 'target': target,
            'pass': not on_face}


# ---------------------------------------------------------------- his whole head inside the camera band
# Krish, 18 Nov 2026, of a proof video that cut the top of his head off under a squeezed picture: "'Don't cut the top of
# my head off' should not really need a reference image". It is a rule, measured: on a SPLIT take beat his face sits in
# the camera band below the seam, and the head from crown to chin must lie inside that band, never under the stage or
# off the bottom of the frame. A frontal face box starts near the brow, so the crown stands CROWN of its height above
# it and the chin CHIN of its height below its bottom edge (uncalibrated starting values, like the face flags).
CROWN = 0.35
CHIN = 0.08
HEAD_SAMPLES = (0.25, 0.5, 0.75)   # shares of a beat: a head that moves is caught where it moves


def crop_position(crop) -> float:
    """The vertical position, in percent, a beat's `plate.crop` puts on the take (splitPlatePosition's reading; the
    renderer's default when it names none). Only the `X% Y%` form is read; a keyword form falls back to the default."""
    from .qc_as_shot import DEFAULT_CROP  # noqa: PLC0415  (the one copy of the renderer's default, read from its file)
    for text in (crop, DEFAULT_CROP):
        found = re.fullmatch(r'\s*\S+\s+(-?\d+(?:\.\d+)?)%\s*', text or '')
        if found:
            return float(found.group(1))
    return 50.0


def fitting_position(samples: list, position: float, *, seam: int, height: int = 1920) -> str | None:
    """The `plate.crop` that puts every sampled head (crown, chin in the finished frame) inside the camera band, centred
    between the two edges, or None when no vertical position of a take that tall can hold them (a head bigger than the band).
    His take is as wide as the cut, so the take is `height` rows tall and shows `height - seam` of them: the overflow
    is `seam`, and a position p shifts the take up by p% of it."""
    overflow = seam
    low = max(seam - crown for crown, _ in samples)       # move the take down at least this far to clear the crown
    high = min(height - chin for _, chin in samples)      # and at most this far to keep the chin
    if low > high:
        return None
    shift = (low + high) / 2
    offset = position / 100 * overflow - shift
    if not 0 <= offset <= overflow:
        offset = min(max(offset, 0), overflow)
        moved = position / 100 * overflow - offset
        if not low <= moved <= high:
            return None
    return f'50% {round(offset / overflow * 100)}%'


def head_in_band(video: str, beats: list, *, seam: int, aspect: str = '9:16', fps: float = 30, detector=None,
                 grab=None) -> dict:
    target = 'his whole head, crown to chin, inside the camera band of every SPLIT take beat'
    eligible = [b for b in beats or [] if b.get('layout') == 'SPLIT' and (b.get('plate') or {}).get('source') == 'take']
    if aspect != '9:16' or not eligible:
        return {'value': None, 'target': target, 'pass': None, 'status': 'not applicable'}
    detector = detector or default_detector()
    if detector is None:
        return {'value': None, 'target': target, 'pass': None, 'status': 'not_run',
                'reason': 'no face detector in this Python (opencv-python or mediapipe)'}
    grab = grab or (lambda frame: frame_at(video, frame, fps, (1080, 1920)))
    height = 1920
    cut, no_face, samples, suggest = [], [], 0, {}
    for beat in eligible:
        span = beat['toFrame'] - beat['fromFrame']
        seen, heads, before = 0, [], len(cut)
        for share in HEAD_SAMPLES:
            frame = beat['fromFrame'] + int(span * share)
            samples += 1
            faces = detector(grab(frame))
            if not faces:
                continue
            seen += 1
            x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
            crown, chin = y - CROWN * h, y + (1 + CHIN) * h
            heads.append((crown, chin))
            at = round(frame / fps, 2)
            if crown < seam:
                cut.append({'beat': beat.get('id'), 'at_s': at, 'edge': 'crown', 'by_px': round(seam - crown),
                            'band_top': seam})
            if chin > height:
                cut.append({'beat': beat.get('id'), 'at_s': at, 'edge': 'chin', 'by_px': round(chin - height)})
        if not seen:
            no_face.append(beat.get('id'))
        elif len(cut) > before:
            # Name the crop that would hold every sampled head, so the fix is a value to set, not a search.
            suggest[beat.get('id')] = fitting_position(
                heads, crop_position((beat.get('plate') or {}).get('crop')), seam=seam, height=height) or 'none fits'
    return {'value': {'beats': len(eligible), 'samples': samples, 'cut': cut[:12], 'count': len(cut),
                      'no_face_in_beat': no_face, 'suggest_crop': suggest},
            'target': target, 'pass': not cut and not no_face}
