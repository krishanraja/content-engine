import React from 'react'
import { AbsoluteFill } from 'remotion'
import { z } from 'zod'
import { HOUSE_FONTS as F } from '../../house/geometry'
import { CAPTION_THEMES, type CaptionThemeName } from '../captions/names'
import { THEMES } from '../captions/themes'
import { ArtDirectedCaption } from '../chrome/ArtDirectedCaption'
import { EngineRenderPropsSchema } from '../props'
import { Device as Arrangement } from '../devices/arrangement'
import { Device as Receipt } from '../devices/receipt_print'
import { PALETTES, tokensFor, type Palette } from './palettes'
import { coverPlan, type Layer } from './plan'
import bank from '../../../../../config/style-references.json'
import fixture from '../../../../../fixtures/ve/engine-core/props.json'
export { coverPlan, stillIds } from './plan'
export const StyleStillSchema = z.object({layer:z.enum(['treatment','motion','captions']), id:z.string()})
type Props = {layer:Layer; id:string}

function Portrait({p,close=false}:{p:Palette;close?:boolean}) {
 return <svg width={1080} height={1920} style={{position:'absolute',inset:0}}><g transform={close?'translate(-210 -150) scale(1.4)':'translate(650 150) scale(.35)'}><path d="M180 1200Q130 650 300 300Q540 60 780 300Q950 650 900 1200Q540 1440 180 1200" fill={p.paper}/><path d="M220 510Q170 160 540 170Q900 160 860 520Q700 290 540 390Q360 280 220 510" fill={p.ink}/><path d="M300 650Q370 610 440 650M640 650Q710 610 780 650M540 700Q470 890 590 860M380 1030Q540 1130 710 1020" fill="none" stroke={p.ink} strokeWidth={18} strokeLinecap="round"/></g></svg>
}

/** SVG art is authored in the full cover coordinate system; there is no shared headline or panel. */
function Art({id,layer,p}:{id:string;layer:Layer;p:Palette}) {
 const text=(s:string,x:number,y:number,size=90,face:string=F.display,fill=p.paper,extra:React.SVGProps<SVGTextElement>={})=>
  <text x={x} y={y} fontFamily={face} fontSize={size} fill={fill} {...extra}>{s}</text>
 const rule=(x:number,y:number,x2:number,y2:number,c=p.signal,w=5)=><path d={`M${x} ${y}L${x2} ${y2}`} stroke={c} strokeWidth={w} fill="none"/>
 const wave=(y:number,c=p.signal)=> <g>{Array.from({length:58},(_,i)=><rect key={i} x={28+i*18} y={y-Math.abs(Math.sin(i*1.7)*Math.cos(i*.24))*190} width={9} height={18+Math.abs(Math.sin(i*1.7)*Math.cos(i*.24))*380} fill={c}/>)}</g>
 const tail=(x:number,y:number,s=1)=><path d={`M${x} ${y} c${-220*s} ${-210*s} ${340*s} ${-410*s} ${120*s} ${-620*s} s${-260*s} ${-180*s} ${-100*s} ${-350*s}`} fill="none" stroke={p.paper} strokeWidth={12*s} strokeLinecap="round"/>
 const circles=<g>{Array.from({length:13},(_,i)=><circle key={i} cx={540} cy={920} r={120+i*64} fill="none" stroke={p.signal} opacity={.15+i*.035} strokeWidth={2}/>)}</g>
 let art:React.ReactNode
 if(layer==='treatment') {
 switch(id) {
 case 'face-with-proof': art=<><Portrait p={p}/>{text('AI didn’t',65,260,130,F.dek)}{text('help here.',65,410,130,F.dek,p.signal)}<rect x={65} y={530} width={950} height={1030} fill={p.paper}/>{text('A FINDING',110,720,120,F.display,p.ink)}{text('not a failing',110,840,75,F.dek,p.ink)}{rule(110,920,960,920,p.ink)}{text('Fortune · Amazon memo',110,1400,42,F.data,p.ink)}{text('October 2026',110,1480,44,F.data,p.ink)}{text('Where AI works matters.',65,1770,54,F.dek)}</>;break
 case 'voice-led-pictures': art=<><rect width={1080} height={1920} fill={p.paper}/><path d="M0 550Q220 430 440 550T1080 520V1920H0Z" fill={p.signal}/>{[80,320,780].map(x=><g key={x}><path d={`M${x} 600V240Q${x+90} 100 ${x+180} 240V600`} fill={p.ink}/><path d={`M${x-30} 250Q${x+90} 40 ${x+210} 250`} fill={p.signal}/></g>)}{[230,500].map((x,i)=><g key={x} transform={`translate(${x} ${850+i*250})`}><circle cy={-100} r={65} fill={p.ink}/><path d="M-60 -40Q-130 150 -90 310H80Q120 140 60 -40M-55 285Q-90 430 -110 500M55 285Q90 420 110 500M30 30Q180 80 250 -80" fill="none" stroke={p.ink} strokeWidth={38} strokeLinecap="round"/><path d="M250 -80Q310 -170 270 -220T300 -300" fill="none" stroke={p.ink} strokeWidth={9}/></g>)}<path d="M760 1000H1080V1500H760Z" fill={p.ink}/>{text('PAY',800,1150,80,F.data)}<circle cx={920} cy={790} r={65} fill={p.ink}/><path d="M900 840Q830 900 820 1010H1080V880Z" fill={p.ink}/>{text('HANOI · 1902',55,170,85,F.dek)}{text('Tails for payment',55,1790,80,F.dek,p.ink)}</>;break
 case 'data-story': art=<>{text('7%',65,650,480,F.display,p.paper)}{text('MONTHLY SALES GAIN',65,800,66,F.data)}{text('Medical-device preprint · Sep 2026',65,900,35,F.data)}{rule(100,1530,980,1530,p.paper,3)}{[380,700].map((x,i)=><rect key={x} x={x} y={1200-i*120} width={170} height={330+i*120} fill={i?p.signal:p.paper}/>)}{text('Before',340,1620,52,F.data)}{text('After',700,1620,52,F.data)}{text('Performance index',65,1100,48,F.data)}</>;break
 case 'fry-talking-head': art=<><Portrait close p={p}/>{text('Why count tails?',70,1530,105,F.display)}<path d="M120 660Q30 900 170 1050M170 1050Q110 1040 90 990M170 1050Q180 990 200 975M800 460Q1020 400 1000 700Q970 780 850 730" fill="none" stroke={p.signal} strokeWidth={9} strokeLinecap="round"/>{text('wrong metric',65,1190,58,F.dek,p.signal,{fontStyle:'italic',transform:'rotate(-8 65 1190)'})}{text('The rat-tail problem',65,1760,60,F.dek)}</>;break
 case 'scoreboard-test': art=<>{text('WHICH CAME',65,200,125)}{text('FIRST?',65,370,190,F.display,p.signal)}{['TikTok','Charts'].map((s,i)=><g key={s}><rect x={60} y={520+i*570} width={960} height={510} rx={35} fill={i?p.paper:p.signal}/>{text(`0${i+1}`,100,820+i*570,270,F.display,p.ink)}{text(s,510,820+i*570,105,F.dek,p.ink)}</g>)}{rule(95,1720,985,1720)}{text('The audience found the song.',65,1820,49,F.data)}</>;break
 case 'kinetic-movement': art=<><g transform="rotate(-12 540 960)">{text('200',30,590,470)}{rule(50,450,970,450,p.signal,30)}{text('100',45,1150,470,F.display,p.signal)}{text('HALF THE',65,1470,150)}{text('TARGET',65,1650,180)}</g></>;break
 default: art=<><path d="M70 60H1010V1800L970 1770L930 1800L890 1770L850 1800L810 1770L770 1800L730 1770L690 1800L650 1770L610 1800L570 1770L530 1800L490 1770L450 1800L410 1770L370 1800L330 1770L290 1800L250 1770L210 1800L170 1770L130 1800L70 1770Z" fill={p.paper}/>{text('THE AI BILL',120,255,105,F.data,p.ink)}{['Usage ↑','Useful work ?','Computing bill ↑'].map((s,i)=> <g key={s}>{text(s,120,520+i*220,64,F.data,p.ink)}{rule(120,570+i*220,950,570+i*220,p.ink,2)}</g>)}{text('COUNT',120,1270,155,F.display,p.ink)}{text('WHAT GOT',120,1450,155,F.display,p.ink)}{text('DONE',120,1660,210,F.display,p.ink)}</>
 }
 } else switch(id) {
 case 'ai-music-slam': art=<><rect y={1236} width={1080} height={684} fill={p.paper}/>{wave(300)}<g transform="rotate(3 600 860)"><rect x={110} y={500} width={880} height={650} fill={p.signal}/>{text('SINGING',160,740,185,F.display,p.ink)}{text('STILL IN',160,970,190,F.display,p.ink)}</g>{text('AI bits still in it.',60,1470,65,F.data,p.ink)}{text('Human voice.',60,1680,100,F.display,p.ink)}{text('Grammys · reportedly',60,1820,38,F.data,p.ink)}</>;break
 case 'character-ai-receipts': art=<><path d="M40 1000H1040V1820L1000 1800L960 1820L920 1800L880 1820L840 1800L800 1820L760 1800L720 1820L680 1800L640 1820L600 1800L560 1820L520 1800L480 1820L440 1800L400 1820L360 1800L320 1820L280 1800L240 1820L200 1800L160 1820L120 1800L80 1820L40 1800Z" fill={p.paper}/><rect width={1080} height={10} fill={p.signal}/>{text('THE USAGE BILL',100,180,95,F.data)}{text('Fortune · April 2026',62,954,36,F.data)}{text('60T',65,1400,330,F.display,p.ink)}{text('TOKENS',65,1580,145,F.display,p.ink)}{text('A bill is not an outcome.',65,1800,65,F.dek,p.ink)}</>;break
 case 'eating-jobs-ladder': art=<>{text('COUNT',27,300,200)}{text('THE WORK',27,485,190,F.display,p.signal)}<g transform="rotate(-3 540 960)">{rule(275,580,275,1340,p.paper,32)}{rule(825,580,825,1340,p.paper,32)}{[650,850,1050,1250].map((y,i)=><g key={y}>{rule(275,y,825,y,i===3?p.signal:p.paper,28)}</g>)}</g><rect x={60} y={1430} width={880} height={330} rx={28} fill={p.signal}/>{text('Sales',105,1540,70,F.dek,p.ink)}{text('+7%',105,1710,180,F.display,p.ink)}{text('Medical-device study · Sep 2026',65,1840,34,F.data)}</>;break
 case 'dark-keynote': art=<><path d="M-200 1700L850 -100H1250L200 1920Z" fill={p.signal} opacity={.08}/>{text('7',60,1310,1280,F.display,p.signal)}{text('%',700,1300,360,F.display,p.signal)}{text('MONTHLY SALES ↑',65,1550,82,F.data)}{text('Target halved. Useful work stayed.',65,1740,43,F.data)}{text('Preprint · September 2026',65,1830,38,F.data)}</>;break
 case 'data-story': art=<>{text('HALF THE TARGET',65,220,115)}{rule(110,1530,980,1530,p.paper,4)}{rule(110,520,110,1530,p.paper,4)}<rect x={210} y={560} width={260} height={970} fill={p.paper}/><rect x={620} y={1045} width={260} height={485} fill={p.signal}/>{text('200',210,510,105)}{text('100',620,995,105,F.display,p.signal)}{text('0',65,1575,42,F.data)}{text('Monthly queries',110,1670,57,F.data)}{text('Medical-device preprint · Sep 2026',65,1820,36,F.data)}</>;break
 case 'full-visual': art=<>{text('WHO DID',65,200,170)}{text('WHICH BIT?',65,400,165,F.display,p.signal)}{wave(1680)}</>;break
 case 'hud-terminal': art=<>{Array.from({length:25},(_,i)=>rule(0,65+i*72,1080,65+i*72,p.signal,1))}{text('> audit queries',60,230,65,F.data)}{text('> repeated / off-task',60,430,53,F.data)}<path d="M145 690H75V1240H145M935 690H1005V1240H935" stroke={p.signal} fill="none" strokeWidth={12}/>{text('31%',125,1090,340,F.data,p.signal)}{text('JUNK',70,1450,130,F.data)}{text('Preprint · Sep 2026',70,1770,48,F.data)}</>;break
 case 'line-boil': art=<>{[-1,0,1].map((o)=><g key={o} transform={`translate(${o*2} ${-o})`} opacity={o===0?1:.55}><path d="M320 1200C140 1110 170 820 390 780C550 640 800 800 870 1000Q1000 1040 920 1110Q790 1190 700 1130Q530 1290 320 1200C230 1320 820 1390 660 1600S220 1630 350 1760M740 820C650 610 890 670 830 860M330 1180Q300 1270 420 1250M650 1170Q640 1260 760 1230M900 1050Q990 1010 1020 1030M900 1080Q980 1100 1010 1140" fill="none" stroke={p.paper} strokeWidth={7} strokeLinecap="round"/><circle cx={850} cy={990} r={10} fill={p.paper}/></g>)}{text('a cent',60,210,130,F.dek)}{text('a rat tail',60,360,130,F.dek)}</>;break
 case 'living-ui': art=<><rect x={30} y={60} width={1020} height={1790} rx={30} fill={p.paper}/>{text('Suno · Create',80,180,64,F.structure,p.ink)}{text('Rebuilt from suno.com',80,250,35,F.data,p.ink)}{text('Nov 2026',80,300,35,F.data,p.ink)}{text('Lyrics',80,600,65,F.structure,p.ink)}<rect x={60} y={680} width={960} height={650} rx={20} fill={p.ink} stroke={p.signal} strokeWidth={8}/>{text('I’m movin’',105,875,100,F.structure)}{text('to the sun',105,1010,100,F.structure)}{rule(700,1050,750,1050,p.signal,9)}<rect x={80} y={1500} width={920} height={190} rx={30} fill={p.signal}/>{text('Create song',200,1625,88,F.structure,p.ink)}</>;break
 case 'paper-cutout': art=<><rect width={1080} height={1920} fill={p.paper}/><defs><filter id="paper-shadow"><feGaussianBlur stdDeviation="6"/></filter><pattern id="paper-grain" width="13" height="17" patternUnits="userSpaceOnUse"><path d="M2 3q3 4 5 0M8 12q2 -3 4 1" stroke={p.ink} opacity=".15" fill="none"/></pattern></defs>{[true,false].map(shadow=><path key={String(shadow)} d="M110 250L145 231L180 246L220 220L265 235L310 211L360 225L410 203L455 220L500 200L550 216L600 195L655 210L710 188L755 207L810 185L865 205L910 190L960 1480L930 1500L880 1495L830 1520L780 1510L730 1540L680 1526L630 1550L580 1542L530 1570L480 1557L430 1580L380 1572L330 1600L280 1587L220 1620Z" fill={shadow?p.ink:p.signal} filter={shadow?'url(#paper-shadow)':undefined} transform={shadow?'translate(6 8)':undefined}/>)}<path d="M110 250L910 190L960 1480L220 1620Z" fill="url(#paper-grain)"/>{text('SONG',170,570,190,F.display,p.ink)}{text('WRITING',170,820,170,F.display,p.ink)}{text('RULED',190,1140,190,F.display,p.ink)}{text('OUT',210,1410,240,F.display,p.ink)}{text('Grammys · reportedly',90,1800,43,F.data,p.ink)}</>;break
 case 'riso-halftone': art=<><rect width={1080} height={1920} fill={p.paper}/><circle cx={540} cy={980} r={650} fill={p.signal}/><circle cx={544} cy={984} r={480} fill="url(#dots)"/><circle cx={540} cy={980} r={100} fill={p.paper}/>{text('AI MUSIC',55,270,190,F.display,p.ink)}{text('HUMAN',55,1610,210,F.display,p.ink)}{text('MUSIC',55,1820,210,F.display,p.ink)}</>;break
 case 'single-line-drawing': art=<><path d="M60 100V450Q60 570 200 570H850Q980 570 980 720V930Q980 1050 820 1050H200Q60 1050 60 1200V1460Q60 1580 210 1580H960V1820" stroke={p.paper} strokeWidth={6} fill="none" strokeLinecap="round"/>{text('TikTok',140,390,110,F.data)}{text('Listeners',140,890,110,F.data)}{text('The charts',140,1440,110,F.data)}<circle cx={960} cy={1820} r={22} fill={p.signal}/></>;break
 case 'swiss-kinetic-type': art=<>{[60,380,700,1020].map(x=><g key={x}>{rule(x,0,x,1920,p.paper,1)}</g>)}{['AI IS','ALREADY','IN THE','MUSIC','YOU LOVE'].map((s,i)=><g key={s}>{text(s,60,270+i*340,i===3?235:170,F.display,i===3?p.signal:p.paper)}</g>)}</>;break
 default: art=<>{['A','ROBOT','HUMMING','UNDERNEATH'].map((w,i)=><g key={w}>{i===2&&<rect x={55} y={850} width={790} height={210} fill={p.signal}/ >}{text(w,65,450+i*290,w.length>9?135:180,F.structure,i===2?p.ink:p.paper,{fontWeight:900})}</g>)}</>
 }
 return <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position:'absolute',inset:0}}><defs><pattern id="dots" width={8} height={8} patternUnits="userSpaceOnUse"><circle cx={3} cy={3} r={2.3} fill={p.ink}/></pattern></defs>{art}</svg>
}

function CaptionBackdrop({index,p}:{index:number;p:Palette}) {
 // Independent top and bottom illustrations leave the entire caption envelope clear.
 const n=index+1
 return <svg width={1080} height={1920} style={{position:'absolute',inset:0}}>
  <defs><pattern id="caption-grain" width={17+n} height={21+n} patternUnits="userSpaceOnUse"><circle cx={3} cy={3} r={1} fill={p.paper} opacity={.12}/></pattern></defs>
  <rect width={1080} height={1920} fill="url(#caption-grain)"/>
  <svg x={0} y={0} width={1080} height={540} viewBox="0 0 1080 540" overflow="hidden">
   {index%3===0 ? Array.from({length:8+n%7},(_,i)=><rect key={i} x={-120+i*(65+n)} y={-100+i*12} width={45+n*2} height={700} fill={p.signal} transform={`rotate(${12+n} 540 270)`}/>) : index%3===1 ? Array.from({length:7+n%4},(_,i)=><circle key={i} cx={120+n*23} cy={n*17-40} r={70+i*(30+n)} fill="none" stroke={p.signal} strokeWidth={8+n%13}/>) : <path d={`M-100 520Q${100+n*20} ${-300+n*8} 540 300T1200 40V-50H-100Z`} fill={p.signal}/>}
  </svg>
  <svg x={0} y={1400} width={1080} height={520} viewBox="0 0 1080 520" overflow="hidden">
   {Array.from({length:5+n%9},(_,i)=><path key={i} d={`M${-100+i*(80+n)} 600 Q${120+i*60} ${-240+n*10} ${1100-i*20} ${100+i*35}`} stroke={p.signal} fill="none" strokeWidth={4+n%12} opacity={.2+i*.06}/>)}
  </svg>
 </svg>
}
// Sample the native theme during its entrance, rather than redrawing its move.
const sampleOffsets:Record<string,number> = {'slam':2,'stair-flash':2,'slot-roll':2,'flip-hinge':1,'slice':2,'ink-block':7,'cinematic':12,'art-directed':12}
function sampleFinish(node:React.ReactNode,id:string,p:Palette):React.ReactNode {
 if(!React.isValidElement(node)) return node
 const el=node as React.ReactElement<{style?:React.CSSProperties;children?:React.ReactNode;'data-caption-echo'?:boolean}>
 let style=el.props.style
 if(style && id==='cinematic' && style.backgroundClip==='text') style={...style,color:p.paper,backgroundImage:'none',WebkitTextStroke:'0px',backgroundClip:undefined,WebkitBackgroundClip:undefined}
 if(style && id==='art-directed' && el.props['data-caption-echo']!==undefined) style={...style,opacity:.3}
 if(style && id==='slam' && typeof style.opacity==='number' && style.opacity>=.55) style={...style,opacity:1}
 return React.cloneElement(el,style?{style}:{},React.Children.map(el.props.children,c=>sampleFinish(c,id,p)))
}
function CaptionSample({id,props,p}:{id:CaptionThemeName;props:ReturnType<typeof EngineRenderPropsSchema.parse>;p:Palette}) {
 const last=props.captions[0]!.words.at(-1)!.atFrame
 const frame=id in sampleOffsets?last+sampleOffsets[id]!:90
 const node=id==='art-directed'?<ArtDirectedCaption props={props} frame={frame}/>:THEMES[id](props,frame)
 // Resolve the chrome component so its echo can be styled without changing the theme.
 const native=id==='art-directed'?ArtDirectedCaption({props,frame}):node
 return <div data-caption-sample={id} style={{position:'absolute',inset:40,overflow:'hidden'}}><div style={{position:'absolute',left:-40,top:-40,width:1080,height:1920}}>{sampleFinish(native,id,p)}</div></div>
}
export function StyleStill({layer,id}:Props) {
 const plan=coverPlan(layer,id), p=PALETTES[plan.palette]!, captionIndex=CAPTION_THEMES.indexOf(id as CaptionThemeName)
 const tokens=tokensFor(p)
 const captionProps=EngineRenderPropsSchema.parse({...fixture,tokens,captionTheme:layer==='captions'?id:'pop',captionPlacement:'centre',
 captions:[{fromFrame:0,toFrame:240,words:plan.beat.split(' ').map((text,i)=>({text,atFrame:i*10})),swipeIndex:Math.max(0,plan.beat.split(' ').length-1)}]})
 const name=bank.bank.find(b=>b.id===id&&b.layer===layer)?.name ?? id.replaceAll('-',' ')
 return <AbsoluteFill style={{background:p.ground,overflow:'hidden'}}>
  {layer==='captions'? <><CaptionBackdrop index={captionIndex} p={p}/>{id in sampleOffsets?<CaptionSample id={id as CaptionThemeName} props={captionProps} p={p}/>:THEMES[id as Exclude<CaptionThemeName,'art-directed'>](captionProps,90)}</> : <Art id={id} layer={layer} p={p}/>}
  {layer==='motion'&&id==='full-visual'&&<Arrangement object={{obj:'song',device:'arrangement',meaning:'Who made each layer of the song',fromFrame:0,toFrame:240,variants:{},params:{title:'Who made which bit',lanes:[{id:'lyrics',name:'Lyrics',kind:'human',who:'Reiki healer'},{id:'production',name:'Production',kind:'human',who:'Producer'},{id:'voice',name:'Lead vocal',kind:'human',who:'Ultra Naté'},{id:'ai',name:'Thin vocal layer',kind:'ai',who:'AI singer'}]}}} events={[{id:'enter',obj:'song',verb:'enter',toState:'all',atFrame:0}]} box={{left:35,top:510,width:1010,height:990}} tokens={tokens} aspect="9:16" frame={90}/>}
  {layer==='motion'&&id==='character-ai-receipts'&&<Receipt object={{obj:'bill',device:'receipt_print',meaning:'Usage as a bill',fromFrame:0,toFrame:240,variants:{},params:{title:'META · 30 DAYS',lines:[{key:'tokens',row:'Tokens'}]},dataset:{unit:'tokens',denominator:null,producerLabel:'Fortune · April 2026',rows:[{label:'Tokens',value:60000000000000}]}}} events={[{id:'in',obj:'bill',verb:'enter',toState:'all',atFrame:0},{id:'line',obj:'bill',verb:'fill',toState:'tokens',atFrame:5}]} box={{left:66,top:254,width:946,height:498}} tokens={tokens} aspect="9:16" frame={90}/>}
  <div style={{position:'absolute',left:50,right:50,bottom:24,fontFamily:F.data,fontSize:24,...(layer==='treatment'?{background:p.ground,padding:'8px 12px'}:{}),color:layer==='treatment'?p.paper:['paper-cutout','riso-halftone','living-ui','character-ai-receipts','ai-music-slam'].includes(id)?p.ink:p.paper}}>{name}</div>
 </AbsoluteFill>
}
