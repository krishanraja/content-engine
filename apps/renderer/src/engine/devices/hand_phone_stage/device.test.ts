import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe,expect,it,vi } from 'vitest'
// As in chrome/ending.test.ts: SSR checks markup, not Remotion's frame context.
vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>()
  return { ...actual, Img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', props) }
})
import { EngineEventSchema,EngineObjectSchema } from '../../props'
import { GLASS_KINDS } from '../../kit/glassRegistry'
import { Screen } from '../../kit/phoneGlass'
import { Cam } from '../../kit/camera'
import fixture from './fixture.json'
import { Device, Plate } from './index'
import { phoneState } from './state'
const object=EngineObjectSchema.parse(fixture.object)
const events=fixture.events.map(e=>EngineEventSchema.parse(e))
const at=(frame:number)=>phoneState(object,events,frame)
const tokens={ink:'black',inkDeep:'black',inkSoft:'gray',mint:'green',cream:'ivory',channel:'coral'}
GLASS_KINDS.test=()=>React.createElement('div',null,'test glass')
GLASS_KINDS.footage=()=>React.createElement('div',null,'real footage')
const markup=(frame:number,obj=object,ev=events)=>renderToStaticMarkup(React.createElement(Device,{object:obj,events:ev,frame,tokens,aspect:'9:16',box:{left:0,top:0,width:1080,height:1920}}))
describe('continuous phone stage',()=>{
  it('passes camera k and the original fill clock through interrupted moves',()=>{
    const seen: {k:number;sinceFrames:number;frame:number}[]=[]
    GLASS_KINDS.clock_probe=props=>{seen.push(props);return React.createElement('div',null,'clock probe')}
    const obj={...object,params:{...object.params,glass:{...fixture.object.params.glass,clock_probe:{}}}}
    const ev=[...events,{...events[2]!,id:'probe',toState:'clock_probe',atFrame:31}]
    markup(36,obj,ev)
    expect(seen.at(-1)?.k).toBe(at(36).cam.k)
    expect(seen.at(-1)?.sinceFrames).toBe(5)
    expect(seen.at(-1)?.frame).toBe(36)
  })
  it('does not render before enter, outside lifetime or after exit',()=>{
    expect(markup(9)).toBe(''); expect(markup(206)).toBe(''); expect(markup(240)).toBe('')
  })
  it('moves from the old camera at +0 to the new camera at +18 monotonically',()=>{
    const a=object.params.cameras as typeof fixture.object.params.cameras
    expect(at(30).cam).toEqual(new Cam(a.open.k,a.open.rot,a.open.tx,a.open.ty))
    expect(at(48).cam).toEqual(new Cam(a.evidence.k,a.evidence.rot,a.evidence.tx,a.evidence.ty))
    for(const key of ['k','rot','tx','ty'] as const) {
      const sign=Math.sign(a.evidence[key]-a.open[key])
      for(let f=31;f<=48;f++) expect((at(f).cam[key]-at(f-1).cam[key])*sign).toBeGreaterThanOrEqual(-1e-10)
    }
    expect(at(30).backdrops.map(b=>b.camera.backdrop)).toEqual(['cotton_flip'])
    expect(at(36).backdrops).toHaveLength(2)
    expect(at(42).backdrops.map(b=>b.camera.backdrop)).toEqual(['hardware'])
  })
  it('rebuilds UI pixels from interpolated k and holds the current matrix',()=>{
    const html=markup(36)
    expect(html).toContain(new Screen(at(36).cam).css())
    expect(html).toContain('matrix3d(')
    expect(html).not.toMatch(/overflow:\s*visible|#[\da-fA-F]{3,8}\b/)
    expect(html.indexOf('data-glass-plane')).toBeLessThan(html.indexOf('<img src="plates/hand-held-screen/phone-bezel.png"'))
    expect(html.indexOf('<img src="plates/hand-held-screen/phone-bezel.png"')).toBeLessThan(html.indexOf('<img src="plates/hand-held-screen/phone-glass.png"'))
  })
  it('crossfades fill, omits sheen over footage and rejects unknown kinds',()=>{
    expect(at(60).glass.map(g=>g.kind)).toEqual(['blank'])
    expect(at(66).glass).toHaveLength(2)
    expect(at(72).glass.map(g=>g.kind)).toEqual(['test'])
    expect(markup(72)).toContain('test glass')
    const ev=[...events,{...events[2]!,id:'footage',toState:'footage',atFrame:90}]
    expect(markup(102,object,ev)).not.toContain('phone-glass.png')
    expect(()=>markup(102,object,[...ev,{...events[2]!,id:'bad',toState:'unknown',atFrame:80}])).toThrow()
  })
  it('is deterministic across seeks, interrupted moves, and reentry',()=>{
    const ev=[...events,{...events[1]!,id:'interrupt',toState:'verdict',atFrame:35}]
    const before=phoneState(object,ev,35).cam
    expect(before).toEqual(at(35).cam)
    at(220); expect(phoneState(object,[...events].reverse(),36)).toEqual(at(36))
    const again=[...events,{...events[0]!,id:'again',atFrame:220}]
    expect(phoneState(object,again,232).glass.map(g=>g.kind)).toEqual(['blank'])
  })
  it.each(Object.keys(fixture.object.params.cameras))('renders camera %s',start=>{
    expect(markup(25,{...object,params:{...object.params,start}},[events[0]!])).toContain('matrix3d(')
  })
  it('fails explicitly on a missing plate',()=>{
    const img=Plate({name:'missing.png'})
    expect(()=>img.props.onError()).toThrow('missing phone plate')
  })
})
