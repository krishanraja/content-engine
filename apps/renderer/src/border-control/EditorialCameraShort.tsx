import React,{useEffect,useState} from 'react'
import {AbsoluteFill,Img,OffthreadVideo,Sequence,staticFile,useCurrentFrame,delayRender,continueRender,cancelRender} from 'remotion'
import {Scene} from './Editorial'
import {Pen} from './Photographic'
import type {ShortProps} from './Short'

export type CameraShortProps=ShortProps&{camera:string;blankPassports:string}
function CameraBeat({p,beat}:{p:CameraShortProps;beat:ShortProps['beats'][number]}){
 const f=useCurrentFrame(),id=beat.beat
 if(id==='S11-deleted')return <AbsoluteFill style={{background:'#0C1512',color:'#F4EFE4',fontFamily:'MYMU Archivo'}}><div style={{position:'absolute',left:80,top:320,fontSize:48}}>24 OCT · RECORDING</div><div style={{position:'absolute',left:60,top:650,width:960,height:400,background:'white'}}><Sequence durationInFrames={21}><OffthreadVideo src={staticFile('camera-deletion-real.mp4')} muted style={{width:960,height:400,objectFit:'contain'}}/></Sequence><Sequence from={21}><OffthreadVideo src={staticFile('camera-deletion-replay.mp4')} muted style={{width:960,height:400,objectFit:'contain'}}/></Sequence></div><div style={{position:'absolute',left:80,top:1160,fontSize:48,color:'#7EF0C0'}}>{f>=21?'4× REPLAY':''}</div><div style={{position:'absolute',left:80,top:1490,fontSize:54}}>23 OCT · 3/3 RUNS</div></AbsoluteFill>
 const face=['S12-call','S13-do','S13c-second'].includes(id)||(id==='S01-hook'&&f>90)
 if(!face)return <Scene id={id==='S13b-recap'?'S04-passports':id} p={p}/>
 const passports=id==='S12-call'
 return <AbsoluteFill style={{background:'#0C1512'}}>
  <div style={{position:'absolute',inset:'0 0 auto 0',height:1130,overflow:'hidden'}}><OffthreadVideo src={staticFile(p.camera)} startFrom={Math.max(0,Math.round(beat.start*30)-3)} muted style={{width:1080,height:1130,objectFit:'cover',objectPosition:'center 50%'}}/></div>
  <div style={{position:'absolute',top:1128,width:1080,height:4,background:'#7EF0C0'}}/>
  {passports?<svg width={1080} height={788} viewBox="0 0 1920 1401" style={{position:'absolute',top:1132}}>
   <image href={staticFile(p.blankPassports)} width={1920} height={1080}/>
   <g transform="translate(460 300) rotate(14)" fill="#0C1512"><text fontFamily="MYMU Archivo" fontSize={90}>BORN</text><text y={135} fontFamily="MYMU Anton" fontSize={100}>CANADA</text><image href={p.assets.ca} x={240} y={290} width={160} height={120}/></g>
   <g transform="translate(1270 470) rotate(-14)" fill="#0C1512"><text fontFamily="MYMU Archivo" fontSize={90}>LIVES</text><text y={135} fontFamily="MYMU Anton" fontSize={100}>USA</text><image href={p.assets.us} x={250} y={300} width={160} height={120}/></g>
   <Pen d={f<180?'M1260 690Q1430 780 1540 700':'M430 490Q600 610 800 560'} progress={Math.min(1,(f%180)/45)} width={17}/>
  </svg>:<><Img src={p.assets.genericPhone!} style={{position:'absolute',left:0,top:1132,width:600,height:788,objectFit:'cover'}}/><Img src={p.assets.genericPhone!} style={{position:'absolute',left:540,top:1132,width:600,height:788,objectFit:'cover'}}/><Img src={p.assets.Claude!} style={{position:'absolute',left:80,top:1250,width:120,height:120,background:'#0C1512'}}/><Img src={p.assets.ChatGPT!} style={{position:'absolute',left:620,top:1250,width:120,height:120,background:'#0C1512'}}/><svg width={1080} height={788} style={{position:'absolute',top:1132}}><Pen d="M370 420Q540 230 790 400M750 360L798 403L746 433" progress={Math.min(1,f/60)} width={14}/></svg></>}
 </AbsoluteFill>
}
export function EditorialCameraShort(p:CameraShortProps){
 const [ready]=useState(()=>delayRender('Camera visual assets'))
 useEffect(()=>{let active=true;Promise.all(Object.values(p.assets).map(url=>new Promise<void>((resolve,reject)=>{const img=new window.Image();img.onload=()=>resolve();img.onerror=()=>reject(new Error('Camera asset failed'));img.src=url}))).then(()=>document.fonts.ready).then(()=>{if(active)continueRender(ready)}).catch(cancelRender);return()=>{active=false}},[p.assets,ready])
 return <AbsoluteFill>{p.beats.map((b,i)=>{
 const start=i===0?0:Math.max(0,Math.round(b.start*30)-3),end=i===p.beats.length-1?p.frames:Math.round(b.end*30)-3
 return <Sequence key={b.beat} from={start} durationInFrames={end-start}><CameraBeat p={p} beat={b}/></Sequence>
})}</AbsoluteFill>}
