import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { Scribble } from '../../kit/Scribble'
import { ParamsSchema } from './schema'
import { Device } from './index'
import { scribbleState } from './state'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'green', channel: 'coral' }
const at = (frame: number) => scribbleState(object, events, frame)
const tree = (sinceFrames: number, exiting = false) => Scribble({ d: 'M1 1 L2 2', colour: 'mint', tokens, sinceFrames, exiting })
const markup = (frame: number) => renderToStaticMarkup(React.createElement(Device, {
  object, events, tokens, frame, box: { left: 0, top: 0, width: 1080, height: 1920 }, aspect: '9:16',
}))

describe('scribble draw and exit', () => {
  it('clamps draw-on progress, completing in ten frames', () => {
    expect(tree(0).props.children[0].props.strokeDashoffset).toBe(1)
    expect(tree(10).props.children[0].props.strokeDashoffset).toBe(0)
    const half = tree(5).props.children[0].props.strokeDashoffset
    expect(half).toBeGreaterThan(0)
    expect(half).toBeLessThan(1)
    for (let f = -10; f < 40; f++) {
      expect(tree(f).props.children[0].props.strokeDashoffset).toBeGreaterThanOrEqual(0)
      expect(tree(f).props.children[0].props.strokeDashoffset).toBeLessThanOrEqual(1)
    }
  })
  it('draws the ink keyline first and uses only supplied tokens', () => {
    const svg = tree(5)
    expect(svg.props.children[0].props).toMatchObject({ stroke: tokens.ink, strokeWidth: 16, pathLength: 1, strokeDasharray: 1 })
    expect(svg.props.children[1].props).toMatchObject({ stroke: tokens.mint, strokeWidth: 8, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' })
    expect(svg.props).toMatchObject({ width: 1080, height: 1920, viewBox: '0 0 1080 1920' })
    expect(renderToStaticMarkup(svg)).not.toMatch(/#|overflow/)
    expect(Scribble({ d: 'M1 1 L2 2', colour: 'cream', tokens, sinceFrames: 10 }).props.children[1].props.stroke).toBe(tokens.cream)
  })
  it('renders nothing before draw, then fades to zero over six exit frames', () => {
    expect(markup(9)).toBe('')
    expect(at(10)).toMatchObject({ visible: true, sinceFrames: 0, exiting: false })
    expect(markup(10)).toContain('stroke-dashoffset="1"')
    expect(markup(20)).toContain('stroke-dashoffset="0"')
    expect(tree(0, true).props.style.opacity).toBe(1)
    expect(tree(3, true).props.style.opacity).toBeGreaterThan(0)
    expect(tree(3, true).props.style.opacity).toBeLessThan(1)
    expect(markup(66)).toContain('opacity:0')
    expect(markup(120)).toBe('')
    expect(markup(30)).not.toMatch(/#|overflow/)
  })
  it('supports backward seeks, unsorted events, unrelated objects and redraw', () => {
    expect(scribbleState(object, [...events].reverse(), 35)).toEqual(at(35))
    expect(scribbleState(object, [...events, { ...events[1]!, obj: 'other' }], 65)).toEqual(at(65))
    const redraw = { ...events[0]!, id: 'redraw', atFrame: 80 }
    expect(scribbleState(object, [...events, redraw], 80)).toMatchObject({ visible: true, sinceFrames: 0, exiting: false })
    expect(markup(9)).toBe('')
  })
  it('requires shape-specific geometry and resolves perspective vectors', () => {
    expect(ParamsSchema.safeParse({ shape: 'loop', colour: 'mint', seed: 'x' }).success).toBe(false)
    expect(ParamsSchema.safeParse({ shape: 'arrow', colour: 'mint', seed: 'x', from: [0, 0] }).success).toBe(false)
    const params = { shape: 'loop', cx: 500, cy: 600, colour: 'cream', seed: 'x', perspective: { u: [150, 30], v: [20, 90] } }
    expect(ParamsSchema.safeParse(params).success).toBe(true)
    expect(scribbleState({ ...object, params }, events, 30).d).not.toMatch(/NaN/)
  })
})
