// The word or number is the picture: set huge on the grid, revealed by a mask that wipes up from its baseline (or in
// from the left), held still, then pushed out the same way. Optional strike and a solid block behind it.
// p: { c, e, str, x, y, size, font, weight, color, at, out, from: 'below' | 'left', block: colour, strike: time,
//      align, tracking }
import { clamp } from '../_kit.mjs'

export function draw(g, t, p) {
  const { e } = p
  const k = e.enter(clamp((t - p.at) / (p.dur ?? 0.45))), o = p.out != null ? e.exit(clamp((t - p.out) / 0.35)) : 0
  if (k <= 0 || o >= 1) return null
  g.save()
  g.font = `${p.weight ?? 400} ${p.size}px '${p.font ?? 'Anton'}'`; g.letterSpacing = `${p.tracking ?? 0}px`
  const m = g.measureText(p.str), w = m.width, asc = p.size * (p.font === 'Anton' || !p.font ? 0.86 : 0.74), desc = p.size * 0.04
  const left = p.align === 'right' ? p.x - w : p.align === 'center' ? p.x - w / 2 : p.x
  const top = p.y - asc, h = asc + desc
  if (p.block) { const bw = (w + 40) * k; g.fillStyle = p.block; g.fillRect(left - 20, top - 20, bw, h + 40) }
  g.beginPath()
  if (p.from === 'left') g.rect(left - 30 + (w + 60) * o, top - 30, (w + 60) * (k - o), h + 60)
  else g.rect(left - 30, top - 30 + (h + 60) * (1 - k) - (h + 60) * o * 0, w + 60, (h + 60) * k * (1 - o))
  g.clip()
  const dy = p.from === 'left' ? 0 : (1 - k) * h * 0.6 - o * h * 0.6
  g.fillStyle = p.color; g.textAlign = 'left'; g.fillText(p.str, left, p.y + dy)
  g.restore()
  if (p.strike != null) {
    const s = e.utility(clamp((t - p.strike) / 0.35))
    if (s > 0) { g.save(); g.fillStyle = p.strikeColor ?? p.color; g.fillRect(left - 10, top + h * 0.48, (w + 20) * s, Math.max(8, p.size * 0.06)); g.restore() }
  }
  return [left, top, w, h]
}
