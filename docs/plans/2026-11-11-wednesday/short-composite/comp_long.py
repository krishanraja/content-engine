# One-off composite for the Wed 11 LONG cut (Ruling, Krish, 2026-11-10: "One-off composite"). 1920x1080, 30 fps.
# Scenes are written in TAKE time (the long take's own clock); the cut list maps output time to take time.
# usage: python comp_long.py OUT.mp4|OUT.jpg [from_out_s to_out_s step]
import json, math, os, subprocess, sys
import cv2, numpy as np, mediapipe as mp
import comp as C  # the short's helpers (fonts, paste, text, hatch, clips, screenshots)
from comp import ease, back, paste, text, hatch, cover, fitw, kb, _blend, rounded_mask, bgr, ANTON, ARCH, MONO, font, INK, INKD, INKS, CREAM, MINT, CLIPS, SHOTS

FPS, W, H = 30, 1920, 1080
SW, SH, SX, SY = 1240, 860, 40, 40          # the stage
DEV = '/tmp/claude-0/w11l'
SRC = '/tmp/claude-0/rec2/sources'
TAKE = '/tmp/claude-0/rec2/eyeL/out/clip.ai-music-long.eyeline.mp4'
# Kept spans of the take (restarts cut: 20.45, 25.05, 302.35; the "weren't clubbing" slip at 232.6)
KEEP = [(1.8, 20.45), (21.38, 25.05), (27.45, 232.6), (234.75, 282.0), (286.08, 302.35), (311.35, 335.5), (338.45, 360.8)]
OUT_LEN = sum(b - a for a, b in KEEP)
def take_t(o):
    for a, b in KEEP:
        if o < b - a: return a + o
        o -= b - a
    return KEEP[-1][1]

def shot(name, x0, y0, x1, y1): return cv2.imread(f'{SRC}/{name}.png')[y0:y1, x0:x1]
S = dict(SHOTS)
S.update({'imael': shot('officialcharts_imael_angel_artist', 125, 875, 1875, 1600), 'suno': shot('suno_home', 0, 0, 2880, 1300),
          'ableton': shot('ableton_arrangement_view_manual', 220, 150, 1690, 1500), 'logic': shot('logic_pro_product', 600, 300, 2300, 1750),
          'splice': shot('splice_sample_packs', 0, 200, 2880, 1500), 'spsearch': shot('spotify_search_movin_to_the_sun', 700, 300, 2880, 1500),
          'm365': shot('m365_copilot_marketing', 0, 0, 2880, 1500), 'ppt': shot('powerpoint_copilot_marketing', 0, 0, 2880, 1500),
          'deezer': shot('deezer_newsroom_50pct_jul2026', 150, 150, 2250, 1700), 'edmhouse': shot('hugel_ai_claims_edmhousenetwork', 960, 400, 2660, 1560),
          'word': cv2.imread('/tmp/claude-0/w11l/newsrc/word.png')[0:1500, 0:2880], 'deezer44': shot('deezer_newsroom_44pct_apr2026', 150, 150, 2250, 1700)})

def ground(c=INK): return np.full((SH, SW, 3), bgr(c), np.uint8)
def fit(img, w, h):
    ih, iw = img.shape[:2]; s = min(w / iw, h / ih); return cv2.resize(img, (int(iw * s), int(ih * s)), interpolation=cv2.INTER_AREA)
def devframe(name, t, t0):
    if os.path.isdir(f'{DEV}/{name}_w'): name = name + '_w'   # rendered with room (1600 x 1110), so no lane, tag or chip collides
    k = int(round((t - t0) * FPS)); k = max(0, k)
    p = f'{DEV}/{name}/f{k:05d}.png'
    while not os.path.exists(p) and k > 0: k -= 1; p = f'{DEV}/{name}/f{k:05d}.png'
    im = cv2.imread(p)
    if im is None: return ground()
    return cv2.resize(im, (SW, SH), interpolation=cv2.INTER_AREA) if im.shape[1] != SW else im
def sway(img, t, amt=0.05, base=1.03):
    return kb(img, base + amt * (0.5 + 0.5 * math.sin(t * 0.35)), 0.5 + 0.25 * math.sin(t * 0.21), 0.5 + 0.25 * math.cos(t * 0.17))
def slide_card(g, img, t, at, cx, cy, w, h, rot=0, frm=(0, 400)):
    if t < at: return
    p = back((t - at) / 0.38); im = fit(img, w, h)
    paste(g, im, cx + (1 - min(1, p)) * frm[0], cy + (1 - min(1, p)) * frm[1], 1, min(1, p * 2), 18, rot=rot)
def stamp(g, s, t, at, cx, cy, col=MINT, size=80, rot=-6):
    if t < at: return
    p = back((t - at) / 0.25); f = ANTON(size); w = int(f.getlength(s)) + 60
    card = np.full((size + 50, w, 3), bgr(col), np.uint8); text(card, s, f, w / 2, 18, INK, 'ma')
    paste(g, card, cx, cy, 1.4 - 0.4 * min(1, p), min(1, p * 2), 12, rot=rot)

TITLE_A = [(11.3, 'IS IT', 0), (11.7, 'AI MUSIC', 1), (12.1, 'OR', 2), (12.9, 'HUMAN MUSIC?', 3)]
TITLE_B = [(296.3, 'IS IT', 0), (297.6, 'AI MUSIC', 1), (298.1, 'OR', 2), (298.6, 'HUMAN MUSIC?', 3)]
def title(g, t, words):
    rows = {0: (40, 110), 1: (170, 200), 2: (440, 90), 3: (560, 200)}
    for at, s, r in words:
        if t < at: continue
        p = min(1, back((t - at) / 0.28)); y, size = rows[r]
        if r in (1, 3):
            band = hatch(size + 50, SW - 120, t * 30) if r == 1 else np.full((size + 50, SW - 120, 3), bgr(MINT), np.uint8)
            text(band, s, ANTON(size - 10), (SW - 120) / 2, 25, CREAM if r == 1 else INK, 'ma')
            paste(g, band, SW / 2, y + (size + 50) / 2, 1.25 - 0.25 * p, min(1, p * 2), 20, rot=(-2 if r == 1 else 2) * (1 - p))
        else:
            f = ANTON(size) if r == 0 else ANTON(size)
            text(g, s, f, SW / 2, y + (1 - p) * 50, CREAM, 'ma', min(1, p * 2))

# ---------------------------------------------------------------- scenes (take time)
def s_cold(t):
    g = ground()
    if t < 5.0:
        g[:] = cover(CLIPS['gran'].at(t + 0.5), SW, SH, 1.0 + 0.03 * t, 0.3); text(g, 'TikTok', MONO(30), 40, SH - 60, CREAM, alpha=0.9); return g
    if t < 6.3:
        order = ['gran', 'trackid', 'cat', 'car', 'wigs', 'granny', 'hugel', 'cat']; tw, th = 280, 390
        for i, k in enumerate(order):
            ti = 5.0 + i * 0.13
            if t < ti: continue
            p = back((t - ti) / 0.3); col, row = i % 4, i // 4
            paste(g, cover(CLIPS[k].at(t + i * 1.7), tw, th), 35 + tw / 2 + col * (tw + 25), 30 + th / 2 + row * (th + 20) + (1 - min(1, p)) * 200, 0.7 + 0.3 * min(1, p), min(1, p * 2), 20)
        return g
    if t < 7.7:
        g[:] = s_cold(6.29) // 3; p = min(1, back((t - 6.3) / 0.35)); im = fit(S['charts'], 1000, 760); s = im.shape[1] / S['charts'].shape[1]
        paste(g, im, SW / 2, SH / 2, 1.08 - 0.08 * p, min(1, p * 2), 18)
        if t > 6.5:
            q = min(1, back((t - 6.5) / 0.3)); x0 = SW / 2 - im.shape[1] / 2; y0 = SH / 2 - im.shape[0] / 2
            cv2.circle(g, (int(x0 + 1660 * s), int(y0 + 990 * s)), int(48 * q), bgr(MINT), 6, cv2.LINE_AA)
            text(g, 'No. 2', ANTON(int(140 * q) + 1), SW - 50, 30, MINT, 'ra', q)
        return g
    if t < 11.0:
        p = ease((t - 7.7) / 0.4)
        paste(g, cover(CLIPS['gran'].at(t), 380, 640), 330 - (1 - p) * 600, SH / 2 + 40, 1, 1, 24, rot=-3)
        paste(g, fit(S['charts'], 560, 420), 910 + (1 - p) * 600, SH / 2 + 40, 1, 1, 20, rot=3)
        text(g, 'TikTok', ANTON(64), 330, 30, CREAM, 'ma', p); text(g, 'Charts', ANTON(64), 910, 30, CREAM, 'ma', p)
        text(g, '?', ANTON(220), int(SW / 2 + 200 * math.sin((t - 7.7) * 5)), SH / 2 - 160, MINT, 'ma', p); return g
    if t < 15.95:
        split = ease((t - 11.0) / 0.6)
        C.wave(g, 60, 120, SW - 120, 260, t, MINT, 1); C.wave(g, 60, SH - 380, SW - 120, 260, t + 0.5, (150, 160, 155), max(0.3, split), 2)
        g[:] = (g.astype(np.float32) * 0.4).astype(np.uint8); title(g, t, TITLE_A); return g
    p = ease((t - 15.95) / 0.35); g[:] = bgr(INKD)
    text(g, 'under.the.hood', MONO(40), SW / 2, SH / 2 - 190, MINT, 'ma', p)
    text(g, 'WHO MADE', ANTON(150), SW / 2, SH / 2 - 120, CREAM, 'ma', p); text(g, 'THIS No. 2 HIT?', ANTON(150), SW / 2, SH / 2 + 50, CREAM, 'ma', p)
    return g

def s_track(t):  # 18.3: this track is called Movin' To The Sun ... number two in the UK
    g = ground(); slide_card(g, S['spotify'], t, 18.3, SW / 2 - 120, SH / 2 - 60, 1000, 520, rot=-2)
    slide_card(g, S['charts'], t, 22.9, SW / 2 + 230, SH / 2 + 120, 640, 520, rot=3, frm=(500, 0))
    if t > 23.3:
        q = min(1, back((t - 23.3) / 0.3)); text(g, 'No. 2 UK', ANTON(int(110 * q) + 1), SW - 40, SH - 150, MINT, 'ra', q)
    return sway(g, t, 0.03)

def s_origin(t):  # 24.3 it started with a Reiki healer ... into an AI app
    g = ground(); slide_card(g, S['imael'], t, 24.3, SW / 2, SH / 2 - 40, 1080, 600)
    slide_card(g, S['suno'], t, 29.5, SW / 2 + 60, SH / 2 + 60, 1000, 560, rot=2, frm=(600, 0))
    return sway(g, t, 0.04)

def s_digging(t):  # 30.1 how it was made ... how all music gets made nowadays
    g = ground()
    slide_card(g, S['ableton'], t, 30.4, 380, SH / 2, 640, 600, rot=-3, frm=(-500, 0))
    slide_card(g, S['logic'], t, 36.2, 860, SH / 2 - 20, 640, 520, rot=3, frm=(500, 0))
    slide_card(g, S['spsearch'], t, 39.6, SW / 2, SH / 2 + 80, 760, 420, rot=-1)
    return sway(g, t, 0.06)

def s_imael(t):  # 43.1 the Reiki healer: Imael Angel; music school, no studio, no band, no software
    g = ground()
    if t < 53.4:
        slide_card(g, S['imael'], t, 43.1, SW / 2, SH / 2, 1120, 640); text(g, 'IMAEL ANGEL', ANTON(90), 50, 30, MINT, alpha=ease((t - 45.5) / 0.3))
        return sway(g, t, 0.06)
    slide_card(g, S['ableton'], t, 53.4, SW / 2, SH / 2, 1000, 760)
    for at, s, x, y in [(55.8, 'NO STUDIO', 330, 220), (57.5, 'NO BAND', 900, 380), (58.4, 'NO IDEA HOW', 520, 640)]:
        stamp(g, s, t, at, x, y, CREAM, 80, rot=-5 if x < 600 else 5)
    return sway(g, t, 0.04)

def suno_form(t, t_l=(69.6, 70.6), t_s=(73.0, 76.0), press=77.5):
    g = ground(); card = np.full((780, 1080, 3), bgr(CREAM), np.uint8)
    text(card, 'Suno', ARCH(58), 40, 30, INK); text(card, 'rebuilt from suno.com, Nov 2026', MONO(24), 42, 102, (90, 100, 95))
    def field(y0, h, label, s, t0, t1):
        on = t0 <= t < t1 + 0.6
        cv2.rectangle(card, (30, y0), (1050, y0 + h), bgr(MINT) if on else (180, 185, 182), 4 if on else 2, cv2.LINE_AA)
        text(card, label, ARCH(28), 54, y0 + 16, INK if t >= t0 - 0.8 else (120, 128, 124))
        n = 0 if t < t0 else min(len(s), int(len(s) * (t - t0) / max(0.1, t1 - t0)) + 1)
        text(card, s[:n] if n else ' ', MONO(40), 54, y0 + 72, INK)
        if on and int(t * 3.4) % 2 == 0:
            cx = 54 + int(MONO(40).getlength(s[:n])) + 4; cv2.rectangle(card, (cx, y0 + 70), (cx + 5, y0 + 122), bgr(INK), -1)
    field(150, 220, 'Lyrics', "I’m movin’ to the sun", *t_l)
    field(400, 160, 'Style of music', 'deep house, female singer, summer vibes', *t_s)
    pr = 1 - 0.06 * math.sin(min(1, max(0, (t - press) / 0.25)) * math.pi)
    btn = np.full((100, 1020, 3), bgr(MINT), np.uint8); text(btn, 'Create', ARCH(40), 510, 26, INK, 'ma')
    if t > press: btn[:] = np.clip(btn.astype(np.int16) + int(60 * math.sin(min(1, (t - press) / 0.3) * math.pi)), 0, 255).astype(np.uint8)
    paste(card, btn, 540, 650, pr, 1, 20, shadow=False)
    p = back((t - 68.2) / 0.4); paste(g, card, SW / 2, SH / 2 + (1 - min(1, p)) * 200, 1, min(1, p * 2), 32)
    return kb(g, 1 + 0.05 * ease((t - 68.2) / 9), 0.5, 0.4)

def s_suno(t):  # 62.2 Suno, the real page; 68.2 the two boxes; 77.5 the press; slot machine to 94
    if t < 68.2:
        g = ground(); slide_card(g, S['suno'], t, 62.4, SW / 2, SH / 2, 1180, 760); return sway(g, t, 0.07)
    if t < 77.6: return suno_form(t)
    dev = sway(devframe('slotL', t, 77.3), t, 0.04)
    if t < 77.9:
        a = ease((t - 77.6) / 0.3); return (suno_form(t).astype(np.float32) * (1 - a) + dev.astype(np.float32) * a).astype(np.uint8)
    return dev

def s_build(t):  # 94.1 how a song is built; until the layers enter, zoom into the song he just made
    if t < 96.9: return kb(devframe('slotL', 93.9, 77.3), 1 + 1.6 * ease((t - 94.0) / 2.9) ** 2, 0.3, 0.45)
    g = sway(devframe('build', t, 94.1), t, 0.05)
    if 124.0 <= t < 130.5:
        out = ease((t - 130.0) / 0.4); p = min(1, back((t - 124.0) / 0.35))
        paste(g, fit(S['splice'], 640, 380), SW - 360, SH - 230 + out * 500, 1, min(1, p * 2) * (1 - out), 16, rot=3)
    return g

def s_feed(t):  # 158 she puts them online; 164.4 under their own videos; 179.4 the comments
    g = ground()
    if t < 164.4:
        slide_card(g, S['spsearch'], t, 158.2, SW / 2, SH / 2, 1100, 700); return sway(g, t, 0.05)
    if t < 168.6:
        off = (t - 164.4) / 1.3
        for i, k in enumerate(['gran', 'trackid', 'granny', 'wigs', 'cat']):
            x = SW / 2 + (i - off) * 420
            if -400 < x < SW + 400: paste(g, cover(CLIPS[k].at(t + i), 360, 640), x, SH / 2, 1, 1, 28)
        return g
    if t < 174.0 and t >= 168.6:  # Krish, 2026-11-10: the cat duet with its own sound; weddings and dads beside it
        p = min(1, back((t - 168.6) / 0.3)); g[:] = cover(CLIPS['ytcat'].at(t - 166.6), SW, SH, 1.1) // 3
        paste(g, cover(CLIPS['ytcat'].at(t - 166.6), 440, 782), 330 + (1 - p) * -400, SH / 2, 1, 1, 28, rot=(1 - p) * -6)
        for at, k, x in [(170.6, 'wigs', 760), (171.3, 'car', 1040)]:
            if t >= at:
                q = min(1, back((t - at) / 0.3)); paste(g, cover(CLIPS[k].at(t), 280, 500), x, SH / 2 + (1 - q) * 400, 1, 1, 24, rot=3 if k == 'wigs' else -3)
        return g
    if t < 172.6:
        seq = [(169.5, 'cat'), (170.6, 'wigs'), (171.3, 'car')]; cur = [k for k in seq if t >= k[0]][-1]; p = min(1, back((t - cur[0]) / 0.3))
        g[:] = cover(CLIPS[cur[1]].at(t), SW, SH, 1.1) // 3
        paste(g, cover(CLIPS[cur[1]].at(t), 440, 780), SW / 2 + (1 - p) * 300, SH / 2, 1, 1, 28, rot=(1 - p) * 6); return g
    g[:] = cover(CLIPS['trackid'].at(t - 170), SW, SH, 1.1) // 3
    paste(g, cover(CLIPS['trackid'].at(t - 170), 440, 780), 330, SH / 2, 1, 1, 28)
    if t > 179.4:
        for i in range(7):
            at = 179.5 + i * 0.35
            if t < at: continue
            p = min(1, back((t - at) / 0.3)); b = np.full((84, 520, 3), bgr(CREAM), np.uint8); text(b, 'what is this song?', ARCH(38), 30, 18, INK)
            paste(g, b, 860 + (i % 2) * 70, 120 + i * 98 + (1 - p) * 60, 1, min(1, p * 2), 40)
    return g

def s_timeline(t):  # 183.6 which came first? TikTok, and the charts came later
    g = ground(); x0, x1, yb = 100, SW - 100, SH - 140
    cv2.line(g, (x0, yb), (x1, yb), bgr((90, 100, 95)), 3, cv2.LINE_AA)
    pt = ease((t - 183.8) / 1.6); pc = ease((t - 186.5) / 2.4)
    tk = [(x0 + i * 6, yb - int(520 * math.exp(-((i - 30) / 12) ** 2) * 1.0)) for i in range(int(150 * pt))]
    if len(tk) > 1: cv2.polylines(g, [np.array(tk)], False, bgr(CREAM), 6, cv2.LINE_AA)
    if t > 184.4: text(g, 'TikTok', ANTON(70), x0 + 150, 90, CREAM, 'ma', ease((t - 185.5) / 0.3))
    ch = [(x0 + 300 + i * 6, yb - int(560 / (1 + math.exp(-(i - 60) / 14)))) for i in range(int(130 * pc))]
    if len(ch) > 1: cv2.polylines(g, [np.array(ch)], False, bgr(MINT), 8, cv2.LINE_AA)
    if t > 186.8: text(g, 'Charts', ANTON(70), 900, 520, MINT, 'ma', ease((t - 186.8) / 0.3))
    if t > 189.0: text(g, 'No. 2', ANTON(80), SW - 30, 40, MINT, 'ra', ease((t - 189.0) / 0.3))
    return sway(g, t, 0.03)

def s_flood(t):
    g = sway(devframe('flood', t, 190.6), t, 0.04)
    if 193.6 <= t < 198.4:
        p = min(1, back((t - 193.6) / 0.35)); out = ease((t - 198.0) / 0.4)
        paste(g, fit(S['deezer'], 520, 380), 300, SH - 230 + out * 500, 1, min(1, p * 2) * (1 - out), 16, rot=-3)
    if 198.8 <= t < 203.4:
        p = min(1, back((t - 198.8) / 0.35)); out = ease((t - 203.0) / 0.4)
        paste(g, fit(S['deezer44'], 520, 380), 300, SH - 230 + out * 500, 1, min(1, p * 2) * (1 - out), 16, rot=3)
    return g

def s_hugel(t):  # 207.6 one stranger ... a dance producer called HUGEL
    g = ground()
    if t < 209.5:
        g[:] = cover(CLIPS['trackid'].at(t - 200), SW, SH, 1.1) // 3; return g
    p = min(1, back((t - 209.5) / 0.35)); g[:] = cover(CLIPS['hugel'].at(t - 209), SW, SH, 1.15) // 3
    paste(g, cover(CLIPS['hugel'].at(t - 209), 440, 780), 330 + (1 - p) * -400, SH / 2, 1, 1, 28)
    slide_card(g, S['weraveyou'], t, 210.4, 860, SH / 2, 660, 420, rot=3, frm=(500, 0))
    text(g, 'HUGEL', ANTON(110), 640, 40, MINT, alpha=ease((t - 210.3) / 0.3)); return g

def s_rebuild(t):
    g = sway(devframe('rebuild', t, 213.9), t, 0.05)
    if 231.2 <= t < 237.3:
        p = min(1, back((t - 231.2) / 0.35)); out = ease((t - 236.9) / 0.4)
        paste(g, fit(S['apple'], 700, 330), SW - 400, SH - 210 + out * 500, 1, min(1, p * 2) * (1 - out), 16, rot=-2)
    if 237.3 <= t < 243.2:
        p = min(1, back((t - 237.3) / 0.35)); out = ease((t - 242.8) / 0.4)
        paste(g, fit(S['charts'], 560, 420), SW - 330, SH - 250 + out * 500, 1, min(1, p * 2) * (1 - out), 16, rot=2)
    C.robot_fly(g, t, 256.0, 260.0)   # "a robot quietly humming along under a dance legend"
    return g

def s_grammys(t):  # 264.5 the Grammys
    g = ground()
    for i, (ti, k) in enumerate([(264.9, 'grammys'), (265.9, 'edmtunes')]):
        if t < ti: continue
        p = min(1, back((t - ti) / 0.35)); dim = 1 - 0.6 * ease((t - 269.6) / 0.4)
        gone = 1 - ease((t - 291.3) / 0.35)  # the article stack leaves when the HUGEL headline arrives
        paste(g, fit((S[k].astype(np.float32) * dim).astype(np.uint8), 900, 400), SW / 2 + (i - 0.5) * 120, 230 + i * 300 + (1 - p) * 400, 1, min(1, p * 2) * gone, 18, rot=(i - 0.5) * 3)
    for j, (at, name, verdict, vat, note, ai) in enumerate([(269.8, 'WRITING', 'RULED OUT', 274.8, 'reportedly', True), (272.4, 'PERFORMING', 'STILL IN', 287.8, 'a human sang it', False)]):
        if t < at: continue
        p = min(1, back((t - at) / 0.35)); cw, chh = 500, 600
        decided = t >= vat; card = hatch(chh, cw, t * 20) if (ai and decided) else np.full((chh, cw, 3), bgr(MINT if decided else CREAM), np.uint8)
        fg = CREAM if (ai and decided) else INK
        text(card, 'GRAMMY FOR', MONO(30), cw / 2, 40, fg, 'ma'); text(card, name, ANTON(84), cw / 2, 90, fg, 'ma')
        if decided:
            q = min(1, back((t - vat) / 0.3)); text(card, verdict, ANTON(int(96 * q) + 1), cw / 2, 300, fg, 'ma', q); text(card, note, MONO(30), cw / 2, 460, fg, 'ma', q)
        if ai and 280.4 <= t:
            hm = hatch(70, 300, t * 30); text(hm, 'AI HUM', MONO(30), 150, 18, CREAM, 'ma'); paste(card, hm, cw / 2, 560 - 20, 1, ease((t - 280.4) / 0.3), 10, shadow=False)
        mv = ease((t - 291.4) / 0.4)
        paste(g, card, 330 + j * 580, SH / 2 + 30 + (1 - p) * 500 + 215 * mv, 1 - 0.25 * mv, min(1, p * 2), 26, rot=-3 if j == 0 else 3)
    if t > 291.6:
        slide_card(g, S['edmhouse'], t, 291.6, SW / 2, 190, 620, 290, frm=(0, -700))  # headline and photo, fully on the stage
    return sway(g, t, 0.04)

def s_question(t):  # 296.2 is it AI music or human music? the wrong question (one title only: here the two cards, struck)
    g = ground(); p = ease((t - 296.3) / 0.4)
    ai = hatch(260, 640, t * 20); text(ai, 'AI?', ANTON(170), 320, 30, CREAM, 'ma')
    hu = np.full((260, 640, 3), bgr(MINT), np.uint8); text(hu, 'HUMAN?', ANTON(170), 320, 30, INK, 'ma')
    paste(g, ai, SW / 2 - 300 - (1 - p) * 900, SH / 2, 1, 1, 26, rot=-3); paste(g, hu, SW / 2 + 300 + (1 - p) * 900, SH / 2, 1, 1, 26, rot=3)
    if t > 300.0:
        q = ease((t - 300.0) / 0.35); cv2.line(g, (60, SH // 2 + 40), (int(60 + (SW - 120) * q), SH // 2 + 40), bgr(MINT), 18, cv2.LINE_AA)
    return g

def s_credits(t): return sway(devframe('credits', t, 311.0), t, 0.05)

R = '/tmp/claude-0/w11l/real'
def _img(p): return cv2.imread(p)
AD = _img(f'{R}/ad_tr.png'); AIC = _img(f'{R}/aiC-001.png'); AIP = _img(f'{R}/aiP-003.png'); AIQ = _img(f'{R}/aiQ-014.png')
BC = _img(f'{R}/bC-001.png'); BA = _img(f'{R}/bA-005.png'); BB = _img(f'{R}/bB-012.png')
def label(g, top, sub, x, y, a):
    text(g, top, ANTON(64), x, y, CREAM, 'ma', a); text(g, sub, MONO(22), x, y + 78, MINT, 'ma', a)
def slam(g, img, t, at, cx, cy, w, h, rot=0, frm=(0, 0)):
    """In from 1.6x with a twist and a settle shake: a card that lands, not one that slides."""
    if t < at: return
    k = t - at; p = min(1, back(k / 0.32)); im = fit(img, w, h)
    sh = (1 - ease(k / 0.4)) * 10
    paste(g, im, cx + (1 - p) * frm[0] + sh * math.sin(k * 80), cy + (1 - p) * frm[1] + sh * math.cos(k * 70), 1.6 - 0.6 * p, min(1, p * 2), 14, rot=rot * (2 - p))
def s_beyond(t):  # 328 this goes way beyond music: an actual advert, an actual report, an actual deck
    g = ground()
    if t < 330.5:  # WAY BEYOND / MUSIC, each word slamming
        for at, s, y in [(328.4, 'WAY BEYOND', 220), (329.4, 'MUSIC', 460)]:
            if t >= at:
                p = min(1, back((t - at) / 0.28)); size = int(220 * (1.4 - 0.4 * p))
                text(g, s, ANTON(size), SW / 2, y - (size - 220) * 0.5, CREAM if s != 'MUSIC' else MINT, 'ma', min(1, p * 2))
        return g
    zoom = 1 + 0.05 * ease((t - 330.5) / 11)
    # THE ADVERT: Coca-Cola's AI-made "Holidays Are Coming" (2024)
    if t >= 330.6:
        k = t - 330.6; p = min(1, back(k / 0.32)); sh = (1 - ease(k / 0.4)) * 10
        paste(g, cover(AD, 360, 540, 1.0, 0.5), 230 + (1 - p) * -500 + sh * math.sin(k * 80), 480, 1.6 - 0.6 * p, min(1, p * 2), 14, rot=-4 * (2 - p))
    if t > 330.8: label(g, 'THE ADVERT', 'Coca-Cola, 2024', 230, 60, ease((t - 330.8) / 0.3))
    # THE REPORT: the Stanford AI Index 2025, its pages fanning out behind the cover
    for i, (img, dx, r) in enumerate([(AIQ, 70, 7), (AIP, 35, 3.5), (AIC, 0, -1)]):
        slam(g, img, t, 333.0 + i * 0.12, 610 + dx, 490, 380, 560, rot=r)
    if t > 333.2: label(g, 'THE REPORT', 'Stanford AI Index, 2025', 640, 60, ease((t - 333.2) / 0.3))
    # THE DECK: BOND's "Trends: Artificial Intelligence" (May 2025), slides dealt like cards
    for i, (img, dx, dy, r) in enumerate([(BB, 70, 90, 6), (BA, 35, 45, 3), (BC, 0, 0, -2)]):
        slam(g, img, t, 338.9 + i * 0.12, 1010 + dx * 0.4 - 15, 330 + dy * 2.6, 440, 250, rot=r, frm=(500, 0))
    if t > 339.1: label(g, 'THE DECK', 'BOND, May 2025', 1010, 60, ease((t - 339.1) / 0.3))
    return kb(g, zoom, 0.5, 0.5)

def s_ask(t):  # 342.2 I'll ask who did which bit; the song is already both
    g = ground()
    if t < 349.9:
        p = ease((t - 347.7) / 0.4); ai = hatch(260, 640, t * 20); text(ai, 'AI?', ANTON(170), 320, 30, CREAM, 'ma')
        hu = np.full((260, 640, 3), bgr(MINT), np.uint8); text(hu, 'HUMAN?', ANTON(170), 320, 30, INK, 'ma')
        if t < 347.7:
            slam(g, BC, t, 342.3, SW / 2, SH / 2, 1000, 620); return sway(g, t, 0.05)
        paste(g, ai, SW / 2 - 300 - (1 - p) * 900, SH / 2, 1, 1, 26, rot=-3); paste(g, hu, SW / 2 + 300 + (1 - p) * 900, SH / 2, 1, 1, 26, rot=3)
        if t > 349.2: q = ease((t - 349.2) / 0.3); cv2.line(g, (80, SH // 2), (int(80 + (SW - 160) * q), SH // 2), bgr(MINT), 22, cv2.LINE_AA)
        return g
    # WHO / DID / WHICH BIT? slamming on his words; WHICH BIT? lands on a mint band; on "both" the band splits two-tone
    k = t - 349.9; beat = 0.5 + 0.5 * math.cos(k * 2 * math.pi * 2.1)
    C.wave(g, 0, 80, SW, SH - 160, k, (40, 70, 58), 0.5 + 0.4 * beat, 1.3)
    for at, s, y, size in [(350.0, 'WHO', 60, 230), (350.25, 'DID', 60, 230)]:
        if t >= at:
            p = min(1, back((t - at) / 0.25)); x = SW / 2 - 200 if s == 'WHO' else SW / 2 + 230
            text(g, s, ANTON(int(size * (1.5 - 0.5 * p))), x, y - (1 - p) * 40, CREAM, 'ma', min(1, p * 2))
    if t >= 350.45:
        p = min(1, back((t - 350.45) / 0.3)); bw, bh = SW - 120, 330
        both = ease((t - 353.5) / 0.5)
        band = np.full((bh, bw, 3), bgr(MINT), np.uint8); text(band, 'WHICH BIT?', ANTON(250), bw / 2, 30, INK, 'ma')
        if both > 0:  # the left half turns AI (hatched, cream type): the same words, both at once
            ai = hatch(bh, bw, t * 30); text(ai, 'WHICH BIT?', ANTON(250), bw / 2, 30, CREAM, 'ma')
            cut = int(bw * 0.5 * both); band[:, :cut] = ai[:, :cut]
        paste(g, band, SW / 2, 560, 1.4 - 0.4 * p, min(1, p * 2), 24, rot=-3 * (1 - p) + 1.5 * math.sin(k * 3) * 0.3)
    shake = (1 - ease((t - 350.45) / 0.4)) * 12 if t >= 350.45 else 0
    if shake > 0.5: g[:] = np.roll(g, int(shake * math.sin(k * 90)), axis=1)
    return g

def s_end(t):
    g = ground(INKD); p = ease((t - 355.0) / 0.4)
    text(g, 'the full deep dive', ANTON(76), SW / 2, SH / 2 - 160, CREAM, 'ma', p)
    text(g, 'makeyourmindup.ai', ANTON(130), SW / 2, SH / 2 - 40, CREAM, 'ma', p)
    q = ease((t - 356.4) / 0.6); cv2.line(g, (160, SH // 2 + 140), (int(160 + (SW - 320) * q), SH // 2 + 140), bgr(MINT), 12, cv2.LINE_AA)
    return g

SCENES = [(0.0, s_cold), (18.3, s_track), (24.3, s_origin), (30.1, s_digging), (43.0, s_imael), (62.2, s_suno), (94.0, s_build),
          (158.0, s_feed), (183.5, s_timeline), (190.5, s_flood), (207.5, s_hugel), (213.8, s_rebuild), (264.4, s_grammys),
          (296.1, s_question), (300.9, s_credits), (328.0, s_beyond), (342.1, s_ask), (354.9, s_end)]
WHIP = 0.3
def stage(t):
    idx = max(i for i, (s, _) in enumerate(SCENES) if t >= s); s0, fn = SCENES[idx]; img = fn(t)
    if idx > 0 and t < s0 + WHIP:
        p = ease((t - s0) / WHIP); old = SCENES[idx - 1][1](s0 - 0.01); k = int(1 + 70 * math.sin(p * math.pi)) | 1
        old = cv2.blur(old, (k, 1)); new = cv2.blur(img, (k, 1)); off = int(SW * p)
        out = np.zeros_like(img); out[:, :SW - off] = old[:, off:]; out[:, SW - off:] = new[:, :off]; return out
    return img

# ---------------------------------------------------------------- him (right), captions (under the stage)
seg = mp.solutions.selfie_segmentation.SelfieSegmentation(model_selection=0)
take = cv2.VideoCapture(TAKE); _pos = [-1.0]
def him(tt):
    if abs(_pos[0] + 1 / FPS - tt) > 0.02: take.set(cv2.CAP_PROP_POS_MSEC, tt * 1000)
    ok, fr = take.read(); _pos[0] = tt
    m = seg.process(cv2.cvtColor(fr, cv2.COLOR_BGR2RGB)).segmentation_mask
    a = np.clip((cv2.GaussianBlur(m, (0, 0), 2) - 0.3) / 0.4, 0, 1).astype(np.float32)
    a[:, :90] *= np.linspace(0, 1, 90, dtype=np.float32)[None, :]  # no hard edge where his arm leaves the frame
    return fr, a

words = json.load(open('/home/user/content-engine/docs/plans/2026-11-11-wednesday/ve/takes/long-1110.json'))['aligners']['a']['words']
WORDS = [(w['onset_s'], w['end_s'], w['text']) for w in words]
QUIET = [(11.0, 18.3), (296.1, 300.9), (354.9, 999)]
FIX = {'Badly.': 'badly', 'Cats': 'cats', 'Weddings': 'weddings', 'Dads': 'dads', 'Dancing': 'dancing', 'Generated': 'generated',
       'Deep': 'deep', 'House,': 'house', 'Female': 'female', 'Singer,': 'singer', 'Summer': 'summer', 'Vibes': 'vibes', 'UltraNate.': 'Ultra Naté', 'Hugel.': 'HUGEL', 'Hugel': 'HUGEL', 'MakeYourMindUp': 'makeyourmindup', 'non': 'non-human', '-human': ''}
def caption(dst, tt):
    if any(a < tt < b for a, b in QUIET): return
    cur = [w for w in WORDS if w[0] - 0.05 <= tt < max(w[1], w[0] + 0.25) + 0.12]
    if not cur: return
    raw = cur[-1][2]; s = FIX.get(raw, raw).strip(',.?!')
    if not s: return
    size = 96; f = ARCH(size); bw = int(f.getlength(s)) + 40; x, y = SX + 10, SY + SH + 40
    cv2.rectangle(dst, (x, y - 10), (x + bw, y + size + 16), bgr(INK), -1)
    text(dst, s, f, x + 20, y, MINT if s.lower() in ('ai', 'human', 'tiktok', 'charts', 'suno', 'grammys', 'hugel') else CREAM)

STAGE_MASK = rounded_mask(SH, SW, 40)
def frame(o):
    tt = take_t(o); out = np.full((H, W, 3), bgr(CREAM), np.uint8)
    _blend(out, stage(tt), STAGE_MASK, SX, SY)
    fr, a = him(tt); s = 0.75
    fr = cv2.resize(fr, None, fx=s, fy=s, interpolation=cv2.INTER_AREA); a = cv2.resize(a, None, fx=s, fy=s)
    _blend(out, fr, a, 1225, -360)
    caption(out, tt); return out

if __name__ == '__main__':
    out = sys.argv[1]; a = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0; b = float(sys.argv[3]) if len(sys.argv) > 3 else OUT_LEN
    step = int(sys.argv[4]) if len(sys.argv) > 4 else 1
    if out.endswith('.jpg'):
        ims = [cv2.resize(frame(i / FPS), (384, 216)) for i in range(int(a * FPS), int(b * FPS), step)]
        rows = [np.hstack(ims[i:i + 6] + [np.zeros_like(ims[0])] * (6 - len(ims[i:i + 6]))) for i in range(0, len(ims), 6)]
        cv2.imwrite(out, np.vstack(rows)); print('sheet', len(ims)); sys.exit()
    ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-',
                           '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', out], stdin=subprocess.PIPE)
    for i in range(int(a * FPS), int(b * FPS)):
        ff.stdin.write(frame(i / FPS).tobytes())
        if i % 900 == 0: print('frame', i, flush=True)
    ff.stdin.close(); ff.wait(); print('video', out)
