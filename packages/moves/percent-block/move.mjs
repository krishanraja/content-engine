// A percentage counts up on a block of the series colour that wipes in under it. Draws at y 120 to 310.
import { clamp } from '../_kit.mjs'

export function draw(g, t, p, tokens = p.c) {
  p = { ...p, c: tokens }
  const { c, e } = p
  const k = e.utility(clamp((t - p.times.start) / 0.8))
  const s = `+${Math.round(p.value * k)}%`; g.font = `200px 'Anton'`; const w = g.measureText(s).width
  g.fillStyle = c.channel; g.fillRect(28, 120, (w + 24) * k, 190); g.fillStyle = c.ink; g.fillText(s, 40, 290)
}
