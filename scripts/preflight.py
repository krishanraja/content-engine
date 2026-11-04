#!/usr/bin/env python3
"""The preflight receipt: what a session read before it made anything (Krish, 2026-11-04: the failure loop must trace
a repeat back to why it kept happening, "the session did not check in on a specific skill or standard before
starting"). Each read is one receipt {check, format?, name?, version_or_hash, at, by}:

    floor     python3 scripts/floor.py --format <maker> --piece <piece>        the rejection floor for that maker
    failures  python3 scripts/check_failures.py --piece <piece>                the failure and learnings registers
    skill     python3 scripts/preflight.py <piece> --skill make-piece          the skill loaded (its SKILL.md hash)
    taste     python3 scripts/preflight.py <piece> --taste <hash-or-count>     get_approved_taste read (what it gave)

The piece is its plan folder (docs/plans/<folder>, or a path) or its content_ideas uuid; PREFLIGHT_PIECE names it
when no --piece is given. A receipt goes to the piece's making record (meta.making.preflight, through making.py's
writer) when the piece's uuid is known and the engine answers, and always to <folder>/ve/ledger.jsonl when the folder
is known (offline: Codex's sandbox), so ve brief and ve render can read it either way (scripts/velib/preflight.py).
Every engine_incidents row carries the receipt as it stood, which is how the weekly loop tells "the standard was
never read" from "the standard was read and still failed".

    python3 scripts/preflight.py <piece> --skill make-piece --taste 4
    python3 scripts/preflight.py <piece> --show
    python3 scripts/preflight.py --self-test

Standard library only. A receipt that cannot be written says so in one line and never fails the read it records.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FLOOR = ROOT / 'config' / 'rejection-floor.json'
FAILURES = ROOT / 'config' / 'failures.json'
LEARNINGS = ROOT / 'config' / 'learnings.json'
SKILLS = ROOT / '.agents' / 'skills'
UUID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
CHECKS = ('floor', 'failures', 'skill', 'taste')
ENV = 'PREFLIGHT_PIECE'
VERSION = re.compile(r'^[A-Za-z0-9_.:-]{1,80}$')


def now() -> str:
    return datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')


def _hash(*paths: Path) -> str:
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.read_bytes() if path.is_file() else b'')
    return digest.hexdigest()[:16]


def floor_version(path: Path = FLOOR) -> str:
    """The floor as read: the hash of config/rejection-floor.json (the file changes only by a merged pull request)."""
    return _hash(path)


def failures_version(failures: Path = FAILURES, learnings: Path = LEARNINGS) -> str:
    """The two registers check_failures.py reads, hashed together: a new failure or learning makes a receipt stale."""
    return _hash(failures, learnings)


def skill_version(name: str, root: Path = SKILLS) -> str:
    path = root / name / 'SKILL.md'
    if not path.is_file():
        raise ValueError(f'no skill {name} at {path.relative_to(ROOT) if path.is_relative_to(ROOT) else path}')
    return _hash(path)


def current(check: str) -> str | None:
    """The version a fresh read of a check would record now (floor and failures only; skill and taste vary)."""
    return {'floor': floor_version, 'failures': failures_version}.get(check, lambda: None)()


def resolve(piece: str | None) -> tuple[Path | None, str | None]:
    """(plan folder, content_ideas uuid) for a piece given as a folder, a plan name or a uuid; (None, None) for none."""
    piece = (piece or '').strip()
    if not piece:
        return None, None
    if UUID.match(piece):
        return None, piece
    for candidate in (Path(piece), ROOT / 'docs' / 'plans' / piece):
        if candidate.is_dir():
            folder = candidate.resolve()
            uuid = None
            for post in (folder / 'post.json', folder.parent / 'post.json'):
                if post.is_file():
                    try:
                        value = json.loads(post.read_text(encoding='utf-8-sig')).get('piece_id')
                    except (OSError, ValueError, AttributeError):
                        value = None
                    uuid = value if isinstance(value, str) and UUID.match(value) else None
                    break
            return folder, uuid
    return None, None


def receipt(check: str, version: str, fmt: str | None = None, name: str | None = None, by: str | None = None) -> dict:
    if check not in CHECKS:
        raise ValueError(f'check is one of {", ".join(CHECKS)}')
    if not VERSION.match(str(version or '')):
        raise ValueError('version_or_hash is letters, digits and . _ : -, up to 80')
    out = {'check': check, 'version_or_hash': str(version), 'at': now(), 'by': by or _by()}
    if fmt:
        out['format'] = fmt
    if name:
        out['name'] = name
    return out


def _by(environ=None) -> str:
    environ = os.environ if environ is None else environ
    named = (environ.get('MAKING_BY') or '').strip()
    if named:
        return named
    return 'Codex' if any(k.startswith('CODEX') for k in environ) else 'Claude Code'


def ledger_path(folder: Path) -> Path:
    return Path(folder) / 've' / 'ledger.jsonl'


def _append_ledger(folder: Path, receipts: list[dict]):
    path = ledger_path(folder)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8', newline='\n') as handle:
        for r in receipts:
            # kind 'preflight' with amount 0: velib/ledger.py totals() reads usage kinds only and passes over these.
            handle.write(json.dumps({'ts': r['at'], 'kind': 'preflight', 'amount': 0, 'note': r['check'], 'receipt': r},
                                    ensure_ascii=False) + '\n')


def _post_making(uuid: str, receipts: list[dict], call=None):
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import making  # noqa: PLC0415
    making.post(uuid, {'preflight': [{k: v for k, v in r.items() if k != 'by'} for r in receipts]}, call=call)


def write(piece: str | None, receipts: list[dict], call=None, environ=None) -> list[str]:
    """Writes the receipts for a piece; one line per place, saying where it went or why not. Never raises."""
    environ = os.environ if environ is None else environ
    piece = piece or environ.get(ENV)
    if not piece:
        return []
    folder, uuid = resolve(piece)
    lines = []
    if folder is None and uuid is None:
        return [f'preflight: NOT RECORDED, no plan folder or piece uuid "{piece}"']
    if folder is not None:
        try:
            _append_ledger(folder, receipts)
            lines.append(f'preflight: recorded in {ledger_path(folder).relative_to(ROOT) if ledger_path(folder).is_relative_to(ROOT) else ledger_path(folder)}')
        except OSError as error:
            lines.append(f'preflight: NOT RECORDED in the ledger: {error}')
    if uuid is not None:
        if environ.get('VE_GATES_OFFLINE') == '1' or environ.get('PREFLIGHT_OFFLINE') == '1':
            lines.append('preflight: NOT RECORDED on the making record: offline')
        else:
            try:
                _post_making(uuid, receipts, call)
                lines.append("preflight: recorded on the piece's making record")
            except Exception as error:  # noqa: BLE001 - no key, no network: the ledger copy stands
                lines.append(f"preflight: NOT RECORDED on the making record: {str(error).splitlines()[0] if str(error) else type(error).__name__}")
    return lines


def from_ledger(folder: Path) -> list[dict]:
    path = ledger_path(folder)
    if not path.is_file():
        return []
    out = []
    for line in path.read_text(encoding='utf-8').splitlines():
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if isinstance(row, dict) and row.get('kind') == 'preflight' and isinstance(row.get('receipt'), dict):
            out.append(row['receipt'])
    return out


def latest(receipts: list[dict]) -> dict[str, dict]:
    """The newest receipt for each check, format and name."""
    out: dict[str, dict] = {}
    for r in sorted((r for r in receipts if isinstance(r, dict)), key=lambda r: str(r.get('at') or '')):
        out[f"{r.get('check')}:{r.get('format') or ''}:{r.get('name') or ''}"] = r
    return out


def self_test() -> int:
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        folder = Path(tmp) / 'piece'
        folder.mkdir()
        (folder / 'post.json').write_text(json.dumps({'piece_id': '11111111-2222-4333-8444-555555555555'}))
        assert resolve(str(folder)) == (folder.resolve(), '11111111-2222-4333-8444-555555555555')
        assert resolve('11111111-2222-4333-8444-555555555555') == (None, '11111111-2222-4333-8444-555555555555')
        sent = []
        lines = write(str(folder), [receipt('floor', floor_version(), 'long_video')],
                      call=lambda m, p, b: (sent.append(b), (200, '{"ok":true}'))[1], environ={})
        assert any('recorded in' in x for x in lines) and any('making record' in x for x in lines), lines
        assert sent and sent[0]['preflight'][0]['check'] == 'floor', sent
        held = latest(from_ledger(folder))
        assert held['floor:long_video:']['version_or_hash'] == floor_version()
        assert write(str(folder), [receipt('failures', failures_version())], environ={'PREFLIGHT_OFFLINE': '1'})[-1].endswith('offline')
        assert write(None, [], environ={}) == []
        try:
            receipt('mood', 'x')
            raise AssertionError('an unknown check was taken')
        except ValueError:
            pass
    print('preflight.py self-test: ok')
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(description='Record what a session read before it made anything.')
    p.add_argument('piece', nargs='?', help=f'the plan folder or content_ideas uuid (default: ${ENV})')
    p.add_argument('--skill', action='append', default=[], help='a skill loaded, by name (its SKILL.md is hashed)')
    p.add_argument('--taste', help="what get_approved_taste returned: the rules' hash or how many came back (0 when none)")
    p.add_argument('--show', action='store_true', help='the receipts held for the piece')
    p.add_argument('--self-test', action='store_true', help=argparse.SUPPRESS)
    a = p.parse_args(argv)
    if a.self_test:
        return self_test()
    piece = a.piece or os.environ.get(ENV)
    if not piece:
        p.error(f'give the piece (its plan folder or uuid), or set {ENV}')
    if a.show:
        folder, _uuid = resolve(piece)
        for key, r in sorted(latest(from_ledger(folder) if folder else []).items()):
            fresh = current(r['check'])
            state = '' if fresh is None else ' (current)' if fresh == r['version_or_hash'] else ' (STALE: read it again)'
            print(f"{key}  {r['version_or_hash']}  {r['at']}{state}")
        return 0
    try:
        receipts = [receipt('skill', skill_version(name), name=name) for name in a.skill]
        if a.taste is not None:
            receipts.append(receipt('taste', a.taste))
    except ValueError as error:
        print(f'preflight: {error}', file=sys.stderr)
        return 2
    if not receipts:
        p.error('give --skill NAME and/or --taste HASH_OR_COUNT')
    for line in write(piece, receipts):
        print(line)
    return 0


if __name__ == '__main__':
    sys.exit(main())
