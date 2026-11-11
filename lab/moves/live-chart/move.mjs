// A chart that draws itself: a dashed "expected" line dives, then the real lines draw with glowing heads; on
// "watch" the one that matters turns mint and pulses. Box 1240 x 940.
import { clamp, lerp, label } from '../_kit.mjs'

export function draw(g, t, p) {
  const { c, e, W, H } = p, T = p.times
  label(g, p.label, 40, 80, 38, c.creamSoft)
  g.strokeStyle = c.line; g.lineWidth = 2
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(80, 180 + i * 160); g.lineTo(W - 60, 180 + i * 160); g.stroke() }
  label(g, p.axis[0], 80, H - 40, 34, c.muted); label(g, p.axis[1], W - 60, H - 40, 34, c.muted, { align: 'right' })
  const xs = Array.from({ length: 33 }, (_, i) => 80 + i * ((W - 140) / 32))
  const line = (pts, k, color, width, dash = []) => {
    if (k <= 0) return null
    const n = Math.max(1, Math.floor((pts.length - 1) * k)), f = (pts.length - 1) * k - n
    g.save(); g.setLineDash(dash); g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.beginPath()
    pts.slice(0, n + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)))
    const head = n < pts.length - 1 ? [lerp(pts[n][0], pts[n + 1][0], f), lerp(pts[n][1], pts[n + 1][1], f)] : pts[n]
    g.lineTo(...head); g.stroke(); g.restore()
    g.fillStyle = color; g.beginPath(); g.arc(head[0], head[1], width * 1.6, 0, Math.PI * 2); g.fill()
    return head
  }
  const kE = e.utility(clamp((t - T.expect) / 1.5)) * (1 - clamp((t - T.expectEnd - 0.2) / 0.5))
  line(xs.map((x, i) => [x, 200 + (i / 32) ** 2 * 640]), kE, c.muted, 10, [28, 22])
  if (kE > 0.2) label(g, p.expectLabel ?? 'EXPECTED', W - 60, 860, 40, c.muted, { align: 'right' })
  const kP = e.utility(clamp((t - T.a) / 0.9)), kR = e.utility(clamp((t - T.b) / 0.8))
  const watch = e.enter(clamp((t - T.watch) / 0.4))
  line(xs.map((x, i) => [x, 220 + (i / 32) * 260]), kP, c.creamSoft, 12)
  const head = line(xs.map((x, i) => [x, 760 - (i / 32) * 520]), kR, watch > 0.5 ? c.mint : c.cream, 14 + 6 * watch)
  if (kP > 0.9) label(g, p.labels[0], W - 60, 540, 42, c.creamSoft, { align: 'right' })
  if (kR > 0.9) label(g, p.labels[1], W - 60, 200, 48, watch > 0.5 ? c.mint : c.cream, { align: 'right', weight: 700 })
  if (watch > 0 && head) for (let r = 0; r < 3; r++) {
    const u = ((t - T.watch) * 1.2 + r / 3) % 1
    g.strokeStyle = c.mint; g.globalAlpha = 1 - u; g.lineWidth = 6; g.beginPath(); g.arc(head[0], head[1], 20 + 90 * u, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1
  }
}
