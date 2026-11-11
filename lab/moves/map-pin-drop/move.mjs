// A street grid where pins drop with ripples: the first group, then the new ones in the series colour. Box 600 x 940.
import { clamp, label } from '../_kit.mjs'

const PINS = [[120, 230], [360, 200], [500, 330], [200, 450], [420, 520], [140, 680], [480, 720], [300, 300], [260, 610], [500, 860]]

export function draw(g, t, p) {
  const { c, e, W, H } = p, T = p.times
  label(g, p.label ?? 'CITY', 36, 70, 34, c.creamSoft)
  g.strokeStyle = c.line; g.lineWidth = 3
  for (let i = 0; i < 7; i++) { g.beginPath(); g.moveTo(30, 140 + i * 120); g.lineTo(W - 30, 140 + i * 120 + 30); g.stroke() }
  for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(60 + i * 125, 110); g.lineTo(40 + i * 125, H - 40); g.stroke() }
  PINS.slice(0, p.first + p.more).forEach(([x, y], i) => {
    const t0 = i < p.first ? T.first + i * 0.12 : T.more + (i - p.first) * 0.2
    const k = e.hero(clamp((t - t0) / 0.45))
    if (k <= 0) return
    const u = clamp((t - t0 - 0.3) / 0.8)
    if (u > 0 && u < 1) { g.strokeStyle = i < p.first ? c.cream : c.channel; g.globalAlpha = 1 - u; g.lineWidth = 5; g.beginPath(); g.ellipse(x, y, 20 + 60 * u, 10 + 30 * u, 0, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1 }
    const py = y - (1 - k) * 160
    g.fillStyle = i < p.first ? c.cream : c.channel
    g.beginPath(); g.arc(x, py - 40, 24, Math.PI, 0); g.lineTo(x, py); g.closePath(); g.fill()
    g.fillStyle = c.ink; g.beginPath(); g.arc(x, py - 42, 9, 0, Math.PI * 2); g.fill()
  })
}
