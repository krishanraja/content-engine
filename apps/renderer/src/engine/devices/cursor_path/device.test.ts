import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>()
  return { ...actual, Img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', props) }
})
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { Device } from './index'
import { cursorState } from './state'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number, cues = events) => cursorState({ object, events: cues, frame })
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' }
const markup = (frame: number, aspect: '9:16' | '16:9' = '9:16') => renderToStaticMarkup(React.createElement(Device, { object, events, frame, aspect, tokens,
  box: { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 } }))
describe('cursor_path', () => {
  it('waits, glides once, settles and presses after four frames', () => {
    expect(at(19)!.cursor).toMatchObject({ x: 40, y: 40 })
    expect(at(25)!.cursor.x).toBeGreaterThan(40)
    expect(at(30)!.cursor).toMatchObject({ x: 300, y: 135 })
    expect(at(33)!.press).toBeUndefined()
    expect(at(34)!.scale).toBe(0.9)
    expect(at(35)!.scale).toBe(0.9)
    expect(at(36)!.scale).toBe(1)
    expect(() => at(33, [...events, { ...events[2]!, atFrame: 33 }])).toThrow('four settled frames')
  })
  it('has one ripple per press and only the last highlight', () => {
    expect(markup(34).match(/data-ripple=/g)).toHaveLength(1)
    expect(at(44)!.ripple).toBeNull()
    expect(markup(84)).toContain('data-highlight="send"')
    expect(markup(84)).not.toContain('data-highlight="input"')
    expect(markup(94)).not.toContain('data-ripple')
    expect(at(120)!.press!.target).toBe('send')
  })
  it('types only on cue at a readable rate', () => {
    expect(at(44)!.texts.input).toBeUndefined()
    expect(at(45)!.texts.input).toBe('')
    expect(at(50)!.texts.input).toBe('Hello')
    expect(at(56)!.texts.input).toBe('Hello there')
  })
  it('draws busy once and holds without unrelated cues altering its duration', () => {
    expect(at(83)!.busy).toBe(0)
    expect(at(84)!.busy).toBe(0)
    for (let f = 85; f <= 129; f++) expect(at(f)!.busy).toBeGreaterThanOrEqual(at(f - 1)!.busy)
    expect(at(129)!.busy).toBe(1)
    expect(at(150)!.busy).toBe(1)
    expect(at(100, [...events, { ...events[0]!, obj: 'other', atFrame: 90 }])).toEqual(at(100))
  })
  it.each(['9:16', '16:9'] as const)('renders the whole capture and provenance in %s', aspect => {
    const html = markup(56, aspect)
    expect(html).toContain('<img')
    expect(html).toContain('cursor-capture.png')
    expect(html).toContain('Test fixture capture only')
    expect(html).toContain('font-size:24px')
    expect(html).not.toMatch(/#[\da-fA-F]{3,8}\b/)
  })
  it('is deterministic across seeks, reversed cues and interrupted glides', () => {
    at(150)
    expect(at(25, [...events].reverse())).toEqual(at(25))
    const interrupted = [...events.filter(e => e.atFrame < 25), { ...events[1]!, id: 'interrupt', atFrame: 25, toState: 'send' }]
    expect(at(25, interrupted)!.cursor).toEqual(at(25)!.cursor)
    expect(at(35, interrupted)!.cursor).toMatchObject({ x: 650, y: 430 })
    expect(markup(0)).toBe('')
    expect(markup(166)).toBe('')
    expect(markup(200)).toBe('')
  })
  it('rejects out of capture coordinates and extra params', () => {
    expect(ParamsSchema.safeParse({ ...object.params, extra: true }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...object.params, start: { x: 900, y: 0 } }).success).toBe(false)
  })
})
