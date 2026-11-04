"""The one shape of the music bed, for both engines (config/music-bed.json).

Krish, 2026-11-04: "It should just start loudly and then get a little bit softer, so my voice is the main character,
but with atmosphere in the background, and then get louder at the end. It's pretty simple."

    timings(vs, ve, T)        where the shape turns, on the video's clock
    target_points(levels, vs, ve, T, chapters, accents, accent_lift_db)
                              the bed's target loudness (LUFS) at each turning point, linear between: the ledger's
                              intro_lufs, bed_lufs, outro_lufs and chapter_lufs, never keyed by the voice
    fade_db(t, T)             the short fade in and the fade over the last second, in dB
    qc(meter, vs, ve, T, chapters, accents)
                              the bed-shape QC on the bed stem alone, from an EBU R128 meter [(t, M, S)]
    write_receipt(video, engine, result)  <video>.bed-shape.json, bound to the video's sha256
    receipt_problems(video)   why a video has no valid receipt ([] when it has one)
    filing_problems(video, target)  the filing rule: a video for 3 Posts needs a passing receipt

Levels stay where Krish approved them (config/music-library.json levels); this module owns only the times and the
check. Nothing here keys the music to the voice.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / 'config' / 'music-bed.json'
VIDEO_SUFFIXES = ('.mp4', '.mov', '.mkv', '.webm', '.m4v')


class BedShapeError(ValueError):
    """The bed does not follow the one shape; the words say what to fix."""


def load(path: Path | None = None) -> dict:
    return json.loads(Path(path or CONFIG).read_text(encoding='utf-8'))


def shape(config: dict | None = None) -> dict:
    return (config or load())['shape']


# The shape.

def timings(voice_start_s: float, voice_end_s: float, total_s: float, config: dict | None = None) -> dict:
    """open_end: the open holds to here; bed_from: the ease down lands here; bed_to: his last word, where the rise
    starts; close_full: the rise lands here; fade_from: the final fade starts here."""
    s = shape(config)
    T = float(total_s)
    vs, ve = float(voice_start_s), float(voice_end_s)
    open_end = min(T, max(s['open_hold_s'], vs - s['open_ease_s']))
    bed_from = min(T, open_end + s['open_ease_s'])
    bed_to = min(T, max(bed_from, ve))
    close_full = min(T, bed_to + s['close_rise_s'])
    fade_from = max(close_full, T - s['fade_out_s'])
    return {'open_end': round(open_end, 4), 'bed_from': round(bed_from, 4), 'bed_to': round(bed_to, 4),
            'close_full': round(close_full, 4), 'fade_from': round(fade_from, 4), 'total': round(T, 4)}


def lift_windows(chapters=(), accents=(), config: dict | None = None) -> list[tuple[float, float]]:
    """Where the bed may lift above its level: each chapter card and each spoken chapter turn, with its ramps."""
    s = shape(config)
    out = [(float(a) - s['chapter_rise_s'], float(b) + s['chapter_fall_s']) for a, b in chapters if float(b) > float(a)]
    out += [(float(a), float(b)) for a, b in accents if float(b) > float(a)]
    return out


def target(levels: dict, t: float, turns: dict, chapters=(), accents=(), accent_lift_db: float = 0.0,
           config: dict | None = None) -> float:
    """The bed's target loudness in LUFS at time t (before the edge fades)."""
    s = shape(config)
    intro, bed, outro = float(levels['intro_lufs']), float(levels['bed_lufs']), float(levels['outro_lufs'])
    chapter = float(levels.get('chapter_lufs', -22))
    a, b, c, d = turns['open_end'], turns['bed_from'], turns['bed_to'], turns['close_full']
    if t <= a:
        value = intro
    elif t < b:
        value = intro + (bed - intro) * (t - a) / (b - a)
    elif t <= c:
        value = bed
    elif t < d:
        value = bed + (outro - bed) * (t - c) / (d - c)
    else:
        value = outro
    if b <= t <= c:
        for x, y in chapters:
            x, y = float(x), float(y)
            k = max(0.0, min(1.0, (t - (x - s['chapter_rise_s'])) / s['chapter_rise_s'],
                             ((y + s['chapter_fall_s']) - t) / s['chapter_fall_s']))
            value = max(value, bed + (chapter - bed) * k)
        if accent_lift_db:
            for x, y in accents:
                x, y = float(x), float(y)
                if y - x > 2.5 and x <= t <= y:
                    value = max(value, bed + accent_lift_db * max(0.0, min(1.0, (t - x) / 1.0, (y - t) / 1.5)))
    return value


def target_points(levels: dict, voice_start_s: float, voice_end_s: float, total_s: float, chapters=(), accents=(),
                  accent_lift_db: float = 0.0, config: dict | None = None) -> list[tuple[float, float]]:
    """[(t, LUFS)] at every turning point of the shape, linear between, from 0 to total_s."""
    s = shape(config)
    turns = timings(voice_start_s, voice_end_s, total_s, config)
    T = turns['total']
    times = {0.0, T, turns['open_end'], turns['bed_from'], turns['bed_to'], turns['close_full']}
    for x, y in chapters:
        times |= {float(x) - s['chapter_rise_s'], float(x), float(y), float(y) + s['chapter_fall_s']}
    if accent_lift_db:
        for x, y in accents:
            if float(y) - float(x) > 2.5:
                times |= {float(x), float(x) + 1.0, float(y) - 1.5, float(y)}
    times = sorted(round(min(T, max(0.0, t)), 4) for t in times)
    return [(t, round(target(levels, t, turns, chapters, accents, accent_lift_db, config), 3)) for t in dict.fromkeys(times)]


def fade_db(t: float, total_s: float, config: dict | None = None) -> float:
    """The edge fades in dB (0 between them, down to -120 at the very edges)."""
    import math
    s = shape(config)
    k = min(1.0, max(0.0, t / s['fade_in_s']), max(0.0, (float(total_s) - t) / s['fade_out_s']))
    return 20 * math.log10(max(k, 1e-6))


# The check, on the bed stem alone.

def _median(values):
    v = sorted(values)
    n = len(v)
    return None if not n else (v[n // 2] if n % 2 else (v[n // 2 - 1] + v[n // 2]) / 2)


def _percentile(values, p):
    v = sorted(values)
    if not v:
        return None
    k = (len(v) - 1) * p / 100
    lo, hi = int(k), min(len(v) - 1, int(k) + 1)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)


def direction_changes(series, swing: float) -> int:
    """How many times a level series turns round by `swing` or more (hysteresis, so ripple is not a turn)."""
    if not series:
        return 0
    trend, hi, lo, ext, changes = 0, series[0], series[0], series[0], 0
    for v in series[1:]:
        if trend == 0:
            hi, lo = max(hi, v), min(lo, v)
            if v >= lo + swing:
                trend, ext = 1, v
            elif v <= hi - swing:
                trend, ext = -1, v
        elif trend > 0:
            ext = max(ext, v)
            if v <= ext - swing:
                trend, ext, changes = -1, v, changes + 1
        else:
            ext = min(ext, v)
            if v >= ext + swing:
                trend, ext, changes = 1, v, changes + 1
    return changes


def qc(meter, voice_start_s: float, voice_end_s: float, total_s: float, chapters=(), accents=(),
       config: dict | None = None) -> dict:
    """The bed-shape QC on the bed stem alone. `meter` is [(t, momentary LUFS, short-term LUFS)] at 100 ms steps on
    the stem's clock (t is the end of each meter window), as quick-edit's audio_quality.measure and ve's
    audio.ebur128 give it. Relative only: the bed's own median under his voice is the bed level."""
    config = config or load()
    q = config['qc']
    turns = timings(voice_start_s, voice_end_s, total_s, config)
    lifts = [(a - q['lift_margin_s'], b + q['lift_margin_s']) for a, b in lift_windows(chapters, accents, config)]
    free = lambda t: not any(a <= t <= b for a, b in lifts)  # noqa: E731
    floor = -70.0
    rows = [(float(t), max(floor, float(m)), max(floor, float(s))) for t, m, s in meter]
    # Under his voice, on the short-term meter: it reads the 3 s before t, so it starts 3 s into the stretch.
    body = [s for t, _, s in rows if turns['bed_from'] + 3.0 <= t <= turns['bed_to'] and free(t)]
    problems = []
    median = _median(body)
    low, high = (_percentile(body, q['steady_percentiles'][0]), _percentile(body, q['steady_percentiles'][1])) if body else (None, None)
    if median is None:
        problems.append('no stretch under his voice long enough to meter the bed (3 s past the open)')
        spread = None
    else:
        spread = round(max(median - low, high - median), 2)
        if spread > q['steady_tolerance_lu']:
            problems.append(f'the bed moves under his voice: {spread} LU from its level (p{q["steady_percentiles"][0]} to '
                            f'p{q["steady_percentiles"][1]}), the shape allows {q["steady_tolerance_lu"]}')
    # Direction changes over the whole cut, outside the lifts, on the momentary meter smoothed over direction_smooth_s.
    step = max(1, int(round(q['direction_smooth_s'] / 0.1)))
    moments = [m for t, m, _ in rows if t >= 0.4 and free(t)]
    smooth = [sum(moments[i:i + step]) / step for i in range(0, max(0, len(moments) - step + 1))]
    changes = direction_changes(smooth, q['direction_swing_lu'])
    if changes > q['max_direction_changes']:
        problems.append(f'the bed goes up and down {changes} times (a move of {q["direction_swing_lu"]} LU or more), '
                        f'the shape turns at most {q["max_direction_changes"]} times: something keys it to the voice')
    first = [m for t, m, _ in rows if q['open_window_s'][0] <= t <= q['open_window_s'][1]]
    open_level = _median(first)
    open_over = None if open_level is None or median is None else round(open_level - median, 2)
    if open_over is None or open_over < q['open_over_bed_lu']:
        problems.append(f'the bed does not start loud: {open_over} LU over the bed in the first second, the shape needs '
                        f'{q["open_over_bed_lu"]}')
    ending = [m for t, m, _ in rows if turns['close_full'] + 0.4 <= t <= turns['fade_from']]
    if not ending:  # a short tail: the loudest of the rise
        ending = [max([m for t, m, _ in rows if turns['bed_to'] <= t <= turns['total'] - 0.2] or [floor])]
    end_level = _median(ending)
    end_over = None if median is None else round(end_level - median, 2)
    if end_over is None or end_over < q['end_over_bed_lu']:
        problems.append(f'the bed does not get louder at the end: {end_over} LU over the bed, the shape needs '
                        f'{q["end_over_bed_lu"]}')
    return {'pass': not problems, 'problems': problems, 'turns': turns,
            'bed_median_lufs': None if median is None else round(median, 2), 'bed_spread_lu': spread,
            'direction_changes': changes, 'open_over_bed_lu': open_over, 'end_over_bed_lu': end_over,
            'lifts_left_out': [list(map(lambda x: round(x, 2), w)) for w in lifts], 'config': 'config/music-bed.json'}


def require(result: dict, where: str) -> dict:
    """Stop loudly when the bed misses the shape."""
    if not result.get('pass'):
        raise BedShapeError(f'{where}: the music bed misses the one shape (config/music-bed.json): '
                            + '; '.join(result.get('problems') or ['no result']))
    return result


# The receipt, and the filing rule.

def sha256(path) -> str:
    digest = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            digest.update(block)
    return digest.hexdigest()


def receipt_path(video) -> Path:
    return Path(str(video) + load()['receipt']['suffix'])


def write_receipt(video, engine: str, result: dict, *, machine: str, extra: dict | None = None) -> Path:
    """<video>.bed-shape.json, for these exact bytes, written only by an engine whose bed passed."""
    config = load()
    if engine not in config['receipt']['engines']:
        raise BedShapeError(f'{engine} is not an engine that makes the bed (config/music-bed.json receipt.engines)')
    require(result, str(video))
    out = receipt_path(video)
    out.write_text(json.dumps({'schema': config['receipt']['schema'], 'engine': engine, 'machine': machine,
                               'video': Path(video).name, 'video_sha256': sha256(video), 'bed_shape': result,
                               **(extra or {})}, indent=2), encoding='utf-8')
    return out


def receipt_problems(video) -> list[str]:
    config = load()
    path = receipt_path(video)
    if not path.is_file():
        return [f'no bed-shape receipt beside {Path(video).name}: only ve or quick-edit make a bed and its receipt '
                f'(config/music-bed.json); a per-day compositor\'s cut is never filed']
    try:
        doc = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return [f'{path.name} cannot be read']
    problems = []
    if doc.get('schema') != config['receipt']['schema']:
        problems.append(f'{path.name} is not a bed-shape receipt')
    if doc.get('engine') not in config['receipt']['engines']:
        problems.append(f'{path.name} was not written by ve or quick-edit')
    if doc.get('video_sha256') != sha256(video):
        problems.append(f'{path.name} belongs to different bytes: the video changed after its bed was checked')
    if not (isinstance(doc.get('bed_shape'), dict) and doc['bed_shape'].get('pass') is True):
        problems.append(f'{path.name} records a bed that misses the shape')
    return problems


def is_filed_video(target: str) -> bool:
    """A video going into a post's folder (3 Posts), outside a working folder."""
    parts = PurePosixPath(str(target).replace('\\', '/')).parts
    if Path(str(target)).suffix.lower() not in VIDEO_SUFFIXES or not parts or parts[0] != '3 Posts':
        return False
    return not any(p.lower().startswith('working') for p in parts[1:-1])


def social_clip(video) -> bool:
    """An off-day social clip (someone else's footage under his caption) carries no bed of ours."""
    receipt = Path(str(video) + '.validation.json')
    try:
        return json.loads(receipt.read_text(encoding='utf-8')).get('kind') == 'social_clip'
    except (OSError, ValueError, AttributeError):
        return False


def filing_problems(video, target: str) -> list[str]:
    """[] when the video may go to `target`; else why not. Every filing route asks this."""
    if not is_filed_video(target):
        return []
    if social_clip(video) and ' off.day - ' in str(target):
        return []
    return [f'{target}: {p}' for p in receipt_problems(video)]
