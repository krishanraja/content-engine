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
           render path, into .cache/ve/lab/<engine>/
  reel     one mp4: a title card then each look; and one sheet of sampled frames
  diff     every look against the last lab render on another engine (velib.styles.difference): the house must not move
  verdict  his words on a look, through creative_direction.style_verdict with context lab: a lab pick makes a style
           liked, never tested (tested still needs his pick on a piece)

It approves nothing and changes no piece.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

from .common import CONFIG, ROOT, ffmpeg, load_json, sha256_file, write_json

LAB = CONFIG / 'lab.json'
CACHE = ROOT / '.cache' / 've' / 'lab'
RESULTS = ROOT / 'docs' / 've' / 'lab'
STUDIO = ROOT / 'config' / 'studio.json'
TITLE_S = 1.0
REEL_W, REEL_H = 540, 960
TITLE_PX = 40


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


def looks(cfg: dict) -> list[dict]:
    """The house look, each caption look the renderer draws (props captionStyle), and each drawable motion style."""
    from .compile import MOTION_PROFILES  # noqa: PLC0415
    out = [{'id': 'house', 'kind': 'house', 'title': 'House look'}]
    out += [{'id': f'captions-{c}', 'kind': 'captions', 'caption': c, 'title': f'Captions: {c}'} for c in cfg['caption_looks']]
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
    for look in looks(cfg):
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


def verdict(module: str, said: str, on: str, choice: str, path: Path | None = None) -> dict:
    """His words on a style he saw in the lab, through the one verdict writer (creative_direction.style_verdict)."""
    sys.path.insert(0, str(ROOT / 'scripts' / 'post-pack'))
    import creative_direction  # noqa: PLC0415
    path = Path(path or creative_direction.STYLES)
    text = path.read_text(encoding='utf-8')
    out = creative_direction.style_verdict(json.loads(text), module, choice, said, on, context='lab')
    path.write_text(creative_direction.replace_module_text(text, out, module), encoding='utf-8')
    return next(m for m in out['bank'] if m.get('id') == module)
