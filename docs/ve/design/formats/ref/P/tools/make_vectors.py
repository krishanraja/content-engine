"""Generate country-neutral security-print line work (guilloche waves, rosettes), flags and hand-wobbled scribbles."""
import math, random

ROOT = "C:/Users/krish/dev/mindmake/content-engine-ve/.ve-work/mocks2/P/"


# ---------- guilloche for a passport page (900 x 1700, bleeds off the bottom) ----------
def guilloche_page(w=900, h=1700, seed=3):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" fill="none" stroke-linecap="round">']
    col = "#5F9C9A"
    y0, y1 = 760, h + 40
    n = 70
    for i in range(n):
        t = i / (n - 1)
        base = y0 + (y1 - y0) * t
        a1 = 26 + 26 * math.sin(t * 5.1 + 0.4)
        a2 = 10 + 8 * math.cos(t * 7.3)
        l1 = 330 + 90 * math.sin(t * 3.0)
        l2 = 120 + 30 * math.cos(t * 4.0)
        ph1 = t * 3.3 + 0.2
        ph2 = t * 6.1
        pts = []
        for x in range(-10, w + 20, 10):
            y = base + a1 * math.sin(2 * math.pi * x / l1 + ph1) + a2 * math.sin(2 * math.pi * x / l2 + ph2)
            pts.append(f"{x:.0f},{y:.1f}")
        out.append(f'<polyline points="{" ".join(pts)}" stroke="{col}" stroke-width="1.5" opacity="{0.38 + 0.25 * math.sin(t * 9):.2f}"/>')
    for i in range(34):
        r = 120 + i * 17
        cx, cy = 640, 360
        pts = []
        for k in range(0, 361, 3):
            th = math.radians(k)
            rr = r + 5 * math.sin(14 * th + i * 0.45) + 3 * math.sin(23 * th - i * 0.2)
            pts.append(f"{cx + rr * math.cos(th):.1f},{cy + rr * math.sin(th):.1f}")
        out.append(f'<polyline points="{" ".join(pts)}" stroke="{col}" stroke-width="1.2" opacity="0.20"/>')
    out.append(f'<rect x="96" y="14" width="{w - 128}" height="{h}" rx="22" stroke="{col}" stroke-width="1.6" opacity="0.35" stroke-dasharray="2 5"/>')
    out.append('</svg>')
    open(ROOT + "assets/guilloche.svg", "w").write("\n".join(out))


# ---------- rosette (table ground print) ----------
def rosette(size=1500):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}" fill="none">']
    cx = cy = size / 2
    for i in range(78):
        r = 90 + i * 8.6
        pts = []
        for k in range(0, 361, 2):
            th = math.radians(k)
            rr = r + (9 + i * 0.16) * math.sin(18 * th + i * 0.31) + 5 * math.sin(31 * th - i * 0.17)
            pts.append(f"{cx + rr * math.cos(th):.1f},{cy + rr * math.sin(th):.1f}")
        out.append(f'<polyline points="{" ".join(pts)}" stroke="#F4EFE4" stroke-width="1.3"/>')
    out.append('</svg>')
    open(ROOT + "assets/rosette.svg", "w").write("\n".join(out))


# ---------- flags ----------
def star(cx, cy, R, rot=-90):
    pts = []
    for k in range(10):
        r = R if k % 2 == 0 else R * 0.382
        a = math.radians(rot + k * 36)
        pts.append(f"{cx + r * math.cos(a):.2f},{cy + r * math.sin(a):.2f}")
    return " ".join(pts)


def flag_usa(w=190, h=100):
    s = h / 13
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">']
    out.append(f'<rect width="{w}" height="{h}" fill="#F6F1E6"/>')
    for i in range(0, 13, 2):
        out.append(f'<rect y="{i * s:.2f}" width="{w}" height="{s:.2f}" fill="#B22234"/>')
    cw, ch = w * 0.4, s * 7
    out.append(f'<rect width="{cw:.1f}" height="{ch:.1f}" fill="#3C3B6E"/>')
    for r in range(9):
        cols = 6 if r % 2 == 0 else 5
        for c in range(cols):
            x = cw / 12 * (1 + 2 * c + (0 if r % 2 == 0 else 1))
            y = ch / 10 * (1 + r)
            out.append(f'<polygon points="{star(x, y, ch / 10 * 0.62)}" fill="#F6F1E6"/>')
    out.append('</svg>')
    return "".join(out)


def flag_china(w=150, h=100):
    out = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">']
    out.append(f'<rect width="{w}" height="{h}" fill="#D8281A"/>')
    u = w / 30
    out.append(f'<polygon points="{star(5 * u, 5 * u, 3 * u)}" fill="#FFDE00"/>')
    for (x, y) in [(10, 2), (12, 4), (12, 7), (10, 9)]:
        cx, cy = x * u, y * u
        # each small star points one tip towards the large star
        rot = math.degrees(math.atan2(5 * u - cy, 5 * u - cx))
        out.append(f'<polygon points="{star(cx, cy, u, rot=rot)}" fill="#FFDE00"/>')
    out.append('</svg>')
    return "".join(out)


# ---------- hand-wobbled scribbles ----------
def noise(rnd, n=4):
    ph = [rnd.uniform(0, 6.28) for _ in range(n)]
    fr = [rnd.uniform(1.0, 3.2) * (k + 1) * 0.7 for k in range(n)]
    am = [1.0 / (k + 1) for k in range(n)]
    return lambda t: sum(a * math.sin(f * t * 6.283 + p) for a, f, p in zip(am, fr, ph)) / 1.6


def poly_path(pts, prec=1):
    return "M" + " L".join(f"{x:.{prec}f} {y:.{prec}f}" for x, y in pts)


def catmull(points, steps=10):
    out = []
    P = [points[0]] + points + [points[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for s in range(steps):
            t = s / steps
            t2, t3 = t * t, t * t * t
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
            out.append((x, y))
    out.append(points[-1])
    return out


def wobble(pts, amp, seed):
    rnd = random.Random(seed)
    nx, ny = noise(rnd), noise(rnd)
    n = len(pts)
    return [(x + amp * nx(i / n), y + amp * ny(i / n)) for i, (x, y) in enumerate(pts)]


def loop(cx, cy, rx, ry, seed, turns=1.12, a0=-2.3, tilt=-5, grow=0.07, amp=5, n=2.0):
    pts = []
    N = 160
    tr = math.radians(tilt)
    e = 2.0 / n
    for i in range(N + 1):
        t = i / N
        a = a0 + t * turns * 2 * math.pi
        k = 1 + grow * t
        ca, sa = math.cos(a), math.sin(a)
        x = rx * k * math.copysign(abs(ca) ** e, ca)
        y = ry * k * math.copysign(abs(sa) ** e, sa)
        pts.append((cx + x * math.cos(tr) - y * math.sin(tr), cy + x * math.sin(tr) + y * math.cos(tr)))
    return poly_path(wobble(pts, amp, seed))


def underline(x0, x1, y, seed, amp=4, passes=2):
    paths = []
    for p in range(passes):
        pts = []
        N = 40
        yy = y + p * 14
        xa, xb = x0 + p * 18, x1 - p * 10
        for i in range(N + 1):
            t = i / N
            pts.append((xa + (xb - xa) * t, yy + 5 * math.sin(t * 3.3 + p) - t * 6))
        paths.append(poly_path(wobble(pts, amp, seed + p)))
    return paths


def curly(x0, x1, y, d, seed, amp=3):
    prof = [(0, 1.0), (0.012, 0.62), (0.05, 0.32), (0.12, 0.2), (0.28, 0.18), (0.40, 0.15), (0.45, 0.08), (0.5, 0.0),
            (0.55, 0.08), (0.60, 0.15), (0.72, 0.18), (0.88, 0.2), (0.95, 0.32), (0.988, 0.62), (1, 1.0)]
    pts = [(x0 + (x1 - x0) * u, y + d * v) for u, v in prof]
    return poly_path(wobble(catmull(pts, 8), amp, seed))


def sq_bracket(x0, x1, y, drop, seed, up=False, amp=3):
    s = -1 if up else 1
    pts = [(x0 + 2, y + s * drop), (x0, y + s * drop * 0.2), (x0 + 6, y), (x0 + (x1 - x0) * 0.3, y + 2),
           (x0 + (x1 - x0) * 0.7, y - 2), (x1 - 6, y), (x1, y + s * drop * 0.2), (x1 - 2, y + s * drop)]
    return poly_path(wobble(catmull(pts, 10), amp, seed))


def arrow(pts, head, seed, amp=3):
    stem = wobble(catmull(pts, 12), amp, seed)
    (xa, ya), (xb, yb) = stem[-6], stem[-1]
    ang = math.atan2(yb - ya, xb - xa)
    L, spread = head
    h1 = (xb - L * math.cos(ang - math.radians(spread)), yb - L * math.sin(ang - math.radians(spread)))
    h2 = (xb - L * math.cos(ang + math.radians(spread)), yb - L * math.sin(ang + math.radians(spread)))
    return poly_path(stem), poly_path(wobble([h1, (xb, yb), h2], 1.5, seed + 9))


if __name__ == "__main__":
    guilloche_page()
    rosette()
    open(ROOT + "assets/flag-usa.svg", "w").write(flag_usa())
    open(ROOT + "assets/flag-china.svg", "w").write(flag_china())
    print("ok")
