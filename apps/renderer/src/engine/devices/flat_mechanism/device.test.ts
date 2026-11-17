import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { EngineObjectSchema, EngineEventSchema } from '../../props'
import type { DeviceProps } from '../types'
import { Device, geometry, mechanismState } from './index'
import { ParamsSchema } from './schema'
import fixture from './fixture.json'
const tokens={ink:'black',inkDeep:'black',inkSoft:'gray',cream:'ivory',mint:'aqua',channel:'coral'}
const props=(frame:number,aspect:DeviceProps['aspect']='9:16'):DeviceProps=>({object:EngineObjectSchema.parse(fixture.objects[0]),events:fixture.events.map(e=>EngineEventSchema.parse(e)),frame,aspect,tokens,box:{left:0,top:0,width:aspect==='9:16'?1080:1920,height:aspect==='9:16'?1920:1080}})
const still=(p:DeviceProps)=>renderToStaticMarkup(React.createElement(Device,p))
describe('flat_mechanism',()=>{
 it('enters empty and adds exactly three evidence-bearing parts on cue',()=>{expect(still(props(0))).toBe('');expect(mechanismState(props(8)).parts).toHaveLength(0);const html=still(props(36));expect([...html.matchAll(/data-part=/g)]).toHaveLength(3);for(const id of ['source','compute','store'])expect(html).toContain(`href="${id}.png"`)})
 it('springs within six percent and settles within ten frames',()=>{for(let f=10;f<=20;f++)expect(mechanismState(props(f)).parts[0]!.arrival).toBeLessThanOrEqual(1.060001);expect(mechanismState(props(20)).parts[0]!.arrival).toBe(1)})
 it('moves along links to the named part and never jumps',()=>{const g=geometry(props(58));expect(g.token!.x).toBeCloseTo(g.parts[2]!.x);expect(g.token!.y).toBeCloseTo(g.parts[2]!.y);let last=geometry(props(40)).token!;for(let f=41;f<=58;f++){const next=geometry(props(f)).token!;expect(Math.hypot(next.x-last.x,next.y-last.y)).toBeLessThan(70);last=next}})
 it('uses labels without stand-in icons',()=>{const p=props(36);delete (p.object.params.parts as {image?:string}[])[0]!.image;const html=still(p);expect(html).toContain('Source</text>');expect(html).not.toContain('source.png');expect(html).not.toContain('<path')})
 it('fills, highlights, counts dataset figures and exits in reverse',()=>{expect(mechanismState(props(78)).parts[1]!.level).toBe(.7);const s=mechanismState(props(110));expect(s.parts[1]!.active).toBe(true);expect(s.parts[0]!.dim).toBe(true);expect(s.parts[2]!.number).toBe(42);expect(still(props(110))).toContain('House test evidence');const out=mechanismState(props(122)).parts;expect(out[2]!.out).toBeGreaterThan(out[0]!.out);expect(still(props(132))).toBe('')})
 it('renders deterministic token-colour SVG stills in both aspects and drifts between events',()=>{for(const aspect of fixture.aspects as DeviceProps['aspect'][])for(const f of fixture.stills){const p=props(f,aspect),html=still(p);expect(html).toBe(still(p));for(const m of html.matchAll(/(?:fill|stroke)="([^"]+)"/g))expect(Object.values(tokens)).toContain(m[1])}expect(still(props(110))).not.toBe(still(props(116)))})
 it('makes the count prominent and safe, with contrasting links and a visible token',()=>{
   for(const aspect of fixture.aspects as DeviceProps['aspect'][]){
     const p=props(110,aspect),g=geometry(p),part=g.parts.find(b=>b.number!==undefined)!,html=still(p)
     const count=html.match(/<text data-count="true"[^>]+>/)![0]
     expect(Number(count.match(/font-size="([^"]+)"/)![1])).toBeGreaterThanOrEqual(part.height/3)
     if(aspect==='9:16'){
       expect(part.y-part.height*.12).toBeLessThan(1090)
       expect(part.x+part.width*.01).toBeGreaterThanOrEqual(60)
       expect(part.x+part.width*.43).toBeLessThanOrEqual(860)
     }
     expect(html).toContain(`stroke="${tokens.cream}" stroke-width="4"`)
     expect(html).not.toContain(`stroke="${tokens.inkSoft}"`)
     expect(html).toContain('r="28"')
     expect(tokens.mint).not.toBe(tokens.ink)
   }
 })
 it('rejects missing images and bad link endpoints',()=>{expect(ParamsSchema.safeParse({parts:[{id:'a',image:'missing'}]}).success).toBe(false);expect(ParamsSchema.safeParse({parts:[{id:'a'}],links:[{from:'a',to:'b'}]}).success).toBe(false)})
})
