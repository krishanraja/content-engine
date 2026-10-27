"""OCR each caption page once; missing OCR never becomes a successful gate."""
from __future__ import annotations

import re
import shutil
import subprocess

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


def ocr(render, pages, region) -> dict:
    """Pages use EngineCaptionPage's fromFrame/toFrame and words[].text; box in pixels."""
    executable = shutil.which('tesseract')
    if not executable:
        return {'value': None, 'target': 'token agreement >= 0.98 on every page', 'pass': None,
                'status': 'not_run', 'reason': 'tesseract is not on PATH'}
    _, _, w, h = pixel_box(region)
    rows = []
    for index, page in enumerate(pages):
        first, last = frame_span(page)
        frame = (first + last - 1) // 2
        pixels = gray_frames(render, frame, frame, region)[0].astype('uint8')
        pgm = f'P5\n{w} {h}\n255\n'.encode('ascii') + pixels.tobytes()
        result = subprocess.run([executable, 'stdin', 'stdout', '--psm', '6'], input=pgm,
                                capture_output=True, check=True)
        seen = result.stdout.decode('utf-8', errors='replace').strip()
        words = ' '.join(word['text'] if isinstance(word, dict) else str(word) for word in page['words'])
        expected = _tokens(words)
        agreement = _agreement(expected, _tokens(seen))
        rows.append({'page': index, 'frame': frame, 'text': seen, 'agreement': agreement,
                     'pass': bool(expected) and agreement >= 0.98})
    return measurement(rows, 'token agreement >= 0.98 on every page')
