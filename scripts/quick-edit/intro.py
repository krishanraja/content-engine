#!/usr/bin/env python3
"""The makeyourmindup intro sting: 56 frames at 30 fps in front of every 16:9
long cut of a weekly series piece, and nowhere else.

Krish, 2026-11-05, of the Intro Sting page: "I think it should go at the start
of the longer wide videos 100%,". The 9:16 short cut opens straight on its hook
(house rule HOOK_IS_THE_INTRO), and an off-day piece (no weekly series) wears no
sting, never another series' colour. Asked about the colours he picked "Keep it
as I saw it": each series' clip flashes the other series' colours on its way to
its own colour and the full MAKE YOUR MIND/UP wordmark plate, the one written
exception to the series-colour rule (config/intro-sting.json "colours").

The design is six fixed clips, not source code. The Remotion source of the clips
he saw on 12 October was never committed and is lost, so the clips themselves,
taken byte for byte from his page, are the design. config/intro-sting.json names
each one (clips.<shape>.<series>: its library path, sha256 and bytes), and
"shapes" says where the sting goes (["16x9"]); the 9:16 clips are kept for the
record and used nowhere.

Where the clips are:
  - in the engine's library, at clips.<shape>.<series>.library
    ("1 Brand kit (permanent)/Intro sting/<file>"): `publish` sends them there
    from a machine that has them (scripts/post-pack/send.py), and `fetch` gets
    them back on any machine that renders, each checked by size and sha256,
    exactly as music.py does for the music;
  - on this machine, in MINDMAKE_INTRO_CLIPS, else .cache/quick-edit/intro/clips/.

`finish` makes the cut-ready sting from a verified clip: its picture copied as it
is (exactly `frames` frames at 30 fps, yuv420p, square pixels marked), with a
silent 48 kHz stereo AAC track made from exactly frames*48000/30 samples, cached as
.cache/quick-edit/intro/<hash12>-<shape>-<series>.mp4 (hash12: the clip's sha256).
make.py joins it in front of the wide cut, lays the music bed under it (the
sting has no sound of its own), and his face comes in on the very next frame.

The sting waits for Krish. While config/intro-sting.json says "candidate", make.py
renders the wide cut without it and says so in its report. `approve --words "..."`
is the scripted lane that records his words: it needs every clip the cuts use here
and verified, and binds his approval to source_sha256, the sha256 of the canonical
JSON {shape: {series: clip sha256}} over "shapes" and every series. An approval
with no such hash is no approval, and clips that are not the approved ones are
never used. "last_decision" records his latest word on a design, a rejection
included, and "history" every word before it.

    python intro.py status [--json]
    python intro.py fetch                 any machine: every clip from the library, checked
    python intro.py publish               a machine that has the clips: send them to the library
    python intro.py approve --words "Krish's exact words"
    python intro.py finish [--shape 16x9] [--series SERIES] [--force]
    python intro.py --self-test
"""
import argparse
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CONFIG = REPO / 'config' / 'intro-sting.json'
CACHE = REPO / '.cache' / 'quick-edit' / 'intro'
CLIPS = CACHE / 'clips'
# A stand-in config for a test (mix_test.py's make.py runs), honoured only under
# the repository's .cache, so no real cut ever opens on one; and the folder the
# clips are in on this machine (any folder: every clip is checked by its sha256).
CONFIG_ENV = 'MINDMAKE_INTRO_STING'
CLIPS_ENV = 'MINDMAKE_INTRO_CLIPS'
LIBRARY_STING = '1 Brand kit (permanent)/Intro sting'
SHAPES = {'9x16': (1080, 1920), '16x9': (1920, 1080)}
# The three weekly series (subchannels). A piece with none of them is an
# off-day piece and wears no sting.
SERIES = ('follow_the_money', 'mind_the_gap', 'under_the_hood')
FPS = 30
RATE = 48000
SECONDS = (1.0, 2.0)
# ffmpeg's AAC encoder writes whole 1024-sample frames, so the finished track's
# length is checked to within one of them; the silence fed to it is exact.
AAC_FRAME = 1024
SHA256 = re.compile(r'[0-9a-f]{64}')
DECISIONS = ('approved', 'rejected', 'retired')
STATUSES = ('candidate', 'approved', 'retired')
PLACEMENT = "I think it should go at the start of the longer wide videos 100%,"


class IntroError(ValueError):
    """A reason the sting cannot be used, in plain words."""


def series_name(value):
    """'mind_the_gap' from 'mind_the_gap', 'mind.the.gap', 'Mind the gap' or
    any capitals; None when it is none of the three weekly series."""
    wanted = re.sub(r'[.\-\s]+', '_', str(value or '').strip().lower())
    return wanted if wanted in SERIES else None


def config_path(given=None):
    """The sting's config: the one given, else MINDMAKE_INTRO_STING (a stand-in,
    honoured only under the repository's .cache), else config/intro-sting.json."""
    if given:
        return Path(given)
    env = os.environ.get(CONFIG_ENV)
    if not env:
        return CONFIG
    path = Path(env).resolve()
    if not path.is_relative_to((REPO / '.cache').resolve()):
        raise IntroError(f'{CONFIG_ENV} is {env}: a stand-in sting config is honoured only under the repository\'s .cache '
                         '(a test), so no real cut opens on one; unset it')
    return path


def clips_dir(given=None):
    """The folder the clips are in on this machine."""
    return Path(given or os.environ.get(CLIPS_ENV) or CLIPS)


def krish(record):
    return isinstance(record, dict) and str(record.get('by') or '').lower().startswith('krish') and str(record.get('words') or '').strip()


def load(path=None):
    path = config_path(path)
    try:
        cfg = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, ValueError) as e:
        raise IntroError(f'{path} cannot be read: {e}') from None
    if cfg.get('schema_version') != 2:
        raise IntroError(f'{path}: schema_version must be 2 (the sting as fixed clips)')
    if cfg.get('status') not in STATUSES:
        raise IntroError(f'{path}: status is "candidate", "approved" or "retired"')
    if cfg.get('fps') != FPS:
        raise IntroError(f'{path}: fps is {FPS}, the rate the clips were made at')
    frames = cfg.get('frames')
    if not isinstance(frames, int) or isinstance(frames, bool) or not SECONDS[0] <= frames / FPS <= SECONDS[1]:
        raise IntroError(f'{path}: frames is a whole number of frames, {SECONDS[0]:g} to {SECONDS[1]:g} seconds at {FPS} fps')
    secs = cfg.get('seconds')
    if not isinstance(secs, (int, float)) or abs(secs - frames / FPS) > 0.5 / FPS:
        raise IntroError(f'{path}: seconds is frames/fps ({frames / FPS:.4f}) to within half a frame')
    shapes = cfg.get('shapes')
    if not isinstance(shapes, list) or not shapes or len(set(shapes)) != len(shapes) or any(s not in SHAPES for s in shapes):
        raise IntroError(f'{path}: shapes lists the shapes the sting goes on, from {", ".join(SHAPES)}')
    series = cfg.get('series')
    if not isinstance(series, list) or not series or len(set(series)) != len(series) or any(s not in SERIES for s in series):
        raise IntroError(f'{path}: series lists the weekly series the sting has a clip for, from {", ".join(SERIES)}')
    clips = cfg.get('clips')
    if not isinstance(clips, dict) or any(shape not in SHAPES or not isinstance(per, dict) for shape, per in clips.items()):
        raise IntroError(f'{path}: clips is {{shape: {{series: {{"library", "sha256", "bytes"}}}}}}')
    names = []
    for shape in shapes:
        missing = [s for s in series if s not in clips.get(shape, {})]
        if missing:
            raise IntroError(f'{path}: clips.{shape} names no clip for {", ".join(missing)}, and the sting goes on {shape}')
    for shape, per in clips.items():
        for name, entry in per.items():
            where = f'clips.{shape}.{name}'
            if name not in SERIES:
                raise IntroError(f'{path}: {where} is not one of the weekly series')
            if not isinstance(entry, dict):
                raise IntroError(f'{path}: {where} is {{"library", "sha256", "bytes"}}')
            lib = entry.get('library')
            if not (isinstance(lib, str) and lib.startswith(LIBRARY_STING + '/') and lib.endswith('.mp4') and '/' not in lib[len(LIBRARY_STING) + 1:]):
                raise IntroError(f'{path}: {where}.library is the clip\'s path in the library, "{LIBRARY_STING}/<file>.mp4"')
            if not SHA256.fullmatch(str(entry.get('sha256') or '')):
                raise IntroError(f'{path}: {where}.sha256 is the 64-hex sha256 of the clip Krish saw')
            size = entry.get('bytes')
            if not isinstance(size, int) or isinstance(size, bool) or size <= 0:
                raise IntroError(f'{path}: {where}.bytes is the clip\'s size in bytes')
            names.append(Path(lib).name)
    if len(set(names)) != len(names):
        raise IntroError(f'{path}: two clips share a file name, so one would overwrite the other on fetch')
    for key in ('placement', 'colours', 'seen'):
        if cfg.get(key) is not None and not isinstance(cfg[key], dict):
            raise IntroError(f'{path}: {key} is a record (an object)')
    history = cfg.get('history')
    if history is not None and not (isinstance(history, list) and all(isinstance(h, dict) for h in history)):
        raise IntroError(f'{path}: history is a list of records')
    decision = cfg.get('last_decision')
    if decision is not None and not (krish(decision) and decision.get('decision') in DECISIONS):
        raise IntroError(f'{path}: last_decision is Krish\'s latest word on a design: {{"on", "by": "Krish", "decision": '
                         f'{", ".join(DECISIONS)}, "words": his exact words}}')
    if cfg['status'] == 'retired' and not (decision and decision.get('decision') == 'retired'):
        raise IntroError(f'{path}: a retired sting carries Krish\'s words retiring it, as last_decision {{"decision": "retired", "by": "Krish", "words"}}')
    if cfg['status'] == 'approved':
        if not (str(cfg.get('approved_by') or '').lower().startswith('krish') and str(cfg.get('approval_words') or '').strip()):
            raise IntroError(f'{path}: an approved sting carries Krish\'s approval and his words')
        if not SHA256.fullmatch(str(cfg.get('source_sha256') or '')):
            raise IntroError(f'{path}: an approved sting carries the 64-hex source_sha256 of the clips Krish approved; '
                             'without it nothing is approved')
        if decision is not None and decision.get('decision') != 'approved':
            raise IntroError(f'{path}: the sting says approved, but Krish\'s last decision was "{decision.get("decision")}"')
    return cfg


def source_hash(cfg):
    """What Krish's approval binds: the sha256 of the canonical JSON
    {shape: {series: clip sha256}} over the shapes the sting goes on and every
    series. A clip of a shape the sting does not go on is not in it."""
    used = {shape: {s: cfg['clips'][shape][s]['sha256'] for s in cfg['series']} for shape in cfg['shapes']}
    return hashlib.sha256(json.dumps(used, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def named_clips(cfg, only=None):
    """(shape, series, entry) for every clip the config names, or only those in `only` [(shape, series)]."""
    return [(shape, s, entry) for shape, per in cfg['clips'].items() for s, entry in per.items()
            if only is None or (shape, s) in only]


def sha256_of(path):
    h = hashlib.sha256()
    with open(path, 'rb') as handle:
        for block in iter(lambda: handle.read(1 << 20), b''):
            h.update(block)
    return h.hexdigest()


def verified(path, entry):
    return Path(path).is_file() and Path(path).stat().st_size == entry['bytes'] and sha256_of(path) == entry['sha256']


def clip(shape, series, cfg=None, clips=None):
    """The verified clip on this machine for this shape and series: the file
    config/intro-sting.json names, with its size and sha256. Raises IntroError,
    saying what is wrong, otherwise."""
    cfg = cfg or load()
    found = series_name(series)
    entry = (cfg['clips'].get(shape) or {}).get(found)
    if not entry:
        raise IntroError(f'config/intro-sting.json names no {shape} clip for {series!r}')
    path = clips_dir(clips) / Path(entry['library']).name
    if not path.is_file():
        raise IntroError(f'the {shape} {found} clip is not on this machine ({path}): run python scripts/quick-edit/intro.py fetch')
    size = path.stat().st_size
    if size != entry['bytes']:
        raise IntroError(f'{path.name} is {size} bytes, and config/intro-sting.json says {entry["bytes"]}: fetch it again')
    if sha256_of(path) != entry['sha256']:
        raise IntroError(f'{path.name} is not the clip Krish saw (its sha256 differs from config/intro-sting.json): fetch it again')
    return path


def clip_sha256(shape, series, config=None):
    """The sha256 of the clip Krish saw for this shape and series, or None."""
    try:
        return load(config)['clips'][shape][series_name(series)]['sha256']
    except (IntroError, KeyError, TypeError):
        return None


def describe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_entries',
                          'stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,pix_fmt,sample_aspect_ratio,sample_rate,channels,duration'
                          ':format=duration', '-of', 'json', str(path)], capture_output=True, text=True, check=True)
    data = json.loads(out.stdout)
    v = next((s for s in data['streams'] if s['codec_type'] == 'video'), {})
    a = next((s for s in data['streams'] if s['codec_type'] == 'audio'), {})
    sar = v.get('sample_aspect_ratio')
    return {'codec': v.get('codec_name'), 'width': v.get('width'), 'height': v.get('height'), 'fps': v.get('r_frame_rate'),
            'frames': int(v.get('nb_read_frames') or 0), 'pix_fmt': v.get('pix_fmt'), 'sar': sar if sar and sar != 'N/A' else None,
            'seconds': round(float(data['format']['duration']), 4), 'audio': a.get('codec_name'),
            'sample_rate': int(a.get('sample_rate') or 0), 'channels': a.get('channels'),
            'audio_seconds': round(float(a['duration']), 4) if a.get('duration') else None}


def form_problems(info, shape, frames, finished=True):
    """What keeps a clip from being the sting's exact form: the shape's size,
    30 fps, exactly `frames` frames, yuv420p; and once finished, square pixels and
    a 48 kHz stereo AAC track as long as the picture (to one AAC frame)."""
    w, h = SHAPES[shape]
    want = {'codec': 'h264', 'width': w, 'height': h, 'fps': f'{FPS}/1', 'frames': frames, 'pix_fmt': 'yuv420p'}
    if finished:
        want.update(sar='1:1', audio='aac', sample_rate=RATE, channels=2)
    wrong = [f'{k} {info.get(k)!r}, not {v!r}' for k, v in want.items() if info.get(k) != v]
    if finished and info.get('audio_seconds') is not None and abs(info['audio_seconds'] - frames / FPS) > AAC_FRAME / RATE:
        wrong.append(f'sound {info["audio_seconds"]} s against a picture of {frames / FPS:.4f} s')
    return wrong


def cached(shape, series, sha, cache=None):
    """Where the cut-ready sting for this clip goes: <hash12>-<shape>-<series>.mp4."""
    return Path(cache or CACHE) / f'{sha[:12]}-{shape}-{series}.mp4'


def finish_clip(src, dst, shape, frames):
    """A clip into the sting's cut-ready form, its picture untouched: refused
    unless it is already the shape's size, 30 fps, exactly `frames` frames of
    H.264 yuv420p (nothing is padded, trimmed or rescaled, so the wordmark
    plate on the last frame is never lost); then the picture copied as it is,
    its pixels marked square, with a silent 48 kHz stereo AAC track made from
    exactly frames*48000/30 samples."""
    made = describe(src)
    wrong = form_problems(made, shape, frames, finished=False)
    if wrong:
        raise IntroError(f'{Path(src).name} is not the {shape} sting\'s form: {"; ".join(wrong)}')
    samples = frames * RATE // FPS
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_name(f'{dst.stem}.{os.getpid()}.part.mp4')
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(src), '-f', 'lavfi', '-i', f'anullsrc=r={RATE}:cl=stereo',
                    '-filter_complex', f'[1:a]atrim=end_sample={samples},asetpts=PTS-STARTPTS[a]', '-map', '0:v:0', '-map', '[a]',
                    '-c:v', 'copy', '-bsf:v', 'h264_metadata=sample_aspect_ratio=1/1',
                    '-c:a', 'aac', '-b:a', '192k', '-ar', str(RATE), '-ac', '2', '-movflags', '+faststart', str(tmp)], check=True)
    info = describe(tmp)
    wrong = form_problems(info, shape, frames)
    if wrong:
        tmp.unlink(missing_ok=True)
        raise IntroError(f'the finished sting is not in the house form: {"; ".join(wrong)}')
    os.replace(tmp, dst)
    return dict(info, silence_samples=samples)


def finish(shape, series, cfg=None, clips=None, cache=None, force=False):
    """The cut-ready sting for this shape and series, from its verified clip,
    cached under .cache/quick-edit/intro/. Raises IntroError otherwise."""
    cfg = cfg or load()
    src = clip(shape, series, cfg, clips)
    found = series_name(series)
    dst = cached(shape, found, cfg['clips'][shape][found]['sha256'], cache)
    if dst.is_file() and not force and not form_problems(describe(dst), shape, cfg['frames']):
        return dst
    finish_clip(src, dst, shape, cfg['frames'])
    return dst


def wanted(shape, series, config=None):
    """Whether a cut of this shape and series must open on the sting: it is
    approved, the sting goes on this shape, and the series is one of its own.
    Raises IntroError when the config cannot be read."""
    cfg = load(config)
    # Paused on Krish's words (config/intro-sting.json "paused", 12 Nov 2026): no cut wears it until the sting after
    # the hook is built and approved.
    return (cfg['status'] == 'approved' and not cfg.get('paused') and shape in cfg['shapes']
            and series_name(series) in cfg['series'])


def _engine():
    here = Path(__file__).resolve().parents[1]
    for sub in (here, here / 'post-pack'):
        if str(sub) not in sys.path:
            sys.path.insert(0, str(sub))
    import engine  # scripts/engine.py
    return engine


def _send():
    _engine()
    import send  # scripts/post-pack/send.py
    return send


def fetch(cfg=None, clips=None, out=print, only=None, engine_api=None, opener=None):
    """Downloads each clip config/intro-sting.json names from the engine's
    library into the clip folder, as music.py fetch does: /api/library/file?path=...,
    a signed https URL, the size and sha256 checked, .part then replace. A clip
    already here with the right bytes is left alone. Returns (folder, got,
    missing), missing being the clips the library does not hold yet."""
    import urllib.parse
    import urllib.request
    cfg = cfg or load()
    folder = clips_dir(clips)
    folder.mkdir(parents=True, exist_ok=True)
    opener = opener or urllib.request.urlopen
    api, token = engine_api, None
    got, missing = 0, []
    for shape, series, entry in named_clips(cfg, only):
        name = Path(entry['library']).name
        target = folder / name
        if verified(target, entry):
            out(f'have           {name}')
            got += 1
            continue
        if token is None:
            # The engine only when a clip has to come from it: a machine that has them all needs no key.
            api = api or _engine()
            try:
                token = api.operator_key()
            except Exception as e:  # engine.NoKey says what to do
                raise IntroError(f'no engine key here, so {name} cannot be fetched: {e}') from None
        try:
            status, text = api.call('GET', '/api/library/file?path=' + urllib.parse.quote(entry['library']), None, token, timeout=60)
        except Exception as e:  # engine.Unreachable says why
            raise IntroError(f'{name}: the engine could not be reached: {e}') from None
        answer = json.loads(text) if text and text.strip().startswith('{') else {}
        if status == 404:
            out(f'not yet        {name} (not in the library: a machine that has the clips sends them with python scripts/quick-edit/intro.py publish)')
            missing.append(name)
            continue
        url = ((answer.get('download') or {}).get('url')) if isinstance(answer, dict) else None
        if status != 200 or not url or not url.startswith('https://') or '/storage/v1/object/sign/' not in url:
            raise IntroError(f'{name}: the library answered {status}')
        partial = target.with_name(target.name + '.part')
        with opener(url, timeout=600) as response, open(partial, 'wb') as handle:
            shutil.copyfileobj(response, handle)
        size = partial.stat().st_size
        if size != entry['bytes']:
            partial.unlink()
            raise IntroError(f'{name}: came back {size} bytes, and config/intro-sting.json says {entry["bytes"]}')
        if sha256_of(partial) != entry['sha256']:
            partial.unlink()
            raise IntroError(f'{name}: its sha256 is not the one in config/intro-sting.json, the clip Krish saw')
        partial.replace(target)
        out(f'fetched        {name}  ({size} bytes)')
        got += 1
    return folder, got, missing


def publish(cfg=None, clips=None, out=print, send_module=None):
    """Sends each clip config/intro-sting.json names, from this machine's clip
    folder, to its library path through scripts/post-pack/send.py, as music.py
    publish does. Every clip found is checked first (size and sha256): a wrong
    file stops the publish before anything is sent. A clip the library already
    holds is left alone."""
    cfg = cfg or load()
    planned = []
    for shape, series, entry in named_clips(cfg):
        path = clips_dir(clips) / Path(entry['library']).name
        if not path.is_file():
            out(f'missing        {path.name} (not in {clips_dir(clips)})')
            continue
        clip(shape, series, cfg, clips)
        planned.append((entry['library'], path, f'the makeyourmindup intro sting, the {shape} {series} clip Krish saw on 12 October'))
    if not planned:
        return {'sent': 0, 'already': 0, 'confirmed_only': 0}
    send = send_module or _send()
    try:
        return send.send(planned, send.Engine('intro-publish'), out=out)
    except send.SendError as error:
        raise IntroError(str(error)) from None


def sting_for(shape, series=None, config=None, clips=None, cache=None, fetch_missing=True):
    """What make.py asks: the cut-ready sting for this shape and series, or
    None and why. It never raises.
      - a shape the sting does not go on (the 9:16 short cut): (None, None),
        the cut opens on the hook (house rule HOOK_IS_THE_INTRO);
      - a retired sting: (None, None);
      - no series, or none of the three (an off-day piece): (None, None), never
        another series' colour;
      - a candidate: (None, why), until Krish approves it;
      - an approval whose clips are not the ones config/intro-sting.json names: (None, why);
      - a clip not on this machine: fetched from the library when fetch_missing,
        else (None, why)."""
    try:
        cfg = load(config)
    except IntroError as e:
        return None, f'the intro sting could not be used, so this cut has no intro: {e}'
    if shape not in cfg['shapes'] or cfg['status'] == 'retired':
        return None, None
    found = series_name(series)
    if not found or found not in cfg['series']:
        return None, None
    if cfg['status'] != 'approved':
        return None, 'the intro sting is still a candidate waiting for Krish\'s approval (config/intro-sting.json), so this cut has no intro'
    if cfg['source_sha256'] != source_hash(cfg):
        return None, ('the clips config/intro-sting.json names are not the ones Krish approved (source_sha256), so this cut has no intro: '
                      'show him the clips and record his words again')
    try:
        clip(shape, found, cfg, clips)
    except IntroError as e:
        if not fetch_missing:
            return None, f'the approved intro sting is not ready on this machine, so this cut has no intro: {e}'
        try:
            _, _, missing = fetch(cfg, clips, out=lambda line: None, only=[(shape, found)])
        except Exception as error:  # a fetch failure is a note here; make.py decides whether it stops
            return None, f'the approved intro sting could not be fetched, so this cut has no intro: {error}'
        if missing:
            return None, (f'the approved intro sting\'s {shape} {found} clip is not in the library yet, so this cut has no intro: '
                          'a machine that has the clips sends them with python scripts/quick-edit/intro.py publish')
    try:
        return finish(shape, found, cfg, clips, cache), None
    except (IntroError, OSError, ValueError, subprocess.CalledProcessError) as e:
        return None, f'the intro sting could not be used, so this cut has no intro: {e}'


def status(config=None, clips=None, cache=None):
    cfg = load(config)
    digest = source_hash(cfg)
    per = {}
    for shape, series, entry in named_clips(cfg):
        path = clips_dir(clips) / Path(entry['library']).name
        try:
            clip(shape, series, cfg, clips)
            problem = None
        except IntroError as e:
            problem = str(e)
        done = cached(shape, series, entry['sha256'], cache)
        per.setdefault(shape, {})[series] = {'library': entry['library'], 'sha256': entry['sha256'], 'bytes': entry['bytes'],
                                             'local': str(path), 'verified': problem is None, 'problem': problem,
                                             'used': shape in cfg['shapes'], 'finished': str(done) if done.is_file() else None}
    return {'status': cfg['status'], 'config': str(config_path(config)), 'frames': cfg['frames'], 'fps': cfg['fps'], 'seconds': cfg['seconds'],
            'shapes': cfg['shapes'], 'series': cfg['series'], 'clips_dir': str(clips_dir(clips)), 'source_sha256': digest,
            'approved_source_sha256': cfg.get('source_sha256'), 'matches': cfg.get('source_sha256') == digest,
            'approved_by': cfg.get('approved_by'), 'approved_on': cfg.get('approved_on'), 'approval_words': cfg.get('approval_words'),
            'last_decision': cfg.get('last_decision'), 'placement': cfg.get('placement'), 'clips': per}


def approve(path, words, by='Krish', on=None, clips=None):
    """Record Krish's approval of the sting, bound to the clips the cuts use."""
    words = (words or '').strip()
    if not words:
        raise IntroError('--words is Krish\'s own words of approval, exactly as he said them')
    if not by.lower().startswith('krish'):
        raise IntroError('only Krish approves the intro sting')
    path = config_path(path)
    cfg = load(path)
    if cfg['status'] == 'retired':
        raise IntroError('the sting is retired on Krish\'s words: change house rule HOOK_IS_THE_INTRO with him first')
    problems = []
    for shape in cfg['shapes']:
        for series in cfg['series']:
            try:
                wrong = form_problems(describe(clip(shape, series, cfg, clips)), shape, cfg['frames'], finished=False)
                problems += [f'{shape} {series}: {"; ".join(wrong)}'] if wrong else []
            except (IntroError, subprocess.CalledProcessError) as e:
                problems.append(f'{shape} {series}: {e}')
    if problems:
        raise IntroError('these clips are not here and verified, so nothing was approved: ' + ' | '.join(problems))
    digest = source_hash(cfg)
    on = on or date.today().isoformat()
    record = {'on': on, 'by': by, 'decision': 'approved', 'words': words}
    raw = json.loads(path.read_text(encoding='utf-8'))
    raw.update(status='approved', approved_by=by, approved_on=on, approval_words=words, source_sha256=digest, last_decision=record)
    raw['history'] = list(raw.get('history') or []) + [dict(record, design='the clips in "clips", bound by source_sha256')]
    text = json.dumps(raw, indent=2, ensure_ascii=False) + '\n'
    tmp = path.with_name(path.name + '.part')
    tmp.write_text(text, encoding='utf-8')
    load(tmp)
    os.replace(tmp, path)
    return digest


# The stand-ins the self-tests use (here, make.py's and mix_test.py's): synthetic
# clips in the sting's form, and a config naming them. Never Krish's clips.
STAND_IN_COLOURS = {'follow_the_money': '0xB7A6FF', 'mind_the_gap': '0xFF6A4D', 'under_the_hood': '0x4DA3FF'}


def stand_in_clip(path, shape, frames=56, colour='0xB7A6FF', sound=None):
    """A synthetic H.264 clip of `frames` frames at 30 fps in the shape's size: a
    colour with a little moving grain (so a re-encode cannot pass for a copy) and
    an ink block moving along the top. sound: None (no track), 'silent' or 'tone'
    (a loud 1 kHz tone)."""
    w, h = SHAPES[shape]
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    picture = f"[0:v]drawbox=x='t*{w * FPS // frames}':y={h // 12}:w={w // 10}:h={w // 10}:color=0x0C1512:t=fill,noise=alls=8:allf=t[v]"
    inputs, graph, maps = ['-f', 'lavfi', '-i', f'color=c={colour}:s={w}x{h}:r={FPS}'], [picture], ['-map', '[v]']
    if sound:
        inputs += ['-f', 'lavfi', '-i', f'sine=f=1000:r={RATE}' if sound == 'tone' else f'anullsrc=r={RATE}:cl=stereo']
        graph.append(f'[1:a]volume={0.9 if sound == "tone" else 1},aformat=channel_layouts=stereo,atrim=end_sample={frames * RATE // FPS}[a]')
        maps += ['-map', '[a]', '-c:a', 'aac']
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', *inputs, '-filter_complex', ';'.join(graph), *maps,
                    '-frames:v', str(frames), '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', str(path)], check=True)
    return path


def stand_in(work, status='approved', shapes=('16x9',), frames=56, paused=False):
    """A stand-in sting under `work`: a clip per shape and series (stand_in_clip,
    in each series' stand-in colour) in work/clips, and a config naming them,
    approved on stand-in words when status is approved. It is not paused unless
    `paused` (the live config's pause, Krish 12 Nov 2026, is not copied), so the
    sting's own machinery stays tested for when it returns. Returns (config, clips)."""
    work = Path(work)
    folder = work / 'clips'
    cfg = json.loads(CONFIG.read_text(encoding='utf-8'))
    held = cfg.pop('paused', None)
    if paused:
        cfg['paused'] = held or {'words': 'Krish (a self-test stand-in, not his words): paused'}
    cfg.update(frames=frames, seconds=round(frames / FPS, 4), shapes=list(shapes), clips={})
    for shape in shapes:
        for series in cfg['series']:
            name = f'stand-in-sting-{shape}-{series}.mp4'
            made = stand_in_clip(folder / name, shape, frames, STAND_IN_COLOURS[series])
            cfg['clips'].setdefault(shape, {})[series] = {'library': f'{LIBRARY_STING}/{name}', 'sha256': sha256_of(made), 'bytes': made.stat().st_size}
    words = 'Krish (a self-test stand-in, not his words): synthetic clips'
    if status == 'approved':
        cfg.update(status='approved', approved_by='Krish', approved_on='2026-11-05', approval_words=words, source_sha256=source_hash(cfg),
                   last_decision={'on': '2026-11-05', 'by': 'Krish', 'decision': 'approved', 'words': words})
    else:
        cfg.update(status=status, approved_by=None, approved_on=None, approval_words=None, source_sha256=None)
    path = work / 'intro-sting.json'
    path.write_text(json.dumps(cfg, indent=2))
    load(path)
    return path, folder


def self_test():
    """The committed config; the clips through the finishing path; the source
    hash; sting_for for every shape, status and series; fetch and publish on a
    fake engine and a fake send; and the approval lane. All on synthetic clips
    under .cache, never Krish's."""
    checks = []

    def refused(label, run, want):
        try:
            got = run()
            checks.append((label, f'accepted: {got!r}', f'refused, naming {want}'))
        except IntroError as e:
            checks.append((label, want in str(e) or str(e), True))

    parent = REPO / '.cache' / 'quick-edit' / 'self-test'
    parent.mkdir(parents=True, exist_ok=True)
    work = Path(tempfile.mkdtemp(prefix='intro-', dir=parent))
    env_before = {k: os.environ.pop(k, None) for k in (CONFIG_ENV, CLIPS_ENV)}
    try:
        _self_test(checks, refused, work)
    finally:
        for k, v in env_before.items():
            if v is not None:
                os.environ[k] = v
        shutil.rmtree(work, ignore_errors=True)
    failed = [f'{label}: got {got!r}, want {want!r}' for label, got, want in checks if got != want]
    print('\n'.join(failed) if failed else f'intro self-test passed: {len(checks)} checks')
    return 1 if failed else 0


def _self_test(checks, refused, work):
    # The committed config: his placement, his colours, the clips he saw.
    committed = load()
    raw = json.loads(CONFIG.read_text(encoding='utf-8'))
    checks.append(('the committed sting is 56 frames at 30 fps, its seconds within half a frame',
                   (committed['frames'], committed['fps'], abs(committed['seconds'] - 56 / 30) <= 0.5 / 30), (56, 30, True)))
    checks.append(('it goes on the 16:9 long cut only, for all three series', (committed['shapes'], sorted(committed['series'])), (['16x9'], sorted(SERIES))))
    checks.append(('it names a clip for every shape and series, the 9:16 ones kept for the record',
                   sorted((shape, s) for shape, s, _ in named_clips(committed)), sorted((shape, s) for shape in SHAPES for s in SERIES)))
    sys.path.insert(0, str(REPO / 'scripts' / 'post-pack'))
    import library  # noqa: PLC0415  the library's own path rule
    checks.append(('every library path is in the brand kit\'s Intro sting folder, and the library takes it',
                   [library.refusal(e['library']) for _, _, e in named_clips(committed)], [None] * len(named_clips(committed))))
    checks.append(('his placement and his colours are kept in his exact words',
                   ((raw.get('placement') or {}).get('words'), (raw.get('placement') or {}).get('by'), (raw.get('colours') or {}).get('picked')),
                   (PLACEMENT, 'Krish', 'Keep it as I saw it')))
    if committed['status'] == 'approved':
        checks.append(('the committed approval is Krish\'s, bound to the clips it names',
                       (committed['approved_by'], committed['source_sha256'] == source_hash(committed), committed['last_decision']['decision']),
                       ('Krish', True, 'approved')))
    else:
        checks.append(('the committed config waits for Krish, with no approval and no hash',
                       (committed['status'] in ('candidate', 'retired'), committed['approved_by'], committed['source_sha256']), (True, None, None)))
    checks.append(('the committed config gives the tall cut no sting and no note, at any status', sting_for('9x16', 'follow_the_money'), (None, None)))
    checks.append(('and an off-day piece none, never follow_the_money\'s', [sting_for('16x9', s) for s in (None, 'built_with_ai', 'off.day')],
                   [(None, None)] * 3))

    # Stand-in clips and configs.
    cache = work / 'cache'
    good, clips = stand_in(work / 'approved')
    cfg = load(good)
    cand, cand_clips = stand_in(work / 'candidate', status='candidate')

    # The source hash: the canonical JSON of the used clips' sha256.
    used = {'16x9': {s: cfg['clips']['16x9'][s]['sha256'] for s in cfg['series']}}
    checks.append(('the source hash is the sha256 of the canonical JSON {shape: {series: clip sha256}}',
                   source_hash(cfg), hashlib.sha256(json.dumps(used, sort_keys=True, separators=(',', ':')).encode()).hexdigest()))
    other = json.loads(json.dumps(cfg))
    other['clips']['16x9']['mind_the_gap']['sha256'] = '0' * 64
    checks.append(('a used clip\'s sha256 changes it', source_hash(other) != source_hash(cfg), True))
    other = json.loads(json.dumps(cfg))
    other['clips']['9x16'] = {s: dict(cfg['clips']['16x9'][s], library=f'{LIBRARY_STING}/tall-{s}.mp4', sha256='1' * 64) for s in SERIES}
    checks.append(('a clip of a shape the sting does not go on does not', source_hash(other), source_hash(cfg)))
    checks.append(('putting the sting on another shape does', source_hash(dict(other, shapes=['16x9', '9x16'])) != source_hash(cfg), True))

    # The clip on this machine, checked by size and sha256.
    path = clip('16x9', 'mind.the.gap', cfg, clips)
    checks.append(('the verified clip, from any spelling of the series', path.name, 'stand-in-sting-16x9-mind_the_gap.mp4'))
    spare = work / 'spare'
    shutil.copytree(clips, spare)
    victim = spare / 'stand-in-sting-16x9-under_the_hood.mp4'
    victim.write_bytes(victim.read_bytes() + b'\0')
    refused('a clip of the wrong size is refused, naming its size', lambda: clip('16x9', 'under_the_hood', cfg, spare), 'bytes')
    data = bytearray((clips / victim.name).read_bytes())
    data[-1] ^= 0xFF
    victim.write_bytes(bytes(data))
    refused('a clip of the right size and other bytes is refused, naming its sha256', lambda: clip('16x9', 'under_the_hood', cfg, spare), 'sha256')
    victim.unlink()
    refused('a missing clip is refused, saying how to get it', lambda: clip('16x9', 'under_the_hood', cfg, spare), 'intro.py fetch')
    refused('a series with no clip is refused', lambda: clip('16x9', 'built_with_ai', cfg, clips), 'no 16x9 clip')

    # The finishing path: the picture untouched, the silence exact.
    out = work / 'finished.mp4'
    info = finish_clip(path, out, '16x9', 56)
    checks.append(('the cut-ready sting: 1920x1080, 30 fps, exactly 56 frames, yuv420p, square pixels',
                   (info['width'], info['height'], info['fps'], info['frames'], info['pix_fmt'], info['sar']), (1920, 1080, '30/1', 56, 'yuv420p', '1:1')))
    checks.append(('with a 48 kHz stereo AAC track made from exactly 56 x 48000 / 30 samples, as long as the picture',
                   (info['audio'], info['sample_rate'], info['channels'], info['silence_samples'], form_problems(info, '16x9', 56)), ('aac', RATE, 2, 89600, [])))
    level = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(out), '-af', 'volumedetect', '-f', 'null', '-'],
                           capture_output=True, text=True).stderr
    checks.append(('the track is silent', '-91.0 dB' in level or 'max_volume: -inf' in level, True))
    md5 = lambda p: [line.split(',')[-1].strip() for line in subprocess.run(['ffmpeg', '-v', 'error', '-i', str(p), '-map', '0:v', '-f', 'framemd5', '-'],
                                                                            capture_output=True, text=True, check=True).stdout.splitlines() if line and not line.startswith('#')]
    checks.append(('every frame of the picture is the clip\'s own, byte for byte', md5(out) == md5(path) and len(md5(path)) == 56, True))
    short = stand_in_clip(work / 'short.mp4', '16x9', 45)
    refused('a clip of 45 frames is refused, never padded', lambda: finish_clip(short, work / 'x.mp4', '16x9', 56), 'frames 45')
    refused('a tall clip is not finished as the wide sting', lambda: finish_clip(clip('16x9', 'follow_the_money', cfg, clips), work / 'x.mp4', '9x16', 56), 'width')
    slow = work / 'slow.mp4'
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(path), '-r', '25', '-c:v', 'libx264', '-preset', 'ultrafast', str(slow)], check=True)
    refused('a clip at 25 fps is refused', lambda: finish_clip(slow, work / 'x.mp4', '16x9', 56), "fps '25/1'")
    checks.append(('nothing half-made is left behind', sorted(p.name for p in work.glob('*.part.mp4')), []))

    # sting_for, per shape, status and series.
    got, why = sting_for('16x9', 'mind.the.gap', good, clips, cache)
    checks.append(('a wide cut of mind.the.gap gets the mind_the_gap sting, cut-ready and cached by its clip\'s hash',
                   (got, why), (cached('16x9', 'mind_the_gap', cfg['clips']['16x9']['mind_the_gap']['sha256'], cache), None)))
    checks.append(('each series its own', len({sting_for('16x9', s, good, clips, cache)[0] for s in SERIES}), 3))
    checks.append(('the tall cut gets none and no note, approved or not', [sting_for('9x16', 'follow_the_money', c, clips, cache) for c in (good, cand)],
                   [(None, None), (None, None)]))
    checks.append(('an off-day piece gets none and no note, never follow_the_money\'s',
                   [sting_for('16x9', s, good, clips, cache) for s in (None, '', 'built_with_ai', 'off.day')], [(None, None)] * 4))
    got, why = sting_for('16x9', 'follow_the_money', cand, cand_clips, cache)
    checks.append(('a candidate gives no sting, and says it waits for Krish', (got, 'candidate' in (why or '')), (None, True)))
    swapped = work / 'swapped.json'
    moved = json.loads(good.read_text())
    moved['clips']['16x9']['under_the_hood'] = dict(moved['clips']['16x9']['follow_the_money'])
    moved['clips']['16x9']['under_the_hood']['library'] = f'{LIBRARY_STING}/stand-in-sting-16x9-under_the_hood.mp4'
    swapped.write_text(json.dumps(moved))
    got, why = sting_for('16x9', 'follow_the_money', swapped, clips, cache)
    checks.append(('an approval whose clips are not the ones named gives no sting, saying so', (got, 'not the ones Krish approved' in (why or '')), (None, True)))
    retired = work / 'retired.json'
    retired.write_text(json.dumps(dict(json.loads(good.read_text()), status='retired',
                                       last_decision={'on': '2026-10-29', 'by': 'Krish', 'decision': 'retired', 'words': 'a self-test stand-in'})))
    checks.append(('a retired sting gives no sting and no note, even approved clips', sting_for('16x9', 'follow_the_money', retired, clips, cache), (None, None)))
    shutil.rmtree(spare)
    shutil.copytree(clips, spare)
    (spare / 'stand-in-sting-16x9-under_the_hood.mp4').unlink()
    got, why = sting_for('16x9', 'under_the_hood', good, spare, cache, fetch_missing=False)
    checks.append(('a clip not here, with no fetch, gives no sting and says how to get it', (got, 'intro.py fetch' in (why or '')), (None, True)))
    checks.append(('wanted: approved, wide, a series', [wanted('16x9', 'mind.the.gap', good), wanted('9x16', 'mind_the_gap', good),
                                                        wanted('16x9', None, good), wanted('16x9', 'follow_the_money', cand)], [True, False, False, False]))

    # Fetch and publish, on a fake engine and a fake send: no network here.
    class FakeEngine:
        def __init__(self, held, answer=None):
            self.held, self.answer, self.asked = held, answer, []

        def operator_key(self):
            return 'stand-in key'

        def call(self, method, path, body, token, timeout=60):
            import urllib.parse
            name = urllib.parse.unquote(path.split('path=', 1)[1])
            self.asked.append(name)
            if self.answer:
                return self.answer
            if name not in self.held:
                return 404, '{"ok": false}'
            return 200, json.dumps({'download': {'url': f'https://store.example/storage/v1/object/sign/{Path(name).name}?token=t'}})

    def opener_for(source, tamper=None):
        import io

        def opener(url, timeout=600):
            data = (Path(source) / url.split('/sign/', 1)[1].split('?')[0]).read_bytes()
            return io.BytesIO(tamper(data) if tamper else data)
        return opener

    libs = {e['library'] for _, _, e in named_clips(cfg)}
    fresh = work / 'fetched'
    lines = []
    folder, got_n, missing = fetch(cfg, fresh, lines.append, engine_api=FakeEngine(libs), opener=opener_for(clips))
    checks.append(('fetch gets every clip from the library, each checked', (got_n, missing, [verified(fresh / Path(e['library']).name, e)
                                                                                           for _, _, e in named_clips(cfg)]), (3, [], [True] * 3)))
    lines = []
    api = FakeEngine(libs)
    fetch(cfg, fresh, lines.append, engine_api=api, opener=opener_for(clips))
    checks.append(('a clip already here is left alone, and the library is not asked', (api.asked, all(x.startswith('have') for x in lines)), ([], True)))

    class NoKey(FakeEngine):
        def operator_key(self):
            raise RuntimeError('no engine key (a stand-in)')
    checks.append(('a machine that has every clip needs no engine key', fetch(cfg, fresh, lambda line: None, engine_api=NoKey(libs))[1:], (3, [])))
    refused('one that must fetch, with no key, says so', lambda: fetch(cfg, work / 'fetched-nokey', print, engine_api=NoKey(libs)), 'no engine key')
    lines = []
    folder, got_n, missing = fetch(cfg, work / 'fetched-part', lines.append, engine_api=FakeEngine(set()), opener=opener_for(clips))
    checks.append(('a clip the library does not hold yet is named, and says how it gets there',
                   (got_n, len(missing), any('intro.py publish' in x for x in lines)), (0, 3, True)))
    refused('a clip that comes back the wrong size is refused, and nothing is kept',
            lambda: fetch(cfg, work / 'fetched-short', print, engine_api=FakeEngine(libs), opener=opener_for(clips, lambda d: d[:-1])), 'bytes')
    checks.append(('no half-fetched file is left', sorted(p.name for p in (work / 'fetched-short').iterdir()), []))
    refused('a clip that comes back other bytes is refused', lambda: fetch(cfg, work / 'fetched-other', print, engine_api=FakeEngine(libs),
                                                                         opener=opener_for(clips, lambda d: d[:-1] + bytes([d[-1] ^ 1]))), 'sha256')
    refused('a library answer that is not a signed https link is refused',
            lambda: fetch(cfg, work / 'fetched-plain', print, engine_api=FakeEngine(libs, (200, json.dumps({'download': {'url': 'http://x/y'}}))),
                          opener=opener_for(clips)), 'answered 200')
    refused('an engine error is refused, naming the status', lambda: fetch(cfg, work / 'fetched-500', print, engine_api=FakeEngine(libs, (500, '{}')),
                                                                         opener=opener_for(clips)), 'answered 500')
    # make.py's sting_for fetches a missing clip itself: here through the fake engine.
    real_fetch = fetch
    try:
        globals()['fetch'] = lambda *a, **k: real_fetch(*a, **k, engine_api=FakeEngine(set()), opener=opener_for(clips))
        got, why = sting_for('16x9', 'under_the_hood', good, spare, cache)
        checks.append(('a clip the library does not hold yet gives no sting, saying how it gets there',
                       (got, 'not in the library yet' in (why or ''), 'intro.py publish' in (why or '')), (None, True, True)))
        globals()['fetch'] = lambda *a, **k: real_fetch(*a, **k, engine_api=FakeEngine(libs), opener=opener_for(clips))
        got, why = sting_for('16x9', 'under_the_hood', good, spare, cache)
        checks.append(('a clip not here is fetched when allowed, checked, and used',
                       (got, why, verified(spare / 'stand-in-sting-16x9-under_the_hood.mp4', cfg['clips']['16x9']['under_the_hood'])),
                       (cached('16x9', 'under_the_hood', cfg['clips']['16x9']['under_the_hood']['sha256'], cache), None, True)))
    finally:
        globals()['fetch'] = real_fetch

    class FakeSend:
        class SendError(RuntimeError):
            pass

        class Engine:
            def __init__(self, client):
                self.client = client

        def __init__(self):
            self.planned = None

        def send(self, planned, engine_api, out=print):
            self.planned = [(t, Path(p).name, why) for t, p, why in planned]
            return {'sent': len(planned), 'already': 0, 'confirmed_only': 0}

    fake = FakeSend()
    done = publish(cfg, clips, lambda line: None, send_module=fake)
    checks.append(('publish sends every clip to its own library path, through send.py',
                   (done['sent'], sorted(t for t, _, _ in fake.planned)), (3, sorted(libs))))
    fake = FakeSend()
    bad = work / 'bad-clips'
    shutil.copytree(clips, bad)
    (bad / 'stand-in-sting-16x9-follow_the_money.mp4').write_bytes(b'not the clip')
    refused('a wrong clip stops the publish before anything is sent', lambda: publish(cfg, bad, lambda line: None, send_module=fake), 'bytes')
    checks.append(('and send.py is never called', fake.planned, None))

    # The approval lane: his words, bound to the clips the cuts use.
    lane = work / 'lane'
    lane_cfg, lane_clips = stand_in(lane, status='candidate', shapes=('16x9',))
    refused('an approval with no words is refused', lambda: approve(lane_cfg, '', clips=lane_clips), 'exact')
    refused('only Krish approves', lambda: approve(lane_cfg, 'fine', by='someone', clips=lane_clips), 'only Krish')
    hidden = lane_clips / 'stand-in-sting-16x9-mind_the_gap.mp4'
    hidden.rename(hidden.with_suffix('.away'))
    refused('an approval with a used clip missing is refused, naming it', lambda: approve(lane_cfg, 'Yes', clips=lane_clips), '16x9 mind_the_gap')
    checks.append(('and the config is untouched', load(lane_cfg)['status'], 'candidate'))
    hidden.with_suffix('.away').rename(hidden)
    words = 'Krish (a self-test stand-in, not his words): yes, that one'
    digest = approve(lane_cfg, words, on='2026-11-05', clips=lane_clips)
    after = load(lane_cfg)
    checks.append(('approve records his words and binds the clips',
                   (after['status'], after['approved_by'], after['approved_on'], after['approval_words'], after['source_sha256'], digest),
                   ('approved', 'Krish', '2026-11-05', words, source_hash(after), source_hash(after))))
    checks.append(('his last decision is the approval in his words, and the history keeps every word before it',
                   (after['last_decision'], [h['decision'] for h in after['history']]),
                   ({'on': '2026-11-05', 'by': 'Krish', 'decision': 'approved', 'words': words},
                    [h['decision'] for h in json.loads(CONFIG.read_text())['history']] + ['approved'])))
    checks.append(('his placement and colours survive the approval', (after['placement'], after['colours']), (raw['placement'], raw['colours'])))
    got, why = sting_for('16x9', 'under_the_hood', lane_cfg, lane_clips, cache)
    checks.append(('once approved, the wide cut of a series piece gets its sting', (got is not None, why), (True, None)))
    refused('a retired sting cannot be approved', lambda: approve(retired, 'Yes', clips=clips), 'retired')

    # What the config itself must say.
    def variant(name, **change):
        p = work / f'{name}.json'
        p.write_text(json.dumps(dict(json.loads(good.read_text()), **change)))
        return p
    refused('a config of the old schema is refused', lambda: load(variant('v1', schema_version=1)), 'schema_version must be 2')
    refused('45 frames under 1.8667 seconds is refused', lambda: load(variant('half', frames=45)), 'half a frame')
    refused('a 2.5 second sting is refused', lambda: load(variant('long', frames=75, seconds=2.5)), 'frames')
    refused('a shape that is not one of the two is refused', lambda: load(variant('shape', shapes=['4x3'])), 'shapes')
    refused('a sting on a shape it has no clip for is refused', lambda: load(variant('noclip', shapes=['16x9', '9x16'])), 'clips.9x16 names no clip')
    no_sha = json.loads(good.read_text())
    no_sha['clips']['16x9']['follow_the_money']['sha256'] = 'abc'
    refused('a clip with no 64-hex sha256 is refused', lambda: load(variant('nosha', clips=no_sha['clips'])), '64-hex sha256')
    elsewhere = json.loads(good.read_text())
    elsewhere['clips']['16x9']['follow_the_money']['library'] = '3 Posts/x/sting.mp4'
    refused('a clip outside the brand kit\'s Intro sting folder is refused', lambda: load(variant('lib', clips=elsewhere['clips'])), LIBRARY_STING)
    refused('an approval with no source hash is no approval', lambda: load(variant('unbound', source_sha256=None)), '64-hex source_sha256')
    refused('approved over his last word, a rejection, is refused',
            lambda: load(variant('contra', last_decision={'on': '2026-10-12', 'by': 'Krish', 'decision': 'rejected', 'words': 'no'})), 'last decision')
    refused('a sting retired on anyone\'s words but Krish\'s is refused',
            lambda: load(variant('unsaid', status='retired', last_decision={'on': '2026-10-29', 'by': 'someone', 'decision': 'retired', 'words': 'drop it'})), 'Krish')
    os.environ[CONFIG_ENV] = str(Path(tempfile.gettempdir()) / 'intro-sting.json')
    try:
        refused('a stand-in config outside .cache is refused, so no real cut opens on one', lambda: load(), '.cache')
        checks.append(('and make.py is told, not handed a sting', sting_for('16x9', 'follow_the_money')[0], None))
        os.environ[CONFIG_ENV] = str(good)
        checks.append(('one under .cache is honoured', load()['source_sha256'], cfg['source_sha256']))
    finally:
        os.environ.pop(CONFIG_ENV, None)


def main():
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(self_test())
    ap = argparse.ArgumentParser(description='The makeyourmindup intro sting: six fixed clips, the wide cut\'s opening.')
    ap.add_argument('--config', help=f'default: {CONFIG_ENV}, else config/intro-sting.json')
    ap.add_argument('--clips', help=f'the folder the clips are in (default: {CLIPS_ENV}, else .cache/quick-edit/intro/clips)')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('status', help='the approval, the source hash and which clips are here and verified')
    p.add_argument('--json', action='store_true')
    sub.add_parser('fetch', help='get every clip from the engine\'s library, checked by size and sha256')
    sub.add_parser('publish', help='send every clip on this machine to its library path (send.py)')
    p = sub.add_parser('approve', help='record Krish\'s approval of the clips, in his words')
    p.add_argument('--words')
    p.add_argument('--by', default='Krish')
    p.add_argument('--on', default=date.today().isoformat())
    p = sub.add_parser('finish', help='make the cut-ready sting for each shape and series it goes on')
    p.add_argument('--shape', choices=sorted(SHAPES))
    p.add_argument('--series', choices=SERIES, help='one series (default: every series in the config)')
    p.add_argument('--force', action='store_true', help='make it again even if the cut-ready file is there')
    a = ap.parse_args()
    try:
        if a.cmd == 'status':
            s = status(a.config, a.clips)
            if a.json:
                print(json.dumps(s, indent=1))
                return
            print(f'intro sting: {s["status"]}, {s["frames"]} frames at {s["fps"]} fps ({s["seconds"]} s), on {", ".join(s["shapes"])}, '
                  f'series {", ".join(s["series"])}')
            if s['last_decision']:
                d = s['last_decision']
                print(f'last decision: {d["decision"]} by {d["by"]} on {d.get("on")}: "{d["words"]}"')
            print(f'source: {s["source_sha256"]}' + ('' if s['status'] != 'approved' else
                                                     ' (the one Krish approved)' if s['matches'] else ' (NOT the one Krish approved)'))
            for shape, per in s['clips'].items():
                for series, c in per.items():
                    state = 'verified' if c['verified'] else c['problem']
                    print(f'{shape} {series}{"" if c["used"] else " (kept for the record)"}: {state}')
        elif a.cmd == 'fetch':
            folder, got, missing = fetch(load(a.config), a.clips)
            print(f'{got} clip(s) in {folder}' + (f'; not in the library yet: {", ".join(missing)}' if missing else ''))
            if missing:
                sys.exit(2)
        elif a.cmd == 'publish':
            done = publish(load(a.config), a.clips)
            print(f'sent {done["sent"]}, already there {done["already"]}, confirmed {done["confirmed_only"]}')
        elif a.cmd == 'approve':
            digest = approve(a.config, a.words, a.by, a.on, a.clips)
            print(f'intro sting approved by {a.by} on {a.on}, source {digest[:16]}')
        elif a.cmd == 'finish':
            cfg = load(a.config)
            for shape in [a.shape] if a.shape else cfg['shapes']:
                for series in [a.series] if a.series else cfg['series']:
                    print(f'{shape} {series}: {finish(shape, series, cfg, a.clips, force=a.force)}')
    except IntroError as e:
        sys.exit(f'intro: {e}')


if __name__ == '__main__':
    main()
