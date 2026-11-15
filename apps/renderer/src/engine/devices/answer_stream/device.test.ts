import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { answerState, revealSteps } from './state'
import { Device } from './index'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'
// Standalone still tests replace only Remotion's composition-bound image loader.
vi.mock('remotion', async (original) => ({ ...await original<typeof import('remotion')>(), Img: (props: Record<string, unknown>) => createElement('img', props) }))
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number) => answerState(object, events, frame)
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' }
describe('answer_stream', () => {
  it('covers every line until typing, reveals in order, then never covers again', () => {
    expect(at(14).revealed).toEqual([0, 0])
    for (let f = 15; f < 180; f++) {
      const current = at(f).revealed, previous = at(f - 1).revealed
      current.forEach((n, i) => expect(n).toBeGreaterThanOrEqual(previous[i]!))
      if (current[0]! < 40) expect(current[1]).toBe(0)
    }
    expect(at(99).revealed).toEqual([40, 32])
    const compressed = events.map(e => e.verb === 'mark' ? { ...e, atFrame: 25 } : e)
    expect(answerState(object, compressed, 25).revealed).toEqual([40, 32])
  })
  it('uses deterministic chunks on twos and a 30 cps average', () => {
    const steps = revealSteps([{ chars: 300 }])[0]!
    expect(steps).toEqual(revealSteps([{ chars: 300 }])[0])
    expect(steps.at(-1)!.at).toBe(300)
    steps.forEach((s, i) => { expect(s.at / 2).toBe(Math.floor(s.at / 2)); expect(s.chars - (steps[i - 1]?.chars ?? 0)).toBeLessThanOrEqual(6) })
    expect(at(40)).toEqual(at(40))
    expect(answerState(object, [...events].reverse(), 40)).toEqual(at(40))
  })
  it('pops once, settles at 1x, and draws only forward', () => {
    expect(at(99).pop).toBe(1)
    expect(at(104).pop).toBeGreaterThan(1)
    expect(at(108).pop).toBe(1)
    expect(at(170).pop).toBe(1)
    for (let f = 1; f < 180; f++) {
      expect(at(f).pop).toBeLessThanOrEqual(1.25)
      expect(at(f).ring).toBeGreaterThanOrEqual(at(f - 1).ring)
      expect(at(f).hairline).toBeGreaterThanOrEqual(at(f - 1).hairline)
    }
  })
  it.each(['9:16', '16:9'] as const)('renders the %s layout with captured pixels, mint proof and dimmed surroundings', aspect => {
    const box = { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 }
    const render = (frame: number) => renderToStaticMarkup(createElement(Device, { object, events, box, tokens, aspect, frame }))
    expect(render(40)).toBe(render(40))
    const html = render(150)
    expect(html).toContain('opacity:0.4')
    expect(html).toContain('background:aqua;opacity:0.2')
    expect(html).toContain('source-capture.png')
    expect(html).toContain('font-size:24px')
    expect(render(186)).toContain('opacity:0;')
    expect(render(200)).toBe('')
    if (aspect === '9:16') expect(() => Device({ object, events, box: { ...box, width: 400 }, tokens, aspect, frame: 150 })).toThrow('line 0 under 40 px')
  })
  it('rejects out of bounds capture geometry and extra fields', () => {
    expect(ParamsSchema.safeParse({ ...object.params, extra: true }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...object.params, blank: { x: 800, y: 0, w: 10, h: 10 } }).success).toBe(false)
  })
})
