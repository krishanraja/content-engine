"""Interim golden frames (config/ve/golden-frames.json): Krish's named Production Inspo moments, plus Monday 26's.

Only references and times are recorded. A frame extracted for the Critic goes to .ve-work/golden/, never into git.
"""
from __future__ import annotations

import re
import subprocess
from datetime import date
from pathlib import Path

from .common import CONFIG, ROOT, WORK, ffmpeg, load_json, sha256_file

FILE = CONFIG / 'golden-frames.json'
TIME = re.compile(r'^(?:(\d+):)?(\d{1,2}(?:\.\d+)?)$')


def load(path=FILE) -> dict:
    return load_json(path)


def seconds(text: str) -> float:
    match = TIME.fullmatch(str(text).strip())
    if not match:
        raise ValueError(f'"{text}" is not a time: use mm:ss or mm:ss.s')
    minutes, secs = match.groups()
    return int(minutes or 0) * 60 + float(secs)


def interim(doc: dict, bar_path=ROOT / 'config' / 'reference-cuts.json') -> list[dict]:
    refs = set(doc.get('interim', {}).get('references', []))
    bar = load_json(bar_path)
    return [m for m in bar.get('reference_moments', []) if m.get('ref') in refs]


def status(doc: dict) -> dict:
    filled = [s for s in doc['slots'] if s.get('status') == 'named']
    return {'named': len(filled), 'min': doc['min'], 'max': doc['max'], 'ready': len(filled) >= doc['min'],
            'empty': [s['slot'] for s in doc['slots'] if s.get('status') != 'named']}


def fill(slot: str, reference: str, at: str, said: str, *, clip=None, force=False, path=FILE,
         styles_path=ROOT / 'config' / 'style-references.json', today=None, work=WORK) -> dict:
    """Record one named frame. Refuses an unknown slot, a reference not in Production Inspo's list, a time past the
    clip's studied length, and an empty quote: a slot holds his words or nothing."""
    import json  # noqa: PLC0415
    doc = load(path)
    entry = next((s for s in doc['slots'] if s['slot'] == slot), None)
    if entry is None:
        raise ValueError(f'no slot {slot}: slots are {", ".join(s["slot"] for s in doc["slots"])}')
    if entry.get('status') == 'named' and not force:
        raise ValueError(f'{slot} is already named; --force replaces it')
    if not isinstance(said, str) or len(said.strip()) < 2:
        raise ValueError("a golden frame is named in Krish's own words (--said); never fill one for him")
    styles = load_json(styles_path)
    ref = next((r for r in styles.get('references', []) if r.get('file') == reference), None)
    if ref is None:
        raise ValueError(f'{reference} is not in config/style-references.json (the Production Inspo list)')
    when = seconds(at)
    length = (ref.get('study') or {}).get('duration_s')
    if isinstance(length, (int, float)) and when > length:
        raise ValueError(f'{at} is past the end of {reference} ({length} s)')
    entry.clear()
    entry.update({'slot': slot, 'status': 'named', 'reference': reference, 'drive_id': ref.get('drive_id'),
                  'clip_sha256': ref.get('sha256'), 'at': at, 'at_s': round(when, 3),
                  'said': said.strip(), 'named_on': today or date.today().isoformat()})
    if clip:
        clip = Path(clip)
        if ref.get('sha256') and sha256_file(clip) != ref['sha256']:
            raise ValueError(f'{clip} is not {reference} (sha256 differs from config/style-references.json)')
        out = Path(work) / 'golden' / f'{slot}.png'
        out.parent.mkdir(parents=True, exist_ok=True)
        subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-ss', f'{when:.3f}', '-i', str(clip),
                        '-frames:v', '1', str(out)], check=True, capture_output=True)
        entry['frame_sha256'] = sha256_file(out)
    Path(path).write_text(json.dumps(doc, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return entry


# ---------------------------------------------------------------- named on his board (Ruling, Krish, 2026-11-12)
# The Golden frames card (config/ve/sign-offs.json, card golden) shows candidate stills cut from his own approved,
# published cuts, each with its piece and time; his Approve on one names it, his Not this records his no. Only
# velib/signoffs.apply calls these, with a press the engine kept as his, bound to the still's sha256. Each slot keeps
# the cut file's sha256 and the time, never the frame itself (the still stays in his Drive, by its id).
REVIEW_WHERE = 'his Publish Board, To review: Golden frames'


def reviewed_state(item_id: str, path=FILE) -> str | None:
    """named, declined or None: what config/ve/golden-frames.json holds now for this candidate."""
    doc = load(path)
    if any(s.get('status') == 'named' and s.get('sign_off') == item_id for s in doc['slots']):
        return 'named'
    if any(d.get('sign_off') == item_id for d in doc.get('declined') or []):
        return 'declined'
    return None


def fill_from_cut(sample: dict, *, words: str, on: str, at: str | None = None, path=FILE) -> dict:
    """His Approve on a candidate from his own cut: the first empty slot, named with the cut, the time and his press (his
    words too when he gave any). Refused when every slot is full: a golden set holds at most max frames."""
    import json  # noqa: PLC0415
    doc = load(path)
    if any(s.get('sign_off') == sample['id'] for s in doc['slots'] if s.get('status') == 'named'):
        raise ValueError(f"{sample['id']} is already named")
    entry = next((s for s in doc['slots'] if s.get('status') != 'named'), None)
    if entry is None:
        raise ValueError(f"every slot is named ({doc['max']}): a frame comes off before {sample['id']} goes on")
    slot = entry['slot']
    entry.clear()
    entry.update({'slot': slot, 'status': 'named', 'source': 'cut', 'sign_off': sample['id'], 'piece_id': sample['piece_id'],
                  'piece': sample.get('piece'), 'cut': sample['cut'], 'cut_sha256': sample['cut_sha256'],
                  'cut_path': sample.get('cut_path'), 'at': sample['at'], 'at_s': round(float(sample['at_s']), 3),
                  'frame_sha256': sample['sha256'], 'drive_id': (sample.get('drive') or {}).get('file_id'),
                  'named_by': 'Krish', 'named_on': on,
                  'press': {'where': REVIEW_WHERE, 'press': 'Approve', 'sha256': sample['sha256'], **({'at': at} if at else {})},
                  **({'said': words.strip()} if words.strip() else {})})
    doc['declined'] = [d for d in doc.get('declined') or [] if d.get('sign_off') != sample['id']]
    if not doc['declined']:
        doc.pop('declined')
    Path(path).write_text(json.dumps(doc, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return entry


def decline_reviewed(sample: dict, *, words: str, on: str, at: str | None = None, path=FILE) -> dict:
    """His Not this on a candidate: recorded as his no, with the date; a slot it held is emptied."""
    import json  # noqa: PLC0415
    doc = load(path)
    for s in doc['slots']:
        if s.get('sign_off') == sample['id']:
            slot = s['slot']
            s.clear()
            s.update({'slot': slot, 'status': 'empty'})
    row = {'sign_off': sample['id'], 'piece_id': sample.get('piece_id'), 'cut': sample.get('cut'), 'at': sample.get('at'),
           'frame_sha256': sample.get('sha256'), 'declined_by': 'Krish', 'declined_on': on, **({'at_press': at} if at else {}),
           **({'words': words.strip()} if words.strip() else {})}
    doc['declined'] = [d for d in doc.get('declined') or [] if d.get('sign_off') != sample['id']] + [row]
    Path(path).write_text(json.dumps(doc, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
    return row
