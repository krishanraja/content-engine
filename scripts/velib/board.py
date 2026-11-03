"""The inspiration board, read and written by ve through the engine API (Wave 3, docs/handovers/2026-11-03-engine-audit.md).

Krish, 2026-11-03: "I'm also still a bit disappointed with how poorly the inspiration board is used right now."

  - `check(refs)`: GET /api/inspiration/cards. Refuses a named card that is unknown, dismissed, outside the
    production lane or no clip, or whose Drive id is not the board's. `ve refs` runs it before any sheet is made.
  - `offer(spec)`: GET /api/inspiration/candidates, the top card per role, written into brand.references with
    `offered: true` (`ve init`); ve lint refuses the spec until the session confirms each.
  - `record_uses(...)`: POST /api/inspiration/uses, one card_uses row per reference and role with the Critic's score
    (`ve verdict`).

When the engine cannot be reached (no key, no network) each says NOT CHECKED or NOT RECORDED, in those words: it never
passes silently and never blocks offline work. ve lint stays offline and deterministic; it checks only that each
reference carries an `id` and that no `offered` flag is left.
"""
from __future__ import annotations

import json
import re
import sys
import urllib.parse
from pathlib import Path

from .common import ROOT

ROLES = ('look', 'motion', 'captions')
CARD_ID = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)
TIMEOUT_S = 20


class Unavailable(Exception):
    """The board could not be read or written here; the message says why."""


def _engine_call(method: str, path: str, body=None) -> tuple[int, dict]:
    sys.path.insert(0, str(ROOT / 'scripts'))
    import engine  # noqa: PLC0415
    try:
        token = engine.operator_key()
        status, text = engine.call(method, path, body, token=token, timeout=TIMEOUT_S)
    except (engine.NoKey, engine.Unreachable) as error:
        raise Unavailable(str(error).splitlines()[0]) from error
    except OSError as error:  # a timeout or a reset connection
        raise Unavailable(f'the engine did not answer ({error})') from error
    try:
        return status, json.loads(text)
    except ValueError as error:
        raise Unavailable(f'the engine answered {status} with no JSON') from error


def _ask(method: str, path: str, body=None, call=None) -> dict:
    status, answer = (call or _engine_call)(method, path, body)
    if status == 401:
        raise Unavailable('the engine refused the key (ENGINE_OPERATOR_TOKEN)')
    if status >= 500:
        raise Unavailable(f'the engine answered {status}: {answer.get("error") if isinstance(answer, dict) else answer}')
    if not isinstance(answer, dict):
        raise Unavailable(f'the engine answered {status} with no object')
    answer['_status'] = status
    return answer


def check(refs: list[dict], call=None) -> tuple[list[str], str]:
    """(problems, status). status is 'checked', or 'NOT CHECKED: <why>' when the board could not be read."""
    problems = [f"{r.get('card', '?')}: no Inspiration card id (brand.references[].id)" for r in refs if not r.get('id')]
    ids = [r['id'].lower() for r in refs if r.get('id')]
    if not ids:
        return problems, 'checked'
    try:
        answer = _ask('GET', '/api/inspiration/cards?ids=' + urllib.parse.quote(','.join(ids), safe=','), call=call)
    except Unavailable as error:
        return problems, f'NOT CHECKED: {error}'
    if not answer.get('ok'):
        return problems + [f"the board refused the ids: {'; '.join(answer.get('problems') or [str(answer.get('error'))])}"], 'checked'
    cards = {str(c.get('id', '')).lower(): c for c in answer.get('cards') or []}
    for ref in refs:
        if not ref.get('id'):
            continue
        card = cards.get(ref['id'].lower())
        name = ref.get('card', ref['id'])
        if card is None:
            problems.append(f"{name}: card {ref['id']} is not on the inspiration board")
            continue
        if card.get('problem'):
            why = {'dismissed': 'Krish dismissed it', 'not_production_lane': 'it is not in the production lane',
                   'not_a_clip': f"it is a {card.get('kind')}, not a clip"}.get(card['problem'], card['problem'])
            problems.append(f"{name}: card {ref['id']} cannot hold this cut: {why}")
        if card.get('drive_id') and ref.get('drive_id') and card['drive_id'] != ref['drive_id']:
            problems.append(f"{name}: drive_id {ref['drive_id']} is not the card's file ({card['drive_id']})")
        if card.get('label') and ref.get('card') and card['label'] != ref['card']:
            problems.append(f"{name}: the card id {ref['id']} is the board's {card['label']}; name it card: {card['label']}")
    return problems, 'checked'


def offer(spec: dict, fmt: str | None = None, call=None) -> tuple[list[dict], str]:
    """Pre-fill brand.references with the top candidate per role still unnamed. (added, status)."""
    refs = spec.setdefault('brand', {}).setdefault('references', [])
    added: list[dict] = []
    for role in ROLES:
        if any(role in r.get('for', []) for r in refs):
            continue
        query = {'role': role, 'limit': '1'}
        if fmt:
            query['format'] = fmt
        try:
            answer = _ask('GET', '/api/inspiration/candidates?' + urllib.parse.urlencode(query), call=call)
        except Unavailable as error:
            return added, f'NOT CHECKED: {error}'
        top = (answer.get('candidates') or [None])[0] if answer.get('ok') else None
        if not top:
            continue
        held = next((r for r in refs if r.get('id') == top['id']), None)
        if held:
            held['for'] = sorted(set(held['for']) | {role}, key=ROLES.index)
            continue
        ref = {'id': top['id'], 'card': top['label'], 'for': [role], 'drive_id': top.get('drive_id') or '',
               'takeaway': _takeaway(top, role), 'offered': True}
        refs.append(ref)
        added.append(ref)
    return added, 'checked'


def _takeaway(card: dict, role: str) -> str:
    """His words when he gave any, never a made-up reading; the session rewrites it when it confirms the card."""
    answers = card.get('answers') or {}
    words = answers.get('why_like') if answers.get('why_like_source') == 'typed' else None
    words = words or answers.get('would_do') or answers.get('why_here')
    return f'offered for {role}: ' + (f'Krish said "{words}"' if words else 'write what the cut must match before confirming')


def piece_uuid(spec: dict, spec_file: Path) -> str | None:
    """The piece's content_ideas.id: the spec's piece_id when it is one, else the plan folder's post.json."""
    if CARD_ID.match(str(spec.get('piece_id', ''))):
        return spec['piece_id'].lower()
    folder = Path(spec_file).parent
    for candidate in (folder, folder.parent):
        post = candidate / 'post.json'
        if post.is_file():
            try:
                value = json.loads(post.read_text(encoding='utf-8')).get('piece_id')
            except ValueError:
                return None
            return value.lower() if isinstance(value, str) and CARD_ID.match(value) else None
    return None


def uses_for(spec: dict, spec_file: Path, cut: str, scores) -> list[dict]:
    """One card_uses row per reference and role, with the Critic's score against that card."""
    by_card = {row['card']: row for row in scores or [] if isinstance(row, dict) and 'card' in row}
    try:
        spec_path = Path(spec_file).resolve().relative_to(ROOT).as_posix()
    except ValueError:
        spec_path = Path(spec_file).as_posix()
    piece = piece_uuid(spec, spec_file)
    rows = []
    for ref in (spec.get('brand') or {}).get('references') or []:
        if not ref.get('id'):
            continue
        score = by_card.get(ref['card'], {}).get('score')
        for role in ref.get('for', []):
            rows.append({'card_id': ref['id'].lower(), 'piece_id': piece, 'spec_path': spec_path[:300], 'cut': cut,
                         'role': role, 'critic_score': score if type(score) in (int, float) else None})
    return rows


def record_uses(spec: dict, spec_file: Path, cut: str, scores, call=None) -> str:
    """Post the uses; the answer is one line for the operator, never an exception."""
    rows = uses_for(spec, spec_file, cut, scores)
    if not rows:
        return 'card uses NOT RECORDED: no reference names an Inspiration card id'
    try:
        answer = _ask('POST', '/api/inspiration/uses', {'uses': rows}, call=call)
    except Unavailable as error:
        return f'card uses NOT RECORDED: {error}; run ve verdict again when the engine is reachable'
    if not answer.get('ok'):
        return f"card uses NOT RECORDED: {'; '.join(answer.get('problems') or [str(answer.get('error'))])}"
    return f"card uses recorded: {answer.get('written', len(rows))} row(s)"
