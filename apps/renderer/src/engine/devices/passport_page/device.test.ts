import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import type { DeviceProps } from '../types'
import fixture from './fixture.json'
import { Device } from './index'
import { ParamsSchema } from './schema'
import { mrzLine, passportState } from './state'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map((event) => EngineEventSchema.parse(event))
const tokens = { ink: 'rgb(12,21,18)', inkDeep: 'rgb(7,13,11)', inkSoft: 'rgb(23,37,31)',
  cream: 'rgb(244,239,228)', mint: 'rgb(126,240,192)', channel: 'rgb(255,106,77)' }
const props: DeviceProps = { object, events, tokens, box: { left: 0, top: 0, width: 1080, height: 1920 }, aspect: '9:16', frame: 70 }
const at = (frame: number) => passportState(object, events, frame)
const html = (frame = 70, overrides: Partial<DeviceProps> = {}) => renderToStaticMarkup(React.createElement(Device, { ...props, frame, ...overrides }))

describe('passport_page', () => {
  it('draws nothing before enter and exits over the shared six-frame duration', () => {
    expect(html(9)).toBe('')
    expect(at(10)).toMatchObject({ visible: true, enter: 0 })
    expect(at(22).enter).toBe(1)
    expect(at(150).visible).toBe(true)
    expect(at(153).exit).toBeGreaterThan(0)
    expect(html(156)).toBe('')
    expect(html(180)).toBe('')
  })
  it('keeps a stamped field absent until its stamp and rests at full size five frames later', () => {
    expect(html(29)).not.toContain('data-field="a"')
    expect(at(30).fields[0]).toMatchObject({ visible: true, scale: 1.55, opacity: 0 })
    expect(at(31).fields[0]).toMatchObject({ scale: 1.3, opacity: 0.7 })
    expect(at(32).fields[0]!.scale).toBe(1)
    expect(at(33).fields[0]!.scale).toBeLessThan(1)
    expect(at(35).fields[0]).toMatchObject({ scale: 1, opacity: 1, tilt: -5 })
    expect(html(35)).toContain('rotate(-5deg) scale(1)')
  })
  it('shows dashed sample and blank unknowns and requires explicit sampleText', () => {
    expect(html(22)).toContain('???')
    expect(html(22)).toContain('3px dashed')
    expect(html(22)).toContain('SAMPLE · NOT A CLAIM')
    const params = { ...object.params, sampleText: undefined }
    expect(() => html(70, { object: { ...object, params } })).toThrow(/sampleText/)
    expect(ParamsSchema.safeParse({ ...params, sampleText: '  ' }).success).toBe(false)
    const blank = { ...object.params, fields: [{ id: 'blank', label: 'Unverified', at: { x: 92, y: 92 }, state: 'blank' }] }
    expect(html(22, { object: { ...object, params: blank } })).toContain('???')
  })
  it('normalises two MRZ lines to uppercase with filler and a fixed width', () => {
    expect(mrzLine('p<example name')).toBe('P<EXAMPLE<NAME'.padEnd(42, '<'))
    expect(mrzLine('a'.repeat(100))).toHaveLength(42)
    // Neutral filler: the machine line spells no ILLUSTRATION tag or disclaimer (Krish, 28 Oct 2026: "Yes remove those.").
    expect(html()).toContain('P' + '&lt;'.repeat(41))
    expect(html()).not.toMatch(/ILLUSTRATION|NOT&lt;A&lt;CLAIM|p&lt;/)
  })
  it('prints flags separately, keeps geometry level, and bleeds a 900px page off the bottom', () => {
    const markup = html()
    expect(markup).not.toContain('<table')
    expect(markup).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(markup).not.toContain('display:grid')
    const sizes = [...markup.matchAll(/font-size:(\d+(?:\.\d+)?)px/g)].map((match) => Number(match[1]))
    expect(sizes.length).toBeGreaterThan(3)
    expect(sizes.every((size) => size >= 30)).toBe(true)
    expect(markup).toContain('width:900px;height:1700px')
    expect(432 + 1700).toBeGreaterThan(props.box.height)
    expect(markup).toContain('data-flag="usa"')
    expect(markup.indexOf('data-flag="usa"')).toBeLessThan(markup.indexOf('data-field="a"'))
    expect((markup.match(/data-part="leaf"/g) ?? [])).toHaveLength(3)
    expect(markup).toContain('data-part="stitch"')
  })
  it('isolates object events, supports seeking, marks the named field and resets on re-entry', () => {
    expect(at(49).fields[1]!.marked).toBe(false)
    expect(at(62).fields[1]).toMatchObject({ marked: true, markProgress: 1 })
    expect(at(62).fields[0]!.marked).toBe(false)
    expect(passportState(object, [...events].reverse(), 70)).toEqual(at(70))
    const foreign = { ...events[1]!, obj: 'other', atFrame: 25 }
    expect(passportState(object, [events[0]!, foreign], 29).fields[0]!.visible).toBe(false)
    const later = { ...events[1]!, atFrame: 160 }
    expect(passportState(object, [...events, later], 170).visible).toBe(false)
    const reenter = { ...events[0]!, atFrame: 165 }
    expect(passportState(object, [...events, later, reenter], 170).fields[0]!.visible).toBe(false)
    expect(at(29).fields[0]!.visible).toBe(false)
  })
  it('mirrors the spine and authors wide movement without shrinking type', () => {
    const wide = html(70, { aspect: '16:9', box: { left: 0, top: 0, width: 1920, height: 1080 },
      object: { ...object, params: { ...object.params, spine: 'right', at: { x: 900, y: 200 } } } })
    expect(wide).toContain('right:12px')
    expect(wide).toContain('top:650px')
    expect(wide).toContain('width:900px')
  })
  it('refuses ambiguous fields and unsupported params', () => {
    const field = (object.params.fields as unknown[])[0]
    expect(ParamsSchema.safeParse({ ...object.params, fields: [field, field] }).success).toBe(false)
    expect(ParamsSchema.safeParse({ ...object.params, scale: 0.5 }).success).toBe(false)
  })
  it('uses the approved verdict stamp type sizes', () => {
    for (const [main, size] of [['0/1 DELETED', 96], ['2/2 FLAGGED', 70]] as const) {
      const params = { ...object.params, fields: [{ id: 'a', label: 'ILLUSTRATIVE TEST',
        at: { x: 92, y: 92 }, state: 'stamped', main }] }
      expect(html(70, { object: { ...object, params } })).toContain(`font-size:${size}px`)
    }
  })
})
