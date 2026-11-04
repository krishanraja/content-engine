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
    aspect = spec['cuts'][cut]['aspect']
    lock = designlock.for_aspect(designlock.load(), aspect)
    locked = spec['format'] in lock.get('formats', {})
    frozen = locked and designlock.frozen(lock, spec['format'])[0]
    # Composition zones are 9:16 only. Key frames apply to a wide cut once its format has a frozen <format>@16:9
    # lock; until then both rows are not applicable to it (QC says so itself) and the Critic is the design gate.
    tall = aspect == '9:16'
    for name, applies in (('composition', tall), ('keyframe_match', frozen)):
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
    # From MOTION_FROM every format's whole cut stands on a moving proof he approved (F04, F13; velib/proof.py), the
    # same check ve render makes before it renders the cut.
    from . import gates, proof
    if proof.required(spec, cut):
        found = gates.load(directory, spec)
        props = verdict.read(Path(directory) / f'props.{cut}.json') or None
        out.extend(proof.problems(spec, cut, directory, found['gates'], props))
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
        if legacy_ok and spec['format'] not in designlock.load()['formats']:
            errors.insert(0, 'LEGACY: no design lock')
        raise ValueError('\n'.join(errors))
    out = Path(out)
    if out.exists():
        raise ValueError(f'packet destination already exists: {out}')
    # Build away from the destination. Decode/copy failures cannot leave a partial packet.
    stage = Path(tempfile.gettempdir()) / ('ve-packet-stage-' + uuid.uuid4().hex)
    stage.mkdir()
    try:
        round_number, commit_round = count_round(spec, directory, prepared)
        lines = ['# Approval packet', '', APPROVAL_LINE, '', '## In short',
                 *(f'- {line}' for line in in_short(spec, directory, prepared, round_number)), '']
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
            lines += reference_lines(spec, cut, directory, stage)
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
        commit_round()
    finally:
        shutil.rmtree(stage)
    return out


SHORT_LINES = 10
RECORD = 'packet.record.json'


def count_round(spec, directory, prepared):
    """(rounds, commit): `rounds` on the local packet record, one more each time a packet carries a whole cut file he
    has not been sent before (a re-packet of the same file is not a new round). commit() writes it once the packet is
    built. The board shows it; "one round" is earned by it."""
    path = Path(directory) / RECORD
    record = verdict.read(path) or {'schema': 've-packet-record/1', 'rounds': 0, 'sent': []}
    sent = set(record.get('sent') or [])
    new = [digest for cut, _qc, _video, digest in prepared
           if not spec['cuts'][cut].get('excerpt', False) and digest and digest not in sent]
    if new:
        record = dict(record, rounds=int(record.get('rounds') or 0) + 1, sent=sorted(sent | set(new)))

    def commit():
        if new:
            from .common import write_json
            write_json(path, record)
    return int(record.get('rounds') or 0), commit


def rounds(directory) -> int:
    return int(verdict.read(Path(directory) / RECORD).get('rounds') or 0)


def _one_line(text, limit=110):
    first = str(text).strip().split('\n')[0].split('. ')[0].rstrip('.')
    return first if len(first) <= limit else first[:limit - 3].rstrip() + '...'


def in_short(spec, directory, prepared, rounds=None) -> list[str]:
    """At most ten plain lines above the measurements: the round, the proof and what changed since, each advisory, each
    Critic note in one line, and what the cut will and won't do (velib/expect.py)."""
    from . import expect, gates, proof
    found = gates.load(directory, spec)['gates']
    out = [] if rounds is None else [f'Round {rounds}: full cuts sent to Krish for this piece, this one included']
    for cut, qc, _video, _digest in prepared:
        out.append('Proof: ' + proof.summary(spec, cut, directory, found))
        for name, row in ((qc or {}).get('checks') or {}).items():
            if row.get('status') == 'advisory':
                value = row.get('value')
                count = value.get('count') if isinstance(value, dict) else None
                out.append(f'{cut}: advisory {name}' + (f' ({count} found; listed, not held)' if count is not None
                                                         else ' (listed, not held)'))
        for finding in verdict.read(Path(directory) / f'verdict.{cut}.json').get('findings') or []:
            if finding.get('severity') in ('fix', 'note'):
                out.append(f"{cut}: Critic {finding['severity']} at {finding['frame_s']} s: {_one_line(finding['text'])}")
    out += expect.lines(spec, directory)
    if len(out) > SHORT_LINES:
        out = out[:SHORT_LINES - 1] + [f'and {len(out) - SHORT_LINES + 1} more: see each cut below']
    return out


def reference_lines(spec, cut, directory, stage):
    """Each board card beside the cut, with the Critic's score: Krish sees what it was held to."""
    from . import refgate
    refs = (spec.get('brand') or {}).get('references') or []
    if not refs:
        return []
    scores = {row['card']: row for row in verdict.read(Path(directory) / f'verdict.{cut}.json').get('references') or []}
    lines = ['### Against its references']
    for ref in refs:
        source = refgate.sheet_path(directory, cut, ref['card'])
        if not source.is_file():
            raise ValueError(f"{cut}: no reference sheet for {ref['card']}")
        shutil.copyfile(source, stage / source.name)
        row = scores.get(ref['card'], {})
        lines += [f"- {ref['card']} ({', '.join(ref['for'])}): {ref['takeaway']}",
                  f"  Critic: {row.get('score', 'unscored')}/10, {row.get('note', 'no note')} ({source.name})"]
    proof_sheet = refgate.sheet_path(directory, cut, refgate.PROOF_CARD)
    if proof_sheet.is_file():
        shutil.copyfile(proof_sheet, stage / proof_sheet.name)
        row = scores.get(refgate.PROOF_CARD, {})
        lines += ['- the moving proof Krish approved',
                  f"  Critic: {row.get('score', 'unscored')}/10, {row.get('note', 'no note')} ({proof_sheet.name})"]
    return lines + ['']


def readiness(spec, cut, directory) -> dict:
    """What `ve status` and `ve file` both ask of a cut: mechanical, design and Krish's final approval of the file."""
    try:
        reasons, _qc, video, digest = mechanical(spec, cut, directory)
        compile_file = Path(directory) / f'compile.{cut}.json'
        if compile_file.exists() and verdict.read(compile_file).get('sfx_missing') and 'sfx kit missing' not in reasons:
            reasons.append('sfx kit missing')
        design_reasons = design(spec, cut, directory, digest)
        # His Approve cut press on the making record (gates.final, cuts[cut] = this file's sha256), or the spec's own
        # final approval of this exact file; the record wins (velib/gates.py).
        from . import gates
        final = [] if gates.for_hash(gates.load(directory, spec)['gates'], 'final', digest, cut) else [
            'no final approval from Krish for this file']
    except (OSError, ValueError, KeyError, TypeError) as error:
        return {'mechanical': [str(error)], 'design': ['design could not be checked'], 'final': [],
                'video': None, 'digest': None}
    return {'mechanical': reasons, 'design': design_reasons, 'final': final, 'video': video, 'digest': digest}
