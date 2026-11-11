// The level line: a mint bar draws across the ground to say "held level". Updates one three.js mesh.
import { clamp } from '../_kit.mjs'

export function update(line, t, p) {
  const k = p.e.enter(clamp((t - p.times.start) / 0.7))
  line.scale.x = Math.max(0.001, k); line.visible = k > 0.01 && t < p.times.end
  return k
}
