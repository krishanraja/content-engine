import React from 'react'
import { staticFile } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import { drift } from '../../clock'
// @ts-ignore shared move primitives are native ES modules
import { lerp } from '../../../../../../packages/moves/_kit.mjs'
import { resolveLogo } from '../logo_card/schema'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'
import { facilityState } from './state'

export function Device(props: DeviceProps) {
  const {object, box, tokens: t, aspect, frame} = props
  const p = ParamsSchema.parse(object.params), s = facilityState(props)
  if (!s.visible) return null
  const tall = aspect === '9:16'
  const width = tall ? 780 : 1400, height = tall ? 740 : 780
  const scale = Math.min(box.width/width, box.height/height)
  const top = tall && box.height > 1100 ? Math.max(0,280-box.top) : (box.height-height*scale)/2
  const x0 = width/2, y0 = 430
  const push = 1+drift(frame, object.fromFrame, object.toFrame, 1)
  // The shell owns the slot; the surrounding evidence stays in layout coordinates.
  const heroScale = box.width * .64 / (285 * scale)
  const cols = tall ? 4 : 6
  const spacingX = tall ? 175 : 190
  const spacingY = Math.min(90,440/Math.max(1,Math.ceil(p.copies.count/cols)-1))
  const copyScale = Math.min(.48,spacingY/160)
  const gridWidth = (Math.min(cols,p.copies.count)-1)*spacingX+285*copyScale
  const bodyScale = heroScale*s.size/lerp(1,gridWidth/285,s.copies)
  // Compensate for slot fitting so every label remains at least 34 screen pixels.
  const labelSize = Math.max(34,34/scale)
  const pillWidth = (text: string) => text.length*labelSize*.62+28
  const label = (text: string, x: number, y: number, centred = false) => <g transform={`translate(${x} ${y})`}>
    <rect x={centred ? -pillWidth(text)/2 : -14} y={-labelSize} width={pillWidth(text)} height={labelSize*1.4} rx={labelSize*.3} fill={t.inkDeep}/>
    <text textAnchor={centred ? 'middle' : 'start'} fill={t.cream} fontFamily={HOUSE_FONTS.data} fontSize={labelSize}>{text}</text>
  </g>
  const rows = Math.ceil(p.copies.count/cols)
  const bodyTop = lerp(-225,-130-225*copyScale,s.copies)
  const bodyBottom = lerp(50,(rows-1)*spacingY-130+50*copyScale,s.copies)
  const bodyScaleY = Math.min(bodyScale,(height-180)/(bodyBottom-bodyTop))
  const bodyY = height/2-(bodyTop+bodyBottom)*bodyScaleY/2
  const small = s.size < 1
  const tx = s.target < 0 ? 0 : (tall ? 470 : 1030), ty = 140+s.target*120
  const tagX = lerp(x0-140-s.walk*80, tx, s.transfer), tagY = lerp(650,ty,s.transfer)
  const stamp = (opacity: number) => <g transform={`translate(0 -50) scale(${1/Math.max(.001,bodyScale*lerp(1,copyScale,s.copies))} ${1/Math.max(.001,bodyScaleY*lerp(1,copyScale,s.copies))})`} opacity={opacity} fill={t.cream} stroke={t.cream}>
    {label('BAN',0,0,true)}
  </g>
  const block = (i: number) => <g data-block={i}>
    <ellipse cx="10" cy="20" rx="155" ry="26" fill={t.inkDeep} opacity=".6"/>
    <path d="M-140 -120 L100 -120 L145 -150 L-95 -150Z" fill={t.cream} opacity=".14"/>
    <path d="M100 -120 L145 -150 L145 -30 L100 0Z" fill={t.inkDeep} stroke={t.cream} strokeOpacity=".3"/>
    <rect x="-140" y="-120" width="240" height="120" rx="3" fill={t.inkSoft} stroke={t.cream} strokeWidth="2"/>
    <rect x="-138" y="-118" width="236" height="116" fill={t.cream} opacity={.04+s.city*.25}/>
    {Array.from({length: 19},(_,j)=><path key={j} d={`M${-130+j*12} -116v112`} stroke={t.cream} opacity=".08"/>)}
    {/* Racks rise from the same shell; the lid stays attached on its rear hinge. */}
    <g opacity={s.racks} transform={`translate(0 ${-90*s.racks})`}>
      {Array.from({length:5},(_,j)=><g key={j} transform={`translate(${-118+j*41} -125)`}>
        <rect width="31" height="85" rx="3" fill={t.inkDeep} stroke={t.cream}/>
        {[10,25,40,55,70].map(y=><path key={y} d={`M5 ${y}h20`} stroke={t.inkSoft} strokeWidth="6"/>)}
        <rect x="22" y="7" width="4" height="4" fill={t.mint}/>
      </g>)}
    </g>
    <path d={`M-140 ${-120-105*s.racks}L100 ${-120-105*s.racks}L145 ${-150-65*s.racks}L-95 ${-150-65*s.racks}Z`} fill={t.inkSoft} stroke={t.cream}/>
    <path d={`M-130 ${-125-105*s.racks}h215`} stroke={t.cream} opacity=".4"/>
    {p.kind === 'factory' && <path d="M-100 -150v-75h22v75" fill={t.inkSoft} stroke={t.cream}/>}
    {(p.kind==='warehouse'||p.kind==='office') && <rect x="-48" y="-70" width="75" height="70" fill={t.inkDeep} stroke={t.cream} strokeOpacity=".3"/>}
    {p.logo && <image href={staticFile(resolveLogo(p.logo))} x="-85" y="-98" width="135" height="55" preserveAspectRatio="xMidYMid meet"/>}
    <path d="M-100 -15h150" stroke={t.mint} strokeWidth={2+5*s.city} opacity={s.city}/>
    <g transform={`translate(${s.kick*2} ${-20*(1-s.ban)})`}>{stamp(s.ban*(1-s.copies))}</g>
    {i >= s.unstamped && stamp(s.grey)}
    <g opacity={s.walk} stroke={t.cream} strokeWidth="10" fill="none">
      <path d={`M-75 0v${28+12*s.kick}l-25 12M60 0v${45-12*s.kick}h28`}/>
    </g>
  </g>
  return <svg width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`} style={{position:'absolute',left:box.left,top:box.top,overflow:'hidden'}}>
    <g transform={`translate(${(box.width-width*scale)/2} ${top}) scale(${scale})`}>
    <g transform={`translate(${width/2} 360) scale(${push}) translate(${-width/2} -360)`}>
      <ellipse cx={x0} cy="475" rx="200" ry="48" fill={t.inkDeep}/>
      <g opacity={s.pin*(1-s.walk)} transform={`translate(${x0} 470)`}>
        <path d="M0 22Q-65 -30 0 -55Q65 -30 0 22Z" fill={t.cream} opacity=".7"/>
        <circle cy="-25" r="10" fill={t.ink}/>
        {label(p.label,0,100,true)}
      </g>
      {/* The skyline is present before connection, so its loss is visible. */}
      <g transform={`translate(${tall ? 515 : 1040} 340)`}>
        {[0,1,2,3].map(i=><rect key={i} x={i*44} y={-80-i*18} width="38" height={100+i*18} fill={t.inkSoft}/>)}
        {Array.from({length:p.skyline.lights},(_,i)=><rect data-lit={i<s.lights} key={i} x={Math.floor(i/10)*44+8+(i%2)*16} y={-65+Math.floor((i%10)/2)*16} width="7" height="9" fill={i<s.lights?t.cream:t.inkDeep}/>)}
      </g>
      <path d={`M${x0+130} 385Q${x0+230} 480 ${tall?590:1110} 375`} fill="none" stroke={t.cream} strokeWidth="5" pathLength="1" strokeDasharray="1" strokeDashoffset={1-s.city} opacity={1-s.walk}/>
      {p.targets.map((target,i)=><g key={i} transform={`translate(${tall?470:1030} ${140+i*120})`}>
        <path d="M0 -45h220v85l-10 -8 -10 8 -10 -8 -10 8H0Z" fill={t.cream}/>
        {label(target.label,15,-10)}
        <path d="M15 12h180m-180 12h140" stroke={t.inkSoft} opacity=".3"/>
      </g>)}
      <g transform={`translate(${x0-145} ${430-100*(1-s.ballot)})`} opacity={s.ballot}>
        <path d="M-65 -50h80v75h-80Z" fill={t.cream}/><path d="M-55 -40H5" stroke={t.ink} strokeWidth="5"/>
        <path d="M-35 -70l30 -20 20 30 -30 20Z" fill={t.cream} stroke={t.inkSoft}/>
      </g>
      <g stroke={t.cream} fill="none" opacity={s.pylons} pathLength="1">
        {[0,1,2].map(i=><g key={i} transform={`translate(${80+i*60} 660) scale(1 ${s.pylons})`}><path d="M-20 0L0 -105 20 0M-30 -80h60M-24 -55h48M-15 -30h30M-30 -80Q0 -50 60 -80" strokeWidth="3"/></g>)}
      </g>
      {small && <g transform={`translate(${tall?600:1000} 670)`} stroke={t.cream} strokeWidth="5" fill="none"><path d="M0 0v-220m0 0l-70 -60m70 60l90 -40m-90 40l-15 95"/><circle cy="-220" r="10" fill={t.cream}/></g>}
      <g data-facility-body="" transform={`translate(${x0-2.5*bodyScale*lerp(1,copyScale,s.copies)+s.kick} ${bodyY-120*(1-s.pin)-s.walk*15}) scale(${bodyScale*(1-s.out)} ${bodyScaleY*(1-s.out)+.004*s.out})`}>
        {Array.from({length:p.copies.count},(_,i)=>{
          const col=i%cols, row=Math.floor(i/cols)
          const gridX=(col-(Math.min(cols,p.copies.count)-1)/2)* spacingX, gridY=row*spacingY-130
          const k=i===0?1:s.copies
          return <g key={i} opacity={k} transform={`translate(${lerp(0,gridX,s.copies)} ${lerp(0,gridY,s.copies)}) scale(${lerp(1,copyScale,s.copies)})`}>{block(i)}</g>
        })}
      </g>
      {p.tag && <g>
        <path d={`M${x0-100+s.walk*85} ${y0-30}Q${tagX} ${tagY-60} ${tagX} ${tagY}`} fill="none" stroke={t.cream} opacity={1-s.transfer}/>
        <g transform={`translate(${tagX} ${tagY})`}><path d="M0 -18l20 -18h170v55H20Z" fill={t.cream}/><circle cx="16" cy="-8" r="4" fill={t.ink}/>{label(p.tag,36,0)}</g>
      </g>}
    </g></g>
  </svg>
}
