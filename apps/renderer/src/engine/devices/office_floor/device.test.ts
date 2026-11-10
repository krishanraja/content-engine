import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device } from './index'
import { officeState } from './state'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e=>EngineEventSchema.parse(e))
const tokens = { ink:'black', inkDeep:'black', inkSoft:'gray', cream:'ivory', mint:'aquamarine', channel:'coral' }
const state = (frame:number) => officeState({object,events,frame})
const render = (frame:number, slot=fixture.slots[0]!) => renderToStaticMarkup(React.createElement(Device,{object,events,tokens,frame,box:slot.box,aspect:slot.aspect as DeviceProps['aspect']}))
describe('office floor',()=>{
  it('waits for entrance and each individual add',()=>{
    expect(state(9)).toBeNull()
    expect(render(9)).toBe('')
    expect(render(37)).not.toContain('data-figure=')
    expect(render(46)).toContain('data-figure="a"')
    expect(render(46)).not.toContain('data-figure="b"')
  })
  it('moves markers to ranks and leaves them in place when work ships',()=>{
    expect(state(200)!.figures.map(f=>f.rank)).toEqual([1,2,3])
    expect(state(290)!.figures.map(f=>f.marker)).toEqual(state(260)!.figures.map(f=>f.marker))
    expect(render(280)).toContain('data-shipment="c"')
    expect(render(280)).toContain('data-bell="true"')
  })
  it('shows exactly three agents, a moving target, and a fallen tower',()=>{
    expect([...render(220).matchAll(/data-agent=/g)]).toHaveLength(3)
    expect(state(310)!.target).toBeCloseTo(.9)
    expect(state(330)!.target).toBeCloseTo(.3)
    expect(state(354)!.topple).toBe(1)
    expect(render(354)).toContain('rotate(76)')
    expect(render(380)).toBe('')
  })
  it('fills the meter, transfers coins, stamps and highlights real work',()=>{
    expect(state(150)!.meter).toBeCloseTo(.8)
    expect(render(128)).toContain('data-coin="a"')
    expect(render(250)).toContain('TOKEN LEGEND')
    expect(state(300)!.highlight).toBe('c')
    expect(render(300)).toContain('fill="aquamarine"')
  })
  it('replays sorted events and resets on reentry',()=>{
    expect(officeState({object,events:[...events].reverse(),frame:250})).toEqual(state(250))
    const reset = officeState({object,events:[...events,{...events[0]!,atFrame:400}],frame:410})!
    expect(reset.meter).toBe(0)
    expect(reset.figures.every(f=>f.added===undefined)).toBe(true)
  })
  it('rejects malformed params',()=>{
    expect(ParamsSchema.safeParse({...object.params,figures:[{id:'a'},{id:'a'},{id:'b'}]}).success).toBe(false)
    expect(ParamsSchema.safeParse({...object.params,target:2}).success).toBe(false)
  })
  it('renders every still in tall upper-half and wide left-two-thirds slots with token fills only',()=>{
    for(const slot of fixture.slots) for(const frame of fixture.stills) {
      const svg=render(frame,slot)
      expect(svg).not.toMatch(/NaN|Infinity/)
      for(const m of svg.matchAll(/(?:fill|stroke)="([^"]+)"/g)) expect(['none',...Object.values(tokens)]).toContain(m[1])
      if(svg) expect(svg).toContain('overflow:hidden')
    }
  })
})
