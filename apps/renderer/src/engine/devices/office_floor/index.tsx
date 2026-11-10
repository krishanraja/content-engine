import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { MOTION, progress } from '../../clock'
import type { DeviceProps } from '../types'
import { officeState } from './state'

const cells = [[0,0], [1,0], [2,0], [0,1], [2,1], [0,2], [1,2], [2,2]]
const iso = (a: number, b: number) => ({ x: 500 + (a-b)*125, y: 350 + (a+b)*125/Math.sqrt(3) })
export function Device({ object, events, box, tokens: t, aspect, frame }: DeviceProps) {
  const s = officeState({ object, events, frame })
  if (!s) return null
  // Tall slots use a deeper floor; wide slots leave a broader apron around the world.
  const h = aspect === '9:16' ? 820 : 740
  const scale = Math.min(box.width / 1000, box.height / h)
  const tx = (box.width - 1000*scale)/2, ty = (box.height-h*scale)/2
  const tower = iso(1,1)
  const block = (x: number, y: number, w: number, z: number, color: string) => <g>
    <path d={`M ${x} ${y-z} l ${w} ${-w/Math.sqrt(3)} l ${w} ${w/Math.sqrt(3)} l ${-w} ${w/Math.sqrt(3)} Z`} fill={color} stroke={t.ink} strokeWidth={2}/>
    <path d={`M ${x} ${y-z} v ${z} l ${w} ${w/Math.sqrt(3)} v ${-z} Z`} fill={color} stroke={t.ink} strokeWidth={2}/>
    <path d={`M ${x+w} ${y-z+w/Math.sqrt(3)} v ${z} l ${w} ${-w/Math.sqrt(3)} v ${-z} Z`} fill={t.inkSoft} stroke={t.ink} strokeWidth={2}/>
  </g>
  return <svg width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`}
    style={{ position:'absolute', left:box.left, top:box.top, overflow:'hidden' }}>
    <g transform={`translate(${tx} ${ty}) scale(${scale})`} fontFamily={HOUSE_FONTS.data} fontSize={24} fill={t.cream}>
      <ellipse cx={500} cy={570} rx={370} ry={120} fill={t.ink} opacity={0.16*(1-s.out)}/>
      {s.figures.map((f,i) => {
        const [a,b] = cells[i]!, pos = iso(a!,b!)
        const arrival = progress(frame-s.enter-i*MOTION.dropFrames, MOTION.dropFrames)
        if (!arrival) return null
        const morph = s.params.fromCrates ? progress(frame-s.enter-(s.figures.length+i)*MOTION.dropFrames, MOTION.dropFrames) : 1
        const drop = f.added === undefined ? 0 : progress(frame-f.added, MOTION.dropFrames)
        const run = f.sent === undefined ? 0 : progress(frame-f.sent, MOTION.countFrames)
        const ship = f.carried === undefined ? 0 : progress(frame-f.carried, MOTION.slideFrames)
        return <g key={f.id} data-tile={f.id} opacity={arrival*(s.highlight && s.highlight!==f.id ? 0.35 : 1)}
          transform={`translate(0 ${-90*(1-arrival)-s.out*180})`}>
          <path d={`M ${pos.x} ${pos.y-62} l 108 62.354 l -108 62.354 l -108 -62.354 Z`} fill={t.inkSoft} stroke={t.cream} strokeWidth={2}/>
          <g data-desk={f.id}>{block(pos.x-55,pos.y-10,52,55-35*morph,t.cream)}
            {morph<1 && <path data-crate={f.id} d={`M ${pos.x-52} ${pos.y-52} l 48 64 m -48 -38 l 48 12`} stroke={t.ink} opacity={1-morph}/>}
            {morph>0 && <g opacity={morph}><path d={`M ${pos.x-16} ${pos.y-29} v -25 l 36 20 v 25 Z`} fill={t.ink} stroke={t.cream} strokeWidth={2}/></g>}
          </g>
          {drop>0 && <g data-figure={f.id} transform={`translate(${pos.x-45} ${pos.y-45-65*(1-drop)})`} fill={s.highlight===f.id?t.mint:t.cream} stroke={t.ink} strokeWidth={2}>
            <circle cy={-30} r={13}/><rect x={-15} y={-15} width={30} height={38} rx={12}/><path d="M -9 22 v 17 M 9 22 v 17" stroke={t.cream} strokeWidth={7}/>
          </g>}
          {f.label && drop>0 && <g transform={`translate(${pos.x-85} ${pos.y+72})`}><rect y={-24} width={170} height={32} rx={4} fill={t.ink}/><text x={85} textAnchor="middle" textLength={Math.min(150,f.label.length*14)} lengthAdjust="spacingAndGlyphs">{f.label}</text></g>}
          {f.sent!==undefined && <g data-treadmill={f.id} transform={`translate(${pos.x+24} ${pos.y+25})`}>
            <rect x={-8} y={-6} width={85} height={16} rx={8} fill={t.ink} stroke={t.cream}/>
            {[0,1,2].map(j => <g key={j} data-agent={j} transform={`translate(${j*26} ${-45-8*Math.sin(run*Math.PI*4+j) *(1-run)})`} fill={t.cream} stroke={t.ink} strokeWidth={2}>
              <rect width={20} height={16} rx={3}/><rect x={3} y={18} width={14} height={18} rx={3}/><path d={`M 5 36 l ${5*Math.sin(run*Math.PI*6)} 9 M 15 36 l ${-5*Math.sin(run*Math.PI*6)} 9`} stroke={t.cream}/>
            </g>)}
          </g>}
          {f.carried!==undefined && <g data-shipment={f.id} transform={`translate(${ship*60} ${-ship*8})`}>{block(pos.x+16,pos.y+40,20,26,t.mint)}
            <g data-bell="true" transform={`translate(${pos.x+65} ${pos.y-20}) rotate(${Math.sin(ship*Math.PI*4)*18*(1-ship)})`} stroke={t.mint} fill={t.mint}><path d="M -10 0 Q -10 -24 0 -24 Q 10 -24 10 0 Z"/><circle cy={5} r={3}/><path d="M -18 -25 l -7 -7 M 18 -25 l 7 -7" fill="none" strokeWidth={3}/></g>
          </g>}
        </g>
      })}
      <g data-tower="true" data-topple={s.topple} transform={`translate(${tower.x} ${tower.y}) rotate(${s.topple*76})`} opacity={1-s.out}>
        {block(-42,0,42,260,t.cream)}
        <rect x={-28} y={-245} width={22} height={230} fill={t.ink}/>
        <rect data-meter={s.meter} x={-28} y={-15-s.meter*230} width={22} height={s.meter*230} fill={t.channel}/>
        <path data-target={s.target} d={`M -55 ${-15-s.target*230} H 65`} stroke={t.mint} strokeWidth={4} strokeDasharray="8 5"/>
        {s.figures.filter(f=>f.added!==undefined).map((f,i)=><g key={f.id} data-marker={f.id} data-rank={f.rank} transform={`translate(${48+i*3} ${-240+(f.marker-1)*26})`}>
          <circle r={10} fill={s.highlight===f.id?t.mint:t.ink} stroke={t.cream} strokeWidth={2}/><text x={17} y={7} fontSize={20}>{f.label??f.id}</text>
        </g>)}
        <rect x={-160} y={-310} width={320} height={36} rx={6} fill={t.ink}/>
        <text y={-283} textAnchor="middle" textLength={Math.min(300,s.params.towerLabel.length*14)} lengthAdjust="spacingAndGlyphs">{s.params.towerLabel}</text>
        {s.badge && <g data-badge={s.badge.id} transform={`translate(0 ${-350-60*(1-progress(frame-s.badge.at,MOTION.dropFrames))})`}>
          <rect x={-160} y={-26} width={320} height={40} rx={20} fill={t.cream}/><text textAnchor="middle" y={2} fill={t.ink} textLength={Math.min(290,s.badge.text.length*14)} lengthAdjust="spacingAndGlyphs">{s.badge.text}</text>
        </g>}
      </g>
      {s.figures.map((f,i)=>{
        const cue = s.fill?.id===f.id ? s.fill.at : f.sent
        if(cue===undefined || s.topple>0) return null
        const [a,b]=cells[i]!, start=iso(a!,b!)
        return [0,1,2,3].map(j=>{
          const p=progress(frame-cue-j*MOTION.staggerFrames,MOTION.countFrames)
          const level=s.meter*p
          if(p<=0 || p>=1 || level>s.target) return null
          return <circle key={f.id+j} data-coin={f.id} cx={start.x+(tower.x-start.x)*p} cy={start.y+(tower.y-100-start.y)*p-150*Math.sin(Math.PI*p)} r={9} fill={t.channel} stroke={t.ink} strokeWidth={2}/>
        })
      })}
    </g>
  </svg>
}
