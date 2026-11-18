import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import { overlayTestProps } from '../../kit/overlayInvariants'
import { Device, facilityLayout, type Rect } from './index'
import { drift } from '../../clock'
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


describe('facility_block slot treatment',()=>{
  for(const aspect of ['9:16','16:9'] as const) {
    const box = {left:0,top:0,width:aspect==='9:16'?800:1920,height:aspect==='9:16'?770:1080}
    const draw = (frame:number,cues=events) => renderToStaticMarkup(React.createElement(Device,{...overlayTestProps,object,events:cues,frame,aspect,box}))
    it(`${aspect} leaves the backdrop visible and labels on ink pills`,()=>{
      const markup=draw(200)
      for(const rect of markup.matchAll(/<rect\b[^>]*>/g)) {
        expect(rect[0]).not.toContain(`width="${box.width}" height="${box.height}"`)
      }
      const texts=[...markup.matchAll(/<text\b[^>]*>/g)]
      expect(texts.length).toBeGreaterThan(0)
      for(const [text] of texts) {
        expect(Number(text.match(/font-size="([^"]+)"/)![1])).toBeGreaterThanOrEqual(34)
        expect(text).toContain(`fill="${overlayTestProps.tokens.cream}"`)
      }
      expect(markup).toContain(`rx="`)
      expect(markup).toContain(`fill="${overlayTestProps.tokens.inkDeep}"`)
    })
    it(`${aspect} keeps the final grown copy footprint above sixty percent`,()=>{
      const markup=draw(350)
      const outerScale=Math.min(box.width/(aspect==='9:16'?780:1400),box.height/(aspect==='9:16'?740:780))
      const bodyScale=Number(markup.match(/data-facility-body="" transform="translate\([^)]*\) scale\(([^ ]+) /)![1])
      const cols=aspect==='9:16'?4:6
      const rows=Math.ceil(fixture.objects[0]!.params.copies.count/cols)
      const spacingY=Math.min(90,440/Math.max(1,rows-1))
      const gridWidth=(cols-1)*(aspect==='9:16'?175:190)+285*Math.min(.48,spacingY/160)
      expect(gridWidth*bodyScale*outerScale).toBeGreaterThanOrEqual(box.width*.6)
    })
    it(`${aspect} centres a settled shell spanning at least sixty percent of the slot`,()=>{
      const markup=draw(50,[events[0]!])
      const outerScale=Math.min(box.width/(aspect==='9:16'?780:1400),box.height/(aspect==='9:16'?740:780))
      const body=markup.match(/data-facility-body="" transform="translate\(([^ ]+) [^)]+\) scale\(([^ ]+) /)!
      const x=Number(body[1]), scale=Number(body[2])
      expect(285*scale*outerScale).toBeGreaterThanOrEqual(box.width*.6)
      const naturalWidth=aspect==='9:16'?780:1400
      expect((box.width-naturalWidth*outerScale)/2+(x+2.5*scale)*outerScale).toBeCloseTo(box.width/2)
    })
  }
})

// Check screen-space geometry on every frame, including all verb endpoints.
describe('facility evidence layout',()=>{
  const intersects=(a:Rect,b:Rect)=>a.x<b.x+b.width&&a.x+a.width>b.x&&a.y<b.y+b.height&&a.y+a.height>b.y
  for(const aspect of ['9:16','16:9'] as const) {
    const box={left:0,top:0,width:aspect==='9:16'?800:1920,height:aspect==='9:16'?770:1080}
    it(`${aspect} keeps evidence inside the slot and outside the full body throughout each verb`,()=>{
      for(let frame=30;frame<=410;frame++) {
        const layout=facilityLayout(box,aspect,state(frame),ParamsSchema.parse(object.params),1+drift(frame,object.fromFrame,object.toFrame,1))
        const rects=[...layout.receipts,layout.tag]
        for(const [i,r] of rects.entries()) {
          expect(r.x,`frame ${frame}`).toBeGreaterThanOrEqual(0)
          expect(r.y).toBeGreaterThanOrEqual(0)
          expect(r.x+r.width).toBeLessThanOrEqual(box.width)
          expect(r.y+r.height).toBeLessThanOrEqual(box.height)
          expect(intersects(r,layout.block),`body frame ${frame}`).toBe(false)
          for(const other of rects.slice(i+1)) expect(intersects(r,other)).toBe(false)
        }
      }
    })
    it(`${aspect} draws papers and tag after the body`,()=>{
      const markup=html(200,aspect)
      expect(markup.indexOf('data-facility-receipt')).toBeGreaterThan(markup.indexOf('data-facility-body'))
      expect(markup.indexOf('data-facility-tag')).toBeGreaterThan(markup.indexOf('data-facility-receipt'))
    })
  }
})
