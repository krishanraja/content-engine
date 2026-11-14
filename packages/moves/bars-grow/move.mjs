// A row of small bars: the first group grows, then the new ones grow in the series colour. Draws at y 340 to 400.
import { clamp } from '../_kit.mjs'

export function draw(g, t, p, tokens = p.c) {
  p = { ...p, c: tokens }
  const { c, e } = p, n = p.first + p.more
  for (let i = 0; i < n; i++) {
    const kk = i < p.first ? e.hero(clamp((t - p.times.first - i * 0.06) / 0.4)) : e.hero(clamp((t - p.times.more - (i - p.first) * 0.15) / 0.45))
    g.fillStyle = i < p.first ? c.creamSoft : c.channel; g.fillRect(40 + i * 52, 400 - 60 * kk, 36, 60 * kk)
  }
}
