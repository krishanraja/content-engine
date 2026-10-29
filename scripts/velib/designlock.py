"""Approved design direction and hash-bound golden keyframes for ve formats."""
from __future__ import annotations

import io
import json
import math
from datetime import date
from pathlib import Path

from PIL import Image

from .common import ROOT, load_json, sha256_file

WIDE = '@16:9'
WIDE_CANVAS = {'w': 1920, 'h': 1080}
# boxFor('caption') on the wide canvas (apps/renderer/src/engine/geometry.ts), as QC's caption OCR reads it.
WIDE_CAPTION = {'x': 260, 'y': 773, 'w': 1400, 'h': 187}
GATES = ['design_lock', 'composition_qc', 'keyframe_match', 'mechanical_qc',
         'critic_verdict', 'packet', 'krish_final_hash']


def _path(path=None) -> Path:
    return ROOT / (Path(path) if path is not None else Path('config/ve/design-lock.json'))


def load(path=None) -> dict:
    return load_json(_path(path))


def _number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _under(root: Path, filename: str) -> Path:
    path = (root / filename).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError(f'path must be under root: {filename}')
    return path


def validate(lock, root=None) -> list[str]:
    root = Path(root) if root is not None else ROOT
    out = []
    if not isinstance(lock, dict):
        return ['design lock must be an object']
    if lock.get('schema') != 'design-lock/1':
        out.append('schema must be design-lock/1')
    if lock.get('status') not in ('direction_approved', 'frozen'):
        out.append('status must be direction_approved or frozen')
    canvas = lock.get('canvas', {})
    if any(canvas.get(k) != v for k, v in (('w', 1080), ('h', 1920), ('fps', 30))):
        out.append('canvas must be 1080x1920 at 30 fps')
    zones = lock.get('zones', {})
    for name, zone in zones.items():
        if isinstance(zone, dict) and all(k in zone for k in ('x', 'y', 'w', 'h')):
            if (not all(_number(zone[k]) for k in ('x', 'y', 'w', 'h')) or
                    zone['x'] < 0 or zone['y'] < 0 or zone['w'] <= 0 or zone['h'] <= 0 or
                    zone['x'] + zone['w'] > 1080 or zone['y'] + zone['h'] > 1920):
                out.append(f'zones.{name} must lie inside canvas')
        elif isinstance(zone, dict):
            for key, value in zone.items():
                limit = 1080 if key.endswith('_x') else 1920 if key.endswith('_y') else None
                if limit is None or not _number(value) or not 0 <= value <= limit:
                    out.append(f'zones.{name}.{key} must lie inside canvas')
        elif not _number(zone) or not 0 <= zone <= (1080 if name.endswith('_x') else 1920):
            out.append(f'zones.{name} must lie inside canvas')
    try:
        tokens = load_json(root / 'config/ve/brand-tokens.json')
    except (OSError, ValueError) as error:
        out.append(f'brand-tokens.json: {error}')
        tokens = {}
    caption = zones.get('caption', {})
    if caption.get('y') != 1180:
        out.append('zones.caption.y must equal 1180')
    bottom = tokens.get('geometry', {}).get('caption_block_bottom_max_y')
    if (not _number(caption.get('y')) or not _number(caption.get('h')) or
            caption['y'] + caption['h'] != bottom):
        out.append('zones.caption bottom must equal geometry.caption_block_bottom_max_y')
    thresholds = lock.get('thresholds', {})
    for key, lo, hi in (('min_text_px', 24, 48), ('fill_min_pct', 50, 100), ('keyframe_ssim_min', 0.5, 1)):
        value = thresholds.get(key)
        if not _number(value) or not lo <= value <= hi:
            out.append(f'thresholds.{key} must be a number in {lo}..{hi}')
    size = thresholds.get('keyframe_compare_size')
    if not isinstance(size, list) or len(size) != 2 or any(type(v) is not int or v <= 0 for v in size):
        out.append('thresholds.keyframe_compare_size must contain two positive integers')
    for key, value in (('stroke_px', 8), ('keyline_px', 16)):
        if lock.get('scribble', {}).get(key) != value:
            out.append(f'scribble.{key} must equal {value}')
    for role, settings in lock.get('type_roles', {}).items():
        if settings.get('family') not in tokens.get('type_roles', {}):
            out.append(f'type_roles.{role}.family is unknown: {settings.get("family")}')
    if lock.get('gates') != GATES:
        out.append('gates must equal the required ordered design approval gates')
    formats = lock.get('formats', {})
    if not formats:
        out.append('formats must not be empty')
    for fmt, settings in formats.items():
        if settings.get('aspect', '9:16') == '16:9' and (not fmt.endswith(WIDE) or settings.get('canvas') != WIDE_CANVAS):
            out.append(f'formats.{fmt}: a 16:9 entry is named <format>{WIDE} and its canvas is 1920x1080')
        beats = settings.get('beats')
        if (not isinstance(beats, list) or not beats or
                any(not isinstance(b, str) or not b for b in beats) or len(set(beats)) != len(beats)):
            out.append(f'formats.{fmt}.beats must be a non-empty list of unique beat names')
        for key in ('anatomy', 'motion'):
            try:
                filename = settings.get(key)
                if not filename or not _under(root, filename).is_file():
                    out.append(f'formats.{fmt}.{key} file is missing: {filename}')
            except (ValueError, TypeError) as error:
                out.append(f'formats.{fmt}.{key}: {error}')
    return out


def golden_path(lock, fmt, beat, root=None) -> Path:
    settings = lock['formats'][fmt]
    entry = settings.get('keyframes', {}).get(beat, {})
    filename = entry.get('file') or str(Path(settings['frames_dir']) / f'{beat}.jpg')
    return _under(Path(root) if root is not None else ROOT, filename)


def frozen(lock, fmt, root=None) -> tuple[bool, list[str]]:
    settings = lock.get('formats', {}).get(fmt)
    if settings is None:
        return False, [f'unknown format {fmt}']
    beats = settings.get('beats', [])
    frames = settings.get('keyframes', {})
    reasons = []
    if not beats or not isinstance(frames, dict) or set(frames) != set(beats):
        reasons.append(f'{fmt}: keyframes must have exactly one entry per beat')
    if isinstance(frames, dict):
        for beat, entry in frames.items():
            if not isinstance(entry, dict) or not entry.get('file') or not entry.get('sha256'):
                reasons.append(f'{fmt}.{beat}: keyframe file and sha256 are required')
                continue
            try:
                path = golden_path(lock, fmt, beat, root)
                if not path.is_file():
                    reasons.append(f'{fmt}.{beat}: missing keyframe file {entry["file"]}')
                elif sha256_file(path) != entry['sha256']:
                    reasons.append(f'{fmt}.{beat}: keyframe sha256 mismatch')
            except (OSError, ValueError, TypeError) as error:
                reasons.append(f'{fmt}.{beat}: {error}')
    return not reasons, reasons


def spend_from_budget(record, *, lock_path=None) -> dict:
    """The design lock's per-generation consent becomes the weekly cap (plan Wave 2, W2.6): plates' animation spend
    is whatever Control Center's credit read covers (Krish, 2026-10-29: credits are "handled by ai-harness and
    control-center"), bound to that read's hash. The caller checks the record stands first; nothing else is written."""
    path = _path(lock_path).resolve()
    lock = load(path)
    animation = lock['plates']['animation']
    animation['spend_needs'] = 'within the credit caps Control Center places on the publication (ve budget pull); ve ledger reserve before each generation'
    animation.pop('spend_signed', None)
    animation['spend_source'] = {'source': record['source'], 'engine_id': record['engine_id'], 'pulled_on': record['pulled_on'],
                                 'record_sha256': record['record_sha256'],
                                 'ruling': 'Krish, 2026-10-29: "this is now handled by ai-harness and control-center"'}
    path.write_text(json.dumps(lock, indent=2) + '\n', encoding='utf-8')
    return lock


def freeze(fmt, src_dir, mapping, *, lock_path=None, force=False, today=None) -> dict:
    path = _path(lock_path).resolve()
    root = path.parents[2] if path.parent.name == 've' and path.parent.parent.name == 'config' else path.parent
    lock = load(path)
    drafts = lock.get('drafts', {})
    if fmt not in lock['formats'] and fmt not in drafts:
        raise ValueError(f'unknown format {fmt}')
    settings = lock['formats'][fmt] if fmt in lock['formats'] else _promoted(drafts[fmt])
    beats = settings['beats']
    if set(mapping) != set(beats):
        raise ValueError(f'mapping must cover every beat of {fmt} exactly: {", ".join(beats)}')
    if settings.get('keyframes') and not force:
        raise ValueError(f'{fmt} already has keyframes; use --force to replace them')
    size = tuple(settings.get('compare_size') or lock['thresholds']['keyframe_compare_size'])
    canvas = settings.get('canvas') or lock.get('canvas') or {'w': 1080, 'h': 1920}
    prepared = []
    # Check all inputs before writing any golden file or changing the lock.
    for beat in beats:
        filename = mapping[beat]
        source = _under(Path(src_dir), filename)
        target = _under(root, str(Path(settings['frames_dir']) / f'{beat}.jpg'))
        if target.exists() and not force:
            raise ValueError(f'{target} already exists; use --force to replace it')
        with Image.open(source) as image:
            if image.size != (canvas['w'], canvas['h']):
                raise ValueError(f'{filename}: expected {canvas["w"]}x{canvas["h"]}, got {image.width}x{image.height}')
            output = io.BytesIO()
            image.convert('RGB').resize(size, Image.Resampling.LANCZOS).save(output, format='JPEG', quality=85)
        prepared.append((beat, target, output.getvalue(), sha256_file(source)))
    entries = {}
    for beat, target, data, source_hash in prepared:
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        entries[beat] = {'file': target.relative_to(root).as_posix(), 'sha256': sha256_file(target),
                         'source_sha256': source_hash, 'size': list(size)}
    settings['keyframes'] = entries
    if fmt not in lock['formats']:
        # Gate 2: the draft becomes a lock, and the formats it names become modules inside it.
        lock['formats'][fmt] = settings
        del drafts[fmt]
        if not drafts:
            lock.pop('drafts', None)
        for module in settings.get('modules', []):
            if module in lock['formats']:
                lock['formats'][module]['role'] = 'module'
    settings['frozen_on'] = (today or date.today()).isoformat() if not isinstance(today, str) else date.fromisoformat(today).isoformat()
    lock['status'] = 'frozen' if all(frozen(lock, name, root)[0] for name in lock['formats']) else 'direction_approved'
    path.write_text(json.dumps(lock, indent=2) + '\n', encoding='utf-8')
    return lock


def lock_key(fmt: str, aspect: str) -> str:
    """The lock entry for a format at an aspect: the format itself for 9:16, <format>@16:9 for the wide canvas."""
    return fmt if aspect == '9:16' else f'{fmt}{WIDE}'


def _promoted(entry: dict) -> dict:
    """A draft as it enters formats at Gate 2: its slots and waiting status stay behind."""
    return {k: v for k, v in entry.items() if k not in ('status', 'keyframe_slots', 'awaiting', 'drafted')}


def for_aspect(lock: dict, aspect: str) -> dict:
    """The lock as one aspect sees it, so lint, QC and packets read wide entries under their plain format names.

    9:16 is the lock as written, less any wide entries. 16:9 holds only the wide entries, renamed to their format,
    with the wide canvas, the wide caption zone and the wide comparison size."""
    view = dict(lock)
    if aspect == '9:16':
        view['formats'] = {k: v for k, v in lock.get('formats', {}).items() if not k.endswith(WIDE)}
        return view
    wide = {k[:-len(WIDE)]: v for k, v in lock.get('formats', {}).items() if k.endswith(WIDE)}
    view['formats'] = wide
    view['canvas'] = {**lock.get('canvas', {}), **WIDE_CANVAS}
    view['zones'] = {'caption': WIDE_CAPTION}
    sizes = {tuple(v['compare_size']) for v in wide.values() if v.get('compare_size')}
    view['thresholds'] = {**lock.get('thresholds', {}),
                          'keyframe_compare_size': list(sizes.pop()) if len(sizes) == 1 else [960, 540]}
    return view


def draft(fmt: str, aspect: str, beats: list[str], *, anatomy: str, motion: str, modules=(), role='base',
          purpose: str = '', lock_path=None, today=None) -> dict:
    """Write an unfrozen lock entry under drafts: its beats, an empty key-frame slot per beat, and the modules it
    will hold. Only `ve lock freeze` (Krish's Gate 2, with his approved stills) turns a draft into a lock."""
    path = _path(lock_path).resolve()
    lock = load(path)
    if aspect not in ('9:16', '16:9'):
        raise ValueError('aspect is 9:16 or 16:9')
    key = lock_key(fmt, aspect)
    if key in lock['formats']:
        raise ValueError(f'{key} is already a lock; a draft never replaces one')
    if not beats or len(set(beats)) != len(beats) or any(not isinstance(b, str) or not b for b in beats):
        raise ValueError('a draft needs unique beat names')
    unknown = [m for m in modules if m not in lock['formats']]
    if unknown:
        raise ValueError(f'modules must be existing locks: {", ".join(unknown)}')
    root = path.parents[2] if path.parent.name == 've' and path.parent.parent.name == 'config' else path.parent
    for filename in (anatomy, motion):
        if not _under(root, filename).is_file():
            raise ValueError(f'missing design file {filename}')
    wide = aspect == '16:9'
    entry = {
        'role': role, 'aspect': aspect, 'status': 'awaiting Gate 2',
        'drafted': today or date.today().isoformat(),
        'awaiting': f"Krish's Gate 2 approval of one still per beat; then ve lock freeze {key} --from <stills dir>",
        'purpose': purpose, 'beats': list(beats), 'modules': list(modules),
        'frames_dir': f'fixtures/ve/design-lock/{fmt}' + ('-wide' if wide else ''),
        'anatomy': anatomy, 'motion': motion,
        'keyframe_slots': {beat: None for beat in beats},
    }
    if wide:
        entry.update(canvas=dict(WIDE_CANVAS), compare_size=[960, 540])
    lock.setdefault('drafts', {})[key] = entry
    path.write_text(json.dumps(lock, indent=2) + '\n', encoding='utf-8')
    return entry
