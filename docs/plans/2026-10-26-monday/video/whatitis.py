"""The "what Character.AI is" panel: Krish's own screen recording of the app's home page (28 Oct 2026), pushed in on the
helper characters, with hand-drawn yellow circles. Nothing is generated; creator handles are blurred; no real person's
likeness (the Elon Musk character sits below the crop). Usage:
    python whatitis.py RECORDING.mp4 OUT_DIR [--still-only]
Writes OUT_DIR/whatitis-16x9.mp4 (1314x1080) and whatitis-9x16.mp4 (1080x1000), 25 fps, 8 s (the move ends by 4 s, then holds).
"""
import math, subprocess, sys
from pathlib import Path
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont

FONTS = Path(__file__).resolve().parents[4] / 'scripts/quick-edit/fonts'
INK, YEL, PALE = (18, 27, 24), (255, 216, 77), (214, 220, 214)
FPS, DUR = 25, 8.0
SCHED = {'16x9': (0.2, 1.0, (1.4, 2.2, 3.0)), '9x16': (0.15, 0.7, (0.95, 1.5, 2.0))}  # push start, push length, ring starts
# source-space (994x590) rectangles
FULL = (0, 35, 994, 320)   # stops above the "Try saying" block, which holds a real person's name and photo
ZOOM = (160, 55, 720, 300)
HANDLES = [(203, 258, 262, 275), (345, 258, 388, 275), (449, 258, 510, 275), (573, 258, 622, 275)]
RINGS = [  # (centre x, y, rx, ry, start s, draw s, rotation deg, seed)
    (256, 151, 44, 44, 2.3, 0.9, -8, 1),   # Psychologist
    (628, 151, 46, 44, 3.3, 0.9, 6, 2),    # Ella - Dating coach
    (277, 265, 24, 12, 4.3, 0.6, -4, 3),   # 79.1m chats
]
LABEL = 'CHARACTER.AI HOME PAGE · SCREEN RECORDING · 28 OCT 2026'


def ease(x):
    x = min(max(x, 0.0), 1.0)
    return x * x * (3 - 2 * x)


def lerp(a, b, k):
    return tuple(p + (q - p) * k for p, q in zip(a, b))


def grab_still(rec, t=33.0):
    cap = cv2.VideoCapture(str(rec)); cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, im = cap.read(); assert ok, 'no frame'
    for x0, y0, x1, y1 in HANDLES:
        im[y0:y1, x0:x1] = cv2.GaussianBlur(im[y0:y1, x0:x1], (0, 0), 6)
    return im


def ring_points(cx, cy, rx, ry, rot, seed, upto):
    rng = np.random.default_rng(seed)
    ph = rng.uniform(0, 6.28, 3)
    n = 120; pts = []
    for i in range(int(n * upto) + 1):
        a = (i / n) * 2 * math.pi * 1.08 - math.pi / 2 - 0.3
        wob = 1 + 0.045 * math.sin(2 * a + ph[0]) + 0.03 * math.sin(3 * a + ph[1]) + 0.05 * (i / n)  # spirals out: overshoot
        x, y = rx * wob * math.cos(a), ry * wob * math.sin(a)
        c, s = math.cos(math.radians(rot)), math.sin(math.radians(rot))
        pts.append((cx + x * c - y * s, cy + x * s + y * c))
    return pts


def panel(src, W, H, t, mono, name):
    inner_w = W - 120
    k = ease((t - SCHED[name][0]) / SCHED[name][1])  # the push-in
    crop = lerp(FULL, ZOOM, k)
    cw, ch = crop[2] - crop[0], crop[3] - crop[1]
    inner_h = int(round(inner_w * ch / cw))
    inner_h = min(inner_h, H - 230)
    s = inner_w / cw
    M = np.float32([[s, 0, -crop[0] * s], [0, s, -crop[1] * s]])
    view = cv2.warpAffine(src, M, (inner_w, inner_h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
    if k > 0.5:
        blur = cv2.GaussianBlur(view, (0, 0), 1.2); view = cv2.addWeighted(view, 1.5, blur, -0.5, 0)  # light unsharp
    # fade-in of the whole screen
    a = ease(t / 0.4)
    canvas = np.zeros((H, W, 3), np.uint8); canvas[:] = INK[::-1]
    canvas[0:10, :] = YEL[::-1]
    top = 105 + (H - 230 - inner_h) // 2
    view = (view * a + canvas[top:top + inner_h, 60:60 + inner_w] * (1 - a)).astype(np.uint8)
    canvas[top:top + inner_h, 60:60 + inner_w] = view
    # hand-drawn rings in source space
    for (cx, cy, rx, ry, _t0, _dt, rot, seed), t0 in zip(RINGS, SCHED[name][2]):
        dt = 0.7 if t0 < 3 else 0.5
        if t < t0: continue
        pts = ring_points(cx, cy, rx, ry, rot, seed, ease((t - t0) / dt))
        px = [((x - crop[0]) * s + 60, (y - crop[1]) * s + top) for x, y in pts]
        if len(px) > 1:
            cv2.polylines(canvas, [np.int32(px)], False, YEL[::-1], 7, cv2.LINE_AA)
    img = Image.fromarray(canvas[:, :, ::-1]); d = ImageDraw.Draw(img)
    d.text((60, H - 70), LABEL, font=mono, fill=PALE)
    return np.asarray(img)[:, :, ::-1]


def main():
    rec, out = Path(sys.argv[1]), Path(sys.argv[2]); out.mkdir(parents=True, exist_ok=True)
    src = grab_still(rec)
    mono = ImageFont.truetype(str(FONTS / 'Mono.ttf'), 26)
    for name, W, H in (('16x9', 1314, 1080), ('9x16', 1080, 1000)):
        if '--still-only' in sys.argv:
            for t in (0.0, 1.6, 3.0, 5.0):
                cv2.imwrite(str(out / f'still-{name}-{t}.png'), panel(src, W, H, t, mono, name))
            continue
        p = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                              '-c:v', 'libx264', '-crf', '13', '-preset', 'veryfast', '-pix_fmt', 'yuv420p', str(out / f'whatitis-{name}.mp4')], stdin=subprocess.PIPE)
        for i in range(int(DUR * FPS)):
            p.stdin.write(panel(src, W, H, i / FPS, mono, name).tobytes())
        p.stdin.close(); assert p.wait() == 0


if __name__ == '__main__':
    main()
