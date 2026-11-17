import { describe, expect, it } from 'vitest'
import * as T from 'three'
import fixture from './fixture.json'
import type { EngineEvent, EngineObject } from '../../props'
import { screenState } from './state'
import { cameraFor,viewport,safeBox } from './index'
const object=fixture.object as EngineObject,events=fixture.events as EngineEvent[]
const at=(f:number)=>screenState(object,events,f)
const tokens={ink:'black',inkDeep:'black',inkSoft:'dimgray',cream:'ivory',mint:'aquamarine',channel:'coral'}
it('shows nothing before enter and goes dark on exit',()=>{expect(at(0).visible).toBe(false);expect(at(20).visible).toBe(true);expect(at(460).visible).toBe(false)})
it('lands the sourced count exactly and retains the struck old value',()=>{expect(at(88).values.staff).toBe(13);expect(at(79).values.staff).toBe(16.5);expect(at(100).old.staff).toBe(20);expect(at(100).mark).toBe('staff')})
it('changes the selected panel, reveals expected before actual, and opens slots',()=>{expect(at(240).tab).toBe('Customers');expect(at(160).expected).toBeGreaterThan(0);expect(at(160).real).toBe(0);expect(at(210).real).toBe(1);expect(at(320).copies).toBe(4)})
it('rejects unsourced counts',()=>{expect(()=>screenState({...object,dataset:{...object.dataset!,rows:object.dataset!.rows.filter(r=>r.label!=='staff:new')}},events,100)).toThrow(/unsourced/)})
it('fills the tall slot and keeps a moving deterministic camera',()=>{
 for(const aspect of ['9:16','16:9'] as const){
 const p={object,events,frame:65,tokens,aspect,box:{left:0,top:0,width:aspect==='9:16'?1080:1920,height:aspect==='9:16'?1920:1080}}
 const v=viewport(p)
 if(aspect==='9:16')expect(v).toEqual({left:0,top:270,width:1080,height:1650})
 for(let frame=20;frame<440;frame++){
  const a=cameraFor({...p,frame}),b=cameraFor({...p,frame:frame+6})
  expect(a.eye.distanceTo(b.eye)).toBeGreaterThan(0)
  expect(a.eye.toArray()).toEqual(cameraFor({...p,frame}).eye.toArray())
  const camera=new T.PerspectiveCamera(36,v.width/v.height,.1,100)
  camera.position.copy(a.eye);camera.rotation.copy(a.rotation);camera.updateMatrixWorld()
  const corners=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>new T.Vector3(x!*5*v.width/v.height*1.12,y!*5.6,0).project(camera))
  expect(Math.min(...corners.map(c=>c.x))).toBeLessThan(-1)
  expect(Math.max(...corners.map(c=>c.x))).toBeGreaterThan(1)
  expect(Math.min(...corners.map(c=>c.y))).toBeLessThan(-1)
  expect(Math.max(...corners.map(c=>c.y))).toBeGreaterThan(1)
 }
 }
})
it('schedules at least 150 replayable UI events in a 54 second cut',async()=>{
 const {activityEvents,activityAt}=await import('./state')
 const long={...object,toFrame:1620}
 const cues=activityEvents(long,events)
 expect(cues.length).toBeGreaterThanOrEqual(150)
 expect(cues.slice(1).every((e,i)=>e.atFrame-cues[i]!.atFrame===8)).toBe(true)
 expect(activityAt(long,events,100)).toEqual(activityAt(long,events,100))
})

describe('living_screen count text', () => {
  it('never shows decimals its sources do not carry', async () => {
    const { countText } = await import('./index')
    expect(countText(18.8333, [20, 13])).toBe('19')
    expect(countText(21.5, [0, 43])).toBe('22')
    expect(countText(1.234, [1.5, 2.25])).toBe('1.23')
  })
})
