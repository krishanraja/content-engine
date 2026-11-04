"""Krish picks the motion style on his own footage: `ve styles` renders the proof window once per shortlisted style.

Krish, 2026-11-04: "Can I select a visual style now that we have different style skills? Do I get shown mocks at the
right moment?" The shortlist is creative_direction.pick_motion (the one ranking); a style whose `ve_route` needs a
device that is not built is left out and named, so it never appears as an empty option. Each option is the same
window of his take with `style.motion` swapped in a copy of the spec, so he compares like with like.

Only distinct options reach him (Krish, 2026-11-04: "strengthen the weak styles before Friday"): the house look is
rendered on the same window, every clip is sampled and scored against the house and the other options
(config/ve/style-distinct.json), a look-alike gives way to the next ranked style, a style whose own effect touches no
device in the window is left out before it renders, and every score and exclusion is written into styles.json.

Never stock footage: the window comes from this piece's own compiled props (its ingested take). With no take ingested,
`last_take` looks for the newest props of another piece in the same format, and labels the mocks as that take; with
none, it refuses.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

from .common import ROOT, ffmpeg, load_json, sha256_file, write_json

# The point types a spec's devices most often land, for the shortlist when the spec does not name style.points.
DEVICE_POINTS = {
    'kinetic_stat': 'number', 'stat_strip': 'number', 'test_grid': 'comparison', 'logo_card': 'comparison',
    'logo_orbit': 'system', 'evidence_card': 'claim', 'headline': 'claim', 'stamp': 'claim', 'sticker': 'claim',
    'quote_card': 'quote', 'thread_card': 'quote', 'typing_bubble': 'product', 'query_chip': 'product',
    'cursor_buddy': 'product', 'hand_phone_stage': 'product', 'scribble': 'mechanism', 'record_card': 'claim',
    'passport_page': 'comparison', 'marquee': 'claim',
}


def _cd():
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import creative_direction  # noqa: PLC0415
    return creative_direction


def channel_format(spec: dict, cut: str) -> str:
    return 'short_video' if spec['cuts'][cut]['aspect'] == '9:16' else 'long_video'


def points_of(spec: dict) -> list[str]:
    named = (spec.get('style') or {}).get('points')
    if isinstance(named, list) and named:
        return [str(p) for p in named]
    found = []
    for obj in spec.get('objects') or []:
        point = DEVICE_POINTS.get(obj.get('device'))
        if point and point not in found:
            found.append(point)
    return found or ['claim']


def built(module: dict, devices: set[str]) -> list[str]:
    return [d for d in module.get('ve_route') or [] if d in devices]


def shortlist(spec: dict, cut: str, top: int = 3, modules=None, devices=None, points=None):
    """(options, skipped): options are [(id, why)] in rank order, skipped are [(id, why)] for styles with no device."""
    cd = _cd()
    modules = cd.motion_modules() if modules is None else modules
    if devices is None:
        devices = set(json.loads(cd.DEVICES.read_text(encoding='utf-8')).get('devices') or {})
    ranked = cd.pick_motion(points or points_of(spec), channel_format(spec, cut), top=len(modules), modules=modules,
                            devices=devices)
    options, skipped = [], []
    for mid, _score, why in ranked:
        if not built(modules[mid], devices):
            skipped.append((mid, 'needs a ve device that is not built yet (' + ', '.join(modules[mid].get('ve_route') or ['none']) + ')'))
            continue
        if len(options) < top:
            options.append((mid, why))
    return options, skipped


def last_take(spec: dict, cut: str, plans: Path | None = None) -> Path | None:
    """The newest compiled props of another piece in the same format and aspect: his last recorded take, never stock."""
    plans = plans or ROOT / 'docs' / 'plans'
    aspect = spec['cuts'][cut]['aspect']
    found = []
    for props_file in plans.glob('*/ve/props.*.json'):
        try:
            props = load_json(props_file)
        except (OSError, ValueError):
            continue
        if props.get('pieceId') == spec['piece_id'] or props.get('format') != spec['format'] or props.get('aspect') != aspect:
            continue
        if not props.get('segments'):  # a voiceover cut has no take picture
            continue
        found.append((props_file.parent.parent.name, props_file))
    return sorted(found)[-1][1] if found else None


DISTINCT = ROOT / 'config' / 've' / 'style-distinct.json'


def distinct_rules() -> dict:
    return load_json(DISTINCT)


def sample_frames(clip: Path | str, seconds: float, frames: int = 6, width: int = 270) -> list[bytes]:
    """`frames` greyscale frames evenly spaced across a clip (the middle of each sixth), `width` px wide, raw bytes."""
    out = []
    for i in range(frames):
        at = (i + 0.5) * seconds / frames
        done = subprocess.run([ffmpeg(), '-v', 'error', '-ss', f'{at:.3f}', '-i', str(clip), '-frames:v', '1', '-vf',
                               f'scale={width}:-2:flags=area,format=gray', '-f', 'rawvideo', '-'],
                              capture_output=True, check=True)
        if not done.stdout:
            raise ValueError(f'{clip}: no frame at {at:.2f} s')
        out.append(done.stdout)
    return out


def difference(a: list[bytes], b: list[bytes]) -> float:
    """Mean absolute difference of two clips' sampled greyscale pixels, 0 (the same) to 255."""
    total = count = 0
    for x, y in zip(a, b):
        n = min(len(x), len(y))
        total += sum(abs(p - q) for p, q in zip(x[:n], y[:n]))
        count += n
    if not count:
        raise ValueError('no frames to compare')
    return round(total / count, 3)


def signature(profile: dict) -> list[str]:
    """The effects that make a style its own (the keys of style-distinct.json effects), or ['any'] when its look comes
    from something every device takes (an entrance, a push, a crossfade, a step on twos)."""
    own = []
    reveal = (profile.get('typeReveal') or {}).get('kind')
    if reveal in ('typewriter', 'roll'):
        own.append(reveal)
    camera = (profile.get('camera') or {}).get('kind')
    if camera in ('zoomToFocus', 'followPen'):
        own.append(camera)
    ground = profile.get('ground') or {}
    if ground.get('texture') == 'halftone':
        own.append('halftone')
    if ground.get('kind') == 'inkDeep':
        own.append('inkDeep')
    if camera == 'push' or not own:
        own.append('any')
    return own


def touches(profile: dict, window: dict, rules: dict) -> tuple[bool, str]:
    """(True, '') when one of the style's own effects touches something in the window, else (False, why)."""
    by_obj = {o['obj']: o['device'] for o in window.get('objects') or []}
    present = {by_obj[u] for b in window.get('beats') or [] for u in b.get('uses') or [] if u in by_obj}
    own = signature(profile)
    if 'any' in own and present:
        return True, ''
    missed = []
    for effect in own:
        rule = (rules.get('effects') or {}).get(effect) or {}
        if rule.get('take') and window.get('segments'):
            return True, ''
        if rule.get('stage') and any(b.get('layout') == 'STAGE' and (b.get('plate') or {}).get('source') == 'none'
                                     for b in window.get('beats') or []):
            return True, ''
        if set(rule.get('devices') or []) & present:
            return True, ''
        need = rule.get('devices') or (['his take'] if rule.get('take') else ['a graphics-only STAGE beat'] if rule.get('stage') else ['a device'])
        missed.append(f'{effect} needs {" or ".join(need)}')
    return False, ('its effects touch no device in this window (' + '; '.join(missed) + '; the window has '
                   + (', '.join(sorted(present)) or 'no device') + ')')


def make(spec: dict, cut: str, directory: Path, props: dict, render_fn, top: int = 3, modules=None, devices=None,
         points=None, take_label: str = 'this piece\'s take', sample=None, rules: dict | None = None) -> dict:
    """Render the house look and the shortlisted styles on the proof window into <ve dir>/styles/, offer only the ones
    that look different (style-distinct.json), and write styles.json with every pair's score and every exclusion.

    `sample(clip, seconds)` returns a clip's sampled greyscale frames (ffmpeg by default; tests pass their own)."""
    from . import proof
    from .compile import MOTION_PROFILES, motion_props
    cd = _cd()
    modules = cd.motion_modules() if modules is None else modules
    rules = distinct_rules() if rules is None else rules
    frames, width, threshold = int(rules['frames']), int(rules['width']), float(rules['threshold'])
    minimum = int(rules.get('min_options', 2))
    sample = sample or (lambda clip, seconds: sample_frames(clip, seconds, frames, width))
    ranked, skipped = shortlist(spec, cut, len(modules), modules, devices, points)
    skipped = [{'module': m, 'why': why, 'reason': 'needs_device'} for m, why in skipped]
    if not ranked:
        raise ValueError('no motion style in the bank can be drawn for this piece yet: ' +
                         '; '.join(f'{s["module"]} {s["why"]}' for s in skipped))
    beat, rule = proof.hardest_beat(spec, cut, props if props.get('pieceId') == spec['piece_id'] else None)
    if beat not in [b['id'] for b in props['beats']]:
        beat = max(props['beats'], key=lambda b: (b['toFrame'] - b['fromFrame']))['id']
        rule = 'the longest beat of the stand-in take'
    start, end = proof.window(props, beat)
    folder = Path(directory) / 'styles'
    folder.mkdir(parents=True, exist_ok=True)
    window = proof.window_props(props, start, end)
    fps = props.get('fps', 30)
    seconds = (end - start) / fps
    table = load_json(MOTION_PROFILES)['profiles']
    # A style whose own effect touches nothing in this window would draw the house look: left out and named first.
    candidates = []
    for mid, why in ranked:
        profile = table.get(mid)
        hit, miss = touches(profile, window, rules) if profile else (True, '')
        if hit:
            candidates.append((mid, why))
        else:
            skipped.append({'module': mid, 'why': miss, 'reason': 'no_device_in_window'})
    # The house look on the same window: what every option must differ from.
    house_props = write_json(folder / 'props.house.json', {k: v for k, v in window.items() if k != 'motion'})
    house_clip = folder / 'house.mp4'
    house_spec = json.loads(json.dumps(spec))
    house_spec.setdefault('style', {}).pop('motion', None)
    render_fn(house_props, house_clip, house_spec)
    looks = {'house': sample(house_clip, seconds)}
    pairs: dict[tuple[str, str], float] = {}
    out_options = []
    for mid, why in candidates:
        if len(out_options) >= top:
            break
        trial = json.loads(json.dumps(spec))
        trial.setdefault('style', {})['motion'] = {'module': mid, 'reason': 'a style mock for Krish to pick from'}
        write_json(folder / f'spec.{mid}.json', trial)
        # The same window, drawn in this style: the renderer reads props.motion (compile.motion_props).
        styled = dict(window, motion=motion_props(trial))
        props_out = write_json(folder / f'props.{mid}.json', styled)
        clip = folder / f'{mid}.mp4'
        render_fn(props_out, clip, trial)
        look = sample(clip, seconds)
        scores = {other: difference(look, seen) for other, seen in looks.items()}
        for other, score in scores.items():
            pairs[(other, mid)] = score
        nearest = min(scores, key=scores.get)
        if scores[nearest] < threshold:
            skipped.append({'module': mid, 'why': f'looks like {nearest} on this window (difference {scores[nearest]:g}, '
                            f'under the {threshold:g} distinct threshold); the next ranked style takes its place',
                            'reason': 'look_alike', 'score': scores[nearest], 'like': nearest})
            continue
        looks[mid] = look
        out_options.append({'module': mid, 'name': modules[mid].get('name'), 'how': modules[mid].get('how'),
                            'why': why, 'file': f'styles/{mid}.mp4', 'sha256': sha256_file(clip),
                            'differs': {other: score for other, score in scores.items()}})
    if len(out_options) < minimum:
        raise ValueError(f'fewer than {minimum} styles look different from the house and each other on this window '
                         f'(threshold {threshold:g}): ' + '; '.join(f'{s["module"]} {s["why"]}' for s in skipped
                                                                    if s['reason'] != 'needs_device')
                         + '. Pick a window with more graphic motion, or show the options as named styles with their rules')
    doc = {'schema': 've-styles/1','piece': spec['piece_id'], 'cut': cut, 'beat': beat, 'rule': rule,
           'window': {'start': round(start / fps, 3), 'end': round(end / fps, 3)}, 'take': take_label,
           'options': out_options, 'skipped': skipped,
           'house': {'file': 'styles/house.mp4', 'sha256': sha256_file(house_clip)},
           'distinctness': {'threshold': threshold, 'frames': frames, 'width': width, 'measure': 'mean absolute greyscale difference, 0 to 255',
                            'pairs': [{'a': a, 'b': b, 'score': s} for (a, b), s in pairs.items()]},
           'distinct': True}
    if len(out_options) < top:
        doc['note'] = (f'only {len(out_options)} styles look different on this window, so {len(out_options)} are offered '
                       f'instead of {top} (the rest are named under skipped)')
    write_json(Path(directory) / 'styles.json', doc)
    return doc
