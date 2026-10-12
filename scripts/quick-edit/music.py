#!/usr/bin/env python3
"""The licensed music under Krish's videos: the ledger, the checks, the pick
and the bed.

Krish, 2026-10-12: "I am also going to get some licensed audio to put behind
my videos, so help me prepare to put it somewhere you and codex will always
know where that is, and use it correctly (high volume during the intro, low
whilst I am talking, higher during the outro)."

Where things live:
  - The audio files and their licence certificates sit in Google Drive at
    makeyourmindup > 00_Brand-Assets > 07_Music (Drive folder
    1pmPWx8vTOZuUXkp-WjhLlCTvof8MrRxK). Krish, 2026-10-12: "thats where it
    will live and the video runners need to know this". On the runner
    machines that is
    H:\\My Drive\\Ventures\\Active\\makeyourmindup\\00_Brand-Assets\\07_Music:
    env MINDMAKE_MUSIC_ROOT, else runtime.music_root in config/studio.json.
  - The ledger is config/music-library.json, committed. Audio is never
    committed (scripts/check-no-secrets.ts).
  - Only a track in the ledger, approved by Krish, with a licence that covers
    every place the cut is posted, is ever used. Nothing here browses Drive
    for audio: a file reaches the ledger only through `add`, by its path.

    python music.py list
    python music.py check [--strict]
    python music.py add FILE --provider NAME --licence-id ID --licence-file FILE [--title ..] [--platforms youtube,substack,..]
    python music.py approve TRACK_ID --words "Krish's exact words"
    python music.py approve-levels --words "Krish's exact words"
    python music.py pick --piece ID --both-cuts [--seconds N]
    python music.py pick --seconds N [--piece ID] [--shape 16x9|9x16 | --platforms youtube,substack]
    python music.py publish                 (a home computer: send every ledger file in the music folder to the engine's library)
    python music.py fetch [--out DIR]       (any machine: get every ledger file from the library; prints MINDMAKE_MUSIC_ROOT)
    python music.py --self-test

`add` measures the file (ebur128 loudness and true peak, length, sample rate,
sha256) and writes it as "proposed". `approve` records Krish's words; it
never approves on anyone else's say. make.py calls pick_for_piece() and
bed_filter(): both cuts of a piece get one track, the first in the piece's
rotation that is licensed for every place either cut goes and long enough for
the long cut (`pick --both-cuts [--seconds LONG_CUT]` shows which; make.py
takes the long cut's length from kit.json, else asks for PIECE_SECONDS).
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
LEDGER = REPO / 'config' / 'music-library.json'
STUDIO = REPO / 'config' / 'studio.json'
PLATFORMS = ('youtube', 'substack', 'shorts', 'tiktok', 'reels', 'linkedin')
# Where each cut is posted (house rules TWO_CUTS and CORE_CHANNELS): a track
# must be licensed for every one of them.
SHAPE_PLATFORMS = {'16x9': ('youtube', 'substack'), '9x16': ('shorts', 'reels', 'tiktok', 'linkedin')}
# Both cuts of one piece carry the same track (TWO_CUTS: the long cut wide,
# the short cut tall), so each cut asks for what the pair needs: a licence
# for every place either shape is posted, and music as long as the piece's
# longer cut. make.py gives that length (`longest`): the long cut's
# recording, which kit.py measures into kit.json, plus the most a sting and
# the end card add; the same number for both cuts. Only when it is not known
# does a cut ask for PIECE_SECONDS, the longest a long cut runs (495 words at
# an unhurried 150 a minute is 198 s, plus a sting of at most 2 s, the 4 s
# end card and room for a slower pace).
PIECE_SECONDS = 240.0
PIECE_PLATFORMS = tuple(dict.fromkeys(p for shape in ('16x9', '9x16') for p in SHAPE_PLATFORMS[shape]))
STATUSES = ('proposed', 'approved', 'retired')
TRACK_FIELDS = (
    'id', 'title', 'artist', 'provider', 'provider_track_id', 'provider_url', 'licence_type', 'licence_id', 'licensee',
    'licence_file', 'acquired_on', 'expires_on', 'platforms', 'monetisation_ok', 'content_id_cleared', 'attribution',
    'restrictions', 'file', 'sha256', 'bytes', 'duration_s', 'sample_rate', 'measured_lufs', 'measured_true_peak',
    'intro_cue_s', 'outro_cue_s', 'mood', 'status', 'approved_by', 'approved_on', 'approval_words')
OPTIONAL_FIELDS = ('loopable', 'drive_file_id')
LEVEL_KEYS = ('intro_lufs', 'bed_lufs', 'outro_lufs', 'ramp_down_s', 'ramp_up_s', 'final_integrated_lufs', 'tolerance_lu', 'max_true_peak_dbtp')
RATE = 48000
FADE_IN_S = 0.03   # no click where the track is cut in
FADE_OUT_S = 1.0   # the bed fades over the last second of the video
MIN_WINDOW_S = 0.4  # one ebur128 block: a shorter stretch has no loudness


class MusicError(ValueError):
    """A reason to stop, in words a person can act on."""


# The ledger.

def ledger_path(given=None):
    return Path(given or os.environ.get('MINDMAKE_MUSIC_LEDGER') or LEDGER)


def load(path=None):
    path = ledger_path(path)
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except FileNotFoundError:
        raise MusicError(f'no music ledger at {path}')
    if data.get('schema_version') != 1:
        raise MusicError(f'{path}: schema_version must be 1')
    data.setdefault('tracks', [])
    return data


def save(data, path=None):
    ledger_path(path).write_text(json.dumps(data, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')


def music_root(data=None):
    """The folder holding the audio: MINDMAKE_MUSIC_ROOT, else
    runtime.music_root in config/studio.json, else on Windows the ledger's
    default. None when none is set."""
    data = data or {}
    env = os.environ.get(data.get('root_env') or 'MINDMAKE_MUSIC_ROOT') or os.environ.get('MINDMAKE_MUSIC_ROOT')
    if env:
        return Path(env)
    try:
        runtime = json.loads(STUDIO.read_text(encoding='utf-8')).get('runtime', {})
        if runtime.get('music_root') and os.name == 'nt':
            return Path(runtime['music_root'])
    except (OSError, ValueError):
        pass
    if os.name == 'nt' and data.get('root_default_windows'):
        return Path(data['root_default_windows'])
    return None


def in_root(root, rel):
    """A ledger path (always written with forward slashes) under the root."""
    return Path(root).joinpath(*[part for part in str(rel).split('/') if part])


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for block in iter(lambda: f.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def levels_of(data):
    levels = data.get('levels') or {}
    missing = [k for k in LEVEL_KEYS if not isinstance(levels.get(k), (int, float))]
    if missing:
        raise MusicError(f'the ledger\'s "levels" is missing {", ".join(missing)}')
    return levels


# Measuring.

def ebur128(path, start=None, end=None, chain=''):
    """Loudness of a file, or of the stretch from `start` to `end` seconds:
    {'I': integrated LUFS, 'TP': true peak dBTP, 'LRA': LU, 'thresh': the
    integrated gate}. A stretch with no sound reads None. This is the meter
    the report and the Studio's QA use, so the mix is steered by it too."""
    trim = f'atrim=start={start:.4f}:end={end:.4f},' if start is not None else ''
    af = f'{chain + "," if chain else ""}{trim}ebur128=peak=true:framelog=quiet'
    p = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(path), '-vn', '-af', af, '-f', 'null', '-'],
                       capture_output=True, text=True)
    if p.returncode:
        raise MusicError(f'ffmpeg could not measure {path}: {p.stderr.strip()[-400:]}')
    summary = p.stderr[p.stderr.rfind('Summary:'):]

    def grab(label, unit):
        m = re.search(rf'{label}:\s+(-?inf|-?[\d.]+)\s+{unit}', summary)
        if not m or 'inf' in m.group(1):
            return None
        v = float(m.group(1))
        return None if v <= -69.9 else v
    gate = re.search(r'Integrated loudness:\s+I:\s+\S+ LUFS\s+Threshold:\s+(-?[\d.]+) LUFS', summary)
    return {'I': grab('I', 'LUFS'), 'TP': grab('Peak', 'dBFS'), 'LRA': grab('LRA', 'LU'), 'thresh': float(gate.group(1)) if gate else None}


def probe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=sample_rate,channels:format=duration',
                          '-of', 'json', str(path)], capture_output=True, text=True)
    info = json.loads(out.stdout or '{}')
    if not info.get('streams'):
        raise MusicError(f'{path} has no audio stream')
    return float(info['format']['duration']), int(info['streams'][0]['sample_rate'])


def measure(path):
    """What `add` records about a file."""
    seconds, rate = probe(path)
    loud = ebur128(path)
    return {'sha256': sha256_of(path), 'bytes': Path(path).stat().st_size, 'duration_s': round(seconds, 3), 'sample_rate': rate,
            'measured_lufs': loud['I'], 'measured_true_peak': loud['TP']}


# Choosing a track.

def problems(track, platforms=(), today=None, seconds=None):
    """Every reason this track cannot go under a cut posted to `platforms`.
    Empty means it can."""
    today = today or date.today().isoformat()
    why = []
    if track.get('status') != 'approved':
        why.append(f'its status is {track.get("status")!r}, not approved')
    if not str(track.get('approved_by') or '').lower().startswith('krish') or not track.get('approved_on') or not str(track.get('approval_words') or '').strip():
        why.append('it has no recorded approval from Krish (approved_by, approved_on and his words)')
    for key in ('licence_id', 'licence_file', 'file', 'sha256'):
        if not track.get(key):
            why.append(f'it has no {key}')
    if track.get('expires_on') and str(track['expires_on']) < today:
        why.append(f'its licence expired on {track["expires_on"]}')
    if track.get('acquired_on') and str(track['acquired_on']) > today:
        why.append(f'its licence starts on {track["acquired_on"]}')
    have = set(track.get('platforms') or [])
    gaps = [p for p in platforms if p not in have]
    if gaps:
        why.append(f'its licence does not cover {", ".join(gaps)}')
    if any(p in ('youtube', 'shorts') for p in platforms) and track.get('content_id_cleared') is not True:
        why.append('it is not cleared for YouTube Content ID')
    if not isinstance(track.get('measured_lufs'), (int, float)):
        why.append('its loudness was never measured')
    if seconds is not None and not track.get('loopable') and isinstance(track.get('duration_s'), (int, float)):
        left = track['duration_s'] - float(track.get('intro_cue_s') or 0)
        if left < seconds:
            why.append(f'it runs {left:.1f} s from its intro cue, short of {seconds:.1f} s, and is not marked loopable')
    return why


def rotation(piece, data):
    """Every approved track, in the order this piece tries them: by id,
    starting at a stable index from the piece. The index is taken over all
    approved tracks, before any is checked against a cut, so the order is
    the piece's alone and never depends on which cut is asking."""
    approved = sorted((t for t in data.get('tracks', []) if t.get('status') == 'approved'), key=lambda t: str(t.get('id')))
    if not approved:
        return []
    at = int(hashlib.sha256(str(piece).encode()).hexdigest()[:8], 16) % len(approved) if piece else 0
    return approved[at:] + approved[:at]


def pick(seconds, piece=None, platforms=(), data=None, today=None):
    """The track for `seconds` of music posted to `platforms`, or None, and
    why each track was passed over: every track not approved, and each
    approved one tried before the pick. It goes round the piece's rotation
    and takes the first track that fits, so different pieces rotate through
    the approved tracks and the same needs always get the same track. For
    the two cuts of a piece, ask with the piece's needs (pick_for_piece), or
    the long cut and the short cut can land on different tracks."""
    data = data if data is not None else load()
    skipped = {}
    for track in data.get('tracks', []):
        if track.get('status') != 'approved':
            skipped[track.get('id', '?')] = problems(track, platforms, today, seconds)
    for track in rotation(piece, data):
        why = problems(track, platforms, today, seconds)
        if not why:
            return track, skipped
        skipped[track.get('id', '?')] = why
    return None, skipped


def piece_needs(*seconds, longest=None):
    """What the music of a piece must cover, whichever cut asks: a licence
    for every place either cut is posted, and the longest of the piece's
    longer cut (`longest`, else PIECE_SECONDS) and any length given.
    {'seconds': .., 'platforms': [..]}"""
    given = [float(s) for s in seconds if isinstance(s, (int, float))]
    floor = float(longest) if isinstance(longest, (int, float)) and longest > 0 else PIECE_SECONDS
    return {'seconds': round(max([floor, *given]), 3), 'platforms': list(PIECE_PLATFORMS)}


def pick_for_piece(piece, seconds=None, data=None, today=None, longest=None):
    """The one track both cuts of a piece carry: (track or None, skipped,
    needs). `longest` is the piece's longer cut, the same for both cuts
    (make.py reads it from kit.json); `seconds` is the asking cut's own
    length, which only counts if it is longer still (make.py says so)."""
    needs = piece_needs(seconds, longest=longest)
    track, skipped = pick(needs['seconds'], piece, needs['platforms'], data, today)
    return track, skipped, needs


def by_id(track_id, data=None):
    data = data if data is not None else load()
    for track in data.get('tracks', []):
        if track.get('id') == track_id:
            return track
    raise MusicError(f'no track {track_id!r} in the music ledger')


def resolve(track, data=None):
    """The track's audio file, checked against the ledger's sha256 and size."""
    root = music_root(data)
    if not root:
        raise MusicError(f'no music folder: set MINDMAKE_MUSIC_ROOT (on the runner machines it is {(data or {}).get("root_default_windows") or "the Drive folder in config/music-library.json"})')
    if not root.is_dir():
        raise MusicError(f'the music folder {root} is not reachable: check that Google Drive is running')
    path = in_root(root, track['file'])
    if not path.is_file():
        raise MusicError(f'{track["id"]}: {path} is missing')
    if track.get('bytes') and path.stat().st_size != track['bytes']:
        raise MusicError(f'{track["id"]}: {path} is {path.stat().st_size} bytes, the ledger says {track["bytes"]}')
    if sha256_of(path) != track.get('sha256'):
        raise MusicError(f'{track["id"]}: {path} does not match the sha256 in the ledger, so it is not the file Krish approved')
    return path


# The bed.

def envelope(track, timeline, levels):
    """The bed's level over the video, from the timeline:
      intro_s         the sting's length (0 when there is none)
      voice_start_s   Krish's first word, on the video's clock
      voice_end_s     his last word
      total_s         the whole video, end card included
      window_lufs     optional: the placed track's own loudness over the
                      intro, voice and outro stretches (make.py measures it),
                      else the track's measured_lufs stands in for all three
    Returns the gain at each turning point (dB) and the stretches where each
    level holds, which is where the levels are measured."""
    T, I = float(timeline['total_s']), float(timeline.get('intro_s') or 0)
    vs, ve = float(timeline['voice_start_s']), float(timeline['voice_end_s'])
    ref = float(track['measured_lufs'])
    w = timeline.get('window_lufs') or {}
    src = {k: (w.get(k) if isinstance(w.get(k), (int, float)) else ref) for k in ('intro', 'voice', 'outro')}
    g = {'intro': levels['intro_lufs'] - src['intro'], 'bed': levels['bed_lufs'] - src['voice'], 'outro': levels['outro_lufs'] - src['outro']}
    # High over the sting, down over ramp_down_s so it sits at the bed level
    # by his first word, up over ramp_up_s from his last word.
    a = max(0.0, vs - levels['ramp_down_s']) if I > 0 else 0.0
    b = vs if I > 0 else 0.0
    c, d = ve, min(T, ve + levels['ramp_up_s'])
    fade = min(FADE_OUT_S, max(0.0, T - d))
    points = [(0.0, g['intro'] if I > 0 else g['bed']), (a, g['intro'] if I > 0 else g['bed']), (b, g['bed']), (c, g['bed']), (d, g['outro']), (T, g['outro'])]
    windows = {
        'intro': [0.0, round(a, 4)] if I > 0 and a >= MIN_WINDOW_S else None,
        'voice': [round(vs, 4), round(ve, 4)] if ve - vs >= MIN_WINDOW_S else None,
        'outro': [round(d, 4), round(T - fade, 4)] if T - fade - d >= MIN_WINDOW_S else None,
    }
    return {'gains_db': {k: round(v, 2) for k, v in g.items()}, 'points': [(round(t, 4), round(v, 3)) for t, v in points],
            'windows': windows, 'fade_out_s': round(fade, 3), 'source_lufs': src}


def gain_expr(points):
    """The piecewise-linear dB curve through `points` as an ffmpeg expression
    in t, as a linear gain for `volume=...:eval=frame`."""
    expr = f'{points[-1][1]:.3f}'
    for (t0, g0), (t1, g1) in reversed(list(zip(points, points[1:]))):
        if t1 <= t0:
            continue
        seg = f'{g0:.3f}' if g0 == g1 else f'({g0:.3f}+({g1 - g0:.3f})*(t-{t0:.4f})/{t1 - t0:.4f})'
        expr = f'if(lt(t,{t1:.4f}),{seg},{expr})'
    return f'pow(10,({expr})/20)'


def placement(track, timeline, src='0:a', out='raw', xf=0.8):
    """The track laid along the video without any level change: from its
    intro cue, looped when it is marked loopable and too short, and when it
    has an outro cue and is long enough, its ending crossfaded in as the bed
    rises after the last word."""
    T = float(timeline['total_s'])
    ve = float(timeline['voice_end_s'])
    total = round(T * RATE)
    cue = float(track.get('intro_cue_s') or 0)
    length = float(track.get('duration_s') or 0)
    xf = max(0.1, float(xf))
    norm = f'aresample={RATE},aformat=sample_fmts=fltp:sample_rates={RATE}:channel_layouts=stereo'
    outro = track.get('outro_cue_s')
    if (isinstance(outro, (int, float)) and outro > cue and length - outro >= T - ve + 0.05 and length - cue >= ve + xf):
        return (f'[{src}]{norm},asplit=2[{out}_a][{out}_b];'
                f'[{out}_a]atrim=start={cue:.4f}:duration={ve + xf:.4f},asetpts=PTS-STARTPTS[{out}_c];'
                f'[{out}_b]atrim=start={outro:.4f},asetpts=PTS-STARTPTS[{out}_d];'
                f'[{out}_c][{out}_d]acrossfade=d={xf:.4f}:c1=tri:c2=tri,apad,atrim=end_sample={total},asetpts=PTS-STARTPTS[{out}]'), 'outro cue'
    loop = ''
    how = 'straight'
    if track.get('loopable') and length - cue < T:
        loop = f',aloop=loop=-1:size={int((length - cue) * RATE) + RATE}'
        how = 'looped'
    return f'[{src}]{norm},atrim=start={cue:.4f},asetpts=PTS-STARTPTS{loop},apad,atrim=end_sample={total},asetpts=PTS-STARTPTS[{out}]', how


def bed_filter(track, timeline, levels, src='0:a', out='bed', unity=False):
    """The ffmpeg filter that turns the track into the bed under the whole
    video: placed (placement()), then a time envelope (volume with
    eval=frame, in 10 ms steps so the ramps are smooth), a short fade in and a
    fade over the last second. A time envelope, not sidechain compression:
    the cut is already tight, so a sidechain would only pump. `unity` leaves
    the level alone, for measuring the placed track."""
    chain, _ = placement(track, timeline, src, f'{out}_placed', levels['ramp_up_s'])
    if unity:
        return chain.replace(f'[{out}_placed]', f'[{out}]')
    T = float(timeline['total_s'])
    env = envelope(track, timeline, levels)
    fade = env['fade_out_s']
    tail = f',afade=t=out:st={T - fade:.4f}:d={fade:.4f}' if fade > 0 else ''
    return (f'{chain};[{out}_placed]asetnsamples=n=480:p=0,volume=\'{gain_expr(env["points"])}\':eval=frame,'
            f'afade=t=in:st=0:d={FADE_IN_S}{tail},atrim=end_sample={round(T * RATE)},asetpts=PTS-STARTPTS[{out}]')


# The commands.

def check(data, strict=False):
    """Errors and warnings about the ledger and, where the music folder is
    reachable, the files it names."""
    errors, warnings = [], []
    try:
        levels = levels_of(data)
        if levels.get('status') not in ('proposed', 'approved'):
            errors.append('levels.status is "proposed" or "approved"')
        if levels.get('status') == 'proposed':
            warnings.append('the mix levels are still proposed: Krish has not approved them by ear')
        if not (levels['intro_lufs'] > levels['bed_lufs'] and levels['outro_lufs'] > levels['bed_lufs']):
            errors.append('levels: the bed must sit below the intro and the outro')
    except MusicError as e:
        errors.append(str(e))
    root = music_root(data)
    reachable = bool(root and root.is_dir())
    if not reachable:
        (errors if strict else warnings).append(
            f'the music folder is not reachable here ({root or "MINDMAKE_MUSIC_ROOT is not set"}), so no file was checked')
    seen = set()
    for t in data.get('tracks', []):
        tid = t.get('id') or '?'
        if tid in seen:
            errors.append(f'{tid}: the id is used twice')
        seen.add(tid)
        unknown = [k for k in t if k not in TRACK_FIELDS and k not in OPTIONAL_FIELDS]
        absent = [k for k in TRACK_FIELDS if k not in t]
        if unknown:
            warnings.append(f'{tid}: fields the ledger does not know: {", ".join(unknown)}')
        if absent:
            errors.append(f'{tid}: missing {", ".join(absent)}')
        if t.get('file') and not t.get('sha256'):
            warnings.append(f'{tid}: listed but not measured yet: on a runner machine, '
                            f'run music.py add on "{t["file"]}" in the music folder with its licence')
        if t.get('status') not in STATUSES:
            errors.append(f'{tid}: status is one of {", ".join(STATUSES)}')
        bad = [p for p in (t.get('platforms') or []) if p not in PLATFORMS]
        if bad:
            errors.append(f'{tid}: unknown platforms {", ".join(bad)}')
        if t.get('status') == 'approved':
            why = problems(t)
            if why:
                errors.append(f'{tid} is approved but cannot be used: {"; ".join(why)}')
            if reachable:
                try:
                    resolve(t, data)
                    lic = in_root(root, t['licence_file'])
                    if not lic.is_file():
                        errors.append(f'{tid}: its licence file {lic} is missing')
                except MusicError as e:
                    errors.append(str(e))
        for key in ('acquired_on', 'expires_on', 'approved_on'):
            if t.get(key):
                try:
                    date.fromisoformat(str(t[key]))
                except ValueError:
                    errors.append(f'{tid}: {key} is a date, YYYY-MM-DD')
        if t.get('expires_on') and t.get('status') != 'retired' and re.fullmatch(r'\d{4}-\d{2}-\d{2}', str(t['expires_on'])):
            left = (date.fromisoformat(str(t['expires_on'])) - date.today()).days
            if 0 <= left <= 30:
                warnings.append(f'{tid}: its licence ends in {left} days ({t["expires_on"]})')
    return errors, warnings


def cmd_add(a, data):
    root = music_root(data)
    if not root or not root.is_dir():
        raise MusicError(f'the music folder is not reachable ({root or "set MINDMAKE_MUSIC_ROOT"}): add a track on the machine that has it')
    path = Path(a.file).resolve()
    try:
        rel = path.relative_to(root.resolve()).as_posix()
    except ValueError:
        raise MusicError(f'{path} is not inside the music folder {root}: put the file there first, then add it')
    lic = Path(a.licence_file)
    lic = lic.resolve() if lic.is_absolute() else in_root(root, a.licence_file).resolve()
    if not lic.is_file():
        raise MusicError(f'no licence file at {lic}: save the certificate in the music folder first')
    lic_rel = lic.relative_to(root.resolve()).as_posix()
    facts = measure(path)
    # A track listed before anyone could measure it (its file named, no
    # sha256 yet) is completed in place: what it already says stays unless
    # given again.
    seed = next((t for t in data['tracks'] if t.get('file') == rel and not t.get('sha256')), None)
    others = [t for t in data['tracks'] if t is not seed]
    if any(t.get('sha256') == facts['sha256'] for t in others):
        raise MusicError(f'{path.name} is already in the ledger')
    tid = a.id or (seed or {}).get('id') or re.sub(r'[^a-z0-9]+', '-', (a.title or path.stem).lower()).strip('-')
    if any(t.get('id') == tid for t in others):
        raise MusicError(f'the id {tid!r} is taken: give --id')
    platforms = [p.strip().lower() for p in (a.platforms or '').split(',') if p.strip()]
    bad = [p for p in platforms if p not in PLATFORMS]
    if bad:
        raise MusicError(f'unknown platforms {", ".join(bad)}: use {", ".join(PLATFORMS)}')
    yes = lambda v: None if v is None else v.lower() in ('yes', 'true', '1')
    track = {
        'id': tid, 'title': a.title or path.stem, 'artist': a.artist, 'provider': a.provider, 'provider_track_id': a.provider_track_id,
        'provider_url': a.provider_url, 'licence_type': a.licence_type, 'licence_id': a.licence_id, 'licensee': a.licensee,
        'licence_file': lic_rel, 'acquired_on': a.acquired_on, 'expires_on': a.expires_on, 'platforms': platforms,
        'monetisation_ok': yes(a.monetisation_ok), 'content_id_cleared': yes(a.content_id_cleared), 'attribution': a.attribution,
        'restrictions': a.restrictions, 'file': rel, **facts, 'intro_cue_s': a.intro_cue, 'outro_cue_s': a.outro_cue, 'mood': a.mood,
        'status': 'proposed', 'approved_by': None, 'approved_on': None, 'approval_words': None,
    }
    if a.loopable:
        track['loopable'] = True
    if seed:
        if not a.title and seed.get('title'):
            track['title'] = seed['title']
        for key, value in seed.items():
            if key not in ('status', 'approved_by', 'approved_on', 'approval_words') and track.get(key) in (None, '', []) \
                    and value not in (None, '', []):
                track[key] = value
        data['tracks'][data['tracks'].index(seed)] = track
    else:
        data['tracks'].append(track)
    return track


def approval(words, by):
    words = (words or '').strip()
    if not words:
        raise MusicError('--words is Krish\'s own words of approval, exactly as he said them')
    if not by.lower().startswith('krish'):
        raise MusicError('only Krish approves music or its levels')
    return words


def self_test():
    """Builds a music folder under .cache with a synthetic chord and a fake
    licence, then adds, approves, picks and lays a bed, and measures it."""
    import tempfile
    checks = []
    work = REPO / '.cache' / 'quick-edit' / 'self-test' / 'music'
    shutil.rmtree(work, ignore_errors=True)
    (work / 'root' / 'licences').mkdir(parents=True)
    chord = work / 'root' / 'chord.wav'
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y',
                    *[x for f in (130.81, 261.63, 329.63, 392.0) for x in ('-f', 'lavfi', '-i', f'sine=f={f}:d=12:r={RATE}')],
                    '-filter_complex', '[0][1][2][3]amix=inputs=4:normalize=0,volume=0.4,aformat=channel_layouts=stereo', str(chord)], check=True)
    (work / 'root' / 'licences' / 'chord.txt').write_text('synthetic self-test licence, not a real one\n')
    ledger = work / 'music-library.json'
    base = json.loads(LEDGER.read_text(encoding='utf-8'))
    base['tracks'] = []
    ledger.write_text(json.dumps(base, indent=2) + '\n')
    env_before = {k: os.environ.get(k) for k in ('MINDMAKE_MUSIC_ROOT', 'MINDMAKE_MUSIC_LEDGER')}
    os.environ['MINDMAKE_MUSIC_ROOT'] = str(work / 'root')
    os.environ['MINDMAKE_MUSIC_LEDGER'] = str(ledger)
    try:
        run = lambda *args: subprocess.run([sys.executable, __file__, *args], capture_output=True, text=True)
        added = run('add', str(chord), '--provider', 'self-test', '--licence-id', 'TEST-1', '--licence-file', 'licences/chord.txt',
                    '--title', 'Test chord', '--platforms', ','.join(PLATFORMS), '--content-id-cleared', 'yes', '--loopable',
                    '--acquired-on', '2026-10-01')
        checks.append(('add measures and writes a proposed track', added.returncode, 0))
        data = load(ledger)
        t = data['tracks'][0] if data['tracks'] else {}
        checks.append(('the measured loudness is on the track', isinstance(t.get('measured_lufs'), float), True))
        checks.append(('a proposed track is never picked', pick(30, 'p', SHAPE_PLATFORMS['16x9'], data)[0], None))
        checks.append(('approval needs Krish\'s words', run('approve', 'test-chord').returncode != 0, True))
        checks.append(('approval with words', run('approve', 'test-chord', '--words', 'synthetic self-test track, not a real approval').returncode, 0))
        data = load(ledger)
        got, _ = pick(30, 'piece-1', SHAPE_PLATFORMS['9x16'], data)
        checks.append(('an approved, licensed, loopable track is picked', got and got['id'], 'test-chord'))
        checks.append(('check passes with the file present', check(data)[0], []))
        two = json.loads(json.dumps(data))
        extra = dict(two['tracks'][0], id='test-chord-b')
        two['tracks'].append(extra)
        picks = {pick(30, f'piece-{n}', (), two)[0]['id'] for n in range(12)}
        checks.append(('pieces rotate through the approved tracks', picks, {'test-chord', 'test-chord-b'}))
        checks.append(('the same piece always gets the same track', pick(30, 'piece-7', (), two)[0]['id'], pick(30, 'piece-7', (), two)[0]['id']))
        # The reviewer's case (2026-10-12): A runs 120 s and does not loop, B
        # runs 300 s. Asked cut by cut, Monday's long cut (205 s, 16x9) got B
        # and its short cut (92 s, 9x16) got A. Asked with the piece's needs,
        # both cuts get B.
        mon = 'f328382d-71b3-41a7-a221-d8615826f12e'
        a_track = dict(data['tracks'][0], id='a-short-track', duration_s=120.0, intro_cue_s=0.0, loopable=False)
        b_track = dict(data['tracks'][0], id='b-long-track', duration_s=300.0, intro_cue_s=0.0, loopable=False)
        ab = {'tracks': [a_track, b_track]}
        checks.append(('the A/B case: its rotation starts on A, the short track', [t['id'] for t in rotation(mon, ab)], ['a-short-track', 'b-long-track']))
        checks.append(('the A/B case: cut by cut, the two cuts land on different tracks',
                       (pick(205.0, mon, SHAPE_PLATFORMS['16x9'], ab)[0]['id'], pick(92.0, mon, SHAPE_PLATFORMS['9x16'], ab)[0]['id']),
                       ('b-long-track', 'a-short-track')))
        checks.append(('the A/B case: with the piece\'s needs both cuts get the same track',
                       (pick_for_piece(mon, 205.0, ab)[0]['id'], pick_for_piece(mon, 92.0, ab)[0]['id']), ('b-long-track', 'b-long-track')))
        checks.append(('the piece\'s needs: every place either cut goes, and at least PIECE_SECONDS when the long cut is not known',
                       (piece_needs(92.0), piece_needs(300.0)['seconds']),
                       ({'seconds': PIECE_SECONDS, 'platforms': ['youtube', 'substack', 'shorts', 'reels', 'tiktok', 'linkedin']}, 300.0)))
        # The second reviewer's case (2026-10-12): one approved, licensed 200 s
        # track that does not loop. Asked for a fixed 240 s, neither of
        # Monday's cuts (177.8 s and 84.0 s) got it. Asked for the long cut's
        # real length, both do.
        c200 = dict(b_track, id='c-200-track', duration_s=200.0)
        only = {'tracks': [c200]}
        checks.append(('a 200 s track under a 4-minute floor goes under neither cut',
                       (pick_for_piece(mon, 177.8, only)[0], pick_for_piece(mon, 84.0, only)[0]), (None, None)))
        checks.append(('with the long cut\'s length both cuts get it, the same track',
                       (pick_for_piece(mon, 177.8, only, longest=183.8)[0]['id'], pick_for_piece(mon, 84.0, only, longest=183.8)[0]['id'],
                        pick_for_piece(mon, 84.0, only, longest=183.8)[2]['seconds']), ('c-200-track', 'c-200-track', 183.8)))
        checks.append(('a long cut longer than its track still is not given it', pick_for_piece(mon, 205.0, only, longest=205.0)[0], None))
        c_track = dict(b_track, id='c-long-track')
        abc = {'tracks': [a_track, b_track, c_track]}
        pairs = [(pick_for_piece(f'piece-{n}', 205.0, abc)[0]['id'], pick_for_piece(f'piece-{n}', 92.0, abc)[0]['id']) for n in range(12)]
        checks.append(('every piece\'s two cuts share a track, and pieces still rotate', (all(x == y for x, y in pairs), {x for x, _ in pairs}),
                       (True, {'b-long-track', 'c-long-track'})))
        wide_only = dict(b_track, platforms=['youtube', 'substack'])
        checks.append(('a track not licensed for the short cut\'s places goes under neither cut', pick_for_piece(mon, 205.0, {'tracks': [wide_only]})[0], None))
        lapsed = dict(data['tracks'][0], expires_on='2026-01-01')
        checks.append(('an expired licence is passed over', pick(30, 'p', (), {'tracks': [lapsed]})[0], None))
        narrow = dict(data['tracks'][0], platforms=['youtube', 'substack'])
        _, why = pick(30, 'p', SHAPE_PLATFORMS['9x16'], {'tracks': [narrow]})
        checks.append(('a licence that misses TikTok is passed over for the tall cut', 'tiktok' in ' '.join(why.get('test-chord', [])), True))
        short = dict(data['tracks'][0], loopable=False)
        checks.append(('a short track that does not loop is passed over', pick(30, 'p', (), {'tracks': [short]})[0], None))
        tampered = work / 'root' / 'chord.wav'
        # The bed itself: placed, enveloped, measured against the levels.
        levels = levels_of(data)
        tl = {'intro_s': 1.5, 'voice_start_s': 1.6, 'voice_end_s': 20.0, 'total_s': 25.0}
        env = envelope(data['tracks'][0], tl, levels)
        checks.append(('the ramp down ends at the first word', env['points'][2], (1.6, env['gains_db']['bed'])))
        checks.append(('the ramp up ends ramp_up_s after the last word', env['points'][4][0], 20.8))
        with tempfile.TemporaryDirectory() as tmp:
            bed = Path(tmp) / 'bed.wav'
            graph = bed_filter(load(ledger)['tracks'][0], tl, levels, src='0:a', out='bed')
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(resolve(load(ledger)['tracks'][0])),
                            '-filter_complex', graph, '-map', '[bed]', '-c:a', 'pcm_f32le', str(bed)], check=True)
            secs, _ = probe(bed)
            checks.append(('the bed is exactly the video\'s length', round(secs, 3), 25.0))
            w = env['windows']
            got = {k: ebur128(bed, *w[k])['I'] for k in ('intro', 'voice', 'outro')}
            want = {'intro': levels['intro_lufs'], 'voice': levels['bed_lufs'], 'outro': levels['outro_lufs']}
            checks.append(('the bed sits at each level within 0.5 LU', {k: abs(got[k] - want[k]) <= 0.5 for k in got}, {k: True for k in got}))
            # A long track with an ending: its outro cue lands on his last
            # word, crossfaded in as the bed rises, and the bed stays exact.
            long = Path(tmp) / 'long.wav'
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', f'sine=f=220:d=30:r={RATE}',
                            '-f', 'lavfi', '-i', f'sine=f=440:d=10:r={RATE}', '-filter_complex', '[0][1]concat=n=2:v=0:a=1,aformat=channel_layouts=stereo',
                            str(long)], check=True)
            ending = dict(data['tracks'][0], loopable=False, duration_s=40.0, outro_cue_s=30.0, measured_lufs=ebur128(long)['I'])
            _, how = placement(ending, tl, xf=levels['ramp_up_s'])
            checks.append(('a track with an outro cue ends on its ending', how, 'outro cue'))
            spliced = Path(tmp) / 'spliced.wav'
            subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(long), '-filter_complex',
                            bed_filter(ending, tl, levels), '-map', '[bed]', '-c:a', 'pcm_f32le', str(spliced)], check=True)
            checks.append(('and the bed is still exactly the video\'s length', round(probe(spliced)[0], 3), 25.0))
            tone = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-ss', '22', '-t', '2', '-i', str(spliced), '-af',
                                   'bandpass=f=440:width_type=q:w=8,bandpass=f=440:width_type=q:w=8,volumedetect',
                                   '-f', 'null', '-'], capture_output=True, text=True).stderr
            checks.append(('the ending plays over the end card', float(re.search(r'mean_volume: (-?[\d.]+)', tone).group(1)) > -40, True))
        tampered.write_bytes(tampered.read_bytes()[:-4800])
        try:
            resolve(load(ledger)['tracks'][0])
            checks.append(('a changed file is refused', 'accepted', 'refused'))
        except MusicError:
            checks.append(('a changed file is refused', 'refused', 'refused'))
        checks.append(('check fails on the changed file', bool(check(load(ledger))[0]), True))
        # A track listed ahead of its file is completed in place by add.
        seeded = work / 'root' / 'seeded.wav'
        subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', f'sine=f=330:d=6:r={RATE}',
                        '-ac', '2', str(seeded)], check=True)
        listed = {k: None for k in TRACK_FIELDS}
        listed.update(id='seeded-track', title='Seeded', artist='Someone', provider='self-test', file='seeded.wav',
                      platforms=[], status='proposed', drive_file_id='drive-id-1')
        data = load(ledger)
        data['tracks'].append(listed)
        save(data, ledger)
        checks.append(('a listed, unmeasured track is a warning, not an error',
                       (check(data)[0] == check(dict(data, tracks=data['tracks'][:-1]))[0],
                        any('not measured yet' in w for w in check(data)[1])), (True, True)))
        completed = run('add', str(seeded), '--provider', 'self-test', '--licence-id', 'TEST-2', '--licence-file', 'licences/chord.txt')
        data = load(ledger)
        done = [t for t in data['tracks'] if t['id'] == 'seeded-track']
        checks.append(('add completes the listed track in place', (completed.returncode, len(done),
                       bool(done and done[0]['sha256']), done and done[0]['title'], done and done[0]['drive_file_id'],
                       done and done[0]['status']), (0, 1, True, 'Seeded', 'drive-id-1', 'proposed')))
    finally:
        for k, v in env_before.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = v
    errors, _ = check(load(), strict=False)
    checks.append(('the committed ledger checks clean', errors, []))
    bad = [f'{label}: got {got!r}, want {want!r}' for label, got, want in checks if got != want]
    print('\n'.join(bad) if bad else f'music self-test passed: {len(checks)} checks')
    return 1 if bad else 0



# ---------------------------------------------------------------- any machine renders
# Krish, 2026-10-12: "the audio is literally in the drive ... record this
# capability of yours so you do not whine about this ever again". The home
# computers send each ledger file to the engine's library (`publish`, every
# pass of scripts/recordings-upload.ps1); any machine that renders (GitHub's,
# a cloud session, a home computer) gets it back with `fetch` and points
# MINDMAKE_MUSIC_ROOT at the folder. No machine needs H: for music.
LIBRARY_MUSIC = '1 Brand kit (permanent)/Music'
FETCH_DEFAULT = Path(__file__).resolve().parents[2] / '.cache' / 'music'


def _post_pack():
    here = Path(__file__).resolve().parents[1]
    for sub in (here, here / 'post-pack'):
        if str(sub) not in sys.path:
            sys.path.insert(0, str(sub))


def cmd_publish(data, out=print):
    """Sends every ledger file found in the music folder to the library.
    A file the library already holds is left alone."""
    root = music_root(data)
    if not root or not Path(root).is_dir():
        raise MusicError('the music folder is not reachable here (MINDMAKE_MUSIC_ROOT), so nothing was published')
    _post_pack()
    import send  # scripts/post-pack/send.py
    planned = []
    for t in data['tracks']:
        if t.get('status') == 'retired' or not t.get('file'):
            continue
        path = in_root(root, t['file'])
        if path.is_file():
            planned.append((f'{LIBRARY_MUSIC}/{Path(t["file"]).name}', path, 'licensed music bed under the videos'))
        else:
            out(f'missing        {t["file"]} (not in the music folder)')
    if not planned:
        return {'sent': 0, 'already': 0, 'confirmed_only': 0}
    try:
        return send.send(planned, send.Engine('music-publish'), out=out)
    except send.SendError as error:
        raise MusicError(str(error))


def cmd_fetch(data, out_dir=None, out=print):
    """Downloads every ledger file from the library into out_dir, checked by
    size and (once measured) sha256. Returns the folder."""
    import urllib.parse
    import urllib.request
    _post_pack()
    import engine  # scripts/engine.py
    folder = Path(out_dir or FETCH_DEFAULT)
    folder.mkdir(parents=True, exist_ok=True)
    token = engine.operator_key()
    got = 0
    for t in data['tracks']:
        if t.get('status') == 'retired' or not t.get('file'):
            continue
        name = Path(t['file']).name
        target = folder / name
        if target.is_file() and (not t.get('sha256') or sha256_of(target) == t['sha256']) \
                and (not t.get('bytes') or target.stat().st_size == t['bytes']):
            out(f'have           {name}')
            got += 1
            continue
        status, text = engine.call('GET', '/api/library/file?path=' + urllib.parse.quote(f'{LIBRARY_MUSIC}/{name}'), None, token, timeout=60)
        answer = json.loads(text) if text and text.strip().startswith('{') else {}
        if status == 404:
            out(f'not yet        {name} (no home computer has published it: recordings-upload.ps1 does on its next pass)')
            continue
        url = ((answer.get('download') or {}).get('url')) if isinstance(answer, dict) else None
        if status != 200 or not url or not url.startswith('https://') or '/storage/v1/object/sign/' not in url:
            raise MusicError(f'{name}: the library answered {status}')
        partial = target.with_suffix(target.suffix + '.part')
        with urllib.request.urlopen(url, timeout=600) as response, open(partial, 'wb') as handle:
            shutil.copyfileobj(response, handle)
        if t.get('bytes') and partial.stat().st_size != t['bytes']:
            partial.unlink()
            raise MusicError(f'{name}: came back {partial.stat().st_size if partial.exists() else 0} bytes, the ledger says {t["bytes"]}')
        if t.get('sha256') and sha256_of(partial) != t['sha256']:
            partial.unlink()
            raise MusicError(f'{name}: its sha256 is not the one in the ledger')
        partial.replace(target)
        out(f'fetched        {name}  ({target.stat().st_size} bytes)')
        got += 1
    return folder, got


def main():
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(self_test())
    ap = argparse.ArgumentParser(description='The licensed music ledger and the bed under the videos.')
    ap.add_argument('--ledger', help='the ledger (default: MINDMAKE_MUSIC_LEDGER, else config/music-library.json)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('list', help='every track, its status and its licence')
    p.add_argument('--json', action='store_true')
    p = sub.add_parser('check', help='the ledger and, where reachable, the files')
    p.add_argument('--strict', action='store_true', help='fail when the music folder is not reachable')
    p.add_argument('--json', action='store_true')
    p = sub.add_parser('add', help='measure a file in the music folder and add it as proposed')
    p.add_argument('file')
    p.add_argument('--provider', required=True)
    p.add_argument('--licence-id', required=True)
    p.add_argument('--licence-file', required=True, help='the certificate, relative to the music folder')
    for flag in ('id', 'title', 'artist', 'provider-track-id', 'provider-url', 'licence-type', 'licensee', 'acquired-on', 'expires-on',
                 'platforms', 'monetisation-ok', 'content-id-cleared', 'attribution', 'restrictions', 'mood'):
        p.add_argument(f'--{flag}')
    p.add_argument('--intro-cue', type=float, default=0.0, help='seconds into the track where the intro starts')
    p.add_argument('--outro-cue', type=float, help='seconds into the track where its ending starts')
    p.add_argument('--loopable', action='store_true', help='the track loops cleanly from its intro cue')
    p = sub.add_parser('approve', help='record Krish\'s approval of a track, in his words')
    p.add_argument('track_id')
    p.add_argument('--words')
    p.add_argument('--by', default='Krish')
    p.add_argument('--on', default=date.today().isoformat())
    p = sub.add_parser('approve-levels', help='record Krish\'s approval of the mix levels, in his words')
    p.add_argument('--words')
    p.add_argument('--by', default='Krish')
    p.add_argument('--on', default=date.today().isoformat())
    sub.add_parser('publish', help='send every ledger file in the music folder to the engine\'s library (a home computer)')
    p = sub.add_parser('fetch', help='get every ledger file from the engine\'s library (any machine)')
    p.add_argument('--out', help=f'the folder (default {FETCH_DEFAULT})')
    p = sub.add_parser('pick', help='the track for a cut, or the one track both cuts of a piece get')
    p.add_argument('--seconds', type=float, help='the cut\'s length in seconds (with --both-cuts: optional, the piece\'s long cut, '
                   f'the length both cuts ask for; without it, {PIECE_SECONDS:g} s)')
    p.add_argument('--piece')
    p.add_argument('--both-cuts', action='store_true', help='the track both cuts of --piece get, chosen as make.py chooses it')
    p.add_argument('--platforms', help='where the cut is posted, such as youtube,substack (default: no limit)')
    p.add_argument('--shape', choices=sorted(SHAPE_PLATFORMS), help='the platforms for a 16x9 or a 9x16 cut')
    a = ap.parse_args()
    try:
        data = load(a.ledger)
        if a.cmd == 'list':
            rows = [{k: t.get(k) for k in ('id', 'status', 'title', 'artist', 'duration_s', 'measured_lufs', 'platforms', 'expires_on', 'approved_on')}
                    for t in data['tracks']]
            if a.json:
                print(json.dumps({'levels': data.get('levels'), 'root': str(music_root(data) or ''), 'tracks': rows}, indent=1))
            else:
                print(f'music folder: {music_root(data) or "not set (MINDMAKE_MUSIC_ROOT)"}')
                print(f'levels: {data["levels"].get("status")}')
                for r in rows:
                    print(f'{r["id"]}  {r["status"]}  {r["title"]} / {r["artist"]}  {r["duration_s"]} s  {r["measured_lufs"]} LUFS  '
                          f'{",".join(r["platforms"] or [])}  licence to {r["expires_on"] or "no end"}')
                if not rows:
                    print('no tracks yet')
        elif a.cmd == 'check':
            errors, warnings = check(data, a.strict)
            if a.json:
                print(json.dumps({'errors': errors, 'warnings': warnings}, indent=1))
            else:
                for w in warnings:
                    print(f'warn  {w}')
                for e in errors:
                    print(f'FAIL  {e}')
                print('music ledger checks clean' if not errors else f'{len(errors)} problem(s)')
            sys.exit(1 if errors else 0)
        elif a.cmd == 'publish':
            done = cmd_publish(data)
            print(f'music published: {done["sent"]} sent, {done["already"] + done["confirmed_only"]} already there')
        elif a.cmd == 'fetch':
            folder, got = cmd_fetch(data, a.out)
            print(f'MINDMAKE_MUSIC_ROOT={folder}')
            sys.exit(0 if got else 2)
        elif a.cmd == 'add':
            track = cmd_add(a, data)
            save(data, a.ledger)
            print(json.dumps(track, indent=1))
            print(f'added {track["id"]} as proposed: Krish approves it by ear, then `music.py approve {track["id"]} --words "..."`', file=sys.stderr)
        elif a.cmd == 'approve':
            words = approval(a.words, a.by)
            track = by_id(a.track_id, data)
            track.update(status='approved', approved_by=a.by, approved_on=a.on, approval_words=words)
            why = problems(track)
            if why:
                raise MusicError(f'{a.track_id} cannot be approved yet: {"; ".join(why)}')
            resolve(track, data)
            save(data, a.ledger)
            print(f'{a.track_id} approved by {a.by} on {a.on}')
        elif a.cmd == 'approve-levels':
            words = approval(a.words, a.by)
            data['levels'].update(status='approved', approved_by=a.by, approved_on=a.on, approval_words=words)
            save(data, a.ledger)
            print(f'mix levels approved by {a.by} on {a.on}')
        elif a.cmd == 'pick':
            if a.both_cuts:
                if not a.piece or a.shape or a.platforms:
                    raise MusicError('--both-cuts takes --piece PIECE_ID (and --seconds, optional), and no --shape or --platforms: it covers both')
                track, skipped, needs = pick_for_piece(a.piece, None, data, longest=a.seconds)
            else:
                if a.seconds is None:
                    raise MusicError('--seconds is the cut\'s length; or give --both-cuts --piece PIECE_ID for the track both cuts get')
                platforms = SHAPE_PLATFORMS[a.shape] if a.shape else [p.strip() for p in (a.platforms or '').split(',') if p.strip()]
                track, skipped = pick(a.seconds, a.piece, platforms, data)
                needs = {'seconds': a.seconds, 'platforms': list(platforms)}
            print(json.dumps({'track': track and track['id'], 'file': track and track['file'], 'needs': needs, 'skipped': skipped}, indent=1))
            sys.exit(0 if track else 1)
    except MusicError as e:
        sys.exit(f'music: {e}')


if __name__ == '__main__':
    main()
