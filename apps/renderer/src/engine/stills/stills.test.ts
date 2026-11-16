import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect } from 'vitest'
import { StyleStill } from './StyleStill'
import { coverPlan, stillIds, type Layer } from './plan'
import { PALETTES } from './palettes'
import { CAPTION_THEMES } from '../captions/names'
const ids=stillIds()
const meets=(a:{x0:number;y0:number;x1:number;y1:number},b:typeof a)=>a.x0<b.x1&&a.x1>b.x0&&a.y0<b.y1&&a.y1>b.y0

describe('StyleStill full bank',()=>{
 it('covers exactly 14 motion, 7 treatment and all 27 native captions',()=>{
  expect(ids).toHaveLength(48)
  expect(new Set(ids.map(x=>`${x.layer}/${x.id}`)).size).toBe(48)
  expect(ids.filter(x=>x.layer==='motion')).toHaveLength(14)
  expect(ids.filter(x=>x.layer==='treatment')).toHaveLength(7)
  expect(ids.filter(x=>x.layer==='captions').map(x=>x.id)).toEqual([...CAPTION_THEMES])
 })
 for(const layer of ['motion','treatment','captions'] as Layer[]) {
  it(`${layer}: every scene, layout, type and palette is distinct`,()=>{
   const plans=ids.filter(x=>x.layer===layer).map(x=>coverPlan(x.layer,x.id))
   for(const field of ['scene','layout','type','palette'] as const) expect(new Set(plans.map(p=>p[field])).size).toBe(plans.length)
  })
 }
 it('keeps treatment moments separate from motion moments',()=>{
  const motion=new Set(ids.filter(x=>x.layer==='motion').map(x=>coverPlan(x.layer,x.id).scene))
  ids.filter(x=>x.layer==='treatment').forEach(x=>expect(motion.has(coverPlan(x.layer,x.id).scene)).toBe(false))
 })
 it('uses bounded full-height compositions and separated caption/device envelopes',()=>{
  for(const x of ids) {
   const {zones}=coverPlan(x.layer,x.id)
   expect(Math.min(...zones.map(z=>z.y0))).toBeLessThanOrEqual(120)
   expect(Math.max(...zones.map(z=>z.y1))).toBeGreaterThanOrEqual(1800)
   for(const z of zones) { expect(z.x0).toBeGreaterThanOrEqual(0);expect(z.x1).toBeLessThanOrEqual(1080);expect(z.y1).toBeLessThanOrEqual(1920) }
   for(const caption of zones.filter(z=>z.name==='caption')) for(const device of zones.filter(z=>z.name==='device')) expect(meets(caption,device)).toBe(false)
  }
 })
 it('uses no more than five colours per palette, with no duplicate palette tuples',()=>{
  const palettes=Object.values(PALETTES)
  palettes.forEach(p=>expect(new Set(Object.values(p)).size).toBeLessThanOrEqual(5))
  expect(new Set(palettes.map(p=>JSON.stringify(p))).size).toBe(48)
 })
 for(const x of ids) it(`renders ${x.layer}/${x.id} deterministically without media`,()=>{
  const a=renderToStaticMarkup(React.createElement(StyleStill,x)), b=renderToStaticMarkup(React.createElement(StyleStill,x))
  expect(a).toBe(b)
  expect(a).not.toMatch(/<(?:img|video|audio)\b/)
  expect(a).not.toContain('NaN')
  expect(a).toContain('<svg')
  if(x.layer==='captions') expect(a).toContain(x.id==='art-directed'?'font-size:168':`data-caption-theme="${x.id}"`)
 })
 it('fails explicitly for an unknown selection',()=>expect(()=>coverPlan('motion','unknown')).toThrow('Unknown StyleStill'))
})

describe('fourth-pass reviewer gates',()=>{
 it('uses a different portrait layout for the close-up',()=>{
  expect(coverPlan('treatment','fry-talking-head').layout).not.toBe(coverPlan('treatment','face-with-proof').layout)
  const close=renderToStaticMarkup(React.createElement(StyleStill,{layer:'treatment',id:'fry-talking-head'}))
  const mid=renderToStaticMarkup(React.createElement(StyleStill,{layer:'treatment',id:'face-with-proof'}))
  expect(close).toContain('scale(1.4)');expect(mid).toContain('scale(.35)')
 })
 it('bounds every caption zone by a forty pixel margin',()=>{
  for(const id of CAPTION_THEMES) for(const z of coverPlan('captions',id).zones.filter(z=>z.name==='caption')) {
   expect(z.x0).toBeGreaterThanOrEqual(40);expect(z.y0).toBeGreaterThanOrEqual(40)
   expect(z.x1).toBeLessThanOrEqual(1040);expect(z.y1).toBeLessThanOrEqual(1880)
  }
 })
 it('never shares a beat across covers',()=>expect(new Set(ids.map(x=>coverPlan(x.layer,x.id).beat)).size).toBe(ids.length))
 it('prints the data story labels once each',()=>{
  const markup=renderToStaticMarkup(React.createElement(StyleStill,{layer:'treatment',id:'data-story'}))
  const words=[...markup.matchAll(/<text\b[^>]*>([^<]+)<\/text>/g)].flatMap(m=>m[1]!.toLowerCase().split(/\s+/))
  expect(new Set(words).size).toBe(words.length)
 })
})
