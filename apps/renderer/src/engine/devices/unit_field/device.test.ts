import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { overlayTestProps } from '../../kit/overlayInvariants'
import { markRegion } from '../../kit/layout'
import { Device } from './index'
import { dotGridPosition, UnitMark } from './grid'
import { unitFieldState } from './state'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const at = (frame: number) => unitFieldState(object, events, frame)
const html = (frame: number, aspect: '9:16' | '16:9' = '9:16', region = false, block = false) => renderToStaticMarkup(React.createElement(Device, {
  ...overlayTestProps, object: block ? { ...object, params: { ...object.params, mark: 'block' } } : object,
  events, frame, aspect, box: region ? markRegion({left: 60, top: 280, width: 800, height: 720})
    : {left: 0, top: 0, width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080},
}))

describe('unit_field', () => {
  it('keeps the original twenty identities and denominator through seven losses', () => {
    expect(at(0).count).toBe(20)
    expect(at(29).count).toBe(20)
    expect(at(30).count).toBe(20)
    expect(at(35).count).toBe(16.5)
    expect(at(40).count).toBe(13)
    expect(at(40).marks.filter(m => m.amount > 0).map(m => m.id)).toEqual(Array.from({length:13}, (_, i) => i))
    for (const frame of fixture.stills) expect(at(frame).denominator).toBe(20)
    expect(at(40).marks).toHaveLength(20)
    expect(html(40)).not.toContain('data-unit="13"')
  })
  it('adds copies every two frames and preserves the fractional 43% exactly', () => {
    expect(at(70).count).toBe(13)
    expect(at(71).marks.filter(m => m.bornAt !== undefined && m.birth > 0)).toHaveLength(1)
    expect(at(72).marks.filter(m => m.bornAt !== undefined && m.birth > 0)).toHaveLength(1)
    expect(at(73).marks.filter(m => m.bornAt !== undefined && m.birth > 0)).toHaveLength(2)
    expect(at(90).count).toBeCloseTo(18.59, 8)
    expect(at(90).marks.at(-1)!.weight).toBeCloseTo(.59, 8)
    expect(at(90).marks.filter(m => m.bornAt !== undefined).map(m => m.bornAt)).toEqual([70,72,74,76,78,80])
    expect(html(100)).toContain('data-count="18.59"')
    expect(at(90).marks.slice(20).map(m => m.source)).toEqual([0,1,2,3,4,5])
  })
  it('greys exactly three whole units over ten frames without changing count', () => {
    expect(at(120).marks.filter(m => m.grey > 0)).toHaveLength(0)
    expect(at(125).marks.filter(m => m.grey === .5)).toHaveLength(3)
    expect(at(130).marks.filter(m => m.grey === 1)).toHaveLength(3)
    expect(at(140).count).toBeCloseTo(18.59)
    expect(html(140)).toContain('fill="gray"')
  })
  it('is deterministic, ignores other objects, and resets only on reentry', () => {
    expect(unitFieldState(object, [...events].reverse(), 140)).toEqual(at(140))
    expect(unitFieldState(object, [...events, {...events[1]!, obj:'other'}], 140)).toEqual(at(140))
    expect(unitFieldState(object, [...events, {...events[0]!, id:'again', atFrame:150}], 160).count).toBe(20)
    expect(html(210)).toBe('')
    expect(html(240)).toBe('')
    expect(unitFieldState(object, events.slice(1), 50).visible).toBe(false)
  })
  it('renders both authored aspects, both marks and region fitting with a producer', () => {
    for (const aspect of ['9:16', '16:9'] as const) for (const region of [false,true]) for (const block of [false,true]) {
      for (const frame of fixture.stills) {
        const markup = html(frame, aspect, region, block)
        if (!markup) continue
        expect(markup).toContain('FIXTURE STUDY')
        expect(markup).toContain('2026-11-13')
        expect(markup).not.toMatch(/NaN|Infinity|#[0-9a-f]{3,8}\b/)
        if (region) expect(markup).toContain('data-region-fit')
      }
    }
    expect(html(100)).not.toEqual(html(101)) // slow non-repeating push
    const transform = (f: number) => html(f).match(/<g transform="([^"]+)"/)![1]!.replace(/scale\([^)]*\)/, '')
    expect(transform(20)).toEqual(transform(100)) // no re-layout when copies arrive
    expect(dotGridPosition(7,5)).toEqual({x:128,y:64})
    expect(renderToStaticMarkup(React.createElement(UnitMark, {kind:'dot',weight:.5,colour:'ivory',soft:'gray'}))).toContain('A19 19')
  })
  it('supports a single isometric block copying itself to a stated factor', () => {
    const block = {...object, params: {...object.params, mark:'block'}, dataset: {...object.dataset!, rows:[{label:'initial',value:1},{label:'three',value:3}]}}
    const cues = [events[0]!, {...events[2]!, atFrame:30, toState:'three'}]
    expect(unitFieldState(block,cues,29).count).toBe(1)
    expect(unitFieldState(block,cues,31).marks.filter(m => m.birth>0)).toHaveLength(2)
    expect(unitFieldState(block,cues,42).count).toBe(3)
  })
  it('rejects absent provenance, ambiguous rows, invalid counts and growth overflow', () => {
    expect(() => unitFieldState({...object,dataset:undefined},events,0)).toThrow('requires a dataset')
    expect(EngineObjectSchema.safeParse({...object,dataset:{...object.dataset,producerLabel:''}}).success).toBe(false)
    for (const value of [-1, 1.5, 30]) {
      const bad = {...object,dataset:{...object.dataset!,rows:object.dataset!.rows.map(r=>r.label==='lost'?{...r,value}:r)}}
      expect(()=>unitFieldState(bad,events,40)).toThrow()
    }
    expect(()=>unitFieldState(object,[...events,{...events[1]!,id:'bad',toState:'absent',atFrame:45}],50)).toThrow('dataset row')
    expect(ParamsSchema.safeParse({columns:0}).success).toBe(false)
    const huge = {...object,dataset:{...object.dataset!,rows:object.dataset!.rows.map(r=>r.label==='growth'?{...r,value:100}:r)}}
    expect(()=>unitFieldState(huge,events,100)).toThrow('1000 marks')
  })
})
