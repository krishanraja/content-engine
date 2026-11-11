# Wed 11 long cut with the lift Krish approved (2026-11-10: "apply the lift to both cuts"): pauses closed up, 6% faster
# with pitch kept, punch-ins on his face, emphasis captions; the bed lifts at section changes (mixed with ffmpeg).
# usage: python lift_long.py OUT.mp4 from_out to_out | python lift_long.py spans
import math, subprocess, sys
import cv2, numpy as np
import comp_long as CL
from comp import ease, text, bgr, ARCH, INK, MINT, CREAM

SPEED = 1.06
TITLE_GAP = (15.0, 18.4)
KEEP = []
def silences(path):
    return [tuple(map(float, line.split())) for line in open(path) if line.strip()]
SIL = silences('/tmp/claude-0/w11l/sil_long.txt')
for a, b in CL.KEEP:
    start = a
    for s, e in SIL:
        if e - s > 0.45 and a < s and e < b and s < 357.2 and not (s < TITLE_GAP[1] and e > TITLE_GAP[0]):
            KEEP.append((start, s + 0.18)); start = e - 0.10
    KEEP.append((start, b))
KEEP = [(round(a * 30) / 30, round(b * 30) / 30) for a, b in KEEP]  # whole frames, so picture and voice cut alike
OUT_LEN = sum(b - a for a, b in KEEP) / SPEED
def take_t(o):
    o *= SPEED
    for a, b in KEEP:
        if o < b - a: return a + o
        o -= b - a
    return KEEP[-1][1]
def out_t(t):
    o = 0.0
    for a, b in KEEP:
        if t < b: return (o + max(0.0, t - a)) / SPEED
        o += b - a
    return o / SPEED

PUNCH = [3.3, 6.4, 12.9, 23.1, 25.3, 29.7, 48.6, 56.0, 64.3, 77.9, 81.6, 90.4, 104.6, 110.7, 126.6, 142.5, 155.6, 169.6, 171.5,
         182.3, 189.6, 197.4, 199.2, 206.1, 210.5, 214.7, 219.8, 228.4, 231.4, 252.0, 256.2, 262.4, 274.6, 276.3, 288.4, 300.1,
         303.6, 319.3, 321.1, 326.2, 340.8, 350.5, 353.9]
EMPH = {'familiar', 'tiktok', 'charts', 'first', 'ai', 'human', 'reiki', 'suno', 'button', 'song', 'slot', 'machine', 'layers', 'synths',
        'samples', 'sample', 'choir', 'sitar', 'robot', 'cats', 'weddings', 'dads', 'badly', 'half', 'distribution', 'hugel', 'apart',
        'hand', 'played', 'thin', 'grammys', 'reportedly', 'songwriting', 'performing', 'wrong', 'advert', 'report', 'deck', 'who',
        'which', 'both', 'healer', 'famous', 'legend'}
def punch(t):
    z = 0.0
    for p in PUNCH:
        if p - 0.1 <= t < p + 2.2: z = max(z, ease((t - p + 0.1) / 0.25) * (1 - ease((t - p - 1.7) / 0.5)))
    return 1 + 0.12 * z

def caption(dst, tt):
    if any(a < tt < b for a, b in CL.QUIET): return
    cur = [w for w in CL.WORDS if w[0] - 0.05 <= tt < max(w[1], w[0] + 0.25) + 0.12]
    if not cur: return
    raw = cur[-1][2]; s = CL.FIX.get(raw, raw).strip(',.?!')
    if not s: return
    big = s.lower().replace("'s", '') in EMPH; size = 130 if big else 96; f = ARCH(size)
    bw = int(f.getlength(s)) + 40; x, y = CL.SX + 10, CL.SY + CL.SH + (28 if big else 40)
    cv2.rectangle(dst, (x, y - 10), (x + bw, y + size + 16), bgr(MINT if big else INK), -1)
    text(dst, s, f, x + 20, y, INK if big else CREAM)

import brand_frames as B
HIM = '/tmp/claude-0/w11l/him_long.mp4'   # his picture cut on exactly the voice's spans, then 6% faster (ffmpeg): sync by construction
_cap = [None, -1]; _last = [None]
def him_at(o):
    k = int(round(o * 30))
    if _cap[0] is None or k != _cap[1] + 1:
        _cap[0] = cv2.VideoCapture(HIM); _cap[0].set(cv2.CAP_PROP_POS_FRAMES, k)
    ok, fr = _cap[0].read(); _cap[1] = k
    if not ok: fr = _last[0]
    _last[0] = fr
    m = CL.seg.process(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)).segmentation_mask
    a = np.clip((cv2.GaussianBlur(m, (0, 0), 2) - 0.3) / 0.4, 0, 1).astype(np.float32)
    a[:, :90] *= np.linspace(0, 1, 90, dtype=np.float32)[None, :]
    return fr, a
LAST_WORD_END = 357.4
def frame(o):
    tt = take_t(o); fr, a = him_at(o)
    if 15.85 <= tt < 18.35: return B.title_full(CL.W, CL.H, tt, 15.85)
    if tt >= LAST_WORD_END: return B.ending(CL.W, CL.H, tt, LAST_WORD_END)
    out = np.full((CL.H, CL.W, 3), bgr(CREAM), np.uint8)
    st = B.ending(CL.SW, CL.SH, tt, 354.9) if tt >= 354.9 else CL.stage(tt)
    CL._blend(out, st, CL.STAGE_MASK, CL.SX, CL.SY)
    s = 0.75 * punch(tt)
    fr = cv2.resize(fr, None, fx=s, fy=s, interpolation=cv2.INTER_AREA); a = cv2.resize(a, None, fx=s, fy=s)
    x0 = int(1225 + 500 * 0.75 - 500 * s); y0 = int(-360 + 900 * 0.75 - 900 * s)
    CL._blend(out, fr, a, x0, y0); caption(out, tt); B.corner(out, '16:9'); return out

if __name__ == '__main__':
    if sys.argv[1] == 'spans':
        print(' '.join(f'{a:.3f}:{b:.3f}' for a, b in KEEP)); print('len', round(OUT_LEN, 3))
        print('sections', ' '.join(f'{out_t(s):.2f}' for s, _ in CL.SCENES[1:])); sys.exit()
    out, a, b = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{CL.W}x{CL.H}', '-r', '30', '-i', '-',
                           '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    for i in range(int(a * 30), int(b * 30)): ff.stdin.write(frame(i / 30).tobytes())
    ff.stdin.close(); ff.wait(); print('video', out)
