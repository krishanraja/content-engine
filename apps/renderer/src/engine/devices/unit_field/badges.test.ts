import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { overlayTestProps } from '../../kit/overlayInvariants'
import { Device } from './index'
import { scatterRank, unitFieldState } from './state'
import { ParamsSchema } from './schema'

/** The additive unit chart Krish asked to keep as it is (Krish, 2026-11-20: "this visual was really nice in how it
 *  explained additively what I was saying in the Anthropic jobs video"): 100 ID badges on a plane, the juniors striped,
 *  greying from the end of the grid, one change per spoken claim, the numeral bound to the grid. */
const object = EngineObjectSchema.parse({
  obj: 'jobs', device: 'unit_field', meaning: 'Out of every hundred, juniors were 27 and now just 9',
  params: { initialRow: 'hundred', columns: 10, mark: 'badge', plane: true, greyScope: 'striped', counter: { of: 'striped', suffix: '%', numeralPx: 230 } },
  dataset: { unit: 'people hired', denominator: 100, producerLabel: 'ANTHROPIC · OCT 2026',
    rows: [{ label: 'hundred', value: 100 }, { label: 'juniors', value: 27 }, { label: 'gone', value: 18 }] },
  fromFrame: 0, toFrame: 120,
})
const events = [
  { id: 'show', obj: 'jobs', verb: 'enter', toState: 'visible', atFrame: 0 },
  { id: 'juniors', obj: 'jobs', verb: 'stripe', toState: 'juniors', atFrame: 30 },
  { id: 'now', obj: 'jobs', verb: 'grey', toState: 'gone', atFrame: 60 },
].map(e => EngineEventSchema.parse(e))
const at = (frame: number) => unitFieldState(object, events, frame)
const box = { left: 0, top: 0, width: 1080, height: 1000 }
const html = (frame: number) => renderToStaticMarkup(React.createElement(Device, { ...overlayTestProps, object, events, frame, aspect: '9:16', box }))

describe('unit_field: the badge board', () => {
  it('stripes 27 of the hundred on "27", spread through the grid, and the counter reads them in the same frame', () => {
    expect(at(29).striped).toBe(0)
    expect(at(40).striped).toBe(27)
    expect(at(40).counted).toBe(27)
    const ids = at(40).marks.filter(m => m.stripe > 0).map(m => m.id)
    expect(ids).toHaveLength(27)
    expect(Math.max(...ids) - Math.min(...ids)).toBeGreaterThan(60) // spread, never a block at the start
    expect(at(40).count).toBe(100) // nothing leaves: the denominator holds
  })

  it('greys 18 juniors from the end of the grid on "9", leaving the first nine lit', () => {
    const s = at(80)
    expect(s.counted).toBe(9)
    const striped = s.marks.filter(m => m.stripe > 0)
    const lit = striped.filter(m => m.grey === 0).map(m => m.id)
    const grey = striped.filter(m => m.grey > 0).map(m => m.id)
    expect(lit).toHaveLength(9)
    expect(grey).toHaveLength(18)
    expect(Math.max(...lit)).toBeLessThan(Math.min(...grey))
    expect(s.marks.filter(m => m.stripe === 0 && m.grey > 0)).toHaveLength(0) // only juniors grey
  })

  it('one change per claim, each landing within its own 10 frames', () => {
    expect(at(30).striped).toBe(0)
    expect(at(40).striped).toBe(27)
    expect(at(60).counted).toBe(27)
    expect(at(70).counted).toBe(9)
  })

  it('draws badges on the 3D plane, the numeral with its suffix, and its source', () => {
    const markup = html(80)
    expect(markup).toContain('perspective(1600px) rotateX(24deg) rotateZ(-6deg) skewX(-4deg)')
    expect(markup).toContain('9%')
    expect(markup).toContain('ANTHROPIC · OCT 2026')
    expect(markup.match(/data-stripe="1"/g)).toHaveLength(27)
    expect(html(10)).not.toMatch(/>\d+%</) // no numeral before the first claim
  })

  it('keeps every old unit field as it was: the new options are off by default', () => {
    const params = ParamsSchema.parse({})
    expect([params.mark, params.order, params.greyScope, params.plane, params.counter]).toEqual(['dot', 'from_end', 'all', undefined, undefined])
    expect(scatterRank([0, 1, 2, 3], 4)).toHaveLength(4)
  })
})
