export type Point = readonly [number, number]
export type Target = { x: number; y: number; w: number; h: number }
export type ScribbleSpec =
  | ({ shape: 'loop'; turns?: number | undefined; sq?: number | undefined } &
      ({ cx: number; cy: number; u: Point; v: Point } | { target: Target }))
  | ({ shape: 'underline'; amp?: number | undefined; double?: boolean | undefined } &
      ({ from: Point; to: Point } | { target: Target }))
  | { shape: 'arrow'; from: Point; to: Point; bend?: number | undefined; head?: number | undefined }
  | { shape: 'bracket'; x: number; y0: number; y1: number; depth?: number | undefined; side?: 1 | -1 | undefined }
  | { shape: 'tick' | 'cross'; cx: number; cy: number; size: number }

/** FNV-1a string hash feeding mulberry32. No process/global random state. */
function random(seed: string) {
  let value = 2166136261
  for (let i = 0; i < seed.length; i++) value = Math.imul(value ^ seed.charCodeAt(i), 16777619)
  return () => {
    value = (value + 0x6D2B79F5) | 0
    let t = Math.imul(value ^ (value >>> 15), value | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const point = (p: Point) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`

/** Catmull-Rom to cubic Bezier, ported from H/build.py::_smooth. */
function smooth(pts: Point[]): string {
  if (pts.length < 3) return `M${point(pts[0]!)} L${point(pts.at(-1)!)}`
  let d = `M${point(pts[0]!)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]!, p1 = pts[i]!, p2 = pts[i + 1]!, p3 = pts[Math.min(i + 2, pts.length - 1)]!
    const c1: Point = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6]
    const c2: Point = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6]
    d += ` C${point(c1)} ${point(c2)} ${point(p2)}`
  }
  return d
}

/** Approved H/build.py geometry, in full-canvas pixels, with seeded wobble. */
export function scribblePath(spec: ScribbleSpec, seed: string): string {
  const rng = random(seed)
  if (spec.shape === 'loop') {
    const { cx, cy, u, v } = 'target' in spec
      ? { cx: spec.target.x + spec.target.w / 2, cy: spec.target.y + spec.target.h / 2,
          u: [spec.target.w * 0.55, 0], v: [0, spec.target.h * 0.55] }
      : spec
    const ph = [rng() * 6.28, rng() * 6.28, rng() * 6.28]
    const pts: Point[] = [], steps = 44, turns = spec.turns ?? 1.16, sq = spec.sq ?? 2
    for (let i = 0; i <= Math.floor(steps * turns); i++) {
      const t = i / steps, a = -2.3 + 2 * Math.PI * t
      const w = 1 + 0.05 * Math.sin(2 * a + ph[0]!) + 0.035 * Math.sin(3 * a + ph[1]!) + 0.02 * Math.sin(5 * a + ph[2]!)
      const g = 1 + 0.13 * t, c = Math.cos(a), s = Math.sin(a)
      const x = w * g * Math.sign(c) * Math.abs(c) ** (2 / sq), y = w * g * Math.sign(s) * Math.abs(s) ** (2 / sq)
      pts.push([cx + x * u[0]! + y * v[0]!, cy + x * u[1]! + y * v[1]!])
    }
    return smooth(pts)
  }
  if (spec.shape === 'underline' || spec.shape === 'arrow') {
    const { from, to } = 'target' in spec
      ? { from: [spec.target.x, spec.target.y + spec.target.h + 10], to: [spec.target.x + spec.target.w, spec.target.y + spec.target.h + 10] }
      : spec
    const [x0, y0] = from as Point, [x1, y1] = to as Point
    const length = Math.hypot(x1 - x0, y1 - y0)
    if (!length) return smooth([[x0, y0], [x1, y1]])
    const ux = (x1 - x0) / length, uy = (y1 - y0) / length, nx = -uy, ny = ux
    if (spec.shape === 'underline') {
      const amp = spec.amp ?? 7, ph = rng() * 6.28
      const stroke = (off: number, a0: number, over: number) => {
        const pts: Point[] = [], n = Math.max(12, Math.floor(length / 22))
        for (let i = 0; i <= n; i++) {
          const t = i / n, s = -over + t * (length + 2 * over)
          const wob = amp * Math.sin(t * 2.5 * 2 * Math.PI + ph + a0) * (0.55 + 0.45 * Math.sin(t * 3.1 + a0))
          pts.push([x0 + ux * s + nx * (wob + off), y0 + uy * s + ny * (wob + off)])
        }
        return pts
      }
      const first = stroke(0, 0.3, 10)
      if (spec.double === false) return smooth(first)
      const end = first.at(-1)!
      return smooth([...first, [end[0] + ux * 16 + nx * amp * 1.2, end[1] + uy * 16 + ny * amp * 1.2], ...stroke(amp * 2.3, 1.9, 4).reverse()])
    }
    const pts: Point[] = []
    for (let i = 0; i <= 16; i++) {
      const t = i / 16, off = (spec.bend ?? 60) * Math.sin(t * Math.PI) + 4 * Math.sin(t * 17 + rng())
      pts.push([x0 + (x1 - x0) * t + nx * off, y0 + (y1 - y0) * t + ny * off])
    }
    // Pin the shaft to its authored destination; the Python head already uses it exactly.
    pts[16] = [x1, y1]
    const a = Math.atan2(y1 - pts[14]![1], x1 - pts[14]![0]), head = spec.head ?? 46
    const h1: Point = [x1 - head * Math.cos(a - 0.5), y1 - head * Math.sin(a - 0.5)]
    const h2: Point = [x1 - head * Math.cos(a + 0.5), y1 - head * Math.sin(a + 0.5)]
    return `${smooth(pts)} M${point(h1)} L${point([x1, y1])} L${point(h2)}`
  }
  if (spec.shape === 'bracket') {
    const { x, y0, y1 } = spec, depth = (spec.depth ?? 44) * (spec.side ?? 1), mid = (y0 + y1) / 2
    const pts: Point[] = [[x, y0], [x + depth * 0.55, y0 + 10], [x + depth * 0.62, y0 + (mid - y0) * 0.55],
      [x + depth * 0.5, mid - 12], [x + depth * 1.25, mid], [x + depth * 0.5, mid + 12],
      [x + depth * 0.62, mid + (y1 - mid) * 0.45], [x + depth * 0.55, y1 - 10], [x, y1]]
    return smooth(pts.map(([x, y]) => [x + rng() * 5 - 2.5, y + rng() * 5 - 2.5]))
  }
  const { cx, cy, size } = spec
  const wobble = (pts: Point[]) => smooth(pts.map(([x, y]) => [cx + x * size + rng() * 5 - 2.5, cy + y * size + rng() * 5 - 2.5]))
  if (spec.shape === 'tick') return wobble([[-0.5, 0], [-0.15, 0.4], [0.5, -0.5]])
  return `${wobble([[-0.5, -0.5], [0, 0], [0.5, 0.5]])} ${wobble([[-0.5, 0.5], [0, 0], [0.5, -0.5]])}`
}
