// A notification for each number: [time, words, colour]; each shows for 2.4 s. Box 800 x 150.
import { rr, label } from '../_kit.mjs'

export function draw(g, t, p) {
  const { c, W, H } = p
  const cur = p.items.filter(([s]) => t >= s && t < s + 2.4).at(-1)
  if (!cur) return
  rr(g, 6, 6, W - 12, H - 12, 36, c.ink, cur[2], 5)
  g.fillStyle = cur[2]; g.beginPath(); g.arc(70, H / 2, 20, 0, Math.PI * 2); g.fill()
  label(g, cur[1], 120, H / 2 + 18, 44, c.cream, { weight: 700, track: 2 })
}
/** How far the toast panel is in, 0 to 1, for the frame's lift. */
export function on(t, p) {
  const { e } = p
  const k = (x) => Math.max(0, Math.min(1, x))
  return Math.max(...p.items.map(([s]) => e.enter(k((t - s) / 0.35)) * (1 - e.exit(k((t - s - 2.1) / 0.3)))))
}
