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
it('centres the selected card and contains both authored viewports',()=>{
 for(const aspect of ['9:16','16:9'] as const){
 const p={object,events,frame:65,tokens,aspect,box:{left:0,top:0,width:aspect==='9:16'?1080:1920,height:aspect==='9:16'?1920:1080}}
 const a=cameraFor(p),camera=new T.PerspectiveCamera(36,viewport(p).width/viewport(p).height,.1,100)
 camera.position.copy(a.eye);camera.rotation.copy(a.rotation);camera.updateMatrixWorld()
 const centre=new T.Vector3((420/2400-.5)*6,(.5-380/1600)*4,0).project(camera)
 const v=viewport(p),safe=safeBox(p)
 // The card being read lands in the centre of the safe box (the words-safe zone in 9:16), on a canvas filling the frame.
 expect(Math.abs(centre.x-((safe.left+safe.width/2)/v.width*2-1))).toBeLessThan(.05)
 expect(Math.abs(centre.y-(1-(safe.top+safe.height/2)/v.height*2))).toBeLessThan(.05)
 expect(v).toEqual({left:0,top:0,width:p.box.width,height:p.box.height})
 expect(cameraFor(p).eye.toArray()).toEqual(a.eye.toArray())
 if(aspect==='9:16'){expect(safe.left).toBeGreaterThanOrEqual(60);expect(safe.left+safe.width).toBeLessThanOrEqual(860);expect(safe.top+safe.height).toBeLessThanOrEqual(1080)}
 }
})

describe('living_screen count text', () => {
  it('never shows decimals its sources do not carry', async () => {
    const { countText } = await import('./index')
    expect(countText(18.8333, [20, 13])).toBe('19')
    expect(countText(21.5, [0, 43])).toBe('22')
    expect(countText(1.234, [1.5, 2.25])).toBe('1.23')
  })
})
