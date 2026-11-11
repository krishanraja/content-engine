import { stateAt, progress, HERO, MOTION } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { Params } from './schema'
export function ladderState(object:EngineObject,events:readonly EngineEvent[],frame:number) {
  const params=Params.parse(object.params)
  const fired=stateAt(events,object.obj,frame).fired
  const last=(verb:string)=>fired.filter(e=>e.verb===verb).at(-1)
  const enter=last('enter'), exit=last('exit')
  const counts=fired.filter(e=>e.verb==='count_to')
  let count=0
  // Replaying each cue also handles an interrupted count without a discontinuity.
  for(let i=0;i<counts.length;i++){
    const cue=counts[i]!, target=Number(cue.toState)
    if(!Number.isInteger(target)||target<0||target>params.parts) throw new Error('ladder_stage: count outside parts')
    if(!object.dataset?.rows.some(r=>r.value===target)) throw new Error('ladder_stage: count requires sourced dataset value')
    const end=Math.min(frame,counts[i+1]?.atFrame??frame)
    const duration=target<count?Math.abs(target-count)*2.1:MOTION.countFrames
    count=Math.round(count+(target-count)*progress(end-cue.atFrame,duration,t=>t))
  }
  const add=last('add'), fill=last('fill'), move=last('move')
  const copies=add?Number(add.toState):0
  if(!Number.isInteger(copies)||copies<0||copies>params.copies) throw new Error('ladder_stage: invalid copies')
  const heights=fill?JSON.parse(fill.toState):params.towers
  for(const n of [heights.left,heights.right]) if(!Number.isInteger(n)||n<0||n>100) throw new Error('ladder_stage: invalid tower height')
  const act=move?.toState??'branch'
  if(!['branch','street','towers'].includes(act)) throw new Error('ladder_stage: invalid act')
  return {params,count,copies,heights,act,enter,exit,add,fill,move,draw:last('draw'),carry:last('carry'),highlight:last('highlight')?.toState,
    visible:!!enter&&(!exit||exit.atFrame<enter.atFrame||frame<exit.atFrame+MOTION.exitFrames),
    opacity:exit&&(!enter||exit.atFrame>enter.atFrame)?1-progress(frame-exit.atFrame,MOTION.exitFrames):1,
    rise:enter?progress(frame-enter.atFrame,33,HERO):0}
}
