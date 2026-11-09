import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { overlayTestProps, assertOverlayMarkup } from '../../kit/overlayInvariants'
import { Device } from './index'
import { ParamsSchema } from './schema'
import { leaderboardState } from './state'
import fixture from './fixture.json'
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number) => leaderboardState(object, events, frame)
const html = (frame: number, aspect: '9:16' | '16:9' = '9:16') => renderToStaticMarkup(React.createElement(Device, {
  ...overlayTestProps, object, events, frame, aspect,
  box: aspect === '9:16' ? { left: 0, top: 0, width: 1080, height: 1920 } : { left: 0, top: 0, width: 1920, height: 1080 },
}))
describe('leaderboard', () => {
  it('waits for enter and add, staggers rows, then drops out', () => {
    expect(html(9)).toBe('')
    expect(html(25)).not.toContain('data-row')
    expect(at(31).rows.map(r => r.reveal > 0)).toEqual([true, false, false])
    expect(at(50).rows.every(r => r.reveal === 1)).toBe(true)
    expect(html(260)).toBe('')
  })
  it('fills linearly from zero and travels to the alternate rank', () => {
    expect(at(59).rows.every(r => r.bar === 0)).toBe(true)
    expect(at(90).rows.map(r => r.bar)).toEqual([1, 0.6, 0.2])
    expect(at(140).rows.map(r => r.position)).toEqual([0, 1, 2])
    expect(at(146).rows[0]!.position).toBeGreaterThan(0)
    expect(at(146).rows[0]!.position).toBeLessThan(2)
    expect(at(170).rows.map(r => [r.label, r.position, r.bar])).toEqual([['Alex', 2, 0.2], ['Jo', 1, 0.5], ['Sam', 0, 1]])
    expect(at(170).header).toBe('Work done')
  })
  it('stamps one named row, highlights one, strikes then greys', () => {
    expect(at(115).rows.map(r => r.badge)).toEqual(['TOKEN LEGEND', undefined, undefined])
    expect(at(195).rows.map(r => r.lift)).toEqual([0, 0, 1])
    expect(at(210).grey).toBe(0)
    expect(at(216).strike).toBeGreaterThan(0)
    expect(at(235)).toMatchObject({ strike: 1, grey: 1 })
  })
  it('resets on reentry, ignores other objects, and is independent of event array order', () => {
    expect(leaderboardState(object, [...events].reverse(), 170)).toEqual(at(170))
    expect(leaderboardState(object, [...events, { ...events[0]!, id: 'again', atFrame: 270 }], 290).rows.every(r => r.bar === 0 && !r.badge)).toBe(true)
    expect(leaderboardState(object, [...events, { ...events[4]!, obj: 'other', atFrame: 50 }], 90)).toEqual(at(90))
  })
  it('renders fixture stills in both aspects with token colours and face clearance', () => {
    for (const aspect of ['9:16', '16:9'] as const) for (const frame of fixture.stills) {
      const markup = html(frame, aspect)
      assertOverlayMarkup(markup, 'leaderboard')
      if (markup) expect(markup).toContain(aspect === '9:16' ? 'width:1080px;height:960px' : 'width:1280px;height:1080px')
    }
  })
  it('validates counts, values and unique row identities', () => {
    expect(ParamsSchema.safeParse({ ...object.params, rows: [{ label: 'x', value: 2 }] }).success).toBe(false)
    const p = ParamsSchema.parse(object.params)
    expect(ParamsSchema.safeParse({ ...p, rows: [p.rows[0], p.rows[0], p.rows[0]] }).success).toBe(false)
  })
})
