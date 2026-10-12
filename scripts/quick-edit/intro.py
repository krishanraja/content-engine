#!/usr/bin/env python3
"""The makeyourmindup intro sting: a 1 to 2 second animated opening before
Krish's face comes in, one clip per shape.

Krish, 2026-10-12: "I also want the video to have a 1-2 sec animated make
your mind up intro visual before my face comes in".

The design lives in the renderer as two Remotion compositions, named in
config/intro-sting.json ("compositions": tall 9x16 and wide 16x9). This
renders each to .cache/quick-edit/intro/<hash>-<shape>.mp4: 30 fps, yuv420p,
square pixels, exactly `seconds` long, with a silent 48 kHz stereo AAC track,
so make.py can join it in front of the captioned cut without retiming a
word. <hash> is the sha256 of the sting's source files (every file under
apps/renderer/src with "sting" in its path) and its seconds and composition
names, so a changed design renders afresh and an unchanged one never does.

The design waits for Krish. config/intro-sting.json says "candidate" until he
approves it, and while it does:
  - `render --preview` renders preview-<hash>-<shape>.mp4 to show him;
  - `render` without --preview refuses;
  - make.py renders without an intro and says so in its report.
`approve --words "..."` records his words and the hash of the preview he saw.
A sting whose source changes after that is not used until he approves again.

    python intro.py status
    python intro.py render --preview [--shape 9x16|16x9] [--browser PATH]
    python intro.py approve --words "Krish's exact words"
    python intro.py render
    python intro.py --self-test
"""
import argparse
import glob
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
CONFIG = REPO / 'config' / 'intro-sting.json'
CACHE = REPO / '.cache' / 'quick-edit' / 'intro'
RENDERER = REPO / 'apps' / 'renderer' / 'src'
SHAPES = {'9x16': (1080, 1920), '16x9': (1920, 1080)}
FPS = 30
RATE = 48000
SECONDS = (1.0, 2.0)
INK = '0x0C1512'
# Where Remotion's browser is in this cloud container; on the runner machines
# the Studio's own copy is used, else Remotion fetches one.
CONTAINER_BROWSER = '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell'


class IntroError(ValueError):
    """A reason the sting cannot be used or rendered, in plain words."""


def load(path=None):
    path = Path(path or CONFIG)
    cfg = json.loads(path.read_text(encoding='utf-8'))
    if cfg.get('schema_version') != 1:
        raise IntroError(f'{path}: schema_version must be 1')
    if cfg.get('status') not in ('candidate', 'approved'):
        raise IntroError(f'{path}: status is "candidate" or "approved"')
    secs = cfg.get('seconds')
    if not isinstance(secs, (int, float)) or not SECONDS[0] <= secs <= SECONDS[1]:
        raise IntroError(f'{path}: seconds is between {SECONDS[0]} and {SECONDS[1]}')
    comps = cfg.get('compositions') or {}
    if sorted(comps) != sorted(SHAPES) or not all(isinstance(v, str) and v for v in comps.values()):
        raise IntroError(f'{path}: compositions names one composition for each of {", ".join(SHAPES)}')
    if cfg['status'] == 'approved' and not (str(cfg.get('approved_by') or '').lower().startswith('krish') and cfg.get('approval_words')):
        raise IntroError(f'{path}: an approved sting carries Krish\'s approval and his words')
    return cfg


def source_files(root=None):
    root = Path(root or RENDERER)
    if not root.is_dir():
        return []
    return sorted(p for p in root.rglob('*') if p.is_file() and re.search('sting', p.relative_to(root).as_posix(), re.I))


def source_hash(cfg, root=None):
    """The sting's identity: its source files, seconds and composition names.
    None when there is no sting source in the renderer yet."""
    root = Path(root or RENDERER)
    files = source_files(root)
    if not files:
        return None, []
    h = hashlib.sha256(json.dumps({'seconds': cfg['seconds'], 'compositions': cfg['compositions']}, sort_keys=True).encode())
    for f in files:
        h.update(f.relative_to(root).as_posix().encode() + b'\0' + f.read_bytes() + b'\0')
    return h.hexdigest(), [f.relative_to(REPO).as_posix() if f.is_relative_to(REPO) else str(f) for f in files]


def registered(cfg, root=None):
    """Whether each composition's id appears in the renderer's source."""
    root = Path(root or RENDERER)
    text = ''.join(p.read_text(encoding='utf-8', errors='ignore') for p in root.rglob('*.tsx')) if root.is_dir() else ''
    return {shape: f'"{name}"' in text or f"'{name}'" in text for shape, name in cfg['compositions'].items()}


def cached(shape, digest, preview=False, cache=None):
    return Path(cache or CACHE) / f'{"preview-" if preview else ""}{digest[:16]}-{shape}.mp4'


def finish(src, dst, shape, seconds):
    """Any clip into the sting's exact form: the shape's size (fitted on ink
    if it is not already), 30 fps, square pixels, yuv420p, exactly `seconds`
    long (the last frame held if the clip is short), with a silent 48 kHz
    stereo AAC track. The same path for a Remotion render and a test clip."""
    w, h = SHAPES[shape]
    frames = round(seconds * FPS)
    dst = Path(dst)
    dst.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst.with_name(dst.stem + '.part.mp4')
    vf = (f'fps={FPS},scale={w}:{h}:force_original_aspect_ratio=decrease:flags=lanczos,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:color={INK},'
          f'setsar=1,format=yuv420p,tpad=stop_mode=clone:stop_duration={seconds},trim=end_frame={frames},setpts=PTS-STARTPTS')
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(src),
                    '-f', 'lavfi', '-i', f'anullsrc=r={RATE}:cl=stereo',
                    '-filter_complex', f'[0:v]{vf}[v];[1:a]atrim=end_sample={round(seconds * RATE)},asetpts=PTS-STARTPTS[a]',
                    '-map', '[v]', '-map', '[a]', '-frames:v', str(frames),
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', str(FPS),
                    '-c:a', 'aac', '-b:a', '192k', '-ar', str(RATE), '-ac', '2', '-movflags', '+faststart', str(tmp)], check=True)
    info = describe(tmp)
    want = {'width': w, 'height': h, 'fps': '30/1', 'frames': frames, 'pix_fmt': 'yuv420p', 'sar': '1:1', 'sample_rate': RATE, 'channels': 2, 'audio': 'aac'}
    wrong = {k: (info.get(k), v) for k, v in want.items() if info.get(k) != v}
    if wrong:
        tmp.unlink(missing_ok=True)
        raise IntroError(f'the finished sting is not in the house form: {wrong}')
    os.replace(tmp, dst)
    return info


def describe(path):
    out = subprocess.run(['ffprobe', '-v', 'error', '-count_frames', '-show_entries',
                          'stream=codec_type,codec_name,width,height,r_frame_rate,nb_read_frames,pix_fmt,sample_aspect_ratio,sample_rate,channels:format=duration',
                          '-of', 'json', str(path)], capture_output=True, text=True, check=True)
    data = json.loads(out.stdout)
    v = next((s for s in data['streams'] if s['codec_type'] == 'video'), {})
    a = next((s for s in data['streams'] if s['codec_type'] == 'audio'), {})
    return {'width': v.get('width'), 'height': v.get('height'), 'fps': v.get('r_frame_rate'), 'frames': int(v.get('nb_read_frames') or 0),
            'pix_fmt': v.get('pix_fmt'), 'sar': v.get('sample_aspect_ratio') or '1:1', 'seconds': round(float(data['format']['duration']), 3),
            'audio': a.get('codec_name'), 'sample_rate': int(a.get('sample_rate') or 0), 'channels': a.get('channels')}


def browser(given=None):
    if given:
        return given
    if os.environ.get('REMOTION_BROWSER_EXECUTABLE'):
        return os.environ['REMOTION_BROWSER_EXECUTABLE']
    runtime = os.environ.get('MINDMAKE_RUNTIME_ROOT') or str(Path.home() / 'Documents' / 'MindmakeVideoStudio' / 'runtime')
    found = sorted(glob.glob(os.path.join(runtime, 'browser', 'remotion-*', 'headless-shell', 'chrome-headless-shell*')))
    if found:
        return found[-1]
    return CONTAINER_BROWSER if Path(CONTAINER_BROWSER).exists() else None


REMOTION = r"""
import { bundle } from '@remotion/bundler'
import { getCompositions, renderMedia } from '@remotion/renderer'
const job = JSON.parse(process.env.MINDMAKE_INTRO_JOB)
const opts = job.browser ? { browserExecutable: job.browser } : {}
const serveUrl = await bundle({ entryPoint: job.entry })
const all = await getCompositions(serveUrl, { inputProps: {}, ...opts })
const composition = all.find((c) => c.id === job.id)
if (!composition) {
  console.error(`not registered: ${job.id}; the renderer has ${all.map((c) => c.id).join(', ')}`)
  process.exit(3)
}
await renderMedia({ composition, serveUrl, codec: 'h264', crf: 14, imageFormat: 'png', pixelFormat: 'yuv420p', muted: true,
  outputLocation: job.out, inputProps: {}, logLevel: 'error', ...opts })
console.log(JSON.stringify({ id: composition.id, width: composition.width, height: composition.height, fps: composition.fps, frames: composition.durationInFrames }))
"""


def remotion(composition, out, entry=None, browser_path=None):
    """One Remotion composition to an mp4, through node from the repository
    root (where @remotion/bundler and @remotion/renderer are installed)."""
    if not shutil.which('node'):
        raise IntroError('node is not on the PATH, so the sting cannot be rendered here')
    job = {'entry': str(Path(entry or RENDERER / 'index.ts').resolve()), 'id': composition, 'out': str(out), 'browser': browser(browser_path)}
    p = subprocess.run(['node', '--input-type=module', '-e', REMOTION], cwd=REPO, capture_output=True, text=True,
                       env={**os.environ, 'MINDMAKE_INTRO_JOB': json.dumps(job)})
    if p.returncode:
        said = (p.stderr or '') + (p.stdout or '')
        missing = re.search(r'not registered: .*', said)
        if missing:
            raise IntroError(f'the composition {composition} is {missing.group(0)}')
        raise IntroError(f'Remotion could not render {composition}: {said.strip()[-600:]}')
    return json.loads(p.stdout.strip().splitlines()[-1])


def render(shape, cfg=None, preview=False, browser_path=None, entry=None, force=False, cache=None, root=None):
    """The finished sting for one shape. Without `preview` it renders only an
    approved sting whose source is the one Krish approved."""
    cfg = cfg or load()
    root = root or (Path(entry).resolve().parent if entry else None)
    if not preview and cfg['status'] != 'approved':
        raise IntroError('the sting is still a candidate: render --preview, show Krish, and record his words with approve')
    digest, _ = source_hash(cfg, root)
    if not digest:
        raise IntroError('there is no sting source in the renderer yet (no file under apps/renderer/src has "sting" in its path)')
    if not preview:
        if cfg.get('source_sha256') and cfg['source_sha256'] != digest:
            raise IntroError('the sting\'s source has changed since Krish approved it: render --preview and ask him again')
    out = cached(shape, digest, preview, cache)
    if out.exists() and not force:
        return out
    seen = cached(shape, digest, True, cache)
    if not preview and seen.exists() and not force:
        # The approved render is the preview Krish saw: same source, same file.
        shutil.copyfile(seen, out)
        return out
    raw = out.with_name(f'raw-{out.name}')
    raw.parent.mkdir(parents=True, exist_ok=True)
    made = remotion(cfg['compositions'][shape], raw, entry, browser_path)
    want = SHAPES[shape]
    if (made['width'], made['height']) != want:
        raw.unlink(missing_ok=True)
        raise IntroError(f'{made["id"]} is {made["width"]}x{made["height"]}, the {shape} sting is {want[0]}x{want[1]}')
    finish(raw, out, shape, cfg['seconds'])
    raw.unlink(missing_ok=True)
    return out


def sting_for(shape, config=None, cache=None, root=None, render_missing=True):
    """What make.py asks: the approved sting for this shape, or None and why.
    It never raises: a render goes on without an intro rather than stop."""
    try:
        cfg = load(config)
        if cfg['status'] != 'approved':
            return None, 'the intro sting is still a candidate waiting for Krish\'s approval (config/intro-sting.json), so this cut has no intro'
        digest, _ = source_hash(cfg, root)
        if not digest:
            return None, 'the intro sting is approved but its source is not in apps/renderer, so this cut has no intro'
        if cfg.get('source_sha256') and cfg['source_sha256'] != digest:
            return None, 'the intro sting\'s source changed after Krish approved it, so this cut has no intro: preview it and ask him again'
        out = cached(shape, digest, False, cache)
        if out.exists():
            return out, None
        if not render_missing:
            return None, 'the approved intro sting is not rendered on this machine yet: run python scripts/quick-edit/intro.py render'
        return render(shape, cfg, cache=cache, root=root), None
    except (IntroError, OSError, ValueError, subprocess.CalledProcessError) as e:
        return None, f'the intro sting could not be used, so this cut has no intro: {e}'


def status(config=None):
    cfg = load(config)
    digest, files = source_hash(cfg)
    return {'status': cfg['status'], 'seconds': cfg['seconds'], 'compositions': cfg['compositions'], 'registered': registered(cfg),
            'source_sha256': digest, 'approved_source_sha256': cfg.get('source_sha256'), 'source_files': files,
            'approved_by': cfg.get('approved_by'), 'approved_on': cfg.get('approved_on'),
            'renders': {shape: {'approved': str(cached(shape, digest)) if digest and cached(shape, digest).exists() else None,
                                'preview': str(cached(shape, digest, True)) if digest and cached(shape, digest, True).exists() else None}
                        for shape in SHAPES}}


def self_test():
    """A synthetic ffmpeg colour clip through the same finishing path, and
    the approval gate, all under .cache."""
    checks = []
    work = REPO / '.cache' / 'quick-edit' / 'self-test' / 'intro'
    shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)
    cfg = load()
    checks.append(('the committed config waits for Krish', (cfg['status'], cfg['approved_by']), ('candidate', None)))
    checks.append(('the committed sting is 1 to 2 seconds', SECONDS[0] <= cfg['seconds'] <= SECONDS[1], True))
    # A lilac clip with a moving block, 25 fps and the wrong size: the
    # finishing path must make it the house form for both shapes.
    src = work / 'synthetic.mp4'
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0xB7A6FF:s=720x1280:r=25:d=1.2',
                    '-vf', "drawbox=x='t*300':y=600:w=120:h=120:color=0x0C1512:t=fill", '-c:v', 'libx264', '-pix_fmt', 'yuv420p', str(src)], check=True)
    for shape in SHAPES:
        out = work / f'sting-{shape}.mp4'
        info = finish(src, out, shape, 1.5)
        checks.append((f'{shape}: the house form', (info['width'], info['height'], info['fps'], info['frames'], info['pix_fmt'], info['sar']),
                       (*SHAPES[shape], '30/1', 45, 'yuv420p', '1:1')))
        checks.append((f'{shape}: a silent 48 kHz stereo AAC track', (info['audio'], info['sample_rate'], info['channels']), ('aac', RATE, 2)))
        level = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', str(out), '-af', 'volumedetect', '-f', 'null', '-'],
                               capture_output=True, text=True).stderr
        checks.append((f'{shape}: the track is silent', '-91.0 dB' in level or 'max_volume: -inf' in level, True))
    # The gate.
    root = work / 'renderer'
    (root / 'sting').mkdir(parents=True)
    (root / 'sting' / 'Sting.tsx').write_text('export const Sting = () => null\n')
    cache = work / 'cache'
    candidate = work / 'candidate.json'
    candidate.write_text(json.dumps(cfg))
    try:
        render('9x16', cfg, root=root, cache=cache)
        checks.append(('a candidate is refused without --preview', 'rendered', 'refused'))
    except IntroError:
        checks.append(('a candidate is refused without --preview', 'refused', 'refused'))
    got, why = sting_for('9x16', candidate, cache, root)
    checks.append(('make.py gets no sting while it is a candidate', (got, 'candidate' in (why or '')), (None, True)))
    digest, files = source_hash(cfg, root)
    approved = dict(cfg, status='approved', approved_by='Krish', approved_on='2026-10-12', approval_words='synthetic self-test, not a real approval',
                    source_sha256=digest)
    good = work / 'approved.json'
    good.write_text(json.dumps(approved))
    cache.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(work / 'sting-9x16.mp4', cached('9x16', digest, False, cache))
    got, why = sting_for('9x16', good, cache, root)
    checks.append(('an approved, rendered sting is used', got, cached('9x16', digest, False, cache)))
    (root / 'sting' / 'Sting.tsx').write_text('export const Sting = () => "changed"\n')
    got, why = sting_for('9x16', good, cache, root)
    checks.append(('a sting changed after approval is not used', (got, 'changed' in (why or '')), (None, True)))
    checks.append(('the hash follows the source', source_hash(cfg, root)[0] != digest, True))
    bad = work / 'bad.json'
    bad.write_text(json.dumps(dict(cfg, seconds=2.5)))
    try:
        load(bad)
        checks.append(('a 2.5 second sting is refused', 'accepted', 'refused'))
    except IntroError:
        checks.append(('a 2.5 second sting is refused', 'refused', 'refused'))
    failed = [f'{label}: got {got!r}, want {want!r}' for label, got, want in checks if got != want]
    print('\n'.join(failed) if failed else f'intro self-test passed: {len(checks)} checks')
    return 1 if failed else 0


def main():
    if sys.argv[1:2] == ['--self-test']:
        sys.exit(self_test())
    ap = argparse.ArgumentParser(description='The makeyourmindup intro sting, rendered per shape.')
    ap.add_argument('--config', help='default: config/intro-sting.json')
    sub = ap.add_subparsers(dest='cmd', required=True)
    p = sub.add_parser('status', help='the approval, the source hash and what is rendered')
    p.add_argument('--json', action='store_true')
    p = sub.add_parser('render', help='render the sting for each shape')
    p.add_argument('--preview', action='store_true', help='render a candidate to show Krish')
    p.add_argument('--shape', choices=sorted(SHAPES))
    p.add_argument('--browser', help='the headless browser Remotion uses (default: REMOTION_BROWSER_EXECUTABLE, else the Studio\'s copy)')
    p.add_argument('--entry', help='the Remotion entry point (default: apps/renderer/src/index.ts)')
    p.add_argument('--force', action='store_true', help='render again even if the file is there')
    p = sub.add_parser('approve', help='record Krish\'s approval of the previewed sting, in his words')
    p.add_argument('--words')
    p.add_argument('--by', default='Krish')
    p.add_argument('--on', default=date.today().isoformat())
    a = ap.parse_args()
    try:
        if a.cmd == 'status':
            s = status(a.config)
            if a.json:
                print(json.dumps(s, indent=1))
            else:
                print(f'intro sting: {s["status"]}, {s["seconds"]} s, compositions {s["compositions"]}')
                print(f'registered in the renderer: {s["registered"]}')
                print(f'source: {s["source_sha256"] or "none yet"} ({len(s["source_files"])} files)')
                if s['approved_source_sha256'] and s['approved_source_sha256'] != s['source_sha256']:
                    print('the source has changed since Krish approved it')
                for shape, r in s['renders'].items():
                    print(f'{shape}: approved render {r["approved"] or "none"}; preview {r["preview"] or "none"}')
        elif a.cmd == 'render':
            cfg = load(a.config)
            for shape in [a.shape] if a.shape else list(SHAPES):
                out = render(shape, cfg, a.preview, a.browser, a.entry, a.force)
                print(f'{shape}: {out}')
        elif a.cmd == 'approve':
            words = (a.words or '').strip()
            if not words:
                raise IntroError('--words is Krish\'s own words of approval, exactly as he said them')
            if not a.by.lower().startswith('krish'):
                raise IntroError('only Krish approves the intro sting')
            path = Path(a.config or CONFIG)
            cfg = load(path)
            digest, _ = source_hash(cfg)
            if not digest:
                raise IntroError('there is no sting source to approve')
            unseen = [shape for shape in SHAPES if not cached(shape, digest, True).exists()]
            if unseen:
                raise IntroError(f'no preview of this exact sting for {", ".join(unseen)}: render --preview and show Krish first')
            cfg.update(status='approved', approved_by=a.by, approved_on=a.on, approval_words=words, source_sha256=digest)
            path.write_text(json.dumps(cfg, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')
            print(f'intro sting approved by {a.by} on {a.on}, source {digest[:16]}')
    except IntroError as e:
        sys.exit(f'intro: {e}')


if __name__ == '__main__':
    main()
