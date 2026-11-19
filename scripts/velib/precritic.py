"""The Critic's two questions, asked before anything is made (`ve critic --pre <piece>`).

Krish, 2026-11-18: "how you are able to get all this way through to production and point out those two things - thats
ridiculous [...] that should have been picked up at the start". The ve-critic ran only after the render, `ve qc` and `ve
refs` (docs/ve/RUNBOOK.md S7). Its two blocking questions were knowable from the spec and the storyboard on day one:

  Q1  Does the piece carry one idea as clearly as The Ladder (one object, every move meaning something, nothing acting out
      a sentence)?
  Q2  Is any number on screen invented (a figure the piece does not own: its datasets, real artifacts or his script)?

`inputs` writes what the reviewer reads: the spec digest, the storyboard table and the card briefs (no asset exists yet), with
the mechanical checks already run. `write` records the reviewer's answers as verdict.pre.json, bound to the spec's hash and to
the card briefs it read. The critic stays read-only (.claude/agents/ve-critic.md); the session writes the file from its words,
as it does for `ve verdict write`. `state` says whether a spec has a passing, current verdict: `ve card` and `ve lint` read it.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

from . import gates, ideaguard, showgate
from .common import ROOT, load_json, sha256_file, write_json

VERDICT = 'verdict.pre.json'
INPUTS = 'critic-pre.inputs.json'
SCHEMA = 've-pre-critic/1'
QUESTIONS = ('one_idea', 'no_invented_numbers')


def ve_dir(spec_path: Path) -> Path:
    path = Path(spec_path).parent
    return path if path.name == 've' else path / 've'


def spec_sha(spec: dict) -> str:
    """The spec as the reviewer read it: everything but its approvals, which Krish's presses add afterwards."""
    return gates.canonical_sha({k: v for k, v in spec.items() if k != 'approvals'})


def piece_cards(spec_path: Path, cards_root: Path | None = None) -> list[Path]:
    """The cards written for this spec (a card's `spec:` line names it), so the reviewer reads every brief."""
    root = cards_root or ROOT / 'docs' / 've' / 'cards'
    want = _rel(spec_path)
    found = []
    for card in sorted(root.rglob('*.md')) if root.is_dir() else []:
        head = card.read_text(encoding='utf-8').split('---', 2)
        if len(head) > 2 and any(line.strip() == f'spec: {want}' for line in head[1].splitlines()):
            found.append(card)
    return found


def _rel(path: Path) -> str:
    path = Path(path)
    try:
        return path.resolve().relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def storyboard_table(spec: dict) -> list[dict]:
    rows = []
    for cut_id, cut in (spec.get('cuts') or {}).items():
        for beat in cut.get('beats') or []:
            rows.append({'cut': cut_id, 'beat': beat.get('id'), 'role': beat.get('role'), 'point': beat.get('point'),
                         'plate': (beat.get('plate') or {}).get('source'), 'uses': beat.get('uses') or []})
    return rows


def inputs(spec: dict, spec_path: Path, mechanical: list[str]) -> Path:
    """Write what the reviewer reads (a file beside the spec) and say where."""
    directory = ve_dir(spec_path)
    cards = piece_cards(spec_path)
    value = {
        'schema': 've-pre-critic-inputs/1', 'piece': spec.get('piece_id'), 'spec_sha256': spec_sha(spec),
        'question_1': 'Does this piece carry one idea as clearly as The Ladder (Mon 2 Nov): one object, every move meaning '
                      'something, nothing acting out a sentence? (.claude/agents/ve-critic.md, "First, beside his favourite")',
        'question_2': 'Is any number on screen invented: a figure the piece does not own (its datasets, real artifacts or his '
                      'script)? The spec\'s own never-list is the rule.',
        'style_idea': (spec.get('style') or {}).get('idea'),
        'storyboard': storyboard_table(spec),
        'cards': [{'path': _rel(c), 'sha256': sha256_file(c), 'brief': c.read_text(encoding='utf-8')} for c in cards],
        'mechanical_already_run': mechanical,
        # Everything Krish has had to say more than once about a cut (config/ve/pre-show-checklist.json): the reviewer reads it
        # now, and the show gate asks for every row again on the exact file (scripts/velib/showgate.py).
        'pre_show_checklist': [{k: i[k] for k in ('id', 'text', 'krish')} for i in showgate.checklist()['items']],
    }
    return write_json(directory / INPUTS, value)


def write(spec: dict, spec_path: Path, reviewer: str, answers: dict, findings: list, mechanical: list[str]) -> Path:
    for q in QUESTIONS:
        a = answers.get(q)
        if not isinstance(a, dict) or not isinstance(a.get('pass'), bool) or len(str(a.get('line') or '').strip()) < 12:
            raise ValueError(f'answers.{q}: {{"pass": true|false, "line": "one line saying why, citing a beat or card"}}')
    for f in findings:
        if not isinstance(f, dict) or set(f) != {'severity', 'area', 'text'} or f['severity'] not in ('block', 'fix', 'note'):
            raise ValueError('each finding is {"severity": "block|fix|note", "area": "...", "text": "..."}')
    cards = [{'path': _rel(c), 'sha256': sha256_file(c)} for c in piece_cards(spec_path)]
    blocking = any(f['severity'] == 'block' for f in findings) or not all(answers[q]['pass'] for q in QUESTIONS)
    value = {'schema': SCHEMA, 'piece': spec.get('piece_id'), 'spec_sha256': spec_sha(spec), 'cards': cards, 'reviewer': reviewer,
             'reviewed_at': datetime.now(timezone.utc).isoformat(), 'answers': answers, 'findings': findings,
             'mechanical': mechanical, 'blocking': blocking}
    return write_json(ve_dir(spec_path) / VERDICT, value)


def state(spec: dict, spec_path: Path) -> tuple[bool, str]:
    """(ok, why): a verdict exists, is for this spec as it stands and the cards it read as they stand, and does not block."""
    path = ve_dir(spec_path) / VERDICT
    if not path.is_file():
        return False, f'no {VERDICT}: run `ve critic --pre {spec.get("piece_id")}`, have a reviewer who did not write the spec answer its two questions, then `ve critic --pre ... --write`'
    try:
        v = load_json(path)
    except (OSError, ValueError):
        return False, f'{VERDICT} cannot be read'
    if v.get('schema') != SCHEMA:
        return False, f'{VERDICT} is not {SCHEMA}'
    if v.get('spec_sha256') != spec_sha(spec):
        return False, f'{VERDICT} is stale: the spec changed after it was reviewed; ask the two questions again'
    for card in v.get('cards') or []:
        file = ROOT / card['path']
        if file.is_file() and sha256_file(file) != card['sha256']:
            return False, f'{VERDICT} is stale: {card["path"]} changed after it was reviewed'
    if v.get('blocking'):
        detail = '; '.join(f'{q}: {v["answers"][q]["line"]}' for q in QUESTIONS if not v['answers'][q]['pass']) or 'a blocking finding'
        return False, f'{VERDICT} blocks: {detail}'
    return True, 'ok'
