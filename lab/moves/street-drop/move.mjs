// The street drop: copies of the object rise into a street, then the new ones drop in from above (a percentage
// made visible). Updates three.js groups placed at their .home.
import { clamp, lerp } from '../_kit.mjs'

export function update(street, t, p) {
  const { e } = p, T = p.times
  street.forEach((b, i) => {
    const drop = i >= p.first ? e.hero(clamp((t - T.more - (i - p.first) * 0.18) / 0.55)) : e.hero(clamp((t - T.first - i * 0.05) / 0.6))
    b.group.position.set(b.home.x, lerp(9, 0, drop), b.home.z)
    b.group.visible = drop > 0.01 && t < T.end
    b.windows.forEach((w) => { w.glass.material.emissiveIntensity = i >= p.first ? 1.6 : 1.1; w.head.visible = w.sh.visible = false })
  })
}
