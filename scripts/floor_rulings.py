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


def apply(doc, rulings: dict | None = None):
    """Apply each ruling to the floor document in place. Returns (doc, problems); problems are plain sentences."""
    if doc is None:
        return doc, []
    rulings = load_rulings() if rulings is None else rulings
    problems = []
    records = doc.get('records') or {}
    for ref, r in (rulings.get('records') or {}).items():
        record = records.get(ref)
        if record is None:
            continue  # nothing to apply to (a withdrawn record, or a floor that is not the full file); idle() says so
        field, ruled = r['field'], r['ruled']
        now = record.get(field)
        if now == ruled:
            continue
        if now in (r.get('replaces') or []):
            record[field] = ruled
            continue
        problems.append(f'ruling {ref}: the engine sent a new wording of {field} ({now!r}); it is left as sent and waits '
                        f'on Krish against his ruling: {r.get("ruling", "")}')
    return doc, problems


def idle(doc, rulings: dict | None = None) -> list:
    """Rulings whose record the floor no longer holds, as plain sentences."""
    rulings = load_rulings() if rulings is None else rulings
    records = (doc or {}).get('records') or {}
    return [f'ruling {ref}: the record is not in the floor; check the ruling still has a record to apply to'
            for ref in (rulings.get('records') or {}) if ref not in records]


def main() -> int:
    floor = json.loads((ROOT / 'config' / 'rejection-floor.json').read_text(encoding='utf-8'))
    problems = idle(floor) + apply(floor)[1]
    for p in problems:
        print(p)
    if not problems:
        print(f'floor rulings: {len(load_rulings()["records"])} applied cleanly')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
