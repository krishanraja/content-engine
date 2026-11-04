"""Krish's gate presses for a piece, as ve reads them (plan 2026-11-04, "one production round").

The board's presses write each gate to the piece's making record, `content_ideas.meta.making.gates`, read through the
existing making route (GET /api/content-ideas/<id>/making):

    gates.storyboard = {by: 'Krish', at, sha256}                      # the storyboard and expectations text shown
    gates.style      = {by: 'Krish', at, sha256, module, reason}      # styles.json shown; module null = none of these
    gates.proof      = {by: 'Krish', at, sha256, verdict, words?}     # sha256 of proof/<cut>.mp4; approve or reject
    gates.final      = {by: 'Krish', at, sha256}                      # sha256 of the cut file

The spec's own `approvals` (the local record the packet has always read: gate proof or final, by Krish, bound to an
artifact_hash) are read into the same shape, so offline tests and existing flows keep working. The record wins when
both hold the same gate. A gate may be one object or a list of them (one per cut); `for_hash` finds the one bound to
a given file.

The record is read only when the piece folder names its content_ideas uuid (post.json "piece_id") and the engine
answers; otherwise `source` says NOT CHECKED, in those words, and only the local approvals count.
"""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

from .common import ROOT

KINDS = ('storyboard', 'style', 'proof', 'final')
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
TIMEOUT_S = 20


def _rows(value) -> list[dict]:
    if isinstance(value, dict):
        return [value]
    if isinstance(value, list):
        return [row for row in value if isinstance(row, dict)]
    return []


def from_approvals(spec: dict) -> dict:
    """The spec's approvals in the gates shape (proof and final only: the spec schema has no storyboard or style gate)."""
    out: dict[str, list] = {}
    for a in spec.get('approvals') or []:
        if not isinstance(a, dict) or a.get('by') != 'Krish' or a.get('gate') not in ('proof', 'final'):
            continue
        row = {'by': 'Krish', 'at': a.get('on'), 'sha256': a.get('artifact_hash'), 'words': a.get('said'), 'source': 'spec'}
        if a['gate'] == 'proof':
            row['verdict'] = 'approve'
        out.setdefault(a['gate'], []).append(row)
    return out


def piece_uuid(directory: Path) -> str | None:
    """The content_ideas uuid of the piece whose ve folder this is: post.json "piece_id" in the plan folder."""
    directory = Path(directory)
    for folder in (directory, directory.parent):
        post = folder / 'post.json'
        if post.is_file():
            try:
                value = json.loads(post.read_text(encoding='utf-8-sig')).get('piece_id')
            except (OSError, ValueError, AttributeError):
                return None
            return value if isinstance(value, str) and UUID.match(value) else None
    return None


def _engine_call(method: str, path: str, body=None):
    sys.path.insert(0, str(ROOT / 'scripts'))
    import engine  # noqa: PLC0415
    token = engine.operator_key()
    return engine.call(method, path, body, token=token, timeout=TIMEOUT_S)


def from_record(uuid: str, call=None) -> dict:
    """gates from the making record; raises LookupError with the reason when it cannot be read."""
    try:
        status, text = (call or _engine_call)('GET', f'/api/content-ideas/{uuid}/making', None)
    except Exception as error:  # noqa: BLE001 - no key, no network, a timeout: all mean NOT CHECKED
        raise LookupError(str(error).splitlines()[0] if str(error) else type(error).__name__) from error
    if status != 200:
        raise LookupError(f'the engine answered {status}')
    try:
        data = json.loads(text) if isinstance(text, str) else text
    except ValueError as error:
        raise LookupError('the engine answered with something that is not JSON') from error
    making = data.get('making') if isinstance(data, dict) else None
    gates = making.get('gates') if isinstance(making, dict) else None
    return gates if isinstance(gates, dict) else {}


def load(directory: Path, spec: dict, call=None) -> dict:
    """{'gates': {kind: [rows]}, 'source': 'record' | 'NOT CHECKED: <why>' | 'local only'}: the record wins per gate."""
    local = from_approvals(spec)
    uuid = piece_uuid(directory)
    if os.environ.get('VE_GATES_OFFLINE') == '1':
        return {'gates': local, 'source': 'NOT CHECKED: VE_GATES_OFFLINE=1'}
    if uuid is None and call is None:
        return {'gates': local, 'source': 'local only (no post.json piece_id beside the spec)'}
    try:
        record = from_record(uuid or '', call)
    except LookupError as error:
        return {'gates': local, 'source': f'NOT CHECKED: {error}'}
    merged = dict(local)
    for kind in KINDS:
        rows = [dict(row, source='record') for row in _rows(record.get(kind)) if row.get('by') == 'Krish']
        if rows:
            merged[kind] = rows
    return {'gates': merged, 'source': 'record'}


def for_hash(gates: dict, kind: str, sha256: str | None) -> dict | None:
    """The latest press of this gate bound to this exact file, or None."""
    if not sha256:
        return None
    rows = [row for row in _rows(gates.get(kind)) if row.get('sha256') == sha256 and row.get('by') == 'Krish']
    return rows[-1] if rows else None
