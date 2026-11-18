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
  const scale = Math.min(box.width/width, box.height/height, tall ? 1 : 2)
  const top = tall && box.height > 1100 ? Math.max(0,280-box.top) : (box.height-height*scale)/2
  const x0 = tall ? 250 : 550, y0 = 400
  const push = 1+drift(frame, object.fromFrame, object.toFrame, 1)
  const small = s.size < 1
  const tx = s.target < 0 ? 0 : (tall ? 470 : 1030), ty = 140+s.target*120
  const tagX = lerp(x0-140-s.walk*80, tx, s.transfer), tagY = lerp(y0+145,ty,s.transfer)
  const stamp = (opacity: number) => <g opacity={opacity} fill={t.cream} stroke={t.cream}>
    <rect x="-70" y="-72" width="140" height="44" rx="2" fill={t.inkDeep} strokeWidth="3"/>
    <text x="0" y="-40" textAnchor="middle" stroke="none" fontFamily={HOUSE_FONTS.data} fontSize="30">BAN</text>
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
    <rect width={box.width} height={box.height} fill={t.ink}/>
    <g transform={`translate(${(box.width-width*scale)/2} ${top}) scale(${scale})`}>
    <g transform={`translate(${width/2} 360) scale(${push}) translate(${-width/2} -360)`}>
      <ellipse cx={x0} cy="475" rx="200" ry="48" fill={t.inkDeep}/>
      <g opacity={s.pin*(1-s.walk)} transform={`translate(${x0} 470)`}>
        <path d="M0 22Q-65 -30 0 -55Q65 -30 0 22Z" fill={t.cream} opacity=".7"/>
        <circle cy="-25" r="10" fill={t.ink}/>
        <text y="70" textAnchor="middle" fill={t.cream} fontFamily={HOUSE_FONTS.data} fontSize="30">{p.label}</text>
      </g>
      {/* The skyline is present before connection, so its loss is visible. */}
      <g transform={`translate(${tall ? 515 : 1040} 340)`}>
        {[0,1,2,3].map(i=><rect key={i} x={i*44} y={-80-i*18} width="38" height={100+i*18} fill={t.inkSoft}/>)}
        {Array.from({length:p.skyline.lights},(_,i)=><rect data-lit={i<s.lights} key={i} x={Math.floor(i/10)*44+8+(i%2)*16} y={-65+Math.floor((i%10)/2)*16} width="7" height="9" fill={i<s.lights?t.cream:t.inkDeep}/>)}
      </g>
      <path d={`M${x0+130} 385Q${x0+230} 480 ${tall?590:1110} 375`} fill="none" stroke={t.cream} strokeWidth="5" pathLength="1" strokeDasharray="1" strokeDashoffset={1-s.city} opacity={1-s.walk}/>
      {p.targets.map((target,i)=><g key={i} transform={`translate(${tall?470:1030} ${140+i*120})`}>
        <path d="M0 -45h220v85l-10 -8 -10 8 -10 -8 -10 8H0Z" fill={t.cream}/>
        <text x="15" y="-10" fill={t.ink} fontFamily={HOUSE_FONTS.data} fontSize="26">{target.label}</text>
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
      <g data-facility-body="" transform={`translate(${x0+s.walk*85+s.kick} ${y0-120*(1-s.pin)-s.walk*15}) scale(${s.size*(1-s.out)} ${s.size*(1-s.out)+.004*s.out})`}>
        {Array.from({length:p.copies.count},(_,i)=>{
          const cols=tall?4:6, col=i%cols, row=Math.floor(i/cols)
          const rows=Math.ceil(p.copies.count/cols)
          const spacingY=Math.min(90,440/Math.max(1,rows-1))
          const gridX=(col-(cols-1)/2)* (tall?175:190), gridY=row*spacingY-130
          const k=i===0?1:s.copies
          return <g key={i} opacity={k} transform={`translate(${lerp(0,gridX,s.copies)} ${lerp(0,gridY,s.copies)}) scale(${lerp(1,Math.min(.48,spacingY/160),s.copies)})`}>{block(i)}</g>
        })}
      </g>
      {p.tag && <g>
        <path d={`M${x0-100+s.walk*85} ${y0-30}Q${tagX} ${tagY-60} ${tagX} ${tagY}`} fill="none" stroke={t.cream} opacity={1-s.transfer}/>
        <g transform={`translate(${tagX} ${tagY})`}><path d="M0 -18l20 -18h170v55H20Z" fill={t.cream}/><circle cx="16" cy="-8" r="4" fill={t.ink}/><text x="36" y="0" fill={t.ink} fontFamily={HOUSE_FONTS.data} fontSize="28">{p.tag}</text></g>
      </g>}
    </g></g>
  </svg>
}
