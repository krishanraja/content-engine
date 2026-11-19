"""OCR each caption page once; missing OCR never becomes a successful gate."""
from __future__ import annotations

import math
import re
import csv
import io
import shutil
import subprocess
from difflib import SequenceMatcher

import numpy as np

from .qc import frame_span, gray_frames, measurement, pixel_box


def _tokens(text: str) -> list[str]:
    return re.findall(r'\w+', text.casefold(), flags=re.UNICODE)


# Tesseract cannot tell the heavy sans capital I from a lower-case l ("AI" reads "Al", "I asked" reads "l asked"),
# and neither can a viewer in this face. Both sides are folded the same way, so only that one ambiguity is forgiven.
_CONFUSABLE = str.maketrans('l1|', 'iii')


def fold(token: str) -> str:
    return token.translate(_CONFUSABLE)


def lone_capital_i(token: str, expected: list) -> bool:
    """A reading made only of I, l, 1 or | glyphs and at most two long is the single-letter word "I" when "i" is
    expected on the page ("I were you" reads "Il"). Narrow on purpose: no other token is ever forgiven."""
    return 'i' in expected and 0 < len(token) <= 2 and set(token) <= set('il1|')


def caption_box_height(lines: int, wide: bool) -> int:
    """The engine's caption box: 34 px above, 38 px below, `lines` lines of size x 1.06 (CaptionTrack.tsx, geometry.ts)."""
    size = 54 if wide else 68
    return int(34 + 38 + lines * size * 1.06 + 6)


def crop_to_caption_box(pixels, lines: int, wide: bool, compact: bool = False):
    """Keep the caption box only. The OCR region is fixed but the box is as tall as its lines: on a tall cut it hangs
    from the top of the region, on a wide cut it sits on the bottom. The rest of the region is the picture (cream
    passport paper, a phone, a headline) and reads as stray words."""
    height = caption_box_height(lines, wide)
    if compact:
        # A SPLIT caption keeps 10 px above and below (BrandFrame.tsx SplitCaptionTrack), not 34 and 38.
        height = height - 34 - 38 + 20
    if height >= pixels.shape[0]:
        return pixels
    return pixels[-height:] if wide else pixels[:height]


def page_lines(page: dict, wide: bool) -> int:
    from .compile import caption_line_count
    rows = [{'text': w['text'] if isinstance(w, dict) else str(w), 'w': i} for i, w in enumerate(page['words'])]
    swipe = page.get('swipeIndex')
    return caption_line_count(rows, '16:9' if wide else '9:16', {swipe} if swipe is not None else ())


def spaceless_match(expected: str, actual: str) -> float:
    """Tracked or fused words match their spaced form (caption OCR)."""
    return SequenceMatcher(None, ''.join(_tokens(expected)), ''.join(_tokens(actual))).ratio()


def _recognise(executable, pixels, *, psm=6, boxes=False):
    h, w = pixels.shape
    pgm = f'P5\n{w} {h}\n255\n'.encode('ascii') + pixels.astype('uint8').tobytes()
    result = subprocess.run([executable, 'stdin', 'stdout', '--psm', str(psm),
                             *(['tsv'] if boxes else [])], input=pgm,
                            capture_output=True, check=True)
    return result.stdout.decode('utf-8', errors='replace').strip()


def read_words(executable, pixels):
    """Full-frame sparse OCR, with original pixel geometry and confidence."""
    text = _recognise(executable, pixels, psm=11, boxes=True)
    return [{'text': row['text'], 'conf': float(row['conf']),
             **{key: int(row[field]) for key, field in
                [('x', 'left'), ('y', 'top'), ('w', 'width'), ('h', 'height')]}}
            for row in csv.DictReader(io.StringIO(text), delimiter='\t')
            if row['level'] == '5' and row.get('text', '').strip()]


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


def _highlight(pixels):
    """Dark text on the mint emphasis box, made the same ink as the cream words around it: inside a mid-grey box
    (the mint), dark pixels are text; outside it, light pixels are. Tesseract reads one polarity at a time, so without
    this an emphasised word ("no", "prompt") reads as a bar or junk although it is drawn crisply (Thursday 5 Nov)."""
    from PIL import Image, ImageFilter
    grey = pixels.astype(float)
    band = (((grey > 165) & (grey < 222)) * 255).astype('uint8')
    box = Image.fromarray(band).filter(ImageFilter.MinFilter(5)).filter(ImageFilter.MaxFilter(21))
    inside = np.asarray(box) > 0
    return np.where(np.where(inside, grey < 110, grey > 200), 0, 255).astype('uint8')


def _read_candidates(executable, pixels, expected, judge=None):
    normalised = _normalise(pixels)
    highlight = _highlight(pixels)
    expected = [fold(token) for token in expected]
    best = None
    for variant, image in (('raw', pixels), ('normalised', normalised),
                           ('raw_2x', pixels.repeat(2, axis=0).repeat(2, axis=1)),
                           ('normalised_2x', normalised.repeat(2, axis=0).repeat(2, axis=1)),
                           ('highlight', highlight)):
        seen = _recognise(executable, image)
        # A lone pipe is the heavy sans capital I read as a bar; it counts as the word I only where I is expected.
        if 'i' in expected:
            seen = re.sub(r'(?<!\w)\|(?!\w)', ' i ', seen)
        # A lone stray glyph from the picture behind the caption is not a caption word; real one-letter words are in `expected`.
        actual = ['i' if lone_capital_i(token, expected) else fold(token)
                  for token in _tokens(seen) if len(token) > 1 or fold(token) in expected or lone_capital_i(token, expected)]
        agreement = _agreement(expected, actual) if judge is None else judge(actual)
        # Tesseract fuses tightly set words ("writes a" -> "writesa"). Word spacing is gated by the caption
        # geometry lint, so identical letters in identical order count as a full match.
        if judge is None and spaceless_match(' '.join(expected), ' '.join(actual)) == 1:
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
        art = page.get('art')
        if art:  # an art page is read once its last word has landed and settled (art_view), never mid-entry
            revealed = max(first, max((int(word['atFrame']) for word in words), default=first) + int(art['settle']))
        if revealed > end:
            rows.append({'page': index, 'frame': None, 'pass': None, 'status': 'not_sampled',
                         'reason': 'No fully revealed caption window'})
            continue
        frame = revealed if art else (revealed + end) // 2
        if not executable:
            rows.append({'page': index, 'frame': frame, 'pass': None, 'status': 'not_run',
                         'reason': 'tesseract is not on PATH'})
            continue
        page_region = page.get('region', region)  # a SPLIT page reads its own zone (qc.inputs_from_props)
        # Only a SPLIT page (split: True) takes the compact crop; every page carries a region now (18 Nov 2026).
        _, _, w, h = pixel_box(page_region)
        pixels = gray_frames(render, frame, frame, page_region)[0].astype('uint8')
        words = ' '.join(word['text'] if isinstance(word, dict) else str(word) for word in page['words'])
        expected = _tokens(words)
        frame_pixels = pixels.reshape(h, w)
        # A picked caption style (themed: True) draws in its own band and sits on the band's foot when placed lower,
        # so the house box crop (the top rows of the region) cut its one-line pages away (Wed 18, 18 Nov 2026): read
        # the whole region, as the renderer read does.
        if not page.get('themed'):
            frame_pixels = crop_to_caption_box(frame_pixels, page_lines(page, w > 1000), w > 1000, bool(page.get('split')))
        judge = (lambda actual, art=art: in_order(expected, actual, art['extras'])['score']) if art else None
        best = _read_candidates(executable, frame_pixels, expected, judge)
        rows.append({'page': index, 'frame': frame, **best,
                     'pass': bool(expected) and best['agreement'] >= 0.98})
    report = measurement(rows, 'token agreement >= 0.98 on every page')
    if any(row.get('status') == 'not_sampled' for row in rows):
        report.update(status='incomplete', **{'pass': False if any(r['pass'] is False for r in rows) else None})
    elif not executable:
        report.update(status='not_run', reason='tesseract is not on PATH', **{'pass': None})
    return report


# ── Art-directed captions (ArtDirectedCaption.tsx), read as a viewer sees them ─────────────────────────────────────────
# Krish, 2026-11-19, of the Tue 17 / Thu 19 habits short: every gating row passed but captions.ocr and captions.render
# scored 0 to 0.75 on most pages, so measured_pass was false and the library refused the cut. The art-directed stack
# hangs ABOVE the house caption box by the tallest page of the cut (cutHeight), so the house box cut its upper rows off;
# the previous page stays dimmed on the line above for 0.6 s (the ghost) and the key word's huge faint echo sits behind.
# So an art page is read in its own measured stack, once its last word has landed and settled, and judged by its words in
# order, where the only words forgiven are the ones the renderer itself draws there: this page's echo, and the previous
# page's echo and ghost. A word missing, out of order or from anywhere else still fails. The 0.98 bar is unchanged.

def _art_cfg() -> dict:
    from . import plainframes  # noqa: PLC0415
    return plainframes.config()['caption_over_content']['art_directed']


def _art_text(word) -> str:
    return word.get('text') if isinstance(word, dict) else str(word)


def _art_key(page) -> int:
    words = [re.sub(r'[,.;:]+$', '', _art_text(w)) for w in page.get('words') or []]
    if page.get('swipeIndex') is not None:
        return int(page['swipeIndex'])
    best = 0
    for i, w in enumerate(words):
        if len(w) > len(words[best]):
            best = i
    return best


def art_echo_word(page) -> str | None:
    """echoIndex(): an emphasised word always gets an echo; a phrase gets one for its key word; a one-word page none."""
    words = page.get('words') or []
    if page.get('swipeIndex') is not None:
        return _art_text(words[int(page['swipeIndex'])])
    return _art_text(words[_art_key(page)]) if len(words) >= 2 else None


def art_view(all_pages: list, index: int, aspect: str, fps: float, cfg: dict | None = None) -> dict:
    """What OCR needs for art page `index` of the cut: the region its stack is drawn in (the measured stack, padded by the
    word's rise below and at the sides, never above into the ghost's line), the frames its last word takes to settle,
    and the words the renderer draws there besides the page (`extras`)."""
    from . import plainframes  # noqa: PLC0415
    a = cfg or _art_cfg()
    rules = {'caption_over_content': {'art_directed': a}}
    page = all_pages[index]
    x, y, w, h = plainframes.art_box(all_pages, page, aspect, rules)
    pad = int(a['enter_rise_px']) + 2
    width, height = (1080, 1920) if aspect == '9:16' else (1920, 1080)
    left, top = max(0, x - pad), max(0, y)
    region = (left, top, min(width, x + w + pad) - left, min(height, y + h + pad) - top)
    extras = set()
    for pg in ([page] + ([all_pages[index - 1]] if index > 0 else [])):
        echo = art_echo_word(pg)
        if echo:
            extras |= set(_tokens(echo))
    if index > 0:
        extras |= {t for w in all_pages[index - 1].get('words') or [] for t in _tokens(_art_text(w))}
    settle = int(math.ceil(float(a['enter_seconds']) * float(fps))) + 1
    return {'region': region, 'extras': sorted(fold(t) for t in extras), 'settle': settle}


def in_order(expected, actual, extras=()) -> dict:
    """The page's words, in order, in what OCR read. Every expected word must be read in order (the longest common
    subsequence); a read word outside that match is forgiven only when the renderer draws it there (`extras`). Score is
    the matched share of the expected words, lowered by every unexplained word; exact means all matched and none
    unexplained."""
    exp, act = [fold(t) for t in expected], [fold(t) for t in actual]
    allowed = {fold(t) for t in extras}
    n, m = len(exp), len(act)
    table = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            table[i][j] = table[i + 1][j + 1] + 1 if exp[i] == act[j] else max(table[i + 1][j], table[i][j + 1])
    matched, used, i, j = table[0][0], set(), 0, 0
    while i < n and j < m:
        if exp[i] == act[j]:
            used.add(j); i += 1; j += 1
        elif table[i + 1][j] >= table[i][j + 1]:
            i += 1
        else:
            j += 1
    unexplained = [act[k] for k in range(m) if k not in used and act[k] not in allowed]
    score = matched / (n + len(unexplained)) if n else 0.0
    return {'score': round(score, 4), 'exact': n > 0 and matched == n and not unexplained, 'unexplained': unexplained}
