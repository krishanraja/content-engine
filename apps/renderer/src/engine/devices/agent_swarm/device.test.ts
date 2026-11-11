import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import { Device, swarmLayout } from './index'
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
    expect(at(80)?.tokens).toBe(120); expect(at(110)?.tokens).toBe(3147000)
    expect(at(130)?.rank).toBe(48); expect(at(160)?.rank).toBe(1)
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
    expect(html).not.toContain('NaN'); expect(html).toContain('aquamarine'); expect(html).toContain('coral')
  })
  it.each(['9:16', '16:9'] as const)('keeps agents and type legible in %s', aspect => {
    const html = render(160, aspect)
    const sizes = [...html.matchAll(/data-agent-size="(\d+)"/g)].map(m => Number(m[1]))
    expect(sizes).toHaveLength(10)
    expect(sizes.every(n => n >= 64)).toBe(true)
    const type = [...html.matchAll(/font(?:-size="|Size:)(\d+)/g)].map(m => Number(m[1]))
    expect(type.length).toBeGreaterThan(0)
    expect(type.every(n => n >= 30)).toBe(true)
    expect(html).toContain('data-token-value="3,147,000"')
  })
  it('reveals whole words and draws the strike over ten frames', () => {
    expect(at(14)?.text).toBe('Can we')
    expect(at(31)?.agents).toHaveLength(1)
    expect(at(32)?.agents).toHaveLength(2)
    expect(at(180)?.strike).toBe(0)
    expect(at(185)?.strike).toBe(0.5)
    expect(at(190)?.strike).toBe(1)
    expect(at(190)?.tokenPosition).toBe(3147000)
    expect(render(85)).not.toEqual(render(86))
  })
  it('ignores other objects, sorts cues and resets on reentry', () => {
    expect(swarmState({ object, events: [...events].reverse(), frame: 110 })).toEqual(at(110))
    expect(swarmState({ object, events: [...events, { ...events[0]!, obj: 'other', atFrame: 100 }], frame: 110 })).toEqual(at(110))
    expect(swarmState({ object, events: [...events, { ...events[0]!, atFrame: 260 }], frame: 280 })?.agents).toHaveLength(0)
  })
})

describe('premium swarm contract', () => {
  it('authors wide windows of at least 120 pixels', () => {
    expect(swarmLayout(1920, 1080, false).windowWidth).toBeGreaterThanOrEqual(120)
    const widths = [...render(110, '16:9').matchAll(/data-window-width="([\d.]+)"/g)].map(m => Number(m[1]))
    expect(widths).toHaveLength(10)
    expect(widths.every(width => width >= 120)).toBe(true)
  })
  it('uses marks, never readable words, within each terminal', () => {
    const windows = render(110, '16:9').split('data-agent-window="true"').slice(1)
    expect(windows).toHaveLength(10)
    for (const window of windows) {
      const terminal = window.slice(0, window.indexOf('</g>'))
      expect(terminal).not.toMatch(/<(text|foreignObject)/)
      expect(terminal.match(/<rect/g)).toHaveLength(5)
    }
  })
  it('keeps visible type at least 28 pixels in both aspects', () => {
    for (const aspect of ['16:9', '9:16'] as const) {
      const sizes = [...render(220, aspect).matchAll(/font(?:-size="|Size:)([\d.]+)/g)].map(m => Number(m[1]))
      expect(sizes.length).toBeGreaterThan(0)
      expect(sizes.every(size => size >= 28)).toBe(true)
    }
  })
  it('changes rendered geometry every frame throughout the visible life', () => {
    for (const aspect of ['16:9', '9:16'] as const) {
      let previous = render(10, aspect)
      for (let frame = 11; frame < 246; frame++) {
        const next = render(frame, aspect)
        expect(next).not.toBe(previous)
        previous = next
      }
    }
  })
  it('omits the rank chip when there is no rank change', () => {
    const same = { ...object, params: { ...object.params, rank: { from: 1, to: 1 } } }
    const html = renderToStaticMarkup(React.createElement(Device, { object: same, events, frame: 160, tokens, aspect: '16:9', box: { left: 0, top: 0, width: 1920, height: 1080 } }))
    expect(html).not.toContain('data-rank=')
  })
})
