"""Krish picks the motion style on his own footage: `ve styles` renders the proof window once per shortlisted style.

Krish, 2026-11-04: "Can I select a visual style now that we have different style skills? Do I get shown mocks at the
right moment?" The shortlist is creative_direction.pick_motion (the one ranking); a style whose `ve_route` needs a
device that is not built is left out and named, so it never appears as an empty option. Each option is the same
window of his take with `style.motion` swapped in a copy of the spec, so he compares like with like.

Never stock footage: the window comes from this piece's own compiled props (its ingested take). With no take ingested,
`last_take` looks for the newest props of another piece in the same format, and labels the mocks as that take; with
none, it refuses.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from .common import ROOT, load_json, sha256_file, write_json

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


def make(spec: dict, cut: str, directory: Path, props: dict, render_fn, top: int = 3, modules=None, devices=None,
         points=None, take_label: str = 'this piece\'s take') -> dict:
    """Render the proof window once per shortlisted style into <ve dir>/styles/<module>.mp4 and write styles.json."""
    from . import proof
    from .compile import motion_props
    cd = _cd()
    modules = cd.motion_modules() if modules is None else modules
    options, skipped = shortlist(spec, cut, top, modules, devices, points)
    if not options:
        raise ValueError('no motion style in the bank can be drawn for this piece yet: ' +
                         '; '.join(f'{m} {why}' for m, why in skipped))
    beat, rule = proof.hardest_beat(spec, cut, props if props.get('pieceId') == spec['piece_id'] else None)
    if beat not in [b['id'] for b in props['beats']]:
        beat = max(props['beats'], key=lambda b: (b['toFrame'] - b['fromFrame']))['id']
        rule = 'the longest beat of the stand-in take'
    start, end = proof.window(props, beat)
    folder = Path(directory) / 'styles'
    folder.mkdir(parents=True, exist_ok=True)
    window = proof.window_props(props, start, end)
    fps = props.get('fps', 30)
    out_options = []
    for mid, why in options:
        trial = json.loads(json.dumps(spec))
        trial.setdefault('style', {})['motion'] = {'module': mid, 'reason': 'a style mock for Krish to pick from'}
        write_json(folder / f'spec.{mid}.json', trial)
        # The same window, drawn in this style: the renderer reads props.motion (compile.motion_props).
        styled = dict(window, motion=motion_props(trial))
        props_out = write_json(folder / f'props.{mid}.json', styled)
        clip = folder / f'{mid}.mp4'
        render_fn(props_out, clip, trial)
        out_options.append({'module': mid, 'name': modules[mid].get('name'), 'how': modules[mid].get('how'),
                            'why': why, 'file': f'styles/{mid}.mp4', 'sha256': sha256_file(clip)})
    distinct = len({o['sha256'] for o in out_options}) == len(out_options)
    doc = {'schema': 've-styles/1', 'piece': spec['piece_id'], 'cut': cut, 'beat': beat, 'rule': rule,
           'window': {'start': round(start / fps, 3), 'end': round(end / fps, 3)}, 'take': take_label,
           'options': out_options, 'skipped': [{'module': m, 'why': why} for m, why in skipped], 'distinct': distinct}
    if not distinct:
        doc['note'] = ('two or more clips came out identical: the window may hold nothing a style moves (no graphic '
                       'beat). Pick a window with a graphic beat, or show the options as named styles with their rules')
    write_json(Path(directory) / 'styles.json', doc)
    return doc
