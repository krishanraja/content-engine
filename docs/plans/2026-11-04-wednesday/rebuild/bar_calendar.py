"""Privacy fix (reviewer, 2026-11-01): the Calendar scheduler's finished card reads "Free time from Thu 29 Oct to Fri 6 Nov,
all in UK time (GMT)", which names a place. This writes a copy of the covered calendar plate with an ink bar over that
whole line on every frame where the card shows, tracked to the hand-held phone by feature matching from one reference frame.
Run from the repository root:  python3 docs/plans/2026-11-04-wednesday/rebuild/bar_calendar.py
Writes .cache/proof/wed/calendar-16x9-barred.mp4 (compose.py prefers it when present)."""
import glob, subprocess
from pathlib import Path
import cv2, numpy as np

ROOT = Path(__file__).resolve().parents[4]
SRC = ROOT / '.cache/produce/2026-11-04-b63d2507/panels/calendar-16x9.mp4'
OUT = ROOT / '.cache/proof/wed/calendar-16x9-barred.mp4'
FF = sorted(glob.glob(str(ROOT / '.cache/tools/ffmpeg-*/bin')))[-1] + '/ffmpeg'
W, H, FPS = 1314, 1080, 30
REF_T = 10.5
# the two lines (and a margin) in the reference frame, as a quadrilateral
POLY = np.float32([[412, 334], [792, 408], [792, 456], [412, 408]])
START = 9.88   # bar every frame from here: the card is still a grey skeleton at 9.875 s

raw = subprocess.run([FF, '-v', 'error', '-i', str(SRC), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
fr = np.frombuffer(raw, np.uint8).reshape(-1, H, W, 3).copy()
ref = cv2.cvtColor(fr[round(REF_T * FPS)], cv2.COLOR_RGB2GRAY)
orb = cv2.ORB_create(4000)
mask = np.zeros_like(ref); mask[100:900, 150:1000] = 255
kr, dr = orb.detectAndCompute(ref, mask)
bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
last = None; used = 0
for i in range(len(fr)):
    if i / FPS < START: continue
    g = cv2.cvtColor(fr[i], cv2.COLOR_RGB2GRAY)
    k, d = orb.detectAndCompute(g, mask)
    Hm = None
    if d is not None and len(k) > 20:
        m = sorted(bf.match(dr, d), key=lambda x: x.distance)[:600]
        if len(m) > 30:
            a = np.float32([kr[x.queryIdx].pt for x in m]); b = np.float32([k[x.trainIdx].pt for x in m])
            Hm, inl = cv2.findHomography(a, b, cv2.RANSAC, 4.0)
            if Hm is not None and inl.sum() < 25: Hm = None
    if Hm is None: Hm = last if last is not None else np.eye(3)
    else: last = Hm
    q = cv2.perspectiveTransform(POLY[None], Hm)[0].astype(np.int32)
    cv2.fillPoly(fr[i], [q], (16, 24, 21)); used += 1
enc = subprocess.run([FF, '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                      '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-pix_fmt', 'yuv420p', str(OUT)], input=fr.tobytes())
print('barred', used, 'frames ->', OUT)
