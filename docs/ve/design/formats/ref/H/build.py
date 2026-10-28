#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""THE HAND-HELD SCREEN: generates index.html (five 1080x1920 key frames) for mind.the.gap.
Everything that must line up (UI mapped onto the phone glass, scribbles over UI targets, the
grain hole over real footage) is computed here from the glass quad, so a producer can re-run it
with new copy.   python build_plates.py && python build.py
"""
import json, math, os, random
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
QUAD = np.array(json.load(open(os.path.join(HERE, 'assets', 'quad.json'))))  # TL TR BR BL in plate px
PW, PH = 941, 1672                       # plate size
GW, GH = 352.0, 720.0                    # glass size in plate px (average of opposite edges)

# ---------------------------------------------------------------- geometry
def homography(src, dst):
    A, b = [], []
    for (x, y), (X, Y) in zip(src, dst):
        A.append([x, y, 1, 0, 0, 0, -X * x, -X * y]); b.append(X)
        A.append([0, 0, 0, x, y, 1, -Y * x, -Y * y]); b.append(Y)
    h = np.linalg.solve(np.array(A, float), np.array(b, float))
    return np.append(h, 1).reshape(3, 3)

def matrix3d(Hm):
    h = Hm
    v = [h[0, 0], h[1, 0], 0, h[2, 0], h[0, 1], h[1, 1], 0, h[2, 1], 0, 0, 1, 0, h[0, 2], h[1, 2], 0, 1]
    return 'matrix3d(' + ','.join('%.8f' % x for x in v) + ')'

class Cam:
    """canvas = T + R(rot) * k * plate   (CSS: translate rotate scale, origin 0 0)"""
    def __init__(self, k, rot, tx, ty):
        self.k, self.rot, self.tx, self.ty = k, rot, tx, ty
    @staticmethod
    def anchor(k, rot, plate_pt, canvas_pt):
        r = math.radians(rot)
        x, y = plate_pt
        X = k * (x * math.cos(r) - y * math.sin(r))
        Y = k * (x * math.sin(r) + y * math.cos(r))
        return Cam(k, rot, canvas_pt[0] - X, canvas_pt[1] - Y)
    def p2c(self, x, y):
        r = math.radians(self.rot)
        return (self.k * (x * math.cos(r) - y * math.sin(r)) + self.tx,
                self.k * (x * math.sin(r) + y * math.cos(r)) + self.ty)
    def c2p(self, X, Y):
        r = math.radians(self.rot)
        x, y = (X - self.tx) / self.k, (Y - self.ty) / self.k
        return (x * math.cos(r) + y * math.sin(r), -x * math.sin(r) + y * math.cos(r))
    def css(self):
        return 'translate(%.2fpx,%.2fpx) rotate(%.3fdeg) scale(%.4f)' % (self.tx, self.ty, self.rot, self.k)

class Screen:
    """The glass as a UI plane whose pixels equal canvas pixels at this camera's scale."""
    def __init__(self, cam):
        self.cam = cam
        self.W, self.H = GW * cam.k, GH * cam.k
        self.Hm = homography([(0, 0), (self.W, 0), (self.W, self.H), (0, self.H)], QUAD)
    def u2p(self, u, v):
        p = self.Hm @ np.array([u, v, 1.0]); return p[0] / p[2], p[1] / p[2]
    def u2c(self, u, v):
        return self.cam.p2c(*self.u2p(u, v))
    def css(self):
        return matrix3d(self.Hm)
    def quad_c(self, u0, v0, u1, v1):
        return [self.u2c(u0, v0), self.u2c(u1, v0), self.u2c(u1, v1), self.u2c(u0, v1)]
    def fit(self, u0, v0, u1, v1, pad=1.0):
        """centre and the two half-axis vectors (canvas px) of an oval that follows a UI rectangle through the perspective"""
        q = self.quad_c(u0, v0, u1, v1)
        cx = sum(p[0] for p in q) / 4; cy = sum(p[1] for p in q) / 4
        wv = (q[1][0] - q[0][0] + q[2][0] - q[3][0]) / 2, (q[1][1] - q[0][1] + q[2][1] - q[3][1]) / 2
        hv = (q[3][0] - q[0][0] + q[2][0] - q[1][0]) / 2, (q[3][1] - q[0][1] + q[2][1] - q[1][1]) / 2
        return cx, cy, (wv[0] / 2 * pad, wv[1] / 2 * pad), (hv[0] / 2 * pad, hv[1] / 2 * pad)

def safe(cam, margin=3.0):
    """slide the stage left until the plate's left edge (which cuts the sleeve) is off canvas"""
    for _ in range(600):
        worst = min(cam.c2p(X, Y)[0] for X, Y in [(0, 0), (1080, 0), (1080, 1920), (0, 1920)])
        if worst >= margin: break
        cam.tx -= 2.0
    return cam

def ui_clip(expand=9.0, rad=36.0):
    """the glass quad grown a little (it tucks under the bezel), corners rounded, as a CSS path in plate px"""
    q = [np.array(p, float) for p in QUAD]
    c = sum(q) / 4
    lines = []
    for i in range(4):
        a, b = q[i], q[(i + 1) % 4]
        d = (b - a) / np.linalg.norm(b - a); n = np.array([-d[1], d[0]])
        if np.dot(n, a - c) < 0: n = -n
        lines.append((a + n * expand, d))
    pts = []
    for i in range(4):
        (p1, d1), (p2, d2) = lines[i - 1], lines[i]
        t = np.linalg.solve(np.array([d1, -d2]).T, p2 - p1)
        pts.append(p1 + t[0] * d1)
    d = ''
    for i in range(4):
        cpt, prv, nxt = pts[i], pts[i - 1], pts[(i + 1) % 4]
        pin = cpt + (prv - cpt) / np.linalg.norm(prv - cpt) * rad
        pout = cpt + (nxt - cpt) / np.linalg.norm(nxt - cpt) * rad
        d += ('M' if i == 0 else 'L') + '%.1f %.1f' % (pin[0], pin[1])
        d += 'Q%.1f %.1f %.1f %.1f' % (cpt[0], cpt[1], pout[0], pout[1])
    return "path('%sZ')" % d

def check_cover(cam, bg):
    """canvas corners must lie on the plate (its left edge cuts the sleeve) and inside the backdrop"""
    msgs = []
    for X, Y in [(0, 0), (1080, 0), (1080, 1920), (0, 1920)]:
        x, y = cam.c2p(X, Y)
        if x < 0: msgs.append('stage left edge visible at canvas (%d,%d): plate x=%.0f' % (X, Y, x))
    bk, bx, by, brot = bg['k'], bg['x'], bg['y'], bg.get('rot', 0)
    r = math.radians(brot)
    for X, Y in [(0, 0), (1080, 0), (1080, 1920), (0, 1920)]:
        x, y = (X - bx) / bk, (Y - by) / bk
        px, py = x * math.cos(r) + y * math.sin(r), -x * math.sin(r) + y * math.cos(r)
        if px < -1 or py < -1 or px > PW + 1 or py > PH + 1:
            msgs.append('backdrop does not cover canvas corner (%d,%d): bg px=(%.0f,%.0f)' % (X, Y, px, py))
    return msgs

def fit_bg(bg, rot):
    """backdrop offset so a rotated plate still covers the canvas (plate centre -> canvas centre)"""
    k = bg['k']; r = math.radians(rot)
    pcx, pcy = PW / 2, PH / 2
    X = k * (pcx * math.cos(r) - pcy * math.sin(r)); Y = k * (pcx * math.sin(r) + pcy * math.cos(r))
    bg = dict(bg); bg['x'] = 540 - X; bg['y'] = 960 - Y; bg['rot'] = rot
    return bg

# ---------------------------------------------------------------- scribbles (hand-wobbled, generated)
def _smooth(pts):
    n = len(pts)
    if n < 3:
        return 'M%.1f %.1f L%.1f %.1f' % (*pts[0], *pts[-1])
    d = 'M%.1f %.1f' % pts[0]
    for i in range(n - 1):
        p0 = pts[i - 1] if i > 0 else pts[i]
        p1, p2 = pts[i], pts[i + 1]
        p3 = pts[i + 2] if i + 2 < n else pts[i + 1]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6)
        d += ' C%.1f %.1f %.1f %.1f %.1f %.1f' % (*c1, *c2, *p2)
    return d

def rot_pt(x, y, deg, cx, cy):
    r = math.radians(deg)
    return (cx + x * math.cos(r) - y * math.sin(r), cy + x * math.sin(r) + y * math.cos(r))

def scribble_loop(cx, cy, U, V, seed=1, turns=1.16, start=-2.3, grow=0.13, steps=44, sq=2.0):
    """a pen circle that overshoots its own start; sq>2 squares the oval off (a superellipse) so it hugs a block"""
    rng = random.Random(seed); ph = [rng.uniform(0, 6.28) for _ in range(3)]
    pts = []
    n = int(steps * turns)
    for i in range(n + 1):
        t = i / steps
        a = start + 2 * math.pi * t
        w = 1 + 0.05 * math.sin(2 * a + ph[0]) + 0.035 * math.sin(3 * a + ph[1]) + 0.02 * math.sin(5 * a + ph[2])
        g = 1 + grow * t
        c, s_ = math.cos(a), math.sin(a)
        e = 2.0 / sq
        x = math.copysign(abs(c) ** e, c); y = math.copysign(abs(s_) ** e, s_)
        a_, b_ = w * g * x, w * g * y
        pts.append((cx + a_ * U[0] + b_ * V[0], cy + a_ * U[1] + b_ * V[1]))
    return _smooth(pts)

def scribble_line(x0, y0, x1, y1, amp=7, seed=1, waves=2.5, double=True, over=10):
    """a hand-drawn underline: out along the line, a tight turn, back along a second pass"""
    rng = random.Random(seed)
    L = math.hypot(x1 - x0, y1 - y0); ux, uy = (x1 - x0) / L, (y1 - y0) / L; nx, ny = -uy, ux
    ph = rng.uniform(0, 6.28)
    def stroke(off, a0, over, rev=False):
        pts = []
        n = max(12, int(L / 22))
        for i in range(n + 1):
            t = i / n
            sidx = -over + t * (L + 2 * over)
            wob = amp * math.sin(t * waves * 2 * math.pi + ph + a0) * (0.55 + 0.45 * math.sin(t * 3.1 + a0))
            pts.append((x0 + ux * sidx + nx * (wob + off), y0 + uy * sidx + ny * (wob + off)))
        return pts[::-1] if rev else pts
    p1 = stroke(0, 0.3, over)
    if not double:
        return _smooth(p1)
    p2 = stroke(amp * 2.3, 1.9, 4, rev=True)
    join = [(p1[-1][0] + ux * 16 + nx * amp * 1.2, p1[-1][1] + uy * 16 + ny * amp * 1.2)]
    return _smooth(p1 + join + p2)

def scribble_arrow(x0, y0, x1, y1, bend=60, seed=1, head=46):
    rng = random.Random(seed)
    L = math.hypot(x1 - x0, y1 - y0); ux, uy = (x1 - x0) / L, (y1 - y0) / L; nx, ny = -uy, ux
    pts = []
    n = 16
    for i in range(n + 1):
        t = i / n
        off = bend * math.sin(t * math.pi) + 4 * math.sin(t * 17 + rng.random())
        pts.append((x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off))
    dx, dy = pts[-1][0] - pts[-3][0], pts[-1][1] - pts[-3][1]
    a = math.atan2(dy, dx)
    h1 = (x1 - head * math.cos(a - 0.5), y1 - head * math.sin(a - 0.5))
    h2 = (x1 - head * math.cos(a + 0.5), y1 - head * math.sin(a + 0.5))
    return _smooth(pts) + ' M%.1f %.1f L%.1f %.1f L%.1f %.1f' % (*h1, x1, y1, *h2)

def scribble_bracket(x, y0, y1, depth=44, seed=1, side=1):
    rng = random.Random(seed)
    mid = (y0 + y1) / 2
    pts = [(x, y0), (x + side * depth * 0.55, y0 + 10), (x + side * depth * 0.62, y0 + (mid - y0) * 0.55),
           (x + side * depth * 0.5, mid - 12), (x + side * depth * 1.25, mid), (x + side * depth * 0.5, mid + 12),
           (x + side * depth * 0.62, mid + (y1 - mid) * 0.45), (x + side * depth * 0.55, y1 - 10), (x, y1)]
    pts = [(px + rng.uniform(-2.5, 2.5), py + rng.uniform(-2.5, 2.5)) for px, py in pts]
    return _smooth(pts)

def scribble_svg(paths, color='var(--mint)', width=8, sid='s'):
    """ink keyline under a mint/cream stroke; pathLength=1 so the stroke can be drawn on frame by frame"""
    out = ['<svg class="scr" width="1080" height="1920" viewBox="0 0 1080 1920" aria-hidden="true">']
    for d in paths:
        out.append('<path d="%s" pathLength="1" fill="none" stroke="#0C1512" stroke-width="%d" stroke-linecap="round" stroke-linejoin="round"/>' % (d, width + 8))
    for i, d in enumerate(paths):
        out.append('<path id="%s%d" d="%s" pathLength="1" fill="none" stroke="%s" stroke-width="%d" stroke-linecap="round" stroke-linejoin="round"/>' % (sid, i, d, color, width))
    out.append('</svg>')
    return ''.join(out)

# ---------------------------------------------------------------- shared svg pieces
FLAG = 'M15 10 Q38 2 60 13 L47 24 L60 36 Q38 44 15 36 Z'
def pennant(h=88, planted=True, pole='#F4EFE4', st=''):
    """a planted flag = flagged; a bare pole with a dashed ghost = not flagged"""
    w = h * 64 / 88
    flag = ('<path d="%s" fill="#7EF0C0" stroke="#0C1512" stroke-width="3" stroke-linejoin="round"/>' % FLAG if planted else
            '<path d="%s" fill="none" stroke="%s" stroke-width="3" stroke-dasharray="5 6" stroke-linejoin="round" opacity=".55"/>' % (FLAG, pole))
    return ('<svg class="pen" viewBox="0 0 64 88" width="%.1f" height="%.1f" style="%s">'
            '<line x1="12" y1="8" x2="12" y2="80" stroke="%s" stroke-width="5" stroke-linecap="round"/>%s'
            '<circle cx="12" cy="82" r="5" fill="%s"/></svg>') % (w, h, st, pole, flag, pole)

NOISE = ('<svg class="grain" width="1080" height="1920" viewBox="0 0 1080 1920" aria-hidden="true"{style}>'
         '<defs><filter id="gn{n}" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="0.82" numOctaves="2" seed="{n}" stitchTiles="stitch"/>'
         '<feColorMatrix type="saturate" values="0"/></filter></defs><rect width="1080" height="1920" filter="url(#gn{n})"/></svg>')

def grain(n, clip=None):
    st = ''
    if clip:
        d = 'M0 0H1080V1920H0Z M' + ' L'.join('%.1f %.1f' % p for p in clip) + 'Z'
        st = ' style="clip-path:path(evenodd,\'%s\')"' % d
    return NOISE.format(n=n, style=st)

# ---------------------------------------------------------------- CSS
CSS = r"""
@font-face{font-family:'Anton';src:url('../brand/fonts/Anton-Regular.ttf');font-weight:400}
@font-face{font-family:'Archivo';src:url('../brand/fonts/Archivo-Variable.ttf');font-weight:100 900;font-stretch:62% 125%}
@font-face{font-family:'Fraunces';src:url('../brand/fonts/Fraunces-Italic-Variable.ttf');font-style:italic;font-weight:100 900}
@font-face{font-family:'Plex Mono';src:url('../brand/fonts/IBMPlexMono-Regular.ttf');font-weight:400}
@font-face{font-family:'Plex Mono';src:url('../brand/fonts/IBMPlexMono-Medium.ttf');font-weight:500}
@font-face{font-family:'Plex Mono';src:url('../brand/fonts/IBMPlexMono-SemiBold.ttf');font-weight:600}
@font-face{font-family:'Plex Mono';src:url('../brand/fonts/IBMPlexMono-Bold.ttf');font-weight:700}
:root{--ink:#0C1512;--cream:#F4EFE4;--mint:#7EF0C0;--coral:#FF6A4D;--soft:#16221D;--deep:#070D0B}
*{box-sizing:border-box;margin:0;padding:0}
html,body{background:#000}
.frame{position:relative;width:1080px;height:1920px;overflow:hidden;background:var(--ink);color:var(--cream);font-family:'Archivo',sans-serif;isolation:isolate}
body:has(.frame:target) .frame:not(:target){display:none}
.abs{position:absolute}
.bg{position:absolute;left:0;top:0;width:941px;height:1672px;transform-origin:0 0}
.bg img{display:block;width:941px;height:1672px}
.scrim{position:absolute;inset:0}
.stage{position:absolute;left:0;top:0;width:941px;height:1672px;transform-origin:0 0}
.stage>img{position:absolute;left:0;top:0;width:941px;height:1672px;display:block}
.uiclip{position:absolute;left:0;top:0;width:941px;height:1672px}
.ui{position:absolute;left:0;top:0;transform-origin:0 0;background:var(--soft);box-shadow:0 0 0 90px var(--soft);overflow:visible}
.ui .glow{position:absolute;left:0;top:0;right:0;bottom:0;background:radial-gradient(120% 60% at 50% 0%,rgba(126,240,192,.10),rgba(126,240,192,0) 70%)}
.scr{position:absolute;left:0;top:0;pointer-events:none}
.grain{position:absolute;left:0;top:0;opacity:.075;pointer-events:none}
/* type */
.anton{font-family:'Anton',Impact,sans-serif;text-transform:uppercase;line-height:.88;font-weight:400;letter-spacing:0}
.dek{font-family:'Fraunces',serif;font-style:italic;font-weight:400;line-height:1.16;font-variation-settings:'opsz' 72}
.lbl{font:500 30px/1.15 'Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase}
.heavy{font-family:'Archivo',sans-serif;font-weight:900;font-stretch:112%;text-transform:uppercase}
/* kit of parts */
.pill{position:absolute;font:500 30px/1 'Plex Mono',monospace;color:var(--ink);background-color:var(--coral);border-radius:999px;padding:11px 26px 12px;
 background-image:radial-gradient(circle at 7px 7px,rgba(12,21,18,.2) 1.7px,transparent 2.1px);background-size:14px 14px}
.ill{position:absolute;font:500 28px/1 'Plex Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:var(--cream);border:2px dashed rgba(244,239,228,.7);padding:11px 16px 10px;background:rgba(12,21,18,.55)}
.sticker{position:absolute;font:600 30px/1.08 'Plex Mono',monospace;letter-spacing:.03em;text-transform:uppercase;color:var(--ink);background:var(--cream);
 border:2px solid var(--ink);border-radius:999px;padding:11px 26px 12px;box-shadow:5px 5px 0 var(--ink);white-space:nowrap}
.sticker.coral{background-color:var(--coral);background-image:radial-gradient(circle at 7px 7px,rgba(12,21,18,.2) 1.7px,transparent 2.1px);background-size:14px 14px}
.swipe{position:relative;display:inline-block;color:var(--ink);padding:0 .12em;z-index:0}
.swipe::before{content:'';position:absolute;left:0;right:0;top:.04em;bottom:-.02em;background-color:var(--coral);transform:skewX(-8deg);z-index:-1;
 background-image:radial-gradient(circle at 7px 7px,rgba(12,21,18,.2) 1.7px,transparent 2.1px);background-size:14px 14px}
.swipe.mint::before{background-color:var(--mint)}
.stamp{position:absolute;font:700 30px/1 'Plex Mono',monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--cream);border:3px solid var(--cream);padding:13px 18px 13px 22px;background:var(--ink);white-space:nowrap}
.part{position:absolute;font:500 30px/1 'Plex Mono',monospace;color:var(--cream);white-space:nowrap}
.cap{position:absolute;left:72px;top:1180px;width:900px;height:320px;border:2px dashed rgba(244,239,228,.55);background:rgba(12,21,18,.22);
 font:500 30px/1 'Plex Mono',monospace;letter-spacing:.3em;color:rgba(244,239,228,.75);display:flex;align-items:center;justify-content:center}
.band{position:absolute;left:0;width:1080px;background-color:var(--coral);color:var(--ink);overflow:hidden;white-space:nowrap;
 background-image:radial-gradient(circle at 7px 7px,rgba(12,21,18,.2) 1.7px,transparent 2.1px);background-size:14px 14px;font:600 30px/1 'Plex Mono',monospace}
.card{position:absolute;border:2px solid var(--cream);background:var(--ink);box-shadow:8px 8px 0 rgba(244,239,228,.22)}
.logo{position:absolute;left:72px;top:86px;width:260px;height:auto}
.ui .t{position:absolute;white-space:nowrap}
"""

def header():
    return ('<img class="logo" src="../brand/logos/makeyourmindup-horizontal-transparent-1200w.png" alt="makeyourmindup">'
            '<div class="ill" style="left:366px;top:82px">ILLUSTRATION</div>'
            '<div class="pill" style="left:690px;top:79px;width:270px;text-align:center">mind.the.gap</div>')

MARQUEE = ('<div class="band" style="top:1736px;height:62px;padding-top:16px;letter-spacing:.02em">'
           '<span style="margin-left:28px">mind.the.gap &nbsp;·&nbsp; Fridays &nbsp;✦&nbsp; What\'s coming, before it\'s obvious &nbsp;✦&nbsp; No added sermons &nbsp;✦&nbsp; Contains British spelling &nbsp;✦&nbsp; mind.the.gap &nbsp;·&nbsp; Fridays</span></div>')

def scrims(top=0.78, bot=0.88):
    return ('<div class="scrim" style="background:linear-gradient(180deg,rgba(12,21,18,%.2f) 0,rgba(12,21,18,%.2f) 330px,rgba(12,21,18,0) 700px),'
            'linear-gradient(0deg,rgba(12,21,18,%.2f) 0,rgba(12,21,18,%.2f) 220px,rgba(12,21,18,0) 520px)"></div>') % (top, top * .55, bot, bot * .6)

def bg_html(bg):
    t = 'translate(%.1fpx,%.1fpx) rotate(%.2fdeg) scale(%.4f)' % (bg['x'], bg['y'], bg.get('rot', 0), bg['k'])
    return '<div class="bg" style="transform:%s"><img src="assets/%s" alt=""></div>' % (t, bg['img'])

def stage_html(scr, ui_inner, glass=True):
    return ('<div class="stage" style="transform:%s">'
            '<div class="uiclip" style="clip-path:%s"><div class="ui" style="width:%.1fpx;height:%.1fpx;transform:%s"><div class="glow"></div>%s</div></div>'
            '<img src="assets/phone-bezel.png" alt="">%s</div>') % (
        scr.cam.css(), ui_clip(), scr.W, scr.H, scr.css(), ui_inner,
        '<img src="assets/phone-glass.png" alt="">' if glass else '')

def frame(fid, bg, scr, ui_inner, overlay, grain_n, glass=True, clip=None, under=''):
    return ('<section class="frame" id="%s">%s%s%s%s%s%s%s%s</section>' % (
        fid, bg_html(bg), scrims() + under, stage_html(scr, ui_inner, glass), header(), overlay,
        MARQUEE, '<div class="cap">CAPTION</div>', grain(grain_n, clip)))

# ================================================================= frames
warns = []

def strip(label, big, bigsize=94, rightpad=48, labelw=560, big_left=None, label_left=26):
    big_pos = ('left:%dpx' % big_left) if big_left is not None else ('right:%dpx' % rightpad)
    return f'''<div class="card" style="left:72px;top:1516px;width:936px;height:104px;background:var(--mint);border-color:var(--ink);box-shadow:8px 8px 0 var(--ink);color:var(--ink)">
  <div class="lbl" style="position:absolute;left:{label_left}px;top:19px;width:{labelw}px;font-weight:600;font-size:30px;line-height:1.25">{label}</div>
  <div class="anton" style="position:absolute;{big_pos};top:{(104-bigsize)/2-4:.0f}px;font-size:{bigsize}px;line-height:1;white-space:nowrap">{big}</div>
</div>'''

def prov(x, y, rot=4):
    return (f'<div class="sticker coral" style="left:{x}px;top:{y}px;transform:rotate({rot}deg);border-radius:30px;line-height:1.12;'
            f'padding:11px 24px 12px;letter-spacing:.01em">Krish\'s test<br>23 Oct</div>')

# ------------------------------------------------------------------ F1  SETUP (0-4s)
def f1():
    cam = safe(Cam.anchor(1.8, -3.0, QUAD[0], (440, 604)))
    scr = Screen(cam); W, H = scr.W, scr.H
    bg = dict(img='bg-cotton-flip.jpg', k=1.75, x=-60, y=-210)
    warns.extend(['f1 ' + m for m in check_cover(cam, bg)])
    P = 38
    top = 30 * cam.k + 20
    ctop = top + 118
    ui = f'''
<div class="t" style="left:{P}px;top:{top:.0f}px;width:{W-2*P:.0f}px;border:2px solid var(--mint);border-radius:34px;padding:10px 20px 11px;white-space:normal;
 font:500 30px/1.22 'Plex Mono';letter-spacing:.09em;text-transform:uppercase;color:var(--mint)">Same work prompt ·<br>only the country changes</div>
<div class="card" style="left:{P}px;top:{ctop:.0f}px;width:{W-2*P:.0f}px;height:362px">
  <div style="position:absolute;left:26px;top:16px;width:{W-2*P-52:.0f}px;font:500 33px/1.26 'Archivo';color:var(--cream)">UK clothing company. Our supplier gets its cotton from</div>
  <div style="position:absolute;left:22px;top:146px;font:400 84px/1 'Anton';text-transform:uppercase;color:var(--ink)"><span class="swipe mint" style="padding:0 .2em 0 .12em">Xinjiang</span></div>
  <div class="lbl" style="position:absolute;left:350px;top:184px;font-size:30px;color:var(--cream);opacity:.85">then</div>
  <div style="position:absolute;left:26px;top:246px;font:400 84px/1 'Anton';text-transform:uppercase;color:var(--cream);opacity:.45;border-bottom:4px dashed rgba(244,239,228,.55);padding-bottom:4px">Turkmenistan</div>
</div>
'''
    cx, cy, U, V = scr.fit(P + 6, ctop + 132, P + 26 + 470, ctop + 348, pad=1.12)
    sc = scribble_svg([scribble_loop(cx, cy, U, V, seed=4, sq=3.0)], color='var(--cream)')
    over = f'''
<div class="abs anton" style="left:72px;top:176px;font-size:156px;white-space:nowrap">Will they<br><span class="swipe">flag</span> it?</div>
<div class="abs dek" style="left:72px;top:456px;width:600px;font-size:44px;color:var(--cream)">America has just blocked cotton from both over forced labour.</div>
{prov(684, 176, 4)}
<div class="sticker" style="left:720px;top:322px;transform:rotate(-5deg)">Claude</div>
<div class="sticker" style="left:712px;top:396px;transform:rotate(2.5deg)">ChatGPT</div>
<div class="sticker" style="left:728px;top:470px;transform:rotate(-3deg)">DeepSeek</div>
{strip('Answers that flag<br>forced labour', '<span style="margin-right:24px">?</span>out of 2')}
{sc}
'''
    return frame('f1', bg, scr, ui, over, 1)

# ------------------------------------------------------------------ F2  THE PASS (4-10s)
def f2():
    cam = safe(Cam.anchor(1.9, -10.0, QUAD[0], (262, 452)))
    scr = Screen(cam); W, H = scr.W, scr.H
    bg = dict(img='bg-cotton.jpg', k=1.5, x=-90, y=-330)
    warns.extend(['f2 ' + m for m in check_cover(cam, bg)])
    P = 34
    top = 30 * cam.k + 18
    CH = 276
    def row(y, label):
        return (f'<div style="position:absolute;left:30px;top:{y}px;display:flex;align-items:flex-end;gap:14px">{pennant(72)}'
                f'<span class="lbl" style="font-size:30px;letter-spacing:.06em;margin-bottom:4px">{label}</span></div>')
    def card(v, name):
        return f'''<div class="card" style="left:{P}px;top:{v}px;width:{W-2*P:.0f}px;height:{CH}px">
  <div class="heavy" style="position:absolute;left:30px;top:22px;font-size:44px;line-height:1;color:var(--cream)">{name}</div>
  <div class="anton" style="position:absolute;right:30px;top:12px;font-size:136px;line-height:1;color:var(--mint)">2/2</div>
  {row(104, 'Xinjiang')}{row(186, 'Turkmenistan')}
</div>'''
    v1 = top + 50; v2 = v1 + CH + 28
    ui = f'''<div class="t lbl" style="left:{P}px;top:{top:.0f}px;color:var(--mint)">Flagged it?</div>{card(v1, 'Claude')}{card(v2, 'ChatGPT')}'''
    cx, cy, U, V = scr.fit(W - P - 214, v1 + 2, W - P - 10, v2 + 168, pad=1.1)
    sc = scribble_svg([scribble_loop(cx, cy, U, V, seed=7, sq=3.0, start=0.5)], color='var(--cream)')
    over = f'''
<div class="abs anton" style="left:72px;top:176px;font-size:160px;white-space:nowrap">Two for <span class="swipe">two.</span></div>
{prov(684, 336, 4)}
<div class="abs dek" style="left:72px;top:1524px;width:880px;font-size:44px;color:var(--cream);line-height:1.12">Claude flagged both countries.<br>So did ChatGPT.</div>
{sc}
'''
    return frame('f2', bg, scr, ui, over, 2)

# ------------------------------------------------------------------ F3  THE ODD ONE (10-14s)
def f3():
    cam = safe(Cam.anchor(2.1, -1.0, QUAD[0], (262, 482)))
    scr = Screen(cam); W, H = scr.W, scr.H
    bg = dict(img='bg-hardware.jpg', k=1.6, x=-330, y=-120)
    warns.extend(['f3 ' + m for m in check_cover(cam, bg)])
    P = 30
    top = 30 * cam.k + 20
    cw = (W - 2 * P - 22) / 2
    cv = top + 62; ch = 450
    def unit(x, name, planted, num, numcol):
        return f'''<div class="card" style="left:{x:.0f}px;top:{cv:.0f}px;width:{cw:.0f}px;height:{ch}px">
  <div class="lbl" style="position:absolute;right:20px;top:20px;font-size:30px;color:var(--cream)">{name}</div>
  <div style="position:absolute;left:0;right:0;top:72px;display:flex;justify-content:center">{pennant(206, planted)}</div>
  <div class="anton" style="position:absolute;left:0;right:0;top:288px;text-align:center;font-size:150px;line-height:1;color:{numcol}">{num}</div>
</div>'''
    ui = f'''<div class="t heavy" style="left:{P}px;top:{top-4:.0f}px;font-size:44px;line-height:1;color:var(--cream)">DeepSeek</div>
{unit(P, 'Xinjiang', False, '0', 'var(--cream)')}{unit(P + cw + 22, 'Turkmenistan', True, '1', 'var(--mint)')}'''
    pe = scr.u2c(P + cw / 2 + 34, cv + 112)      # the empty flag: where the dashed ghost would fly
    sc = scribble_svg([scribble_arrow(64, 600, pe[0], pe[1], bend=-46, seed=3, head=50)], color='var(--cream)')
    over = f'''
<div class="abs anton" style="left:72px;top:176px;font-size:150px;white-space:nowrap">The <span class="swipe">odd</span><br>one out.</div>
{prov(684, 372, -4)}
<div class="abs dek" style="left:72px;top:1524px;width:880px;font-size:44px;color:var(--cream);line-height:1.12">DeepSeek flagged Turkmenistan.<br>It did not flag Xinjiang.</div>
{sc}
'''
    return frame('f3', bg, scr, ui, over, 3)

# ------------------------------------------------------------------ F4  WATCH XINJIANG (14-18s)  real footage
def f4():
    k, rot, s = 1.95, -104.5, 1.14
    cam = Cam(k, rot, 0, 0)
    scr = Screen(cam); W, H = scr.W, scr.H
    FW, FH = 1087.0, 780.0
    u_c = W - 372 * s; v_c = H / 2
    def f2u(xf, yf):               # footage px -> UI px (footage turned 90deg clockwise inside the glass)
        dx, dy = (xf - FW / 2) * s, (yf - FH / 2) * s
        return u_c - dy, v_c + dx
    p = scr.u2p(*f2u(206, 247))
    cam = Cam.anchor(k, rot, p, (62, 800)); scr.cam = cam
    bg = fit_bg(dict(img='bg-hardware.jpg', k=2.45), rot + 180)
    warns.extend(['f4 ' + m for m in check_cover(cam, bg)])
    fw, fh = FW * s, FH * s
    ui = (f'<img src="../plates/deepseek-recording-frame.jpg" alt="real screen recording frame" style="position:absolute;left:{u_c - fw/2:.1f}px;top:{v_c - fh/2:.1f}px;'
          f'width:{fw:.1f}px;height:{fh:.1f}px;transform:rotate(90deg);transform-origin:50% 50%;max-width:none">')
    hole = [scr.u2c(W - 14, v_c - FW / 2 * s), scr.u2c(W - 14, v_c + FW / 2 * s), scr.u2c(14, v_c + FW / 2 * s), scr.u2c(14, v_c - FW / 2 * s)]
    # the underline: footage px (measured on the recording frame, line 3 of the answer): the clause
    #   "Xinjiang cotton" carries a strong forced-labour   runs x 597 to 954, x-height top y 300, baseline y 308, descender tips y 311.
    #   Centre line y 320 puts the 8 px stroke 5 px clear of the descender tips and the 16 px keyline just clear of them (nothing sits below until y 368).
    UL_Y, UL_X0, UL_X1 = 320, 597, 954
    ux0, uy0 = scr.u2c(*f2u(UL_X0, UL_Y)); ux1, uy1 = scr.u2c(*f2u(UL_X1, UL_Y))
    sc = scribble_svg([scribble_line(ux0, uy0, ux1, uy1, amp=2.2, seed=5, waves=2.0, double=False, over=5)], color='var(--mint)')
    # the clause as a verbatim pull quote (the footage text is about 21 px and is never enlarged): Archivo 44/600, two lines, label in Plex Mono
    pq = ('<div class="card" style="left:72px;top:1516px;width:888px;height:116px">'
          '<div style="position:absolute;left:28px;top:9px;width:830px;font:600 44px/1.08 \'Archivo\';color:var(--cream)">&quot;Xinjiang cotton&quot; carries a strong<br>forced-labour&hellip;</div>'
          '<div class="lbl" style="position:absolute;right:28px;bottom:14px;font-size:30px;line-height:1;color:var(--mint);white-space:nowrap">DeepSeek wrote</div></div>')
    # the recording label, as a small sticker in the side stack (Z4)
    rec = ('<div class="sticker" style="left:684px;top:176px;transform:rotate(-3deg);border-radius:30px;line-height:1.12;padding:11px 24px 12px">'
           '<span style="display:inline-block;width:18px;height:18px;border-radius:50%;background:var(--coral);margin-right:12px;vertical-align:-1px"></span>Screen<br>recording<br>DeepSeek<br>23 Oct 2026</div>')
    over = f'''
<div class="abs anton" style="left:72px;top:176px;font-size:150px;white-space:nowrap">Watch<br><span class="swipe">Xinjiang.</span></div>
{rec}
{pq}
{sc}
'''
    return frame('f4', bg, scr, ui, over, 4, glass=False, clip=hole)

# ------------------------------------------------------------------ F5  THE DELETION (18-20s)
def f5():
    cam = safe(Cam.anchor(1.55, -8.0, QUAD[0], (300, 722)))
    scr = Screen(cam); W, H = scr.W, scr.H
    bg = dict(img='bg-cotton-flip.jpg', k=1.4, x=-180, y=-120)
    warns.extend(['f5 ' + m for m in check_cover(cam, bg)])
    P = 34
    top = 30 * cam.k + 22
    BH = 302
    ui = f'''<div class="card" style="left:{P}px;top:{top:.0f}px;width:{W-2*P:.0f}px;height:{BH}px">
  <div class="lbl" style="position:absolute;left:26px;top:16px;font-size:30px;color:var(--mint)">DeepSeek</div>
  <div style="position:absolute;left:26px;top:62px;width:{W-2*P-52:.0f}px;font:600 44px/1.25 'Archivo';color:var(--cream)">Sorry, that's beyond my current scope. Let's talk about something else.</div>
</div>'''
    cx, cy, U, V = scr.fit(P - 2, top - 4, W - P + 4, top + BH + 6, pad=1.04)
    sc = scribble_svg([scribble_loop(cx, cy, U, V, seed=9, sq=3.4, start=0.4)], color='var(--mint)')

    # the result as three threads on a time axis (the mind.the.gap device), no box:
    #   threads start apart, bend and meet at the dated call; a planted flag = flagged; a parted thread = the answer was deleted
    S1, S2, KX, KY, AXY = 410, 660, 892, 436, 240          # station poles, dated knot, time-axis y
    ROWS = [('Claude', 336, True, '2/2'), ('ChatGPT', 436, True, '2/2'), ('DeepSeek', 536, False, '1/2')]
    CR, INK = '#F4EFE4', '#0C1512'
    def thread_pts(seed, y, x_from, x_to, amp=6):
        rng = random.Random(seed)
        xs = [x for x in (72, 150, 232, 314, 360, 410, 500, 580, 660) if x_from <= x <= x_to]
        pts = []
        for x in xs:
            pinned = x in (S1, S2)                                   # the pole feet sit exactly on the thread
            pts.append((x, y if pinned else y + rng.uniform(-amp, amp)))
        return pts
    def converge(seed, y):
        """from the second station, bend toward the knot (the three threads meet at the dated call)"""
        rng = random.Random(seed)
        d = KY - y
        return [(S2 + 64, y + rng.uniform(-3, 3)), (S2 + 140, y + d * 0.20 + rng.uniform(-3, 3)),
                (S2 + 190, y + d * 0.52), (S2 + 222, y + d * 0.84), (KX, KY)]
    ths = []                                                           # (path d)
    ring_pt = None
    for n, (name, y, planted, tally) in enumerate(ROWS):
        if planted:
            ths.append(_smooth(thread_pts(n + 21, y, 72, S2) + converge(n + 31, y)))
        else:
            left = thread_pts(n + 21, y, 72, S1 - 52)
            left.append((S1 - 50, y + 1))
            right = [(S1 + 52, y - 1)] + [(x, yy) for x, yy in thread_pts(n + 41, y, S1 + 60, S2)]
            ths.append(_smooth(left)); ths.append(_smooth(right + converge(n + 31, y)))
            ring_pt = (S1, y)
    svg = [f'<svg class="scr" width="1080" height="1920" viewBox="0 0 1080 1920" aria-hidden="true">']
    # time axis, with a tick at each station and at the dated call
    svg.append(f'<path d="M72 {AXY} L944 {AXY} M930 {AXY-13} L946 {AXY} L930 {AXY+13}" fill="none" stroke="{CR}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>')
    for tx in (S1, S2, KX):
        svg.append(f'<path d="M{tx} {AXY-12} L{tx} {AXY+12}" stroke="{CR}" stroke-width="3" stroke-linecap="round" opacity=".7"/>')
    # threads: ink keyline then cream
    for d in ths:
        svg.append(f'<path d="{d}" fill="none" stroke="{INK}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>')
    for d in ths:
        svg.append(f'<path d="{d}" fill="none" stroke="{CR}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>')
    # the parted thread: frayed ends and the ring where the answer was deleted
    rx, ry = ring_pt
    ex0, ex1 = S1 - 50, S1 + 52
    svg.append(f'<path d="M{ex0} {ry+1} l-4 -12 M{ex0} {ry+1} l7 13 M{ex1} {ry-1} l4 -12 M{ex1} {ry-1} l-7 13" stroke="{CR}" stroke-width="3" stroke-linecap="round"/>')
    svg.append(f'<circle cx="{rx}" cy="{ry}" r="16" fill="{INK}" stroke="{CR}" stroke-width="4"/>')
    # the knot: the dated call, with a short stub down to the sticker
    svg.append(f'<path d="M{KX} {KY} L{KX} 620" stroke="{INK}" stroke-width="12" stroke-linecap="round"/>')
    svg.append(f'<path d="M{KX} {KY} L{KX} 620" stroke="{CR}" stroke-width="5" stroke-linecap="round"/>')
    svg.append(f'<circle cx="{KX}" cy="{KY}" r="15" fill="{INK}" stroke="{CR}" stroke-width="4"/>')
    svg.append('</svg>')
    flags = ''
    for name, y, planted, tally in ROWS:
        for xi in (S1, S2):
            if planted or xi == S2:
                flags += f'<div style="position:absolute;left:{xi-11.5:.1f}px;top:{y-78}px">{pennant(84)}</div>'
    names = ''.join(
        f'<div style="position:absolute;left:72px;top:{y-52}px;display:flex;align-items:baseline;gap:20px">'
        f'<span class="heavy" style="font-size:34px;line-height:1;color:var(--cream)">{n}</span>'
        f'<span class="anton" style="font-size:46px;line-height:1;white-space:nowrap;color:{"var(--mint)" if p else "var(--cream)"}">{t}</span></div>'
        for n, y, p, t in ROWS)
    heads = ''.join(f'<div class="lbl" style="position:absolute;left:{x}px;top:190px;font-size:30px;line-height:1;white-space:nowrap;transform:translateX(-50%);color:var(--cream)">{t}</div>'
                    for x, t in ((S1, 'Xinjiang'), (S2, 'Turkmenistan')))
    # the stamp and its leader to the parted thread
    st, SW, SH = (76, 610), 374, 62
    r = math.radians(-4); sx_, sy_ = SW / 2 - 52, -SH / 2
    lx0 = st[0] + SW / 2 + sx_ * math.cos(r) - sy_ * math.sin(r); ly0 = st[1] + SH / 2 + sx_ * math.sin(r) + sy_ * math.cos(r)
    ddx, ddy = lx0 - rx, ly0 - ry; dl = math.hypot(ddx, ddy)
    leader = (f'<svg class="scr" width="1080" height="1920" viewBox="0 0 1080 1920"><line x1="{lx0:.1f}" y1="{ly0:.1f}" x2="{rx + ddx / dl * 18:.1f}" y2="{ry + ddy / dl * 18:.1f}" '
              f'stroke="{CR}" stroke-width="2.5"/><circle cx="{rx}" cy="{ry}" r="7" fill="{INK}" stroke="{CR}" stroke-width="2.5"/></svg>')
    wash = ('<div class="abs" style="left:0;top:120px;width:1080px;height:660px;background:linear-gradient(180deg,rgba(12,21,18,.84) 0,rgba(12,21,18,.84) 440px,rgba(12,21,18,0) 660px)"></div>')
    over = f'''
{"".join(svg)}
{flags}{names}{heads}
<div class="stamp" style="left:{st[0]}px;top:{st[1]}px;transform:rotate(-4deg)">Answer deleted</div>
{leader}
{prov(684, 586, 4)}
{strip('Runs where DeepSeek<br>deleted its Xinjiang answer', '3/3', bigsize=100, labelw=650, big_left=28, label_left=272)}
{sc}
'''
    return frame('f5', bg, scr, ui, over, 5, under=wash)

# ------------------------------------------------------------------ build
def main():
    only = os.environ.get('FRAMES')
    fns = [f for f in (f1, f2, f3, f4, f5) if not only or f.__name__ in only.split(',')]
    out = [fn() for fn in fns]
    page = ('<!doctype html><html lang="en-GB"><head><meta charset="utf-8">'
            '<meta name="viewport" content="width=1080">'
            '<title>mind.the.gap · the hand-held screen · key frames</title><style>%s</style></head><body>%s</body></html>') % (CSS, '\n'.join(out))
    with open(os.path.join(HERE, 'index.html'), 'w', encoding='utf-8') as f:
        f.write(page)
    for w in warns: print('WARN', w)
    print('ok', len(page))

if __name__ == '__main__':
    main()
