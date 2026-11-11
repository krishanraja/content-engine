// The count on a part: the parts of one object (a branch's windows) light one by one to the spoken number, the
// leavers go dark on the drop, everything dims on a "disappear" and returns. Updates three.js window meshes.
import { clamp } from '../_kit.mjs'

export function update(windows, t, p) {
  const { c, e } = p, T = p.times
  const ghost = clamp((t - T.ghost) / 0.6) * (1 - clamp((t - T.ghostEnd) / 0.3))
  windows.forEach((w, i) => {
    const on = clamp((t - (T.countStart + (T.countLand - T.countStart) * (i / p.from))) / 0.18)
    const off = i >= p.to ? e.exit(clamp((t - T.drop - (i - p.to) * 0.04) / 0.2)) : 0
    const first = i === (p.firstIndex ?? -1) ? e.enter(clamp((t - T.first) / 0.4)) : 0
    const k = Math.max(on, first) * (1 - off) * (1 - 0.75 * ghost)
    w.glass.material.emissiveIntensity = 0.05 + 1.5 * k
    w.glass.material.color.set(k > 0.02 ? c.channel : c.inkSoft)
    w.head.visible = w.sh.visible = k > 0.4
  })
}
