#!/usr/bin/env python3
"""Krish's rulings on a rejection floor record's wording, kept over every rebuild of the floor.

Ruling (Krish, 2026-11-14): a caption page holds two to five words, and the rejections engine keeps the ruled wording
(his words: "I agree with everything else until Batch 6").

config/rejection-floor.json is rebuilt by the Rejections engine (krishanraja/inspirationhouse) from records that cannot
be edited once written, so a ruled rewording made in the file alone would be undone by the next rebuild.
config/floor-rulings.json holds each ruling (the record, the field, the ruled text, the wordings it replaces, the ruling
line and his words), and every reader of the floor here (scripts/floor.py load, scripts/learning/common.py load_floor)
applies it. A field holding a wording the ruling does not name is reported and left alone: a new wording from the
engine waits on him, it is never overwritten.

A ruling reaches a record (`records`), a standard (`standards`) or a maker (`formats`), by its id. An entry rules one
field (`field`, `ruled`, `replaces`) or several (`fields`: {field: {ruled, replaces}}). Its ruling line and his words are
on the entry (`ruling`, `his_words`) or, shared by many entries, under `rulings` and named by `ruled_by`. Rulings (Krish,
2026-11-17 and 2026-11-18): the prediction format is abandoned ("get rid of that - i have abandoned the prediction
format, it feels lame"), so every standard, record and maker that asked for a dated prediction is ruled withdrawn here
and stays only as the record of what he rejected.

    python3 scripts/floor_rulings.py        exit 0 when every ruling applies cleanly to the committed floor, 1 with why
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULINGS = ROOT / 'config' / 'floor-rulings.json'


def load_rulings(path: Path = RULINGS) -> dict:
    if not Path(path).is_file():
        return {'records': {}}
    return json.loads(Path(path).read_text(encoding='utf-8'))


SECTIONS = ('records', 'standards', 'formats')


def fields(entry: dict) -> list:
    """(field, ruled, replaces) for each field an entry rules."""
    if 'fields' in entry:
        return [(f, r['ruled'], r.get('replaces') or []) for f, r in entry['fields'].items()]
    return [(entry['field'], entry['ruled'], entry.get('replaces') or [])]


def ruling_line(entry: dict, rulings: dict) -> str:
    """The ruling line an entry carries, or the shared one it names (`ruled_by`)."""
    if entry.get('ruling'):
        return entry['ruling']
    return ((rulings.get('rulings') or {}).get(entry.get('ruled_by') or '') or {}).get('ruling', '')


def apply(doc, rulings: dict | None = None):
    """Apply each ruling to the floor document in place. Returns (doc, problems); problems are plain sentences."""
    if doc is None:
        return doc, []
    rulings = load_rulings() if rulings is None else rulings
    problems = []
    for section in SECTIONS:
        held = doc.get(section) or {}
        for ref, r in (rulings.get(section) or {}).items():
            item = held.get(ref)
            if item is None:
                continue  # nothing to apply to (a withdrawn record, or a floor that is not the full file); idle() says so
            for field, ruled, replaces in fields(r):
                now = item.get(field)
                if now == ruled:
                    continue
                if now in replaces:
                    item[field] = ruled
                    continue
                problems.append(f'ruling {ref}: the engine sent a new wording of {field} ({now!r}); it is left as sent and '
                                f'waits on Krish against his ruling: {ruling_line(r, rulings)}')
    return doc, problems


def idle(doc, rulings: dict | None = None) -> list:
    """Rulings whose record, standard or maker the floor no longer holds, as plain sentences."""
    rulings = load_rulings() if rulings is None else rulings
    out = []
    for section in SECTIONS:
        held = (doc or {}).get(section) or {}
        out += [f'ruling {ref}: the {section[:-1].replace("format", "maker")} is not in the floor; check the ruling '
                f'still has something to apply to' for ref in (rulings.get(section) or {}) if ref not in held]
    for section in SECTIONS:
        for ref, r in (rulings.get(section) or {}).items():
            if not ruling_line(r, rulings):
                out.append(f'ruling {ref}: it names no ruling line (ruling, or ruled_by a ruling under rulings)')
    return out


def main() -> int:
    floor = json.loads((ROOT / 'config' / 'rejection-floor.json').read_text(encoding='utf-8'))
    problems = idle(floor) + apply(floor)[1]
    for p in problems:
        print(p)
    if not problems:
        n = sum(len(load_rulings().get(section) or {}) for section in SECTIONS)
        print(f'floor rulings: {n} applied cleanly')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
