"""OCR each caption page once; missing OCR never becomes a successful gate."""
from __future__ import annotations

import re
import shutil
import subprocess

import numpy as np

from .qc import frame_span, gray_frames, measurement, pixel_box


def _tokens(text: str) -> list[str]:
    return re.findall(r'\w+', text.casefold(), flags=re.UNICODE)


def _agreement(expected: list[str], actual: list[str]) -> float:
    # Token edit distance penalises missing, extra, reordered and repeated words.
    previous = list(range(len(actual) + 1))
    for i, word in enumerate(expected, 1):
        current = [i]
        for j, seen in enumerate(actual, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (word != seen)))
        previous = current
    return max(0.0, 1 - previous[-1] / max(len(expected), len(actual), 1))


def _normalise(pixels):
    """Flatten mixed caption polarity, retaining dark letters inside bright boxes."""
    histogram = np.bincount(pixels.ravel(), minlength=256)
    ink = int(histogram[:128].argmax())
    light = int(histogram[128:224].argmax()) + 128
    bright = pixels > (ink + light) / 2
    # Run-length connected components avoid a Python visit for every crop pixel.
    parents, bounds, areas = [], [], []

    def root(label):
        while parents[label] != label:
            parents[label] = parents[parents[label]]
            label = parents[label]
        return label

    # Mint is the lower bright mode; cream glyphs must not join its box.
    highlight = (pixels >= light - 8) & (pixels <= light + 8)
    previous = []
    for y, row in enumerate(highlight):
        edges = np.flatnonzero(np.diff(np.pad(row.astype(np.int8), (1, 1))))
        current = []
        for left, right in zip(edges[::2], edges[1::2]):
            touching = {root(label) for start, end, label in previous if start < right and end > left}
            label = len(parents)
            parents.append(label)
            bounds.append([int(left), y, int(right), y + 1])
            areas.append(int(right - left))
            for other in touching:
                parents[other] = label
                a, b = bounds[label], bounds[other]
                bounds[label] = [min(a[0], b[0]), min(a[1], b[1]), max(a[2], b[2]), max(a[3], b[3])]
                areas[label] += areas[other]
            current.append((left, right, label))
        previous = current
    normalised = np.where(bright, 0, 255).astype(np.uint8)
    for label, (left, top, right, bottom) in enumerate(bounds):
        width, height = right - left, bottom - top
        if parents[label] == label and height >= 8 and width >= 1.5 * height and areas[label] >= 0.35 * width * height:
            # Follow each row's mint edges so rounded corners and antialiasing
            # cannot become black brackets around the highlighted word.
            normalised[max(0, top - 2):bottom + 2, max(0, left - 2):right + 2] = 255
            for y in range(top, bottom):
                edge = np.flatnonzero(highlight[y, left:right])
                if len(edge):
                    start, end = left + int(edge[0]), left + int(edge[-1]) + 1
                    normalised[y, start:end] = np.where(bright[y, start:end], 255, 0)
    return normalised


def _read_candidates(executable, pixels, expected):
    normalised = _normalise(pixels)
    best = None
    for variant, image in (('raw', pixels), ('normalised', normalised),
                           ('raw_2x', pixels.repeat(2, axis=0).repeat(2, axis=1)),
                           ('normalised_2x', normalised.repeat(2, axis=0).repeat(2, axis=1))):
        h, w = image.shape
        pgm = f'P5\n{w} {h}\n255\n'.encode('ascii') + image.tobytes()
        result = subprocess.run([executable, 'stdin', 'stdout', '--psm', '6'], input=pgm,
                                capture_output=True, check=True)
        seen = result.stdout.decode('utf-8', errors='replace').strip()
        actual = _tokens(seen)
        agreement = _agreement(expected, actual)
        # Tesseract fuses tightly set words ("writes a" -> "writesa"). Word spacing is gated by the caption
        # geometry lint, so identical letters in identical order count as a full match.
        if ''.join(expected) == ''.join(actual):
            agreement = 1.0
        if best is None or agreement > best['agreement']:
            best = {'text': seen, 'agreement': agreement, 'variant': variant}
        if agreement == 1:
            break
    return best


def ocr(render, pages, region) -> dict:
    """Pages use EngineCaptionPage's fromFrame/toFrame and words[].text; box in pixels."""
    executable = shutil.which('tesseract')
    if not executable and not pages:
        return {'value': None, 'target': 'token agreement >= 0.98 on every page', 'pass': None,
                'status': 'not_run', 'reason': 'tesseract is not on PATH'}
    _, _, w, h = pixel_box(region)
    rows = []
    for index, page in enumerate(pages):
        first, last = frame_span(page)
        words = page['words']
        # Renderer words are revealed on their own global atFrame clock.
        revealed = max(first, max((int(word['atFrame']) for word in words), default=first) + 2)
        end = last - 1
        if revealed > end:
            rows.append({'page': index, 'frame': None, 'pass': None, 'status': 'not_sampled',
                         'reason': 'No fully revealed caption window'})
            continue
        frame = (revealed + end) // 2
        if not executable:
            rows.append({'page': index, 'frame': frame, 'pass': None, 'status': 'not_run',
                         'reason': 'tesseract is not on PATH'})
            continue
        pixels = gray_frames(render, frame, frame, region)[0].astype('uint8')
        words = ' '.join(word['text'] if isinstance(word, dict) else str(word) for word in page['words'])
        expected = _tokens(words)
        best = _read_candidates(executable, pixels.reshape(h, w), expected)
        rows.append({'page': index, 'frame': frame, **best,
                     'pass': bool(expected) and best['agreement'] >= 0.98})
    report = measurement(rows, 'token agreement >= 0.98 on every page')
    if any(row.get('status') == 'not_sampled' for row in rows):
        report.update(status='incomplete', **{'pass': False if any(r['pass'] is False for r in rows) else None})
    elif not executable:
        report.update(status='not_run', reason='tesseract is not on PATH', **{'pass': None})
    return report
