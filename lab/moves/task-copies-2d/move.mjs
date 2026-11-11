// One task ticks done, then copies of the freed time pop open as new slots. Box 1240 x 940.
import { clamp, rr, label } from '../_kit.mjs'

export function draw(g, t, p) {
  const { c, e, W } = p, T = p.times
  label(g, p.label ?? 'THIS WEEK', 40, 80, 38, c.creamSoft)
  rr(g, 40, 130, W - 80, 160, 24, c.inkSoft, c.line, 2); g.fillStyle = c.creamSoft; g.fillRect(100, 200, 560, 22)
  const kd = e.enter(clamp((t - T.done) / 0.4))
  rr(g, W - 200, 160, 110, 100, 22, kd > 0.5 ? c.mint : null, c.cream, 5)
  if (kd > 0.5) { g.strokeStyle = c.ink; g.lineWidth = 12; g.beginPath(); g.moveTo(W - 175, 210); g.lineTo(W - 150, 235); g.lineTo(W - 110, 185); g.stroke() }
  for (let i = 0; i < (p.copies ?? 4); i++) {
    const kk = e.hero(clamp((t - T.copies - i * 0.3) / 0.5))
    if (kk <= 0) continue
    const x = 40 + i * 290, y = 380 + (1 - kk) * 80
    g.save(); g.globalAlpha = kk; rr(g, x, y, 260, 380, 28, c.ink, c.mint, 6)
    g.fillStyle = c.mint; g.fillRect(x + 100, y + 180, 60, 16); g.fillRect(x + 122, y + 158, 16, 60)
    g.restore()
  }
}
