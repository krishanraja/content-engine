import { describe, expect, it } from 'vitest'

import fixture from './fixture.json'
import type { EngineEvent, EngineObject } from '../../props'
import { screenState } from './state'
import { cameraFor,viewport,projectScreen } from './index'
const object=fixture.object as EngineObject,events=fixture.events as EngineEvent[]
const at=(f:number)=>screenState(object,events,f)
const tokens={ink:'black',inkDeep:'black',inkSoft:'dimgray',cream:'ivory',mint:'aquamarine',channel:'coral'}
it('shows nothing before enter and goes dark on exit',()=>{expect(at(0).visible).toBe(false);expect(at(20).visible).toBe(true);expect(at(460).visible).toBe(false)})
it('lands the sourced count exactly and retains the struck old value',()=>{expect(at(88).values.staff).toBe(13);expect(at(79).values.staff).toBe(16.5);expect(at(100).old.staff).toBe(20);expect(at(100).mark).toBe('staff')})
it('changes the selected panel, reveals expected before actual, and opens slots',()=>{expect(at(240).tab).toBe('Customers');expect(at(160).expected).toBeGreaterThan(0);expect(at(150).real).toBe(0);expect(at(210).real).toBe(1);expect(at(320).copies).toBe(4)})
it('rejects unsourced counts',()=>{expect(()=>screenState({...object,dataset:{...object.dataset!,rows:object.dataset!.rows.filter(r=>r.label!=='staff:new')}},events,100)).toThrow(/unsourced/)})
it('fills the tall slot and keeps a moving deterministic camera',()=>{
 for(const aspect of ['9:16','16:9'] as const){
 const p={object,events,frame:65,tokens,aspect,box:{left:0,top:0,width:aspect==='9:16'?1080:1920,height:aspect==='9:16'?1920:1080}}
 const v=viewport(p)
 if(aspect==='9:16')expect(v).toEqual({left:24,top:270,width:1032,height:1050})
 for(let frame=20;frame<440;frame++){
  const a=cameraFor({...p,frame}),b=cameraFor({...p,frame:frame+6})
  expect(a.eye.distanceTo(b.eye)).toBeGreaterThan(0)
  expect(a.eye.toArray()).toEqual(cameraFor({...p,frame}).eye.toArray())
  const corners=[[0,0],[1,0],[1,1],[0,1]].map(([x,y])=>projectScreen({...p,frame},x!,y!))
  for(const c of corners){expect(c.x).toBeGreaterThanOrEqual(v.left);expect(c.x).toBeLessThanOrEqual(v.left+v.width);expect(c.y).toBeGreaterThanOrEqual(v.top);expect(c.y).toBeLessThanOrEqual(v.top+v.height)}
  const area=Math.abs(corners.reduce((sum,c,i)=>{const n=corners[(i+1)%4]!;return sum+c.x*n.y-n.x*c.y},0))/2
  expect(area/(v.width*v.height)).toBeGreaterThanOrEqual(.7)
 }
 }
})
it('schedules at least 150 replayable UI events in a 54 second cut',async()=>{
 const {activityEvents,activityAt}=await import('./state')
 const long={...object,toFrame:1620}
 const longEvents=events.filter(e=>e.verb!=='exit')
 const cues=activityEvents(long,longEvents)
 expect(cues.length).toBeGreaterThanOrEqual(150)
 expect(cues.slice(1).every((e,i)=>e.atFrame-cues[i]!.atFrame===8)).toBe(true)
 expect(activityAt(long,longEvents,100)).toEqual(activityAt(long,longEvents,100))
 expect(activityEvents(object,events).every(e=>e.atFrame<450)).toBe(true)
})

describe('living_screen count text', () => {
  it('never shows decimals its sources do not carry', async () => {
    const { countText } = await import('./index')
    expect(countText(18.8333, [20, 13])).toBe('19')
    expect(countText(21.5, [0, 43])).toBe('22')
    expect(countText(1.234, [1.5, 2.25])).toBe('1.23')
  })
})

// Exercise the actual texture painter without requiring a GPU in the build lane.
// This is command determinism; rendered pixel identity is a separate render gate.
it('paints repeatable token-only stills in both shapes without a caption layer', async()=>{
 const {paint,Device}=await import('./index')
 for(const aspect of ['9:16','16:9'] as const)for(const frame of fixture.stills){
  const p={object,events,frame,tokens,aspect,box:{left:0,top:0,width:aspect==='9:16'?1080:1920,height:aspect==='9:16'?1920:1080}}
  const render=()=>{
   const calls:unknown[]=[]
   const target:Record<string,unknown>={}
   const g=new Proxy(target,{
    get:(o,key)=>key in o?o[String(key)]:(...args:unknown[])=>{calls.push([key,...args])},
    set:(o,key,value)=>{if(key==='fillStyle'||key==='strokeStyle')expect(Object.values(tokens)).toContain(value);o[String(key)]=value;calls.push([key,value]);return true},
   }) as unknown as CanvasRenderingContext2D
   paint(g,p);return calls
  }
  expect(render()).toEqual(render())
  if(at(frame).visible){const tree=Device(p)!;expect(tree.props['data-device']).toBe('living_screen');expect(tree.props.children.props.children.type.name).toBe('ThreeCanvas')}
 }
})
