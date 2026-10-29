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
