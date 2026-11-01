"""Wednesday 4 Nov (Claude Duet) rebuild: composes scene.html's two layers around his take and the covered phone footage,
frame by frame, with push-ins on his face, then mixes his voice over the licensed bed (two-pass loudness). The approved
Monday proof's method (docs/plans/2026-11-02-monday/proof/compose.py), for a whole cut, rendered in parallel chunks.
Run from the repository root, after timeline.py:
    python3 docs/plans/2026-11-04-wednesday/rebuild/compose.py long|short [--stills T,T,...] [--jobs 3] [--from S --to E]
Writes .cache/proof/wed/wed-long-16x9.mp4 or wed-short-9x16.mp4 (or stills/ with --stills)."""
import argparse, glob, io, json, math, os, re, subprocess, sys
from multiprocessing import Process
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
OUT = ROOT / '.cache/proof/wed'
FPS = 30
tools = sorted(glob.glob(str(ROOT / '.cache/tools/ffmpeg-*/bin')))
FF = str(Path(tools[-1]) / 'ffmpeg') if tools else 'ffmpeg'
MUSIC = next((ROOT / '.cache/music').glob('*.mp3'))


def ease(x): x = min(1, max(0, x)); return 1 - (1 - x) ** 3
def W(t, a, d): return ease((t - a) / d)
def lerp(a, b, k): return a + (b - a) * k


class Cut:
    def __init__(self, name):
        self.tl = json.load(open(OUT / f'timeline-{name}.json'))
        tl = self.tl
        self.V = tl['fmt'] == '9x16'
        self.Wd, self.Ht = tl['W'], tl['H']
        self.S = tl['segs']
        self.total = int(round(tl['dur'] * FPS))
        tl['shakes'] = [1.2] + [s['ev']['yes'] for s in self.S if s['pic'] in ('queue', 'duet')]

    def seg_i(self, t):
        for i in range(len(self.S) - 1, -1, -1):
            if t >= self.S[i]['a']:
                return i
        return 0

    def follow(self, t, target, d=0.5):
        i = self.seg_i(t); cur = target(self.S[i]); prev = target(self.S[i - 1]) if i > 0 else cur
        return lerp(prev, cur, W(t, self.S[i]['a'], d))

    def nb(self, s):
        i = self.S.index(s)
        full = lambda k: 0 <= k < len(self.S) and self.S[k]['mode'] == 'full'
        return full(i - 1), full(i + 1)

    def panel_x(self, t, s):
        pf, nf = self.nb(s)
        inn = 1 if pf else W(t, s['a'], 0.42); out = W(t, s['b'] - 0.36, 0.36) if (t > s['b'] - 0.36 and not nf) else 0
        return (1 - inn) * self.Wd - out * self.Wd

    def covered(self, t, s):
        pf, nf = self.nb(s)
        return s['mode'] == 'full' and s['a'] + (0 if pf else 0.5) <= t < s['b'] - (0 if nf else 0.4)

    def push(self, t):
        s = 1.04 + 0.022 * math.sin(t * 0.6) + 0.07 * W(t, 0.0, 3.0) - 0.04 * W(t, 3.0, 1.2)   # the opening push
        for p, a in self.tl['pushes']:
            if t >= p - 0.05:
                s += a * W(t, p, 0.22) + 0.04 * W(t, p + 0.25, 1.4) - (a + 0.04) * W(t, p + 2.2, 0.9)
        return max(1.0, s)


class Reader:
    """Raw RGB frames from ffmpeg at 30 fps, read in order."""
    def __init__(self, path, start, w, h, speed=1.0):
        vf = f'setpts=(PTS-STARTPTS)/{speed:.4f},fps={FPS},tpad=stop_mode=clone:stop_duration=60' if speed != 1.0 else f'fps={FPS},tpad=stop_mode=clone:stop_duration=60'
        self.p = subprocess.Popen([FF, '-v', 'error', '-ss', f'{max(0, start):.3f}', '-i', str(ROOT / path), '-vf', vf, '-an',
                                   '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], stdout=subprocess.PIPE)
        self.w, self.h, self.n, self.cur = w, h, -1, None

    def get(self, k):
        while self.n < k:
            b = self.p.stdout.read(self.w * self.h * 3)
            if len(b) < self.w * self.h * 3:
                break
            self.cur = np.frombuffer(b, np.uint8).reshape(self.h, self.w, 3); self.n += 1
        return self.cur

    def close(self):
        self.p.kill()


def clip_speed(s, path):
    d = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(ROOT / path)],
                             capture_output=True, text=True).stdout)
    return min(3.0, max(0.6, d / max(0.5, s['b'] - s['a'])))


def render_range(name, i0, i1, out_path=None, stills=None):
    from playwright.sync_api import sync_playwright
    C = Cut(name); tl = C.tl; V = C.V; Wd, Ht = C.Wd, C.Ht
    exe = sorted(glob.glob('/opt/pw-browsers/chromium-*/chrome-linux*/chrome'))
    frames = [round(x * FPS) for x in stills] if stills else list(range(i0, i1))
    t_first = frames[0] / FPS
    LEAD = tl['lead']
    take_t0 = tl['take_in'] + max(0.0, t_first - LEAD)
    take = Reader(tl['take'], take_t0, 1080, 1920) if not stills else None
    clips = {}
    enc = None
    if out_path:
        enc = subprocess.Popen([FF, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{Wd}x{Ht}', '-r', str(FPS), '-i', '-',
                                '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '16', '-pix_fmt', 'yuv420p', '-g', '60', str(out_path)], stdin=subprocess.PIPE)
    FX, FY = tl['face']
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path=exe[0]) if exe else p.chromium.launch()
        pages = {}
        for layer in ('bg', 'fg'):
            pg = b.new_page(viewport={'width': Wd, 'height': Ht})
            pg.goto((HERE / 'scene.html').as_uri() + f'?layer={layer}')
            pg.evaluate('tl => init(tl)', tl); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(500)
            pg.evaluate('render(3.5)'); pg.wait_for_timeout(300)
            pages[layer] = pg
        for n, fi in enumerate(frames):
            t = fi / FPS
            i = C.seg_i(t); s = C.S[i]
            for pg in pages.values():
                pg.evaluate(f'render({t:.4f})')
            base = Image.open(io.BytesIO(pages['bg'].screenshot(type='jpeg', quality=94))).convert('RGB')
            # the take frame for this moment
            if stills:
                tt = min(tl['take_in'] + max(0.0, t - LEAD), float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(ROOT / tl['take'])], capture_output=True, text=True).stdout) - 0.2)
                fr = np.frombuffer(subprocess.run([FF, '-v', 'error', '-ss', f'{tt:.3f}', '-i', str(ROOT / tl['take']), '-frames:v', '1',
                                                   '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout, np.uint8).reshape(1920, 1080, 3)
            else:
                fr = take.get(int(round((max(t, LEAD) - LEAD - (take_t0 - tl['take_in'])) * FPS)))
            # the phone footage, playing (covers already burned in by the earlier production pass)
            clip_im = None
            if s.get('clip'):
                key = i
                if stills or key not in clips:
                    sp = clip_speed(s, s['clip'])
                    cw, ch = 1314, 1080
                    clips[key] = (Reader(s['clip'], (t - s['a']) * sp, cw, ch, sp), t, cw, ch)
                    for k in list(clips):
                        if k != key: clips[k][0].close(); del clips[k]
                rd, t0, cw, ch = clips[key]
                cf = rd.get(int(round((t - t0) * FPS)))
                if cf is not None:
                    sc = 1.0 + 0.06 * W(t, s['a'], max(1.0, s['b'] - s['a']))
                    src_im = Image.fromarray(cf)
                    if V:   # the whole phone, larger: the 16:9 plate's middle, filling the width
                        src_im = src_im.crop((60, 0, 1100, 1080)); sc *= 1080 / 1040
                    im = src_im.resize((round(src_im.width * sc), round(src_im.height * sc)), Image.BICUBIC)
                    dx = math.sin(t * 0.9) * 8; dy = math.cos(t * 0.7) * 6
                    if not V:
                        v = C.follow(t, lambda q: 1 if q.get('pic') == 'phone' else 0, 0.4)
                        x = 606 + (1 - v) * 1312 + 657 - im.width / 2 + dx; y = 540 - im.height / 2 + dy
                    else:
                        x = C.panel_x(t, s) + 540 - im.width / 2 + dx; y = 200 + 560 - im.height / 2 + dy
                    prev = C.S[i - 1] if i > 0 else None
                    a = W(t, s['a'], 0.25) if (prev and prev.get('clip')) else 1.0
                    if a < 1:
                        under = base.crop((round(x), round(y), round(x) + im.width, round(y) + im.height))
                        im = Image.blend(under, im, a)
                    base.paste(im, (round(x), round(y)))
            # his face
            sc = C.push(t)
            if not V:
                hidden = C.covered(t, s) or (s['mode'] == 'close' and t >= s['a'] + 0.55)
                if not hidden:
                    cx = C.follow(t, lambda q: 960 if q['mode'] in ('face', 'full', 'close') else 304, 0.55)
                    cwid, chei = 1080 / sc, 1920 / sc
                    x0 = min(max(FX - cwid / 2, 0), 1080 - cwid); y0 = min(max(FY - chei * 0.42, 0), 1920 - chei)
                    tile = Image.fromarray(fr).crop((round(x0), round(y0), round(x0 + cwid), round(y0 + chei))).resize((608, 1080), Image.LANCZOS)
                    al = 1
                    if al < 1:
                        tile = Image.blend(base.crop((round(cx - 304), 0, round(cx + 304), 1080)), tile, al)
                    base.paste(tile, (round(cx - 304), 0))
            else:
                if True:
                    cwid, chei = 1080 / sc, 1920 / sc
                    x0 = min(max(FX * (1 - 1 / sc), 0), 1080 - cwid); y0 = min(max(FY * (1 - 1 / sc), 0), 1920 - chei)
                    face = Image.fromarray(fr).crop((round(x0), round(y0), round(x0 + cwid), round(y0 + chei))).resize((1080, 1920), Image.BICUBIC)
                    lo, hi = 0, 1080
                    if s.get('clip') and s['mode'] == 'full':
                        px = C.panel_x(t, s)
                        if px >= 0: hi = min(hi, round(px))
                        else: lo = max(lo, round(px + 1080))
                    if s['mode'] == 'close' and t >= s['a'] + 0.55: hi = 0
                    if hi > lo:
                        base.paste(face.crop((lo, 0, hi, 1920)), (lo, 0))
            top = Image.open(io.BytesIO(pages['fg'].screenshot(type='png', omit_background=True))).convert('RGBA')
            base = Image.alpha_composite(base.convert('RGBA'), top).convert('RGB')
            if stills:
                sd = OUT / os.environ.get('STILLS_DIR', 'stills'); sd.mkdir(parents=True, exist_ok=True)
                base.save(sd / f'{name}-{t:07.2f}.jpg', quality=88)
                for k in list(clips): clips[k][0].close(); del clips[k]
            else:
                enc.stdin.write(base.tobytes())
                if n % 300 == 0: print(f'{name} [{i0}:{i1}] {n}/{len(frames)}', flush=True)
        b.close()
    if enc:
        enc.stdin.close(); enc.wait()
    if take: take.close()


def mix(name):
    C = Cut(name); tl = C.tl; dur = tl['dur']; silent = OUT / f'wed-{name}.silent.mp4'
    final = OUT / (f'wed-long-16x9.mp4' if name == 'long' else 'wed-short-9x16.mp4')
    take = ROOT / tl['take']; v = OUT / f'{name}-voice.wav'; m = OUT / f'{name}-music.wav'; mx = OUT / f'{name}-mix.wav'
    # his voice from the first frame: the take from take_in, padded to the cut
    subprocess.run([FF, '-v', 'error', '-y', '-ss', str(tl['take_in']), '-i', str(take),
                    '-af', f'aresample=48000,aformat=channel_layouts=stereo,apad=whole_dur={dur},atrim=0:{dur}', str(v)], check=True)
    # the bed: looped, about 6 dB lower while he speaks, fuller only under the close, ducked hard under his voice
    close = C.S[-1]['a']; full, low = 0.5, 0.25
    vol = f"volume='{low}+({full}-{low})*min(1,max(0,(t-{close + 0.4:.2f})/0.8))':eval=frame"
    subprocess.run([FF, '-v', 'error', '-y', '-stream_loop', '-1', '-i', str(MUSIC), '-af',
                    f'aresample=48000,aformat=channel_layouts=stereo,atrim=0:{dur},{vol},afade=t=in:st=0:d=0.2,afade=t=out:st={dur - 1.6}:d=1.6', str(m)], check=True)
    subprocess.run([FF, '-v', 'error', '-y', '-i', str(v), '-i', str(m), '-filter_complex',
                    '[0:a]asplit[vo][key];[1:a][key]sidechaincompress=threshold=0.02:ratio=12:attack=15:release=450[md];[vo][md]amix=inputs=2:normalize=0:duration=first[a]',
                    '-map', '[a]', str(mx)], check=True)
    meas = subprocess.run([FF, '-hide_banner', '-i', str(mx), '-af', 'loudnorm=I=-14:TP=-2:LRA=11:print_format=json', '-f', 'null', '-'],
                          capture_output=True, text=True).stderr
    j = json.loads(re.findall(r'\{[^{}]*\}', meas)[-1])
    ln = (f"loudnorm=I=-14:TP=-2:LRA=11:measured_I={j['input_i']}:measured_TP={j['input_tp']}:measured_LRA={j['input_lra']}"
          f":measured_thresh={j['input_thresh']}:offset={j['target_offset']}:linear=true,alimiter=limit=0.72:level=false")
    subprocess.run([FF, '-v', 'error', '-y', '-i', str(silent), '-i', str(mx), '-af', ln, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', str(final)], check=True)
    print('wrote', final)


def main():
    ap = argparse.ArgumentParser(); ap.add_argument('cut'); ap.add_argument('--stills'); ap.add_argument('--jobs', type=int, default=3)
    ap.add_argument('--mix-only', action='store_true'); a = ap.parse_args()
    C = Cut(a.cut)
    if a.stills:
        render_range(a.cut, 0, 0, stills=[float(x) for x in a.stills.split(',')]); return
    if not a.mix_only:
        n = C.total; step = math.ceil(n / a.jobs); parts = []
        procs = []
        for k in range(a.jobs):
            i0, i1 = k * step, min(n, (k + 1) * step)
            part = OUT / f'part-{a.cut}-{k}.mp4'; parts.append(part)
            pr = Process(target=render_range, args=(a.cut, i0, i1, part)); pr.start(); procs.append(pr)
        for pr in procs: pr.join()
        assert all(pr.exitcode == 0 for pr in procs), [pr.exitcode for pr in procs]
        lst = OUT / f'parts-{a.cut}.txt'; lst.write_text(''.join(f"file '{p}'\n" for p in parts))
        subprocess.run([FF, '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', str(lst), '-c', 'copy', str(OUT / f'wed-{a.cut}.silent.mp4')], check=True)
    mix(a.cut)


if __name__ == '__main__':
    main()
