import React from 'react'
import { HOUSE_FONTS as F } from '../../../house/geometry'
import { drift, progress, MOTION } from '../../clock'
import type { DeviceProps } from '../types'
import { arrangementState } from './state'
import { hatch } from './hatch'
export { arrangementState } from './state'
/** Deterministic source shape; ambient movement changes amplitude, never its identity. */
export function waveform(id: string, x: number) {
  const seed = Array.from(id).reduce((n,c) => n+c.charCodeAt(0), 1)
  return 0.15 + Math.abs(Math.sin(x*17+seed)*Math.cos(x*41+seed/7))*0.85
}
export function Device(p: DeviceProps) {
  const s = arrangementState(p)
  if (!s || s.out === 1) return null
  const {box, tokens:t, frame, object} = p
  const tall = p.aspect === '9:16', header = tall ? 220 : 280, transport = tall ? 164 : 126
  const live = s.lanes.filter(l => l.visible && (!l.removed || progress(frame-l.at,MOTION.dropFrames)<1))
  const weights = live.map(l => (s.solo === l.id ? 3 : 1) * (l.removed ? 1-progress(frame-l.at,MOTION.dropFrames) : progress(frame-l.at,MOTION.dropFrames)))
  const unit = (box.height-transport-80)/Math.max(7, weights.reduce((a,b)=>a+b,0))
  let y = transport
  const play = drift(frame, object.fromFrame, object.toFrame, 100)
  return <div data-arrangement style={{position:'absolute', ...box, overflow:'hidden', background:t.cream, color:t.ink, borderRadius:24, opacity:s.enter*(1-s.out)}}>
    <div style={{position:'absolute', inset:0, transform:`scale(${s.zoom})`, transformOrigin:`${s.x*100}% 50%`}}>
      <header style={{height:transport, padding:20, boxSizing:'border-box', borderBottom:`2px solid ${t.inkSoft}`, transform:`translateY(${(1-s.enter)*-40}px)`}}>
        <div style={{fontFamily:F.display,fontSize:tall?52:48}}>{s.params.title}</div>
        <div style={{fontFamily:F.data,fontSize:30}}>▶ {s.params.bpm} BPM · {Math.floor(play*16)+1}:{Math.floor(play*64)-Math.floor(play*16)*4+1} · <span data-count>{Math.round(live.filter(l=>!l.removed).length*progress(frame-s.countAt,MOTION.countFrames))}</span> LAYERS</div>
      </header>
      {live.map((l,i) => {
        const h = unit*weights[i]!, rowY = y; y += h
        const split = progress(frame-s.enterAt-i*MOTION.staggerFrames,14)
        const entrance = progress(frame-l.at-i*MOTION.staggerFrames,MOTION.slideFrames)
        const top = s.params.fromWave ? transport+(rowY-transport)*split : rowY
        let layerY = 0
        const sum = l.layers.reduce((n,l)=>n+l.weight,0)
        return <div key={l.id} data-lane={l.id} style={{position:'absolute',left:0,top:top*(1-s.out)+transport*s.out,width:box.width,height:h,opacity:s.solo && s.solo!==l.id?0.4:1, transform:`translate(${s.params.fromWave?0:(1-entrance)*-box.width}px,${l.removed?-80*progress(frame-l.at,MOTION.dropFrames):0}px)`,overflow:'hidden',borderBottom:`2px solid ${t.cream}`}}>
          <div style={{position:'absolute',left:0,top:0,width:header,height:'100%',boxSizing:'border-box',padding:16,background:t.cream,borderRight:`2px solid ${t.inkSoft}`,zIndex:2}}>
            <div style={{fontFamily:F.structure,fontWeight:700,fontSize:tall?32:36}}>{l.name}</div>
            <div data-tag style={{fontFamily:F.data,fontSize:26,transform:`scale(${1+(1-progress(frame-l.at,MOTION.slapFrames))*0.1})`}}>{l.tag || l.kind.toUpperCase()}{l.pin && <span style={{color:t.mint}}> ●</span>}</div>
          </div>
          <div style={{position:'absolute',left:header,right:0,height:'100%'}}>
            {l.layers.map((layer,j)=>{
              const height = layer.weight/sum*100, ly=layerY; layerY+=height
              const color = layer.kind==='human'?t.mint:layer.kind==='ai'?t.ink:t.inkSoft
              return <div key={j} data-layer={layer.kind} data-weight={layer.weight} style={{position:'absolute',top:`${ly}%`,height:`${height}%`,width:'100%',background:layer.kind==='ai'?hatch(t.ink,t.inkSoft):color}}>
                <svg width="100%" height="100%" viewBox="0 0 800 100" preserveAspectRatio="none" aria-hidden>
                  {Array.from({length:80},(_,n)=>{const a=waveform(l.id,n/80)*(30+drift(frame,object.fromFrame,object.toFrame,300));return l.region==='midi'?<rect key={n} x={n*10} y={20+waveform(l.id,n/80)*50} width={8} height={8} fill={t.cream}/>:<path key={n} d={`M ${n*10} ${50-a} V ${50+a}`} stroke={layer.kind==='human'?t.ink:t.cream} strokeWidth={3}/>})}
                </svg>
              </div>
            })}
            {l.credit && <span data-credit style={{position:'absolute',right:16,top:12,padding:'6px 14px',background:t.cream,color:t.ink,borderRadius:30,fontFamily:F.dek,fontStyle:'italic',fontSize:32,transform:`translateX(${(1-entrance)*80}px)`}}>{l.credit}</span>}
          </div>
        </div>
      })}
      <div data-playhead style={{position:'absolute',left:header+(box.width-header)*play,top:transport,bottom:80,width:4,background:t.ink,zIndex:3}} />
      {s.prompt && <div data-prompt style={{position:'absolute',left:header*(1-s.prompt.p),top:box.height*0.75*(1-s.prompt.p)+transport*s.prompt.p,padding:20,background:t.mint,color:t.ink,borderRadius:24,fontFamily:F.data,fontSize:36,zIndex:4}}>{s.prompt.text}▏</div>}
    </div>
    <footer style={{position:'absolute',bottom:16,left:20,fontFamily:F.data,fontSize:24}}>ILLUSTRATIVE DAW · 11 NOV 2026</footer>
  </div>
}
