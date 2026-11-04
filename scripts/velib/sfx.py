"""One sound on the big moment, chosen by Krish's ear (THE_BAR ruling 11: "Only the big moment"; a small set is played
to him first, and nothing is used before he approves it by ear).

His Epidemic Sound plan covers sound effects in published video ("yes", 29 Oct 2026, config/sfx-approved.json).

  candidates  config/sfx-candidates.json: the shortlist, each with its provider id, its file under MINDMAKE_MUSIC_ROOT
              (never committed) and that file's sha256. A session shortlists with Epidemic's search; a file is
              downloaded only after Krish says yes to downloading it.
  audition    renders the cut's big-moment window once per candidate through the one render path, each with only that
              sound at the moment, and measures each hit against his voice (ghost-editor's rule: louder than 1.5 dB
              over the voice's 95th-percentile peak, or quieter than 22 dB under it, is called out). It writes
              sfx/<id>.mp4 and sfx-audition.json for his press. It approves nothing.
  approve     writes his yes, in his words, to config/sfx-approved.json, then rebuilds config/ve/sfx-kits/house-v1.json
              (the kit every ve spec names, read by compile.py) from approved rows only.
  stage       copies the approved sounds into a cut's assets folder, where compile finds them.

Nothing here places a sound on a cut: the spec does, on its one big-moment event.
"""
from __future__ import annotations

import json
import os
import shutil
import subprocess
from pathlib import Path

from .common import ROOT, ffmpeg, load_json, sha256_file, write_json

CANDIDATES = ROOT / 'config' / 'sfx-candidates.json'
APPROVED = ROOT / 'config' / 'sfx-approved.json'
KIT = ROOT / 'config' / 've' / 'sfx-kits' / 'house-v1.json'
MUSIC_ENV = 'MINDMAKE_MUSIC_ROOT'
BIG_VERBS = ('stamp', 'slam', 'enter', 'mark', 'count', 'drop')
LOUDEST_DB, QUIETEST_DB = 1.5, -22.0
DEFAULT_GAIN_DB = -8.0     # ghost-editor's "impact" role, relative to the voice's peak


def _rows(path: Path, key: str) -> list[dict]:
    return list((load_json(path) if Path(path).is_file() else {}).get(key) or [])


def candidates(path: Path = CANDIDATES) -> dict[str, dict]:
    return {row['id']: row for row in _rows(path, 'candidates') if row.get('id')}


def approved(path: Path = APPROVED) -> dict[str, dict]:
    """The sounds Krish approved: each names him, carries his words and the sha256 of the file he heard."""
    return {row['id']: row for row in _rows(path, 'approved')
            if row.get('id') and row.get('sha256') and row.get('approved_by') == 'Krish' and row.get('approval_words')}


def music_root() -> Path:
    root = os.environ.get(MUSIC_ENV)
    if not root:
        raise ValueError(f'{MUSIC_ENV} is not set (python scripts/quick-edit/music.py fetch prints it)')
    return Path(root)


def local_file(row: dict) -> Path:
    """The candidate's file on this machine, checked against the sha256 it was shortlisted with."""
    if not row.get('file') or not row.get('sha256'):
        raise ValueError(f"sound {row.get('id')}: not downloaded yet (no file and sha256); downloading waits for Krish's yes")
    path = music_root() / row['file']
    if not path.is_file():
        raise ValueError(f"sound {row['id']}: {path} is missing on this machine")
    if sha256_file(path) != row['sha256']:
        raise ValueError(f"sound {row['id']}: {path} is not the file shortlisted (sha256 differs)")
    return path


def stage(row: dict, assets_dir: Path) -> str:
    """Copy the sound into the assets folder once (never over another file); return its path relative to it."""
    src = local_file(row)
    rel = f"sfx/{row['id']}{src.suffix.lower()}"
    dst = Path(assets_dir) / rel
    if dst.exists():
        if sha256_file(dst) != row['sha256']:
            raise ValueError(f'{dst} is another file; nothing was overwritten')
        return rel
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
    return rel


def _peak_db(path: str | Path, start_s: float = 0.0, seconds: float | None = None, pct: float = 100.0) -> float:
    """The level of a sound in dBFS: its pct-th percentile of 50 ms peak levels (100 is the loudest)."""
    import numpy as np  # noqa: PLC0415
    cmd = [ffmpeg(), '-v', 'error', '-ss', f'{start_s:.3f}'] + (['-t', f'{seconds:.3f}'] if seconds else []) + [
        '-i', str(path), '-vn', '-ac', '1', '-ar', '48000', '-f', 'f32le', '-']
    x = np.abs(np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, np.float32))
    block = 2400
    if len(x) < block:
        return -120.0
    peaks = x[:len(x) // block * block].reshape(-1, block).max(axis=1)
    return float(20 * np.log10(np.percentile(peaks, pct) + 1e-9))


def moment(props: dict, start: int, end: int, given: int | None = None) -> int:
    """The frame the sound lands on: the one given, else the first big move inside the window, else a third of it in."""
    if given is not None:
        if not start <= given < end:
            raise ValueError(f'frame {given} is outside the window {start} to {end}')
        return given
    for event in sorted(props.get('events') or [], key=lambda e: e['atFrame']):
        if start <= int(event['atFrame']) < end and event.get('verb') in BIG_VERBS:
            return int(event['atFrame'])
    return start + (end - start) // 3


def audition(spec: dict, cut: str, directory: Path, props: dict, assets_dir: Path, ids: list[str], render_fn,
             *, at_frame: int | None = None, beat: str | None = None, rows: dict | None = None) -> dict:
    """Render the big-moment window once per candidate, each with only that sound on the moment; measure each hit."""
    from . import proof  # noqa: PLC0415
    from .compile import source  # noqa: PLC0415
    rows = rows if rows is not None else candidates()
    unknown = [i for i in ids if i not in rows]
    if unknown:
        raise ValueError(f"not on the shortlist (config/sfx-candidates.json): {', '.join(unknown)}")
    beat = beat or proof.hardest_beat(spec, cut, props)[0]
    start, end = proof.window(props, beat)
    frame = moment(props, start, end, at_frame)
    fps = props.get('fps', 30)
    stem = (props.get('audio') or {}).get('stem', {}).get('src')
    voice_db = _peak_db(stem, start / fps, (end - start) / fps, pct=95) if stem and Path(stem).is_file() else None
    folder = Path(directory) / 'sfx'
    folder.mkdir(parents=True, exist_ok=True)
    out = []
    for sid in ids:
        row = rows[sid]
        rel = stage(row, assets_dir)
        gain = float(row.get('gain_db', DEFAULT_GAIN_DB))
        window = proof.window_props(props, start, end)
        window['audio']['sfx'] = [{'src': source(rel, assets_dir), 'atFrame': frame - start, 'gainDb': gain}]
        props_path = write_json(folder / f'props.{sid}.json', window)
        clip = folder / f'{sid}.mp4'
        render_fn(props_path, clip)
        if not clip.is_file() or clip.stat().st_size == 0:
            raise ValueError(f'the audition render wrote nothing for {sid}')
        hit = _peak_db(Path(assets_dir) / rel) + gain
        relative = round(hit - voice_db, 1) if voice_db is not None else None
        out.append({'id': sid, 'title': row.get('title'), 'clip': clip.name, 'sha256': sha256_file(clip), 'gain_db': gain,
                    'hit_vs_voice_db': relative,
                    'level': (None if relative is None else 'too loud' if relative > LOUDEST_DB else
                              'too quiet' if relative < QUIETEST_DB else 'within')})
    record = {'schema': 've-sfx-audition/1', 'piece': spec['piece_id'], 'cut': cut, 'beat': beat,
              'window': [round(start / fps, 3), round(end / fps, 3)], 'at_frame': frame, 'at_s': round(frame / fps, 3),
              'rule': 'THE_BAR ruling 11: one sound, on the big moment only; nothing is used before Krish approves it by ear',
              'candidates': out}
    write_json(Path(directory) / 'sfx-audition.json', record)
    return record


def approve(sid: str, words: str, on: str, *, candidates_path: Path = CANDIDATES, approved_path: Path = APPROVED,
            kit_path: Path = KIT) -> dict:
    """Write his yes, in his words, then rebuild the kit from approved rows only."""
    if not str(words or '').strip():
        raise ValueError("a sound is approved only with Krish's own words")
    rows = candidates(candidates_path)
    if sid not in rows:
        raise ValueError(f'{sid} is not on the shortlist')
    row = rows[sid]
    if not row.get('sha256') or not row.get('file'):
        raise ValueError(f'{sid} was never downloaded, so he cannot have heard it')
    doc = load_json(approved_path)
    kept = [r for r in doc.get('approved') or [] if r.get('id') != sid]
    entry = {'id': sid, 'title': row.get('title'), 'provider': row.get('provider', 'Epidemic Sound'),
             'provider_id': row.get('provider_id'), 'file': row['file'], 'sha256': row['sha256'],
             'gain_db': float(row.get('gain_db', DEFAULT_GAIN_DB)),
             'approved_by': 'Krish', 'approved_on': on, 'approval_words': words.strip()}
    doc['approved'] = kept + [entry]
    write_json(approved_path, doc)
    return write_kit(approved_path, kit_path)


def write_kit(approved_path: Path = APPROVED, kit_path: Path = KIT) -> dict:
    """config/ve/sfx-kits/house-v1.json, the shape compile.py reads: {name: {path under assets, gain_db}}."""
    kit = {sid: {'path': f"sfx/{sid}{Path(row['file']).suffix.lower()}", 'gain_db': min(0.0, float(row.get('gain_db', DEFAULT_GAIN_DB)))}
           for sid, row in sorted(approved(approved_path).items())}
    Path(kit_path).parent.mkdir(parents=True, exist_ok=True)
    Path(kit_path).write_text(json.dumps(kit, indent=2) + '\n', encoding='utf-8')
    return kit


def kit_problems(kit_path: Path = KIT, approved_path: Path = APPROVED) -> list[str]:
    """A kit row that is not an approved sound, or names another file, is refused."""
    if not Path(kit_path).is_file():
        return []
    kit, ok = load_json(kit_path), approved(approved_path)
    return [f'kit sound {name} is not in the approved set' for name in kit if name not in ok]
