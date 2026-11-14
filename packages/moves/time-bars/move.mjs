// Where the time goes: one bar shrinks (an icon of the old task), one grows (an icon of the new); pairs of people
// appear with a bubble each. Box 1240 x 940.
import { clamp, lerp, rr, label, avatar } from '../_kit.mjs'

export function draw(g, t, p, tokens = p.c) {
  p = { ...p, c: tokens }
  const { c, e } = p, T = p.times
  label(g, p.label ?? 'TIME AT THE COUNTER', 40, 80, 38, c.creamSoft)
  const cash = lerp(1, 0.3, e.utility(clamp((t - T.less) / 0.9)))
  const talk = lerp(0.25, 1, e.utility(clamp((t - T.more) / 0.9)))
  rr(g, 40, 140, 120, 80, 12, null, c.cream, 6); g.fillStyle = c.cream; g.beginPath(); g.arc(100, 180, 18, 0, Math.PI * 2); g.fill()
  rr(g, 200, 140, 960 * cash, 80, 18, c.creamSoft)
  g.strokeStyle = c.mint; g.lineWidth = 7; g.beginPath(); g.ellipse(100, 300, 58, 40, 0, 0, Math.PI * 2); g.stroke()
  rr(g, 200, 260, 960 * talk, 80, 18, c.mint)
  for (let i = 0; i < 6; i++) {
    const kk = e.hero(clamp((t - T.people - i * 0.22) / 0.4))
    const x = 110 + i * 180, y = 640
    avatar(g, x, y + 120, 2.2, c.creamSoft, kk); avatar(g, x + 70, y + 120, 2.2, c.channel, kk)
    if (kk > 0) { g.save(); g.globalAlpha = kk; rr(g, x - 10, y - 30 - kk * 20, 110, 70, 30, c.mint); g.restore() }
  }
}
