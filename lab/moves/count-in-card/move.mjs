// A number counts up to the spoken value in a card, then counts down to the new one; the old value stands struck
// beside it. A row of people lights one by one and the leavers drop away. A year chip flips. Box 600 x 420.
import { clamp, lerp, rr, label, avatar } from '../_kit.mjs'

export function draw(g, t, p) {
  const { c, e, W } = p, T = p.times
  label(g, p.label, 36, 70, 34, c.creamSoft)
  const late = t >= T.yearSwitch
  rr(g, W - 190, 30, 150, 60, 30, late ? c.channel : c.line); label(g, late ? p.years[1] : p.years[0], W - 115, 72, 34, late ? c.ink : c.cream, { align: 'center', track: 1 })
  const f0 = T.countStart, f1 = T.countLand, d0 = T.drop
  const n = t < f0 ? 0 : t < d0 ? Math.round(p.from * clamp((t - f0) / (f1 - f0 + 0.15))) : Math.round(lerp(p.from, p.to, e.utility(clamp((t - d0) / 0.4))))
  if (t >= f0) { g.font = `200px 'Anton'`; g.fillStyle = c.cream; g.fillText(String(n), 36, 300) }
  if (t >= d0 + 0.4) { g.font = `96px 'Anton'`; g.fillStyle = c.muted; g.fillText(String(p.from), 260, 300); g.fillRect(254, 262, 112, 9) }
  for (let i = 0; i < p.from; i++) {
    const on = clamp((t - (f0 + (f1 - f0) * (i / p.from))) / 0.15)
    const gone = i >= p.to ? e.exit(clamp((t - d0 - (i - p.to) * 0.05) / 0.35)) : 0
    const x = 40 + (i % 10) * 54, y = 345 + Math.floor(i / 10) * 44 + gone * 40
    avatar(g, x + 14, y, 1, on > 0.5 && gone < 0.5 ? c.channel : c.line, 1 - gone)
  }
}
