// The task copies itself: one slab lifts off a tower and turns mint, then makes four copies in the space it freed.
import { clamp, lerp } from '../_kit.mjs'

export function update(slabs, t, p, tokens = p.c) {
  p = { ...p, c: tokens }
  const { e } = p, T = p.times
  const kp = e.hero(clamp((t - T.lift) / 0.9))
  slabs.forEach((m, i) => {
    if (i === 0) { m.visible = kp > 0; m.position.set(lerp(p.from[0], 0, kp), lerp(p.from[1], 4.4, kp), p.z); m.rotation.y = kp * 0.5; return }
    const k = e.hero(clamp((t - T.copies - (i - 1) * 0.22) / 0.6))
    m.visible = k > 0
    const ang = -0.6 + (i - 1) * 0.4
    m.position.set(lerp(0, Math.sin(ang) * 3.4, k), lerp(4.4, 4.4 + (i - 1) * 0.55 + 0.6, k), p.z + lerp(0, -1.2, k)); m.rotation.y = 0.5 + ang * 0.6
  })
  return kp
}
