// A real source on a paper card: a hand-drawn circle draws round the line that matters, then a loupe lifts it to
// twice its size beside the card. The source image is never redrawn or retyped: it is the captured page.
// p: { c, e, img, box: [x, y, w, h] in image pixels, card: [x, y, s, rot] where the image lands, times: { circle, magnify, out },
//      point: the pointer colour, loupe: [x, y, r] or null, under: true for an underline instead of a circle }
import { clamp } from '../_kit.mjs'

/** A wobbly, hand-drawn ellipse round a box, drawn on to fraction k (a little past a full turn, like a pen). */
export function handCircle(g, x, y, w, h, k, color, lw = 8, seed = 1) {
  if (k <= 0) return
  const cx = x + w / 2, cy = y + h / 2, rx = w / 2 + 26, ry = h / 2 + 20, turns = 1.12, n = 90
  g.save(); g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath()
  for (let i = 0; i <= Math.floor(n * k); i++) {
    const a = -2.3 + (i / n) * turns * Math.PI * 2
    const wob = 1 + 0.035 * Math.sin(a * 3 + seed) + 0.02 * Math.sin(a * 7 + seed * 2) + 0.05 * (i / n)
    const px = cx + Math.cos(a) * rx * wob, py = cy + Math.sin(a) * ry * wob
    i ? g.lineTo(px, py) : g.moveTo(px, py)
  }
  g.stroke(); g.restore()
}

/** A hand underline under one or more line boxes, drawn left to right. */
export function handUnderline(g, boxes, k, color, lw = 9) {
  const total = boxes.reduce((s, b) => s + b[2], 0); let left = total * clamp(k)
  g.save(); g.strokeStyle = color; g.lineWidth = lw; g.lineCap = 'round'
  for (const [x, y, w, h] of boxes) {
    if (left <= 0) break
    const d = Math.min(w, left); left -= d
    g.beginPath(); g.moveTo(x - 4, y + h + 6); g.quadraticCurveTo(x + d / 2, y + h + 12, x + d, y + h + 5); g.stroke()
  }
  g.restore()
}

export function draw(g, t, p, tokens = p.c) {
  p = { ...p, c: tokens }
  const { c, e, img, box, times: T } = p
  const [cx, cy, s, rot] = p.card
  const out = T.out != null ? e.exit(clamp((t - T.out) / 0.4)) : 0
  // The mark on the page, drawn in the card's own frame so it moves with the card.
  g.save(); g.translate(cx, cy); g.rotate(rot); g.scale(s, s)
  const k = e.utility(clamp((t - T.circle) / 0.7)) * (1 - out)
  if (p.under) handUnderline(g, p.under, k, p.point, 9 / s * 0.9)
  else handCircle(g, box[0], box[1], box[2], box[3], k, p.point, 8 / s * 0.9, p.seed ?? 1)
  g.restore()
  // The strip: the whole line lifted off the page at two to three times its size, on a cream slip with a shadow, so
  // the sentence is read whole (a round lens crops it).
  if (p.strip && img) return strip(g, t, p)
  // The loupe: the same pixels at twice the size, in a lens with a cream rim, lifted on a shadow.
  if (!p.loupe || !img) return
  const m = e.hero(clamp((t - T.magnify) / 0.6)) * (1 - out)
  if (m <= 0.01) return
  const [lx, ly, lr] = p.loupe, r = lr * (0.6 + 0.4 * m)
  g.save(); g.globalAlpha = m
  g.shadowColor = 'rgba(0,0,0,0.55)'; g.shadowBlur = 50; g.shadowOffsetY = 24
  g.fillStyle = c.cream; g.beginPath(); g.arc(lx, ly, r + 12, 0, Math.PI * 2); g.fill(); g.shadowColor = 'transparent'
  g.beginPath(); g.arc(lx, ly, r, 0, Math.PI * 2); g.clip()
  g.fillStyle = 'white'; g.fillRect(lx - r, ly - r, r * 2, r * 2)
  const z = (p.zoom ?? 2) * s, bx = box[0] + box[2] / 2, by = box[1] + box[3] / 2
  g.drawImage(img, lx - bx * z, ly - by * z, img.width * z, img.height * z)
  // The circle continues inside the lens, so the eye joins the two.
  g.translate(lx - bx * z, ly - by * z); g.scale(z, z)
  if (p.under) handUnderline(g, p.under, 1, p.point, 6 / z * 2)
  else handCircle(g, box[0], box[1], box[2], box[3], 1, p.point, 5 / z * 2, p.seed ?? 1)
  g.restore()
  g.save(); g.globalAlpha = m; g.strokeStyle = c.ink; g.lineWidth = 4; g.beginPath(); g.arc(lx, ly, r + 12, 0, Math.PI * 2); g.stroke()
  // A soft highlight across the glass.
  const hl = g.createLinearGradient(lx - r, ly - r, lx + r, ly + r); hl.addColorStop(0, 'rgba(255,255,255,0.18)'); hl.addColorStop(0.45, 'rgba(255,255,255,0)')
  g.fillStyle = hl; g.beginPath(); g.arc(lx, ly, r, 0, Math.PI * 2); g.fill(); g.restore()
}

function strip(g, t, p) {
  const { c, e, img, box, times: T } = p
  const m = e.hero(clamp((t - T.magnify) / 0.55)) * (1 - (T.out != null ? e.exit(clamp((t - T.out) / 0.4)) : 0))
  if (m <= 0.01) return
  const [sx, sy, sw] = p.strip, pad = 34, z = (sw - 60) / (box[2] + pad * 2), sh = (box[3] + 64) * z
  g.save(); g.globalAlpha = m; g.translate(sx, sy + (1 - m) * 40); g.rotate((p.tilt ?? -0.012) * m); g.scale(0.92 + 0.08 * m, 0.92 + 0.08 * m)
  g.shadowColor = 'rgba(0,0,0,0.6)'; g.shadowBlur = 60; g.shadowOffsetY = 28
  g.fillStyle = c.paper ?? 'rgb(251,249,244)'; g.fillRect(-sw / 2, -sh / 2, sw, sh); g.shadowColor = 'transparent'
  g.beginPath(); g.rect(-sw / 2, -sh / 2, sw, sh); g.clip()
  const bx = box[0] + box[2] / 2, by = box[1] + box[3] / 2
  g.translate(-bx * z, -by * z); g.scale(z, z)
  // Only the line itself is lifted: the lines above and below stay on the page.
  g.save(); g.beginPath(); g.rect(box[0] - 12, box[1] - 3, box[2] + 24, box[3] + 6); g.clip()
  g.globalCompositeOperation = 'multiply'; g.drawImage(img, 0, 0); g.restore()
  if (p.under) handUnderline(g, p.under, 1, p.point, 9 / z)
  else handCircle(g, box[0], box[1], box[2], box[3], 1, p.point, 9 / z, p.seed ?? 1)
  g.restore()
  g.save(); g.globalAlpha = m; g.translate(sx, sy + (1 - m) * 40); g.rotate((p.tilt ?? -0.012) * m)
  g.fillStyle = p.point; g.fillRect(-sw / 2, -sh / 2, 10, sh); g.restore()
}
