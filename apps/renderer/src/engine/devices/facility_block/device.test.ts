import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { overlayTestProps } from '../../kit/overlayInvariants'
import { Device } from './index'
import { facilityState } from './state'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e => EngineEventSchema.parse(e))
const state = (frame:number) => facilityState({object,events,frame})
const html = (frame:number, aspect:'9:16'|'16:9'='9:16', cues=events) => renderToStaticMarkup(React.createElement(Device,{...overlayTestProps,object,events:cues,frame,aspect,box:{left:0,top:0,width:aspect==='9:16'?1080:1920,height:aspect==='9:16'?1920:1080}}))

describe('facility_block',()=>{
  it('every cue changes the building drawing, settles within eighteen frames',()=>{
    for(const e of events.slice(1,-1)) {
      const before = facilityState({object,events,frame:e.atFrame-1})
      const after = state(e.atFrame+18)
      expect(after).not.toEqual(before)
      // The drawing changes: the tag that flies and the copies that are stamped are drawn beside the body group.
      expect(html(e.atFrame+18)).not.toEqual(html(e.atFrame-1))
    }
    expect(html(10)).toBe('')
    expect(html(450)).toBe('')
  })
  it('connect drains real windows in sequence and grey keeps the exact requested identities',()=>{
    expect(state(90).lights).toBe(18)
    expect(state(110).lights).toBeLessThan(state(90).lights)
    expect(state(120).lights).toBe(0)
    expect(state(330).unstamped).toBe(3)
    const markup=html(330)
    expect((markup.match(/data-block=/g)||[])).toHaveLength(12)
    expect((markup.match(/data-lit="true"/g)||[])).toHaveLength(0)
  })
  it('rejects unregistered marks, excess words and impossible copy counts',()=>{
    expect(ParamsSchema.safeParse({label:'Place',logo:'invented-logo'}).success).toBe(false)
    expect(ParamsSchema.safeParse({label:'one two three four'}).success).toBe(false)
    expect(ParamsSchema.safeParse({label:'Place',copies:{count:2,kept:3}}).success).toBe(false)
    expect(()=>html(400,'9:16',[events[0]!,{...events[7]!,atFrame:40,toState:'target:4'}])).toThrow('existing target')
  })
  it('renders authored tall and wide stills deterministically using only token colours',()=>{
    for(const aspect of ['9:16','16:9'] as const) for(const frame of fixture.stills) {
      const markup=html(frame,aspect)
      expect(markup).toBe(html(frame,aspect))
      expect(markup).not.toMatch(/NaN|Infinity/)
      for(const m of markup.matchAll(/(?:fill|stroke)="([^"]+)"/g)) expect([...Object.values(overlayTestProps.tokens),'none']).toContain(m[1])
    }
    expect(html(125)).not.toBe(html(126))
    expect(state(330)).toEqual(facilityState({object,events:[...events].reverse(),frame:330}))
    expect(html(125,'9:16')).not.toBe(html(125,'16:9'))
  })
})
