"""ve brief: one brief per plate, written by the engine, so no Codex prompt is written by hand.

A plate slot is a beat whose picture is a generated asset (plate.source "asset:<id>" with origin "generated"), or a
beat named with --beat. Its brief holds the point it lands, the line under it and its duration, the slot geometry,
the style recipe, a named move (config/ve/plate-moves.json), Krish's eight floor nevers (scripts/floor.py, in his
order), the acceptance tests, and the tool route. Codex makes 2 treatments x 4 candidates per plate; a fresh
Critic ranks the eight (it blocks only on a floor never or a failed acceptance test; the rest is an aim).

Stable interface (W3.8's weekly device sprint calls it; keep these names and arguments):
    build_briefs(spec, *, cut=None, script=None, words=None, beats=None, moves=None) -> list[dict]
    write_briefs(spec, ve_dir, *, cut=None, script=None, words=None, beats=None, moves=None) -> list[Path]
    check_candidates(brief, folder) -> dict
    python scripts/ve.py brief <piece> [--cut CUT] [--beat ID ...] [--move BEAT=MOVE ...] [--check DIR --plate ID]
Writing a brief or its card fields never dispatches Codex and never spends.
"""
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

from . import designlock
from .common import CONFIG, ROOT, load_json, write_json

SCHEMA = 've-plate-brief/1'
TREATMENTS = [
    {'id': 't1', 'idea': 'the thing the line names, shown as itself: the mechanism the voice describes'},
    {'id': 't2', 'idea': 'one story object that stands for the point, seen as a photograph would see it'},
]
CANDIDATES_PER_TREATMENT = 4
WORDS_PER_SECOND_ESTIMATE = 2.6
SIDECAR_FIELDS = ['prompt', 'model', 'date', 'candidates', 'chosen', 'credits']
CANDIDATE = re.compile(r'^(t[12])-c([1-4])\.(png|jpg|jpeg|webp)$')


def floor_nevers() -> list[dict]:
    """His eight nevers, in his order, from scripts/floor.py's reading of config/reference-cuts.json."""
    import importlib.util  # noqa: PLC0415
    spec = importlib.util.spec_from_file_location('floor', ROOT / 'scripts' / 'floor.py')
    floor = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(floor)
    bar = floor.load_bar()
    nevers = (bar or {}).get('floor', {}).get('nevers') or []
    if not nevers:
        raise ValueError('the floor has no nevers: scripts/floor.py reads none from config/reference-cuts.json')
    return [{'n': i, 'id': never['id'], 'never': never.get('never') or never.get('listed')} for i, never in enumerate(nevers, 1)]


def _geometry(lock: dict, aspect: str) -> dict:
    tall = aspect == '9:16'
    plates = lock.get('plates', {})
    min_px = plates.get('min_px', [1882, 3344])
    view = designlock.for_aspect(lock, aspect)
    caption = (view.get('zones') or {}).get('caption') if tall else designlock.WIDE_CAPTION
    return {
        'aspect': aspect,
        'canvas_px': [1080, 1920] if tall else [1920, 1080],
        'plate_min_px': list(min_px) if tall else list(reversed(min_px)),
        'keep_clear': {'caption': caption, **({'platform_right_x': 960, 'platform_bottom_y': 1640} if tall else {})},
        'calm_dark_min_pct': 35,
    }


def _move(beat: dict, duration: float | None, moves: dict, override: str | None) -> dict:
    table = moves['moves']
    name = override
    if name is None:
        rule = moves['default']
        short = duration is not None and duration <= table['push_in']['max_seconds']
        name = 'push_in' if beat['role'] in rule['push_in_roles'] and short else 'still_drift'
    if name not in table:
        raise ValueError(f'unknown move {name}: config/ve/plate-moves.json names {", ".join(table)}')
    return {'name': name, **table[name]}


def _line(script, span) -> str | None:
    if not script:
        return None
    words = [w.get('word', w.get('text')) for w in script if span['from_w'] <= w['w'] <= span['to_w']]
    return ' '.join(words) or None


def _duration(words, span) -> tuple[float | None, bool]:
    inside = [w for w in words or [] if span['from_w'] <= w['w'] <= span['to_w']]
    if inside:
        return round(max(w['end_s'] for w in inside) - min(w['onset_s'] for w in inside), 2), False
    count = span['to_w'] - span['from_w'] + 1
    return round(count / WORDS_PER_SECOND_ESTIMATE, 2), True


def slots(spec: dict, cut: str, beats=None) -> list[tuple[dict, str]]:
    """(beat, plate id) for every plate slot in the cut."""
    assets = {a['id']: a for a in spec.get('assets', [])}
    out = []
    for beat in spec['cuts'][cut]['beats']:
        source = beat.get('plate', {}).get('source', 'take')
        asset = assets.get(source[6:]) if source.startswith('asset:') else None
        if asset is not None and asset.get('origin') == 'generated':
            out.append((beat, asset['id']))
        elif beats and beat['id'] in beats:
            out.append((beat, f'{beat["id"]}-plate'))
    if beats:
        unknown = set(beats) - {b['id'] for b, _ in out}
        if unknown:
            raise ValueError(f'no such beat in cut {cut}: {", ".join(sorted(unknown))}')
    return out


def build_briefs(spec: dict, *, cut=None, script=None, words=None, beats=None, moves=None) -> list[dict]:
    cuts = [cut] if cut else list(spec['cuts'])
    lock = designlock.load()
    table = load_json(CONFIG / 'plate-moves.json')
    tools = load_json(CONFIG / 'tools.json')['tools']
    plates = lock.get('plates', {})
    nevers = floor_nevers()
    briefs = []
    for cut_id in cuts:
        aspect = spec['cuts'][cut_id]['aspect']
        for beat, plate in slots(spec, cut_id, beats):
            duration, estimated = _duration(words, beat['span'])
            geometry = _geometry(lock, aspect)
            move = _move(beat, duration, table, (moves or {}).get(beat['id']))
            generated = move['made_by'].startswith(('Runway', 'Higgsfield'))
            brief = {
                'schema': SCHEMA, 'piece': spec['piece_id'], 'cut': cut_id, 'plate': plate,
                'beat': beat['id'], 'role': beat['role'], 'layout': beat['layout'],
                'point': beat['point'],
                'line': _line(script, beat['span']), 'span': beat['span'],
                'duration_s': duration, 'duration_estimated': estimated,
                'slot': geometry,
                'style': {
                    'theme': spec.get('theme'), 'series': spec['brand']['series'],
                    'finish': spec.get('signature', {}).get('finish_pack'),
                    'must_say': plates.get('must_say', []), 'never_in_plate': plates.get('never_in_plate', []),
                    'colour': 'brand roles only (config/ve/brand-tokens.json), never hex',
                },
                'move': move,
                'floor_nevers': nevers,
                'treatments': [{**t, 'candidates': CANDIDATES_PER_TREATMENT,
                                'files': [f'{t["id"]}-c{n}.png' for n in range(1, CANDIDATES_PER_TREATMENT + 1)]}
                               for t in TREATMENTS],
                'acceptance': [
                    {'id': 'count', 'test': f'{len(TREATMENTS) * CANDIDATES_PER_TREATMENT} candidates named t1-c1 .. t2-c4'},
                    {'id': 'size', 'test': f'each at least {geometry["plate_min_px"][0]}x{geometry["plate_min_px"][1]} at {aspect}'},
                    {'id': 'sidecar', 'test': 'each has <name>.json with ' + ', '.join(SIDECAR_FIELDS)},
                    *[{'id': r, 'test': r.replace('_', ' ')} for r in plates.get('reject_by', [])],
                    {'id': 'floor', 'test': 'no candidate breaks one of the eight floor nevers (the Critic blocks on these)'},
                ],
                'route': {
                    'stills': {'tool': 'chatgpt_images', **tools['chatgpt_images']},
                    'motion': ({'tools': ['runway', 'higgsfield'], 'rule': tools['runway']['rule'],
                                'spend': 'Krish\'s yes per generation, then ve ledger <piece> add credits <n>'}
                               if generated else {'tools': [], 'rule': 'engine move: no generation'}),
                    'dispatch': 'not here: ve card writes the card from card_fields; dispatch needs the weekly budget record',
                },
                'critic': {
                    'ranks': len(TREATMENTS) * CANDIDATES_PER_TREATMENT,
                    'blocks_on': ['a floor never', 'a failed acceptance test'],
                    'orders_by': ['the point lands fastest', 'the design lock plate rules', 'the golden frames (config/ve/golden-frames.json)'],
                    'writes': f'briefs/{plate}.ranking.json',
                    'shape': {'ranking': ['t?-c?', '...'], 'blocked': [{'file': 't?-c?', 'never_or_test': 'id', 'where': 'x,y or region'}]},
                },
            }
            brief['card_fields'] = card_fields(brief)
            briefs.append(brief)
    return briefs


def card_fields(brief: dict) -> dict:
    """The fields `ve card` turns into a Codex card. Writing them never dispatches."""
    work = f'.ve-work/plates/{brief["piece"]}/{brief["plate"]}'
    nevers = '\n'.join(f'{n["n"]}. {n["never"]}' for n in brief['floor_nevers'])
    treatments = '\n'.join(f'- {t["id"]}: {t["idea"]} ({t["candidates"]} candidates: {", ".join(t["files"])})'
                           for t in brief['treatments'])
    return {
        'path': f'docs/plans/{brief["piece"]}/ve/briefs/{brief["plate"]}.card.md',
        'card_id': f'plate-{brief["piece"]}-{brief["plate"]}'[:80],
        'kind': 'plate',
        'title': f'Plate {brief["plate"]} for beat {brief["beat"]} ({brief["slot"]["aspect"]})',
        'cwd': '.',
        'write_allow': f'{work}/**',
        'read': 'docs/ve/design/TEMPLATE.md, config/ve/design-lock.json',
        'goal': (f'Make {len(brief["treatments"]) * CANDIDATES_PER_TREATMENT} still candidates for one plate. '
                 f'The point it lands: {brief["point"]}. The line under it: {brief["line"] or "(the signed script is not in the piece yet)"}. '
                 f'It plays for {brief["duration_s"]} s'
                 f'{" (estimated)" if brief["duration_estimated"] else ""}; its move is {brief["move"]["name"]}: {brief["move"]["what"]}.'),
        'contract': (f'Treatments:\n{treatments}\n\nSlot: {brief["slot"]["aspect"]}, at least '
                     f'{brief["slot"]["plate_min_px"][0]}x{brief["slot"]["plate_min_px"][1]} px; keep clear: '
                     f'{brief["slot"]["keep_clear"]}; calm dark at least {brief["slot"]["calm_dark_min_pct"]}% for type.\n'
                     f'Prompts must say: {"; ".join(brief["style"]["must_say"])}.\n'
                     f'Never in a plate: {", ".join(brief["style"]["never_in_plate"])}.\n'
                     f'The floor (never ships):\n{nevers}\n'
                     f'Write each candidate to {work}/<file> with a sidecar <file>.json holding {", ".join(SIDECAR_FIELDS)}.'),
        'acceptance': f'python scripts/ve.py brief {brief["piece"]} --cut {brief["cut"]} --plate {brief["plate"]} --check {work}',
    }


def write_briefs(spec: dict, ve_dir: Path, *, cut=None, script=None, words=None, beats=None, moves=None) -> list[Path]:
    out = []
    for brief in build_briefs(spec, cut=cut, script=script, words=words, beats=beats, moves=moves):
        folder = Path(ve_dir) / 'briefs'
        out.append(write_json(folder / f'{brief["plate"]}.brief.json', brief))
        write_json(folder / f'{brief["plate"]}.card.json', brief['card_fields'])
    return out


def _ocr_glyphs(path: Path) -> int | None:
    exe = shutil.which('tesseract')
    if not exe:
        return None
    text = subprocess.run([exe, str(path), '-', '--psm', '11'], capture_output=True, text=True, errors='replace').stdout
    return len(re.findall(r'[A-Za-z0-9]', text))


def check_candidates(brief: dict, folder: str | Path) -> dict:
    """The mechanical acceptance a candidate folder must pass before the Critic ranks it. OCR is not_run without
    tesseract; the flat-screen test and the visual checks belong to the Critic."""
    from PIL import Image  # noqa: PLC0415
    folder = Path(folder)
    want = [f for t in brief['treatments'] for f in t['files']]
    findings, rows = [], {}
    min_w, min_h = brief['slot']['plate_min_px']
    for name in want:
        stem = name.rsplit('.', 1)[0]
        found = next((p for p in folder.glob(stem + '.*') if CANDIDATE.match(p.name)), None) if folder.is_dir() else None
        row = {'file': found.name if found else None}
        if found is None:
            findings.append(f'{name}: missing')
            rows[stem] = row
            continue
        with Image.open(found) as image:
            row['px'] = list(image.size)
        if row['px'][0] < min_w or row['px'][1] < min_h:
            findings.append(f'{found.name}: {row["px"][0]}x{row["px"][1]} is under {min_w}x{min_h}')
        if abs(row['px'][0] / row['px'][1] - min_w / min_h) > 0.01:
            findings.append(f'{found.name}: not {brief["slot"]["aspect"]}')
        sidecar = found.with_name(found.name + '.json')
        if not sidecar.is_file():
            findings.append(f'{found.name}: no sidecar {sidecar.name}')
        else:
            missing = [k for k in SIDECAR_FIELDS if k not in load_json(sidecar)]
            if missing:
                findings.append(f'{sidecar.name}: missing {", ".join(missing)}')
        glyphs = _ocr_glyphs(found)
        row['ocr_glyphs'] = glyphs
        if glyphs:
            findings.append(f'{found.name}: OCR reads {glyphs} letters or digits (no text in a plate)')
        rows[stem] = row
    ocr = 'not_run' if any(r.get('ocr_glyphs') is None and r.get('file') for r in rows.values()) else 'measured'
    return {'plate': brief['plate'], 'pass': not findings, 'ocr': ocr, 'complete': ocr == 'measured', 'candidates': rows, 'findings': findings}
