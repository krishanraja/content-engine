import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { expect, it, vi } from 'vitest'
import fixture from './fixture.json'
import type { EngineEvent, EngineObject } from '../../props'
import { ladderState } from './state'
import { buildSet, cameraAt, Device } from './index'
import * as T from 'three'
const object=fixture.object as EngineObject, events=fixture.events as EngineEvent[]
const tokens={ink:'black',inkDeep:'black',inkSoft:'dimgray',cream:'ivory',mint:'aquamarine',channel:'coral'}
const at=(frame:number)=>ladderState(object,events,frame)
it('enters, counts exactly, drops copies, draws, fills and exits',()=>{
  expect(at(0).visible).toBe(false)
  expect(at(60).count).toBe(20)
  expect(at(100).count).toBe(13)
  expect(at(165).copies).toBe(3)
  expect(at(200).draw).toBeDefined()
  expect(at(290).heights).toEqual({left:13,right:10})
  expect(at(1620).visible).toBe(false)
})
it('rejects unsourced numbers and invalid parameters',()=>{
  expect(()=>ladderState({...object,dataset:undefined},events,60)).toThrow(/sourced/)
  expect(()=>ladderState({...object,params:{parts:0}},events,60)).toThrow()
})
it('builds identical scene geometry and token material inputs at a repeated frame',()=>{
  for(const aspect of ['9:16','16:9'] as const){
    const make=()=>buildSet({object,events,frame:100,aspect,tokens,box:{left:0,top:0,width:1080,height:1920}}).root
    const summary=(root:T.Group)=>{const out:unknown[]=[];root.traverse(o=>{
      if(o instanceof T.Mesh)out.push([o.position.toArray(),o.visible,(o.material as T.MeshStandardMaterial).color.getStyle()])
    });return out}
    expect(summary(make())).toEqual(summary(make()))
    const root=make()
    const glass:T.Mesh[]=[];root.traverse(o=>{
      // RoundedBoxGeometry reports width 1 in parameters and bakes the size into its vertices; measure it.
      if(!(o instanceof T.Mesh))return;o.geometry.computeBoundingBox();const b=o.geometry.boundingBox!
      if(Math.abs(b.max.x-b.min.x-0.62)<1e-6)glass.push(o)})
    expect(glass.filter(g=>(g.material as T.MeshStandardMaterial).emissiveIntensity>1)).toHaveLength(13)
  }
})

// WebGL pixels are checked by verify-card; these tests exercise the actual camera and DOM.
vi.mock('@remotion/three',()=>({ThreeCanvas:()=>React.createElement('div',{'data-canvas':'three'})}))
const props=(frame:number,aspect:'9:16'|'16:9'='9:16')=>({object,events,frame,aspect,tokens,
  box:{left:0,top:0,width:aspect==='9:16'?1080:1920,height:aspect==='9:16'?1920:1080}})
it('moves the camera over every six-frame interval throughout the 54 second fixture',()=>{
  for(const aspect of ['9:16','16:9'] as const)
    for(let f=8;f<1608;f++) {
      const a=cameraAt(props(f,aspect)), b=cameraAt(props(f+6,aspect))
      expect(a.eye.distanceTo(b.eye)).toBeGreaterThan(0.001)
      expect(a.eye.toArray()).toEqual(cameraAt(props(f,aspect)).eye.toArray())
    }
})
it('has authored detail events less than 0.3 seconds apart without changing sourced counts',()=>{
  const details=events.filter(e=>e.id.startsWith('detail-'))
  expect(details.length/54).toBeGreaterThanOrEqual(3)
  expect(details.every((e,i)=>i===0||e.atFrame-details[i-1]!.atFrame<9)).toBe(true)
  expect(at(60).count).toBe(20)
  expect(at(100).count).toBe(13)
})
it('renders both aspect shells deterministically, with safe type and no caption box',()=>{
  for(const aspect of ['9:16','16:9'] as const) {
    const p=props(100,aspect)
    const html=renderToStaticMarkup(React.createElement(Device,p))
    expect(html).toEqual(renderToStaticMarkup(React.createElement(Device,p)))
    expect(html).toContain('data-canvas="three"')
    expect(html).toContain('IMF')
    expect(html).not.toMatch(/caption|590px/)
  }
})
it('settles an entrance in seven frames and both count directions in eighteen',()=>{
  expect(at(8).rise).toBe(1)
  expect(at(58).count).toBe(20)
  expect(at(98).count).toBe(13)
})
