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


def for_hash(gates: dict, kind: str, sha256: str | None, cut: str | None = None) -> dict | None:
    """The latest press of this gate bound to this exact file, or None. A press that names its cut (the board's
    proof press may) counts only for that cut. The board's final press binds both cuts at once in `cuts`
    ({long, short}: each file's sha256), so a final press counts when `cuts[cut]` is this file."""
    if not sha256:
        return None
    rows = []
    for row in _rows(gates.get(kind)):
        if row.get('by') != 'Krish' or (cut and row.get('cut') not in (None, cut)):
            continue
        cuts = row.get('cuts') if isinstance(row.get('cuts'), dict) else {}
        if row.get('sha256') == sha256 or (cut and cuts.get(cut) == sha256):
            rows.append(row)
    return rows[-1] if rows else None


def canonical_sha(value) -> str:
    """sha256 of canonical JSON: sorted keys, no spaces (the board's own rule)."""
    import hashlib  # noqa: PLC0415
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False)
                          .encode('utf-8')).hexdigest()


def storyboard_sha(storyboard: str, expect: str) -> str:
    """What the Sign storyboard press binds: canonical JSON {"expect", "storyboard"} of the two files' text, LF line
    endings, exactly as the files hold it. The old board's builder carried the same hash until it was retired (13 Nov 2026)."""
    lf = lambda text: str(text).replace('\r\n', '\n').replace('\r', '\n')  # noqa: E731
    return canonical_sha({'expect': lf(expect), 'storyboard': lf(storyboard)})


def final_sha(cuts: dict) -> str:
    """The board's final press hash: the file's own sha256 when one cut was shown, else canonical JSON of {cut: sha}."""
    return next(iter(cuts.values())) if len(cuts) == 1 else canonical_sha(cuts)


def write_rounds(directory: Path, rounds: int, call=None) -> str:
    """Put `rounds` on the piece's making record through the normal making write (the route refuses session writes
    to gates, never to rounds). One line for the operator; never an exception."""
    uuid = piece_uuid(directory)
    if os.environ.get('VE_GATES_OFFLINE') == '1':
        return 'rounds NOT RECORDED on the making record: VE_GATES_OFFLINE=1'
    if uuid is None:
        return 'rounds NOT RECORDED on the making record: no post.json piece_id beside the spec'
    if not isinstance(rounds, int) or not 0 <= rounds <= 99:
        return f'rounds NOT RECORDED: {rounds!r} is not a whole number from 0 to 99'
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    try:
        import making  # noqa: PLC0415
        making.post(uuid, {'rounds': rounds}, call=call)
    except Exception as error:  # noqa: BLE001 - no key, no network, a refusal: say so, the local record stands
        return f"rounds NOT RECORDED on the making record: {str(error).splitlines()[0] if str(error) else type(error).__name__}"
    return f'rounds {rounds} recorded on the making record'
