"""Compose ../index.html from index.template.html + generated scribbles, ribbon and threads."""
import math
import make_vectors as mv

ROOT = "C:/Users/krish/dev/mindmake/content-engine-ve/.ve-work/mocks2/P/"


def scr(paths):
    out = []
    for d in paths:
        out.append(f'<path class="k" d="{d}"/>')
    for d in paths:
        out.append(f'<path class="m" d="{d}"/>')
    return "".join(out)


# ---------------- scribbles (absolute canvas coordinates) ----------------
S1 = scr([mv.curly(96, 948, 548, 46, 11)])
S2 = scr([mv.loop(646, 990, 314, 176, 21, tilt=1.5, a0=-2.5, turns=1.12, grow=0.03, amp=4, n=3.3)])
S3 = scr(mv.underline(214, 566, 1120, 31, amp=3, passes=2))
# measure arrow across the gap (frame 4)
ax0, ax1, ay = 414, 632, 776
stem1, head1 = mv.arrow([(ax0 + 140, ay + 2), (ax0 + 60, ay - 3), (ax0, ay)], (30, 28), 41)
stem2, head2 = mv.arrow([(ax1 - 140, ay - 2), (ax1 - 60, ay + 3), (ax1, ay)], (30, 28), 43)
tick1 = mv.poly_path(mv.wobble([(ax0 - 6, ay - 46), (ax0 - 4, ay - 10), (ax0 - 6, ay + 44)], 2, 45))
tick2 = mv.poly_path(mv.wobble([(ax1 + 6, ay - 46), (ax1 + 4, ay - 10), (ax1 + 6, ay + 44)], 2, 47))
S4 = scr([stem1, head1, stem2, head2, tick1, tick2])
S5 = scr([mv.loop(262, 810, 138, 79, 51, tilt=-3, a0=-2.4, turns=1.14, grow=0.05, amp=3, n=2.6)])


# ---------------- ribbon (frame 1) ----------------
R = "M 522 628 C 556 900, 490 1130, 526 1390 S 552 1780, 520 1990"
RIBBON = (
    f'<path d="{R}" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="62" filter="url(#blur9)" transform="translate(14,22)"/>'
    f'<path d="{R}" fill="none" stroke="#2f9c76" stroke-width="60"/>'
    f'<path d="{R}" fill="none" stroke="#7EF0C0" stroke-width="52"/>'
    f'<path d="{R}" fill="none" stroke="url(#weave)" stroke-width="52"/>'
    f'<path d="{R}" fill="none" stroke="rgba(255,255,255,.38)" stroke-width="8" transform="translate(-11,0)"/>'
)


# ---------------- threads (frame 4) ----------------
def thread(d, col, shade, w=11):
    return (
        f'<path d="{d}" stroke="#000" stroke-opacity=".5" stroke-width="{w}" filter="url(#blur3)" transform="translate(4,7)"/>'
        f'<path d="{d}" stroke="{col}" stroke-width="{w}"/>'
        f'<path d="{d}" stroke="{shade}" stroke-width="{w}" stroke-dasharray="2.5 6" opacity=".55"/>'
    )


def thread_dash(d, col, shade, w=11):
    return (
        f'<path d="{d}" stroke="#000" stroke-opacity=".5" stroke-width="{w}" filter="url(#blur3)" transform="translate(4,7)" stroke-dasharray="26 15"/>'
        f'<path d="{d}" stroke="{col}" stroke-width="{w}" stroke-dasharray="26 15"/>'
    )


def twisted(x, y0, y1, phase, amp=9, period=96, steps=80):
    pts = []
    for i in range(steps + 1):
        t = i / steps
        y = y0 + (y1 - y0) * t
        pts.append(f"{x + amp * math.sin(2 * math.pi * (y - y0) / period + phase):.1f} {y:.1f}")
    return "M" + " L".join(pts)


KX, KY = 522, 1108
left = f"M 236 870 C 236 1030, 520 960, {KX} {KY}"
right = f"M 808 894 C 808 1040, 524 960, {KX} {KY}"
THREADS = ""
# time axis: dotted line under the knot
THREADS += f'<path d="M {KX} {KY} L {KX} 1640" stroke="#F4EFE4" stroke-opacity=".28" stroke-width="3" stroke-dasharray="3 11"/>'
THREADS += thread(left, "#FF6A4D", "#8e2c1b")
THREADS += thread_dash(right, "#FF6A4D", "#8e2c1b")
THREADS += thread(twisted(KX, KY, 1620, 0), "#FF6A4D", "#8e2c1b", 10)
THREADS += thread(twisted(KX, KY, 1620, math.pi), "#F4EFE4", "#B9AF99", 10)
# tab knots where each thread leaves its page
for (x, y) in [(236, 870), (808, 894)]:
    THREADS += f'<circle cx="{x}" cy="{y}" r="13" fill="#16221D" stroke="#F4EFE4" stroke-width="3"/>'
# the knot: mint dot + printed ring
THREADS += f'<circle cx="{KX}" cy="{KY}" r="34" fill="none" stroke="#7EF0C0" stroke-width="3" opacity=".6"/>'
THREADS += f'<circle cx="{KX}" cy="{KY}" r="21" fill="#7EF0C0" stroke="#0C1512" stroke-width="4"/>'
# end of the thread: the call
THREADS += f'<circle cx="{KX}" cy="1628" r="15" fill="#0C1512" stroke="#F4EFE4" stroke-width="4"/>'

tpl = open(ROOT + "tools/index.template.html", encoding="utf-8").read()
for k, v in {"%%S1%%": S1, "%%S2%%": S2, "%%S3%%": S3, "%%S4%%": S4, "%%S5%%": S5, "%%RIBBON%%": RIBBON, "%%THREADS%%": THREADS}.items():
    tpl = tpl.replace(k, v)
open(ROOT + "index.html", "w", encoding="utf-8").write(tpl)
print("built index.html", len(tpl))
