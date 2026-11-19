"""ve qc: measure a rendered cut and write qc.json bound to the file's sha256. Nothing here is a judgment;
each check is a number against a threshold. Checks without their optional inputs report not_run,
and `ve status` treats not_run as not ready. Promoted from the 27 Oct independent review's scripts."""
from __future__ import annotations

import re
import subprocess
from pathlib import Path

import numpy as np

from .common import CONFIG, ROOT, ffmpeg, load_json, sha256_file

CHANGE_THRESHOLD = 1.0  # mean abs grey difference on 64x64 frames at 5 fps; above ambient drift (calibrated on the reference)
GRID = 64
SAMPLE_FPS = 5


def _ff(args: list[str]) -> str:
    result = subprocess.run([ffmpeg(), '-hide_banner', '-nostats', *args], capture_output=True, text=True, errors='replace')
    return result.stderr


def duration_s(path: str) -> float:
    match = re.search(r'Duration: (\d+):(\d+):([\d.]+)', _ff(['-i', path]))
    if not match:
        return 0.0
    h, m, s = match.groups()
    return int(h) * 3600 + int(m) * 60 + float(s)


def loudness(path: str) -> dict:
    text = _ff(['-i', path, '-vn', '-af', 'ebur128=peak=true', '-f', 'null', '-'])
    summary = text[text.rfind('Summary:'):]
    integrated = re.search(r'I:\s+(-?[\d.]+) LUFS', summary)
    peak = re.search(r'Peak:\s+(-?[\d.]+) dBFS', summary)
    return {'integrated_lufs': float(integrated.group(1)) if integrated else None,
            'true_peak_dbtp': float(peak.group(1)) if peak else None}


def long_silences(path: str, floor_db: int = -50, min_s: float = 0.7) -> list[list[float]]:
    text = _ff(['-i', path, '-vn', '-af', f'silencedetect=noise={floor_db}dB:d={min_s}', '-f', 'null', '-'])
    starts = [float(x) for x in re.findall(r'silence_start: (-?[\d.]+)', text)]
    ends = [float(x) for x in re.findall(r'silence_end: (-?[\d.]+)', text)]
    return [[round(a, 2), round(b, 2)] for a, b in zip(starts, ends)]


def frame_diffs(path: str) -> np.ndarray:
    raw = subprocess.run([ffmpeg(), '-v', 'error', '-i', path, '-vf', f'fps={SAMPLE_FPS},scale={GRID}:{GRID},format=gray',
                          '-f', 'rawvideo', '-'], capture_output=True).stdout
    frames = np.frombuffer(raw, np.uint8).reshape(-1, GRID, GRID).astype(np.float32)
    if len(frames) < 2:
        return np.zeros(0, np.float32)
    return np.abs(np.diff(frames, axis=0)).mean(axis=(1, 2))


def motion(diffs: np.ndarray) -> dict:
    seconds = len(diffs) // SAMPLE_FPS
    if seconds == 0:
        return {'change_density': 0.0, 'longest_still_s': 0, 'still_runs': [], 'loop_period_s': None}
    per_second = diffs[: seconds * SAMPLE_FPS].reshape(seconds, SAMPLE_FPS).max(axis=1)
    changing = per_second > CHANGE_THRESHOLD
    runs, current = [], 0
    for index, moving in enumerate(changing):
        if not moving:
            current += 1
        else:
            if current:
                runs.append((index - current, current))
            current = 0
    if current:
        runs.append((seconds - current, current))
    runs.sort(key=lambda r: -r[1])
    return {'change_density': round(float(changing.mean()), 3), 'longest_still_s': int(runs[0][1]) if runs else 0,
            'still_runs': [list(r) for r in runs[:6]], 'loop_period_s': loop_period(diffs)}


def loop_period(diffs: np.ndarray, min_s: float = 2.0, max_s: float = 10.0, strength: float = 0.8) -> float | None:
    """A repeating motion signature (the f % 180 redraw loop): a strong autocorrelation peak between 2 and 10 s."""
    signal = diffs - diffs.mean()
    if len(signal) < int(max_s * SAMPLE_FPS) * 2 or not signal.any():
        return None
    corr = np.correlate(signal, signal, mode='full')[len(signal) - 1:]
    corr = corr / (len(signal) - np.arange(len(signal)))  # unbiased: fewer overlapping samples at longer lags
    corr = corr / corr[0]
    lo, hi = int(min_s * SAMPLE_FPS), int(max_s * SAMPLE_FPS)
    lag = lo + int(np.argmax(corr[lo:hi]))
    return round(lag / SAMPLE_FPS, 2) if corr[lag] >= strength else None


def audio_samples(path: str, rate: int = 48000) -> np.ndarray:
    """Decode mono PCM; decoder errors are failures, never empty successful measurements."""
    result = subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-i', str(path), '-vn',
                             '-ac', '1', '-ar', str(rate), '-f', 'f32le', '-'], capture_output=True, check=True)
    samples = np.frombuffer(result.stdout, '<f4').astype(np.float64)
    if not len(samples) or not np.isfinite(samples).all():
        raise ValueError('No finite audio samples decoded')
    return samples


def pixel_box(region) -> tuple[int, int, int, int]:
    """A box is [x, y, width, height] or a mapping with those pixel coordinates."""
    if isinstance(region, dict):
        region = [region[k] for k in ('x', 'y', 'width', 'height')]
    x, y, w, h = map(int, region)
    if x < 0 or y < 0 or w <= 0 or h <= 0:
        raise ValueError('Invalid pixel box')
    return x, y, w, h


def gray_frames(path: str, first: int, last: int, region) -> np.ndarray:
    """Decode inclusive original frame indexes, without resampling the media clock."""
    x, y, w, h = pixel_box(region)
    if first < 0 or last < first:
        raise ValueError('Invalid frame range')
    filt = f'select=between(n\\,{first}\\,{last}),crop={w}:{h}:{x}:{y}:exact=1,format=gray'
    result = subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-i', str(path), '-an',
                             '-vf', filt, '-fps_mode', 'passthrough', '-frames:v', str(last - first + 1),
                             '-f', 'rawvideo', '-'],
                            capture_output=True, check=True)
    frames = np.frombuffer(result.stdout, np.uint8).reshape(-1, h, w).astype(np.float32)
    if len(frames) != last - first + 1:
        raise ValueError('Missing requested video frames')
    return frames


def frame_span(item: dict, fps: float = 30) -> tuple[int, int]:
    """Engine intervals are half-open fromFrame/toFrame (or durationFrames)."""
    if 'fromFrame' in item:
        first = int(item['fromFrame'])
        last = int(item['toFrame']) if 'toFrame' in item else first + int(item['durationFrames'])
    else:
        first = round(float(item['start_s']) * fps)
        last = round(float(item['end_s']) * fps)
    if first < 0 or last <= first:
        raise ValueError('Invalid time span')
    return first, last


def measurement(rows: list, target: str) -> dict:
    return {'value': rows, 'target': target, 'pass': bool(rows) and all(r['pass'] for r in rows),
            'status': 'measured'}



def _split_geometry() -> tuple[float, tuple[int, int, int, int]]:
    """The SPLIT stage scale and caption zone, read from the renderer's geometry file, never copied."""
    geometry = (ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'layouts' / 'splitGeometry.ts').read_text(encoding='utf-8')
    scale = float(re.search(r'export const SPLIT_STAGE_SCALE = ([0-9.]+)', geometry).group(1))
    zone = re.search(r'export const SPLIT_CAPTION_ZONE = \{([^}]*)\}', geometry).group(1)
    get = lambda key: int(re.search(key + r': (\d+)', zone).group(1))
    return scale, (get('left'), get('top'), get('width'), get('height'))

def _renderer_layouts() -> dict:
    """Slot boxes parsed from the renderer's own table (apps/renderer/src/engine/layouts/index.ts),
    so QC can never measure a stale copy. Boxes are x, y, width, height in beat.uses order."""
    source = (ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'layouts' / 'index.ts').read_text(encoding='utf-8')
    # Named numbers the table imports (the SPLIT seam, SPLIT_SEAM_Y) are read from their own file, never copied.
    geometry = (ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'layouts' / 'splitGeometry.ts').read_text(encoding='utf-8')
    constants = {name: value for name, value in re.findall(r'export const (SPLIT_[A-Z_]+) = (-?\d+)\b', geometry)}
    result = {}
    for aspect, name in (('9:16', 'TALL'), ('16:9', 'WIDE')):
        block = re.search(r'const ' + name + r': Record<.*?readonly Box\[\]> = \{(.*?)\n\}\n', source, re.S).group(1)
        block = re.sub(r'\b(SPLIT_[A-Z_]+)\b', lambda m: constants[m.group(1)], block)
        # Layout dimensions may subtract a fixed inset from an imported seam.
        block = re.sub(r'(-?\d+)\s*-\s*(\d+)', lambda m: str(int(m[1]) - int(m[2])), block)
        result[aspect] = {layout: [tuple(int(n) for n in re.findall(r'-?\d+', box)) for box in re.findall(r'\{ left:[^}]*\}', body)]
                          for layout, body in re.findall(r'\n  (\w+): \[(.*?)\],?(?=\n|$)', block, re.S)}
    return result


def archivo700_width(text: str, size_px: float) -> float:
    """The width the renderer gives text in Archivo 700 (apps/renderer/src/house/metrics.ts textWidth: its own advance
    table, kerning left out, which errs on the wide side; a character it does not know counts 600 units)."""
    import ast  # noqa: PLC0415
    source = (ROOT / 'apps' / 'renderer' / 'src' / 'house' / 'metrics.ts').read_text(encoding='utf-8')
    chars = ast.literal_eval(re.search(r"const CHARACTERS = ('(?:[^'\\]|\\.)*')", source).group(1))
    table = [int(n) for n in re.search(r"archivo700: \[([^\]]*)\]", source).group(1).split(',')]
    index = {c: i for i, c in enumerate(chars)}
    return sum(table[index[c]] if c in index else 600 for c in text) * size_px / 1000


def theme_band(aspect: str, placement: str, staged: bool = False) -> tuple[int, int, int, int]:
    """A caption theme's band, read from the renderer's own table (apps/renderer/src/engine/captions/kit.ts REGIONS, and
    STAGED_BAND for the lower band under band staging, as kit.ts band() chooses)."""
    source = (ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'captions' / 'kit.ts').read_text(encoding='utf-8')
    if staged and placement == 'lower':
        table = re.search(r"export const STAGED_BAND[^=]*= \{([^}]*\}[^}]*\})", source).group(1)
        box = re.search(rf"'{re.escape(aspect)}': \{{ left: (\d+), top: (\d+), width: (\d+), height: (\d+) \}}", table)
        return tuple(int(n) for n in box.groups())
    block = re.search(rf"'{re.escape(aspect)}': \{{([^\n]*(?:\n[^']*)?)", source)
    box = re.search(rf"{placement}: \{{ left: (\d+), top: (\d+), width: (\d+), height: (\d+) \}}", block.group(1) if block else '')
    if not box:
        raise ValueError(f'no {placement} caption band for {aspect} in captions/kit.ts')
    return tuple(int(n) for n in box.groups())


def caption_pages_shown(props: dict) -> list:
    """Caption pages the renderer draws at the frame OCR samples. The dated call card replaces the captions for the
    whole call beat (CaptionTrack returns null there), so a page sampled inside it is not on screen."""
    calls = [(b['fromFrame'], b['toFrame']) for b in props['beats'] if b.get('role') == 'call'] if props.get('call') else []

    def sampled(page):  # the same frame qc_captions.ocr reads
        first, last = page['fromFrame'], page['toFrame']
        revealed = max(first, max((int(w['atFrame']) for w in page['words']), default=first) + 2)
        return (revealed + last - 1) // 2

    return [page for page in props['captions']
            if not any(start <= sampled(page) < end for start, end in calls)]


def lead_frames(props: dict | None) -> int:
    """The intro sting's frames in the cut's finished file (props.sting.frames), else 0. The props stay on the cut's own
    clock (compile moves no frame for the sting); where in the file the sting sits is sting_at (to_file)."""
    return int(((props or {}).get('sting') or {}).get('frames') or 0)


def sting_at(props: dict | None) -> int:
    """The cut's own frame the sting plays at: props.sting.atFrame, the hook's last frame + 1 (the sting after the hook,
    config/brand-palette.json long_cut sting after_hook, SOCIAL-BEST-PRACTICES-2026 section 4.3). 0, or absent, is the
    sting in front of the cut (the retired opening, kept so a cut made that way still reads true)."""
    return int(((props or {}).get('sting') or {}).get('atFrame') or 0)


def to_file(frame, props: dict | None, end: bool = False) -> int:
    """Cut frame `frame` on the finished file's clock (apps/renderer/src/engine/VeCut.tsx): the frames before the sting
    stay where they are, and every frame from the sting on falls the sting's frames later. An exclusive end (`end`) on
    the sting's own frame stays before it: the hook ends where the sting starts."""
    lead, at, f = lead_frames(props), sting_at(props), int(frame)
    return f + lead if (f > at if end else f >= at) else f


def to_file_s(seconds: float, props: dict | None) -> float:
    """A time on the cut's own clock on the finished file's clock, as to_file does for a frame."""
    fps = float((props or {}).get('fps') or 30)
    lead, at = lead_frames(props), sting_at(props)
    return float(seconds) + lead / fps if lead and float(seconds) >= at / fps else float(seconds)


def opening_lead(props: dict | None) -> int:
    """The frames in front of the hook in the file: the sting's when it opens the cut, 0 when it follows the hook."""
    return lead_frames(props) if not sting_at(props) else 0


END_KEYS = ('toFrame',)


def _moved(item: dict, props: dict, *keys: str) -> dict:
    """A copy of item with each frame key present moved onto the file's clock (to_file; toFrame is an exclusive end)."""
    return {k: (to_file(v, props, end=k in END_KEYS) if k in keys and v is not None else v) for k, v in item.items()}


def opening_view(props: dict) -> dict:
    """What the opening row (velib.qc_opening) reads of the props: the cut's shape, length, series and sting."""
    return {k: props.get(k) for k in ('aspect', 'fps', 'durationFrames', 'ending', 'series', 'sting', 'audio', 'opening')}


def inputs_from_props(props: dict) -> dict:
    """Resolve QC inputs on the finished file's 30 fps clock: the renderer's global clock, plus the intro sting's frames
    of every frame from where it plays (to_file: after the hook, or in front of the cut on a cut made before 16 Nov).
    Every frame a check reads in the file (beats, events, caption pages, the lip-sync EDL, joins and the plate under
    each beat) is moved with it; the stem already runs on the file's clock, so the EDL's stem positions are the moved
    frames."""
    # Mirrors apps/renderer/src/engine/layouts/index.ts, slotsFor():
    # boxes are x, y, width, height in beat.uses order, authored per aspect.
    layouts = _renderer_layouts()
    aspect = props['aspect']
    # Each beat says how far it moved (shift): the plate under it is read that many frames back (velib.qc_as_shot).
    beats = [_moved(b, props, 'fromFrame', 'toFrame', 'keyFrame') for b in props['beats']]
    for beat, original in zip(beats, props['beats']):
        if beat['fromFrame'] != original['fromFrame']:
            beat['shift'] = beat['fromFrame'] - int(original['fromFrame'])
    events = [_moved(e, props, 'atFrame') for e in props['events']]
    objects = {o['obj']: o for o in props.get('objects', [])}
    split_scale, split_caption = _split_geometry()
    split_seam = int(re.search(r'export const SPLIT_SEAM_Y = (\d+)', (ROOT / 'apps' / 'renderer' / 'src' / 'engine' / 'layouts' / 'splitGeometry.ts').read_text(encoding='utf-8')).group(1))
    slots = {}
    for event in events:
        at = event['atFrame']
        active = [b for b in beats if b['fromFrame'] <= at < b['toFrame'] and event['obj'] in b['uses']]
        # An exit on a beat's exclusive end measures the departing object's box.
        if not active and event.get('verb') == 'exit':
            active = [b for b in beats if b['toFrame'] == at and event['obj'] in b['uses']]
        # A proof window carries the states an object reached before it onto frame 0 (velib.proof, "earlier events land
        # on frame 0"): with no beat showing the object there, that cue is state, not a drawn moment (it may show in a
        # later beat of the window, or not at all; Tue 17, 19 Nov 2026).
        if not active and at == 0:
            continue
        if len(active) != 1:
            raise ValueError(f"Cue {event.get('id', event['obj'])} has no unique beat slot")
        beat = active[0]
        slot_index = 0 if beat['layout'] in ('STAGE', 'SPLIT', 'WINDOW') else beat['uses'].index(event['obj'])
        box = layouts[aspect][beat['layout']][slot_index]
        params = (objects.get(event['obj']) or {}).get('params', {}) if beat['layout'] == 'SPLIT' else {}
        place = params.get('place')
        if not place and (objects.get(event['obj']) or {}).get('device') == 'scribble':
            # A scribble on a SPLIT stage is measured where it draws (its target, or its centre and size).
            if isinstance(params.get('target'), dict):
                tg = params['target']
                place = {'left': tg['x'] - 20, 'top': tg['y'] - 20, 'width': tg['w'] + 40, 'height': tg['h'] + 40}
            elif {'cx', 'cy', 'size'} <= set(params):
                place = {'left': params['cx'] - params['size'], 'top': params['cy'] - params['size'],
                         'width': 2 * params['size'], 'height': 2 * params['size']}
        if place:
            # A placed SPLIT object is measured in its own box, not the whole stage (Thursday 5 Nov: a slab landing
            # beside the tick read as the tick firing 6 frames early). The stage scales about its top centre.
            s = split_scale
            w, h = place['width'] * place.get('scale', 1), place['height'] * place.get('scale', 1)
            box = (round(540 + (place['left'] - 540) * s), round(place['top'] * s), round(w * s), round(h * s))
            if (objects.get(event['obj']) or {}).get('device') == 'typing_bubble':
                # A bubble grows down from its box with every row it types, past the box it was placed in (Thursday
                # 5 Nov: three answers typed below a 100 px place box read as no change). Measure it to the seam.
                box = (box[0], box[1], box[2], max(box[3], split_seam - box[1]))
        slots[event.get('id', event['obj'])] = box
        slots.setdefault(event['obj'], box)
    # boxFor('caption') in apps/renderer/src/engine/geometry.ts, using
    # HOUSE.caption in apps/renderer/src/house/geometry.ts; round outwards.
    region = (60, 1090, 800, 217) if aspect == '9:16' else (260, 773, 1400, 187)  # house/geometry.ts HOUSE.caption
    stem = props['audio']['stem']
    # The stem is already assembled. Source-take trims in props.segments must
    # never be applied to it; compare each beat at its position in this master.
    # The ending band carries no speech, so lip sync is measured up to its start, never across it.
    stop = (props.get('ending') or {}).get('fromFrame', props.get('durationFrames'))
    stop = None if stop is None else to_file(stop, props)
    edl = [{'fromFrame': b['fromFrame'], 'toFrame': b['toFrame'] if stop is None else min(b['toFrame'], stop),
            'trimBeforeFrames': b['fromFrame'] + stem.get('trimBeforeFrames', 0)} for b in beats
           if stop is None or b['fromFrame'] < stop]
    # A take join is where a later picture segment starts. The sting's last frame to his face is not one: the stem
    # runs on unbroken under it, and the one take segment starts on the cut's own frame 0.
    joins = sorted({to_file(s['fromFrame'], props) / props.get('fps', 30) for s in props.get('segments', []) if s['fromFrame'] > 0})
    from . import qc_faces
    pages = []
    style = props.get('captionStyle') or 'house'
    from . import qc_captions as qc_captions_art, plainframes as _pf
    art_theme = props.get('captionTheme') == _pf.config()['caption_over_content']['art_directed']['theme'] and style != 'word'
    for original in caption_pages_shown(props):
        page = dict(_moved(original, props, 'fromFrame', 'toFrame'),
                    words=[_moved(w, props, 'atFrame') for w in original.get('words') or []])
        beat = next((b for b in beats if b['fromFrame'] <= page['fromFrame'] < b['toFrame']), {})
        if beat.get('layout') == 'SPLIT' and style != 'word':
            page['region'] = split_caption
            page['split'] = True
        if props.get('captionTheme') and style != 'word':
            page['themed'] = True
        if props.get('captionTheme') and not art_theme:
            # A caption theme draws inside its own band (captions/kit.ts REGIONS), not the word caption's centred box:
            # measure that band, the box the renderer draws in (Tue 17, 18 Nov 2026: the podcast theme was modelled as
            # a centred word 982 px wide while it drew 640 px from the left edge).
            x, y, w, h = theme_band(aspect, props.get('captionPlacement') or 'lower', staged=(props.get('layout') or {}).get('mode') == 'band')
            # Its text is drawn from the band's left edge: as wide as the page's words at the theme's largest size
            # (88 px), measured with the renderer's own advance widths (house/metrics.ts), never wider than the band.
            w = min(w, int(archivo700_width(qc_faces.page_text(page), 88)) + 8)
            pad = 0  # a theme band is already the outermost extent its text can reach
        else:
            x, y, w, h = qc_faces.caption_box(page, style, aspect, region, layout=beat.get('layout'),
                                             plate=(beat.get('plate') or {}).get('source'))
            pad = 12
        width, height = (1080, 1920) if aspect == '9:16' else (1920, 1080)
        left, top = max(0, x - pad), max(0, y - pad)
        page['region'] = (left, top, min(width, x + w + pad) - left, min(height, y + h + pad) - top)
        if art_theme and not page.get('split'):
            # The art-directed stack hangs above the house box by the cut's tallest page: read it where it is drawn, once
            # settled, judged in order (qc_captions.art_view, in_order; 19 Nov 2026, the habits short).
            view = qc_captions_art.art_view(props['captions'], props['captions'].index(original), aspect, props.get('fps', 30))
            page['region'], page['art'] = view['region'], {'extras': view['extras'], 'settle': view['settle']}
        pages.append(page)
    # The plate's frame under file frame F of a beat is F - the beat's shift + the segment's trim.
    return dict(pages=pages, beats=beats, aspect=aspect, events=events, slots=slots,
                region=region, mark_png=props['brand']['mark']['src'], dialogue_master=stem['src'],
                body_logo=props.get('bodyLogo') is True,
                edl=edl, joins=joins, caption_style='house' if props.get('captionTheme') else (props.get('captionStyle') or 'house'),  # a theme draws in its own band, each page's region
                plate_video=(props.get('segments') or [{}])[0].get('src') if len(props.get('segments') or []) == 1 else None,
                plate_offset=int((props.get('segments') or [{}])[0].get('trimBeforeFrames', 0)),
                opening=opening_view(props))


def picture_smeared(path: str, publish_day: str | None = None) -> dict:
    """Row picture.smeared: no picture smeared into stripes on the rendered cut (scripts/frame_smear.py). Measured on
    every cut; counted only for a piece published from config/ve/onscreen-checks.json picture.binds_from (F33)."""
    import sys as _sys
    _sys.path.insert(0, str(ROOT / 'scripts'))
    import frame_smear
    rules = load_json(CONFIG / 'onscreen-checks.json')['picture']
    target = 'no picture smeared into stripes (scripts/frame_smear.py)'
    try:
        result = frame_smear.measure(path)
        row = {'value': result['smears'][:10], 'target': target,
               'pass': None if result['status'] == 'inconclusive' else result['pass']}
        if result['status'] == 'inconclusive':
            row.update(status='not_run', reason='no frames decoded')
    except (OSError, ValueError, subprocess.CalledProcessError, frame_smear.FrameSmearError) as exc:
        # A missing decoder never passes and never crashes the qc that called it (as qc_onscreen's frame rows).
        row = {'value': None, 'target': target, 'pass': None, 'status': 'not_run', 'reason': str(exc)[:300]}
    if not (publish_day and str(publish_day) >= rules['binds_from']):
        row['status'] = 'advisory'
        row['note'] = f"binds pieces published from {rules['binds_from']} (config/ve/onscreen-checks.json picture)"
    return row


def _excerpt_s(props: dict | None, fps: float) -> float | None:
    """A proof excerpt's own length in seconds (its stem starts part-way into the premix), else None (a whole cut)."""
    stem = ((props or {}).get('audio') or {}).get('stem') or {}
    if int(stem.get('trimBeforeFrames') or 0) > 0 and (props or {}).get('durationFrames'):
        return int(props['durationFrames']) / float((props or {}).get('fps') or fps)
    return None


def run_qc(path: str, format_id: str, targets: dict | None = None, *,
           dialogue_master: str | None = None, edl=None, joins=None, pages=None, region=None,
           mark_png: str | None = None, beats=None, aspect=None, events=None, slots=None,
           composition_props=None, script: str | None = None, take_words=None, heard: dict | None = None,
           captions_drawn_by: str = 'faster-whisper', caption_ocr=None, fps: float = 30,
           caption_style: str = 'house', face_detector=None, plate_video: str | None = None,
           plate_offset: int = 0, opening: dict | None = None, publish_day: str | None = None,
           body_logo: bool = True,
           onscreen_reader=None, frame_props: dict | None = None, kept_restarts: list | None = None) -> dict:
    fmt = load_json(CONFIG / 'formats' / f'{format_id}.json')['qc']
    targets = targets or {'lufs': -14, 'tp': -1}
    loud = loudness(path)
    diffs = frame_diffs(path)
    move = motion(diffs)
    silences = long_silences(path)
    checks = {
        'loudness.integrated': {'value': loud['integrated_lufs'], 'target': f"{targets['lufs']} ±1",
                                'pass': loud['integrated_lufs'] is not None and abs(loud['integrated_lufs'] - targets['lufs']) <= 1},
        'loudness.true_peak': {'value': loud['true_peak_dbtp'], 'target': f"<= {targets['tp']}",
                               'pass': loud['true_peak_dbtp'] is not None and loud['true_peak_dbtp'] <= targets['tp']},
        'loudness.long_silence': {'value': silences, 'target': 'none over 0.7 s below -50 dB', 'pass': not silences},
        'motion.change_density': {'value': move['change_density'], 'target': f">= {fmt.get('change_density_min', 0)}",
                                  'pass': move['change_density'] >= fmt.get('change_density_min', 0)},
        'motion.longest_still': {'value': move['longest_still_s'], 'target': f"<= {fmt.get('longest_still_s', 99)} s",
                                 'pass': move['longest_still_s'] <= fmt.get('longest_still_s', 99), 'runs': move['still_runs']},
        'motion.periodicity': {'value': move['loop_period_s'], 'target': 'no repeating loop 2-10 s', 'pass': move['loop_period_s'] is None},
    }
    # The vertical cut proves the mark is absent instead of present (Ruling, Krish, 2026-11-11).
    # So does a wide cut whose body carries no logo (props bodyLogo false; Ruling, Krish, 2026-11-17).
    brand_row = 'brand.no_mark' if aspect == '9:16' or not body_logo else 'brand.mark_tile'
    for name in ('sync.av_xcorr', 'joins.decoder', 'captions.ocr', brand_row, 'motion.cue_sync', 'audio.bed', 'audio.bed_continuity',
                 'opening'):
        checks[name] = {'value': None, 'target': 'see config/ve/crew', 'pass': None, 'status': 'not_run'}
    # The calibrated cut gates quick-edit runs too (plan W2.4, scripts/cutgates, config/gates.json).
    for name in ('words.lost', 'joins.in_gaps', 'captions.clock', 'captions.render'):
        checks[name] = {'value': None, 'target': 'see config/gates.json', 'pass': None, 'status': 'not_run'}
    # No caption pages means nothing can sit on the face; the channel row is advisory (qc_channel.ADVISORY).
    checks['captions.off_face'] = ({'value': None, 'target': 'no caption page on the face', 'pass': None, 'status': 'not applicable'}
                                   if pages is not None and not pages else
                                   {'value': None, 'target': 'no caption page on the face', 'pass': None, 'status': 'not_run'})
    checks['plate.head_in_band'] = {'value': None, 'target': 'his whole head inside the camera band', 'pass': None,
                                    'status': 'not applicable'}
    checks['channel.safe_zones'] = {'value': None, 'target': 'nothing under a channel button', 'pass': None, 'status': 'advisory'}
    from . import qc_sync, qc_joins, qc_captions, qc_brand, qc_cues, qc_audio, qc_gates, qc_faces, qc_channel, qc_as_shot, qc_opening, qc_composition
    optional = [
        # The opening (Krish, 2026-11-05: "I think it should go at the start of the longer wide videos 100%,"): the
        # approved sting on the file's first frames and his cut on the very next frame, or no sting at all.
        ('opening', opening is not None, lambda: qc_opening.opening(path, opening)),
        # Advisory: his take as shot (the floor's untested-treatment rule); shown, never counted.
        ('picture.as_shot', bool(plate_video) and bool(beats) and aspect == '9:16' and Path(str(plate_video)).is_file(),
         lambda: qc_as_shot.as_shot(path, plate_video, beats, int(fps), plate_offset, pages, aspect)),
        ('sync.av_xcorr', dialogue_master is not None and edl is not None,
         lambda: qc_sync.av_xcorr(path, dialogue_master, edl)),
        ('joins.decoder', joins is not None, lambda: qc_joins.decoder(path, joins)),
        ('audio.bed', dialogue_master is not None, lambda: qc_audio.bed(dialogue_master)),
        ('audio.bed_continuity', dialogue_master is not None, lambda: qc_audio.continuity(path, dialogue_master, excerpt_s=_excerpt_s(frame_props, fps))),
        ('captions.ocr', pages is not None and region is not None, lambda: qc_captions.ocr(path, pages, region)),
        # The wide cut wears the mark tile; the vertical cut must not (Ruling, Krish, 2026-11-11). From the logo rule's
        # date (props bodyLogo false; Ruling, Krish, 2026-11-17: the logo only on the title frame and the close) the
        # wide cut must not either.
        ('brand.mark_tile', mark_png is not None and beats is not None and aspect is not None and aspect != '9:16' and body_logo,
         lambda: qc_brand.mark_tile(path, mark_png, beats, aspect)),
        ('brand.no_mark', mark_png is not None and beats is not None and aspect is not None and (aspect == '9:16' or not body_logo),
         lambda: qc_brand.no_mark(path, mark_png, beats, aspect)),
        ('motion.cue_sync', events is not None and slots is not None, lambda: qc_cues.cue_sync(path, events, slots)),
        ('words.lost', bool(heard) and script is not None and take_words is not None,
         lambda: qc_gates.words_lost(script, take_words, heard)),
        ('joins.in_gaps', bool(heard) and joins is not None, lambda: qc_gates.joins_in_gaps(joins, heard)),
        ('captions.clock', bool(heard) and pages is not None,
         lambda: qc_gates.captions_clock(pages, heard, captions_drawn_by, fps)),
        ('captions.render', pages is not None and region is not None,
         lambda: qc_gates.captions_render(path, pages, region, caption_ocr)),
        ('captions.off_face', bool(pages) and aspect is not None,
         lambda: qc_faces.off_face(path, pages, style=caption_style, aspect=aspect, region=region, fps=fps,
                                   detector=face_detector, beats=beats)),
        # Krish, 18 Nov 2026: his head is never cut off. On a SPLIT take beat the whole head sits in the camera band.
        ('plate.head_in_band', aspect == '9:16' and any(b.get('layout') == 'SPLIT' for b in beats or []),
         lambda: qc_faces.head_in_band(path, beats, seam=qc_composition.split_seam(), aspect=aspect, fps=fps,
                                       detector=face_detector)),
        ('channel.safe_zones', aspect is not None and (bool(pages) or bool(beats)),
         lambda: qc_channel.safe_zones(pages, beats, aspect, region, caption_style)),
    ]
    # A beat handover inside a word (keyframes@0.2.13, docs/ve/sources/keyframes.md). Counted only for a format whose
    # qc names handover_gap_ms; every other format sees it measured and advisory, so no proven format changes.
    if heard and beats:
        counted = 'handover_gap_ms' in fmt
        stop_frame = ((composition_props or {}).get('ending') or {}).get('fromFrame')  # the ending band carries no speech
        try:
            row = qc_gates.handover_in_gaps(beats, heard, fps=fps, stop_frame=stop_frame,
                                            min_gap_ms=fmt.get('handover_gap_ms', qc_gates.HANDOVER_GAP_MS))
        except (ValueError, KeyError, TypeError, OSError) as exc:
            row = {'value': None, 'target': 'beat handovers in agreed gaps', 'pass': False, 'status': 'error',
                   'reason': str(exc)}
        # Uncounted, it is a shadow row: in qc.json and the Critic's rows, kept out of Krish's packet (packet.py).
        checks['beats.handover_in_gaps'] = row if counted else {**row, 'status': 'advisory', 'shadow': True}
    # No bare ground around a handover (keyframes@0.2.13). Counted only for a format whose qc sets bare_ground: true;
    # a shadow row everywhere else, like beats.handover_in_gaps.
    if beats and aspect:
        from . import qc_ground
        try:
            row = qc_ground.bare_ground(path, beats, aspect, total_frames=int(round(duration_s(path) * fps)))
        except (ValueError, KeyError, TypeError, OSError, subprocess.CalledProcessError) as exc:
            row = {'value': None, 'target': 'no bare ground at a beat edge', 'pass': False, 'status': 'error',
                   'reason': str(exc)}
        checks['ground.not_bare'] = row if fmt.get('bare_ground') else {**row, 'status': 'advisory', 'shadow': True}
    # The bed's beat (velib.beats): the music stem the premix wrote beside the voice stem, read for its tempo, bars and
    # drops, and where the cut's handovers fall against its beats. Advisory and shadow: measured for the Critic, never
    # counted, never a target; nothing snaps to a beat, because his words and pauses are the clock.
    music_wav = Path(str(dialogue_master)).with_suffix('.music.wav') if dialogue_master else None
    if music_wav is not None and music_wav.is_file():
        from . import beats as beat_reader
        try:
            checks['music.beats'] = beat_reader.qc_row(music_wav, beats, fps)
        except (ValueError, KeyError, TypeError, OSError, subprocess.CalledProcessError) as exc:
            checks['music.beats'] = {'value': None, 'target': 'measured only: nothing snaps to the beat', 'pass': None,
                                     'status': 'advisory', 'shadow': True, 'reason': str(exc)}
    # STAGE beats compose the whole screen under a moving camera. The square mark tile is replaced by the logo in
    # the stage header, and an object's slot is the full canvas, so "change near the event inside its slot" cannot
    # separate an event from the camera. Both checks apply to the other layouts only; events on STAGE devices are
    # proved by their device tests and the key-frame match.
    stage_beats = [b for b in (beats or []) if b.get('layout') in ('STAGE', 'WINDOW')]
    if stage_beats and len(stage_beats) == len(beats or []):
        for name in ('brand.mark_tile', 'motion.cue_sync'):
            if name in checks or name == 'motion.cue_sync':
                checks[name] = {'value': None, 'target': 'not defined for STAGE layouts', 'pass': None,
                                'status': 'not applicable'}
        optional = [row for row in optional if row[0] not in ('brand.mark_tile', 'motion.cue_sync')]
    for name, supplied, measure in optional:
        if supplied:
            try:
                checks[name] = measure()
            except (ValueError, KeyError, TypeError, OSError, subprocess.CalledProcessError) as exc:
                checks[name] = {'value': None, 'target': 'valid decodable measurement inputs',
                                'pass': False, 'status': 'error', 'reason': str(exc)}
    from . import designlock, qc_keyframes
    try:
        view = designlock.for_aspect(designlock.load(), aspect or '9:16')
        if aspect == '16:9' and format_id not in view['formats']:
            # No frozen wide lock for this format: a wide cut is held to the mechanical checks and the Critic only.
            keyframes = {'applies': False, 'note': 'no 16:9 design lock for this format'}
        else:
            keyframes = qc_keyframes.keyframe_checks(path, {'beats': beats or []}, view, format_id)
    except (ValueError, KeyError, TypeError, OSError, subprocess.CalledProcessError) as exc:
        keyframes = {'applies': True, 'pass': False, 'beats': {}, 'findings': [str(exc)]}
    checks['keyframe_match'] = {
        'value': keyframes.get('beats'), 'target': 'approved golden keyframes',
        'pass': keyframes.get('pass'),
        'status': 'measured' if keyframes['applies'] else 'not applicable',
    }
    from . import qc_composition
    props = composition_props or {'aspect': aspect, 'beats': beats or [], 'captions': pages or []}
    try:
        if props.get('aspect') is None:
            composition = {'applies': True, 'pass': None, 'beats': {}, 'status': 'not_run',
                           'note': 'composition needs props with an explicit aspect and beats'}
        else:
            composition = qc_composition.composition_checks(path, props, designlock.load())
    except (ValueError, KeyError, TypeError, OSError, subprocess.CalledProcessError) as exc:
        composition = {'applies': True, 'pass': False, 'beats': {}, 'findings': [str(exc)]}
    checks['composition'] = {
        'value': composition.get('beats'), 'target': 'design lock composition thresholds',
        'pass': composition.get('pass'),
        'status': composition.get('status', 'measured') if composition['applies'] else 'not applicable',
    }
    # The post-mortem of the week of 2 Nov (velib/qc_onscreen.py): marks on their words, captions that neither break
    # mid-phrase nor repeat the headline, evidence read at a readable height. Advisory before its binds_from (F33).
    if composition_props and composition_props.get('beats'):
        from . import qc_onscreen
        checks.update(qc_onscreen.rows(path, composition_props, publish_day, read=onscreen_reader,
                                       lead=opening_lead(composition_props)))
    # The Tue 17 and Wed 18 failure lists as rows (velib/qc_frames.py, config/ve/frame-checks.json): one carrier a beat, figures
    # shown, no ghost of his face, no flat-black graphics, the render knew the logo rule, "off.day" drawn nowhere, the title a
    # card from his spoken line, no false start left in, motion in the first seconds, his whole head in frame. Any aspect.
    if frame_props and frame_props.get('beats'):
        from . import qc_frames
        checks.update(qc_frames.rows(path, frame_props, publish_day, beats=beats, aspect=aspect, fps=fps, diffs=diffs,
                                     heard=heard, kept_restarts=kept_restarts, face_detector=face_detector,
                                     read=onscreen_reader, lead=opening_lead(frame_props)))
    # A picture smeared into stripes (8 Nov, the proactive-AI opening's plate): every cut, advisory before its own date.
    checks['picture.smeared'] = picture_smeared(path, publish_day)
    # A tall meme is centred on the screen (Ruling, Krish, 2026-11-15: tall memes are centred; scripts/layout_centre.py,
    # the bars in config/brand-palette.json formats.meme_tall).
    if 'meme' in str(format_id) and aspect == '9:16':
        import sys as _sys
        _sys.path.insert(0, str(ROOT / 'scripts'))
        import layout_centre
        try:
            found = layout_centre.check([path])
            checks['layout.centred'] = {'value': found, 'target': 'picture centred, margins even, words clear of every channel',
                                        'pass': not found}
        except (ValueError, KeyError, OSError, subprocess.CalledProcessError) as exc:
            checks['layout.centred'] = {'value': None, 'target': 'centred on the screen', 'pass': False, 'status': 'error',
                                        'reason': str(exc)}
    # An advisory row is measured and shown, never counted (scripts/velib/qc_channel.py until its layout card lands).
    applicable = [c for c in checks.values() if c.get('status') not in ('not applicable', 'advisory')]
    built = [c['pass'] for c in applicable if c['pass'] is not None]
    return {'file': path, 'sha256': sha256_file(path), 'duration_s': round(duration_s(path), 3), 'format': format_id,
            'checks': checks, 'keyframes': keyframes, 'composition': composition, 'measured_pass': all(built),
            'complete': all(c['pass'] is not None and c.get('status') != 'incomplete' for c in applicable)}
