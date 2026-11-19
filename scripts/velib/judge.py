"""The blind overall judge (quality floor, plan item 3; Krish, 2026-11-19: "Visually, motion, post-production, and everything
is a zero out of ten. I'm going to need you to make sure that this can never happen again.").

One judge scores the cut out of 10 beside his kept references and his three house cuts, without being told which is which.
Python never calls a model here. It does three things:

- `assemble`: for the cut and every reference it can find on disk (config/ve/pace-references.json lists them: his style
  references by file name, his house cuts by id), a frame sheet across the whole clip and a motion strip of consecutive
  frames from its middle, each under a letter shuffled by the cut's sha256, so the judge cannot tell the cut from his
  references. The key (which letter is the cut) is kept apart from the packet the judge reads. What is missing is named.
- `record`: the session runs the judge (the ve-critic agent, `.claude/agents/ve-critic.md`, "The blind judge"), which
  scores every letter; the cut's own score is written to judge.<cut>.json, bound to the cut's sha256.
- `problems`: readiness (velib/floor.py) holds a cut the judge scored below PASS, and, for a piece frozen at ve expect
  from floor.RECIPE_FROM, a cut with no judge record for this exact file.
"""
from __future__ import annotations

import hashlib
import json
import random
import string
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from .common import ROOT, ffmpeg, load_json, write_json

PASS = 8
SCHEMA = 've-judge/1'
REFS_DIR = ROOT / '.cache' / 'references'
CUT_LABEL = 'the cut'
QUESTION = ('Score each clip out of 10 as a finished short-form video a viewer would stop for: visuals, motion, '
            'post-production, art direction, use of the whole frame, captions. You are not told which clip is which. '
            'Return {"scores": {"<letter>": <0-10>, ...}, "notes": {"<letter>": "<one line>"}} with every letter scored.')


def packet_dir(directory: Path, cut: str) -> Path:
    return Path(directory) / f'judge.{cut}'


def key_path(directory: Path, cut: str) -> Path:
    return Path(directory) / f'judge.{cut}.key.json'


def record_path(directory: Path, cut: str) -> Path:
    return Path(directory) / f'judge.{cut}.json'


def sources(refs_dir: Path | None = None, table: Path | None = None) -> tuple[list[tuple[str, Path]], list[str]]:
    """(found, missing): every clip pace-references.json names, found by its file name (style references) or as
    <id>.mp4 (house cuts) in refs_dir."""
    from . import pace  # noqa: PLC0415
    folder = Path(refs_dir or REFS_DIR)
    loaded = json.loads(Path(table or pace.TABLE).read_text(encoding='utf-8'))
    found, missing = [], []
    for row in loaded['references'] + loaded.get('house', []):
        name = str(row['file'])
        candidates = [folder / name] + ([] if name.endswith('.mp4') else [folder / f'{name}.mp4'])
        hit = next((c for c in candidates if c.is_file()), None)
        (found.append((name, hit)) if hit else missing.append(name))
    return found, missing


def _duration(video: Path) -> float:
    from .qc import duration_s  # noqa: PLC0415
    return float(duration_s(str(video)))


def sheets(video: Path, frames_out: Path, motion_out: Path) -> None:
    """Eight frames across the clip, and twelve consecutive frames (0.1 s apart) from its middle."""
    length = _duration(video)
    if length <= 0:
        raise ValueError(f'{video}: no duration')
    subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-i', str(video), '-vf',
                    f'fps=8/{length},scale=270:-2,tile=8x1', '-frames:v', '1', str(frames_out)], check=True, capture_output=True)
    start = max(0.0, length / 2 - 0.6)
    subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-ss', f'{start:.3f}', '-i', str(video), '-vf',
                    'fps=10,scale=200:-2,tile=12x1', '-frames:v', '1', str(motion_out)], check=True, capture_output=True)


def assemble(directory: Path, cut: str, video: Path, digest: str, *, refs_dir: Path | None = None,
             table: Path | None = None, sheet_fn=None) -> dict:
    """Write the blind packet (judge.<cut>/: A.frames.jpg, A.motion.jpg, ..., packet.json) and the key beside it."""
    found, missing = sources(refs_dir, table)
    if not found:
        raise ValueError('no reference clip is on disk to judge the cut beside (python3 scripts/quick-edit/references.py '
                         f'fetch); missing: {", ".join(missing)}')
    clips = [(CUT_LABEL, Path(video))] + found
    letters = list(string.ascii_uppercase[:len(clips)])
    random.Random(int(hashlib.sha256(digest.encode()).hexdigest(), 16)).shuffle(letters)
    out = packet_dir(directory, cut)
    out.mkdir(parents=True, exist_ok=True)
    key = {}
    for (name, path), letter in zip(clips, letters):
        (sheet_fn or sheets)(path, out / f'{letter}.frames.jpg', out / f'{letter}.motion.jpg')
        key[letter] = name
    order = sorted(key)
    packet = {'schema': SCHEMA, 'cut_sha256': digest, 'letters': order, 'question': QUESTION,
              'files': {k: [f'{k}.frames.jpg', f'{k}.motion.jpg'] for k in order}}
    write_json(out / 'packet.json', packet)
    write_json(key_path(directory, cut), {'schema': SCHEMA, 'cut_sha256': digest, 'key': key, 'missing': missing})
    return {'packet': out / 'packet.json', 'letters': order, 'missing': missing}


def record(directory: Path, cut: str, digest: str, scores: dict, *, by: str, notes: dict | None = None,
           now: str | None = None) -> dict:
    """The judge's scores, read through the key: the cut's own score, bound to this file."""
    if not by or by.lower() in ('ve', 'claude-producer', 'producer'):
        raise ValueError('the judge is a reviewer who did not make the cut (the ve-critic agent), never ve or the producer')
    kept = load_json(key_path(directory, cut)) if key_path(directory, cut).is_file() else {}
    if kept.get('cut_sha256') != digest:
        raise ValueError(f'no blind packet for this file: run ve judge <piece> --cut {cut} first')
    key = kept['key']
    unscored = [k for k in key if not isinstance(scores.get(k), (int, float)) or not 0 <= scores[k] <= 10]
    if unscored:
        raise ValueError(f'every letter needs a score from 0 to 10; missing or out of range: {", ".join(sorted(unscored))}')
    mine = next(k for k, name in key.items() if name == CUT_LABEL)
    refs = [scores[k] for k, name in key.items() if name != CUT_LABEL]
    value = {'schema': SCHEMA, 'cut': cut, 'sha256': digest, 'score': scores[mine], 'pass_at': PASS, 'by': by,
             'at': now or datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'),
             'references_scored': len(refs), 'reference_scores': sorted(refs), 'missing_references': kept.get('missing', []),
             'note': (notes or {}).get(mine)}
    write_json(record_path(directory, cut), value)
    return value


def problems(directory: Path, cut: str, digest: str | None, *, bind: bool) -> list[str]:
    path = record_path(directory, cut)
    value = load_json(path) if path.is_file() else {}
    if value and value.get('sha256') == digest:
        score = value.get('score')
        if not isinstance(score, (int, float)) or score < PASS:
            return [f'below the floor: the blind judge scored it {score}/10 beside his references (needs {PASS})']
        return []
    if not bind:
        return []
    return [f'below the floor: no blind judge score for this file (ve judge <piece> --cut {cut}, then the ve-critic '
            f'agent scores it; needs {PASS}/10)']
