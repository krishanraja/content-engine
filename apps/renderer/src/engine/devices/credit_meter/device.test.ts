import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { Device } from './index'
import { creditState } from './state'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (f: number) => creditState(object, events, f)
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' }
const draw = (frame: number, aspect: '9:16' | '16:9' = '9:16') => renderToStaticMarkup(createElement(Device, {
  object, events, frame, aspect, tokens, box: { left: 0, top: 0, width: aspect === '9:16' ? 800 : 1400, height: 900 },
}))
describe('credit_meter', () => {
  it('fills, adds above the plan, and drains exactly back to it', () => {
    expect(at(19).value).toBe(0)
    expect(at(40).value).toBe(2400)
    expect(at(70).value).toBe(6000)
    expect(at(70).base + at(70).extra).toBeGreaterThan(at(40).base)
    expect(at(170).base).toBe(at(40).base)
    expect(at(170).extra).toBe(0)
    expect(draw(70)).toContain('data-level="1"')
    expect(draw(170)).toContain('data-level="0.4"')
  })
  it('groups whole numbers and preserves units while counting', () => {
    expect(draw(40)).toContain('2,400 credits')
    expect(draw(70)).toContain('6,000 credits')
    for (let f = 20; f < 180; f++) {
      expect(Number.isInteger(at(f).value)).toBe(true)
      expect(draw(f)).toContain(`${at(f).value.toLocaleString('en-US')} credits`)
    }
  })
  it.each(['9:16', '16:9'] as const)('draws repeatable SVG and actual evidence in %s', aspect => {
    const markup = draw(100, aspect)
    expect(markup).toBe(draw(100, aspect))
    expect(markup).toContain('<image href="small-print.png"')
    expect(markup).not.toContain('>small-print.png<')
    expect(draw(79, aspect)).not.toContain('<image')
    expect(draw(101, aspect)).not.toBe(markup)
  })
  it('ticks the day counter and exits', () => {
    expect(at(100).day).toBe(1)
    expect(at(130).day).toBe(30)
    expect(draw(220)).toBe('')
    expect(draw(0)).toBe('')
  })
  it('validates label, life, paths and dataset references', () => {
    const params = fixture.objects[0]!.params
    expect(ParamsSchema.safeParse({ ...params, days: 91 }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...params, plan: { label: 'one two three four', row: 'plan' } }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...params, src: '../secret' }).success).toBe(false)
    expect(() => creditState({ ...object, dataset: undefined }, events, 40)).toThrow()
    expect(() => creditState({ ...object, params: { ...params, plan: { label: 'Plan', row: 'missing' } } }, events, 40)).toThrow()
  })
  it('preserves continuity if a drain interrupts the bonus pour', () => {
    const early = events.map(e => e.verb === 'drop' ? { ...e, atFrame: 55 } : e)
    expect(creditState(object, early, 55).value).toBe(at(55).value)
    expect(creditState(object, [...early].reverse(), 60)).toEqual(creditState(object, early, 60))
  })
})
