"""The preflight gate on ve brief and ve render (the failure loop; Krish, 2026-11-04: trace a repeat back to why it kept
happening, "the session did not check in on a specific skill or standard before starting").

From PREFLIGHT_FROM (pieces published on or after 9 Nov 2026, the same dated rule as the motion gates), ve brief and ve
render refuse until the piece holds a current receipt for:
  - the rejection floor of each maker it makes (long_video for a 16:9 cut, short_video for a 9:16 one): written by
    `python3 scripts/floor.py --format <maker> --piece <folder>`;
  - the failure and learnings registers: written by `python3 scripts/check_failures.py --piece <folder>`.
A receipt is current when its version is the hash of the file as it is now (scripts/preflight.py): a new standard or a
new failure since the read makes it stale, and the session reads it again.

Receipts are read from the piece's ve/ledger.jsonl (always written, offline too) and from its making record
(meta.making.preflight) when the folder names its piece and the engine answers; the newest of each wins.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from .common import ROOT

PREFLIGHT_FROM = '2026-11-09'
MAKER_OF_CUT = {'long': 'long_video', 'short': 'short_video', 'feature': 'long_video'}


def _preflight():
    sys.path.insert(0, str(ROOT / 'scripts'))
    import preflight  # noqa: PLC0415
    return preflight


def real_piece(folder: Path) -> bool:
    """A piece under docs/plans: the failure loop records incidents for these only, never a test fixture or a scratch
    folder (VE_INCIDENTS_ANYWHERE=1 lifts it for a test that means to)."""
    if os.environ.get('VE_INCIDENTS_ANYWHERE') == '1':
        return True
    try:
        Path(folder).resolve().relative_to((ROOT / 'docs' / 'plans').resolve())
        return True
    except ValueError:
        return False


def required(spec: dict) -> bool:
    return str(spec.get('publish_day') or '') >= PREFLIGHT_FROM


def maker_of(spec: dict, cut: str) -> str:
    if cut in MAKER_OF_CUT:
        return MAKER_OF_CUT[cut]
    aspect = ((spec.get('cuts') or {}).get(cut) or {}).get('aspect')
    return 'short_video' if aspect == '9:16' else 'long_video'


def from_record(directory: Path, call=None) -> list[dict]:
    """The making record's receipts, or [] when the engine is not asked or does not answer (the ledger stands)."""
    from . import gates
    if os.environ.get('VE_GATES_OFFLINE') == '1':
        return []
    uuid = gates.piece_uuid(directory)
    if uuid is None:
        return []
    try:
        status, text = (call or gates._engine_call)('GET', f'/api/content-ideas/{uuid}/making', None)
        data = json.loads(text) if isinstance(text, str) else text
    except Exception:  # noqa: BLE001 - no key, no network: the ledger copy stands
        return []
    making = data.get('making') if status == 200 and isinstance(data, dict) else None
    held = making.get('preflight') if isinstance(making, dict) else None
    return [r for r in held if isinstance(r, dict)] if isinstance(held, list) else []


def problems(spec: dict, directory: Path, cuts: list[str], call=None) -> list[str]:
    """Why ve may not brief or render these cuts yet, in plain words naming the missing read; [] when it may."""
    if not required(spec):
        return []
    pf = _preflight()
    folder = Path(directory).parent if Path(directory).name == 've' else Path(directory)
    held = pf.latest(pf.from_ledger(folder) + from_record(Path(directory), call))
    try:
        where = folder.relative_to(ROOT)
    except ValueError:
        where = folder
    out = []
    for maker in sorted({maker_of(spec, cut) for cut in cuts}):
        got, now = held.get(f'floor:{maker}:'), pf.floor_version()
        if not got:
            out.append(f'nobody read the rejection floor for {maker}: run python3 scripts/floor.py --format {maker} --piece {where}')
        elif got.get('version_or_hash') != now:
            out.append(f'the {maker} floor was read before it last changed: run python3 scripts/floor.py --format {maker} --piece {where} again')
    got, now = held.get('failures::'), pf.failures_version()
    if not got:
        out.append(f'nobody read the failure register: run python3 scripts/check_failures.py --piece {where}')
    elif got.get('version_or_hash') != now:
        out.append(f'the failure register was read before it last changed: run python3 scripts/check_failures.py --piece {where} again')
    return out
