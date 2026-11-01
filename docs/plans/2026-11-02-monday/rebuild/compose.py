"""Composes a whole cut, as the proof did: scene.html's layers around his take, frame by frame, with push-ins on his
face, then his voice over the licensed bed at -14 LUFS. Run from the repository root:
    python3 docs/plans/2026-11-02-monday/rebuild/compose.py long|short [--workers 4] [--stills OUT.jpg T T ...] [--audio-only]
Writes .cache/proof/mon/mon-long-16x9.mp4 or mon-short-9x16.mp4. Uses the pinned ffmpeg in .cache/tools."""
import glob, io, json, math, os, re, subprocess, sys
from multiprocessing import Process
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
OUT = ROOT / '.cache/proof/mon'; OUT.mkdir(parents=True, exist_ok=True)
TAKES = ROOT / '.cache/produce/2026-11-02-9a0c97af/takes'
MUSIC = next((ROOT / '.cache/music').glob('*.mp3'))
FPS = 30
tools = sorted(glob.glob(str(ROOT / '.cache/tools/ffmpeg-*/bin')))
FF = str(Path(tools[-1]) / 'ffmpeg') if tools else 'ffmpeg'
def ease(x): x = min(1, max(0, x)); return 1 - (1 - x) ** 3
def W(t, a, d): return ease((t - a) / d)

class Cut:
    def __init__(self, name):
        self.P = json.load(open(HERE / f'plan_{name}.json')); self.name = name; self.V = name == 'short'
        self.take = TAKES / f'{name}-stable.mp4'; self.W, self.H = (1080, 1920) if self.V else (1920, 1080)
        self.out = OUT / (f'mon-short-9x16' if self.V else 'mon-long-16x9')
        self.face = (520, 800) if self.V else (540, 760)
    def target(self, g):
        return {'brand': 960, 'side': 304}.get(g['mode'])
    def layout(self, t):
        """(column centre x, push scale) or None when no face shows. Phone: (None, scale)."""
        P = self.P
        if t < 2.8 or t >= P['closeAt'] + 0.1: return None
        segs = P['segs']; cur = None
        for i, g in enumerate(segs):
            if g['a'] <= t < g['b']: cur = i
        if cur is None and t < 3.0: cur = 0
        if cur is None: return None
        g = segs[cur]
        if g['mode'] == 'full' and g['a'] + 0.45 <= t < g['b'] - 0.35: return None
        s = 1.0 + 0.022 * math.sin(t * 0.6) + 0.035 * W(t, g['a'], max(1, g['b'] - g['a']))
        for (p, k) in P['push']:
            if p - 0.05 <= t < p + 3.6:
                s += k * W(t, p, 0.22) + 0.22 * k * W(t, p + 0.22, 1.5) - 1.22 * k * W(t, p + 2.3, 0.9)
        if self.V: return None, max(1.0, s)
        # the column slides between brand (centre) and side (left); behind a full-frame picture it waits where it goes next
        tgt = self.target(g)
        if tgt is None:
            nxt = next((self.target(x) for x in segs[cur + 1:] if self.target(x)), 960)
            prv = next((self.target(x) for x in reversed(segs[:cur]) if self.target(x)), 960)
            cx = prv if t < g['a'] + 0.45 else nxt
        else:
            prv = next((self.target(x) for x in reversed(segs[:cur]) if self.target(x) and x['mode'] != 'full'), tgt)
            prev_full = cur > 0 and segs[cur - 1]['mode'] == 'full'
            cx = tgt if prev_full else prv + (tgt - prv) * W(t, g['a'], 0.55)
        if t < 3.05: s = 1.0
        return cx, max(1.0, s)
    def face_img(self, frame, s):
        h, w = frame.shape[:2]
        if self.V:   # full frame, pushed in about his face so it stays where it is
            fx, fy = self.face; cw, ch = w / s, h / s
            x0 = min(max(fx - fx / s, 0), w - cw); y0 = min(max(fy - fy / s, 0), h - ch)
            return Image.fromarray(frame).crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch))).resize((1080, 1920), Image.LANCZOS)
        cw, ch = w / s, h / s
        x0 = min(max(self.face[0] - cw / 2, 0), w - cw); y0 = min(max(self.face[1] - ch * 0.42, 0), h - ch)
        return Image.fromarray(frame).crop((round(x0), round(y0), round(x0 + cw), round(y0 + ch))).resize((608, 1080), Image.LANCZOS)

def take_reader(cut, t0):
    """frames of his take at 30 fps for output times t0, t0 + 1/30, ..."""
    off, tin = cut.P['off'], cut.P['take_in']
    start = max(tin, t0 - off)
    p = subprocess.Popen([FF, '-v', 'error', '-ss', f'{start:.4f}', '-i', str(cut.take), '-vf', f'fps={FPS}', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'],
                         stdout=subprocess.PIPE)
    n = 1080 * 1920 * 3; idx = 0
    def get(t):
        nonlocal idx
        want = round((t - off - start) * FPS)
        if want < 0: return None
        f = getattr(get, 'last', None)
        while idx <= want:
            b = p.stdout.read(n)
            if len(b) < n: return f
            f = np.frombuffer(b, np.uint8).reshape(1920, 1080, 3); idx += 1; get.last = f
        return f
    return get

def pages(cut, pw):
    exe = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))
    b = pw.chromium.launch(executable_path=exe[0]) if exe else pw.chromium.launch()
    vp = {'width': cut.W, 'height': cut.H}
    bg = b.new_page(viewport=vp); fg = b.new_page(viewport=vp)
    for pg, lay in ((bg, 'bg'), (fg, 'fg')):
        pg.goto((HERE / 'scene.html').as_uri() + f'?cut={cut.name}&layer={lay}'); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(900)
    return b, bg, fg

def frame(cut, bg, fg, t, get):
    fg.evaluate(f'render({t})')
    lay = cut.layout(t)
    if cut.V:
        f = get(t) if lay else None
        base = cut.face_img(f, lay[1]) if f is not None else Image.new('RGB', (1080, 1920), (12, 21, 18))
    else:
        bg.evaluate(f'render({t})')
        base = Image.open(io.BytesIO(bg.screenshot(type='jpeg', quality=95))).convert('RGB')
        f = get(t) if lay else None
        if lay and f is not None:
            cx, s = lay; tile = cut.face_img(f, s); a = min(1, (t - 2.8) / 0.25)
            if a < 1: tile = Image.blend(base.crop((round(cx - 304), 0, round(cx + 304), 1080)), tile, a)
            base.paste(tile, (round(cx - 304), 0))
    top = Image.open(io.BytesIO(fg.screenshot(type='png', omit_background=True))).convert('RGBA')
    return Image.alpha_composite(base.convert('RGBA'), top).convert('RGB')

def worker(name, i0, i1, path):
    from playwright.sync_api import sync_playwright
    cut = Cut(name); get = take_reader(cut, i0 / FPS)
    enc = subprocess.Popen([FF, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{cut.W}x{cut.H}', '-r', str(FPS), '-i', '-',
                            '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', str(path)], stdin=subprocess.PIPE)
    with sync_playwright() as pw:
        b, bg, fg = pages(cut, pw)
        for i in range(i0, i1):
            enc.stdin.write(frame(cut, bg, fg, i / FPS, get).tobytes())
            if (i - i0) % 300 == 0: print(f'{path.name} {i - i0}/{i1 - i0}', flush=True)
        b.close()
    enc.stdin.close(); enc.wait()

def audio(cut, video):
    P = cut.P; dur = P['dur']; tin = P['take_in']; spoken = P['take_end'] - tin; lead = P['off'] + tin   # = 3.0
    v, m, mix = OUT / f'{cut.name}-v.wav', OUT / f'{cut.name}-m.wav', OUT / f'{cut.name}-mix.wav'
    # his voice: three seconds of silence, then the take, padded to the end (concat, never adelay+atrim)
    subprocess.run([FF, '-v', 'error', '-y', '-f', 'lavfi', '-t', f'{lead}', '-i', 'anullsrc=r=48000:cl=stereo', '-ss', f'{tin}', '-t', f'{spoken}', '-i', str(cut.take),
                    '-filter_complex', f'[1:a]aresample=48000,aformat=channel_layouts=stereo,afade=t=out:st={spoken - 0.25}:d=0.25[t];[0:a][t]concat=n=2:v=0:a=1,apad=whole_dur={dur}[o]',
                    '-map', '[o]', '-t', f'{dur}', str(v)], check=True)
    subprocess.run([FF, '-v', 'error', '-y', '-stream_loop', '-1', '-i', str(MUSIC), '-af', f'aresample=48000,aformat=channel_layouts=stereo,atrim=0:{dur},volume=0.55,afade=t=out:st={dur - 1.2}:d=1.2',
                    '-t', f'{dur}', str(m)], check=True)
    subprocess.run([FF, '-v', 'error', '-y', '-i', str(v), '-i', str(m), '-filter_complex',
                    '[0:a]asplit[a][k];[1:a][k]sidechaincompress=threshold=0.03:ratio=9:attack=20:release=400[md];[a][md]amix=inputs=2:normalize=0,atrim=0:%s[o]' % dur,
                    '-map', '[o]', str(mix)], check=True)
    meas = subprocess.run([FF, '-hide_banner', '-i', str(mix), '-af', 'loudnorm=I=-14:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    j = json.loads(re.findall(r'\{[^{}]*\}', meas)[-1])
    ln = (f"loudnorm=I=-14:TP=-2:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
          f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,alimiter=limit=0.75:level=false")
    final = cut.out.with_suffix('.mp4')
    subprocess.run([FF, '-v', 'error', '-y', '-i', str(video), '-i', str(mix), '-af', ln, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-t', f'{dur}', '-movflags', '+faststart', str(final)], check=True)
    return final

def stills(name, out, ts):
    from playwright.sync_api import sync_playwright
    cut = Cut(name); tiles = []
    with sync_playwright() as pw:
        b, bg, fg = pages(cut, pw)
        for t in ts:
            get = take_reader(cut, t)
            tiles.append(frame(cut, bg, fg, t, get).resize((640, 360) if not cut.V else (360, 640)))
        b.close()
    tw, th = tiles[0].size; cols = 3 if not cut.V else 6
    sheet = Image.new('RGB', (tw * cols, th * ((len(tiles) + cols - 1) // cols)), 'white')
    for i, im in enumerate(tiles): sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
    sheet.save(out, quality=85)

if __name__ == '__main__':
    a = sys.argv[1:]; name = a[0]
    if '--stills' in a:
        k = a.index('--stills'); stills(name, a[k + 1], [float(x) for x in a[k + 2:]]); sys.exit()
    cut = Cut(name); total = round(cut.P['dur'] * FPS)
    silent = cut.out.with_suffix('.silent.mp4')
    if '--audio-only' not in a:
        n = int(a[a.index('--workers') + 1]) if '--workers' in a else 4
        bounds = [round(total * k / n) for k in range(n + 1)]
        parts = [OUT / f'{name}-part{k}.mp4' for k in range(n)]
        ps = [Process(target=worker, args=(name, bounds[k], bounds[k + 1], parts[k])) for k in range(n)]
        for p in ps: p.start()
        for p in ps: p.join()
        lst = OUT / f'{name}-parts.txt'; lst.write_text(''.join(f"file '{p}'\n" for p in parts))
        subprocess.run([FF, '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(silent)], check=True)
    print('wrote', audio(cut, silent))
