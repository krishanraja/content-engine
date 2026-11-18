"""The two things the Critic used to catch only at the very end, checked while the spec and the cards are written.

Krish, 2026-11-18, of the Tue 17 habits short, which went through nine proofs, his presses, the full render and `ve qc` before
the ve-critic blocked it on two things that were knowable on day one: "how you are able to get all this way through to
production and point out those two things - thats ridiculous - [...] that should have been picked up at the start".

  1. One idea. The Critic's first question is whether the cut carries one idea as clearly as The Ladder (Mon 2 Nov: one
     object, every move meaning something, nothing acting out a sentence). `guards.idea_problems` only checked that a
     style.idea EXISTS (F31). `one_object_problems` reads its content: a move whose meaning is "his line taken literally"
     acts out the sentence, and a spec that draws a different generated picture for almost every beat has no one object.
  2. Invented numbers. The spec's own never-list said "no invented numbers: every figure is IBM's own", but nothing read it:
     a Codex card asked for "Q3 revenue grew 40%" and Codex wrote "Renewals held steady at 94%". `card_problems` refuses a
     card whose quoted on-screen words carry a number the spec does not own, and `screen_problems` reads the numbers off
     what Codex made.

Pure functions: the callers (cards.py, guards.py, ve.py) say what to do with the problems. The thresholds are in
config/ve/production-guards.json (`one_object`, `numbers`) and are Krish's to change.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

NUM = re.compile(r'(?<![\w.])[$£€]?\d[\d,]*(?:\.\d+)?(?:\s?%)?')
QUOTED = re.compile(r'["“]([^"”\n]{1,400})["”]')
FORBIDS = re.compile(r'invent\w*\s+(?:number|figure|stat)|no\s+made[- ]?up\s+(?:number|figure|stat)', re.I)
REAL_KINDS = ('screenshot', 'document', 'recording', 'photo')


def norm(token: str) -> str:
    """A number as its value: no currency, commas, percent sign or spaces (40%, $40 and 40 are one number)."""
    value = re.sub(r'[$£€,%\s]', '', str(token))
    return value.rstrip('0').rstrip('.') if '.' in value else value


def numbers_in(text: str) -> list[str]:
    return NUM.findall(str(text or ''))


def forbids_invented_numbers(spec: dict) -> bool:
    """The spec's never-list says no invented numbers (style.idea.never)."""
    never = ((spec.get('style') or {}).get('idea') or {}).get('never') or []
    return any(FORBIDS.search(str(n)) for n in never)


def _strings(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from _strings(v)
    elif isinstance(value, list):
        for v in value:
            yield from _strings(v)
    elif isinstance(value, (int, float)) and not isinstance(value, bool):
        yield str(value)


def allowed_numbers(spec: dict, spec_dir: Path | None = None, supplied=()) -> set[str]:
    """The numbers the piece owns: its datasets (every figure names its producer), the words of its real artifacts, the call,
    the words he spoke (words.*.json beside the spec) and any the card says it supplies."""
    texts: list[str] = []
    for dataset in spec.get('datasets') or []:
        texts += [s for key, v in dataset.items() if key != 'source_url' for s in _strings(v)]
    idea = (spec.get('style') or {}).get('idea') or {}
    texts += list(_strings(idea.get('real_artifacts') or []))
    for asset in spec.get('assets') or []:
        if asset.get('origin') != 'generated' and asset.get('kind') in REAL_KINDS:
            texts += [s for key in ('holds', 'title', 'label', 'words', 'text') for s in _strings(asset.get(key))]
    texts += list(_strings(spec.get('call') or {}))
    if spec_dir is not None:
        for words in sorted(Path(spec_dir).glob('words*.json')):
            try:
                rows = json.loads(words.read_text(encoding='utf-8'))
            except (OSError, ValueError):
                continue
            texts.append(' '.join(str(r.get('word', '')) for r in rows if isinstance(r, dict)))
    texts += [str(s) for s in supplied or []]
    return {norm(n) for text in texts for n in numbers_in(text)}


def card_problems(fields: dict, spec: dict, spec_dir: Path | None = None, supplied=()) -> list[str]:
    """Numbers in the words a card asks Codex to put on screen (inside quotation marks) that the piece does not own.
    Applies only where the spec's never-list forbids invented numbers. Each problem names the token and the card line."""
    if not forbids_invented_numbers(spec):
        return []
    allowed = allowed_numbers(spec, spec_dir, supplied)
    out: list[str] = []
    for key in ('title', 'goal', 'contract'):
        for line in str(fields.get(key) or '').splitlines():
            for quoted in QUOTED.findall(line):
                for token in numbers_in(quoted):
                    if norm(token) not in allowed:
                        out.append(f'numbers.invented card {key}: "{token.strip()}" in "{quoted[:90]}" is not a number this piece owns '
                                   f'(its datasets, real artifacts or his script); use his figure, drop it, or list it as supplied '
                                   f'(numbers_supplied) with its producer. The spec says: no invented numbers.')
    return out


def screen_problems(found: list[tuple[str, str]], spec: dict, spec_dir: Path | None = None, supplied=()) -> list[str]:
    """Numbers read off a produced screen or still (`found` is (where, text) pairs) that the piece does not own. A lone
    digit with no percent or currency sign is ignored: it is as likely a list marker or a misread as a figure."""
    if not forbids_invented_numbers(spec):
        return []
    allowed = allowed_numbers(spec, spec_dir, supplied)
    out: list[str] = []
    for where, text in found:
        for token in numbers_in(text):
            bare = norm(token)
            if len(bare) < 2 and not re.search(r'[%$£€]', token):
                continue
            if bare not in allowed:
                out.append(f'numbers.invented {where}: "{token.strip()}" is on screen and is not a number this piece owns '
                           f'(its datasets, real artifacts or his script); Codex invented it. Redo the screen without it.')
    return out


# ---------------------------------------------------------------- one idea, read for its content


def _names(spec: dict, ids: set[str]) -> dict[str, str]:
    """Every way an asset is named on screen (its id, asset:<id>, its path or file name) -> its id."""
    out: dict[str, str] = {}
    for a in spec.get('assets') or []:
        if a.get('id') in ids:
            for key in (a['id'], f"asset:{a['id']}", a.get('path'), Path(str(a.get('path') or '')).name):
                if key:
                    out[str(key)] = a['id']
    return out


def _pictures(spec: dict, cut: dict, generated: set[str]) -> list[set[str]]:
    """For each beat, the generated pictures it shows: its plate asset, and any asset an object it uses names (by id or path)."""
    names = _names(spec, generated)
    objects = {o.get('obj'): o for o in spec.get('objects') or []}
    rows: list[set[str]] = []
    for beat in cut.get('beats') or []:
        seen: set[str] = set()
        plate = str((beat.get('plate') or {}).get('source') or '')
        if plate in names:
            seen.add(names[plate])
        for name in beat.get('uses') or []:
            for text in _strings((objects.get(name) or {}).get('params') or {}):
                if text in names:
                    seen.add(names[text])
        rows.append(seen)
    return rows


def _carried(spec: dict, cut: dict, carrier: str) -> int:
    """How many beats show the carrier: an asset or an object id."""
    objects = {o.get('obj'): o for o in spec.get('objects') or []}
    keys = {carrier, f'asset:{carrier}'}
    for a in spec.get('assets') or []:
        if a.get('id') == carrier:
            keys |= {str(a.get('path')), Path(str(a.get('path') or '')).name}
    count = 0
    for beat in cut.get('beats') or []:
        names = set(beat.get('uses') or [])
        hit = carrier in names or str((beat.get('plate') or {}).get('source') or '') in keys
        if not hit:
            for name in names:
                if any(t in keys for t in _strings((objects.get(name) or {}).get('params') or {})):
                    hit = True
                    break
        count += 1 if hit else 0
    return count


def one_object_problems(spec: dict, rules: dict) -> list[str]:
    """`idea.one_object`: the idea's moves do not act out the sentence, and the piece does not draw a different generated
    picture for almost every beat. Gated by the caller (rules['from'])."""
    idea = (spec.get('style') or {}).get('idea')
    if not isinstance(idea, dict):
        return []
    out: list[str] = []
    acts = re.compile('|'.join(rules['acts_out']), re.I)
    for i, move in enumerate(idea.get('moves') or []):
        means = str(move.get('means') or '') if isinstance(move, dict) else ''
        hit = acts.search(means)
        if hit:
            out.append(f'idea.one_object style.idea.moves.{i}: "{means[:110]}" reads like acting out the line ("{hit.group(0)}"). '
                       f'One object carries the piece and each move means something about it, nothing repeats the sentence '
                       f'(The Ladder, Mon 2 Nov; .claude/agents/ve-critic.md)')
    generated = {a['id'] for a in spec.get('assets') or []
                 if a.get('origin') == 'generated' and a.get('kind') in rules['picture_kinds']}
    carrier = idea.get('carrier')
    for cut_id, cut in (spec.get('cuts') or {}).items():
        if cut.get('excerpt', False):
            continue
        rows = _pictures(spec, cut, generated)
        distinct = set().union(*rows) if rows else set()
        beats = len(cut.get('beats') or [])
        if carrier:
            share = _carried(spec, cut, str(carrier)) / beats if beats else 0
            if share < rules['carrier_share']:
                out.append(f'idea.one_object style.idea.carrier cuts.{cut_id}: {carrier!r} is on {share:.0%} of the beats; the carrier '
                           f'persists through at least {rules["carrier_share"]:.0%} of them')
        elif len(distinct) > rules['max_generated_pictures']:
            out.append(f'idea.one_object cuts.{cut_id}: {len(distinct)} different generated pictures, more than '
                       f'{rules["max_generated_pictures"]}; name the one object that carries the piece (style.idea.carrier: an asset or '
                       f'object id that persists across at least {rules["carrier_share"]:.0%} of the beats) or carry fewer pictures')
    return out
