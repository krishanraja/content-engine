import React from 'react'
import {AbsoluteFill, Img, OffthreadVideo, Sequence, staticFile, useCurrentFrame, interpolate} from 'remotion'
import {Photographic,Pen} from './Photographic'
import type {ShortProps} from './Short'
import '../house/fonts.css'

const I='#0C1512',P='#F4EFE4',M='#7EF0C0',R='#b0412e'
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const
const go=(f:number,a=0,b=18)=>{const x=interpolate(f,[a,b],[0,1],clamp);return x*x*(3-2*x)}
const mono='MYMU Plex Mono',sans='MYMU Archivo',display='MYMU Anton'
const Text=({x,y,children,size=48,fill=P,anchor='start',font=mono}:{x:number;y:number;children:React.ReactNode;size?:number;fill?:string;anchor?:'start'|'middle'|'end';font?:string})=><text x={x} y={y} fontFamily={font} fontSize={size} fill={fill} textAnchor={anchor}>{children}</text>
const Defs=()=> <defs><filter id="pen-fibre" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".08 .19" numOctaves={2} seed={17} result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale={3}/></filter><linearGradient id="ink-fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={I} stopOpacity={0}/><stop offset="1" stopColor={I}/></linearGradient></defs>
const Photo=({src,opacity=1,scale=1}:{src:string;opacity?:number;scale?:number})=><image href={src} width={1080} height={1920} opacity={opacity} transform={`translate(${540*(1-scale)} ${960*(1-scale)}) scale(${scale})`}/>
const Flag=({a,k,x,y,w=110}:{a:Record<string,string>;k:string;x:number;y:number;w?:number})=><image href={a[k]} x={x} y={y} width={w} height={w*.75}/>
function Mark({a,name,x,y,w=150}:{a:Record<string,string>;name:string;x:number;y:number;w?:number}){return name==='Qwen'?<svg x={x} y={y} width={w} height={w} viewBox="0 0 597 597"><image href={a.Qwen} width={1984} height={597}/></svg>:<image href={a[name]} x={x} y={y} width={w} height={w} preserveAspectRatio="xMidYMid meet"/>}
function Atmosphere({a}:{a:Record<string,string>}){return <><Photo src={a.hardware!} opacity={.33}/><rect width={1080} height={1920} fill={I} opacity={.45}/></>}
function GenericPhone({a,name,f=100}:{a:Record<string,string>;name:string;f?:number}){return <><Photo src={a.genericPhone!}/><g transform="translate(278 180) rotate(13)"><rect x={-25} y={-20} width={330} height={130} rx={4} fill={['Claude','ChatGPT'].includes(name)?I:P}/><Mark a={a} name={name} x={0} y={0} w={85}/><Text x={106} y={61} size={48} font={sans} fill={['Claude','ChatGPT'].includes(name)?P:I}>{name}</Text></g><g opacity={1-go(f,30,68)}><path d="M222 424L507 498L474 591L185 514Z" fill="#e8e5d9"/></g></>}

function Scene({id,p}:{id:string;p:ShortProps}){
 const f=useCurrentFrame(),a=p.assets
 if(id==='S08-lives')return <Photographic frames={245} assets={a}/>
 if(id==='S11-deleted')return <AbsoluteFill style={{background:I,color:P}}>
  <Img src={a.hardware!} style={{position:'absolute',width:1080,height:1920,objectFit:'cover',opacity:.17}}/>
  <div style={{position:'absolute',left:90,top:190}}><Img src={a.DeepSeek!} style={{width:190,height:190,objectFit:'contain'}}/></div>
  <div style={{position:'absolute',left:90,top:460,fontFamily:mono,fontSize:46}}>24 OCT · RECORDING</div>
  <div style={{position:'absolute',left:60,top:655,width:960,height:299,background:'white',overflow:'hidden',boxShadow:'0 25px 90px #0008',transform:`scale(${1+.025*go(f,0,50)})`}}>
   {f<96?<OffthreadVideo src={staticFile('deletion-real.mp4')} muted style={{width:960,height:299}}/>:<Sequence from={96}><OffthreadVideo src={staticFile('deletion-replay.mp4')} muted style={{width:960,height:299}}/></Sequence>}
  </div>
  {f>=96&&<div style={{position:'absolute',left:90,top:1090,fontFamily:mono,fontSize:48}}>4× REPLAY</div>}
  <div style={{position:'absolute',left:90,top:1350,fontFamily:mono,fontSize:46}}>23 OCT</div>
  <div style={{position:'absolute',left:90,top:1430,fontFamily:display,fontSize:180,color:M}}>3/3 <span style={{fontFamily:mono,fontSize:48,color:P}}>RUNS</span></div>
 </AbsoluteFill>
 return <AbsoluteFill style={{background:I}}><svg viewBox="0 0 1080 1920" width={1080} height={1920}><Defs/>
 {id==='S01-hook'&&<>
  <Atmosphere a={a}/><GenericPhone a={a} name={['DeepSeek','Qwen','Claude','ChatGPT'][Math.min(3,Math.floor(f/42))]!}/>
  <g opacity={go(f,18,40)}><Pen d="M312 514Q750 560 762 1210M722 1172L762 1220L801 1170" progress={go(f,18,76)}/><Text x={760} y={1430} font={display} size={250} fill={M} anchor="middle">?</Text></g>
  <Text x={540} y={1835} anchor="middle" size={42}>ILLUSTRATION</Text>
 </>}
 {(id==='S02-airbnb'||id==='S03-fling')&&<>
  <image href={a.chesky} x={0} y={0} width={1080} height={1180} preserveAspectRatio="xMidYMid slice"/>
  <rect y={720} width={1080} height={520} fill="url(#ink-fade)"/>
  <Text x={85} y={1080} font={sans} size={78}>BRIAN CHESKY</Text>
  <Text x={85} y={1160} size={45}>AIRBNB</Text>
  <g transform={`translate(0 ${id==='S02-airbnb'?70*(1-go(f,38,72)):0})`} opacity={id==='S02-airbnb'?go(f,38,72):1}><Mark a={a} name="Qwen" x={700} y={1270} w={240}/><Text x={820} y={1590} size={68} anchor="middle" font={sans}>Qwen</Text></g>
  <Pen d="M300 1190Q300 1440 669 1435M633 1401L678 1436L636 1472" progress={id==='S02-airbnb'?go(f,50,104):1} width={15}/>
 </>}
 {(id==='S04-passports'||id==='S12-call')&&<>
  <Photo src={a.passports!}/>
  <g transform="translate(300 224) rotate(14)" opacity={go(f,19,31)}><Text x={0} y={0} fill={I} size={58}>BORN</Text><Pen d="M-7 22Q120 12 269 22" progress={go(f,20,45)} width={9}/></g>
  <g transform="translate(660 1080) rotate(-14)" opacity={go(f,73,88)}><Text x={0} y={0} fill={I} size={58}>LIVES</Text><Pen d="M-7 18Q130 24 252 15" progress={go(f,74,106)} width={9}/></g>
  <rect y={1750} width={1080} height={170} fill="url(#ink-fade)"/>
  <Text x={540} y={1850} anchor="middle" size={44}>AI · EXAMPLE</Text>
  {id==='S12-call'&&<>
   <Pen d="M586 1138Q572 1052 769 1022Q980 996 1000 1100Q1018 1190 820 1256Q630 1300 586 1138" progress={go(f,40,80)} width={10} opacity={1-.8*go(f,106,120)}/>
   <Pen d="M252 350Q261 264 461 301L655 359Q793 408 768 492Q740 557 543 507L354 449Q230 420 252 350" progress={go(f,109,145)} width={10}/>
  </>}
 </>}
 {(id==='S05-newspaper'||id==='S06-third')&&<>
  <Atmosphere a={a}/>
  {['DeepSeek','Kimi','Qwen','GLM'].map((name,i)=><g key={name} opacity={id==='S06-third'?1:go(f,25+i*7,43+i*7)}><circle cx={185+i*238} cy={440} r={94} fill={P}/><Mark a={a} name={name} x={118+i*238} y={373} w={134}/>{name!=='Kimi'&&<Text x={185+i*238} y={608} size={44} anchor="middle" font={sans}>{name}</Text>}</g>)}
  <Pen d="M188 675Q500 770 895 675" progress={id==='S06-third'?1:go(f,64,100)} width={11}/>
  {id==='S05-newspaper'?<g opacity={go(f,65,86)}><Text x={540} y={1180} size={350} font={display} anchor="middle" fill={M}>200</Text><Text x={540} y={1300} size={55} anchor="middle">QUERIES</Text></g>:<>
   <circle cx={540} cy={1120} r={300} fill="none" stroke={P} strokeOpacity={.2} strokeWidth={45}/>
   <circle cx={540} cy={1120} r={300} fill="none" stroke="#ff9b85" strokeWidth={45} pathLength={100} strokeDasharray={`${35*go(f,0,56)} 100`} transform="rotate(-90 540 1120)"/>
   <Text x={540} y={1190} size={218} font={display} anchor="middle">35%</Text>
   <Text x={540} y={1540} size={49} anchor="middle">PROBLEM RESPONSES</Text>
  </>}
 </>}
 {id==='S07-claude'&&<>
  <Atmosphere a={a}/><GenericPhone a={a} name="Claude" f={f}/>
  <Pen d="M193 449Q145 394 296 406L481 455Q551 513 479 588L213 537Q167 509 193 449" progress={go(f,34,87)} width={10}/>
  <g opacity={go(f,15,35)}><Text x={95} y={1330} size={52}>BORN</Text><Flag a={a} k="us" x={310} y={1260} w={130}/><Text x={490} y={1330} size={62}>USA</Text></g>
  <Text x={540} y={1835} anchor="middle" size={42}>ILLUSTRATION</Text>
 </>}
 {(id==='S09-work'||id==='S10-flagged')&&<>
  <Photo src={a.cotton!}/><rect width={1080} height={700} fill={I} opacity={.36}/>
  <Text x={75} y={150} size={50}>MY TEST</Text>
  {(id==='S09-work'?['Claude','ChatGPT','DeepSeek']:['Claude','ChatGPT']).map((name,i)=><g key={name} opacity={go(f,i*9,i*9+18)}><rect x={70+i*330} y={235} width={280} height={250} fill={I} opacity={.92}/><Mark a={a} name={name} x={130+i*330} y={265} w={150}/><Text x={210+i*330} y={480} size={42} font={sans} anchor="middle">{name}</Text></g>)}
  {id==='S09-work'?<g opacity={go(f,145,160)}><Flag a={a} k="cn" x={665} y={650} w={100}/><Text x={630} y={820} size={53}>XINJIANG</Text></g>:<g><Pen d="M300 530Q780 560 770 1205M734 1167L771 1211L809 1163" progress={go(f,4,29)} width={15}/><g transform="translate(800 1300) rotate(-18)" filter="url(#pen-fibre)" opacity={go(f,20,28)}><path d="M0 -92Q10 -99 18 -83L100 65Q109 80 90 82L-93 80Q-108 80 -98 62Z" fill={P} fillOpacity={.94} stroke={R} strokeWidth={11} pathLength={1} strokeDasharray={1} strokeDashoffset={1-go(f,20,42)}/><path d="M3 -42L3 14M3 43L3 46" stroke={R} strokeWidth={14} strokeLinecap="round" opacity={go(f,36,44)}/></g></g>}
  <rect y={1720} width={1080} height={200} fill="url(#ink-fade)"/><Text x={540} y={1840} size={42} anchor="middle">ILLUSTRATION</Text>
 </>}
 {id==='S13-do'&&<>
  <Atmosphere a={a}/>
  <g transform="translate(-130 90) scale(.79)"><GenericPhone a={a} name="Claude" f={100}/></g>
  <defs><linearGradient id="second-phone-feather" x1="0" y1="0" x2="150" y2="0" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="black"/><stop offset="1" stopColor="white"/></linearGradient><mask id="second-phone-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="1080" height="1920"><rect width="1080" height="1920" fill="url(#second-phone-feather)"/></mask></defs>
  <g transform={`translate(${380+250*(1-go(f,133,164))} 640) scale(.79)`} opacity={go(f,133,164)}><g mask="url(#second-phone-mask)"><GenericPhone a={a} name="ChatGPT" f={100}/></g></g>
  <g opacity={1-go(f,121,135)}><Text x={700} y={1430} size={250} font={display} fill={M}>?</Text><Pen d="M200 1290Q610 1460 735 1350" progress={go(f,22,66)} width={16}/></g>
  <Pen d="M295 570C650 620 390 850 650 1015M605 1016L658 1020L642 969" progress={go(f,166,190)} width={13}/>
  <Text x={540} y={1835} size={42} anchor="middle">ILLUSTRATION</Text>
 </>}
 {id==='S14-close'&&<>
  <Atmosphere a={a}/><image href={a.wordmark} x={85} y={740} width={910} height={135}/><Text x={540} y={1000} size={66} anchor="middle" font={sans}>makeyourmindup.ai</Text>
  <Pen d="M99 1060Q520 1033 927 1064" progress={go(f,3,28)} width={17}/>
 </>}
 </svg></AbsoluteFill>
}

export function EditorialShort(p:ShortProps){return <AbsoluteFill style={{background:I}}>{p.beats.map((b,i)=>{
 const start=i===0?0:Math.max(0,Math.round(b.start*30)-3),end=i===p.beats.length-1?p.frames:Math.round(b.end*30)-3
 return <Sequence key={b.beat} from={start} durationInFrames={end-start}><Scene id={b.beat} p={p}/></Sequence>
})}</AbsoluteFill>}
