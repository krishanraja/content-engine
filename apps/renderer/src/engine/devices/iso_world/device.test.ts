import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device, project, routePoint, worldState, worldGeometry } from './index'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'
const object=EngineObjectSchema.parse(fixture.objects[0]), events=fixture.events.map(e=>EngineEventSchema.parse(e))
const tokens={ink:'black',inkDeep:'black',inkSoft:'gray',cream:'ivory',mint:'aqua',channel:'coral'}
const props=(frame:number,aspect:DeviceProps['aspect']='9:16'):DeviceProps=>({object,events,frame,aspect,tokens,box:{left:0,top:0,width:aspect==='9:16'?1080:1920,height:aspect==='9:16'?1920:1080}})
const still=(p:DeviceProps)=>renderToStaticMarkup(React.createElement(Device,p))
describe('iso_world',()=>{
  it('projects all cells on one 2:1 grid and paints back to front',()=>{
    expect(project([1,0])).toEqual({x:100,y:50});expect(project([0,1])).toEqual({x:-100,y:50})
    for(const aspect of fixture.aspects as DeviceProps['aspect'][]){
      const s=worldState(props(36,aspect));expect(s.blocks.map(b=>b.id)).toEqual(['source','compute','store'])
      for(const b of s.blocks) expect([b.x,b.y]).toEqual(Object.values(project(b.cell)))
      const g=worldGeometry(props(36,aspect));for(const f of g.faces){expect(g.tx+(f.x+f.width)*g.scale).toBeLessThan(aspect==='9:16'?860:1920);expect(g.ty+(f.y+f.height)*g.scale).toBeLessThan(aspect==='9:16'?1320:1080)}
    }
  })
  it('only adds on cue, grows height, slides focus, highlights and sinks in reverse',()=>{
    expect(still(props(0))).toBe('');expect(worldState(props(9)).blocks).toHaveLength(0)
    expect(worldState(props(17)).blocks).toHaveLength(1)
    expect(worldState(props(51)).blocks[0]!.heightNow).toBe(2)
    expect(worldState(props(84)).focus.x).toBe(100)
    expect(worldState(props(94)).blocks[2]!.highlighted).toBe(true)
    const s=worldState(props(122));expect(s.blocks[2]!.sink).toBeGreaterThan(s.blocks[0]!.sink)
    expect(still(props(126))).toBe('')
    expect(worldState({...props(44),events:[...events].reverse()})).toEqual(worldState(props(44)))
  })
  it('carries by distance along the route only, stopping at the endpoint',()=>{
    expect(worldState(props(51)).token).toBeUndefined()
    expect(worldState(props(52)).token).toEqual({x:0,y:0,route:'flow'})
    expect(worldState(props(58)).token).toEqual({x:100,y:50,route:'flow'})
    expect(worldState(props(69)).token).toEqual({x:0,y:100,route:'flow'})
    expect(routePoint([[0,0],[1,0],[1,1]],0.75).x).toBeCloseTo(50); expect(routePoint([[0,0],[1,0],[1,1]],0.75).y).toBeCloseTo(75)
  })
  it('renders deterministic SVG stills in both aspects with token-only surface colours and drift',()=>{
    for(const aspect of fixture.aspects as DeviceProps['aspect'][]) for(const frame of fixture.stills){const p=props(frame,aspect),html=still(p);expect(html).toBe(still(p));for(const m of html.matchAll(/(?:fill|stroke)="([^"]+)"/g))expect(Object.values(tokens)).toContain(m[1]);expect(html).not.toContain('rotate(')}
    expect(still(props(100))).not.toBe(still(props(101)))
  })
  it('requires evidence image references and unique cells',()=>{
    expect(ParamsSchema.safeParse({blocks:[{id:'a',cell:[0,0],height:1,image:'missing'}]}).success).toBe(false)
    const p=props(36);p.object={...object,params:{...object.params,images:{photo:{src:'evidence.png',pixelWidth:100,pixelHeight:100}},blocks:[{id:'source',cell:[0,0],height:2,image:'photo'}]}}
    expect(still(p)).toContain('href="evidence.png"')
  })
})
