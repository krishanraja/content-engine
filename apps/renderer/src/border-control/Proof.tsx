import React from 'react'
import {AbsoluteFill, Img, interpolate, useCurrentFrame, useVideoConfig} from 'remotion'
import '../house/fonts.css'

// A production study of locked S04–S06. Copy and cues arrive from the
// signed visual-copy and the fresh 1.12x source transcript, never defaults.
export type ProofProps = {
  shape: 'wide' | 'tall'
  frames: number
  cues: {born: number; lives: number; newspaper: number; third: number}
  labels: {born: string; lives: string; evidence: string; finding: string; source: string}
  capture: string
  marks: {name: string; src: string}[]
}
const C = {paper:'#F4EFE4', ink:'#0C1512', mint:'#7EF0C0', amber:'#b0412e'}
const mono = 'MYMU Plex Mono'
const clamp = {extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const
const ease = (x:number) => 1-Math.pow(1-x,4)
const progress = (f:number, start:number, duration:number) => ease(interpolate(f,[start,start+duration],[0,1],clamp))
const typed = (s:string, f:number, start:number) => s.slice(0, Math.max(0,Math.floor(f-start+1)))

export function Passport({frame, born, lives, width, tall, labels}:{frame:number;born:number;lives:number;width:number;tall:boolean;labels:ProofProps['labels']}) {
  const h=tall?630:570
  return <div style={{width,height:h,position:'relative',background:C.paper,color:C.ink,
    border:'2px solid #b7b9a9',borderRadius:14,boxShadow:'0 24px 48px #0c15121c',overflow:'hidden'}}>
    <div style={{position:'absolute',inset:18,border:'1px solid #0c15121c',borderRadius:6}}/>
    <div style={{position:'absolute',left:50,top:tall?62:56,width:tall?180:240,height:tall?220:304,
      border:'2px solid #0c151236',background:'radial-gradient(#0c151212 1px, transparent 1px)',backgroundSize:'8px 8px'}}/>
    <div style={{position:'absolute',left:tall?282:352,right:50,top:tall?80:70,display:'grid',gap:tall?128:68}}>
      {[{text:labels.born,cue:born},{text:labels.lives,cue:lives}].map(({text,cue})=><div key={text}>
        <div style={{fontFamily:mono,fontWeight:500,fontSize:tall?64:48,letterSpacing:2,height:82}}>{typed(text,frame,cue)}</div>
        <div style={{height:2,background:'#0c15122b',width:'100%'}}/>
      </div>)}
    </div>
    <div style={{position:'absolute',bottom:0,height:tall?150:92,width:'100%',background:C.mint,
      display:'flex',alignItems:'center',padding:'0 50px',gap:8,boxSizing:'border-box'}}>
      <div aria-hidden style={{fontFamily:mono,fontSize:tall?42:36,letterSpacing:4,color:C.ink,opacity:.45,whiteSpace:'nowrap'}}>{'<<<<<<<<<<<<<<<<<<<<<<<<'}</div>
    </div>
  </div>
}

export function BorderControlProof(p:ProofProps) {
  const f=useCurrentFrame(), {width,height}=useVideoConfig(), tall=p.shape==='tall'
  const w=tall?880:1120
  const enter=progress(f,0,14)
  const sheet=progress(f,p.cues.newspaper-24,24)
  const field=progress(f,p.cues.third-24,24)
  const passportX=(width-w)/2-sheet*(tall?130:600)
  const passportY=(height-(tall?630:570))/2-sheet*(tall?310:120)
  const sheetW=tall?880:1240, sheetH=tall?1080:780
  const sheetX=(width-sheetW)/2-field*(tall?1180:2060)
  const sheetY=(height-sheetH)/2+(1-sheet)*(height+120)
  return <AbsoluteFill style={{background:C.paper,color:C.ink,overflow:'hidden'}}>
    <AbsoluteFill style={{opacity:.06,backgroundImage:'radial-gradient(#0C1512 1px, transparent 1px)',backgroundSize:'9px 9px'}}/>
    <div style={{position:'absolute',left:passportX,top:passportY+(1-enter)*140,
      transform:`rotate(${-sheet*7}deg) scale(${.95+.05*enter-sheet*.12})`,opacity:1-field}}>
      <Passport frame={f} born={p.cues.born} lives={p.cues.lives} width={w} tall={tall} labels={p.labels}/>
    </div>
    <div style={{position:'absolute',left:sheetX,top:sheetY,width:sheetW,height:sheetH,
      background:C.paper,boxShadow:'0 24px 48px #0c151224',border:'1px solid #c4c3b6',transform:`rotate(${(1-sheet)*3}deg)`}}>
      <div style={{position:'absolute',left:0,right:0,top:0,padding:tall?'30px 38px':'26px 40px',background:C.ink,color:C.paper,
        fontFamily:mono,fontSize:tall?48:32,lineHeight:1.35}}>{p.labels.source}</div>
      <div style={{position:'absolute',left:42,right:42,top:tall?176:104,height:tall?292:226,overflow:'hidden'}}>
        <Img src={p.capture} style={{width:'100%',transform:`scale(${1+.06*progress(f,p.cues.newspaper,75)})`,transformOrigin:'50% 0'}}/>
      </div>
      <div style={{position:'absolute',left:48,right:48,top:tall?520:365,fontFamily:mono,fontSize:tall?48:32,lineHeight:1.45}}>
        <div style={{fontFamily:'MYMU Anton',fontSize:tall?204:150,lineHeight:1.15}}>200</div>
        <div>{p.labels.evidence.split(' · ')[0]?.replace('200 ','')}</div>
        <div style={{marginTop:20,borderTop:'2px solid #0c151226',paddingTop:20}}>{p.labels.evidence.split(' · ')[1]}</div>
      </div>
    </div>
    <div style={{position:'absolute',inset:0,transform:`translateX(${(1-field)*width*1.12}px)`}}>
      <div style={{position:'absolute',left:tall?100:140,right:tall?100:140,top:tall?260:98,fontFamily:mono,fontSize:tall?48:30,lineHeight:1.4}}>{p.labels.source}</div>
      <div style={{position:'absolute',top:tall?480:190,left:tall?100:140,fontFamily:'MYMU Anton',fontSize:tall?300:220,lineHeight:1}}>{p.labels.finding}</div>
      <div style={{position:'absolute',left:tall?100:800,right:tall?100:140,top:tall?860:260,display:'flex',justifyContent:'space-between',alignItems:'center',gap:30}}>
        {p.marks.map(m=><div key={m.name} style={{width:tall?180:190,textAlign:'center'}}>
          <Img src={m.src} style={{width:'100%',height:tall?100:110,objectFit:'contain'}}/>
          <div style={{fontFamily:'MYMU Archivo',fontSize:tall?48:32,marginTop:14}}>{m.name}</div>
        </div>) }
      </div>
      <div style={{position:'absolute',left:tall?100:140,right:tall?100:140,top:tall?1050:510,display:'grid',gridTemplateColumns:'repeat(20, 1fr)',gap:tall?7:12}}>
        {Array.from({length:100},(_,i)=>{
          const flip=i<35?progress(f,p.cues.third+Math.floor(i/7)*3,8):0
          return <div key={i} style={{aspectRatio:'1',background:flip>.5?C.amber:'#ddd8cc',transform:`rotateY(${flip*180}deg)`,borderRadius:2}}/>
        })}
      </div>
    </div>
  </AbsoluteFill>
}
