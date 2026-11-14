// A cost bar shrinks to show something got cheaper, with a mint arrow. Box 600 wide; draws at y 160 to 260.
import { clamp, lerp, rr, label } from '../_kit.mjs'

export function draw(g, t, p, tokens = p.c) {
  p = { ...p, c: tokens }
  const { c, e } = p
  const kc = e.utility(clamp((t - p.times.start) / 0.8))
  label(g, p.label ?? 'COST TO RUN', 40, 160, 34, c.muted)
  rr(g, 40, 190, 520 * lerp(1, p.to ?? 0.6, kc), 70, 12, kc > 0 ? c.cream : c.line)
  if (kc > 0) { g.fillStyle = c.mint; g.beginPath(); const ax = 40 + 520 * lerp(1, p.to ?? 0.6, kc) + 40; g.moveTo(ax - 22, 205); g.lineTo(ax + 22, 205); g.lineTo(ax, 245); g.closePath(); g.fill() }
}
