// Two towers of slabs, the two things that moved: one loses slabs that slide out and fall under gravity, one gains
// slabs that drop on; "watch" turns the second mint. Updates two arrays of three.js meshes.
import { clamp, lerp } from '../_kit.mjs'

export function update(towers, t, p, tokens = p.c) {
  p = { ...p, c: tokens }
  const { e } = p, T = p.times, [a, b] = p.xs, z = p.z
  const tw = t >= T.show
  const watch = e.enter(clamp((t - T.watch) / 0.4))
  towers[0].forEach((m, s) => {
    m.visible = tw; m.position.set(a, 0.13 + s * 0.26, z); m.rotation.z = 0
    if (s >= p.left[1]) {
      const u = clamp((t - T.fall - (p.left[0] - 1 - s) * 0.08) / 0.7)
      m.visible = tw && u < 1
      m.position.x = a - 3 * u; m.position.y = 0.13 + s * 0.26 - 4.9 * (u * 0.7) ** 2; m.rotation.z = u * 0.9
    }
  })
  towers[1].forEach((m, s) => {
    const up = clamp((t - T.grow - (s - p.right[0]) * 0.15) / 0.5)
    m.visible = tw && (s < p.right[0] || (s < p.right[1] && up > 0))
    m.position.set(b, s < p.right[0] ? 0.13 + s * 0.26 : lerp(6, 0.13 + s * 0.26, e.hero(up)), z)
    m.material = watch > 0.5 ? p.mats.lit : p.mats.plain
  })
}
