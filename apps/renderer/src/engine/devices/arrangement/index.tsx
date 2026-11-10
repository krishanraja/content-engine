import React from 'react'
import { HOUSE_FONTS as F } from '../../../house/geometry'
import { drift, progress, MOTION, overshootEase } from '../../clock'
import type { DeviceProps } from '../types'
import { arrangementState } from './state'
import { hatch } from './hatch'
export { arrangementState } from './state'
/** A stable source signature; movement changes amplitude, never identity. */
export function waveform(id: string, x: number) {
  const seed = Array.from(id).reduce((n,c) => n+c.charCodeAt(0), 1)
  return 0.15 + Math.abs(Math.sin(x*17+seed)*Math.cos(x*41+seed/7))*0.85
}
export function Device(p: DeviceProps) {
  const s = arrangementState(p)
  if (!s || s.out === 1) return null
  const {box, tokens:t, frame, object} = p
  const tall = p.aspect === '9:16', header = tall ? 200 : 260
  const padX = box.width*.06, padY = box.height*.06
  const width = box.width-2*padX, transport = tall ? 132 : 104, ruler = 40
  const stackTop = padY+transport+ruler, stackHeight = box.height*.88-transport-ruler-30
  const live = s.lanes.filter(l => l.visible && (!l.removed || progress(frame-l.at,MOTION.dropFrames)<1))
  const slot = stackHeight/live.length, laneHeight = Math.min(tall?180:140,slot-6)
  const play = drift(frame, object.fromFrame, object.toFrame, 100)
  const split = s.params.fromWave ? progress(frame-s.enterAt,MOTION.slideFrames*2,t=>t) : 1
  const pill = (ai:boolean, human:boolean, big=false): React.CSSProperties => ({display:'inline-block',padding:big?'5px 12px':'3px 10px',borderRadius:30,border:`1px solid ${t.cream}`,background:ai?hatch(t.ink,t.cream):t.ink,color:human?t.mint:t.cream,fontFamily:F.data,fontSize:big?22:18,whiteSpace:'nowrap'})
  return <div data-arrangement style={{position:'absolute', ...box, overflow:'hidden', background:t.cream, color:t.ink, borderRadius:16, opacity:s.enter*(1-s.out),boxShadow:`0 18px 40px color-mix(in srgb, ${t.ink} 25%, transparent)`}}>
    <div style={{position:'absolute', inset:0, transform:`scale(${s.zoom})`, transformOrigin:`${s.x*100}% 50%`}}>
      <header style={{position:'absolute',left:padX,top:padY,width,height:transport,boxSizing:'border-box',borderBottom:`2px solid ${t.inkSoft}`}}>
        <div style={{fontFamily:F.display,fontSize:tall?46:48}}>{s.params.title}</div>
        <div style={{fontFamily:F.data,fontSize:24}}>▶ {s.params.bpm} BPM · <span data-count>{Math.round(live.filter(l=>!l.removed).length*progress(frame-s.countAt,MOTION.countFrames))}</span> LAYERS</div>
      </header>
      <div data-ruler style={{position:'absolute',left:padX+header,top:padY+transport,width:width-header,height:ruler,display:'flex',fontFamily:F.data,fontSize:18}}>
        {Array.from({length:16},(_,i)=><span data-bar={i+1} key={i} style={{width:'6.25%',paddingTop:8,borderLeft:`1px solid ${t.inkSoft}`}}>{i+1}</span>)}
      </div>
      <div data-lane-stack data-height={stackHeight} style={{position:'absolute',left:padX,top:stackTop,width,height:stackHeight}}>
        <div style={{position:'absolute',left:header,right:0,top:0,bottom:0,display:'flex',opacity:.15}}>{Array.from({length:16},(_,i)=><div key={i} style={{width:'6.25%',borderLeft:`1px solid ${t.ink}`}}/>)}</div>
        {split<1 && <svg data-source-wave style={{position:'absolute',left:header,top:stackHeight/2-50,width:width-header,height:100,opacity:1-split}} viewBox="0 0 800 100" preserveAspectRatio="none">{Array.from({length:160},(_,n)=><path key={n} d={`M ${n*5} ${50-waveform('song',n/160)*46} V ${50+waveform('song',n/160)*46}`} stroke={t.ink} strokeWidth={3}/>)}</svg>}
        {live.map((l,i) => {
          const rowY = i*slot+(slot-laneHeight)/2
          const lift = l.removed ? progress(frame-l.at,MOTION.dropFrames,t=>t) : 0
          const entrance = progress(frame-l.at,MOTION.slideFrames)
          const slap = progress(frame-l.at,MOTION.slapFrames,overshootEase(4))
          let layerY = 0
          const sum = l.layers.reduce((n,l)=>n+l.weight,0)
          return <div key={l.id} data-lane={l.id} data-y={rowY} style={{position:'absolute',left:0,top:rowY,width,height:laneHeight,opacity:(s.solo && s.solo!==l.id?.4:1)*(1-lift),transform:`translateY(${-40*lift}px)`,borderBottom:`1px solid ${t.inkSoft}`}}>
            <div style={{position:'absolute',width:header,height:'100%',boxSizing:'border-box',padding:'8px 12px 8px 0',background:t.cream,zIndex:2}}>
              <div style={{fontFamily:F.structure,fontWeight:700,fontSize:tall?26:30}}>{l.name}{l.pin && <span data-pin style={{color:t.mint,textShadow:`0 1px 2px ${t.ink}`}}> ●</span>}</div>
              <span data-provenance style={pill(l.kind==='ai',l.kind==='human')}>{l.kind.toUpperCase()}</span>
              <div style={{display:'flex',gap:8,alignItems:'center',marginTop:5,fontFamily:F.data,fontSize:16}}><span style={{border:`1px solid ${t.inkSoft}`,borderRadius:20,padding:'1px 6px'}}>M</span><span style={{border:`1px solid ${t.inkSoft}`,borderRadius:20,padding:'1px 6px'}}>S</span><span data-meter style={{display:'flex',gap:3,alignItems:'end',height:16}}>{[0,1].map(n=><span key={n} style={{width:5,height:4+12*waveform(l.id,drift(frame,object.fromFrame,object.toFrame,300)+n),background:t.ink}}/>)}</span></div>
              {l.tag && <span data-tag style={{...pill(l.kind==='ai',l.kind==='human',true),position:'absolute',right:10,bottom:5,transform:`translateY(${(1-slap)*100}px)`}}>{l.tag}</span>}
            </div>
            <div style={{position:'absolute',left:header,right:0,height:'100%',display:'flex',gap:6,opacity:split,transform:`scaleY(${.35+.65*split})`}}>
              {Array.from({length:4},(_,clip)=>{layerY=0;return <div data-clip key={clip} style={{position:'relative',flex:1,borderRadius:10,overflow:'hidden',background:t.inkSoft,margin:'3px 0'}}>
                {l.layers.map((layer,j)=>{
                  const height=layer.weight/sum*100,ly=layerY;layerY+=height
                  return <div key={j} data-layer={layer.kind} data-weight={layer.weight} style={{position:'absolute',top:`${ly}%`,height:`${height}%`,width:'100%',background:layer.kind==='ai'?hatch(t.ink,t.cream):layer.kind==='human'?t.mint:t.inkSoft}}>
                    <svg width="100%" height="100%" viewBox="0 0 200 100" preserveAspectRatio="none" aria-hidden>{Array.from({length:40},(_,n)=>{const a=waveform(l.id,(n+clip*40)/160)*(30+drift(frame,object.fromFrame,object.toFrame,300));return <path key={n} d={`M ${n*5} ${50-a} V ${50+a}`} stroke={layer.kind==='human'?t.ink:t.cream} strokeWidth={2}/>})}</svg>
                    {layer.kind==='ai' && <span data-ai-flag style={{position:'absolute',right:4,bottom:3,background:t.cream,color:t.ink,fontFamily:F.data,fontSize:16,padding:'1px 5px',borderRadius:4}}>AI</span>}
                  </div>
                })}
                <span style={{position:'absolute',top:4,left:6,fontFamily:F.data,fontSize:16,color:t.cream,background:t.ink,padding:'1px 4px',borderRadius:4}}>{l.name.charAt(0)+l.name.slice(1).toLowerCase()} 0{clip+1}</span>
              </div>})}
              {l.credit && <span data-credit style={{position:'absolute',left:12,bottom:10,padding:'5px 14px',background:t.cream,color:t.ink,borderRadius:30,fontFamily:F.dek,fontStyle:'italic',fontSize:tall?25:30,transform:`translateX(${(1-entrance)*80}px)`}}>{l.credit}</span>}
            </div>
          </div>
        })}
      </div>
      <div data-playhead style={{position:'absolute',left:padX+header+(width-header)*play,top:padY+transport,bottom:box.height-stackTop-stackHeight,width:3,background:t.mint,boxShadow:`0 0 12px ${t.mint}`,zIndex:3}}><svg width="18" height="14" style={{position:'absolute',left:-7}}><path d="M 0 0 H 18 L 9 14 Z" fill={t.mint}/></svg></div>
      {s.prompt && <div data-prompt style={{position:'absolute',left:padX+header*(1-s.prompt.p),top:stackTop+stackHeight*.6*(1-s.prompt.p),padding:20,background:t.mint,color:t.ink,borderRadius:16,fontFamily:F.data,fontSize:32,zIndex:4}}>{s.prompt.text}▏</div>}
    </div>
    <footer style={{position:'absolute',bottom:padY,left:padX,fontFamily:F.data,fontSize:18}}>ILLUSTRATIVE DAW · 11 NOV 2026</footer>
  </div>
}
