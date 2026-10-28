export interface Point { x: number; y: number }

/** Seeded hand wobble; local because this checkout has no scribblePath helper. */
function mulberry32(seed: number) {
  return () => {
    let n = seed += 0x6D2B79F5
    n = Math.imul(n ^ n >>> 15, n | 1)
    n ^= n + Math.imul(n ^ n >>> 7, n | 61)
    return ((n ^ n >>> 14) >>> 0) / 4294967296
  }
}

/** Cubic S-curve. The seed changes handles, never the authored endpoints. */
export function weave(from: Point, to: Point, opts: { seed?: number; wobble?: number } = {}): string {
  const rng = mulberry32(opts.seed ?? 1)
  const wobble = opts.wobble ?? 6
  const dx = to.x - from.x, dy = to.y - from.y
  const length = Math.hypot(dx, dy) || 1
  const bend = wobble * (0.5 + rng()), hand = wobble * (rng() - 0.5) * 0.3
  return `M ${from.x} ${from.y} C ${from.x + dx * 0.42 - dy / length * (bend + hand)} ${from.y + dy * 0.42 + dx / length * (bend + hand)}, ${to.x - dx * 0.32 + dy / length * bend} ${to.y - dy * 0.32 - dx / length * bend}, ${to.x} ${to.y}`
}

/** P's sampled sinusoidal rope, returned as two opposite-phase strands. */
export function twisted(x: number, y0: number, y1: number, phase = 0, amp = 9, period = 96): [string, string] {
  if (period <= 0) throw new Error('Rope period must be positive')
  const steps = Math.max(80, Math.ceil(Math.abs(y1 - y0) / period * 24))
  const strand = (offset: number) => Array.from({ length: steps + 1 }, (_, i) => {
    const y = y0 + (y1 - y0) * i / steps
    return `${i ? 'L' : 'M'} ${x + amp * Math.sin(2 * Math.PI * (y - y0) / period + offset)} ${y}`
  }).join(' ')
  return [strand(phase), strand(phase + Math.PI)]
}

/** H's parted thread: neither segment enters the ring's clearance disc. */
export function parted(from: Point, to: Point, gap: { center: Point; radius: number; clearance?: number }) {
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy)
  if (!length || gap.radius <= 0) throw new Error('Parted thread needs a span and positive ring radius')
  const ux = dx / length, uy = dy / length
  const along = (gap.center.x - from.x) * ux + (gap.center.y - from.y) * uy
  const distance = gap.radius + (gap.clearance ?? 34)
  if (along < distance || along + distance > length || Math.abs((gap.center.x - from.x) * uy - (gap.center.y - from.y) * ux) > 0.001) {
    throw new Error('Ring clearance must fit on the thread')
  }
  const left = { x: gap.center.x - ux * distance, y: gap.center.y - uy * distance }
  const right = { x: gap.center.x + ux * distance, y: gap.center.y + uy * distance }
  return { paths: [`M ${from.x} ${from.y} L ${left.x} ${left.y}`, `M ${right.x} ${right.y} L ${to.x} ${to.y}`],
    ring: { ...gap.center, radius: gap.radius }, left, right }
}

/** H FLAG in coordinates relative to its pole foot. */
export function pennant(planted: boolean, h = 84) {
  return { pole: `M 0 0 L 0 ${-h}`, flag: `M 0 ${10 - h} Q 23 ${2 - h} 45 ${13 - h} L 32 ${24 - h} L 45 ${36 - h} Q 23 ${44 - h} 0 ${36 - h} Z`,
    planted, dash: planted ? undefined : '5 6', opacity: planted ? 1 : 0.55 }
}
