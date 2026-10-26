import React from 'react'
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion'
import '../house/fonts.css'

// A representative, unapproved motion proof. Its clock is an excerpt of the
// already accepted audio. Evidence quantities never depend on animation state.
export type NarrativeProps={assets:Record<string,string>;frames:number}
const P='#F4EFE4', I='#0C1512', M='#7EF0C0', R='#b0412e', G='#d5d7c9'
const mono='MYMU Plex Mono', sans='MYMU Archivo', display='MYMU Anton'
const cl={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const
const t=(f:number,a:number,b:number)=>interpolate(f,[a,b],[0,1],cl)
const ease=(x:number)=>x*x*(3-2*x)
const go=(f:number,a:number,b:number)=>ease(t(f,a,b))
const mix=(a:number,b:number,p:number)=>a+(b-a)*p
const pulse=(f:number,start:number)=>Math.sin(Math.PI*t(f,start,start+18))
function Txt({x,y,children,size=48,fill=I,font=mono,anchor='start'}:{x:number;y:number;children:React.ReactNode;size?:number;fill?:string;font?:string;anchor?:'start'|'middle'|'end'}){return <text x={x} y={y} fill={fill} fontSize={size} fontFamily={font} textAnchor={anchor}>{children}</text>}
function Flag({src,x,y,w=90}:{src:string;x:number;y:number;w?:number}){return <image href={src} x={x} y={y} width={w} height={w*.75}/>}
function Bubble({x,y,w=120,h=86,fill=P,lines=1,stroke=I}:{x:number;y:number;w?:number;h?:number;fill?:string;lines?:number;stroke?:string}){return <g transform={`translate(${x} ${y})`}><path d={`M8 0H${w-8}Q${w} 0 ${w} 8V${h-17}Q${w} ${h-9} ${w-8} ${h-9}H35L16 ${h+6}V${h-9}H8Q0 ${h-9} 0 ${h-17}V8Q0 0 8 0Z`} fill={fill} stroke={stroke} strokeWidth={4}/>{lines>0&&<><path d={`M${w*.18} ${h*.3}h${w*.62}`} stroke={stroke} strokeWidth={Math.max(3,w*.025)} strokeLinecap="round" opacity={lines}/><path d={`M${w*.18} ${h*.52}h${w*.4}`} stroke={stroke} strokeWidth={Math.max(3,w*.025)} strokeLinecap="round" opacity={lines}/></>}</g>}
function Chip({x,y,s=1,mark,active=0}:{x:number;y:number;s?:number;mark?:string;active?:number}){return <g transform={`translate(${x} ${y}) scale(${s})`}>
 <path d="M-135-135h270v270h-270z" fill={G} stroke={I} strokeWidth={7}/><path d="M-125 135h260l20-18V-138l-20 3V135z" fill={I}/>
 {Array.from({length:6},(_,n)=>{const z=-100+n*40;return <g key={n} stroke={I} strokeWidth={10}><path d={`M${z} -164v29M${z} 135v29M-164 ${z}h29M135 ${z}h29`}/></g>})}
 <rect x={-106} y={-106} width={212} height={212} rx={17} fill={P} stroke={I} strokeWidth={5}/>
 {mark?<image href={mark} x={-83} y={-83} width={166} height={166}/>:<Txt x={0} y={30} size={100} font={display} anchor="middle">AI</Txt>}
 <circle cx={87} cy={87} r={7+active*3} fill={active?M:I}/>
 </g>}
function PassportBook({x,y,open,label,country,flag}:{x:number;y:number;open:number;label:string;country:string;flag:string}){const cover=Math.max(.001,Math.cos(open*Math.PI/2));return <g transform={`translate(${x} ${y})`}>
 <rect x={13} y={17} width={380} height={416} rx={18} fill={I}/><rect width={380} height={416} rx={18} fill="#e5dece" stroke={I} strokeWidth={5}/>
 <path d="M18 394h344M18 401h344M18 408h344" stroke={I} strokeWidth={2} opacity={.4}/>
 <rect x={18} y={18} width={344} height={367} rx={9} fill={P}/><path d="M44 111h293M44 342h293" stroke={G} strokeWidth={3}/>
 <Txt x={42} y={87} size={52}>{label}</Txt><Flag src={flag} x={43} y={154} w={90}/><Txt x={146} y={211} size={48} font={sans}>{country}</Txt>
 <path d="M45 285h290m-290 17h290" stroke={G} strokeWidth={5}/>
 <g transform={`scale(${cover} 1)`} opacity={open>.98?0:1}><rect width={380} height={416} rx={18} fill={I}/><rect x={17} y={17} width={346} height={382} rx={10} fill="none" stroke={P} strokeWidth={2} opacity={.6}/><g transform="translate(190 184)" stroke={P} fill="none" strokeWidth={5}><circle r={73}/><ellipse rx={29} ry={73}/><path d="M-73 0h146M-61-38H61M-61 38H61"/></g><path d="M155 322h70v40h-70z" stroke={P} fill="none" strokeWidth={4}/><circle cx={190} cy={342} r={12} fill="none" stroke={P} strokeWidth={4}/></g>
 </g>}
function Rack({x,y,open=0,children}:{x:number;y:number;open?:number;children?:React.ReactNode}){return <g transform={`translate(${x} ${y})`}>
 <path d="M0 0h620l48-35H48z" fill="#e2ddce" stroke={I} strokeWidth={7}/><path d="M620 0l48-35v505l-48 35z" fill={I}/><rect width={620} height={505} rx={14} fill={P} stroke={I} strokeWidth={7}/>
 <path d="M30 470h560M30 34h560" stroke={G} strokeWidth={4}/>
 {[0,1,2,3,4,5].map(n=><g key={n} fill={I}><rect x={30} y={62+n*62} width={11} height={23} rx={3}/><rect x={578} y={62+n*62} width={11} height={23} rx={3}/></g>)}
 <path d="M66 442h105m18 0h105m18 0h105m18 0h105" stroke={I} strokeWidth={8}/>{children}
 <g transform={`translate(${open*650} ${-open*70})`} opacity={1-open}><rect x={17} y={17} width={586} height={470} rx={10} fill={P} stroke={I} strokeWidth={5}/>{[0,1,2].map(n=><g key={n} transform={`translate(42 ${48+n*143})`}><rect width={536} height={115} rx={10} fill={n===1?G:P} stroke={I} strokeWidth={4}/><circle cx={35} cy={57} r={10} fill={I}/><path d="M80 35h240m-240 22h240m-240 22h240" stroke={I} strokeWidth={4}/><path d="M390 30v55m20-55v55m20-55v55m20-55v55" stroke={I} strokeWidth={3}/></g>)}</g>
 </g>}
function Generic({f,a}:{f:number;a:Record<string,string>}){
 const fade=1-go(f,210,222),born=go(f,75,91),lives=go(f,112,128),answer=go(f,173,200)
 return <g opacity={fade}>
  <Txt x={540} y={220} anchor="middle" size={64} font={sans}>AI PASSPORTS</Txt>
  <Txt x={540} y={295} anchor="middle">EXAMPLE</Txt>
  <g>
   <PassportBook x={110} y={1280} open={born} label="BORN" country="CANADA" flag={a.ca!}/>
   <PassportBook x={590} y={1280} open={lives} label="LIVES" country="USA" flag={a.us!}/>
  </g>
  <Rack x={230} y={520} open={go(f,8,34)}/>
  <path d="M540 885V1100H300V1280" fill="none" stroke={I} strokeWidth={6} strokeDasharray="10 10" opacity={born}/>
  <path d="M900 800H1000V1200H780V1280" fill="none" stroke={I} strokeWidth={6} opacity={lives}/>
  <Chip x={540} y={770} s={.7} active={pulse(f,161)}/>
  <g transform={`translate(${mix(560,665,answer)} ${mix(770,975,answer)}) scale(${.35+.65*answer})`} opacity={answer}><Bubble x={0} y={0} w={245} h={175} lines={answer}/></g>
  <path d="M655 770Q740 800 695 975" fill="none" stroke={I} strokeWidth={5} pathLength={1} strokeDasharray={1} strokeDashoffset={1-answer} opacity={answer}/>
 </g>
}
function Evidence({f,a}:{f:number;a:Record<string,string>}){
 const enter=go(f,219,238),result=go(f,335,369),exit=go(f,498,510)
 const names=['DeepSeek','Kimi','Qwen','GLM'];const base=1-exit
 return <g opacity={base} transform={`translate(0 ${110*(1-enter)})`}>
  <Txt x={540} y={235} anchor="middle" size={48}>CS MONITOR · 23 SEP 2026</Txt>
  <path d="M115 290h850v310H115z" fill={P} stroke={I} strokeWidth={5}/><path d="M125 610h850V300" fill="none" stroke={I} strokeWidth={10}/>
  {names.map((name,i)=><g key={name} transform={`translate(${145+i*210} 330)`}>{name==='Qwen'?<svg width={155} height={130} viewBox="0 0 597 597"><image href={a[name]!} width={1984} height={597}/></svg>:<image href={a[name]!} width={155} height={130} preserveAspectRatio="xMidYMid meet"/>}{['DeepSeek','GLM','Qwen'].includes(name)&&<Txt x={77} y={199} size={48} font={sans} anchor="middle">{name}</Txt>}</g>)}
  <path d="M190 632v40h700v-40M540 672v60" fill="none" stroke={I} strokeWidth={5} strokeLinecap="round"/>
  <g opacity={enter}>
   {Array.from({length:100},(_,i)=>{
    const col=i%10,row=Math.floor(i/10),rise=go(f,245+row*4+col*.65,265+row*4+col*.65),selected=i<35;
    const colour=selected&&f>339+i*2.4?R:P;
    return <g key={i} opacity={rise} transform={`translate(${mix(510,116+col*86,rise)} ${mix(700,860+row*47,rise)}) scale(${.2+.8*rise})`}><Bubble x={0} y={0} w={74} h={34} lines={1} fill={colour} stroke={colour===R?P:I}/>{selected&&colour===R&&<rect x={-1} y={-1} width={76} height={37} rx={5} fill="none" stroke={R} strokeWidth={3}/>}</g>
   })}
  </g>
  <g opacity={result} transform={`translate(0 ${30*(1-result)})`}><Txt x={540} y={1540} size={230} font={display} anchor="middle" fill={R}>35%</Txt><Txt x={540} y={1625} size={49} anchor="middle">PROBLEM RESPONSES</Txt></g>
 </g>
}
function Claude({f,a}:{f:number;a:Record<string,string>}){const q=go(f,505,527),end=1-go(f,626,641);return <g opacity={end}>
 <g transform={`translate(${540-150*q} ${410-30*q})`}><rect x={-130} y={-130} width={560} height={260} rx={24} fill={I}/><image href={a.Claude!} x={-92} y={-86} width={170} height={170}/><Txt x={105} y={25} font={sans} size={67} fill={P}>Claude</Txt></g>
 <Txt x={330} y={682} size={52}>BORN</Txt><Flag src={a.us!} x={505} y={620} w={120}/><Txt x={655} y={682} size={52}>USA</Txt>
 {Array.from({length:6},(_,i)=>{const p=go(f,540+i*2,550+i*2),reply=go(f,560+i*2,570+i*2),y=850+i*145;return <g key={i}>
  <g opacity={p}><Bubble x={140} y={y} w={200} h={105} lines={0}/><Txt x={240} y={y+68} size={70} font={display} anchor="middle">?</Txt></g>
  <path d={`M370 ${y+48}h135m-22-18 22 18-22 18`} fill="none" stroke={I} strokeWidth={5} opacity={reply}/>
  <g transform={`translate(${35*(1-reply)} 0)`} opacity={reply}><Bubble x={550} y={y} w={350} h={105} lines={1}/></g>
 </g>})}
 </g>}
function Hosting({f,a}:{f:number;a:Record<string,string>}){
 const appear=go(f,631,650),named=go(f,741,758),send=go(f,778,834),retained=f>=834?1:0,china=go(f,831,844)
 return <g opacity={appear}>
  <g transform={`translate(0 ${55*(1-appear)})`}>
   <Txt x={540} y={235} anchor="middle" size={60}>LIVES</Txt>
   <g opacity={named}><image href={a.DeepSeek!} x={298} y={300} width={120} height={95}/><Txt x={445} y={370} font={sans} size={64}>DeepSeek</Txt></g>
   <g transform="translate(403 495)"><rect width={274} height={405} rx={35} fill={I}/><rect x={14} y={15} width={246} height={374} rx={25} fill={P}/><path d="M103 40h68M103 367h68" stroke={I} strokeWidth={10} strokeLinecap="round"/>
    <image href={a.DeepSeek!} x={91} y={63} width={92} height={70} opacity={named}/>
    <g opacity={go(f,692,709)}><Bubble x={39} y={155} w={196} h={130} fill={G} lines={go(f,699,733)}/></g>
   </g>
   <path d="M540 927v137m-19-20 19 20 19-20" fill="none" stroke={I} strokeWidth={6} pathLength={1} strokeDasharray={1} strokeDashoffset={go(f,746,764)===0?1:1-go(f,746,764)}/>
   <Rack x={230} y={1130} open={go(f,754,781)}><g><Chip x={310} y={140} s={.43} mark={a.DeepSeek!}/>
    <g opacity={retained}><Bubble x={175} y={285} w={270} h={145} fill={G}/></g></g></Rack>
   {send>0&&send<1&&<g transform={`translate(${mix(442,405,send)} ${mix(650,1415,send)}) scale(${mix(1,1.38,send)})`}><Bubble x={0} y={0} w={196} h={105} fill={G}/></g>}
   <g opacity={china}><Flag src={a.cn!} x={365} y={1700} w={112}/><Txt x={510} y={1765} size={65} font={sans}>CHINA</Txt></g>
  </g>
 </g>
}
export function Narrative(p:NarrativeProps){const f=useCurrentFrame();return <AbsoluteFill style={{background:P}}><svg viewBox="0 0 1080 1920" width={1080} height={1920}>
 {f<223&&<Generic f={f} a={p.assets}/>}
 {f>=223&&f<511&&<Evidence f={f} a={p.assets}/>}
 {f>=511&&f<642&&<Claude f={f} a={p.assets}/>}
 {f>=642&&<Hosting f={f} a={p.assets}/>}
 </svg></AbsoluteFill>}
