"""Screen occupancy and OCR geometry against the tall design lock."""
from __future__ import annotations

import math
import shutil

import numpy as np
from PIL import Image, ImageColor, ImageFilter

from .common import CONFIG, ROOT, load_json
from . import qc_captions
from .qc_keyframes import _frame


# Type and tags may run a few pixels past the platform edge (a 28 px tag, a dek line) without hiding behind platform UI.
PLATFORM_TOLERANCE_PX = 12


def _ink():
    tokens = load_json(CONFIG / 'brand-tokens.json')
    theme = next(theme for theme in load_json(ROOT / 'config/studio.json')['brand_themes']
                 if theme['theme_id'] == tokens['theme_id'])
    return ImageColor.getrgb(theme['colors']['ink'])


def _words(image):
    """Require geometry from the shared OCR owner; never duplicate recognition."""
    executable = shutil.which('tesseract')
    if not executable:
        raise OSError('tesseract is not on PATH; composition text checks cannot run')
    return qc_captions.read_words(executable, np.asarray(image.convert('L')))


def _inside(x, y, box):
    if isinstance(box, dict):
        box = [box[k] for k in ('x', 'y', 'w', 'h')]
    left, top, width, height = box
    return left <= x < left + width and top <= y < top + height


def _fill(image, caption):
    # BOX averaging removes the 7% per-pixel grain before thresholding. A
    # 31-pixel dilation at quarter scale measures the space carried by content,
    # rather than counting only individual glyph strokes.
    small = image.convert('L').resize((270, 480), Image.Resampling.BOX)
    pixels = np.asarray(small, dtype=np.float32)
    ground = float(np.dot(_ink(), [0.299, 0.587, 0.114]))
    dy, dx = np.gradient(pixels)
    mask = (np.abs(pixels - ground) >= 14) | (np.hypot(dx, dy) >= 14)
    eligible = np.ones(mask.shape, dtype=bool)
    x, y, w, h = (caption[k] for k in ('x', 'y', 'w', 'h'))
    eligible[y // 4:(y + h) // 4, x // 4:(x + w) // 4] = False
    # Captions cannot inflate occupancy in the neighbouring content bands.
    mask &= eligible
    mask = np.asarray(Image.fromarray(mask.astype('uint8') * 255).filter(ImageFilter.MaxFilter(31))) > 0
    return round(float(mask[eligible].mean() * 100), 2)


def _label_score(words):
    # Caption OCR's spaceless token rule also handles a widely tracked tag.
    best = 0.0
    for first in words:
        line = sorted([word for word in words
                       if abs(word['y'] + word['h'] / 2 - first['y'] - first['h'] / 2)
                       <= max(first['h'], word['h']) * 0.5], key=lambda word: word['x'])
        for start in range(len(line)):
            joined = ''
            previous = None
            for word in line[start:]:
                if previous and word['x'] - previous['x'] - previous['w'] > 2 * max(word['h'], previous['h']):
                    break
                joined += ''.join(qc_captions._tokens(word['text']))
                best = max(best, qc_captions.spaceless_match('illustration', joined))
                previous = word
                if len(joined) > 18:
                    break
    return best


def measure(image, lock, *, plate_on_screen=False, exempt=(), caption_words=None, ocr_words=None) -> dict:
    if not isinstance(image, Image.Image):
        with Image.open(image) as source:
            image = source.convert('RGB')
    if image.size != (1080, 1920):
        raise ValueError(f'Composition needs 1080x1920, got {image.size}')
    zones, limits = lock['zones'], lock['thresholds']
    fill = _fill(image, zones['caption'])
    raw = _words(image) if ocr_words is None else ocr_words
    candidates = [word for word in raw if float(word['conf']) >= 60
             and any(c.isalnum() for c in word['text'])
             and not any(_inside(word['x'] + word['w'] / 2, word['y'] + word['h'] / 2, box) for box in exempt)]
    allowed = {'caption'} if caption_words is None else set(caption_words)
    minimum = math.floor(0.62 * limits['min_text_px'])
    tag_minimum = math.floor(0.62 * limits.get('min_tag_px', limits['min_text_px']))
    small, caption, platform, edges = [], [], [], []
    for word in candidates:
        x, y, w, h = (word[k] for k in ('x', 'y', 'w', 'h'))
        solid = float(word['conf']) >= 75 and sum(c.isalnum() for c in word['text']) >= 3
        tag = len(word['text']) >= 5 and set(word['text'].lower()) <= set('illustration')
        if h < (tag_minimum if tag else minimum) and solid and not _inside(x + w / 2, y + h / 2, zones['marquee']):
            small.append(word)
        if ((solid or float(word['conf']) >= 90) and _inside(x + w / 2, y + h / 2, zones['caption'])
                and not {qc_captions.fold(t) for t in qc_captions._tokens(word['text'])}.issubset({qc_captions.fold(a) for a in allowed})):
            caption.append(word)
        strong = solid or float(word['conf']) >= 90  # one stray glyph on a photo is OCR noise, not a layout fault
        if (strong and not _inside(x + w / 2, y + h / 2, zones['marquee'])
                and (x + w > zones['platform']['right_x'] + PLATFORM_TOLERANCE_PX or y + h / 2 > zones['platform']['bottom_y'])):  # most of the word sits in the platform zone
            platform.append(word)
        if (strong and not _inside(x + w / 2, y + h / 2, zones['marquee'])
                and (min(x, y, 1080 - x - w, 1920 - y - h) < limits['edge_margin_px']
                     or x < limits['key_content_margin_px'] - 12)):
            edges.append(word)
    score = _label_score(candidates) if plate_on_screen else None
    if plate_on_screen and score < 0.8 and ocr_words is None and limits.get('illustration_tag_required', True):
        header = zones['header']
        crop = image.crop((340, header['y'] - 20, 680, header['y'] + header['h'] + 20))
        crop = crop.resize((crop.width * 3, crop.height * 3), Image.LANCZOS)
        score = max(score, _label_score([w for w in _words(crop) if float(w['conf']) >= 10]))
    checks = {'fill_pct': {'pass': fill >= limits['fill_min_pct'], 'value': fill},
              **{name: {'pass': not value, 'value': value} for name, value in
                 [('small_text', small), ('caption_zone', caption), ('platform_zone', platform), ('edges', edges)]},
              'illustration': {'pass': not plate_on_screen or score >= 0.8 or not limits.get('illustration_tag_required', True), 'value': score}}
    findings = []
    if not checks['fill_pct']['pass']:
        findings.append(f"fill {fill:g}% outside the caption zone, the lock needs {limits['fill_min_pct']}%.")
    for word in small:
        findings.append(f"small_text {word['text']!r} is {word['h']} px high, the limit is at least {minimum} px.")
    for word in caption:
        findings.append(f"caption_zone contains {word['text']!r}, the limit is 0 unlisted words.")
    for word in platform:
        findings.append(f"platform_zone {word['text']!r} ends at ({word['x'] + word['w']}, {word['y'] + word['h']}), the limits are ({zones['platform']['right_x']}, {zones['platform']['bottom_y']}) outside the marquee.")
    for word in edges:
        findings.append(f"edges {word['text']!r} starts at ({word['x']}, {word['y']}), the limits are {limits['edge_margin_px']} px from each edge and x at least {limits['key_content_margin_px'] - 12} px.")
    if not checks['illustration']['pass']:
        findings.append(f'illustration label match {score:.2f}, the limit is at least 0.80 while a plate is on screen.')
    return {'pass': all(check['pass'] for check in checks.values()), 'checks': checks, 'findings': findings}


def _footage_boxes(props, frame):
    """Where the phone glass shows real footage at this frame: its text is evidence, never retyped or enlarged."""
    boxes = []
    for obj in props.get('objects', []):
        if obj.get('device') != 'hand_phone_stage':
            continue
        fills = sorted((e for e in props.get('events', []) if e['obj'] == obj['obj'] and e['verb'] == 'fill' and e['atFrame'] <= frame),
                       key=lambda e: e['atFrame'])
        if fills and fills[-1]['toState'] == 'footage':
            boxes.append((0, 380, 1080, 800))
    return boxes


def call_card_tokens(props, beat) -> set:
    """The dated call card is engine chrome that takes the caption zone for the whole call beat, as captions do."""
    call = props.get('call')
    if not call or beat.get('role') != 'call':
        return set()
    text = f"The call Our call. {call['statement']} {call['due']} {call['confidencePercent']}% sure due"
    return set(qc_captions._tokens(text))


def composition_checks(video, props, lock) -> dict:
    if props.get('aspect') == '16:9':
        return {'applies': False, 'note': 'the design lock is 9:16 only'}
    if props.get('aspect') != '9:16':
        raise ValueError('Composition needs an explicit 9:16 or 16:9 aspect')
    rows = {}
    for beat in props.get('beats', []):
        image, at = _frame(video, beat)
        allowed = {token for page in props.get('captions', [])
                   if page['fromFrame'] <= at < page['toFrame']
                   for word in page['words']
                   for token in qc_captions._tokens(word['text'] if isinstance(word, dict) else str(word))}
        allowed |= call_card_tokens(props, beat)
        plate = any(label['fromFrame'] <= at < label['toFrame'] for label in props.get('illustrationLabels', []))
        rows[beat['id']] = measure(image, lock, plate_on_screen=plate, caption_words=allowed, exempt=_footage_boxes(props, at))
        rows[beat['id']]['frame'] = at
    return {'applies': True, 'pass': bool(rows) and all(row['pass'] for row in rows.values()), 'beats': rows}
