"""The reference gate: every cut is judged beside the inspiration-board cards its spec names.

Krish, 2026-11-03: "I even gave literal inspiration in the inspiration board on the quality I expect, and also the
subtitle builds we could have." ve lint, QC and the Critic had passed a cut he rated 1/10 because none of them put
the cut next to a reference. Here:

  - `required(spec)` says whether the spec is held to its references (lint.reference_lints decides who is exempt);
  - `resolve(ref)` finds the reference video locally. The board is never copied into the repository: the video is
    read from MINDMAKE_REFERENCE_ROOT, the session cache (.cache/ve/refs), or fetched by the existing references
    route (scripts/quick-edit/references.py fetch); failing all three it names the Drive id to download;
  - `sheets(...)` writes one side-by-side sheet per reference: the cut's frames on top, the reference's frames at the
    same fractions of their length below, so the Critic scores what he would see;
  - `scores_problems(...)` is what verdict.reasons refuses: a missing, unscored or failing reference.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

from .common import ROOT, ffmpeg

CACHE = ROOT / '.cache' / 've' / 'refs'
FRACTIONS = (0.12, 0.37, 0.62, 0.87)
PASS_SCORE = 8  # out of 10; below this the cut does not match its reference and is not ready
PROOF_CARD = 'proof'  # the verdict's reference row for the moving proof Krish approved (velib/proof.py)
TILE = (270, 480)


def required(spec: dict) -> bool:
    from .lint import REFERENCE_FROM
    if 'brand' not in spec:  # a partial spec (the packet and status tests): nothing to hold it to
        return False
    day = spec.get('publish_day')
    return bool(spec['brand'].get('references')) or not (day and day < REFERENCE_FROM)


def candidates(card: str) -> list[Path]:
    roots = [Path(os.environ['MINDMAKE_REFERENCE_ROOT'])] if os.environ.get('MINDMAKE_REFERENCE_ROOT') else []
    return [root / f'{card}.mp4' for root in roots + [CACHE]]


def resolve(ref: dict, fetch=None) -> Path:
    for path in candidates(ref['card']):
        if path.is_file():
            return path
    fetch = fetch or _fetch
    try:
        fetch(ref['card'] + '.mp4', CACHE)
    except Exception:  # noqa: BLE001 - any failure of the optional fetch falls through to the instruction below
        pass
    if (CACHE / f"{ref['card']}.mp4").is_file():
        return CACHE / f"{ref['card']}.mp4"
    raise ValueError(f"reference {ref['card']} is not on this machine: download Drive file {ref['drive_id']} "
                     f"(the Drive connector) to {CACHE / (ref['card'] + '.mp4')}, or set MINDMAKE_REFERENCE_ROOT")


def _fetch(name: str, out_dir: Path) -> None:
    sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))
    import references  # noqa: PLC0415
    out_dir.mkdir(parents=True, exist_ok=True)
    references.cmd_fetch(out_dir=str(out_dir), names=[name], out=lambda *_: None)


def duration(path: Path) -> float:
    from .qc import duration_s
    return duration_s(str(path))


def _row(video: Path, length: float, target: Path) -> None:
    """One frame at each fraction (an exact seek each), padded to the tile, side by side."""
    w, h = TILE
    args, inputs = [ffmpeg(), '-nostdin', '-v', 'error', '-y'], []
    for f in FRACTIONS:
        args += ['-ss', f'{min(f * length, max(length - 0.05, 0)):.3f}', '-i', str(video)]
    fit = f'scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2,setsar=1'
    chains = [f'[{n}:v]trim=end_frame=1,{fit}[f{n}]' for n in range(len(FRACTIONS))]
    graph = ';'.join(chains) + ';' + ''.join(f'[f{n}]' for n in range(len(FRACTIONS))) + f'hstack=inputs={len(FRACTIONS)}[out]'
    subprocess.run(args + ['-filter_complex', graph, '-map', '[out]', '-frames:v', '1', str(target)],
                   check=True, capture_output=True)


def sheet_path(directory: Path, cut: str, card: str) -> Path:
    return Path(directory) / f'reference.{cut}.{card}.jpg'


def stamp_path(directory: Path, cut: str, card: str) -> Path:
    return Path(directory) / f'reference.{cut}.{card}.json'


def sheet_is_for(directory: Path, cut: str, card: str, digest: str | None) -> bool:
    """The sheet exists and was made from this exact cut: a re-render needs new sheets."""
    import json  # noqa: PLC0415
    stamp = stamp_path(directory, cut, card)
    if not sheet_path(directory, cut, card).is_file() or not stamp.is_file() or not digest:
        return False
    try:
        return json.loads(stamp.read_text(encoding='utf-8')).get('video_sha256') == digest
    except ValueError:
        return False


def sheets(spec: dict, cut: str, directory: Path, video: Path, fetch=None) -> list[Path]:
    """One sheet per reference: cut frames above, reference frames below, at the same fractions."""
    out = []
    length = duration(video)
    for ref in spec['brand'].get('references') or []:
        source = resolve(ref, fetch)
        top, bottom = Path(directory) / f'.top.{cut}.jpg', Path(directory) / f'.bottom.{cut}.jpg'
        _row(video, length, top)
        _row(source, duration(source), bottom)
        target = sheet_path(directory, cut, ref['card'])
        subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-i', str(top), '-i', str(bottom),
                        '-filter_complex', 'vstack=inputs=2', str(target)], check=True, capture_output=True)
        top.unlink(missing_ok=True)
        bottom.unlink(missing_ok=True)
        if not target.is_file():
            raise ValueError(f'reference sheet for {ref["card"]} was not created')
        from .common import sha256_file, write_json  # noqa: PLC0415
        write_json(stamp_path(directory, cut, ref['card']), {'video_sha256': sha256_file(video), 'reference': str(source)})
        out.append(target)
    proof_clip = Path(directory) / 'proof' / f'{cut}.mp4'
    if proof_clip.is_file():
        out.append(proof_sheet(cut, directory, video, proof_clip))
    return out


def proof_sheet(cut: str, directory: Path, video: Path, proof_clip: Path) -> Path:
    """The cut's frames above the approved proof clip's: the Critic scores the cut against the beat Krish approved
    moving, as against a board card (card name PROOF_CARD in the verdict's references)."""
    from .common import sha256_file, write_json  # noqa: PLC0415
    top, bottom = Path(directory) / f'.top.{cut}.jpg', Path(directory) / f'.bottom.{cut}.jpg'
    _row(video, duration(video), top)
    _row(proof_clip, duration(proof_clip), bottom)
    target = sheet_path(directory, cut, PROOF_CARD)
    subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-i', str(top), '-i', str(bottom),
                    '-filter_complex', 'vstack=inputs=2', str(target)], check=True, capture_output=True)
    top.unlink(missing_ok=True)
    bottom.unlink(missing_ok=True)
    if not target.is_file():
        raise ValueError('the proof sheet was not created')
    write_json(stamp_path(directory, cut, PROOF_CARD), {'video_sha256': sha256_file(video), 'reference': str(proof_clip),
                                                        'proof_sha256': sha256_file(proof_clip)})
    return target


def proof_problems(spec: dict, cut: str, directory: Path, by_card: dict, digest: str | None) -> list[str]:
    """From MOTION_FROM a whole cut is also scored against the proof clip Krish approved; no approved proof is a hold."""
    from . import gates, proof  # noqa: PLC0415
    try:
        if not proof.required(spec, cut):
            return []
    except (KeyError, TypeError):
        return []
    held = proof.problems(spec, cut, directory, gates.load(directory, spec)['gates'])
    if held:
        return [f'the Critic has no approved moving proof to score {cut} against ({held[0]})']
    out = []
    if not sheet_is_for(directory, cut, PROOF_CARD, digest):
        out.append(f"no proof sheet for {cut} made from this file: run ve refs {spec['piece_id']} {cut}")
    row = by_card.get(PROOF_CARD)
    if row is None:
        out.append(f'Critic did not score the cut against the approved proof ({PROOF_CARD})')
    elif not row['matches'] or row['score'] < PASS_SCORE:
        out.append(f"Critic: the cut falls below the proof Krish approved ({row['score']}/10, pass {PASS_SCORE}): {row['note']}")
    return out


def score_errors(scores) -> list[str]:
    """Shape of a verdict's `references` list: one row per card, a 0-10 score, a yes/no and a reason in words."""
    if not isinstance(scores, list):
        return ['references must be a list']
    errors = []
    for row in scores:
        if (not isinstance(row, dict) or set(row) != {'card', 'score', 'matches', 'note'} or
                not isinstance(row['card'], str) or type(row['score']) not in (int, float) or
                not 0 <= row['score'] <= 10 or type(row['matches']) is not bool or
                not isinstance(row['note'], str) or len(row['note'].strip()) < 12):
            errors.append('invalid reference score (card, score 0-10, matches, note of 12+ characters)')
    return errors


def scores_problems(spec: dict, cut: str, directory: Path, scores, digest: str | None = None) -> list[str]:
    if not required(spec):
        return []
    refs = (spec.get('brand') or {}).get('references') or []
    if not refs:
        return ['spec names no inspiration-board references (ve lint reference.required)']
    out = []
    by_card = {row['card']: row for row in scores or [] if isinstance(row, dict) and 'card' in row}
    for ref in refs:
        if not sheet_is_for(directory, cut, ref['card'], digest):
            out.append(f"no reference sheet for {ref['card']} made from this file: run ve refs {spec['piece_id']} {cut}")
        row = by_card.get(ref['card'])
        if row is None:
            out.append(f"Critic did not score the cut against {ref['card']}")
        elif not row['matches'] or row['score'] < PASS_SCORE:
            out.append(f"Critic: does not match {ref['card']} ({row['score']}/10, pass {PASS_SCORE}): {row['note']}")
    return out + proof_problems(spec, cut, directory, by_card, digest)
