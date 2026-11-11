// Shared drawing primitives for 2D moves. Every move draws frame t from t alone.
export const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x))
export const lerp = (a, b, k) => a + (b - a) * k

export function rr(g, x, y, w, h, r, fill, stroke, lw = 3) {
  g.beginPath(); g.roundRect(x, y, w, h, r)
  if (fill) { g.fillStyle = fill; g.fill() }
  if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke() }
}
export function label(g, s, x, y, size, color, { font = 'IBM Plex Mono', weight = 600, align = 'left', track = 3 } = {}) {
  g.font = `${weight} ${size}px '${font}'`; g.fillStyle = color; g.textAlign = align; g.letterSpacing = `${track}px`; g.fillText(s, x, y); g.letterSpacing = '0px'; g.textAlign = 'left'
}
/** A person, head and shoulders. */
export function avatar(g, x, y, s, color, alpha = 1) {
  if (alpha <= 0.01) return
  g.save(); g.globalAlpha *= alpha; g.fillStyle = color
  g.beginPath(); g.arc(x, y - 12 * s, 9 * s, 0, Math.PI * 2); g.fill()
  g.beginPath(); g.arc(x, y + 14 * s, 15 * s, Math.PI, 0); g.fill(); g.restore()
}
/** A banknote. */
export function note(g, c, x, y, rot) {
  g.save(); g.translate(x, y); g.rotate(rot)
  rr(g, -95, -44, 190, 88, 8, c.mint, c.ink, 3); g.strokeStyle = c.ink; g.lineWidth = 3; g.strokeRect(-80, -32, 160, 64)
  g.fillStyle = c.ink; g.beginPath(); g.arc(0, 0, 18, 0, Math.PI * 2); g.fill(); g.restore()
}
