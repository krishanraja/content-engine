import { readFileSync } from 'node:fs'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { BrandFrame } from '../BrandFrame'
import { FormatMaster } from '../FormatMaster'
import { setMotionProfile } from '../clock'
import { CAPTION_THEMES } from '../captions/names'
import { REGIONS, band } from '../captions/kit'
import { EngineRenderPropsSchema, type EngineRenderProps } from '../props'
import { CAMERAS, ENERGIES, FOCUS_SCALE, LEAD_AFTER, LEAD_BEFORE, LEAD_TRANSITIONS, LIVING_DRIFT, MAX_BLUR_PX, TRANSITIONS, TRANSITION_FRAMES,
  cameraAt, cameraStyle, flashAt, hitFrames, leadMoveAt, leads, type CameraState, type EngineIngredients } from './ingredients'

const clockFrame = vi.hoisted(() => ({ value: 0 }))
vi.mock('../clock', async (importOriginal) => ({ ...await importOriginal<typeof import('../clock')>(), useEngineFrame: () => clockFrame.value }))
afterEach(() => setMotionProfile(undefined))

/** The ingredients chosen apart from the motion style (Krish, 2026-11-13: "the captions should be decoupled from the
 *  animation styles ... the motion is 10X too slow, not immersive and engaging at all"). docs/ve/INGREDIENTS.md. */

const beats = [{ fromFrame: 0, toFrame: 90 }, { fromFrame: 90, toFrame: 180 }]
const ing = (over: Partial<EngineIngredients> = {}): EngineIngredients => ({ energy: 'high', transition: 'cut', camera: 'none', hits: false, ...over })

describe('ingredients', () => {
  it('draw nothing when every ingredient is off', () => {
    for (let f = 0; f < 180; f += 7) {
      const s = cameraAt(ing(), beats, [], f, 1080)
      expect(cameraStyle(s, 1080, 1920)).toEqual({})
      expect(flashAt(ing(), beats, [], f)).toBe(0)
    }
  })

  it('hand over on the chosen transition, faster as the energy rises, and settle by its end', () => {
    for (const transition of ['whip', 'zoom-through', 'push', 'punch'] as const) {
      const at = (energy: EngineIngredients['energy'], f: number) => cameraAt(ing({ transition, energy }), beats, [], f, 1080)
      const moved = (s: ReturnType<typeof at>) => Math.abs(s.tx) + Math.abs(s.ty) + Math.abs(s.scale - 1) * 1000
      expect(moved(at('high', 90))).toBeGreaterThan(50)
      expect(moved(at('high', 96))).toBeLessThan(0.01)               // high: 6 frames
      expect(moved(at('calm', 96))).toBeGreaterThan(moved(at('high', 96)))
      expect(moved(at('high', 89))).toBeLessThan(0.01)               // nothing before the handover
    }
  })

  it('kick the camera on device events, with a shake only above calm, and never twice inside 3 frames', () => {
    expect(hitFrames([{ atFrame: 30 }, { atFrame: 31 }, { atFrame: 40 }])).toEqual([30, 40])
    const hit = (energy: EngineIngredients['energy'], f: number) => cameraAt(ing({ camera: 'punch', hits: true, energy }), beats, [30], f, 1080)
    expect(hit('high', 30).scale).toBeGreaterThan(hit('high', 29).scale + 0.05)
    expect(hit('calm', 30).scale - hit('calm', 29).scale).toBeLessThan(hit('high', 30).scale - hit('high', 29).scale)
    const drift = (f: number) => cameraAt(ing({ camera: 'punch', hits: true, energy: 'calm' }), beats, [], f, 1080)
    expect(hit('calm', 31).tx).toBeCloseTo(drift(31).tx, 6)          // calm: no shake
    expect(Math.abs(hit('high', 31).tx - drift(31).tx)).toBeGreaterThan(0)
  })

  it('keep headroom under any camera move, so no edge of the picture shows', () => {
    for (const camera of CAMERAS.filter((c) => c !== 'none')) {
      for (let f = 0; f < 180; f += 5) {
        const s = cameraAt(ing({ camera, energy: 'medium' }), beats, [], f, 1080)
        const room = (s.scale - 1) * 540
        expect(Math.abs(s.tx)).toBeLessThanOrEqual(room + 1e-6)
      }
    }
  })

  it('are the same on every render of a frame', () => {
    const a = cameraAt(ing({ camera: 'phased', hits: true, transition: 'whip' }), beats, [40, 100], 101, 1080)
    const b = cameraAt(ing({ camera: 'phased', hits: true, transition: 'whip' }), beats, [40, 100], 101, 1080)
    expect(a).toEqual(b)
  })

  it('name the same choices the spec and compile accept', async () => {
    const { readFileSync } = await import('node:fs')
    const compile = readFileSync('scripts/velib/compile.py', 'utf8')
    const spec = readFileSync('packages/contracts/src/production-spec.ts', 'utf8')
    for (const [list, name] of [[ENERGIES, 'ENERGIES'], [TRANSITIONS, 'TRANSITIONS'], [CAMERAS, 'CAMERAS']] as const) {
      expect(compile).toContain(`${name} = (${list.map((v) => `'${v}'`).join(', ')})`)
      expect(spec).toContain(list.map((v) => `'${v}'`).join(', '))
    }
    expect(spec).toContain(CAPTION_THEMES.map((v) => `'${v}'`).slice(-3).join(', '))
    expect(compile).toContain(`LEAD_TRANSITIONS = (${LEAD_TRANSITIONS.map((v) => `'${v}'`).join(', ')})`)
    expect(spec).toContain(`[${LEAD_TRANSITIONS.map((v) => `'${v}'`).join(', ')}]`)
  })
})

/** Whether a camera state still covers the whole canvas: every corner of the canvas maps back inside the picture. */
function covers(s: CameraState, width: number, height: number): boolean {
  const r = (s.rollDeg ?? 0) * Math.PI / 180
  for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    const x = cx * width / 2 - s.tx, y = cy * height / 2 - s.ty
    const u = (x * Math.cos(r) + y * Math.sin(r)) / s.scale, v = (-x * Math.sin(r) + y * Math.cos(r)) / s.scale
    if (Math.abs(u) > width / 2 + 1e-6 || Math.abs(v) > height / 2 + 1e-6) return false
  }
  return true
}

describe('the living drift (15 Nov 2026)', () => {
  it('keeps headroom times push at or under 1.05', () => {
    expect(LIVING_DRIFT.headroom * LIVING_DRIFT.push).toBeLessThanOrEqual(1.05)
    let top = 0
    for (let f = 0; f < 3000; f++) top = Math.max(top, cameraAt(ing({ camera: 'drift' }), beats, [], f, 1080).scale)
    expect(top).toBeLessThanOrEqual(1.05)
    expect(top).toBeGreaterThan(LIVING_DRIFT.headroom * (1 + (LIVING_DRIFT.push - 1) * 0.95))   // it does push to about 1.02
  })

  it('moves about 8 px across, 4 px down and 0.1 degree of roll, and never shows an edge at either aspect', () => {
    let x = 0, y = 0, roll = 0
    for (let f = 0; f < 3000; f++) {
      for (const [w, h] of [[1080, 1920], [1920, 1080]] as const) {
        const s = cameraAt(ing({ camera: 'drift' }), beats, [], f, w, h)
        expect(covers(s, w, h)).toBe(true)
        x = Math.max(x, Math.abs(s.tx)); y = Math.max(y, Math.abs(s.ty)); roll = Math.max(roll, Math.abs(s.rollDeg ?? 0))
      }
    }
    expect(x).toBeGreaterThan(7.9); expect(x).toBeLessThanOrEqual(8)
    expect(y).toBeGreaterThan(3.9); expect(y).toBeLessThanOrEqual(4)
    expect(roll).toBeGreaterThan(0.099); expect(roll).toBeLessThanOrEqual(0.1)
  })

  it('is too slow to blur, and draws the roll only where there is one', () => {
    for (let f = 0; f < 600; f += 3) expect(cameraAt(ing({ camera: 'drift' }), beats, [], f, 1080).blurPx).toBe(0)
    expect(cameraStyle(cameraAt(ing({ camera: 'drift' }), beats, [], 40, 1080), 1080, 1920).transform).toMatch(/rotate\(-?[\d.]+deg\)/)
    expect(cameraStyle(cameraAt(ing({ camera: 'phased' }), beats, [], 40, 1080), 1080, 1920).transform).not.toContain('rotate')
  })
})

describe('blur from speed (15 Nov 2026)', () => {
  it('blurs a handover by how fast it travels, never past 18 px, and leaves a still or slow picture sharp', () => {
    for (const energy of ENERGIES) for (const transition of TRANSITIONS) for (const camera of CAMERAS) for (const lead of [false, true]) {
      for (let f = 0; f < 180; f++) {
        const i = ing({ energy, transition, camera, hits: camera !== 'none', lead })
        expect(cameraAt(i, beats, [30, 120], f, 1080).blurPx).toBeLessThanOrEqual(MAX_BLUR_PX)
        const move = leadMoveAt(i, beats[0]!, false, true, f, 1080)
        if (move) expect(move.blurPx).toBeLessThanOrEqual(MAX_BLUR_PX)
      }
    }
    const whip = (energy: EngineIngredients['energy'], f: number) => cameraAt(ing({ transition: 'whip', energy }), beats, [], f, 1080).blurPx
    expect(whip('high', 90)).toBe(MAX_BLUR_PX)                       // the arrival frame travels the furthest
    expect(whip('high', 93)).toBeLessThan(whip('high', 92))          // and the blur falls as it settles
    expect(whip('high', 96)).toBe(0)
    expect(whip('high', 89)).toBe(0)
    // A cut under the phased camera: its step back to 1.0 at the beat start is a new shot, never blurred.
    for (let f = 85; f < 100; f++) expect(cameraAt(ing({ camera: 'phased' }), beats, [], f, 1080).blurPx).toBe(0)
  })
})

describe('the exit leads the entrance (15 Nov 2026)', () => {
  const h = 90
  it('leads only on a transition that travels', () => {
    for (const transition of TRANSITIONS) expect(leads(ing({ transition, lead: true }))).toBe((LEAD_TRANSITIONS as readonly string[]).includes(transition))
    expect(leads(ing({ transition: 'whip' }))).toBe(false)
  })

  it('starts the exit 6 frames before the handover and carries it to 2 after, dimming to dark, still on screen', () => {
    for (const transition of LEAD_TRANSITIONS) for (const energy of ENERGIES) {
      const i = ing({ transition, energy, lead: true })
      expect(leadMoveAt(i, beats[0]!, false, true, h - LEAD_BEFORE, 1080)?.brightness ?? 1).toBe(1)
      let moved = 0, light = 1
      for (let f = h - LEAD_BEFORE + 1; f < h + LEAD_AFTER; f++) {
        const m = leadMoveAt(i, beats[0]!, false, true, f, 1080)!
        const now = Math.abs(m.tx) + Math.abs(m.ty) + (m.scale - 1) * 1000
        expect(now).toBeGreaterThan(moved)                           // still leaving, never frozen
        expect(m.brightness).toBeLessThan(light)                     // darker every frame
        expect(Math.abs(m.tx)).toBeLessThan(1080)                    // and still on screen
        expect(Math.abs(m.ty)).toBeLessThan(1920)
        moved = now; light = m.brightness
      }
      expect(light).toBeLessThan(0.3)                                // dark by its last frame: no mid-grey frame
    }
  })

  it('makes no handover move of the camera when it leads; the beats move instead', () => {
    for (const transition of LEAD_TRANSITIONS) {
      for (let f = 80; f < 110; f++) {
        expect(cameraAt(ing({ transition, lead: true }), beats, [], f, 1080)).toEqual(cameraAt(ing({ transition: 'cut' }), beats, [], f, 1080))
      }
      const arrive = leadMoveAt(ing({ transition, lead: true }), beats[1]!, true, false, h, 1080)!
      expect(Math.abs(arrive.tx) + Math.abs(arrive.ty) + (arrive.scale - 1) * 1000).toBeGreaterThan(50)
      expect(leadMoveAt(ing({ transition, lead: true }), beats[1]!, true, false, h + TRANSITION_FRAMES.high, 1080)).toBeUndefined()
    }
  })
})

const THURSDAY = JSON.parse(readFileSync('docs/plans/2026-11-05-thursday-no-spending/ve/props.short.json', 'utf8'))
const thursday = (ingredients?: EngineIngredients, style?: string): EngineRenderProps => {
  const props = EngineRenderPropsSchema.parse(JSON.parse(JSON.stringify(THURSDAY)))
  delete props.motion
  if (style) props.motion = { style }
  if (ingredients) props.ingredients = ingredients
  return props
}
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}
const draw = (props: EngineRenderProps, frame: number) => { clockFrame.value = frame; return elements(FormatMaster(props)) }
const mounted = (nodes: ReturnType<typeof elements>) => nodes.filter((n) => String(n.key).startsWith('devices-')).map((n) => String(n.key).slice(8))
const styleOf = (node: ReactElement<Record<string, unknown>> | undefined) => (node?.props.style ?? {}) as { transform?: string; filter?: string }
const shift = (transform: string | undefined) => {
  const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\) scale\(([\d.]+)\)/.exec(transform ?? '')
  return m ? { tx: Number(m[1]), ty: Number(m[2]), s: Number(m[3]) } : { tx: 0, ty: 0, s: 1 }
}
const brightness = (filter: string | undefined) => Number(/brightness\(([\d.]+)\)/.exec(filter ?? '')?.[1] ?? 1)

describe('the lead in the composition', () => {
  it('never draws a frame with neither beat on screen, and keeps the outgoing beat running for 2 frames over the incoming', () => {
    for (const transition of LEAD_TRANSITIONS) for (const energy of ENERGIES) {
      const props = thursday(ing({ transition, energy, lead: true }))
      for (const [index, beat] of props.beats.entries()) {
        if (!index) continue
        const out = props.beats[index - 1]!, at = beat.fromFrame
        for (let f = at - LEAD_BEFORE - 1; f < at + TRANSITION_FRAMES[energy] + 2; f++) {
          const nodes = draw(props, f)
          const on = mounted(nodes)
          const seen = on.filter((id) => {
            const st = styleOf(nodes.find((n) => n.key === `lead-${id}`)), m = shift(st.transform)
            return brightness(st.filter) > 0.1 && Math.abs(m.tx) < 1080 && Math.abs(m.ty) < 1920
          })
          expect(seen.length, `${transition} ${energy} frame ${f}`).toBeGreaterThan(0)
          expect(on.includes(out.id)).toBe(f < at + LEAD_AFTER)
          if (f >= at) expect(on.includes(beat.id)).toBe(true)
          if (f >= at && f < at + LEAD_AFTER) expect(on.indexOf(out.id)).toBeLessThan(on.indexOf(beat.id))   // it leaves under the incoming beat
        }
      }
    }
  })

  it('runs the outgoing exit on through the overlap while its objects hold their last frame', () => {
    const props = thursday(ing({ transition: 'whip', energy: 'medium', lead: true }))
    const lead = (f: number) => shift(styleOf(draw(props, f).find((n) => n.key === 'lead-hook')).transform).tx
    expect(lead(176)).toBeLessThan(lead(175))
    expect(lead(177)).toBeLessThan(lead(176))
    const held = draw(props, 177).filter((n) => n.key === 'devices-hook').flatMap((n) => elements(n.props.children as ReactNode))
      .filter((n) => typeof n.props.frame === 'number').map((n) => n.props.frame)
    expect(held.length).toBeGreaterThan(0)
    expect(held.every((f) => f === 175)).toBe(true)
  })

  it('draws with no lead exactly as the plain handover does', () => {
    const plain = thursday(ing({ transition: 'whip', energy: 'high' }))
    for (const f of [170, 176, 178]) expect(draw(plain, f).some((n) => String(n.key).startsWith('lead-'))).toBe(false)
  })
})

describe('focus on the event', () => {
  const camera = (nodes: ReturnType<typeof elements>) => nodes.find((n) => n.props['data-ingredient-camera'])!.props.style
  const take = (nodes: ReturnType<typeof elements>) => nodes.filter((n) => String(n.key).startsWith('segment-')).map((n) => JSON.stringify(n.props))
  const faceLayer = (nodes: ReturnType<typeof elements>) => elements(nodes.find((n) => n.key === 'devices-face')!.props.children as ReactNode)
    .find((n) => typeof (n.props.style as { transform?: string } | undefined)?.transform === 'string' && /scale/.test((n.props.style as { transform: string }).transform))

  it('pushes the graphics layer onto the typed line, never the camera or his take', () => {
    for (const style of [undefined, 'dark-keynote', 'riso-halftone']) {
      const on = draw(thursday(ing({ camera: 'phased', focus: true }), style), 300)
      const off = draw(thursday(ing({ camera: 'phased' }), style), 300)
      expect(camera(on)).toEqual(camera(off))
      expect(take(on)).toEqual(take(off))
      const zoom = shift((faceLayer(on)!.props.style as { transform: string }).transform)
      expect(zoom.s).toBeGreaterThan(1.05)
      expect(zoom.s).toBeLessThanOrEqual(FOCUS_SCALE)
    }
    for (let f = 0; f < 400; f += 7) expect(cameraAt(ing({ camera: 'phased', focus: true }), beats, [], f, 1080)).toEqual(cameraAt(ing({ camera: 'phased' }), beats, [], f, 1080))
  })

  it('adds no second zoom to a style that already zooms to the line', () => {
    const flat = (nodes: ReturnType<typeof elements>) => JSON.stringify(nodes.map((n) => [n.key, n.props.style]))
    expect(flat(draw(thursday(ing({ focus: true }), 'living-ui'), 300))).toEqual(flat(draw(thursday(ing({}), 'living-ui'), 300)))
  })
})

describe('captions never move', () => {
  it('keeps the frame and its captions outside every camera and lead move', () => {
    for (const i of [ing({ camera: 'drift' }), ing({ camera: 'phased', transition: 'whip', lead: true, hits: true }), ing({ camera: 'punch', focus: true, hits: true })]) {
      for (const f of [10, 180, 600]) {
        clockFrame.value = f
        const tree = FormatMaster(thursday(i))
        const camera = elements(tree).find((n) => n.props['data-ingredient-camera'])!
        expect(elements(camera).some((n) => n.type === BrandFrame)).toBe(false)
        expect(elements(tree).filter((n) => n.type === BrandFrame)).toHaveLength(1)
        for (const lead of elements(tree).filter((n) => n.props['data-lead'])) expect(elements(lead).some((n) => n.type === BrandFrame)).toBe(false)
      }
    }
  })
})

describe('caption placement is the captions’ own choice', () => {
  it('defaults to the lower band and moves only when the piece places it', () => {
    expect(band({ aspect: '9:16' })).toEqual(REGIONS['9:16'].lower)
    expect(band({ aspect: '9:16', captionPlacement: 'centre' })).toEqual(REGIONS['9:16'].centre)
    expect(band({ aspect: '16:9', captionPlacement: 'upper' })).toEqual(REGIONS['16:9'].upper)
  })

  it('keeps every tall place inside every channel safe area (top 270, rail x 880 below y 520, bottom 1320)', () => {
    for (const box of Object.values(REGIONS['9:16'])) {
      expect(box.top).toBeGreaterThanOrEqual(270)
      expect(box.top + box.height).toBeLessThanOrEqual(1320)
      if (box.top + box.height > 520) expect(box.left + box.width).toBeLessThanOrEqual(880)
    }
  })
})
