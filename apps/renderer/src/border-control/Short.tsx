import React from 'react'
import {AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, interpolate} from 'remotion'
import {BorderControlProof, Passport, type ProofProps} from './Proof'
import '../house/fonts.css'

export type ShortProps={frames:number; shape:'tall'|'wide'; beats:{beat:string;start:number;end:number}[];
 assets:Record<string,string>; study:ProofProps; cues:Record<string,number>; labels:Record<string,string>}
const C={paper:'#F4EFE4',ink:'#0C1512',mint:'#7EF0C0',amber:'#b0412e'}
const mono='MYMU Plex Mono', sans='MYMU Archivo'
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const
const move=(f:number,s=0,d=16)=>1-Math.pow(1-interpolate(f,[s,s+d],[0,1],clamp),4)
const iconPaths={
 phone:<><rect x="26" y="6" width="68" height="108" rx="12"/><path d="M49 18h22M50 102h20"/></>,
 server:<><rect x="13" y="10" width="94" height="28" rx="4"/><rect x="13" y="46" width="94" height="28" rx="4"/><rect x="13" y="82" width="94" height="28" rx="4"/><path d="M29 24h2m-2 36h2m-2 36h2M55 24h34M55 60h34M55 96h34"/></>,
 document:<><path d="M26 8h47l22 22v82H26zM73 8v24h22M42 53h36M42 70h36M42 87h21"/></>,
 chat:<><path d="M12 14h96v73H53l-25 22V87H12z"/><path d="M32 37h57M32 57h41"/></>,
 shirt:<path d="M40 14c0 18 40 18 40 0l30 21-17 25-13-8v58H40V52l-13 8-17-25z"/>,
 cotton:<><path d="M60 112V70M60 92L35 80M60 102l28-18"/><path d="M39 69c-26 0-24-40 0-38-3-30 45-30 42 0 27-2 26 38 2 38z"/></>,
 magnify:<><circle cx="50" cy="48" r="32"/><path d="m75 74 32 34"/></>,
 globe:<><circle cx="60" cy="60" r="48"/><ellipse cx="60" cy="60" rx="21" ry="48"/><path d="M12 60h96M20 36h80M20 84h80"/></>,
 check:<path d="m20 61 25 26 56-59"/>,
 warning:<><path d="m60 10 52 94H8zM60 39v30"/><circle cx="60" cy="86" r="2"/></>,
 bolt:<path d="M70 8 27 65h29l-7 47 45-64H64z"/>,
 coin:<><ellipse cx="60" cy="35" rx="43" ry="19"/><path d="M17 35v44c0 27 86 27 86 0V35M17 57c0 27 86 27 86 0"/></>,
 heart:<path d="M60 105 17 62C-9 25 37-2 60 31 83-2 129 25 103 62z"/>,
}
function Icon({kind,size=150,color=C.ink}:{kind:keyof typeof iconPaths;size?:number;color?:string}){return <svg width={size} height={size} viewBox="0 0 120 120" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round">{iconPaths[kind]}</svg>}
function Label({children,style={}}:{children:React.ReactNode;style?:React.CSSProperties}){return <div style={{fontFamily:mono,fontSize:48,lineHeight:1.35,...style}}>{children}</div>}
function Mark({name,a,size=140}:{name:string;a:Record<string,string>;size?:number}){return a[name]?<Img src={a[name]} style={{width:size,height:size,objectFit:'contain'}}/>:<span style={{fontFamily:sans,fontWeight:700,fontSize:52}}>{name}</span>}
function Brand({name,a,dark=false}:{name:string;a:Record<string,string>;dark?:boolean}){const cream=['Claude','ChatGPT'].includes(name);return <div style={{display:'flex',gap:28,alignItems:'center',background:cream?C.ink:dark?C.ink:C.paper,color:cream||dark?C.paper:C.ink,padding:'26px 32px',borderRadius:12}}><Mark name={name} a={a} size={110}/>{!['Kimi','Qwen','Sarvam'].includes(name)&&a[name]&&<div style={{fontFamily:sans,fontSize:58,fontWeight:700}}>{name}</div>}</div>}
function TileGrid({frame,good=false}:{frame:number;good?:boolean}){return <div style={{display:'grid',gridTemplateColumns:'repeat(20,1fr)',gap:8}}>{Array.from({length:100},(_,i)=><div key={i} style={{aspectRatio:'1',borderRadius:2,background:frame>Math.floor(i/10)*2?(good?C.mint:i<35?C.amber:'#ddd8cc'):'#ddd8cc'}}/>)}</div>}
function Arrow({vertical=false,progress=1}:{vertical?:boolean;progress?:number}){return <svg width={vertical?80:700} height={vertical?200:80} viewBox={vertical?'0 0 80 200':'0 0 700 80'}><path d={vertical?'M40 5v175m-20-20 20 20 20-20':'M5 40h670m-25-20 25 20-25 20'} fill="none" stroke={C.mint} strokeWidth="8" pathLength={1} strokeDasharray={1} strokeDashoffset={1-progress}/></svg>}

function Scene({id,p}:{id:string;p:ShortProps}){
 const f=useCurrentFrame(),a=p.assets,c=p.cues,e=move(f),box={position:'absolute' as const,left:100,right:100};
 const enter={transform:`translateY(${(1-e)*65}px)`,opacity:e};
 if(id==='S01-hook'){
  const deck:[string,string,string][]=[['Claude','USA','us'],['ChatGPT','USA','us'],['DeepSeek','CHINA','cn'],['Mistral','FRANCE','fr'],['K2 Think','UAE','ae'],['Sarvam','INDIA','in']];
  return <><div style={{...box,top:350,display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>{deck.map(([name,country,flag],i)=> <div key={name} style={{height:300,padding:28,boxSizing:'border-box',background:C.paper,border:'2px solid #b7b9a9',borderRadius:12,boxShadow:'0 18px 28px #0c151210',transform:`translateY(${(1-move(f,i*4))*100}px)`,opacity:move(f,i*4)}}><div style={{height:145,display:'flex',alignItems:'center',justifyContent:'center',background:['Claude','ChatGPT'].includes(name)?C.ink:C.paper,borderRadius:6}}><Mark name={name} a={a} size={name==='Sarvam'?250:110}/>{['Claude','ChatGPT','DeepSeek'].includes(name)&&<span style={{fontFamily:sans,fontSize:48,color:['Claude','ChatGPT'].includes(name)?C.paper:C.ink,marginLeft:12}}>{name}</span>}</div><div style={{display:'flex',gap:20,alignItems:'center',marginTop:35}}><Img src={a[flag]!} style={{width:128,height:96,objectFit:'contain'}}/></div></div>)}</div></>
 }
 if(id==='S02-airbnb'||id==='S03-fling'){
  return <><div style={{...box,top:225,...enter}}><Img src={a.chesky!} style={{width:390,height:390,objectFit:'cover',borderRadius:8}}/><div style={{position:'absolute',left:430,top:40}}><Label>BRIAN<br/>CHESKY</Label><div style={{fontFamily:sans,fontSize:66,fontWeight:700,marginTop:24}}>Airbnb</div></div></div>
   <div style={{...box,top:710,padding:'40px 45px',boxSizing:'border-box',background:C.paper,border:'2px solid #b7b9a9',borderRadius:12,...enter}}><div style={{display:'flex',justifyContent:'center'}}><Mark name="Qwen" a={a} size={245}/></div><div style={{display:'flex',alignItems:'center',gap:30,marginTop:20}}><Label>BORN</Label><Img src={a.cn!} style={{width:100,height:75}}/></div><div style={{display:'flex',gap:36,marginTop:25}}><Label>LIVES</Label><Label>NOT STATED</Label></div></div>
   {id==='S03-fling'?<div style={{...box,top:1350,display:'flex',justifyContent:'space-around'}}>{(['bolt','coin','heart'] as const).map((kind,i)=><div key={kind} style={{opacity:move(f,i*7),transform:`scale(${.9+.1*move(f,i*7)})`}}><Icon kind={kind} size={155}/></div>)}</div>:<Label style={{...box,top:1420}}>{p.labels.fortune}</Label>}</>
 }
 if(id==='S07-claude')return <><div style={{...box,top:360,...enter}}><Brand name="Claude" a={a}/><div style={{display:'flex',alignItems:'center',gap:30,marginTop:60}}><Label>BORN</Label><Img src={a.us!} style={{width:120,height:90}}/><Label>USA</Label></div></div><div style={{...box,top:830}}><Icon kind="chat" size={170}/><div style={{marginTop:65}}><TileGrid frame={f-20} good/></div></div><Label style={{...box,top:1350}}>{p.labels.monitor}</Label></>
 if(id==='S08-lives'){
  const route=move(f,c.route,30); const packet=move(f,c.route,55);return <AbsoluteFill style={{background:C.ink,color:C.paper}}><div style={{...box,top:260}}><Brand name="DeepSeek" a={a} dark/></div><div style={{position:'absolute',top:540,left:420}}><Icon kind="phone" size={240} color={C.paper}/></div><div style={{position:'absolute',left:480,top:710+330*packet,opacity:f>c.route!+70?0:route}}><Icon kind="document" size={120} color={C.mint}/></div><div style={{position:'absolute',top:790,left:500}}><Arrow vertical progress={route}/></div><div style={{position:'absolute',left:420,top:1000,opacity:route}}><Icon kind="server" size={240} color={C.paper}/></div><div style={{...box,top:1350,opacity:move(f,c.china),display:'flex',alignItems:'center',gap:35,justifyContent:'center'}}><Img src={a.cn!} style={{width:120,height:90}}/><Label>CHINA</Label></div><Label style={{...box,top:1520}}>{p.labels.policy}</Label></AbsoluteFill>
 }
 if(id==='S09-work')return <><Label style={{...box,top:230}}>MY TEST</Label><div style={{...box,top:360,display:'flex',gap:28,justifyContent:'space-between'}}>{['Claude','ChatGPT','DeepSeek'].map((name,i)=><div key={name} style={{width:260,textAlign:'center',opacity:move(f,i*7)}}><div style={{background:i<2?C.ink:C.paper,padding:30,borderRadius:12}}><Mark name={name} a={a} size={150}/></div><Label style={{marginTop:18}}>{name}</Label></div>)}</div><div style={{...box,top:850,display:'flex',alignItems:'center',justifyContent:'space-around',opacity:move(f,c.cotton)}}><Icon kind="cotton" size={230}/><span style={{fontSize:110}}>→</span><Icon kind="shirt" size={230}/></div><div style={{...box,top:1250,display:'flex',gap:25,alignItems:'center',justifyContent:'center',opacity:move(f,c.xinjiang)}}><Img src={a.cn!} style={{width:110,height:83}}/><Label>XINJIANG</Label></div></>
 if(id==='S10-flagged')return <><Label style={{...box,top:260}}>MY TEST</Label><div style={{...box,top:550,display:'grid',gap:100}}>{['Claude','ChatGPT'].map((name,i)=><div key={name} style={{display:'flex',gap:45,alignItems:'center',opacity:move(f,i*8)}}><div style={{flex:1}}><Brand name={name} a={a}/></div><span style={{fontSize:110,color:C.ink}}>↓</span></div>)}</div><div style={{...box,top:1200,display:'flex',justifyContent:'center'}}><Icon kind="shirt" size={220}/><Icon kind="warning" size={145} color={C.amber}/></div></>
 if(id==='S11-deleted'){
  const replay=c.replay!;
  return <AbsoluteFill style={{background:C.ink,color:C.paper}}>
    <div style={{...box,top:250}}><Mark name="DeepSeek" a={a} size={180}/></div>
    <Label style={{...box,top:520}}>24 OCT · RECORDING</Label>
    <div style={{position:'absolute',left:90,top:760,width:900,height:280,background:'white',overflow:'hidden',borderRadius:8}}>
      <Sequence from={f<replay?0:replay}><OffthreadVideo src={staticFile(f<replay?'deletion-real.mp4':'deletion-replay.mp4')} startFrom={0} muted style={{width:900,height:280,objectFit:'contain'}} key={f<replay?'real':'replay'}/></Sequence>
    </div>
    {f>=replay&&<Label style={{...box,top:1110}}>4× REPLAY</Label>}
    <Label style={{...box,top:1350}}>23 OCT · <span style={{color:C.mint}}>3/3 RUNS</span></Label>
  </AbsoluteFill>
 }
 if(id==='S12-call')return <><div style={{position:'absolute',left:100,top:540,...enter}}><Passport frame={f} born={0} lives={0} width={880} tall labels={p.study.labels} example={p.study.example}/></div><div style={{position:'absolute',right:125,top:1190,opacity:move(f,c.check)}}><Icon kind="magnify" size={195}/></div></>
 if(id==='S13-do')return <><div style={{...box,top:380,display:'flex',gap:50,alignItems:'center',...enter}}><Icon kind="chat" size={180}/><div style={{flex:1,display:'flex',gap:28,alignItems:'center',border:'3px solid #0c1512',padding:25,borderRadius:10}}><Icon kind="globe" size={130}/><Icon kind="server" size={130}/><div style={{fontFamily:'MYMU Anton',fontSize:150}}>?</div></div></div><div style={{...box,top:1000,display:'flex',gap:90,justifyContent:'center'}}>{[0,1].map((i)=><div key={i} style={{opacity:move(f,i===0?20:c.second!),transform:`translateY(${(1-move(f,i===0?20:c.second!))*70}px)`}}><div style={{position:'relative',background:i?C.mint:C.paper,border:'3px solid #0c1512',borderRadius:15,padding:35}}><Icon kind="chat" size={200}/><div style={{position:'absolute',bottom:-30,right:-30,width:90,height:90,borderRadius:'50%',background:C.ink,color:C.paper,fontFamily:mono,fontSize:60,textAlign:'center'}}>{i+1}</div></div></div>)}</div></>
 if(id==='S14-close')return <div style={{...box,top:540,textAlign:'center',...enter}}><Icon kind="globe" size={340}/></div>
 throw new Error('Unimplemented short beat '+id)
}

export function BorderControlShort(p:ShortProps){
 const first=p.beats.find(b=>b.beat==='S04-passports')!, last=p.beats.find(b=>b.beat==='S07-claude')!;
 const studyStart=Math.round(first.start*30)-3,studyEnd=Math.round(last.start*30)-3;
 return <AbsoluteFill style={{background:C.paper,color:C.ink,overflow:'hidden'}}>
  {p.beats.filter(b=>!['S04-passports','S05-newspaper','S06-third'].includes(b.beat)).map((b,i)=>{
   const start=i===0?0:Math.max(0,Math.round(b.start*30)-3),end=Math.min(p.frames,Math.round(b.end*30)-3);
   return <Sequence key={b.beat} from={start} durationInFrames={b.beat==='S14-close'?p.frames-start:end-start}><Scene id={b.beat} p={p}/></Sequence>
  })}
  <Sequence from={studyStart} durationInFrames={studyEnd-studyStart}><BorderControlProof {...p.study} shape="tall" frames={studyEnd-studyStart}/></Sequence>
 </AbsoluteFill>
}
