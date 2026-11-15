import { describe, expect, it } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import type { DeviceProps } from '../types'
import fixture from './fixture.json'
import { Device, codeFocus } from './index'
import { codeState } from './state'
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const props = (frame: number, aspect: DeviceProps['aspect'] = '9:16'): DeviceProps => ({ object, events, frame, aspect,
  box: { left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080 },
  tokens: { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'aqua', channel: 'coral' } })
const at = (frame: number) => codeState(props(frame))!
describe('real code card', () => {
  it('uses verbatim lines from its named source', () => {
    const source = readFileSync(fixture.objects[0]!.params.file.path, 'utf8').split('\n')
    for (const l of fixture.objects[0]!.params.lines) expect(source).toContain(l.text)
  })
  it('types at 30 cps with a solid caret, queues cues and holds', () => {
    expect(at(29).rows[0]!.text).toBe('')
    expect(at(40).rows[0]!.text).toHaveLength(10)
    for (let f = 30; f < 50; f++) {
      expect(at(f).rows[0]!.caret).toBe(true)
      expect(renderToStaticMarkup(React.createElement(Device, props(f)))).toContain('data-caret')
    }
    expect(at(50).rows[0]!.text).toBe(fixture.objects[0]!.params.lines[0]!.text)
    expect(at(51).rows[1]!.text).toBe('}')
    expect(at(100).rows.every(r => !r.caret)).toBe(true)
    const queued = codeState({ ...props(40), events: events.map(e => e.id === 'type2' ? { ...e, atFrame: 31 } : e) })!
    expect(queued.rows[1]!.text).toBe('')
    expect(queued.rows[1]!.start).toBe(50)
  })
  it('reports camera targets and the preceding line', () => {
    expect(codeFocus(props(9))).toBeUndefined()
    const first = codeFocus(props(49))!
    const second = codeFocus(props(50))!
    expect(second.from).toEqual(first.rect)
    expect(second.rect.top).toBe(first.rect.top + 64)
    expect(codeFocus(props(71))!.rect).toEqual(second.rect)
  })
  it('holds highlight with other lines at 40%', () => {
    expect(at(100).rows.map(r => r.opacity)).toEqual([0.4, 1])
    expect(renderToStaticMarkup(React.createElement(Device, props(100)))).toContain('aqua 18%')
  })
  it('refuses overlong lines by id in each aspect', () => {
    for (const [aspect, n] of [['9:16', 31], ['16:9', 57]] as const) {
      const p = props(40, aspect)
      p.object = { ...object, params: { ...object.params, lines: [{ id: 'too-long', text: 'a'.repeat(n), typed: false }] } }
      expect(() => codeState(p)).toThrow('too-long')
    }
  })
  it('renders both separately authored aspect fixtures deterministically', () => {
    for (const aspect of fixture.aspects as DeviceProps['aspect'][]) for (const frame of fixture.stills) {
      const html = renderToStaticMarkup(React.createElement(Device, props(frame, aspect)))
      expect(html).toBe(renderToStaticMarkup(React.createElement(Device, props(frame, aspect))))
      if (frame === 70) expect(html).toContain(aspect === '9:16' ? 'width:1032px' : 'width:1776px')
    }
    expect(codeState({ ...props(40), events: [...events].reverse() })).toEqual(at(40))
  })
})
