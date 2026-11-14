import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineBeatSchema, EngineEventSchema, EngineObjectSchema } from '../../props'
import { overlayTestProps } from '../../kit/overlayInvariants'
import { Device } from './index'
import { ParamsSchema } from './schema'
import { entranceFrames, throughLineState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number, cues = events) => throughLineState(object, cues, frame)
const part = (frame: number, id: string) => at(frame).parts.find(p => p.id === id)!
const html = (frame: number, aspect: '9:16' | '16:9' = '9:16') => renderToStaticMarkup(React.createElement(Device, {
  ...overlayTestProps, object, events, frame, aspect,
  box: { left: 0, top: 0, width: aspect === '9:16' ? 800 : 1600, height: aspect === '9:16' ? 850 : 800 },
}))

describe('through_line', () => {
  it('carries exactly one object and the same ordered parts across all six beats', () => {
    expect(fixture.objects).toHaveLength(1)
    for (const raw of fixture.beats) {
      const beat = EngineBeatSchema.parse(raw)
      expect(beat.uses).toEqual([object.obj])
      const state = at(beat.fromFrame + 40)
      expect(state.obj).toBe(object.obj)
      expect(state.parts.map(p => p.id)).toEqual((object.params.parts as { id: string }[]).map(p => p.id))
      expect(html(beat.fromFrame + 40).match(/data-object=/g)).toHaveLength(1)
    }
    expect(part(400, 'junior').number?.value).toBe(9)
    expect(part(400, 'agents').size).toBe(6)
  })
  it('counts 27 to 9 while thinning the junior rung in one second', () => {
    expect(part(9, 'junior').number?.value).toBe(27)
    expect(part(10, 'junior').thickness).toBe(1)
    expect(part(25, 'junior').number?.value).toBeGreaterThan(9)
    expect(part(25, 'junior').number?.value).toBeLessThan(27)
    expect(part(25, 'junior').thickness).toBeLessThan(1)
    expect(part(40, 'junior').number?.value).toBe(9)
    expect(part(40, 'junior').thickness).toBeCloseTo(.12)
  })
  it('grows a linear, zero-based agent bar to six times staff', () => {
    expect(part(99, 'agents').size).toBe(1)
    expect(part(115, 'agents').size).toBeGreaterThan(1)
    expect(part(130, 'agents').size / part(130, 'staff').size).toBe(6)
    expect(html(130)).toContain('ANTHROPIC · AUG 2026')
  })
  it('loses seven of the original marks, then copies the remaining units without rounding', () => {
    expect(part(189, 'tellers').count).toBe(20)
    expect(part(220, 'tellers').count).toBe(13)
    expect(part(260, 'tellers').count).toBeCloseTo(13 * 1.43)
    expect(part(260, 'branches').number?.value).toBe(43)
    const fractions = [...html(260).matchAll(/data-fraction="([\d.]+)"/g)].map(m => Number(m[1]))
    expect(fractions.reduce((sum, n) => sum + n, 0)).toBeCloseTo(18.59)
    expect(html(220)).toContain('IMF · BESSEN 2015')
    expect(html(260)).toContain('NPR PLANET MONEY · 2015')
  })
  it('keeps the dropped rung as a gap and rests the camera on it through the quiet beat', () => {
    expect(part(279, 'junior').opacity).toBe(1)
    expect(part(287, 'junior').opacity).toBe(0)
    expect(at(290).camera[0]).toBe(0)
    expect(at(297).camera[0]).toBe(1)
    expect(at(400).camera).toEqual(at(297).camera)
    expect(part(400, 'junior').opacity).toBe(0)
    expect(at(400).parts).toHaveLength(at(0).parts.length)
  })
  it('lights 2030 and connects the senior rung back to the missing junior rung', () => {
    expect(part(459, 'senior').lit).toBe(0)
    expect(part(467, 'senior').lit).toBe(1)
    expect(part(490, 'senior').number?.value).toBe(2030)
    expect(at(469).connections).toEqual([])
    expect(at(500).connections).toEqual([{ from: 'senior', to: 'junior', amount: 1 }])
    expect(html(500)).toContain('HOSSEINI &amp; LICHTINGER · 2025')
  })
  it('renders both aspects, one sourced number per frame and stable unit identities', () => {
    for (const aspect of ['9:16', '16:9'] as const) for (const frame of fixture.stills) {
      const markup = html(frame, aspect)
      expect(markup).toContain('data-device="through_line"')
      expect(markup).not.toMatch(/NaN|Infinity/)
      expect(markup.match(/data-number-on=/g) ?? []).toHaveLength(frame >= 287 && frame < 460 ? 0 : 1)
    }
    expect(html(540)).toBe('')
  })
  it('is independent of input order, unrelated cues and repeated evaluation', () => {
    expect(at(500, [...events].reverse())).toEqual(at(500))
    expect(at(260, [...events, { ...events[0]!, obj: 'elsewhere', atFrame: 100 }])).toEqual(at(260))
    expect(at(25)).toEqual(at(25))
    const before = JSON.stringify({ object, events })
    at(500)
    expect(JSON.stringify({ object, events })).toBe(before)
  })
  it('starts an interrupted count from its reached value and carries it over a later entrance', () => {
    const interrupted = [...events.filter(e => e.atFrame <= 10), { ...events[1]!, id: 'interrupt', atFrame: 25 }]
    expect(at(25, interrupted).parts[0]!.number?.value).toBe(part(25, 'junior').number?.value)
    expect(at(55, interrupted).parts[0]!.number?.value).toBe(9)
    expect(part(400, 'agents').size).toBe(at(400, [...events, { ...events[0]!, id: 'again', atFrame: 350 }]).parts[2]!.size)
  })
  it('settles later entrances in 4–7 frames and exits without clearing state', () => {
    expect(entranceFrames()).toBeGreaterThanOrEqual(4)
    expect(entranceFrames()).toBeLessThanOrEqual(7)
    const later = events.map(e => e.verb === 'enter' ? { ...e, atFrame: 5 } : e)
    expect(at(4, later).visible).toBe(false)
    expect(at(5, later).opacity).toBe(0)
    expect(at(12, later).opacity).toBe(1)
    const exited = [...events, { ...events[0]!, id: 'exit', verb: 'exit' as const, atFrame: 510 }]
    expect(at(517, exited).visible).toBe(false)
    expect(at(517, exited).parts[2]!.size).toBe(6)
  })
  it('refuses unknown parts, units, unsourced numbers and unsupported commands', () => {
    expect(ParamsSchema.safeParse({ ...object.params, parts: [] }).success).toBe(false)
    expect(() => throughLineState({ ...object, dataset: undefined }, events, 40)).toThrow('dataset')
    expect(() => at(500, [...events, { ...events[1]!, id: 'bad', toState: 'absent', atFrame: 480 }])).toThrow('invalid')
    const p = ParamsSchema.parse(object.params)
    expect(ParamsSchema.safeParse({ ...p, states: { bad: { verb: 'connect', part: 'senior', to: 'absent' } } }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...p, states: { bad: { verb: 'count_to', part: 'junior', number: { value: 9, unit: 'hours', producer: 'ANTHROPIC', date: '2026' } } } }).success).toBe(false)
  })
})
