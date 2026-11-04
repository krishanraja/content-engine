import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { CANVAS, SCRIBBLE, ZONES } from './lock'
import { scribblePath, type ScribbleSpec } from './scribblePath'
import { ENTER, progress, setMotionProfile } from '../clock'
import { MOTION_PROFILES, MotionProfileSchema, NEEDS_DEVICE, clampToFloor, floorProblems, resolveMotion } from './motionProfiles'
import { entranceStyle, revealChars, revealLines } from './reveal'

const lock = JSON.parse(readFileSync('config/ve/design-lock.json', 'utf8'))
const coords = (d: string) => (d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number)
const examples: ScribbleSpec[] = [
  { shape: 'loop', target: { x: 300, y: 400, w: 400, h: 200 } },
  { shape: 'underline', from: [200, 600], to: [800, 600] },
  { shape: 'arrow', from: [200, 500], to: [800, 700] },
  { shape: 'bracket', x: 300, y0: 500, y1: 900 },
  { shape: 'tick', cx: 500, cy: 700, size: 100 },
  { shape: 'cross', cx: 500, cy: 700, size: 100 },
]

describe('design lock constants', () => {
  it('matches every copied constant against the frozen JSON', () => {
    expect(CANVAS).toEqual(lock.canvas)
    expect(SCRIBBLE).toEqual(lock.scribble)
    expect(ZONES).toEqual(lock.zones)
  })
})
describe('approved scribble paths', () => {
  it.each(examples)('is deterministic and finite for $shape', spec => {
    const d = scribblePath(spec, 'one')
    expect(d).toBe(scribblePath(spec, 'one'))
    expect(d).not.toBe(scribblePath(spec, 'two'))
    expect(d.startsWith('M')).toBe(true)
    expect(d).not.toMatch(/NaN|Infinity/)
  })
  it('keeps loop control points within a target grown by 25 percent on each edge', () => {
    for (let seed = 0; seed < 100; seed++) {
      const points = coords(scribblePath(examples[0]!, String(seed)))
      points.forEach((n, i) => {
        expect(n).toBeGreaterThanOrEqual(i % 2 ? 350 : 200)
        expect(n).toBeLessThanOrEqual(i % 2 ? 650 : 800)
      })
    }
  })
  it('continues past a full revolution and grows beyond its starting radius', () => {
    const d = scribblePath({ shape: 'loop', cx: 0, cy: 0, u: [100, 0], v: [0, 100] }, 'one')
    expect(d.match(/ C/g)).toHaveLength(Math.floor(44 * 1.16))
    const p = coords(d)
    expect(Math.hypot(...p.slice(-2) as [number, number])).toBeGreaterThan(Math.hypot(p[0]!, p[1]!))
  })
  it('keeps the single underline within 20 px, and ports the double return pass', () => {
    const spec = { shape: 'underline', from: [200, 600], to: [800, 600] } as const
    for (let seed = 0; seed < 30; seed++) {
      coords(scribblePath({ ...spec, double: false }, String(seed))).forEach((n, i) => {
        if (i % 2) expect(Math.abs(n - 600)).toBeLessThan(20)
      })
    }
    expect(scribblePath(spec, 'one').match(/ C/g)!.length).toBeGreaterThan(scribblePath({ ...spec, double: false }, 'one').match(/ C/g)!.length)
    expect(scribblePath({ shape: 'underline', target: { x: 200, y: 400, w: 600, h: 190 } }, 'one')).toBe(scribblePath(spec, 'one'))
  })
  it('ends the arrow shaft at its destination and adds the reference head', () => {
    const d = scribblePath(examples[2]!, 'one')
    expect(d.split(' M')[0]).toMatch(/800\.0 700\.0$/)
    expect(d).toMatch(/ M[-\d.]+ [-\d.]+ L800\.0 700\.0 L[-\d.]+ [-\d.]+$/)
  })
  it('handles a skewed loop, either bracket side and degenerate lines without NaN', () => {
    for (const spec of [
      { shape: 'loop', cx: 500, cy: 600, u: [100, 30], v: [20, 200], sq: 3 },
      { shape: 'bracket', x: 300, y0: 500, y1: 900, side: -1 },
      { shape: 'arrow', from: [1, 1], to: [1, 1] },
      { shape: 'underline', from: [1, 1], to: [1, 1] },
    ] as ScribbleSpec[]) expect(scribblePath(spec, 'one')).not.toMatch(/NaN|Infinity/)
  })
})

describe('motion style profiles', () => {
  const bank = (JSON.parse(readFileSync('config/style-references.json', 'utf8')).bank as Array<{ id: string; layer: string; ve_route: string[] }>)
    .filter(style => style.layer === 'motion')

  it('draws every motion style a profile can express, and names the seven that need their own device', () => {
    const drawable = bank.filter(style => !style.ve_route.includes('needs_device')).map(style => style.id).sort()
    expect(Object.keys(MOTION_PROFILES).sort()).toEqual(drawable)
    expect(drawable).toHaveLength(10)
    expect([...NEEDS_DEVICE].sort()).toEqual(bank.filter(style => style.ve_route.includes('needs_device')).map(style => style.id).sort())
    expect(NEEDS_DEVICE).toHaveLength(7)
  })

  it.each(Object.entries(MOTION_PROFILES))('%s parses and sits inside the signed floor', (id, profile) => {
    expect(MotionProfileSchema.parse(profile)).toEqual(profile)
    expect(floorProblems(profile)).toEqual([])
    expect(clampToFloor(profile)).toEqual(profile)
    expect(profile.entrance.frames).toBeGreaterThanOrEqual(4)
    expect(profile.entrance.frames).toBeLessThanOrEqual(7)
    expect(profile.entrance.distancePx).toBeGreaterThanOrEqual(40)
    expect(profile.entrance.distancePx).toBeLessThanOrEqual(60)
    expect(profile.entrance.overshootPct).toBeLessThanOrEqual(6)
    expect(profile.driftPct).toBeGreaterThan(0)
    expect(['house', 'inkDeep', 'dark']).toContain(profile.ground.kind) // brand roles only
    if (profile.boil) expect(profile.boil.amplitudePx).toBeLessThanOrEqual(2) // line-boil's bank rule
    if (profile.captions?.mode === 'lead') expect(profile.captions.wordsPerCard).toBeGreaterThanOrEqual(2)
    expect(resolveMotion({ style: id })).toEqual(profile)
  })

  it('pulls an out-of-floor profile inside it and refuses an unknown style', () => {
    const wild = { ...MOTION_PROFILES['swiss-kinetic-type']!,
      entrance: { kind: 'rise' as const, frames: 20, easing: 'enter' as const, distancePx: 300, overshootPct: 40 }, driftPct: 0 }
    expect(floorProblems(wild).length).toBeGreaterThanOrEqual(4)
    const held = clampToFloor(wild)
    expect(floorProblems(held)).toEqual([])
    expect(resolveMotion({ style: 'swiss-kinetic-type', profile: wild })).toEqual(held)
    expect(resolveMotion(undefined)).toBeUndefined()
    expect(resolveMotion({ style: 'toy-3d' })).toBeUndefined()
    expect(() => resolveMotion({ style: 'not-a-style' })).toThrow('unknown motion style')
  })

  it('makes no motion style reveal type exactly as before styles rendered', () => {
    setMotionProfile(undefined)
    for (const p of [0, 0.25, 0.5, 1]) expect(entranceStyle(p)).toEqual({ opacity: p, transform: `translateY(${24 * (1 - p)}px)` })
    const lines = revealLines(['ONE TWO', 'THREE'], 4)
    expect(lines.map(line => line.p)).toEqual([progress(4, 12, ENTER), progress(1, 12, ENTER)])
    expect(lines.flatMap(line => line.words)).toEqual([{ p: 1, chars: 3 }, { p: 1, chars: 3 }, { p: 1, chars: 5 }])
    expect(revealChars('find me', 0)).toBe(7)
  })

  it('reveals by word, types and rolls under a style', () => {
    try {
      setMotionProfile(MOTION_PROFILES['swiss-kinetic-type'])
      expect(revealLines(['ONE TWO'], 3)[0]!.words.map(w => w.p)).toEqual([progress(3, 5, ENTER), 0])
      expect(entranceStyle(0).transform).toBe('translateX(-48px)')
      setMotionProfile(MOTION_PROFILES['hud-terminal'])
      // 32 characters a second: 15 frames type 16 characters.
      expect(revealChars('a query that is long enough', 15)).toBe(16)
      expect(revealLines(['AB CD'], 2)[0]!.words).toEqual([{ p: 1, chars: 2 }, { p: 0, chars: 0 }])
      setMotionProfile(MOTION_PROFILES['data-story'])
      expect(revealLines(['A', 'B'], 1).every(line => line.roll)).toBe(true)
    } finally {
      setMotionProfile(undefined)
    }
  })
})
