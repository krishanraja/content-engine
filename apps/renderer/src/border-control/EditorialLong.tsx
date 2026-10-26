import React,{useEffect,useState,useId} from 'react'

import {AbsoluteFill,OffthreadVideo,Freeze,Sequence,staticFile,useCurrentFrame,interpolate,delayRender,continueRender,cancelRender} from 'remotion'

import {Pen} from './Photographic'

import '../house/fonts.css'

type Beat={beat:string;start:number;end:number;said:string;countrySwitch?:number}

export type LongProps={frames:number;beats:Beat[];assets:Record<string,string>;crops:Record<string,number[]>;excerpts:Record<string,string>;camera?:string}

const I='#0C1512',P='#F4EFE4',M='#7EF0C0',A='#e8a084'

const cl={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const

const go=(f:number,a=0,b=24)=>{const x=interpolate(f,[a,b],[0,1],cl);return x*x*(3-2*x)}

const src=(p:LongProps,k:string)=>{const v=p.assets[k];if(!v)throw new Error(`Missing photographic asset ${k}`);return v.startsWith('data:')?v:staticFile(v)}

const T=({x,y,children,size=44,fill=P,anchor='start',display=false}:{x:number;y:number;children:React.ReactNode;size?:number;fill?:string;anchor?:'start'|'middle'|'end';display?:boolean})=><text x={x} y={y} fontFamily={display?'MYMU Anton':'MYMU Archivo'} fontSize={size} fill={fill} textAnchor={anchor}>{children}</text>

function Photo({p,k,x=0,y=0,w=1920,h=1080,opacity=1}:{p:LongProps;k:string;x?:number;y?:number;w?:number;h?:number;opacity?:number}){return <image href={src(p,k)} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" opacity={opacity}/>}

function Flag({p,k,x,y,w=110}:{p:LongProps;k:string;x:number;y:number;w?:number}){return <image href={src(p,k)} x={x} y={y} width={w} height={w*.75}/>}

function Mark({p,k,x,y,w=140}:{p:LongProps;k:string;x:number;y:number;w?:number}){return <g><rect x={x-18} y={y-18} width={w+36} height={w+36} rx={3} fill={['Claude','ChatGPT'].includes(k)?I:P}/><image href={src(p,k)} x={x} y={y} width={w} height={w} preserveAspectRatio="xMidYMid meet"/></g>}

function Paper({p,k,x=760,y=280,w=1060,h=390,rotate=-2}:{p:LongProps;k:string;x?:number;y?:number;w?:number;h?:number;rotate?:number}){

 const id=useId(),c=p.crops[k];if(!c)throw new Error('Unreviewed source crop '+k)

 return <g transform={`translate(${x} ${y}) rotate(${rotate})`}><rect x={-24} y={-24} width={w+48} height={h+48} fill={P}/><svg width={w} height={h} viewBox={`${c[0]} ${c[1]} ${c[2]} ${c[3]}`} preserveAspectRatio="xMidYMid meet"><defs><clipPath id={id}><rect x={c[0]} y={c[1]} width={c[2]} height={c[3]}/></clipPath></defs><image clipPath={`url(#${id})`} href={src(p,k)} width={k.startsWith('E-')?2560:k.includes('claude')?1316:k.includes('chatgpt')?1536:1440} height={k.startsWith('E-')?1600:k.includes('claude')?908:k.includes('chatgpt')?784:791}/></svg></g>

}

function Passport({p,born='CHINA',bornFlag='cn',lives='USA',livesFlag='us',model,f=100,circle='lives'}:{p:LongProps;born?:string;bornFlag?:string;lives?:string;livesFlag?:string;model?:string|undefined;f?:number;circle?:string}){

 return <><Photo p={p} k="blankPassports"/><g transform="translate(478 300) rotate(14)"><T x={0} y={0} fill={I} size={44}>BORN</T><T x={0} y={100} fill={I} size={64} display>{born}</T><Flag p={p} k={bornFlag} x={240} y={130} w={110}/><g>{model&&<Mark p={p} k={model} x={140} y={220} w={145}/>}</g></g><g transform="translate(1300 485) rotate(-14)"><T x={0} y={0} fill={I} size={44}>LIVES</T><T x={0} y={108} fill={I} size={lives.length>9?42:64} display>{lives}</T><Flag p={p} k={livesFlag} x={250} y={135} w={110}/></g><Pen d={circle==='lives'?'M1260 650Q1390 740 1530 655':'M400 455Q580 570 850 525'} progress={go(f,20,66)} width={12}/></>

}

const origins=[['Claude','us','USA'],['ChatGPT','us','USA'],['DeepSeek','cn','CHINA'],['Mistral','fr','FRANCE'],['K2 Think','ae','UAE'],['Sarvam','in','INDIA']]

function OriginSpread({p,f}:{p:LongProps;f:number}){return <><Photo p={p} k="blankPassports" opacity={.25}/>{origins.map(([name,flag,country],i)=>{const x=105+(i%3)*610,y=95+Math.floor(i/3)*475;return <g key={name} opacity={go(f,i*6,i*6+22)} transform={`translate(${x} ${y+35*(1-go(f,i*6,i*6+22))}) rotate(${i%2?2:-2} 260 200)`}><svg width={520} height={390} viewBox="150 110 700 650" preserveAspectRatio="xMidYMid slice"><image href={src(p,'blankPassports')} width={1672} height={941}/></svg>{p.assets[name!]?<Mark p={p} k={name!} x={65} y={55} w={100}/>:<T x={55} y={140} fill={I} size={50} display>{name}</T>}<Flag p={p} k={flag!} x={290} y={210} w={100}/><T x={60} y={300} fill={I} size={42}>{country}</T></g>})}</>}

function Count({p,f,count,model}:{p:LongProps;f:number;count:number;model?:string|undefined}){return <><Photo p={p} k="hardware" opacity={.27}/>{model?<Mark p={p} k={model} x={160} y={150} w={180}/>:['DeepSeek','Kimi','Qwen','GLM'].map((m,i)=><Mark key={m} p={p} k={m} x={110+i*160} y={100} w={100}/>)}<T x={380} y={660} anchor="middle" size={240} display fill={count===0?M:P}>{count===0?'100%':count+'%'}</T><T x={380} y={760} anchor="middle" size={38}>{count===0?'ANSWERED':'PROBLEM RESPONSES'}</T>{Array.from({length:100},(_,i)=><circle key={i} cx={850+i%10*85} cy={180+Math.floor(i/10)*75} r={23} fill={count===0?M:i<Math.round(count*go(f,10,70))?A:P} opacity={count===0||i<count?1:.25}/>)}</>}

function Quote({p,k,x,y,w=1000,h=145}:{p:LongProps;k:string;x:number;y:number;w?:number;h?:number}){const q=p.excerpts[k];if(!q)throw new Error('Unverified excerpt '+k);return <g transform={`translate(${x} ${y})`}><rect width={w} height={h} fill={P}/><T x={w/2} y={h*.68} size={q.length>22?60:72} fill={I} anchor="middle">{`“${q}”`}</T></g>}
function Answer({p,id,f,frames}:{p:LongProps;id:number;f:number;frames:number}){const test=id===31?'A':'B',phase=f<frames/2?1:2,country=test==='A'?(phase===1?'XINJIANG':'TURKMENISTAN'):(phase===1?'TAIWAN':'SINGAPORE'),flag=test==='A'?(phase===1?'cn':'tm'):(phase===1?'tw':'sg');return <><Photo p={p} k={test==='A'?'cotton':'blankPassports'} opacity={.3}/><Flag p={p} k={flag} x={820} y={50} w={105}/><T x={970} y={125} size={55}>{country}</T>{['claude','chatgpt','deepseek'].map((m,i)=><g key={m}><Mark p={p} k={['Claude','ChatGPT','DeepSeek'][i]!} x={230} y={220+i*245} w={115}/><Quote p={p} k={`T-${m}-${test}${phase}`} x={610} y={210+i*245}/></g>)}</>}

function LongScene({p,beat}:{p:LongProps;beat:Beat}){

 const f=useCurrentFrame(),n=Number(beat.beat.slice(1,3))

 if(n===32&&f>=(beat.end-beat.start)*30-65)return <AbsoluteFill style={{background:I,color:M,justifyContent:'center',alignItems:'center',fontFamily:'MYMU Anton'}}><div style={{fontFamily:'MYMU Archivo',fontSize:42,color:P}}>23 OCT</div><div style={{fontSize:220}}>3/3 RUNS</div></AbsoluteFill>
 if(n===32||n===35)return <AbsoluteFill style={{background:I,fontFamily:'MYMU Archivo',color:P}}><div style={{position:'absolute',left:90,top:70,fontSize:34}}>24 OCT · RECORDING</div>{n===32?<><div style={{position:'absolute',left:90,top:240,width:820,height:500,background:P}}><Sequence durationInFrames={96}><OffthreadVideo src={staticFile('deletion-real.mp4')} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/></Sequence><Sequence from={96}><OffthreadVideo src={staticFile('deletion-replay.mp4')} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/></Sequence></div><div style={{position:'absolute',left:1010,top:240,width:820,height:500,background:P}}><OffthreadVideo src={staticFile('turkmenistan-evidence.mp4')} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/></div><div style={{position:'absolute',left:90,top:160,fontSize:50}}>XINJIANG</div><div style={{position:'absolute',left:1010,top:160,fontSize:50}}>TURKMENISTAN</div><div style={{position:'absolute',left:90,top:785,fontSize:32,color:M}}>{f>=96?'4× REPLAY':''}</div><div style={{position:'absolute',left:90,top:920,fontSize:48,color:M}}>{f>=(beat.end-beat.start)*30-65?'23 OCT · 3 OF 3 RUNS':''}</div></>:<><div style={{position:'absolute',left:100,top:250,width:1720,height:510,background:P}}><Sequence durationInFrames={Math.max(1,Math.round((beat.end-beat.start)*30)-60)}><Freeze frame={55}><OffthreadVideo src={staticFile('deletion-real.mp4')} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/></Freeze></Sequence><Sequence from={Math.max(1,Math.round((beat.end-beat.start)*30)-60)}><OffthreadVideo src={staticFile('deletion-replay.mp4')} muted style={{width:'100%',height:'100%',objectFit:'contain'}}/></Sequence></div><div style={{position:'absolute',left:100,top:850,fontSize:42,color:M}}>XINJIANG · 4× REPLAY</div></>}</AbsoluteFill>

 let content:React.ReactNode

 if(n<=2)content=<OriginSpread p={p} f={f}/>

 else if(n===3||n===4)content=<><Photo p={p} k="chesky" w={750} h={1080}/><rect x={710} width={1210} height={1080} fill={I}/><Mark p={p} k="Airbnb" x={820} y={110} w={130}/><Mark p={p} k="Qwen" x={1470} y={110} w={130}/><Pen d="M1005 170Q1235 95 1395 170M1360 135L1400 172L1355 200" progress={go(f,30,80)}/><T x={85} y={965} size={50}>BRIAN CHESKY</T><T x={820} y={830} size={42}>LIVES: NOT STATED</T></>

 else if(n===5)content=<><Photo p={p} k="hardware" opacity={.27}/><Mark p={p} k="Cursor" x={180} y={150} w={200}/><Mark p={p} k="Kimi" x={1450} y={150} w={200}/><Pen d="M490 240Q950 90 1330 240M1290 200L1340 243L1280 272" progress={go(f,30,100)}/><Flag p={p} k="cn" x={1510} y={440} w={100}/></>

 else if(n===6||n===37)content=<><Photo p={p} k="hardware" opacity={.28}/><Mark p={p} k="Claude" x={150} y={155} w={145}/><Mark p={p} k="DeepSeek" x={150} y={500} w={145}/><rect x={450} y={180} width={1200} height={100} fill={P}/><rect x={450} y={525} width={1200-1080*go(f,20,90)} height={100} fill={M}/><T x={450} y={110} size={36}>LINDY · REPORTED COST COMPARISON</T><T x={1640} y={470} size={170} anchor="end" display fill={M}>10×</T></>

 else if(n>=7&&n<=9)content=<><Photo p={p} k="hardware" opacity={.23}/><Flag p={p} k="us" x={140} y={210} w={170}/><Flag p={p} k="cn" x={140} y={610} w={170}/>{[0,1].map(i=><g key={i}><rect x={450} y={200+i*400} height={135} width={(n===9?(i?1168:1200):n===7?0:i?712:1200)*go(f,20,65)} fill={i?P:M}/><T x={480} y={305+i*400} size={n===9?82:110} fill={I} display>{n===7?'':n===9?'':(i?'35':'59')}</T></g>)}<T x={1650} y={965} anchor="end" size={n===9?90:38} display={n===9}>{n===9?'2.7% GAP':'NOTABLE AI MODELS · 2025'}</T></>

 else if(n===10||n===11){const countries=[['gb','UK'],['fr','FRANCE'],['ae','UAE'],['sa','SAUDI ARABIA'],['in','INDIA'],['kr','SOUTH KOREA']];content=<><Photo p={p} k="blankPassports" opacity={.4}/>{countries.map(([k,name],i)=><g key={k} opacity={go(f,i*12,i*12+24)} transform={`translate(${155+i%3*590} ${160+Math.floor(i/3)*450})`}><Flag p={p} k={k!} x={0} y={0} w={210}/><T x={0} y={265} size={46}>{name}</T><Pen d="M0 292Q155 278 380 292" progress={go(f,i*12+14,i*12+50)} width={9}/></g>)}</>}

 else if(n===12||n===13)content=<><Photo p={p} k="blankPassports" opacity={.45}/><Flag p={p} k="kr" x={135} y={130} w={190}/><Mark p={p} k="Qwen" x={1440} y={140} w={175}/><Flag p={p} k="cn" x={1510} y={390} w={110}/><T x={130} y={440} size={70} display>NAVER CLOUD</T><Pen d="M460 270Q900 160 1330 270M1290 230L1340 270L1290 300" progress={go(f,22,70)}/></>

 else if([14,21,24,26,36].includes(n))content=<Passport p={p} f={f} born={n===14||n===21?'CANADA':'CHINA'} bornFlag={n===14||n===21?'ca':'cn'} lives="USA" livesFlag="us" model={n===14||n===21?undefined:'DeepSeek'} circle={n===26?'born':'lives'}/>

 else if(n===15)content=<><Photo p={p} k="newspaper" opacity={.22}/>{Array.from({length:200},(_,i)=><rect key={i} x={180+i%20*77} y={135+Math.floor(i/20)*56} width={45} height={37} rx={2} fill={P} opacity={go(f,i*.2,i*.2+15)}/>)}<T x={950} y={840} size={130} display anchor="middle">200 QUESTIONS</T></>
 else if(n>=16&&n<=18)content=<Count p={p} f={f} count={n===16?35:n===17?63:0} model={n===17?'DeepSeek':n===18?'Claude':undefined}/>

 else if(n===19||n===20)content=<><Photo p={p} k="musk" x={1150} w={770}/><Photo p={p} k="genericPhone" w={730}/><rect x={730} width={420} height={1080} fill={I}/><T x={800} y={220} size={80} display>GROK 4</T><Flag p={p} k="us" x={820} y={330} w={120}/><Pen d="M500 650C800 810 1100 400 1340 490M1290 445L1350 490L1290 525" progress={go(f,25,90)}/><rect x={1200} y={865} width={670} height={175} fill={I} opacity={.85}/><T x={1240} y={935} size={48}>ELON MUSK</T></>
 else if(n===22)content=<><Photo p={p} k="hardware" x={700} w={1220}/><Photo p={p} k="phone" w={850}/><Pen d="M580 420C890 320 1100 490 1410 640M1360 600L1420 642L1360 680" progress={go(f,10,85)}/><Flag p={p} k="cn" x={1460} y={760} w={160}/><T x={1370} y={980} size={47}>HOSTED SERVICE</T></>

 else if(n===23)content=<><Photo p={p} k="bank"/><T x={100} y={110} size={56}>ILLUSTRATION</T><Mark p={p} k="HSBC" x={150} y={170} w={170}/><Mark p={p} k="Mistral" x={1420} y={760} w={130}/><Pen d="M970 530Q1420 650 1600 330Q1700 180 1480 230M1500 185L1470 233L1527 255" progress={go(f,20,95)}/><Flag p={p} k="fr" x={1640} y={780} w={110}/></>

 else if(n===25)content=<><Photo p={p} k="hardware"/><Flag p={p} k="us" x={120} y={140} w={180}/><Mark p={p} k="DeepSeek" x={1310} y={350} w={210}/><Flag p={p} k="cn" x={1600} y={420} w={140}/><Pen d="M1190 280Q1580 180 1790 360Q1900 690 1460 760Q1190 750 1190 280" progress={go(f,20,70)}/><T x={100} y={110} size={56}>SELF-HOSTED · ILLUSTRATION</T></>
 else if(n===28)content=<><Photo p={p} k="cotton" opacity={.3}/><T x={960} y={130} size={55} anchor="middle">SAME PROMPT</T><Quote p={p} k="promptA1" x={500} y={260} w={1150} h={180}/><Flag p={p} k="cn" x={220} y={290} w={160}/><Quote p={p} k="promptA2" x={500} y={680} w={1150} h={180}/><Flag p={p} k="tm" x={220} y={710} w={160}/><Pen d="M190 520Q900 550 1720 520" progress={go(f,20,60)}/></>

 else if(n>=27&&n<=30){const swap=f>=(beat.countrySwitch??999999);content=<><Photo p={p} k="cotton"/><rect width={1920} height={1080} fill={I} opacity={.28}/>{['Claude','ChatGPT','DeepSeek'].map((m,i)=><Mark key={m} p={p} k={m} x={130+i*260} y={120} w={150}/>)}{n===29?<><Flag p={p} k={swap?'tm':'cn'} x={1250} y={350} w={170}/><T x={1040} y={650} size={72} display>{swap?'TURKMENISTAN':'XINJIANG'}</T><Pen d="M1030 700Q1410 730 1750 680" progress={go(f,30,75)}/></>:<>{[['cn','XINJIANG'],['tm','TURKMENISTAN']].map(([k,label],i)=><g key={k} transform={`translate(${1020+i*460} 410)`}><Flag p={p} k={k!} x={0} y={0} w={160}/><T x={0} y={240} size={44} display>{label}</T>{n===30&&<T x={0} y={350} size={32}>{i?'US BAN · MAY 2018':'US BAN · JUNE 2022'}</T>}</g>)}</>}</>}



 else if(n===31||n===34)content=<Answer p={p} id={n} f={f} frames={Math.round((beat.end-beat.start)*30)}/>

 else if(n===33)content=<><Photo p={p} k="blankPassports"/><g transform="translate(400 340) rotate(14)"><Flag p={p} k="tw" x={0} y={0} w={180}/><T x={0} y={260} size={74} fill={I} display>TAIWAN</T></g><g transform="translate(1320 500) rotate(-14)"><Flag p={p} k="sg" x={0} y={0} w={180}/><T x={0} y={260} size={74} fill={I} display>SINGAPORE</T></g></>

 else if(n===38||n===39)content=<><Photo p={p} k="components"/>{[['us',1020,300],['kr',1460,660],['cn',1420,270]].map(([k,x,y],i)=><g key={String(k)} opacity={go(f,15+i*15,40+i*15)}><Flag p={p} k={String(k)} x={Number(x)} y={Number(y)} w={110}/></g>)}<g opacity={go(f,85,110)} transform="translate(1260 550) rotate(-12)"><rect x={-20} y={-80} width={400} height={115} fill={M}/><T x={0} y={0} fill={I} size={72} display>{n===38?'TARIFF':'MY VIEW'}</T></g><T x={120} y={110} size={56}>ILLUSTRATIVE EXAMPLE</T></>

 else if(n===40)content=<><Photo p={p} k="genericPhone" x={0} w={820}/><Photo p={p} k="genericPhone" x={1100} w={820}/><rect x={820} width={280} height={1080} fill={I}/><Mark p={p} k="Claude" x={130} y={100} w={130}/><Flag p={p} k="us" x={300} y={115} w={130}/><g opacity={go(f,60,95)}><Mark p={p} k="Mistral" x={1230} y={100} w={130}/><Flag p={p} k="fr" x={1400} y={115} w={130}/></g><Pen d="M640 430Q960 280 1280 430M1230 390L1290 430L1230 465" progress={go(f,100,155)} width={12}/><Pen d="M1280 690Q960 840 640 690M690 655L630 690L690 730" progress={go(f,185,240)} width={12}/></>


 else content=<><Photo p={p} k="blankPassports" opacity={.2}/><image href={src(p,'wordmark')} x={350} y={350} width={1220} height={180}/><T x={960} y={700} size={70} anchor="middle">makeyourmindup.ai</T></>

 const scene=<svg viewBox="0 0 1920 1080" width={1920} height={1080}><defs><filter id="pen-fibre" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".08 .19" numOctaves={2} seed={17} result="g"/><feDisplacementMap in="SourceGraphic" in2="g" scale={2}/></filter></defs>{content}</svg>

 const face=p.camera&&[1,2,27,36,37,38,39,40].includes(n)&&(n!==1||f>105)&&(n!==38||f<Math.round((beat.end-beat.start)*30)-65)

 return <AbsoluteFill style={{background:I}}>{face?<><div style={{position:'absolute',left:0,top:0,width:608,height:1080,overflow:'hidden'}}><OffthreadVideo src={staticFile(p.camera!)} startFrom={Math.max(0,Math.round(beat.start*30)-3)} muted style={{width:'100%',height:'100%',objectFit:'cover'}}/></div><div style={{position:'absolute',left:608,top:171,width:1920,height:1080,transform:'scale(.6833)',transformOrigin:'top left'}}>{scene}</div><div style={{position:'absolute',left:606,top:0,width:3,height:1080,background:M}}/></>:scene}</AbsoluteFill>

}

export function EditorialLong(p:LongProps){

 const [ready]=useState(()=>delayRender('Load every bound photograph and evidence crop'))

 useEffect(()=>{let active=true;Promise.all(Object.values(p.assets).map(file=>new Promise<void>((resolve,reject)=>{const img=new window.Image();img.onload=()=>resolve();img.onerror=()=>reject(new Error('Image decode failed: '+file));img.src=file.startsWith('data:')?file:staticFile(file)}))).then(()=>document.fonts.ready).then(()=>{if(active)continueRender(ready)}).catch(cancelRender);return()=>{active=false}},[p.assets,ready])

 return <AbsoluteFill style={{background:I}}>{p.beats.map((b,i)=>{const start=i===0?0:Math.round(b.start*30)-3,end=i===p.beats.length-1?p.frames:Math.round(b.end*30)-3;return <Sequence key={b.beat} from={start} durationInFrames={end-start}><LongScene p={p} beat={b}/></Sequence>})}</AbsoluteFill>

}

