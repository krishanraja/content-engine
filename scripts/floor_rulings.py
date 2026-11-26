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

Ruling (Krish, 2026-11-24): the signature format is the 5 Whys; get rid of everything that suggests predictions, calls,
dated, odds or scores. The engine still writes the prediction standards, the 'prediction' maker and the bold predictions
groups from its records, so the file's `retired` section takes them out of what every reader sees, the same way: by
standard id, and by a pattern on a standard's wording (a rebuild re-hashes a reworded standard), by record, by maker,
and by group lineage (bold_predictions and its weekly evolutions bold_predictions_eYYMMDD read his amended words).

    python3 scripts/floor_rulings.py        exit 0 when every ruling applies cleanly to the committed floor, 1 with why
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RULINGS = ROOT / 'config' / 'floor-rulings.json'


def load_rulings(path: Path = RULINGS) -> dict:
    if not Path(path).is_file():
        return {'records': {}}
    return json.loads(Path(path).read_text(encoding='utf-8'))


def in_lineage(key, roots) -> bool:
    """A group key is one of roots or a weekly evolution of one (<root>_eYYMMDD, as standards_checkin.py names it)."""
    return any(re.fullmatch(re.escape(root) + r'(?:_e\d{6})*', str(key or '')) for root in roots)


def retired_standards(doc, retired: dict) -> set:
    """The standard ids the retirement takes off this floor: those listed, and those whose wording matches its pattern,
    less the ones it keeps."""
    standards = (doc or {}).get('standards') or {}
    keep = set(retired.get('keep') or {})
    gone = {ref for ref in retired.get('standards') or [] if ref in standards}
    if retired.get('pattern'):
        pattern = re.compile(retired['pattern'], re.I)
        gone |= {ref for ref, s in standards.items()
                 if pattern.search(' '.join(str(s.get(k) or '') for k in ('never_beneath', 'check_before_delivery')))}
    return gone - keep


def retire(doc, retired: dict | None) -> dict:
    """Take what Krish retired out of the floor document, in place. Returns counts of what it took."""
    if not doc or not retired:
        return {}
    gone = retired_standards(doc, retired)
    records = set(retired.get('records') or []) & set(doc.get('records') or {})
    makers = set(retired.get('formats') or [])
    formats = doc.get('formats') or {}
    for fmt in makers:
        formats.pop(fmt, None)
    drop = gone | records
    for entry in formats.values():
        for kind, refs in list(entry.items()):
            if isinstance(refs, list):
                entry[kind] = [ref for ref in refs if ref not in drop]
    for key in ('aims', 'examples'):
        if isinstance(doc.get(key), list):
            doc[key] = [ref for ref in doc[key] if ref not in gone]
    standards = doc.get('standards') or {}
    for ref in gone:
        standards.pop(ref, None)
    for item in list(standards.values()) + list((doc.get('records') or {}).values()):
        if isinstance(item.get('formats'), list) and makers & set(item['formats']):
            item['formats'] = [f for f in item['formats'] if f not in makers]
    worded = 0
    group = retired.get('groups') or {}
    for g in doc.get('groups') if isinstance(doc.get('groups'), list) else []:
        if not isinstance(g, dict):
            continue
        for key, statement in retired.get('v5_groups', {}).items():
            if in_lineage(g.get('key'), [key]):
                g['statement'] = statement
        g['members'] = [m for m in g.get('members') or [] if m not in gone]
        if in_lineage(g.get('key'), group.get('lineage') or []):
            g['title'] = group.get('title') or g.get('title')
            g['statement'] = group.get('statement') or g.get('statement')
            worded += 1
    counts = doc.get('counts')
    if isinstance(counts, dict) and gone:
        counts['standards'] = len(standards)
        counts['approved'] = sum(1 for s in standards.values() if s.get('standing') != 'draft')
        counts['patterns'] = sum(1 for s in standards.values() if s.get('weight') == 'pattern')
        for key in ('aims', 'examples'):
            if key in counts and isinstance(doc.get(key), list):
                counts[key] = len(doc[key])
    return {'standards': len(gone), 'records': len(records), 'formats': len(makers), 'groups': worded}


def apply(doc, rulings: dict | None = None):
    """Apply each ruling to the floor document in place. Returns (doc, problems); problems are plain sentences."""
    if doc is None:
        return doc, []
    rulings = load_rulings() if rulings is None else rulings
    retire(doc, rulings.get('retired'))
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
    rulings = load_rulings()
    took = retire(json.loads(json.dumps(floor)), rulings.get('retired'))
    problems = idle(floor) + apply(floor)[1]
    for p in problems:
        print(p)
    if not problems:
        print(f'floor rulings: {len(rulings["records"])} applied cleanly')
    if took:
        print(f'retired by ruling: {took["standards"]} standards, {took["records"]} rejections from the makers\' lists, '
              f'{took["formats"]} maker, {took["groups"]} groups reworded')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
