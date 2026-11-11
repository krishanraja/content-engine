// One giant number on a dark stage, lit from above: a slow band of light sweeps across its face, and its reflection
// fades into the floor. The number arrives by rising out of the floor and leaves by sinking back.
// p: { c, e, str, x, y (baseline), size, color, at, out, sweep (time the light crosses), floor (y of the floor), font }
import { clamp } from '../_kit.mjs'
const layers = new Map(), reflections = new Map()

function face(g, p, str, x, y, fill) {
  g.font = `${p.size}px '${p.font ?? 'Anton'}'`; g.textAlign = 'center'; g.fillStyle = fill; g.fillText(str, x, y)
}

export function draw(g, t, p) {
  const { c, e } = p
  const k = e.hero(clamp((t - p.at) / 0.7)), o = p.out != null ? e.exit(clamp((t - p.out) / 0.45)) : 0
  if (k <= 0 || o >= 1) return
  g.font = `${p.size}px '${p.font ?? 'Anton'}'`
  const w = g.measureText(p.str).width, asc = p.size * 0.86
  const y = p.y + (1 - k) * asc * 0.35 + o * asc * 0.35, a = k * (1 - o)
  // Body: a vertical gradient, lighter at the top where the key light falls.
  const body = g.createLinearGradient(0, y - asc, 0, y)
  body.addColorStop(0, p.color); body.addColorStop(1, p.shade ?? c.muted)
  g.save(); g.globalAlpha = a
  g.shadowColor = p.glow ?? 'rgba(244,239,228,0.18)'; g.shadowBlur = 60
  face(g, p, p.str, p.x, y, body); g.shadowColor = 'transparent'
  // The sweep: a narrow bright band, clipped to the glyphs by drawing with source-atop on an offscreen layer.
  const s = clamp((t - p.sweep) / (p.sweepDur ?? 1.6))
  if (s > 0 && s < 1) {
    const L = layers.get(p.str) ?? layers.set(p.str, document.createElement('canvas')).get(p.str); L.width = Math.ceil(w + 200); L.height = Math.ceil(asc * 1.3)
    const lg = L.getContext('2d'); lg.clearRect(0, 0, L.width, L.height)
    face(lg, p, p.str, L.width / 2, asc * 1.1, '#fff'); lg.globalCompositeOperation = 'source-in'
    const bx = -L.width * 0.3 + s * L.width * 1.6
    const band = lg.createLinearGradient(bx - 160, 0, bx + 160, L.height * 0.4)
    band.addColorStop(0, 'rgba(255,255,255,0)'); band.addColorStop(0.5, 'rgba(255,255,255,0.85)'); band.addColorStop(1, 'rgba(255,255,255,0)')
    lg.fillStyle = band; lg.fillRect(0, 0, L.width, L.height)
    g.drawImage(L, p.x - L.width / 2, y - asc * 1.1)
  }
  // The reflection: flipped onto the floor through a gradient mask, so it fades to nothing with no edge.
  if (p.floor != null) {
    const R = reflections.get(p.str) ?? reflections.set(p.str, document.createElement('canvas')).get(p.str)
    const rh = Math.ceil(asc * 0.6); R.width = Math.ceil(w + 120); R.height = rh
    const rg = R.getContext('2d'); rg.clearRect(0, 0, R.width, rh)
    // Mirror about the floor: a point h above the floor lands h below it (layer row 0 is the floor line).
    rg.save(); rg.scale(1, -1); face(rg, p, p.str, R.width / 2, y - p.floor, p.color); rg.restore()
    rg.globalCompositeOperation = 'destination-in'
    const m = rg.createLinearGradient(0, 0, 0, rh); m.addColorStop(0, 'rgba(0,0,0,1)'); m.addColorStop(1, 'rgba(0,0,0,0)')
    rg.fillStyle = m; rg.fillRect(0, 0, R.width, rh)
    g.globalAlpha = a * (p.reflect ?? 0.12); g.drawImage(R, p.x - R.width / 2, p.floor)
  }
  g.restore()
}
