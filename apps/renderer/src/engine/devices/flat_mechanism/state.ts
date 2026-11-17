import { drift, MOTION, overshootEase, progress, stateAt } from '../../clock'
import type { DeviceProps } from '../types'
import { FillSchema, ParamsSchema } from './schema'
// @ts-ignore shared move interpolation
import { lerp } from '@mymu/moves/_kit.mjs'
const linear = (t:number) => t
const spring = overshootEase(6)
/** Directed breadth-first route, retaining intermediate parts rather than teleporting. */
export function route(from:string, to:string, links:readonly {from:string;to:string}[]):string[] {
  const queue = [[from]], seen = new Set([from])
  while(queue.length) { const path = queue.shift()!; const last = path.at(-1)!
    if(last === to) return path
    for(const l of links) if(l.from===last && !seen.has(l.to)){seen.add(l.to);queue.push([...path,l.to])}
  }
  return [from]
}
export function mechanismState(p:DeviceProps) {
  const params=ParamsSchema.parse(p.object.params), s=stateAt(p.events,p.object.obj,p.frame)
  const enter=s.fired.find(e=>e.verb==='enter'), exit=s.fired.find(e=>e.verb==='exit')
  const cues=s.fired.filter(e=>e.verb==='add' && params.parts.some(b=>b.id===e.toState))
    .filter((e,i,a)=>a.findIndex(b=>b.toState===e.toState)===i)
  const highlighted=s.fired.filter(e=>e.verb==='highlight').at(-1)?.toState
  const parts=cues.map((cue,i)=>{
    const part=params.parts.find(b=>b.id===cue.toState)!
    let level=0, number:number|undefined
    for(const e of s.fired){
      if(e.verb==='fill') { let raw:unknown;try{raw=JSON.parse(e.toState)}catch{raw={id:e.toState,level:1}}
        const f=FillSchema.safeParse(raw);if(f.success && f.data.id===part.id)level=lerp(level,f.data.level,progress(p.frame-e.atFrame,Math.min(18,MOTION.countFrames)))
      }
      if(e.verb==='count_to' && e.toState===part.id){const row=p.object.dataset?.rows.find(r=>r.label===part.id || r.label===part.label);if(row)number=lerp(number??0,row.value,progress(p.frame-e.atFrame,Math.min(18,MOTION.countFrames)))}
    }
    const out=exit?progress(p.frame-exit.atFrame-(cues.length-1-i)*Math.min(2,MOTION.staggerFrames),Math.min(6,MOTION.exitFrames),linear):0
    return {...part,level,number,arrival:progress(p.frame-cue.atFrame,Math.min(10,MOTION.dropFrames),spring),out,active:highlighted===part.id,dim:!!highlighted && highlighted!==part.id}
  })
  // Replay successive moves from their actual current position, including interrupted journeys.
  let token: {from:string;path:string[];progress:number}|undefined
  const moves=s.fired.filter(e=>e.verb==='move')
  let journeys:{path:string[];at:number}[]=[]
  for(const e of moves){const prev=journeys.at(-1), start=prev?.path.at(-1)??cues[0]?.toState
    if(!start || !parts.some(b=>b.id===e.toState))continue
    journeys=[...journeys,{path:route(start,e.toState,params.links),at:e.atFrame}]
  }
  if(journeys.length){const last=journeys.at(-1)!;token={from:last.path[0]!,path:last.path,progress:progress(p.frame-last.at,Math.min(18,MOTION.slideFrames),linear)}}
  return {params,parts,journeys,token,visible:!!enter && (!exit || parts.some(b=>b.out<1)),enter:enter?progress(p.frame-enter.atFrame,Math.min(10,MOTION.enterFrames)):0,
    drift:drift(p.frame,p.object.fromFrame,p.object.toFrame,Math.max(0.2,MOTION.driftPct))}
}
