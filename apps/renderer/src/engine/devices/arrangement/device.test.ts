import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it } from 'vitest'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import { Device, arrangementState } from './index'
import fixture from './fixture.json'
const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(e=>EngineEventSchema.parse(e))
const tokens = {ink:'black',inkDeep:'black',inkSoft:'gray',cream:'ivory',mint:'aqua',channel:'coral'}
const state = (frame:number)=>arrangementState({object,events,frame})!
it('only enters on cue, types two characters per frame and reveals hidden lanes on cue',()=>{
 expect(state(9)).toBeNull()
 expect(state(45).lanes.find(l=>l.id==='choir')!.visible).toBe(false)
 expect(state(53).prompt!.text).toBe('add a ')
 expect(state(80).lanes.find(l=>l.id==='choir')!.visible).toBe(true)
 expect(state(79).lanes.find(l=>l.id==='sitar')!.visible).toBe(false)
 expect(state(80).lanes.find(l=>l.id==='sitar')!.visible).toBe(true)
})
it('removes marked rows, persists pins, solos and weights the hum',()=>{
 expect(state(130).lanes.find(l=>l.id==='chords')!.removed).toBe(true)
 expect(state(130).lanes.find(l=>l.id==='voice')).toMatchObject({pin:true,removed:false})
 expect(state(155).solo).toBe('voice')
 expect(state(155).lanes.find(l=>l.id==='voice')!.layers.map(l=>l.weight)).toEqual([.85,.15])
 expect(state(190).solo).toBe('')
})
it('renders every golden within all three boxes, using tokens and moving the playhead',()=>{
 for(const [width,height] of [[1080,1920],[1920,1080],[1260,1080]] as const) {
  const render=(frame:number)=>renderToStaticMarkup(React.createElement(Device,{object,events,tokens,frame,aspect:height===1920?'9:16':'16:9',box:{left:20,top:30,width,height}}))
  expect(render(9)).toBe('')
  for(const frame of fixture.stills){const html=render(frame);expect(html).toContain('overflow:hidden');expect(html).not.toMatch(/#[a-f0-9]{3,8}\b/i)}
  expect(render(155)).toContain('opacity:0.4')
  expect(render(155)).toContain('height:85%')
  expect(render(155)).toContain('45deg')
  expect(render(100).match(/data-playhead.*?left:([\d.]+)/)?.[1]).not.toBe(render(101).match(/data-playhead.*?left:([\d.]+)/)?.[1])
  expect(render(250)).toBe('')
 }
})

it('fills the stack, labels sixteen bars, and keeps the opening labels distinct in every box',()=>{
 for(const [width,height] of [[1080,1920],[1920,1080],[1260,1080]] as const){
  const render=(frame:number)=>renderToStaticMarkup(React.createElement(Device,{object,events,tokens,frame,aspect:height===1920?'9:16':'16:9',box:{left:0,top:0,width,height}}))
  for(const frame of fixture.stills){
   const html=render(frame)
   expect(Number(html.match(/data-height="([\d.]+)"/)![1])).toBeGreaterThanOrEqual(height*.7)
   expect([...html.matchAll(/data-bar="(\d+)"/g)].map(m=>Number(m[1]))).toEqual(Array.from({length:16},(_,i)=>i+1))
  }
  const ys=[...render(fixture.goldens.G1).matchAll(/data-y="([\d.]+)"/g)].map(m=>Number(m[1]))
  expect(new Set(ys).size).toBe(4)
  expect(Math.min(...ys.slice(1).map((y,i)=>y-ys[i]!))).toBeGreaterThan(100)
  expect(render(fixture.goldens.G1)).toContain('data-source-wave')
  const ai=render(fixture.goldens.G4)
  expect(ai).toContain('repeating-linear-gradient(45deg')
  expect(ai).toContain('30%')
  expect(ai).toContain('data-ai-flag')
  const credits=render(fixture.goldens.G7)
  for(const who of ['a healer','Suno','strangers on TikTok','HUGEL','Ultra Naté','the AI singer']) expect(credits).toContain(who)
  expect(state(fixture.goldens.G7).lanes.filter(l=>l.visible&&!l.removed).map(l=>l.kind)).toEqual(Array(6).fill('both'))
  expect(render(fixture.goldens.G2)).toContain('Splice pack')
  const lift=state(fixture.goldens.G5).lanes
  expect(lift.filter(l=>l.removed)).toHaveLength(2)
  expect(lift.filter(l=>l.pin)).toHaveLength(2)
  expect(render(fixture.goldens.G5)).toContain('translateY(-20px)')
 }
})
