# Wed 11: the "lift" pass Krish asked to hear (2026-11-10: "I am worried my recording is too boring sounding and
# monotonous"). On the short's trimmed timeline: pauses closed up, the read 6% faster with pitch kept, punch-ins on
# his face at the lines that matter, emphasis captions, and the bed lifting for a beat at each section change.
# usage: python lift.py OUT.mp4 from_out_s to_out_s   (video only; lift_audio() writes the matching sound)
import math, subprocess, sys
import cv2, numpy as np
import comp as C
from comp import WORDS, ease, text, bgr, ARCH, INK, MINT, CREAM, FPS, W, H

SPEED = 1.06
TITLE_GAP = (13.3, 15.95)   # the title card's pause stays whole
# 1. close up pauses: keep 0.18 s after a word and 0.10 s before the next
cuts = []
for (a0, a1, _), (b0, _, _) in zip(WORDS, WORDS[1:]):
    if b0 - a1 > 0.45 and not (TITLE_GAP[0] <= a1 <= TITLE_GAP[1]):
        cuts.append((a1 + 0.18, b0 - 0.10))
KEEP, start = [], 0.0
for a, b in cuts:
    KEEP.append((start, a)); start = b
KEEP.append((start, 88.8))
OUT_LEN = sum(b - a for a, b in KEEP) / SPEED
def src_t(o):  # output time -> the short's trimmed timeline
    o *= SPEED
    for a, b in KEEP:
        if o < b - a: return a + o
        o -= b - a
    return KEEP[-1][1]

# 2. punch-ins on his face (trimmed-timeline word onsets) and 3. emphasis words
PUNCH = [1.7, 5.1, 11.4, 22.8, 24.5, 30.7, 36.1, 40.3, 42.6, 51.1, 56.3, 59.6, 61.5, 66.5, 73.8, 78.1, 82.0]
EMPH = {'familiar', 'tiktok', 'charts', 'first', 'ai', 'human', 'reiki', 'lyrics', 'button', 'whole', 'cats', 'weddings', 'dads',
        'badly', 'hunting', 'producer', 'rebuilt', 'hand', 'thin', 'robot', 'grammys', 'reportedly', 'songwriting', 'singing',
        'wrong', 'who', 'which', 'both'}
def punch(t):
    z = 0.0
    for p in PUNCH:
        if p - 0.1 <= t < p + 2.2: z = max(z, ease((t - p + 0.1) / 0.25) * (1 - ease((t - p - 1.7) / 0.5)))
    return 1 + 0.14 * z

def caption(dst, t):
    cur = [w for w in WORDS if w[0] - 0.05 <= t < max(w[1], w[0] + 0.25) + 0.12]
    if not cur or 9.4 < t < 15.9 or t > 84.4: return
    s = cur[-1][2].strip(',.?!').replace('UltraNate', 'Ultra Naté'); big = s.lower().strip("'s") in EMPH
    size = 150 if big else 112
    while size > 50 and ARCH(size).getlength(s) > 420: size -= 4
    x, y = 40, 1520 - (30 if big else 0); bw = int(ARCH(size).getlength(s)) + 40
    cv2.rectangle(dst, (x - 14, y - 14), (x - 14 + bw, y + size + 18), bgr(MINT if big else INK), -1)
    text(dst, s, ARCH(size), x + 6, y, INK if big else CREAM)

def frame(o):
    t = src_t(o); out = np.full((H, W, 3), bgr(C.CREAM), np.uint8)
    st = C.stage(t); m = C.rounded_mask(C.SH + 60, W, 56)[60:]; C._blend(out, st, m, 0, 0)
    fr, a = C.him(t); s = 0.62 * punch(t)
    fr = cv2.resize(fr, None, fx=s, fy=s, interpolation=cv2.INTER_AREA); a = cv2.resize(a, None, fx=s, fy=s)
    # grow about his face (source face centre ~ x 500, y 900), so the punch-in pushes towards his eyes
    x0 = int(450 + 500 * 0.62 - 500 * s); y0 = int(720 + 900 * 0.62 - 900 * s)
    C._blend(out, fr, a, x0, y0); caption(out, t); return out

def take_spans():  # the trimmed-timeline spans in TAKE time (the short's own trim: take = t + 1.0 before 58.5, t + 2.1 after)
    spans = []
    for a, b in KEEP:
        if b <= 58.5 or a >= 58.5: spans.append((C.take_time(a), C.take_time(b)))
        else: spans += [(C.take_time(a), C.take_time(58.49)), (C.take_time(58.5), C.take_time(b))]
    return spans

if __name__ == '__main__':
    out, a, b = sys.argv[1], float(sys.argv[2]), float(sys.argv[3])
    if out == 'spans': print(' '.join(f'{x:.3f}:{y:.3f}' for x, y in take_spans())); print('len', OUT_LEN); sys.exit()
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    for i in range(int(a * FPS), int(b * FPS)): ff.stdin.write(frame(i / FPS).tobytes())
    ff.stdin.close(); ff.wait(); print('video', out)
