"""The Codex minimum: every video production session gives Codex a defined share of the work, and proves it.

Ruling (Krish, 2026-11-15): Codex does a minimum of every video session and the social legwork, visible in Codex
Desktop; Claude owns strategy, orchestration, verification and learnings; Codex never updates ai-harness or Google
Drive. The numbers live in config/codex-minimum.json.

A receipt is one row of kind `codex` in the piece's own ledger (ve/ledger.jsonl, a receipt kind that the usage totals
pass over). Claude writes it, never Codex, and only after Claude has checked the work: it names the card, the job, the
evidence file Claude checked (its sha256 is kept, so a receipt cannot point at nothing) and the Codex session that
did the work, so Krish can find that session in his Codex Desktop app.

ve status and ve file then refuse a whole cut of a piece published from the config's `from` date that has fewer than
the minimum of verified receipts of an art direction job. A proof excerpt is never held to it.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from .common import ROOT, load_json, sha256_file

KIND = 'codex'


def config() -> dict:
    return load_json(ROOT / 'config' / 'codex-minimum.json')


def required(spec: dict, cut: str, cfg: dict | None = None) -> bool:
    cfg = cfg or config()
    c = (spec.get('cuts') or {}).get(cut) or {}
    return not c.get('excerpt', False) and str(spec.get('publish_day') or '') >= cfg['from']


def receipts(directory: Path) -> list[dict]:
    """Every codex receipt in the piece's ledger, oldest first. A row that does not parse is skipped, never counted."""
    path = Path(directory) / 'ledger.jsonl'
    found = []
    if not path.is_file():
        return found
    for line in path.read_text(encoding='utf-8').splitlines():
        try:
            row = json.loads(line)
        except ValueError:
            continue
        if row.get('kind') != KIND:
            continue
        try:
            note = json.loads(row.get('note') or '{}')
        except ValueError:
            continue
        if isinstance(note, dict):
            found.append({'ts': row.get('ts'), **note})
    return found


def counted(found: list[dict], cfg: dict) -> list[dict]:
    jobs = set(cfg['minimum']['jobs_any_of'])
    return [r for r in found if r.get('job') in jobs and r.get('verified_by') and r.get('evidence_sha256')]


def problems(spec: dict, cut: str, directory: Path, cfg: dict | None = None) -> list[str]:
    cfg = cfg or config()
    if not required(spec, cut, cfg):
        return []
    need = int(cfg['minimum']['receipts'])
    have = len(counted(receipts(directory), cfg))
    if have >= need:
        return []
    return [f"Codex minimum not met: {have} of {need} verified Codex receipt(s) of "
            f"{', '.join(cfg['minimum']['jobs_any_of'])} for this piece (config/codex-minimum.json; "
            "dispatch the art direction to Codex, check it, then ve codex receipt)"]


def record(directory: Path, card: str, job: str, evidence: Path, verified_by: str, session: str = '',
           desktop_visible: bool | None = None, cfg: dict | None = None, at: str | None = None) -> dict:
    cfg = cfg or config()
    if job not in cfg['jobs']:
        raise ValueError(f"unknown Codex job {job!r}; expected one of {', '.join(cfg['jobs'])}")
    if not card or not isinstance(card, str):
        raise ValueError('a receipt names the card Codex worked from')
    if not verified_by or not verified_by.strip():
        raise ValueError('a receipt names who checked the work (Claude, never Codex)')
    if verified_by.strip().lower() == 'codex':
        raise ValueError("Codex's own report is never proof: the receipt is written by the session that checked it")
    evidence = Path(evidence)
    if not evidence.is_file():
        raise ValueError(f'evidence file not found: {evidence}')
    note = {'card': card, 'job': job, 'evidence': str(evidence), 'evidence_sha256': sha256_file(evidence),
            'verified_by': verified_by.strip(), 'codex_session': session or '', 'desktop_visible': desktop_visible}
    row = {'ts': at or datetime.now(timezone.utc).isoformat(), 'kind': KIND, 'amount': 0,
           'note': json.dumps(note, ensure_ascii=False)}
    path = Path(directory) / 'ledger.jsonl'
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a', encoding='utf-8', newline='\n') as handle:
        handle.write(json.dumps(row, ensure_ascii=False) + '\n')
    return note


def desktop_home() -> Path:
    """The Codex home Krish's Codex Desktop app reads: his everyday ~/.codex."""
    return Path.home() / '.codex'


def visible_in_desktop(log: str | None, home: Path | None = None) -> bool | None:
    """True when a Codex session log sits under the home the Desktop app reads; None when no log was found."""
    if not log:
        return None
    home = (home or desktop_home()).resolve()
    try:
        Path(log).resolve().relative_to(home)
        return True
    except ValueError:
        return False


def status(spec: dict, directory: Path, cfg: dict | None = None) -> dict:
    cfg = cfg or config()
    found = receipts(directory)
    return {'required_from': cfg['from'], 'minimum': cfg['minimum'], 'receipts': found,
            'counted': len(counted(found, cfg)),
            'not_visible_in_desktop': [r['card'] for r in found if r.get('desktop_visible') is False]}
