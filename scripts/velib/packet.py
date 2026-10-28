"""Preflight every cut before assembling an approval packet."""
from __future__ import annotations

import shutil
import subprocess
import tempfile
import uuid
from pathlib import Path

from . import designlock, verdict
from .common import ffmpeg, sha256_file

APPROVAL_LINE = "Not yet approved: design and final, both Krish's, both by exact file hash."


def first_finding(qc, name, row):
    findings = row.get('findings') or qc.get(name, {}).get('findings') or []
    return str(findings[0]) if findings else str(row.get('reason') or row.get('value') or 'no passing measurement')


def mechanical(spec, cut, directory):
    qc = verdict.read(directory / f'qc.{cut}.json')
    video = verdict.video_path(qc, directory)
    digest = sha256_file(video) if video.is_file() else None
    out = []
    if verdict.read(directory / f'compile.{cut}.json').get('sfx_missing'):
        out.append('sfx kit missing')
    if not qc:
        out.append('no qc')
    else:
        if digest is None or digest != qc.get('sha256'):
            out.append('qc is for a different file')
        if qc.get('measured_pass') is not True:
            out.append('measured checks fail')
        if qc.get('complete') is not True:
            out.append('qc incomplete')
    lock = designlock.load()
    locked = spec['format'] in lock.get('formats', {})
    frozen = locked and designlock.frozen(lock, spec['format'])[0]
    for name, applies in (('composition', spec['cuts'][cut]['aspect'] == '9:16'),
                          ('keyframe_match', frozen)):
        row = qc.get('checks', {}).get(name)
        if row is None and applies:
            out.append(f'{name} fails: missing row')
        elif row is not None and (applies or row.get('status') != 'not applicable') and (row.get('pass') is not True or row.get('status') in ('not_run', 'not applicable', 'incomplete', 'error')):
            out.append(f'{name} fails: ' + first_finding(qc, name, row))
    return out, qc, video, digest


def design(spec, cut, directory, digest, *, legacy_ok=False, packet=False):
    lock = designlock.load()
    fmt = spec['format']
    out = []
    if fmt in lock.get('formats', {}):
        if not designlock.frozen(lock, fmt)[0]:
            out.append(f'format {fmt} has no frozen design lock')
    elif packet:
        if not legacy_ok:
            out.append(f'format {fmt} has no frozen design lock')
    elif not any(a.get('gate') == 'proof' and a.get('artifact_hash') == digest and a.get('by') == 'Krish'
                 for a in spec.get('approvals', [])):
        out.append("legacy format: needs Krish's proof approval of this exact file")
    return out + verdict.reasons(spec, cut, directory, digest)


def contact_sheet(video, duration, target):
    if not verdict.number(duration) or duration <= 0:
        raise ValueError('contact sheet needs a measured positive duration')
    subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-i', str(video),
                    '-vf', f'fps=8/{duration},scale=270:-2,tile=4x2',
                    '-frames:v', '1', str(target)], check=True, capture_output=True)
    if not target.is_file():
        raise ValueError('contact sheet was not created')


def measurement_lines(node, prefix=''):
    if isinstance(node, dict):
        for key, value in node.items():
            yield from measurement_lines(value, f'{prefix}.{key}' if prefix else key)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from measurement_lines(value, f'{prefix}[{index}]')
    else:
        yield f'- {prefix}: {node}'


def assemble(spec, directory, out, legacy_ok=()):
    unknown = set(legacy_ok) - set(spec['cuts'])
    errors = [f'unknown legacy cut {cut}' for cut in sorted(unknown)]
    prepared = []
    for cut in spec['cuts']:
        mechanical_reasons, qc, video, digest = mechanical(spec, cut, directory)
        design_reasons = design(spec, cut, directory, digest, legacy_ok=cut in legacy_ok, packet=True)
        errors.extend(f'{cut}: {reason}' for reason in mechanical_reasons + design_reasons)
        prepared.append((cut, qc, video, digest))
    if errors:
        raise ValueError('\n'.join(errors))
    out = Path(out)
    if out.exists():
        raise ValueError(f'packet destination already exists: {out}')
    # Build away from the destination. Decode/copy failures cannot leave a partial packet.
    stage = Path(tempfile.gettempdir()) / ('ve-packet-stage-' + uuid.uuid4().hex)
    stage.mkdir()
    try:
        lines = ['# Approval packet', '', APPROVAL_LINE, '']
        for cut, qc, video, digest in prepared:
            lines += [f'## {cut}', f'SHA-256: {digest}', '']
            if cut in legacy_ok and spec['format'] not in designlock.load()['formats']:
                lines += ['LEGACY: no design lock', '']
            shutil.copyfile(video, stage / f'{cut}.mp4')
            if sha256_file(stage / f'{cut}.mp4') != digest:
                raise ValueError(f'{cut}: video changed during packet assembly')
            for kind in ('qc', 'verdict'):
                shutil.copyfile(directory / f'{kind}.{cut}.json', stage / f'{kind}.{cut}.json')
            contact_sheet(video, qc.get('duration_s'), stage / f'contact.{cut}.jpg')
            lines += ['### Measurements', *measurement_lines(qc.get('checks', {})),
                      *measurement_lines(qc.get('composition', {}), 'composition'),
                      *measurement_lines(qc.get('keyframes', {}), 'keyframes'), '', '### Critic findings']
            value = verdict.read(directory / f'verdict.{cut}.json')
            for finding in value['findings']:
                if finding['severity'] in ('fix', 'note'):
                    lines += [f"{finding['severity']} at {finding['frame_s']} s ({finding['area']}):", finding['text'], '']
            lines += ['### Anything not measured',
                      '- Design judgment and final approval are not mechanical measurements.']
            for name, row in qc.get('checks', {}).items():
                if row.get('status') in ('not_run', 'not applicable', 'incomplete') or row.get('pass') is None:
                    lines.append(f'- {name}: {row.get("status", "not measured")}')
            lines.append('')
        (stage / 'PACKET.md').write_text('\n'.join(lines) + '\n', encoding='utf-8')
        out.parent.mkdir(parents=True, exist_ok=True)
        shutil.copytree(stage, out)
    finally:
        shutil.rmtree(stage)
    return out
