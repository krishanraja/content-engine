"""Hash-bound Critic observations, shared by status and packet gates."""
from __future__ import annotations

import math
import re
from datetime import datetime, timezone
from pathlib import Path

from .common import CONFIG, load_json, sha256_file, write_json


def ve_dir(spec_file):
    path = Path(spec_file).parent
    return path if path.name == 've' else path / 've'


def read(path):
    try:
        value = load_json(path)
        return value if isinstance(value, dict) else {}
    except (OSError, ValueError):
        return {}


def video_path(qc, directory):
    path = Path(qc.get('file') or directory / 'missing.mp4')
    return path if path.is_absolute() or path.exists() else directory / path


def number(value):
    return type(value) in (int, float) and math.isfinite(value) and value >= 0


def validate(value):
    errors = []
    required = {'schema', 'piece', 'cut', 'sha256', 'reviewer', 'reviewed_at',
                'lens_sha256', 'frames_viewed', 'findings', 'blocking'}
    # ve-verdict/2 adds `references`: the Critic's score of the cut against each inspiration-board card (refgate).
    if isinstance(value, dict) and value.get('schema') == 've-verdict/2':
        required = required | {'references'}
    if not isinstance(value, dict) or set(value) != required:
        return ['invalid verdict fields']
    if value['schema'] not in ('ve-verdict/1', 've-verdict/2'):
        errors.append('invalid verdict schema')
    if value['schema'] == 've-verdict/2':
        from .refgate import score_errors
        errors.extend(score_errors(value['references']))
    for key in ('piece', 'cut', 'reviewer', 'reviewed_at'):
        if not isinstance(value[key], str) or not value[key].strip():
            errors.append(f'{key} must be non-empty')
    if str(value['reviewer']).strip().lower() == 've':
        errors.append('reviewer must never be ve')
    try:
        timestamp = datetime.fromisoformat(value['reviewed_at'].replace('Z', '+00:00'))
        if timestamp.tzinfo is None:
            raise ValueError('timezone required')
    except (ValueError, TypeError, AttributeError):
        errors.append('reviewed_at must be an ISO timestamp with timezone')
    for key in ('sha256', 'lens_sha256'):
        if not isinstance(value[key], str) or not re.fullmatch('[0-9a-f]{64}', value[key]):
            errors.append(f'invalid {key}')
    frames = value['frames_viewed']
    if not isinstance(frames, list) or not frames or any(
            not isinstance(f, dict) or set(f) != {'at_s'} or not number(f['at_s']) for f in frames):
        errors.append('frames_viewed must be non-empty finite timestamps')
    findings = value['findings']
    if not isinstance(findings, list):
        errors.append('findings must be a list')
    else:
        for finding in findings:
            if (not isinstance(finding, dict) or set(finding) != {'severity', 'area', 'frame_s', 'text'} or
                    finding['severity'] not in ('block', 'fix', 'note') or
                    finding['area'] not in ('composition', 'brand', 'motion', 'evidence', 'copy', 'other') or
                    not number(finding['frame_s']) or not isinstance(finding['text'], str) or not finding['text'].strip()):
                errors.append('invalid finding')
        blocks = any(isinstance(f, dict) and f.get('severity') == 'block' for f in findings)
        if type(value['blocking']) is not bool or value['blocking'] != blocks:
            errors.append('blocking must equal presence of block findings')
    return errors


def viewed_every_beat(value, spec, cut, directory):
    # Spec spans are word indexes. Only compiled timings can map observations to beats.
    props = read(directory / f'props.{cut}.json')
    beats = props.get('beats', [])
    expected = spec['cuts'][cut]['beats']
    if not beats or [b.get('id') for b in beats] != [b['id'] for b in expected]:
        return False
    report = read(directory / f'compile.{cut}.json')
    if report.get('props_sha256') and report['props_sha256'] != sha256_file(directory / f'props.{cut}.json'):
        return False
    fps = props.get('fps', 30)
    if not number(fps) or fps == 0:
        return False
    frames = value.get('frames_viewed', [])
    try:
        from .qc import frame_span
        spans = [frame_span(b, fps) for b in beats]
        return all(any(first <= f['at_s'] * fps < end for f in frames) for first, end in spans)
    except (KeyError, TypeError, ValueError):
        return False


def reasons(spec, cut, directory, digest):
    path = directory / f'verdict.{cut}.json'
    if not path.exists():
        return ['no Critic verdict for this file']
    value = read(path)
    out = []
    if value.get('sha256') != digest:
        out.append('Critic verdict is for a different file')
    errors = validate(value)
    if errors:
        return out + ['invalid Critic verdict: ' + '; '.join(errors)]
    if value['piece'] != spec['piece_id'] or value['cut'] != cut:
        out.append('Critic verdict is for a different piece or cut')
    if value['lens_sha256'] != sha256_file(CONFIG / 'crew/critic.lens.md'):
        out.append('Critic verdict uses a different lens')
    if value['blocking']:
        out.append('Critic blocks: ' + next(f['text'] for f in value['findings'] if f['severity'] == 'block'))
    if not viewed_every_beat(value, spec, cut, directory):
        out.append('Critic did not view every beat')
    from .refgate import scores_problems
    out.extend(scores_problems(spec, cut, directory, value.get('references'), digest))
    return out


def write(spec, cut, directory, reviewer, findings, viewed, references=None):
    if cut not in spec['cuts']:
        raise ValueError(f'unknown cut {cut}')
    qc = read(directory / f'qc.{cut}.json')
    video = video_path(qc, directory)
    if not qc:
        raise ValueError('no qc')
    if not video.is_file() or sha256_file(video) != qc.get('sha256'):
        raise ValueError('qc is for a different file')
    if spec['cuts'][cut]['aspect'] == '9:16' and 'composition' not in qc.get('checks', {}):
        raise ValueError('missing composition row')
    from .refgate import required, sheet_is_for
    if required(spec):
        if references is None:
            raise ValueError('this spec is held to its references: give the Critic\'s reference scores (--references)')
        missing = [r['card'] for r in (spec.get('brand') or {}).get('references') or []
                   if not sheet_is_for(directory, cut, r['card'], qc.get('sha256'))]
        if missing:
            raise ValueError(f"no reference sheet for {', '.join(missing)}: run ve refs first, the Critic scores what it saw")
    value = dict(schema='ve-verdict/2' if references is not None else 've-verdict/1', piece=spec['piece_id'], cut=cut,
                 sha256=sha256_file(video), reviewer=reviewer,
                 reviewed_at=datetime.now(timezone.utc).isoformat(),
                 lens_sha256=sha256_file(CONFIG / 'crew/critic.lens.md'),
                 frames_viewed=[{'at_s': at} for at in viewed], findings=findings,
                 blocking=any(isinstance(f, dict) and f.get('severity') == 'block' for f in findings))
    if references is not None:
        value['references'] = references
    errors = validate(value)
    if errors:
        raise ValueError('; '.join(errors))
    path = write_json(directory / f'verdict.{cut}.json', value)
    if value['blocking']:
        critic_block_incident(spec, cut, directory, value)
    return path


def critic_block_incident(spec, cut, directory, value) -> str:
    """A Critic block is one engine_incidents row (the failure loop), filed once per file and finding. Never raises."""
    try:
        import sys
        from .common import ROOT
        sys.path.insert(0, str(ROOT / 'scripts'))
        import incidents  # noqa: PLC0415
        from . import preflight
        blocks = [f for f in value['findings'] if f.get('severity') == 'block']
        folder = Path(directory).parent
        if not preflight.real_piece(folder):
            return 'not filed: not a piece under docs/plans'
        receipts = list(preflight._preflight().latest(preflight._preflight().from_ledger(folder)).values())
        return incidents.record({
            'stage': 'cut', 'kind': 'critic_block', 'maker': 've', 'skill': 've',
            'piece_path': str(folder.relative_to(ROOT) if folder.is_relative_to(ROOT) else folder)[:300],
            'artifact_ref': f'verdict.{cut}.json', 'artifact_sha256': value['sha256'], 'session_ref': str(value['reviewer'])[:300],
            'preflight': receipts or None,
            'meta': {'piece': spec.get('piece_id'), 'cut': cut, 'findings': [{'area': f['area'], 'text': f['text'][:300]} for f in blocks][:10]},
            'client_ref': incidents.client_ref('critic', value['sha256'], [f['text'] for f in blocks])})
    except Exception as error:  # noqa: BLE001 - a record never stops the verdict
        return f'not filed ({type(error).__name__})'
