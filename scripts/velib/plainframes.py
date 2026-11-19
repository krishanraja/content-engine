"""The v10 guards: a proof or cut that is visibly worse than what Krish approved never reaches him (config/failures.json,
F58). On the RENDERED frames, never the props, for any cut:

  plain_dark              a run of rows taller than 120 px (at 1920 high) that is near-black with almost no detail: ink,
                          black, or ink with a faint texture. "I already told you I don't want a plain black screen anywhere."
  caption_over_content    a caption's drawn box (the art-directed stack as the renderer measures it, else the theme's
                          region) sits over bright content (luma over 200) unless the beat carries a scrim.
  compare (proof.py, ve.py) when the engine or a screen asset changed since the proof he last approved, a sheet of the
                          same moments, approved above new, and no "sendable" until the session records what it compared.

ve qc measured an art-directed caption against the house box (y 1090 to 1307), never the stack the renderer draws, which
hangs up to y 986 on a tall page: that is why v10's caption over a white screen recording went unmeasured
(velib.qc.inputs_from_props, velib.qc_faces.caption_box). The stack is mirrored here from ArtDirectedCaption.tsx (the
renderer sizes text as length x size x 0.47, so the mirror is exact); tests/ve_plain_frames_test.py holds the copy of every
number to the TypeScript source.

Every number is a setting in config/ve/plain-frames.json. A check that cannot read a frame reports not_run, never a pass.
Adding a row for the next fault: the header of that file.
"""
from __future__ import annotations

import re
from pathlib import Path

import numpy as np

from .common import CONFIG, load_json


def config() -> dict:
    return load_json(CONFIG / 'plain-frames.json')


# ---------------------------------------------------------------- sampling


def sample_frames(beats: list[dict], pages: list[dict] | None, rules: dict | None = None) -> list[tuple[str, int]]:
    """(beat id, file frame) pairs: shortly after each beat starts, in its middle and shortly before it ends, and the frame
    the page's last word has been said for each caption page (the frame ve qc reads). Capped by config."""
    rules = rules or config()
    out: list[tuple[str, int]] = []
    for beat in beats:
        a, b = int(beat['fromFrame']), int(beat['toFrame'])
        if b <= a:
            continue
        for share in rules['sample']['per_beat']:
            out.append((str(beat.get('id')), min(b - 1, a + int((b - a) * share))))
    seen = set()
    unique = []
    for item in out:
        if item[1] not in seen:
            seen.add(item[1])
            unique.append(item)
    return unique[: rules['sample']['max_frames']]


def beat_at(beats: list[dict], frame: int) -> dict:
    return next((b for b in beats if int(b['fromFrame']) <= frame < int(b['toFrame'])), {})


# ---------------------------------------------------------------- (a) plain dark


def plain_bands(gray: np.ndarray, rules: dict | None = None) -> list[tuple[int, int]]:
    """[(y0, y1)] runs of plain dark rows at least min_band_px tall (scaled to this frame's height). gray is H x W, 0..255."""
    rules = rules or config()
    spec = rules['plain_dark']
    h = gray.shape[0]
    need = max(1, round(spec['min_band_px'] * h / rules['frame_height_reference']))
    mean = gray.mean(axis=1)
    detail = gray.std(axis=1)
    plain = (mean < spec['row_luma_max']) & (detail < spec['row_detail_max'])
    runs, start = [], None
    for y, flag in enumerate(plain):
        if flag and start is None:
            start = y
        if (not flag or y == h - 1) and start is not None:
            end = y + 1 if flag else y
            if end - start >= need:
                runs.append((start, end))
            start = None
    return runs


def plain_dark_problems(frames: list[tuple[str, int, np.ndarray]], rules: dict | None = None) -> list[dict]:
    """frames: (beat id, frame, gray H x W). One problem per frame, naming the beat, the frame and the band."""
    rules = rules or config()
    out = []
    for beat, frame, gray in frames:
        for y0, y1 in plain_bands(gray, rules):
            out.append({'check': 'plain_dark', 'beat': beat, 'frame': frame, 'band': [y0, y1],
                        'says': f'beat {beat}, frame {frame}: a plain dark band, rows {y0} to {y1} ({y1 - y0} px), no detail'})
    return out


# ---------------------------------------------------------------- (b) caption over content


def _clean(text) -> str:
    return re.sub(r'[,.;:]+$', '', str(text))


def art_layout(words: list[str], swipe_index, aspect: str, rules: dict | None = None) -> dict:
    """artLayout() in ArtDirectedCaption.tsx: support words above the key word, the key word alone on its own row, support
    words after it below. Text is measured as length x size x 0.47 (kit.ts textWidth), as the renderer does."""
    a = (rules or config())['caption_over_content']['art_directed']
    width = a['region'][aspect]['width']
    texts = [_clean(w) for w in words]
    if swipe_index is not None:
        key = int(swipe_index)
    else:
        key = 0
        for i, w in enumerate(texts):
            if len(w) > len(texts[key]):
                key = i

    def tw(word, size):
        return len(word) * size * a['char_em']

    def side(lo, hi):
        rows, row, used = [], [], 0.0
        for i in range(lo, hi):
            wd = tw(texts[i], a['support_size'])
            if row and used + a['gap'] + wd > width:
                rows.append(row)
                row, used = [], 0.0
            used += (a['gap'] if row else 0) + wd
            row.append(i)
        if row:
            rows.append(row)
        return [(r, a['support_size']) for r in rows]

    per = max(1, len(texts[key])) * a['char_em']
    key_size = round(min(a['key_size'], max(a['key_min_size'], (width - 8) / per)))
    rows = side(0, key) + [([key], key_size)] + side(key + 1, len(texts))
    height = sum(size * a['line_height'] for _, size in rows) + a['row_gap'] * (len(rows) - 1)
    return {'rows': rows, 'key': key, 'height': height}


def art_box(pages: list[dict], page: dict, aspect: str, rules: dict | None = None) -> tuple[int, int, int, int]:
    """x, y, w, h of the stack as drawn: it hangs from the foot of the region by the tallest page of the cut (cutHeight)."""
    rules = rules or config()
    a = rules['caption_over_content']['art_directed']
    region = a['region'][aspect]

    def height(p):
        return art_layout([w.get('text') or w.get('word') or '' for w in p.get('words', [])], p.get('swipeIndex'), aspect, rules)['height']

    hang = max([height(p) for p in pages] or [0])
    own = height(page)
    foot = region['top'] + region['height']
    # Pages hang from one fixed point: the foot minus the tallest page. This page fills from there down by its own height.
    return region['left'], round(foot - hang), region['width'], round(max(own, 1))


def caption_box_drawn(props: dict, pages: list[dict], page: dict, rules: dict | None = None) -> tuple[int, int, int, int]:
    """The region a caption page is drawn in: the measured art-directed stack, else the theme's region for its placement."""
    rules = rules or config()
    c = rules['caption_over_content']
    aspect = props.get('aspect', '9:16')
    if props.get('captionTheme') == c['art_directed']['theme']:
        return art_box(pages, page, aspect, rules)
    box = c['theme_regions'][aspect][props.get('captionPlacement') or 'lower']
    return box['left'], box['top'], box['width'], box['height']


def has_scrim(props: dict, beat: dict) -> bool:
    """A beat carries a scrim when it says so, or uses an object whose device is one (config scrim_devices)."""
    if beat.get('scrim'):
        return True
    devices = set(config()['caption_over_content']['scrim_devices'])
    by_obj = {o.get('obj'): o.get('device') for o in props.get('objects') or []}
    return any(by_obj.get(name) in devices for name in beat.get('uses') or [])


def bright_behind(rgb: np.ndarray, box: tuple[int, int, int, int], ink: tuple[int, int, int] | None,
                  background: np.ndarray | None = None, rules: dict | None = None) -> dict:
    """How bright the content behind a caption box is, as a share 0..1, and how it was read.
    With `background` (the same frame rendered with captions off) the box's own pixels are read. Without, two reads are
    taken and the brighter wins: the margins either side of the box on the same rows (content runs under the caption's
    columns there too), and the box's own bright pixels that are not the caption's ink colour."""
    spec = (rules or config())['caption_over_content']
    h, w = rgb.shape[:2]
    x, y, bw, bh = box
    x0, x1, y0, y1 = max(0, x), min(w, x + bw), max(0, y), min(h, y + bh)
    if x1 <= x0 or y1 <= y0:
        return {'share': 0.0, 'how': 'box off the frame'}
    luma = lambda a: 0.299 * a[..., 0] + 0.587 * a[..., 1] + 0.114 * a[..., 2]  # noqa: E731
    if background is not None:
        patch = luma(background[y0:y1, x0:x1].astype(np.float32))
        return {'share': float((patch > spec['bright_luma']).mean()), 'how': 'captions-off frame'}
    m = spec['margin_px'] * w // 1080
    strips = [luma(rgb[y0:y1, max(0, x0 - m):x0].astype(np.float32)), luma(rgb[y0:y1, x1:min(w, x1 + m)].astype(np.float32))]
    margin = max((float((s > spec['bright_luma']).mean()) for s in strips if s.size), default=0.0)
    inside = rgb[y0:y1, x0:x1].astype(np.float32)
    bright = luma(inside) > spec['bright_luma']
    if ink is not None:
        near_ink = np.sqrt(((inside - np.array(ink, np.float32)) ** 2).sum(axis=2)) < spec['ink_tolerance']
        bright = bright & ~near_ink
    own = float(bright.mean())
    return {'share': max(margin, own), 'how': 'margins' if margin >= own else 'box pixels'}


def hex_rgb(value) -> tuple[int, int, int] | None:
    text = str(value or '').lstrip('#')
    if re.fullmatch(r'[0-9a-fA-F]{6}', text):
        return int(text[0:2], 16), int(text[2:4], 16), int(text[4:6], 16)
    return None


def caption_over_content_problems(items: list[dict], rules: dict | None = None) -> list[dict]:
    """items: {page (index), frame, beat, box, rgb, ink, scrim, background?}. One problem per page whose box sits over bright content."""
    rules = rules or config()
    out = []
    for it in items:
        if it.get('scrim'):
            continue
        read = bright_behind(it['rgb'], it['box'], it.get('ink'), it.get('background'), rules)
        if read['share'] >= rules['caption_over_content']['bright_share']:
            x, y, w, h = it['box']
            out.append({'check': 'caption_over_content', 'page': it['page'], 'frame': it['frame'], 'beat': it['beat'],
                        'box': [x, y, w, h], 'share': round(read['share'], 2),
                        'says': f"caption page {it['page']}, frame {it['frame']} (beat {it['beat']}): its box, y {y} to {y + h}, "
                                f"sits over bright content ({round(read['share'] * 100)}% of it over luma "
                                f"{rules['caption_over_content']['bright_luma']}, read from {read['how']}); no scrim"})
    return out


# ---------------------------------------------------------------- the rendered file


def check_frames(path: str, props: dict, *, grab=None, fps: float | None = None, rules: dict | None = None) -> dict:
    """Run both frame checks on a rendered file. `props` is the compiled props the file was rendered from (the proof's
    window props for a proof). grab(path, frame, fps, (w, h)) -> rgb H x W x 3 (default: ffmpeg). Returns
    {'pass': bool|None, 'problems': [...], 'frames': n, 'status': 'ok' | 'not_run', 'reason'?}."""
    rules = rules or config()
    from . import qc  # noqa: PLC0415
    from .qc_faces import frame_at  # noqa: PLC0415
    grab = grab or frame_at
    try:
        inputs = qc.inputs_from_props(props)
    except (KeyError, ValueError, TypeError, OSError) as error:
        return {'pass': None, 'status': 'not_run', 'reason': f'the props could not be read for frames: {error}'[:200], 'problems': [], 'frames': 0}
    aspect = props.get('aspect', '9:16')
    size = (1080, 1920) if aspect == '9:16' else (1920, 1080)
    fps = fps or props.get('fps', 30)
    beats = inputs['beats']
    # caption pages on the file's clock, with their own geometry from the props (the same pages ve qc reads)
    # A page that starts at or after the file's last frame is never on screen in it (a proof window can end exactly where
    # the next page starts: Fri 20 Nov's proof, 240 frames, sampled a page at frame 240 and read nothing).
    end = props.get('durationFrames')
    pages = [pg for pg in inputs['pages'] if not isinstance(end, int) or _page_frame(pg) < end]
    plain, over = [], []
    try:
        gray_frames = []
        for beat_id, frame in sample_frames(beats, pages, rules):
            rgb = grab(path, frame, fps, size)
            gray_frames.append((beat_id, frame, (0.299 * rgb[..., 0] + 0.587 * rgb[..., 1] + 0.114 * rgb[..., 2]).astype(np.float32)))
        plain = plain_dark_problems(gray_frames, rules)
        ink = hex_rgb((props.get('tokens') or {}).get('cream'))
        items = []
        for i, page in enumerate(pages):
            frame = _page_frame(page)
            beat = beat_at(beats, frame)
            raw = {'words': page.get('words', []), 'swipeIndex': page.get('swipeIndex')}
            box = caption_box_drawn(props, [{'words': p.get('words', []), 'swipeIndex': p.get('swipeIndex')} for p in pages], raw, rules)
            items.append({'page': i, 'frame': frame, 'beat': beat.get('id', '?'), 'box': box, 'rgb': grab(path, frame, fps, size),
                          'ink': ink, 'scrim': has_scrim(props, beat)})
        over = caption_over_content_problems(items, rules)
    except (OSError, ValueError, RuntimeError) as error:
        return {'pass': None, 'status': 'not_run', 'reason': f'a frame could not be read: {error}'[:200], 'problems': [], 'frames': 0}
    problems = plain + over
    return {'pass': not problems, 'status': 'ok', 'problems': problems, 'frames': len(gray_frames) + len(pages)}


def _page_frame(page: dict) -> int:
    first, last = int(page['fromFrame']), int(page['toFrame'])
    revealed = max(first, max((int(w['atFrame']) for w in page.get('words', [])), default=first) + 2)
    return (revealed + last - 1) // 2


def refusal_lines(result: dict) -> list[str]:
    """Plain sentences for ve proof and ve render to print."""
    if result.get('status') == 'not_run':
        return [f"the frame guards could not run ({result.get('reason')}): the proof is not sendable until they have"]
    return [p['says'] for p in result.get('problems', [])[:12]] + (
        [f"and {len(result['problems']) - 12} more"] if len(result.get('problems', [])) > 12 else [])
