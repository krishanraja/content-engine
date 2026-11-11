// Two rows of people, then an equals sign and a level line: the total stayed the same. Box 600 x 420.
import { clamp, label, avatar } from '../_kit.mjs'

export function draw(g, t, p) {
  const { c, e } = p
  label(g, p.label, 36, 70, 34, c.creamSoft)
  p.rows.forEach(({ label: yr, start }, row) => {
    label(g, yr, 36, 158 + row * 90, 30, c.muted, { track: 1 })
    for (let i = 0; i < 8; i++) avatar(g, 150 + i * 46, 150 + row * 90, 1.1, c.channel, e.hero(clamp((t - start - i * 0.05) / 0.3)))
  })
  const ke = e.hero(clamp((t - p.times.equals) / 0.4))
  if (ke > 0) { g.save(); g.globalAlpha = ke; g.font = `150px 'Anton'`; g.fillStyle = c.mint; g.fillText('=', 520, 250); g.restore() }
  const k = e.enter(clamp((t - p.times.equals) / 0.8))
  if (k <= 0) return
  g.strokeStyle = c.mint; g.lineWidth = 10; g.lineCap = 'round'; g.beginPath(); g.moveTo(40, 330); g.lineTo(40 + 520 * k, 330); g.stroke()
  label(g, p.levelWord ?? 'LEVEL', 40, 395, 50, c.mint, { weight: 700 })
}
