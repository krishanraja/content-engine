"""ve lab: every drawable motion style and every caption look on one window of one archived take of his, outside any
piece, for one rating sitting; and the same reel as the engine's regression check.

Krish, 4 Nov 2026 (docs/learning/2026-11-04-thursday-killed.md, answer 5): "When we're experimenting, instead of using
proven, approved templates, we need to experiment carefully, as opposed to just producing videos experimentally and
then seeing that they're shit." The bank's 17 motion styles entered untested (learning upgrade-the-edit-style: "new
looks are tried on his own footage before they are used"); `ve styles` shows three on a live piece. The lab shows all
of them, on his real take, before any piece, at the cost of one render each (ghost-editor: a look is proven on real
footage and saved before a reel uses it).

  stage    rebuild the window's media from the pinned take (fetched by scripts/post-pack/recording.py): conform its
           committed EDL, his voice as the stem (no bed), and the brand marks, each checked against config/studio.json
  render   the house look, each caption look and each drawable style on config/ve/lab.json's window, through the one
           render path, into .cache/ve/lab/<engine>/; a caption style from config/caption-themes.json (theme-<name>) only
           when --only names it, so the regression reel never grows by itself
  sample   records one rendered look, filed in his Drive, as the sample Pick a style shows on the board
           (config/ve/style-samples.json; view contract 1.16.0)
  stills   one 540x960 JPEG per drawable style and caption style the lab rendered, all cut at one frame of the window
           (STILL_FRAME), into .cache, with a manifest (Krish, 16 Nov 2026: "hover over the captions, look, and motion
           style and see a templated screenshot of what it might look like. No need for a video, just a still.")
  still    records one still, filed in his Drive, as the picture the board shows on hover (style-samples.json stills;
           a look's still comes from a design-lock key frame or a Codex plate, not the lab)
  reel     one mp4: a title card then each look; and one sheet of sampled frames
  diff     every look against the last lab render on another engine (velib.styles.difference): the house must not move
  verdict  his words on a look, through creative_direction.style_verdict with context lab: a lab pick makes a style
           liked, never tested (tested still needs his pick on a piece)

It approves nothing and changes no piece.
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

from .common import CONFIG, ROOT, ffmpeg, load_json, sha256_file, write_json

LAB = CONFIG / 'lab.json'
STYLE_SAMPLES = CONFIG / 'style-samples.json'
CAPTION_THEMES = ROOT / 'config' / 'caption-themes.json'
THEME_PREFIX = 'theme-'
SAMPLE_PATH = '/api/board/sign-offs?file='   # the engine's Drive file route the board shows a sample from
SAMPLE_DRIVE_ID = re.compile(r'^[A-Za-z0-9_-]{20,80}$')
CACHE = ROOT / '.cache' / 've' / 'lab'
RESULTS = ROOT / 'docs' / 've' / 'lab'
STUDIO = ROOT / 'config' / 'studio.json'
TITLE_S = 1.0
REEL_W, REEL_H = 540, 960
TITLE_PX = 40
STILL_LAYERS = ('treatment', 'motion', 'captions')   # the board's three pickers: look, motion style, captions
STILL_W, STILL_H = 540, 960   # the 9:16 frame at the lab's scale (0.5 of 1080x1920)
STILL_SLACK = 8               # px a recorded still may differ from 540x960 either way (a plate cropped to 9:16)
STILL_QUALITY = 3             # ffmpeg -q:v for the JPEG: 2 is the best, 31 the worst
# The one frame every still is cut at, on the pinned short cut's own clock (config/ve/lab.json: window 315 to 555), so
# every still shows the same moment and differs only by its style. Frame 445, 54% into the window, not its 60% point
# (459, where the "Google" page is one frame old and the Amazon scribble has just begun to leave): the "groceries,"
# caption page (420 to 458) has stood for 25 frames, so every caption style has finished its entrance; the proof beat
# (366 to 504) is mid-way, the logo card lit since 402 and the Amazon scribble drawn since 412 (10 frames to draw), so
# every motion style's device is on screen and settled; nothing changes until 458 and no cut is near (366, 504).
# A new take or window needs a new frame: still_frame refuses one outside the window.
STILL_FRAME = 445
STILLS_MANIFEST = 'stills.json'


def config(path: Path = LAB) -> dict:
    return load_json(path)


RENDER_SCRIPT = ROOT / 'apps' / 'renderer' / 'scripts' / 've-render.mjs'


def engine_id() -> str:
    """The engine the lab renders with: the frozen engine paths and the render script that encodes the picture
    (its colour and encoder settings are not in the freeze list, and a change there moves every look)."""
    import hashlib  # noqa: PLC0415
    from . import guards  # noqa: PLC0415
    return hashlib.sha256(f'{guards.engine_sha()} {sha256_file(RENDER_SCRIPT)}'.encode()).hexdigest()[:12]


def brand_marks() -> list[dict]:
    """The publication's marks as config/studio.json pins them: source path and sha256."""
    studio = load_json(STUDIO)
    found = []

    def walk(node):
        if isinstance(node, dict):
            if isinstance(node.get('source_path'), str) and isinstance(node.get('sha256'), str) and 'brand' in node['source_path']:
                found.append({'source_path': node['source_path'], 'sha256': node['sha256']})
            for value in node.values():
                walk(value)
        elif isinstance(node, list):
            for value in node:
                walk(value)
    walk(studio)
    return found


def stage(cfg: dict, take: Path, brand_dir: Path, out: Path) -> Path:
    """The window's media, rebuilt where the props expect it: the conformed picture and his voice from the pinned take
    (its committed EDL), and the brand marks. Returns the assets folder."""
    from . import conform  # noqa: PLC0415
    take, brand_dir, out = Path(take), Path(brand_dir), Path(out)
    if sha256_file(take) != cfg['take']['sha256']:
        raise ValueError(f'{take} is not the pinned take ({cfg["take"]["name"]}): fetch it with scripts/post-pack/recording.py')
    piece = ROOT / cfg['piece_dir']
    edl = load_json(piece / f'edl.{cfg["cut"]}.json')
    records = conform.records_for(edl, piece)
    for record in records.values():
        record['media'] = {**record['media'], 'path': str(take.resolve())}
    assets = out / 'assets'
    assets.mkdir(parents=True, exist_ok=True)
    made = conform.render(edl, records, assets)
    stem = assets / f'audio.{cfg["cut"]}.wav'
    shutil.copyfile(made['dialogue'], stem)   # his voice only: the lab judges pictures, and no bed is invented here
    for mark in brand_marks():
        name = Path(mark['source_path']).name
        source = brand_dir / name
        if not source.is_file() or sha256_file(source) != mark['sha256']:
            raise ValueError(f'{source} is missing or is not the pinned {name} (config/studio.json)')
        target = assets / mark['source_path']
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    return assets


def window_props(cfg: dict, assets: Path) -> dict:
    """The piece's compiled props, its media pointed at the staged assets, cut to the lab window."""
    from . import proof  # noqa: PLC0415
    text = (ROOT / cfg['piece_dir'] / f'props.{cfg["cut"]}.json').read_text(encoding='utf-8')
    # Forward slashes: a Windows path's backslashes would be JSON escapes inside the props text.
    text = text.replace(cfg['assets_prefix'], Path(assets).resolve().as_posix())
    start, end = cfg['window']
    return proof.window_props(json.loads(text), start, end)


def caption_themes() -> list[str]:
    """The caption styles a piece picks (config/caption-themes.json, props captionTheme), in its order."""
    return [k for k in load_json(CAPTION_THEMES) if not k.startswith('_')]


def looks(cfg: dict, only: list[str] | None = None) -> list[dict]:
    """The house look, each caption look the renderer draws (props captionStyle), and each drawable motion style; and
    each caption style --only names as theme-<name> (props captionTheme), drawn only when asked for."""
    from .compile import MOTION_PROFILES  # noqa: PLC0415
    out = [{'id': 'house', 'kind': 'house', 'title': 'House look'}]
    out += [{'id': f'captions-{c}', 'kind': 'captions', 'caption': c, 'title': f'Captions: {c}'} for c in cfg['caption_looks']]
    themes = caption_themes()
    out += [{'id': f'{THEME_PREFIX}{t}', 'kind': 'caption_theme', 'theme': t, 'title': f'Caption style: {t}'}
            for t in themes if only and f'{THEME_PREFIX}{t}' in only]
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import creative_direction  # noqa: PLC0415
    bank = creative_direction.motion_modules()
    for module in sorted(load_json(MOTION_PROFILES)['profiles']):
        if module in bank:
            out.append({'id': module, 'kind': 'style', 'module': module,
                        'title': f"{bank[module].get('name', module)} ({bank[module].get('krish_verdict', 'untested')})"})
    return out


def props_for(look: dict, window: dict, spec: dict) -> dict:
    from .compile import motion_props  # noqa: PLC0415
    props = {k: v for k, v in window.items() if k != 'motion'}
    if look['kind'] == 'captions':
        props['captionStyle'] = look['caption']
    if look['kind'] == 'caption_theme':
        props['captionTheme'] = look['theme']
    if look['kind'] == 'style':
        trial = json.loads(json.dumps(spec))
        trial.setdefault('style', {})['motion'] = {'module': look['module'], 'reason': 'the lab'}
        props['motion'] = motion_props(trial)
    return props


def render(cfg: dict, assets: Path, render_fn, out: Path | None = None, only: list[str] | None = None) -> dict:
    """Render every look on the window; write manifest.json beside the clips; return it."""
    engine = engine_id()
    out = Path(out or CACHE / engine)
    out.mkdir(parents=True, exist_ok=True)
    spec = load_json(ROOT / cfg['piece_dir'] / 'spec.json')
    window = window_props(cfg, assets)
    rows = []
    for look in looks(cfg, only):
        if only and look['id'] not in only:
            continue
        props = props_for(look, window, spec)
        if look['kind'] == 'house':
            look = {**look, 'title': f"House look (captions: {props.get('captionStyle') or 'house'})"}
        props_path = write_json(out / f'props.{look["id"]}.json', props)
        clip = out / f'{look["id"]}.mp4'
        render_fn(props_path, clip)
        if not clip.is_file() or clip.stat().st_size == 0:
            raise ValueError(f'the lab render wrote nothing for {look["id"]}')
        row = {**look, 'file': clip.name, 'sha256': sha256_file(clip)}
        twin = next((r for r in rows if r['sha256'] == row['sha256']), None)
        if twin:
            row['same_as'] = twin['id']   # the same picture as an earlier look: kept for the diff, shown once
        rows.append(row)
    fps = window.get('fps', 30)
    manifest = {'schema': 've-lab/1', 'engine': engine, 'take_sha256': cfg['take']['sha256'], 'cut': cfg['cut'],
                'window': cfg['window'], 'seconds': round((cfg['window'][1] - cfg['window'][0]) / fps, 3),
                'scale': cfg['scale'], 'looks': rows}
    write_json(out / 'manifest.json', manifest)
    return manifest


def shown_looks(manifest: dict) -> list[dict]:
    """The looks the reel and sheet show, each picture once, numbered in the order shown so he can answer by number."""
    shown = [look for look in manifest['looks'] if not look.get('same_as')]
    return [{**look, 'label': f"{n}. {look['title']}"} for n, look in enumerate(shown, 1)]


def _title(text: str, path: Path) -> Path:
    from PIL import Image, ImageDraw, ImageFont  # noqa: PLC0415
    image = Image.new('RGB', (REEL_W, REEL_H), (16, 18, 20))
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default(size=TITLE_PX)   # Pillow's own face: no font file to find on any machine
    lines, line = [], ''
    for word in text.split():
        trial = f'{line} {word}'.strip()
        if line and draw.textlength(trial, font=font) > REEL_W - 80:
            lines.append(line)
            line = word
        else:
            line = trial
    lines.append(line)
    step = round(TITLE_PX * 1.3)
    for k, part in enumerate(lines):
        draw.text((40, REEL_H // 2 - step * len(lines) // 2 + step * k), part, font=font, fill=(240, 240, 240))
    image.save(path)
    return path


def reel(out: Path) -> Path:
    """One mp4 of every look, each after a one-second title card, all at the same size, rate and sound format."""
    out = Path(out)
    manifest = load_json(out / 'manifest.json')
    parts = []
    shown = shown_looks(manifest)
    for look in shown:
        card = _title(look['label'], out / f'title.{look["id"]}.png')
        parts += ['-loop', '1', '-t', f'{TITLE_S}', '-i', str(card), '-f', 'lavfi', '-t', f'{TITLE_S}', '-i',
                  'anullsrc=r=48000:cl=stereo', '-i', str(out / look['file'])]
    graph, n = [], len(shown)
    for k in range(n):
        t, s, c = 3 * k, 3 * k + 1, 3 * k + 2
        scale = f'scale={REEL_W}:{REEL_H}:force_original_aspect_ratio=decrease,pad={REEL_W}:{REEL_H}:(ow-iw)/2:(oh-ih)/2,fps=30,format=yuv420p,setsar=1'
        graph.append(f'[{t}:v]{scale}[tv{k}]')
        graph.append(f'[{s}:a]aformat=sample_rates=48000:channel_layouts=stereo[ta{k}]')
        graph.append(f'[{c}:v]{scale}[cv{k}]')
        graph.append(f'[{c}:a]aformat=sample_rates=48000:channel_layouts=stereo[ca{k}]')
    graph.append(''.join(f'[tv{k}][ta{k}][cv{k}][ca{k}]' for k in range(n)) + f'concat=n={2 * n}:v=1:a=1[v][a]')
    target = out / 'lab-reel.mp4'
    subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', *parts, '-filter_complex', ';'.join(graph), '-map', '[v]',
                    '-map', '[a]', '-c:v', 'libx264', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k',
                    '-movflags', '+faststart', str(target)], check=True, capture_output=True)
    return target


def sheet(out: Path, frames: int = 6, width: int = 160) -> Path:
    """One row per look: frames sampled across its clip, labelled."""
    from io import BytesIO  # noqa: PLC0415
    from PIL import Image, ImageDraw  # noqa: PLC0415
    out = Path(out)
    manifest = load_json(out / 'manifest.json')
    rows = []
    for look in shown_looks(manifest):
        grabbed = []
        for k in range(frames):
            at = manifest['seconds'] * (k + 0.5) / frames
            raw = subprocess.run([ffmpeg(), '-v', 'error', '-ss', f'{at:.3f}', '-i', str(out / look['file']), '-frames:v', '1',
                                  '-vf', f'scale={width}:-2', '-f', 'image2pipe', '-vcodec', 'png', '-'],
                                 capture_output=True, check=True).stdout
            grabbed.append(Image.open(BytesIO(raw)).convert('RGB'))
        rows.append((look['label'], grabbed))
    tile_h = rows[0][1][0].height
    image = Image.new('RGB', (width * frames, (tile_h + 18) * len(rows)), (24, 24, 24))
    draw = ImageDraw.Draw(image)
    for r, (title, grabbed) in enumerate(rows):
        top = r * (tile_h + 18)
        draw.text((4, top + 2), title, fill=(235, 235, 235))
        for c, frame in enumerate(grabbed):
            image.paste(frame, (c * width, top + 18))
    target = out / 'lab-sheet.jpg'
    image.save(target, quality=85)
    return target


def diff(out: Path, previous: Path, sample=None, moved_at: float | None = None) -> dict:
    """Every look against the same look on the last lab render: mean absolute difference of sampled grey frames
    (velib.styles). The house look moving is the regression; a style moving is listed for his eye."""
    from . import styles  # noqa: PLC0415
    out, previous = Path(out), Path(previous)
    now, before = load_json(out / 'manifest.json'), load_json(previous / 'manifest.json')
    moved_at = config()['house_moves_at'] if moved_at is None else moved_at
    sample = sample or (lambda clip: styles.sample_frames(clip, now['seconds']))
    old = {look['id']: look for look in before['looks']}
    rows = []
    for look in now['looks']:
        if look['id'] not in old:
            rows.append({'id': look['id'], 'status': 'new'})
            continue
        same = look['sha256'] == old[look['id']]['sha256']
        score = 0.0 if same else styles.difference(sample(out / look['file']), sample(previous / old[look['id']]['file']))
        rows.append({'id': look['id'], 'status': 'same' if same else 'changed', 'difference': round(score, 3)})
    house = next((r for r in rows if r['id'] == 'house'), None)
    report = {'schema': 've-lab-diff/1', 'engine': now['engine'], 'against': before['engine'], 'looks': rows,
              'house_moved': bool(house and house.get('difference', 0) > moved_at), 'moved_at': moved_at}
    return report


def as_shot(out: Path) -> dict:
    """Each shown look's picture.as_shot reading on his take (advisory): does a look treat his room?"""
    from . import qc, qc_as_shot  # noqa: PLC0415
    out = Path(out)
    rows = {}
    for look in shown_looks(load_json(out / 'manifest.json')):
        inputs = qc.inputs_from_props(load_json(out / f'props.{look["id"]}.json'))
        if not inputs.get('plate_video'):
            continue
        row = qc_as_shot.as_shot(str(out / look['file']), inputs['plate_video'], inputs['beats'], 30,
                                 inputs['plate_offset'], inputs['pages'])
        worst = {axis: max([beat[axis] for beat in row['value'].values()], default=0.0) for axis in 'Lab'}
        rows[look['id']] = {'worst': worst, 'moved': row['moved']}
    return rows


def record(manifest: dict, report: dict | None = None, today: str | None = None, shot: dict | None = None) -> Path:
    """docs/ve/lab/<date>.json: what was rendered (hashes, never media), how it compares with the last render, and
    whether any look moved his room off the take as shot."""
    RESULTS.mkdir(parents=True, exist_ok=True)
    return write_json(RESULTS / f'{today or date.today().isoformat()}.json',
                      {'manifest': manifest, 'diff': report, 'as_shot': shot})


def record_sample(layer: str, style_id: str, drive_id: str, clip: Path | None = None, path: Path = STYLE_SAMPLES) -> dict:
    """One rendered look, filed in his Drive, recorded as the sample Pick a style shows on the board: its value the
    engine's same-site Drive file route (/api/board/sign-offs?file=<drive id>), its Drive id in the drive map, its waiting
    note gone. A motion sample is a drawable style's look (its id); a caption sample is a caption style (theme-<name>
    rendered, recorded by its name). With clip, the file must be the lab's render of that look (its manifest beside it).
    It writes only config/ve/style-samples.json; filing in Drive is the session's (docs/DRIVE.md)."""
    if layer not in ('motion', 'captions'):
        raise ValueError('the layer is motion or captions')
    if not SAMPLE_DRIVE_ID.match(str(drive_id or '')):
        raise ValueError(f'"{drive_id}" is not a Drive file id (the id in drive.google.com/file/d/<id>/view)')
    if layer == 'motion' and style_id not in {look['id'] for look in looks(config()) if look['kind'] == 'style'}:
        raise ValueError(f'{style_id} is not a motion style the lab draws')
    if layer == 'captions' and style_id not in caption_themes():
        raise ValueError(f'{style_id} is not a caption style (config/caption-themes.json)')
    # Every lab render is a cut of his pinned take, and a cut of his recordings is never an example on the board
    # (Krish, 2026-11-16: "Please don't tell me this is going on the board as an example or a gold standard template").
    # The board shows the StyleStill template's stills; a sample waits for a template of its own.
    raise ValueError('a style sample is a render of his pinned take, and a cut of his recordings is never an example on the '
                     'board; the board shows the StyleStill template\'s stills (ve lab still) instead')
    if clip is not None:
        clip = Path(clip)
        manifest = load_json(clip.parent / 'manifest.json')
        want = style_id if layer == 'motion' else f'{THEME_PREFIX}{style_id}'
        row = next((look for look in manifest.get('looks') or [] if look.get('id') == want), None)
        if not row or row.get('file') != clip.name or sha256_file(clip) != row.get('sha256'):
            raise ValueError(f'{clip} is not the lab\'s render of {want} (its manifest beside it names another file)')
    doc = load_json(path)
    doc.setdefault(layer, {})[style_id] = f'{SAMPLE_PATH}{drive_id}'
    doc.setdefault('drive', {}).setdefault(layer, {})[style_id] = drive_id
    (doc.get('waiting') or {}).get(layer, {}).pop(style_id, None)
    write_json(path, doc)
    return doc


def still_frame(cfg: dict) -> int:
    """The frame of the window's clip every still is cut at: STILL_FRAME on the take's own clock, less the window's
    start (the lab's clip begins at the window's first frame)."""
    start, end = cfg['window']
    if not start <= STILL_FRAME < end:
        raise ValueError(f'the still frame {STILL_FRAME} is outside the lab window {start} to {end}: choose another '
                         '(velib/lab.py STILL_FRAME)')
    return STILL_FRAME - start


def still_target(look: dict) -> tuple[str, str] | None:
    """(layer, id) a lab look's still is recorded under: a drawable style by its motion id, a caption style
    (theme-<id>) by its caption id. The house look and the caption builds have none."""
    if look.get('kind') == 'style':
        return 'motion', look['module']
    if look.get('kind') == 'caption_theme':
        return 'captions', look['theme']
    return None


def stills_dir(out: Path) -> Path:
    """Where the stills of a lab folder go: <out>/stills, under .cache when it is inside the repository, never in it."""
    folder = (Path(out) / 'stills').resolve()
    root = ROOT.resolve()
    if folder.is_relative_to(root) and not folder.is_relative_to(root / '.cache'):
        raise ValueError(f'{folder}: stills go under .cache, never in the repository (no media is committed)')
    return folder


def jpeg_size(path: Path) -> tuple[int, int] | None:
    """(width, height) of a JPEG from its header (quick-edit/archive.image_size, no image library), or None when the
    file is not a JPEG."""
    sys.path.insert(0, str(ROOT / 'scripts' / 'quick-edit'))
    import archive  # noqa: PLC0415
    try:
        with open(path, 'rb') as f:
            if f.read(2) != b'\xff\xd8':
                return None
    except OSError:
        return None
    return archive.image_size(path)


def grab(clip: Path, frame: int, target: Path) -> Path:
    """One frame of a clip, chosen by its number (never by a timestamp), as a 540x960 JPEG."""
    target = Path(target)
    target.unlink(missing_ok=True)
    pad = f'scale={STILL_W}:{STILL_H}:force_original_aspect_ratio=decrease,pad={STILL_W}:{STILL_H}:(ow-iw)/2:(oh-ih)/2,setsar=1'
    done = subprocess.run([ffmpeg(), '-nostdin', '-v', 'error', '-y', '-i', str(clip), '-vf', f'select=eq(n\\,{frame}),{pad}',
                           '-frames:v', '1', '-q:v', str(STILL_QUALITY), str(target)], capture_output=True, text=True, errors='replace')
    if done.returncode or not target.is_file() or target.stat().st_size == 0:
        target.unlink(missing_ok=True)
        raise ValueError(f'{clip} gave no frame {frame}' + (f': {done.stderr.strip()[-300:]}' if done.stderr.strip() else ''))
    return target


def stills(out: Path, only: list[str] | None = None, cfg: dict | None = None, grab_fn=grab) -> dict:
    """One still per drawable style and caption style the lab rendered in out, every one cut at the same frame
    (STILL_FRAME), as <out>/stills/<layer>-<id>.jpg, with stills.json beside them; returns that manifest. --only
    narrows it to the looks it names. Nothing is filed or recorded: that is ve lab still, after he has seen them."""
    cfg = cfg or config()
    out = Path(out)
    if not (out / 'manifest.json').is_file():
        raise ValueError(f'no lab render in {out}: run ve lab render first, or pass --take and --brand-dir')
    manifest = load_json(out / 'manifest.json')
    if (manifest.get('take_sha256'), manifest.get('cut'), manifest.get('window')) != (cfg['take']['sha256'], cfg['cut'], cfg['window']):
        raise ValueError(f'{out} is not a render of the pinned take\'s window (config/ve/lab.json): the still frame is chosen for it')
    frame = still_frame(cfg)
    rendered = {look['id'] for look in manifest['looks']}
    missing = [look_id for look_id in only or [] if look_id not in rendered]
    if missing:
        raise ValueError(f'{out} has no render of {", ".join(missing)}: render it first (ve lab render --only)')
    folder = stills_dir(out)
    folder.mkdir(parents=True, exist_ok=True)
    rows = []
    for look in manifest['looks']:
        target = still_target(look)
        if not target or (only and look['id'] not in only):
            continue
        layer, still_id = target
        clip = out / look['file']
        if sha256_file(clip) != look.get('sha256'):
            raise ValueError(f'{clip} is not the render its manifest names')
        jpg = grab_fn(clip, frame, folder / f'{layer}-{still_id}.jpg')
        size = jpeg_size(jpg)
        if size != (STILL_W, STILL_H):
            raise ValueError(f'{jpg} is {size or "not a JPEG"}, not {STILL_W}x{STILL_H}')
        rows.append({'id': still_id, 'layer': layer, 'path': Path(jpg).as_posix(), 'sha256': sha256_file(jpg),
                     'width': size[0], 'height': size[1], 'look': look['id'], 'clip_sha256': look['sha256']})
    if not rows:
        raise ValueError(f'no drawable style or caption style rendered in {out} to cut a still from')
    doc = {'schema': 've-lab-stills/1', 'source': 'take', 'engine': manifest['engine'], 'take_sha256': manifest['take_sha256'],
           'cut': manifest['cut'], 'window': manifest['window'], 'frame': STILL_FRAME, 'clip_frame': frame, 'stills': rows}
    write_json(folder / STILLS_MANIFEST, doc)
    return doc


def treatments() -> list[str]:
    """The looks the board's Look picker offers (config/style-references.json formats.production), in its order."""
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import creative_direction  # noqa: PLC0415
    return list(creative_direction.bank()[2])


def record_still(layer: str, still_id: str, drive_id: str, file: Path | None = None, path: Path = STYLE_SAMPLES) -> dict:
    """One still, filed in his Drive, recorded as the picture the board shows when he hovers a look, a motion style or
    a caption style: its value the same Drive file route as a sample (/api/board/sign-offs?file=<drive id>), its Drive id
    in stills_drive, by layer. A motion still is a drawable style's (never one whose device is not built); a caption
    still is a caption style's; a look's (treatment) comes from a Codex plate. Every one is drawn on the neutral StyleStill
    template, never a frame of a take (Krish, 2026-11-16): a still beside a take's stills.json is refused.
    With file, it must be a JPEG of about 540x960 and, for motion and captions, the lab's still of that style (stills.json
    beside it). It writes only config/ve/style-samples.json; filing in Drive is the session's (docs/DRIVE.md)."""
    if layer not in STILL_LAYERS:
        raise ValueError(f'the layer is {", ".join(STILL_LAYERS[:-1])} or {STILL_LAYERS[-1]}')
    if not SAMPLE_DRIVE_ID.match(str(drive_id or '')):
        raise ValueError(f'"{drive_id}" is not a Drive file id (the id in drive.google.com/file/d/<id>/view)')
    if layer == 'treatment' and still_id not in treatments():
        raise ValueError(f'{still_id} is not a look (config/style-references.json formats.production)')
    if layer == 'motion' and still_id not in {look['id'] for look in looks(config()) if look['kind'] == 'style'}:
        sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
        import creative_direction  # noqa: PLC0415
        module = creative_direction.motion_modules().get(still_id) or {}
        if 'needs_device' in (module.get('ve_route') or []):
            raise ValueError(f'{still_id} needs a device the lab cannot draw yet (ve_route needs_device): it has no still')
        raise ValueError(f'{still_id} is not a motion style the lab draws')
    if layer == 'captions' and still_id not in caption_themes():
        raise ValueError(f'{still_id} is not a caption style (config/caption-themes.json)')
    # A motion or caption still is always the lab's own frame, checked against stills.json: never recorded blind.
    if file is None and layer in ('motion', 'captions'):
        raise ValueError(f'a {layer} still is recorded with --file, the lab\'s still of it (ve lab stills), so it is checked')
    if file is not None:
        file = Path(file)
        size = jpeg_size(file)
        if size is None:
            raise ValueError(f'{file} is not a JPEG')
        if abs(size[0] - STILL_W) > STILL_SLACK or abs(size[1] - STILL_H) > STILL_SLACK:
            raise ValueError(f'{file} is {size[0]}x{size[1]}, not a {STILL_W}x{STILL_H} still')
        beside = file.parent / STILLS_MANIFEST
        made = load_json(beside) if beside.is_file() else {}
        # A board still is drawn on the neutral StyleStill template, never a frame of a take: the first stills were frames
        # of his Thu 5 Nov take, which he hates (Krish, 2026-11-16: "Please don't tell me this is going on the board as
        # an example or a gold standard template that we could use in future projects").
        if made.get('take_sha256') or made.get('source') == 'take':
            raise ValueError(f'{file} is a frame of a take; a board still is drawn on the neutral StyleStill template '
                             '(card ve-style-still-template-1), never a frame of his recordings')
        if layer in ('motion', 'captions'):
            rows = (made.get('stills') or []) if made.get('source') == 'template' else []
            row = next((r for r in rows if r.get('layer') == layer and r.get('id') == still_id), None)
            if not row or Path(str(row.get('path'))).name != file.name or sha256_file(file) != row.get('sha256'):
                raise ValueError(f'{file} is not the StyleStill template\'s still of {layer} {still_id} ({STILLS_MANIFEST} beside it, '
                                 'source template, names another file or none)')
    doc = load_json(path)
    doc.setdefault('stills', {}).setdefault(layer, {})[still_id] = f'{SAMPLE_PATH}{drive_id}'
    doc.setdefault('stills_drive', {}).setdefault(layer, {})[still_id] = drive_id
    write_json(path, doc)
    return doc


def verdict(module: str, said: str, on: str, choice: str, path: Path | None = None) -> dict:
    """His words on a style he saw in the lab, through the one verdict writer (creative_direction.style_verdict)."""
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import creative_direction  # noqa: PLC0415
    path = Path(path or creative_direction.STYLES)
    text = path.read_text(encoding='utf-8')
    out = creative_direction.style_verdict(json.loads(text), module, choice, said, on, context='lab')
    path.write_text(creative_direction.replace_module_text(text, out, module), encoding='utf-8')
    return next(m for m in out['bank'] if m.get('id') == module)
