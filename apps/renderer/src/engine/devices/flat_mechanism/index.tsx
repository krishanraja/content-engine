import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { progress, MOTION } from '../../clock'
import type { DeviceProps } from '../types'
import { mechanismState } from './state'
export { mechanismState } from './state'
type Point={x:number;y:number}
function along(points:Point[], t:number):Point {
  const lengths=points.slice(1).map((b,i)=>Math.hypot(b.x-points[i]!.x,b.y-points[i]!.y))
  let d=lengths.reduce((a,b)=>a+b,0)*t
  for(let i=0;i<lengths.length;i++){const a=points[i]!,b=points[i+1]!,len=lengths[i]!;if(d<=len)return {x:a.x+(b.x-a.x)*(len?d/len:0),y:a.y+(b.y-a.y)*(len?d/len:0)};d-=len}
  return points.at(-1)!
}
/** Independently authored column and row layouts. Tall labels stay inside the readable column. */
export function geometry(p:DeviceProps){
  const s=mechanismState(p),tall=p.aspect==='9:16',w=p.box.width,h=p.box.height
  const top=tall?Math.max(12,270-p.box.top):h*.1,bottom=tall?Math.min(h-28,1280-p.box.top):h*.86
  const left=tall?Math.max(24,60-p.box.left):w*.04,right=tall?Math.min(w-24,844-p.box.left):w*.96
  const n=s.params.parts.length, pw=tall?right-left:(right-left)/n*.88,ph=tall?(bottom-top)/n*.82:(bottom-top)*.85
  const centres=Object.fromEntries(s.params.parts.map((b,i)=>[b.id,{x:tall?(left+right)/2:left+(i+.5)*(right-left)/n,y:tall?top+(i+.5)*(bottom-top)/n:(top+bottom)/2}]))
  const shift=(1-s.enter)*-w+s.drift*w*.12
  const parts=s.parts.map(b=>({...b,...centres[b.id]!,x:centres[b.id]!.x+shift,y:centres[b.id]!.y+(1-b.arrival)*70+b.out*w,width:pw,height:ph}))
  const links=s.params.links.filter(l=>parts.some(b=>b.id===l.from)&&parts.some(b=>b.id===l.to)).map(l=>({a:{x:centres[l.from]!.x+shift,y:centres[l.from]!.y},b:{x:centres[l.to]!.x+shift,y:centres[l.to]!.y}}))
  let token:Point|undefined, previous:{points:Point[];at:number}|undefined
  for(const j of s.journeys){let points=j.path.map(id=>centres[id]!)
    if(previous){const current=along(previous.points,progress(j.at-previous.at,Math.min(18,MOTION.slideFrames),t=>t));const elapsed=progress(j.at-previous.at,Math.min(18,MOTION.slideFrames),t=>t)
      const lengths=previous.points.slice(1).map((b,i)=>Math.hypot(b.x-previous!.points[i]!.x,b.y-previous!.points[i]!.y))
      let remaining=lengths.reduce((a,b)=>a+b,0)*elapsed, index=0
      while(index<lengths.length && remaining>=lengths[index]!){remaining-=lengths[index]!;index++}
      points=[current,...previous.points.slice(index+1),...points.slice(1)]}
    previous={points,at:j.at}
  }
  if(previous){const at=along(previous.points,progress(p.frame-previous.at,Math.min(18,MOTION.slideFrames),t=>t));token={x:at.x+shift,y:at.y}}
  return {s,parts,links,token,producer:{x:left,y:bottom+22},visible:s.visible}
}
export function Device(p:DeviceProps){const g=geometry(p),t=p.tokens;if(!g.visible)return null
  return <svg width={p.box.width} height={p.box.height} style={{position:'absolute',left:p.box.left,top:p.box.top,overflow:'hidden'}}>
    {g.links.map((l,i)=><line key={i} x1={l.a.x} y1={l.a.y} x2={l.b.x} y2={l.b.y} stroke={t.cream} strokeWidth={4}/>)}
    {g.parts.filter(b=>b.out<1).map(b=><g key={b.id} data-part={b.id} opacity={b.dim?.4:1} transform={`translate(${b.x} ${b.y}) scale(${Math.max(0,b.arrival)})`}>
      <rect x={-b.width/2} y={-b.height/2} width={b.width} height={b.height} rx={18} fill={b.active?t.mint:t.cream}/>
      {b.level>0&&<rect data-level={b.level} x={-b.width/2} y={b.height/2-b.height*b.level} width={b.width} height={b.height*b.level} fill={t.mint}/>}
      {b.image&&<image href={g.s.params.images[b.image]!.src} x={-b.width*.44} y={-b.height*.4} width={b.width*(b.number===undefined?.88:.4)} height={b.height*.57} preserveAspectRatio="xMidYMid meet"/>}
      {b.label&&<text y={b.image?b.height*.34:0} textAnchor="middle" fontFamily={HOUSE_FONTS.data} fontSize={Math.min(28,b.width/(b.label.length*.65))} fill={t.ink}>{b.label}</text>}
      {b.number!==undefined&&<text data-count="true" x={b.width*.22} y={-b.height*.12} textAnchor="middle" textLength={`${Math.round(b.number)}${p.object.dataset?.unit??''}`.length*b.height/3*.65>b.width*.42?b.width*.42:undefined} lengthAdjust="spacingAndGlyphs" fontFamily={HOUSE_FONTS.display} fontSize={b.height/3} fill={t.ink}>{Math.round(b.number)}{p.object.dataset?.unit}</text>}
    </g>)}
    {g.token&&<circle data-token="true" cx={g.token.x} cy={g.token.y} r={28} fill={t.mint} stroke={t.cream} strokeWidth={4}/>}
    {p.object.dataset&&<text x={g.producer.x} y={g.producer.y} fontFamily={HOUSE_FONTS.data} fontSize={20} fill={t.cream}>{p.object.dataset.producerLabel}</text>}
  </svg>
}
/** Evidence is decoded by the caller; drawing never loads or fetches. */
export function drawCanvas(ctx:CanvasRenderingContext2D,p:DeviceProps,images:Readonly<Record<string,CanvasImageSource>>={}){
  const g=geometry(p),t=p.tokens;if(!g.visible)return
  ctx.save();ctx.translate(p.box.left,p.box.top);ctx.beginPath();ctx.rect(0,0,p.box.width,p.box.height);ctx.clip()
  ctx.strokeStyle=t.cream;ctx.lineWidth=4
  for(const l of g.links){ctx.beginPath();ctx.moveTo(l.a.x,l.a.y);ctx.lineTo(l.b.x,l.b.y);ctx.stroke()}
  for(const b of g.parts.filter(b=>b.out<1)){ctx.save();ctx.translate(b.x,b.y);ctx.scale(Math.max(0,b.arrival),Math.max(0,b.arrival));ctx.globalAlpha=b.dim?.4:1
    ctx.fillStyle=b.active?t.mint:t.cream;ctx.beginPath();ctx.roundRect(-b.width/2,-b.height/2,b.width,b.height,18);ctx.fill()
    ctx.fillStyle=t.mint;ctx.fillRect(-b.width/2,b.height/2-b.height*b.level,b.width,b.height*b.level)
    const pic=b.image?g.s.params.images[b.image]:undefined,img=pic&&images[pic.src]
    if(pic&&img){const k=Math.min(b.width*(b.number===undefined?.88:.4)/pic.pixelWidth,b.height*.57/pic.pixelHeight);ctx.drawImage(img,(b.number===undefined?0:-b.width*.24)-pic.pixelWidth*k/2,-b.height*.4+(b.height*.57-pic.pixelHeight*k)/2,pic.pixelWidth*k,pic.pixelHeight*k)}
    ctx.fillStyle=t.ink;ctx.textAlign='center';ctx.font=`${Math.min(28,b.width/((b.label?.length||1)*.65))}px ${HOUSE_FONTS.data}`;if(b.label)ctx.fillText(b.label,0,b.image?b.height*.34:0)
    if(b.number!==undefined){ctx.textAlign='center';ctx.font=`${b.height/3}px ${HOUSE_FONTS.display}`;ctx.fillText(`${Math.round(b.number)}${p.object.dataset?.unit??''}`,b.width*.22,-b.height*.12,b.width*.42)}ctx.restore()
  }
  if(g.token){ctx.beginPath();ctx.arc(g.token.x,g.token.y,28,0,Math.PI*2);ctx.fillStyle=t.mint;ctx.fill();ctx.strokeStyle=t.cream;ctx.lineWidth=4;ctx.stroke()}
  if(p.object.dataset){ctx.fillStyle=t.cream;ctx.font=`20px ${HOUSE_FONTS.data}`;ctx.fillText(p.object.dataset.producerLabel,g.producer.x,g.producer.y)}ctx.restore()
}
