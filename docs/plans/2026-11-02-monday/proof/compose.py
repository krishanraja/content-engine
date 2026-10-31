"""Monday 2 Nov proof: composes scene.html's two layers around his take, frame by frame, with push-ins on his face, and
mixes his voice over the licensed bed. Run from the repository root:
    python3 docs/plans/2026-11-02-monday/proof/compose.py
Writes .cache/proof/mon-proof-16x9.mp4. Uses the pinned ffmpeg in .cache/tools when present."""
import glob, math, os, subprocess, sys
from pathlib import Path
import numpy as np
from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
OUT = ROOT / '.cache/proof'; OUT.mkdir(parents=True, exist_ok=True)
TAKE = ROOT / '.cache/produce/2026-11-02-9a0c97af/takes/long-stable.mp4'
MUSIC = next((ROOT / '.cache/music').glob('*.mp3'))
FPS, DUR, OFF, TAKE_IN = 30, 36.8, 0.6, 2.4          # output t = take t + OFF; the take enters at output 3.0 s
FACE = (540, 760)                                      # his face in the 1080 x 1920 take
COLW = 608
tools = sorted(glob.glob(str(ROOT / '.cache/tools/ffmpeg-*/bin')))
FF = str(Path(tools[-1]) / 'ffmpeg') if tools else 'ffmpeg'

def ease(x): x = min(1, max(0, x)); return 1 - (1 - x) ** 3
def W(t, a, d): return ease((t - a) / d)

def layout(t):
    """(column centre x, push scale, visible) at output time t."""
    if t < 2.8 or 20.25 <= t < 29.8:
        return None
    if t < 12.6: cx = 960
    elif t < 29.8: cx = 960 + (304 - 960) * W(t, 12.6, 0.55)
    elif t < 31.9: cx = 960
    else: cx = 960 + (304 - 960) * W(t, 31.9, 0.5)
    s = 1.0 + 0.025 * math.sin(t * 0.6) + 0.02 * W(t, 3.0, 5)
    s += 0.25 * W(t, 8.1, 0.22) + 0.05 * W(t, 8.4, 1.4) - 0.27 * W(t, 10.0, 0.7)        # "fallen off a cliff"
    s += 0.10 * W(t, 14.55, 0.3) - 0.10 * W(t, 15.0, 0.5)                                # "2030"
    s += 0.08 * W(t, 15.2, 4.8) if 12.6 <= t < 20.3 else 0                               # slow push over the report
    s += 0.22 * W(t, 30.0, 0.22) - 0.14 * W(t, 31.0, 0.8) if t >= 29.8 else 0           # "But why"
    return cx, max(1.0, s), min(1, (t - 2.8) / 0.25)

def face_tile(frame, s):
    h, w = frame.shape[:2]
    cw, ch = w / s, h / s
    x0 = min(max(FACE[0] - cw / 2, 0), w - cw); y0 = min(max(FACE[1] - ch * 0.42, 0), h - ch)
    im = Image.fromarray(frame).crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch)))
    return im.resize((COLW, 1080), Image.LANCZOS)

def frames():
    cmd = [FF, '-v', 'error', '-ss', str(TAKE_IN), '-t', str(DUR), '-i', str(TAKE), '-vf', f'fps={FPS}',
           '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-']
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    n = 1080 * 1920 * 3
    while True:
        b = p.stdout.read(n)
        if len(b) < n: break
        yield np.frombuffer(b, np.uint8).reshape(1920, 1080, 3)

def main():
    exe = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))
    total = round(DUR * FPS)
    enc = subprocess.Popen([FF, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', '1920x1080', '-r', str(FPS),
                            '-i', '-', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
                            str(OUT / 'mon-proof-16x9.silent.mp4')], stdin=subprocess.PIPE)
    take = frames()
    cur = None
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe[0]) if exe else p.chromium.launch()
        bg = b.new_page(viewport={'width': 1920, 'height': 1080}); fg = b.new_page(viewport={'width': 1920, 'height': 1080})
        bg.goto((HERE / 'scene.html').as_uri() + '?layer=bg'); fg.goto((HERE / 'scene.html').as_uri() + '?layer=fg')
        for pg in (bg, fg): pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(600)
        for i in range(total):
            t = i / FPS
            take_t = t - OFF
            while take_t >= TAKE_IN and (cur is None or cur[0] < round((take_t - TAKE_IN) * FPS)):
                f = next(take, None)
                if f is None: break
                cur = (0 if cur is None else cur[0] + 1, f)
            bg.evaluate(f'render({t})'); fg.evaluate(f'render({t})')
            base = Image.open(__import__('io').BytesIO(bg.screenshot(type='png'))).convert('RGB')
            lay = layout(t)
            if lay and cur is not None:
                cx, s, a = lay
                tile = face_tile(cur[1], s)
                if a < 1: tile = Image.blend(base.crop((round(cx - COLW / 2), 0, round(cx + COLW / 2), 1080)), tile, a)
                base.paste(tile, (round(cx - COLW / 2), 0))
            top = Image.open(__import__('io').BytesIO(fg.screenshot(type='png', omit_background=True))).convert('RGBA')
            base = Image.alpha_composite(base.convert('RGBA'), top).convert('RGB')
            enc.stdin.write(base.tobytes())
            if i % 150 == 0: print(f'{i}/{total}', flush=True)
        b.close()
    enc.stdin.close(); enc.wait()
    # his voice from take 2.4 s at output 3.0 s; the bed fuller under the opener, ducked under his voice
    subprocess.run([FF, '-v', 'error', '-y', '-i', str(OUT / 'mon-proof-16x9.silent.mp4'),
                    '-ss', str(TAKE_IN), '-t', str(DUR - 3.0 + 0.2), '-i', str(TAKE), '-stream_loop', '-1', '-i', str(MUSIC),
                    '-filter_complex',
                    '[1:a]aresample=48000,adelay=3000|3000,apad,atrim=0:%s,asplit[v][key];'
                    '[2:a]aresample=48000,atrim=0:%s,volume=0.55,afade=t=out:st=%s:d=0.8[m];'
                    '[m][key]sidechaincompress=threshold=0.03:ratio=9:attack=20:release=400[md];'
                    '[v][md]amix=inputs=2:normalize=0,loudnorm=I=-14:TP=-1.5:LRA=11[a]' % (DUR, DUR, DUR - 0.8),
                    '-map', '0:v', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-shortest',
                    str(OUT / 'mon-proof-16x9.mp4')], check=True)
    print('wrote', OUT / 'mon-proof-16x9.mp4')

if __name__ == '__main__':
    main()
