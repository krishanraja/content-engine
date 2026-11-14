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
  stage       copies the approved sounds into a cut's assets folder, where compile finds them. ve compile does it
              itself for every sound a cut uses (ensure_staged), and stops, naming the file, when an approved sound
              is not on this machine: a cut never goes out quietly without the sound its spec asks for.

Where an approved sound lives: the brand kit's Music folder, the one home for licensed music and sound
(docs/DRIVE.md; Drive 1oHyJ9A5et5_uKW7QTq1VHX0NuGwwQVri), under sfx/: MINDMAKE_MUSIC_ROOT/sfx/<id>.<ext>. A sound
he approves on his board is filed there by the apply job (velib/signoffs.apply, signoff-apply.yml) through the
engine's library at 1 Brand kit (permanent)/Music/sfx/<id>.<ext>; the home computers' library sync writes it into
that Drive folder, and `python scripts/quick-edit/music.py fetch` brings it to any other machine.

Nothing here places a sound on a cut: the spec does, on its one big-moment event.
"""
from __future__ import annotations

import json
import math
import os
import shutil
import subprocess
from pathlib import Path

from .common import ROOT, ffmpeg, load_json, sha256_file, write_json

CANDIDATES = ROOT / 'config' / 'sfx-candidates.json'
APPROVED = ROOT / 'config' / 'sfx-approved.json'
KIT = ROOT / 'config' / 've' / 'sfx-kits' / 'house-v1.json'
MUSIC_ENV = 'MINDMAKE_MUSIC_ROOT'
LIBRARY_MUSIC = '1 Brand kit (permanent)/Music'   # the brand kit's Music folder in the engine's library (music.py)
DRIVE_MUSIC_FOLDER = '1oHyJ9A5et5_uKW7QTq1VHX0NuGwwQVri'
BIG_VERBS = ('stamp', 'slam', 'enter', 'mark', 'count', 'drop')
LOUDEST_DB, QUIETEST_DB = 1.5, -22.0
DEFAULT_GAIN_DB = -8.0     # ghost-editor's "impact" role, relative to the voice's peak


def _rows(path: Path, key: str) -> list[dict]:
    return list((load_json(path) if Path(path).is_file() else {}).get(key) or [])


def candidates(path: Path = CANDIDATES) -> dict[str, dict]:
    return {row['id']: row for row in _rows(path, 'candidates') if row.get('id')}


def approved(path: Path = APPROVED) -> dict[str, dict]:
    """The sounds Krish approved: each names him and the sha256 of the file he heard, with his words or his Approve press
    on those exact bytes (the Sound effects card on his board, Ruling, Krish, 2026-11-12)."""
    return {row['id']: row for row in _rows(path, 'approved')
            if row.get('id') and row.get('sha256') and row.get('approved_by') == 'Krish'
            and (row.get('approval_words') or (row.get('approved_press') or {}).get('sha256') == row['sha256'])}


def style_problems(spec: dict) -> list[str]:
    """Sound ingredients name only approved bytes; this never approves a candidate."""
    sound = (spec.get('style') or {}).get('sound')
    if sound is None:
        return []
    if not isinstance(sound, dict):
        return ['style.sound must be an object']
    out = []
    if not isinstance(sound.get('reason'), str) or not sound['reason'].strip():
        out.append('style.sound.reason must explain the sound choice')
    if set(sound) - {'handover', 'hit', 'gainDb', 'reason'}:
        out.append('style.sound has unknown fields')
    if 'gainDb' in sound:
        gain = sound['gainDb']
        if isinstance(gain, bool) or not isinstance(gain, (int, float)) or not math.isfinite(gain) or gain > 0:
            out.append('style.sound.gainDb must be finite and <= 0')
    ok = approved(APPROVED)
    for role in ('handover', 'hit'):
        if role in sound and (not isinstance(sound[role], str) or sound[role] not in ok):
            out.append(f'style.sound.{role} {sound[role]!r} is not in the approved set (config/sfx-approved.json)')
    return out


def music_root() -> Path:
    root = os.environ.get(MUSIC_ENV)
    if not root:
        raise ValueError(f'{MUSIC_ENV} is not set (python scripts/quick-edit/music.py fetch prints it)')
    return Path(root)


def library_path(row: dict) -> str:
    """Where an approved sound is filed in the engine's library: the brand kit's Music folder, at its file's path."""
    return f"{LIBRARY_MUSIC}/{row['file']}"


def local_file(row: dict) -> Path:
    """The sound's file on this machine, checked against the sha256 it was shortlisted or approved with."""
    if not row.get('file') or not row.get('sha256'):
        raise ValueError(f"sound {row.get('id')}: not downloaded yet (no file and sha256); downloading waits for Krish's yes")
    try:
        root = music_root()
    except ValueError as unset:
        raise ValueError(f"sound {row['id']}: {unset}; it is filed at {library_path(row)}") from None
    path = root / row['file']
    if not path.is_file():
        raise ValueError(f"sound {row['id']}: {path} is missing on this machine. It is filed in the brand kit's Music folder "
                         f"(Drive {DRIVE_MUSIC_FOLDER}, {row['file']}); on a home computer the library sync puts it there, "
                         'anywhere else run python scripts/quick-edit/music.py fetch and set MINDMAKE_MUSIC_ROOT to the '
                         'folder it prints')
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
    from .qc import to_file  # noqa: PLC0415  the stem carries the sting's frames where it plays
    voice_db = _peak_db(stem, to_file(start, props) / fps, (end - start) / fps, pct=95) if stem and Path(stem).is_file() else None
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
                    'sound_sha256': row['sha256'],
                    'hit_vs_voice_db': relative,
                    'level': (None if relative is None else 'too loud' if relative > LOUDEST_DB else
                              'too quiet' if relative < QUIETEST_DB else 'within')})
    record = {'schema': 've-sfx-audition/1', 'piece': spec['piece_id'], 'cut': cut, 'beat': beat,
              'window': [round(start / fps, 3), round(end / fps, 3)], 'at_frame': frame, 'at_s': round(frame / fps, 3),
              'rule': 'THE_BAR ruling 11: one sound, on the big moment only; nothing is used before Krish approves it by ear',
              'candidates': out}
    write_json(Path(directory) / 'sfx-audition.json', record)
    return record


def approve(sid: str, words: str, on: str, audition_path: Path, *, candidates_path: Path = CANDIDATES,
            approved_path: Path = APPROVED, kit_path: Path = KIT) -> dict:
    """Write his yes, in his words, for a sound he heard on his own cut (its audition record), then rebuild the kit
    from approved rows only."""
    if not str(words or '').strip():
        raise ValueError("a sound is approved only with Krish's own words")
    rows = candidates(candidates_path)
    if sid not in rows:
        raise ValueError(f'{sid} is not on the shortlist')
    row = rows[sid]
    if not row.get('sha256') or not row.get('file'):
        raise ValueError(f'{sid} was never downloaded, so he cannot have heard it')
    local_file(row)   # the file on this machine is the one shortlisted and auditioned
    audition = load_json(audition_path) if Path(audition_path).is_file() else {}
    heard = next((c for c in audition.get('candidates') or [] if c.get('id') == sid), None)
    if not heard or not heard.get('sha256'):
        raise ValueError(f'{sid} is not in the audition record {audition_path}: he approves a sound he heard on his cut')
    if heard.get('sound_sha256') != row['sha256'] or float(heard.get('gain_db', DEFAULT_GAIN_DB)) != float(row.get('gain_db', DEFAULT_GAIN_DB)):
        raise ValueError(f'{sid} on the shortlist is not the sound or level he heard in the audition')
    clip = Path(audition_path).parent / 'sfx' / heard['clip']
    if not clip.is_file() or sha256_file(clip) != heard['sha256']:
        raise ValueError(f'the audition clip for {sid} is missing or changed since it was played')
    doc = load_json(approved_path)
    kept = [r for r in doc.get('approved') or [] if r.get('id') != sid]
    entry = {'id': sid, 'title': row.get('title'), 'provider': row.get('provider', 'Epidemic Sound'),
             'provider_id': row.get('provider_id'), 'file': row['file'], 'sha256': row['sha256'],
             'gain_db': float(row.get('gain_db', DEFAULT_GAIN_DB)),
             'auditioned_on': {'piece': audition.get('piece'), 'cut': audition.get('cut'), 'clip_sha256': heard['sha256']},
             'approved_by': 'Krish', 'approved_on': on, 'approval_words': words.strip()}
    doc['approved'] = kept + [entry]
    write_json(approved_path, doc)
    return write_kit(approved_path, kit_path)


def ensure_staged(sid: str, rel: str, assets_dir: Path, approved_path: Path = APPROVED) -> str:
    """A sound a cut uses, in the cut's assets folder at the kit's path: staged from MINDMAKE_MUSIC_ROOT when it is not
    there yet. Raises, never skips, when the sound is not approved, or is not on this machine, or is other bytes."""
    row = approved(approved_path).get(sid)
    if row is None:
        raise ValueError(f'kit sound {sid} is not in the approved set (config/sfx-approved.json)')
    staged = Path(assets_dir) / rel
    if staged.is_file():
        if sha256_file(staged) != row['sha256']:
            raise ValueError(f'sound {sid}: {staged} is not the file he approved (sha256 differs)')
        return rel
    got = stage(row, assets_dir)
    if got != rel:
        raise ValueError(f'sound {sid}: the kit names {rel}, but the approved file is {got}')
    return rel


def fetch_approved(folder: Path, out=print, approved_path: Path = APPROVED, fetch=None) -> int:
    """Every approved sound into folder at its file's path (sfx/<id>.<ext>), from the brand kit's Music folder in the
    engine's library and checked by its sha256: what music.py fetch does for any machine that renders. One the library
    lacks is said, by name; a cut that uses it then stops at ve compile. Returns how many are here."""
    if fetch is None:
        from .signoffs import library_fetch as fetch  # noqa: PLC0415  the one library download, sha256-checked
    here = 0
    for _sid, row in sorted(approved(approved_path).items()):
        target = Path(folder) / row['file']
        if target.is_file() and sha256_file(target) == row['sha256']:
            out(f"have           {row['file']}")
            here += 1
            continue
        try:
            fetch(library_path(row), target, row['sha256'])
        except ValueError as error:
            out(f"missing        {row['file']} (approved, but not fetched: {error}); a cut that uses it stops at ve compile")
            continue
        out(f"fetched        {row['file']}")
        here += 1
    return here


def missing_in_props(props: dict) -> list[str]:
    """Each sound a compiled cut plays whose file is not on this machine: ve render stops on any, never drops it."""
    return [str(s.get('src')) for s in (props.get('audio') or {}).get('sfx') or []
            if not str(s.get('src') or '').startswith(('http://', 'https://')) and not Path(str(s.get('src') or '')).is_file()]


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


# ---------------------------------------------------------------- heard on his board (Ruling, Krish, 2026-11-12)
# "One review card each: each goes on your Publish Board as a card with samples to look at and listen to, plus Approve
# or Not this." A sound he heard on the Sound effects card (config/ve/sign-offs.json, card sfx) is approved by his
# Approve press on its exact bytes, as surely as by an audition on his cut; the row says which he heard. Only
# velib/signoffs.apply calls these, with a press the engine kept as his (by Krish, bound to the sample's sha256).
REVIEW_WHERE = 'his Publish Board, To review: Sound effects'


def reviewed_state(sid: str, sha256: str, approved_path: Path = APPROVED) -> str | None:
    """approved, declined or None: what config/sfx-approved.json holds now for this sound's exact bytes."""
    doc = load_json(approved_path)
    if any(r.get('id') == sid and r.get('sha256') == sha256 for r in doc.get('approved') or []):
        return 'approved'
    if any(r.get('id') == sid and r.get('sha256') == sha256 for r in doc.get('declined') or []):
        return 'declined'
    return None


def _reviewed_row(sample: dict, on: str, at: str | None) -> dict:
    if not sample.get('sha256') or not sample.get('provider_id'):
        raise ValueError(f"{sample.get('id')}: a reviewed sound names its provider id and the sha256 he heard")
    return {'id': sample['id'], 'title': sample.get('title'), 'provider': sample.get('provider', 'Epidemic Sound'),
            'provider_id': sample['provider_id'], 'file': f"sfx/{sample['id']}{Path(sample.get('name') or '.wav').suffix.lower() or '.wav'}",
            'sha256': sample['sha256'], 'drive_id': (sample.get('drive') or {}).get('file_id'), 'slot': sample.get('slot'),
            'heard_on': {'where': REVIEW_WHERE, 'card': 'sfx', 'sample_sha256': sample['sha256'], **({'at': at} if at else {})}}


def approve_reviewed(sample: dict, *, words: str, on: str, at: str | None = None, approved_path: Path = APPROVED,
                     kit_path: Path = KIT, filed: dict | None = None) -> dict:
    """His Approve on a sound he heard on his board: one approved row (his press is the yes; his words when he gave
    any), any earlier no on the same bytes removed, and the kit rebuilt from approved rows only. `filed` says where the
    apply job filed those exact bytes (the brand kit's Music folder, filed_row), so the renderers find the file."""
    row = _reviewed_row(sample, on, at)
    if filed:
        row['filed'] = filed
    gain = float(sample.get('gain_db', DEFAULT_GAIN_DB))
    # His press is the yes: kept as the press it was (where, when, the bytes it names), never as words he did not type.
    row.update({'gain_db': gain, 'approved_by': 'Krish', 'approved_on': on,
                'approved_press': {'where': REVIEW_WHERE, 'press': 'Approve', 'sha256': sample['sha256'], **({'at': at} if at else {})},
                **({'approval_words': words.strip()} if words.strip() else {})})
    doc = load_json(approved_path)
    doc['approved'] = [r for r in doc.get('approved') or [] if r.get('id') != sample['id']] + [row]
    doc['declined'] = [r for r in doc.get('declined') or [] if r.get('id') != sample['id']]
    if not doc['declined']:
        doc.pop('declined')
    write_json(approved_path, doc)
    return write_kit(approved_path, kit_path)


def filed_row(sample: dict, row_file: str, on: str) -> dict:
    """The record of a sound filed in the brand kit's Music folder: where, which Drive folder, its bytes and sha256."""
    return {'library_path': f'{LIBRARY_MUSIC}/{row_file}', 'drive_folder': DRIVE_MUSIC_FOLDER,
            'music_root_path': row_file, 'sha256': sample['sha256'], 'bytes': sample.get('bytes'), 'on': on}


def reviewed_file(sample: dict) -> str:
    """The approved sound's path under MINDMAKE_MUSIC_ROOT (the Music folder): sfx/<id>.<ext>."""
    return _reviewed_row(sample, '', None)['file']


def decline_reviewed(sample: dict, *, words: str, on: str, at: str | None = None, approved_path: Path = APPROVED,
                     kit_path: Path = KIT) -> dict:
    """His Not this: recorded as his no, with the date, and the sound taken out of the approved set and the kit if it
    was in them."""
    row = _reviewed_row(sample, on, at)
    row.update({'declined_by': 'Krish', 'declined_on': on, **({'words': words.strip()} if words.strip() else {})})
    doc = load_json(approved_path)
    doc['approved'] = [r for r in doc.get('approved') or [] if r.get('id') != sample['id']]
    doc['declined'] = [r for r in doc.get('declined') or [] if r.get('id') != sample['id']] + [row]
    write_json(approved_path, doc)
    return write_kit(approved_path, kit_path)
