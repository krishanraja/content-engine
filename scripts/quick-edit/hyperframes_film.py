#!/usr/bin/env python3
"""hyperframes_film: HyperFrames as kit's opt-in film backend for its HTML pages (the house end card).

kit.py films a moving page by stepping every CSS animation to each frame in Playwright and screenshotting it
(Drawer.film). HyperFrames (github.com/heygen-com/hyperframes, Apache-2.0) is a maintained renderer that does the
same job with a frame clock it owns: every frame is seeked, never played, so two renders are byte-identical, and it
can also seek what kit's stepper cannot (GSAP, Lottie, three.js, <video>) and write transparent ProRes 4444.

This backend keeps everything kit decides and swaps only the frame capture:

  1. Playwright loads the page and runs kit's own CHECK_JS, which fits [data-fit] text and lists layout problems,
     exactly as Drawer.film does;
  2. the settled page is wrapped as a HyperFrames composition (wrap) on the page's own background, and the pinned
     CLI renders it to a PNG sequence;
  3. kit.encode_frames encodes it, the one encoder setting both backends share.

It is chosen with MYMU_FILM=hyperframes and is off by default; no cut changes until Krish says otherwise.
Telemetry is always off (HYPERFRAMES_NO_TELEMETRY=1, DO_NOT_TRACK=1): the CLI sends usage events by default.

    npm ci --prefix vendor/hyperframes          # once per machine, the pinned CLI (78 packages, about 120 MB)
    python scripts/quick-edit/hyperframes_film.py check [--out DIR]

`check` films the house end card (both shapes) with both backends and twice with HyperFrames, and fails unless the
two HyperFrames renders are byte-identical frame for frame and each matches Playwright's film at SSIM >= 0.995 with
the same streams. Operating notes, costs and limits: docs/production/HYPERFRAMES.md.
"""
import glob
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
PIN = REPO / 'vendor' / 'hyperframes'
VERSION = '0.9.54'  # vendor/hyperframes/package.json pins the same; the test holds them together
INSTALL = 'npm ci --prefix vendor/hyperframes'
NO_TELEMETRY = {'HYPERFRAMES_NO_TELEMETRY': '1', 'DO_NOT_TRACK': '1'}
HEADLESS_SHELLS = '/opt/pw-browsers/chromium_headless_shell-*/chrome-headless-shell-*/chrome-headless-shell'
SSIM_FLOOR = 0.995
ROOT_ID = 'kit-page'


def bin_path():
    """The pinned CLI, or None when `npm ci --prefix vendor/hyperframes` has not run on this machine."""
    name = 'hyperframes.cmd' if os.name == 'nt' else 'hyperframes'
    path = PIN / 'node_modules' / '.bin' / name
    return path if path.exists() else None


def browser_path(environ=None):
    """The Chrome HyperFrames drives: HYPERFRAMES_BROWSER_PATH, else the newest headless shell in the cloud
    container (the CLI's own kind of browser), else MYMU_BROWSER when it names a file (kit's browser). None when
    there is none: render() then stops, so the CLI never downloads a browser behind kit's back."""
    env = os.environ if environ is None else environ
    want = (env.get('HYPERFRAMES_BROWSER_PATH') or '').strip()
    if want and Path(want).is_file():
        return want
    shells = sorted(glob.glob(HEADLESS_SHELLS))
    if shells:
        return shells[-1]
    want = (env.get('MYMU_BROWSER') or '').strip()
    return want if want and Path(want).is_file() else None


# What the CLI is given of the session's environment, and nothing else: no engine secret reaches a third-party tool.
PASS_ENV = ('PATH', 'PATHEXT', 'HOME', 'USERPROFILE', 'HOMEDRIVE', 'HOMEPATH', 'TEMP', 'TMP', 'TMPDIR', 'SYSTEMROOT',
            'WINDIR', 'COMSPEC', 'APPDATA', 'LOCALAPPDATA', 'LANG', 'LC_ALL', 'TZ', 'XDG_CACHE_HOME', 'XDG_CONFIG_HOME',
            'FONTCONFIG_PATH', 'FONTCONFIG_FILE', 'HYPERFRAMES_FFMPEG_PATH', 'HYPERFRAMES_FFPROBE_PATH',
            'HYPERFRAMES_CACHE_DIR', 'HYPERFRAMES_CONFIG_DIR', 'HYPERFRAMES_FONT_CACHE_DIR')


def hf_env(environ=None):
    """The CLI's environment: only PASS_ENV from the caller's, telemetry forced off whatever the caller set, and the
    browser pinned when one is known."""
    src = os.environ if environ is None else environ
    env = {k: src[k] for k in PASS_ENV if k in src}
    env.update(NO_TELEMETRY)
    found = browser_path(src)
    if found:
        env['HYPERFRAMES_BROWSER_PATH'] = found
    return env


def _kill_tree(proc):
    """Stop the CLI and every Chrome it started, not just the direct child (cmd.exe on Windows, node elsewhere)."""
    if os.name == 'nt':
        subprocess.run(['taskkill', '/T', '/F', '/PID', str(proc.pid)], capture_output=True)
    else:
        try:
            os.killpg(proc.pid, 9)
        except (ProcessLookupError, PermissionError):
            proc.kill()
    proc.communicate()


def wrap(doc, size, seconds, background='transparent'):
    """A settled kit page as a HyperFrames composition: everything inside <body> goes into one root that carries
    the composition's id, length and size, painted with the page's own background (HyperFrames paints the frame
    black under a root without one: the first spike lost the ink, #0C1512, that way)."""
    w, h = size
    start = doc.find('<body')
    end = doc.rfind('</body>')
    if start < 0 or end < 0:
        raise ValueError('the page has no <body> to wrap')
    inside = doc.index('>', start) + 1
    root = (f'<div id="{ROOT_ID}" data-composition-id="{ROOT_ID}" data-start="0" data-duration="{seconds:g}" '
            f'data-width="{w}" data-height="{h}" '
            f'style="position:absolute;left:0;top:0;width:{w}px;height:{h}px;background:{background}">')
    return doc[:inside] + root + doc[inside:end] + '</div>' + doc[end:]


def frame_pattern(folder):
    """The rendered PNG sequence as (ffmpeg pattern, first number, count), refusing gaps."""
    pngs = sorted(Path(folder).rglob('*.png'))
    if not pngs:
        raise ValueError(f'HyperFrames wrote no frames under {folder}')
    parsed = [re.fullmatch(r'(.*?)(\d+)\.png', p.name) for p in pngs]
    if not all(parsed) or len({p.parent for p in pngs}) != 1:
        raise ValueError(f'unexpected frame files under {folder}: {pngs[0].name} ...')
    prefix, digits = parsed[0].group(1), parsed[0].group(2)
    numbers = [int(m.group(2)) for m in parsed]
    if numbers != list(range(numbers[0], numbers[0] + len(numbers))):
        raise ValueError(f'the frames under {folder} have gaps')
    return pngs[0].parent / f'{prefix}%0{len(digits)}d.png', numbers[0], len(numbers)


def render(project, out_dir, fps=30, timeout=600, binary=None, environ=None):
    """Render one composition folder to a PNG sequence with the pinned CLI. Raises RuntimeError on any failure."""
    binary = binary or bin_path()
    if not binary:
        raise RuntimeError(f'the pinned HyperFrames CLI is not installed: run `{INSTALL}` first')
    env = hf_env(environ)
    if 'HYPERFRAMES_BROWSER_PATH' not in env:
        raise RuntimeError('no Chrome for HyperFrames: set HYPERFRAMES_BROWSER_PATH to a Chrome or Chrome Headless Shell '
                           'binary (the adapter never lets the CLI download one)')
    # `render` only: the CLI's publish, share and cloud verbs upload to HeyGen and are never called from here.
    cmd = [str(binary), 'render', str(project), '--format', 'png-sequence', '-o', str(out_dir), '--fps', str(fps), '--quiet']
    group = {'creationflags': subprocess.CREATE_NEW_PROCESS_GROUP} if os.name == 'nt' else {'start_new_session': True}
    proc = subprocess.Popen(cmd, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, **group)
    try:
        out, err = proc.communicate(timeout=timeout)
    except subprocess.TimeoutExpired:
        _kill_tree(proc)
        raise RuntimeError(f'HyperFrames render took longer than {timeout} s and was stopped') from None
    if proc.returncode:
        tail = '\n'.join((err or out or '').strip().splitlines()[-8:])
        raise RuntimeError(f'HyperFrames render failed (exit {proc.returncode}): {tail}')
    return frame_pattern(out_dir)


class HyperFramesDrawer:
    """kit's Drawer with HyperFrames filming the moving pages. Stills, layout checks and the browser stay kit's own;
    kit passes itself in (kit.default_drawer), so this module never imports a second copy of kit."""

    film_tag = ':hyperframes'

    def __init__(self, kit):
        self.kit = kit
        self._base = kit.Drawer()

    def page(self):
        return self._base.page()

    def shoot(self, doc, size, path, clear=False):
        return self._base.shoot(doc, size, path, clear)

    def close(self):
        self._base.close()

    def film(self, doc, size, mp4, seconds=None, fps=30):
        kit = self.kit
        seconds = kit.ENDCARD_SECONDS if seconds is None else seconds
        pg = self.page()
        pg.set_viewport_size({'width': size[0], 'height': size[1]})
        pg.set_content(doc, wait_until='load')
        pg.evaluate('document.fonts.ready.then(() => true)')
        bad = pg.evaluate(kit.CHECK_JS)  # fits [data-fit] text in place, as Drawer.film does, and lists problems
        settled = pg.evaluate('"<!doctype html>" + document.documentElement.outerHTML')
        background = pg.evaluate('getComputedStyle(document.body).backgroundColor')
        with tempfile.TemporaryDirectory() as tmp:
            project, frames = Path(tmp) / 'page', Path(tmp) / 'frames'
            project.mkdir()
            (project / 'index.html').write_text(wrap(settled, size, seconds, background), encoding='utf-8')
            try:
                pattern, first, count = render(project, frames, fps)
            except (RuntimeError, ValueError, OSError) as e:  # OSError: a shim that cannot start (WinError 193, a lost +x)
                raise kit.KitError(f'{Path(mp4).name}: {e}') from e
            want = round(seconds * fps)
            if count != want:
                raise kit.KitError(f'{Path(mp4).name}: HyperFrames rendered {count} frames, {want} wanted')
            kit.encode_frames(pattern, seconds, mp4, fps, start_number=first)
        return bad


# ---------------------------------------------------------------- the parity check


def _ssim(a, b):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', str(a), '-i', str(b), '-lavfi', '[0:v][1:v]ssim', '-f', 'null', '-'],
                       capture_output=True, text=True)
    m = re.search(r'All:([0-9.]+)', r.stderr)
    return float(m.group(1)) if m else None


def _streams(path):
    r = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'stream=codec_type,codec_name,profile,pix_fmt,width,height,'
                        'r_frame_rate,sample_rate,channels', '-of', 'json', str(path)], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)['streams']


def _frame_hashes(mp4):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(mp4), '-map', '0:v', '-f', 'framemd5', '-'], capture_output=True, text=True, check=True)
    return [ln.rsplit(',', 1)[-1].strip() for ln in r.stdout.splitlines() if ln and not ln.startswith('#')]


def check(out_dir, subchannel='follow_the_money', date='2026-11-16'):
    """Film the house end card, both shapes, with Playwright and twice with HyperFrames; report and judge parity."""
    sys.path.insert(0, str(HERE))
    import kit  # noqa: PLC0415  run as a command, kit is an ordinary import here
    import brand  # noqa: PLC0415
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    st = kit.style_for(subchannel, date)
    fonts, masthead = brand.font_css(), brand.brand_uri('masthead', full=True)
    hf = HyperFramesDrawer(kit)
    pw = hf._base  # one browser for both backends
    report = {'hyperframes': VERSION, 'browser': browser_path(), 'subchannel': subchannel, 'date': date, 'shapes': {}}
    ok = True
    try:
        for shape in ('16x9', '9x16'):
            size, seconds = kit.FRAME[shape], kit.ENDCARD_SECONDS_BY_SHAPE[shape]
            doc = kit.page_endcard(st, shape, masthead, fonts)
            row = report['shapes'][shape] = {'seconds': seconds}
            t = time.time()
            pw.film(doc, size, out / f'playwright-{shape}.mp4', seconds)
            row['playwright_s'] = round(time.time() - t, 1)
            hashes = []
            for n in (1, 2):
                t = time.time()
                row['problems'] = hf.film(doc, size, out / f'hyperframes-{shape}-{n}.mp4', seconds)
                row[f'hyperframes_{n}_s'] = round(time.time() - t, 1)
                hashes.append(_frame_hashes(out / f'hyperframes-{shape}-{n}.mp4'))
            row['frames'] = len(hashes[0])
            row['identical_frames'] = sum(a == b for a, b in zip(*hashes))
            row['ssim'] = _ssim(out / f'playwright-{shape}.mp4', out / f'hyperframes-{shape}-1.mp4')
            row['same_streams'] = _streams(out / f'playwright-{shape}.mp4') == _streams(out / f'hyperframes-{shape}-1.mp4')
            row['pass'] = (row['frames'] == round(seconds * 30) and row['identical_frames'] == row['frames']
                           and (row['ssim'] or 0) >= SSIM_FLOOR and row['same_streams'] and not row['problems'])
            ok = ok and row['pass']
    finally:
        hf.close()
    report['pass'] = ok
    (out / 'report.json').write_text(json.dumps(report, indent=1) + '\n', encoding='utf-8')
    return report


def main(argv=None):
    argv = sys.argv[1:] if argv is None else argv
    if not argv or argv[0] != 'check':
        print(__doc__)
        return 2
    out = argv[argv.index('--out') + 1] if '--out' in argv else str(REPO / '.cache' / 'hyperframes-check')
    if not bin_path():
        print(f'the pinned HyperFrames CLI is not installed: run `{INSTALL}` first', file=sys.stderr)
        return 2
    if not shutil.which('ffmpeg'):
        print('ffmpeg is not on the PATH', file=sys.stderr)
        return 2
    report = check(out)
    for shape, row in report['shapes'].items():
        print(f"{shape}: {'PASS' if row['pass'] else 'FAIL'}  ssim {row['ssim']}  identical {row['identical_frames']}/{row['frames']}"
              f"  same streams {row['same_streams']}  playwright {row['playwright_s']} s  hyperframes {row['hyperframes_1_s']} s"
              + (f"  problems {row['problems']}" if row['problems'] else ''))
    print(f"report: {Path(out) / 'report.json'}")
    return 0 if report['pass'] else 1


if __name__ == '__main__':
    sys.exit(main())
