"""Approved design direction and hash-bound golden keyframes for ve formats."""
from __future__ import annotations

import io
import json
import math
from datetime import date
from pathlib import Path

from PIL import Image

from .common import ROOT, load_json, sha256_file

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
    """The design lock's per-generation consent becomes Krish's signed weekly cap (plan Wave 2, W2.6): plates'
    animation spend is then whatever the weekly credit budget he signed covers, in his words and bound to its hash.
    The caller checks the record stands (velib/credits.verify) first; this writes nothing else in the lock."""
    path = _path(lock_path).resolve()
    lock = load(path)
    animation = lock['plates']['animation']
    signed = record['signed']
    animation['spend_needs'] = 'within the weekly credit budget Krish signed (config/ve/credit-budget.json); ve ledger reserve before each generation'
    animation['spend_signed'] = {'by': signed['by'], 'said': signed['said'], 'on': signed['on'],
                                 'record_sha256': signed['record_sha256']}
    path.write_text(json.dumps(lock, indent=2) + '\n', encoding='utf-8')
    return lock


def freeze(fmt, src_dir, mapping, *, lock_path=None, force=False, today=None) -> dict:
    path = _path(lock_path).resolve()
    root = path.parents[2] if path.parent.name == 've' and path.parent.parent.name == 'config' else path.parent
    lock = load(path)
    if fmt not in lock['formats']:
        raise ValueError(f'unknown format {fmt}')
    settings = lock['formats'][fmt]
    beats = settings['beats']
    if set(mapping) != set(beats):
        raise ValueError(f'mapping must cover every beat of {fmt} exactly: {", ".join(beats)}')
    if settings.get('keyframes') and not force:
        raise ValueError(f'{fmt} already has keyframes; use --force to replace them')
    size = tuple(lock['thresholds']['keyframe_compare_size'])
    prepared = []
    # Check all inputs before writing any golden file or changing the lock.
    for beat in beats:
        filename = mapping[beat]
        source = _under(Path(src_dir), filename)
        target = _under(root, str(Path(settings['frames_dir']) / f'{beat}.jpg'))
        if target.exists() and not force:
            raise ValueError(f'{target} already exists; use --force to replace it')
        with Image.open(source) as image:
            if image.size != (1080, 1920):
                raise ValueError(f'{filename}: expected 1080x1920, got {image.width}x{image.height}')
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
    settings['frozen_on'] = (today or date.today()).isoformat() if not isinstance(today, str) else date.fromisoformat(today).isoformat()
    lock['status'] = 'frozen' if all(frozen(lock, name, root)[0] for name in lock['formats']) else 'direction_approved'
    path.write_text(json.dumps(lock, indent=2) + '\n', encoding='utf-8')
    return lock
