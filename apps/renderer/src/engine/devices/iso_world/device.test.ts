import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device, TALL_PICTURE, TALL_READ, project, routePoint, worldState, worldGeometry } from './index'
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
    }
  })
  // Krish, 13 Nov, of a 3D set held in a safe band: "the use of the screen space is terrible". The picture fills the
  // tall slot from y 270 to the caption box's foot at y 1320; only what must be read stays in x 60 to 860, above y 1090.
  // The view is fitted to the height each block will reach, so a fill never grows a block off frame (Claude's check).
  it('fills the slot with the world while every label stays readable, at every frame, the fill included',()=>{
    for(const aspect of fixture.aspects as DeviceProps['aspect'][]){
      const tall=aspect==='9:16',pic=tall?TALL_PICTURE:{left:0,right:1920,top:0,bottom:1080},read=tall?TALL_READ:{left:0,right:1920,top:0,bottom:1080}
      for(let frame=1;frame<120;frame+=3){
        const g=worldGeometry(props(frame,aspect)),at=([x,y]:number[]):[number,number]=>[g.tx+x!*g.scale,g.ty+y!*g.scale]
        for(const block of g.blocks){
          if(!block.label)continue // still falling: a block may enter from above the slot
          for(const poly of block.polys)for(const q of poly.points){const [x,y]=at(q);expect(x).toBeGreaterThanOrEqual(pic.left-1);expect(x).toBeLessThanOrEqual(pic.right+1);expect(y).toBeLessThanOrEqual(pic.bottom+1)}
          const [x,y]=at([block.labelX,block.labelY]),half=block.label.length*19*0.62*g.scale/2
          expect(x-half).toBeGreaterThanOrEqual(read.left);expect(x+half).toBeLessThanOrEqual(read.right)
          expect(y-19*g.scale).toBeGreaterThanOrEqual(read.top);expect(y).toBeLessThanOrEqual(read.bottom)
        }
      }
    }
    // The ground spans most of a tall frame's width, not a band inside the words-safe column.
    const g=worldGeometry(props(60)),xs=g.ground.points.map(q=>g.tx+q[0]!*g.scale)
    expect(Math.max(...xs)-Math.min(...xs)).toBeGreaterThan(0.8*1080)
  })
  it('draws every label last, on an ink edge, so a block in front never hides it and none is cream on cream',()=>{
    const html=still(props(94)),labels=[...html.matchAll(/<text[^>]*data-label="([^"]+)"[^>]*>/g)]
    expect(labels.map(m=>m[1])).toEqual(['source','compute','store'])
    for(const m of labels){expect(m[0]).toContain('stroke="black"');expect(m[0]).toContain('paint-order="stroke"')}
    expect(html.lastIndexOf('data-surface=')).toBeLessThan(html.indexOf('data-label='))
  })
  it('sinks each block into its own cell on exit: its base never leaves the ground and nothing falls below it',()=>{
    const base=(frame:number)=>Object.fromEntries(worldGeometry(props(frame)).blocks.map(b=>[b.id,b.polys[0]!.points[3]![1]]))
    const before=base(110)
    for(const frame of [121,123,125])for(const [id,y] of Object.entries(base(frame)))expect(y).toBeCloseTo(before[id]!)
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
    // The picture is set on the lit face's own plane: its verticals stay upright and every corner lies on that face.
    const block=worldGeometry(p).blocks[0]!,[a,b,c,d,e,f]=block.picture!.matrix,face=block.polys[0]!.points
    expect(c).toBe(0);expect(b/a).toBeCloseTo(0.5)
    const xs=face.map(q=>q[0]!),ys=face.map(q=>q[1]!)
    for(const [u,v] of [[0,0],[100,0],[0,100],[100,100]]){const x=a*u!+c*v!+e,y=b*u!+d*v!+f
      expect(x).toBeGreaterThan(Math.min(...xs));expect(x).toBeLessThan(Math.max(...xs));expect(y).toBeGreaterThan(Math.min(...ys));expect(y).toBeLessThan(Math.max(...ys))}
    // A block standing on the cell the left face looks onto would hide it, so the picture moves to the open right face.
    const q=props(36);q.object={...object,params:{...object.params,images:{photo:{src:'evidence.png',pixelWidth:100,pixelHeight:100}},blocks:[{id:'source',cell:[0,0],height:2,image:'photo'},{id:'front',cell:[0,1],height:1}]}}
    q.events=[...events,EngineEventSchema.parse({id:'front',obj:'world',verb:'add',toState:'front',atFrame:20})]
    const hidden=worldGeometry(q).blocks.find(b=>b.id==='source')!,[a2,b2,,,e2,f2]=hidden.picture!.matrix,right=hidden.polys[1]!.points
    expect(b2/a2).toBeCloseTo(-0.5)
    for(const [u,v] of [[0,0],[100,0],[0,100],[100,100]]){const x=a2*u!+e2,y=b2*u!+hidden.picture!.matrix[3]*v!+f2
      expect(x).toBeGreaterThan(Math.min(...right.map(r=>r[0]!)));expect(x).toBeLessThan(Math.max(...right.map(r=>r[0]!)))
      expect(y).toBeGreaterThan(Math.min(...right.map(r=>r[1]!)));expect(y).toBeLessThan(Math.max(...right.map(r=>r[1]!)))}
  })
})
