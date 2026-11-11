import { stateAt, progress, HERO, MOTION } from '../../clock'
import type { EngineEvent, EngineObject } from '../../props'
import { Params } from './schema'
export const rect = (index:number,count:number):[number,number,number,number] => [60+(index%3)*760,180+Math.floor(index/3)*440,720,400]
export function screenState(object:EngineObject,events:readonly EngineEvent[],frame:number) {
  const params=Params.parse(object.params), fired=stateAt(events,object.obj,frame).fired
  const last=(v:string)=>fired.filter(e=>e.verb===v).at(-1)
  const source=(id:string)=>{const r=object.dataset?.rows.find(r=>r.label===id);if(!r)throw new Error(`living_screen: missing sourced value ${id}`);return r.value}
  const values:Record<string,number>={},old:Record<string,number>={}
  for(const card of params.cards){
    const counts=fired.filter(e=>e.verb==='count_to'&&JSON.parse(e.toState).card===card.id)
    let value=source(card.id)
    for(let i=0;i<counts.length;i++){
      const cue=counts[i]!,target=JSON.parse(cue.toState).value
      if(typeof target!=='number'||!object.dataset?.rows.some(r=>r.label.startsWith(card.id)&&r.value===target))throw new Error('living_screen: unsourced count')
      old[card.id]=value
      value=value+(target-value)*progress(Math.min(frame,counts[i+1]?.atFrame??frame)-cue.atFrame,18,t=>t)
    }
    values[card.id]=value
  }
  const enter=last('enter'),exit=last('exit'),pick=last('pick'),add=last('add'),draw=last('draw')
  if(pick&&!params.tabs.includes(pick.toState))throw new Error('living_screen: unknown tab')
  const copies=add?Number(add.toState):0
  if(!Number.isInteger(copies)||copies<0||copies>4)throw new Error('living_screen: copies must be 0..4')
  const moves=fired.filter(e=>e.verb==='move')
  let target=[1200,800,2400,1600]
  for(let i=0;i<moves.length;i++){
    const cue=moves[i]!,index=params.cards.findIndex(c=>c.id===cue.toState)
    if(index<0&&!['wide','chart'].includes(cue.toState))throw new Error('living_screen: unknown camera target')
    const r=index>=0?rect(index,params.cards.length):cue.toState==='chart'?[60,1080,2280,460]:[0,0,2400,1600]
    const dest=[r[0]!+r[2]!/2,r[1]!+r[3]!/2,r[2]!,r[3]!]
    const k=progress(Math.min(frame,moves[i+1]?.atFrame??frame)-cue.atFrame,30,HERO)
    target=target.map((v,j)=>v+(dest[j]!-v)*k)
  }
  return {params,values,old,source,target,enter,exit,pick,add,draw,copies,
    tab:pick?.toState??params.tabs[0],mark:last('mark')?.toState,highlight:last('highlight')?.toState,
    visible:!!enter&&frame<=object.toFrame&&(!exit||exit.atFrame<enter.atFrame||frame<exit.atFrame+MOTION.exitFrames),
    opacity:exit&&enter&&exit.atFrame>enter.atFrame?1-progress(frame-exit.atFrame,MOTION.exitFrames):1,
    expected:draw?progress(frame-draw.atFrame,45,t=>t):0,
    real:draw?progress(frame-draw.atFrame-45,27,t=>t):0}
}
