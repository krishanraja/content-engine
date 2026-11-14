// Every source pinned to one clock: a timeline rail with year ticks, a pin dropping at each source's moment as he
// says it, and a playhead that walks to the year being spoken about. p.text draws a label (house text, so the checks
// see it); p: { c, e, x, y, w, years: [a, b], pins: [{ year, label, at }], head: [[t, year], ...], point }
import { clamp, lerp } from '../_kit.mjs'

export function draw(g, t, p, tokens = p.c) {
  p = { ...p, c: tokens }
  const { c, e, x, y, w } = p, [y0, y1] = p.years
  const X = (yr) => x + ((yr - y0) / (y1 - y0)) * w
  const grow = e.hero(clamp((t - (p.start ?? 0)) / 0.8))
  g.save(); g.strokeStyle = c.line; g.lineWidth = 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + w * grow, y); g.stroke()
  for (let yr = Math.ceil(y0 / 5) * 5; yr <= y1; yr += 5) { const tx = X(yr); if (tx > x + w * grow) break; g.beginPath(); g.moveTo(tx, y - 10); g.lineTo(tx, y + 10); g.stroke() }
  g.restore()
  for (const pin of p.pins) {
    const k = e.hero(clamp((t - pin.at) / 0.45)); if (k <= 0) continue
    const px = X(pin.year), py = y - 30 * (1 - k)
    g.save(); g.globalAlpha = k; g.fillStyle = pin.color ?? c.cream; g.beginPath(); g.arc(px, py, 13, 0, Math.PI * 2); g.fill(); g.restore()
    p.text?.(pin.label, px, y + 62, { align: pin.align ?? 'center', alpha: k, color: pin.color ?? c.creamSoft })
  }
  // The playhead: where the story is now.
  const H = p.head ?? []
  if (!H.length || t < H[0][0]) return
  let yr = H[0][1]
  for (let i = 1; i < H.length; i++) if (t >= H[i][0]) yr = lerp(H[i - 1][1], H[i][1], e.hero(clamp((t - H[i][0]) / 0.7))) 
  const hx = X(yr)
  g.save(); g.strokeStyle = p.point; g.lineWidth = 5; g.beginPath(); g.moveTo(hx, y - 34); g.lineTo(hx, y + 18); g.stroke()
  g.fillStyle = p.point; g.beginPath(); g.moveTo(hx - 13, y - 46); g.lineTo(hx + 13, y - 46); g.lineTo(hx, y - 30); g.closePath(); g.fill(); g.restore()
}
