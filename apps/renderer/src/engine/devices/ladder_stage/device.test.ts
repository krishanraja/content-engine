import { expect, it } from 'vitest'
import fixture from './fixture.json'
import type { EngineEvent, EngineObject } from '../../props'
import { ladderState } from './state'
import { buildSet } from './index'
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
  expect(at(560).visible).toBe(false)
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
    const glass:T.Mesh[]=[];root.traverse(o=>{if(o instanceof T.Mesh&&(o.geometry as T.BoxGeometry).parameters?.width===0.62)glass.push(o)})
    expect(glass.filter(g=>(g.material as T.MeshStandardMaterial).emissiveIntensity>1)).toHaveLength(13)
  }
})
