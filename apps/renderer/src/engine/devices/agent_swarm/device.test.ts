import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import { Device } from './index'
import { swarmState } from './state'
import fixture from './fixture.json'
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number) => swarmState({ object, events, frame })
const tokens = { ink: 'darkslategrey', inkDeep: 'black', inkSoft: 'grey', cream: 'ivory', mint: 'aquamarine', channel: 'coral' }
const render = (frame: number, aspect: '9:16' | '16:9' = '9:16') => renderToStaticMarkup(React.createElement(Device, { object, events, frame, tokens, aspect, box: { left: 10, top: 20, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 } }))
describe('agent_swarm', () => {
  it('is absent before enter and after exit', () => {
    expect(at(9)).toBeNull(); expect(render(9)).toBe(''); expect(at(246)).toBeNull()
  })
  it('types the comment and staggers exactly the supplied count', () => {
    expect(at(10)?.text).toBe(''); expect(at(29)?.text).toBe(object.params.comment)
    expect(at(30)?.agents).toHaveLength(1)
    expect(at(70)?.agents).toHaveLength(10)
    expect(render(70).match(/data-agent=/g)).toHaveLength(10)
  })
  it('counts to the exact token and rank values', () => {
    expect(at(80)?.tokens).toBe(120); expect(at(110)?.tokens).toBe(3200)
    expect(at(130)?.rank).toBe(90); expect(at(160)?.rank).toBe(12)
    expect(render(160)).toContain('data-rank="true"')
    expect(render(160)).not.toContain('data-meter=')
  })
  it('freezes the agents and greys everything except the strike', () => {
    expect(at(185)?.work).toBe(at(220)?.work)
    expect(render(220)).toContain('data-greyed="true" style="filter:grayscale(1)"')
    expect(render(220)).toContain('data-strike="true"')
    expect(render(220)).toContain('nothing fixed')
  })
  it.each(['9:16', '16:9'] as const)('renders the authored %s layout with provenance', aspect => {
    const html = render(110, aspect)
    expect(html).toContain('ILLUSTRATIVE FIXTURE · 2026-11-10')
    expect(html).toContain('overflow:hidden')
    expect(html).not.toContain('NaN'); expect(html).not.toContain('aquamarine'); expect(html).not.toContain('coral')
  })
  it('ignores other objects, sorts cues and resets on reentry', () => {
    expect(swarmState({ object, events: [...events].reverse(), frame: 110 })).toEqual(at(110))
    expect(swarmState({ object, events: [...events, { ...events[0]!, obj: 'other', atFrame: 100 }], frame: 110 })).toEqual(at(110))
    expect(swarmState({ object, events: [...events, { ...events[0]!, atFrame: 260 }], frame: 280 })?.agents).toHaveLength(0)
  })
})
