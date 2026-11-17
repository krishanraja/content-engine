import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import { Device } from './index'
import { morphState, outline, resample } from './state'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const tokens = { ink: 'navy', inkDeep: 'midnightblue', inkSoft: 'slategray', cream: 'ivory', mint: 'seagreen', channel: 'coral' }
const at = (frame: number) => morphState(object, events, frame)
const markup = (frame: number, aspect: '9:16' | '16:9' = '9:16') => renderToStaticMarkup(React.createElement(Device, { object, events, tokens, frame, aspect, box: { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 } }))
describe('morph_stage', () => {
  it('resamples one outline and makes a true intermediate geometry', () => {
    expect(resample([[0,0],[1,0],[1,1],[0,1]]).length).toBe(96)
    expect(at(29).points).not.toEqual(at(20).points)
    expect(at(29).points).not.toEqual(at(38).points)
    expect(markup(29).match(/data-outline=/g)).toHaveLength(1)
    expect(markup(29)).not.toContain('opacity=')
  })
  it('lands in 18 frames, with positive ongoing drift', () => {
    expect(at(38).points).toEqual(outline(at(38).params.states[1]!))
    expect(at(39).drift).toBeGreaterThan(at(38).drift)
    expect(at(38).drift).toBeGreaterThan(0)
    expect(markup(156)).toBe('')
  })
  it('replays interrupted moves without a jump and ignores future cues', () => {
    const cues = [...events.filter(e => e.atFrame <= 20), { ...events[3]!, atFrame: 26 }]
    const before = morphState(object, cues.slice(0,-1), 26)
    expect(morphState(object, cues, 26).points).toEqual(before.points)
    expect(morphState(object, [...events].reverse(), 29).points).toEqual(at(29).points)
  })
  it('shows supplied evidence in the evolving mask, with preserved proportions', () => {
    const svg = markup(59)
    expect(svg).toContain('href="/evidence/trial.jpg"')
    expect(svg).toContain('clip-path="url(#morph-')
    expect(svg).toContain('preserveAspectRatio="xMidYMid meet"')
    expect(at(59).points).not.toEqual(at(68).points)
  })
  it('rolls dataset numbers with fixed units and provenance', () => {
    expect(markup(119)).toContain('>40</text>')
    expect(markup(119)).toContain('>12</text>')
    expect(markup(128)).not.toContain('>40</text>')
    expect(markup(128)).toContain('Measured trial')
    expect(() => morphState({ ...object, dataset: undefined }, events, 80)).toThrow('dataset')
  })
  it('renders both aspects deterministically, using token paint only', () => {
    for (const aspect of ['9:16', '16:9'] as const) {
      const first = markup(59, aspect)
      markup(100, aspect)
      expect(markup(59, aspect)).toBe(first)
      expect(first).toContain(`data-aspect="${aspect}"`)
      expect(first).not.toMatch(/NaN|undefined|caption|#[0-9a-f]{6}/)
      for (const m of first.matchAll(/(?:fill|stroke|flood-color)="([^"]+)"/g)) expect([...Object.values(tokens), 'none'].includes(m[1]!)).toBe(true)
    }
  })
  it('rejects missing pictures and arbitrary colours', () => {
    expect(ParamsSchema.safeParse({ ...object.params, images: [] }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...object.params, colour: 'pink' }).success).toBe(false)
  })
})
