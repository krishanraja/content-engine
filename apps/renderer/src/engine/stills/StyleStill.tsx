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
 case 'face-with-proof': art=<>{text('AI didn’t',65,260,130,F.dek)}{text('help here.',65,410,130,F.dek,p.signal)}<rect x={65} y={530} width={950} height={1030} fill={p.paper}/>{text('A FINDING',110,720,120,F.display,p.ink)}{text('not a failing',110,840,75,F.dek,p.ink)}{rule(110,920,960,920,p.ink)}{text('Amazon memo',110,1400,46,F.data,p.ink)}{text('October 2026',110,1480,44,F.data,p.ink)}{text('Where AI works matters.',65,1770,54,F.dek)}</>;break
 case 'voice-led-pictures': art=<><rect width={1080} height={1920} fill={p.paper}/>{text('HANOI',55,230,240,F.dek,p.ink)}{text('1902',60,370,110,F.data,p.ink)}{Array.from({length:9},(_,i)=><g key={i}><rect x={i*135-50} y={630+(i%3)*90} width={110} height={790} fill={p.signal}/><path d={`M${i*135-70} ${630+(i%3)*90} l75 -140 l75 140`} fill={p.ink}/></g>)}{tail(630,1730,.8)}{text('Paid for tails.',55,1820,84,F.dek,p.ink)}</>;break
 case 'data-story': art=<>{text('ONE SONG.',55,240,154)}{text('MANY HANDS.',55,420,145,F.display,p.signal)}{['Lyrics · human','First voice · AI','Production · human','Lead vocal · human','Thin layer · AI'].map((s,i)=><g key={s}><rect x={65+i*38} y={550+i*228} width={880-i*38} height={195} fill={i%2?p.paper:p.signal}/>{text(s,95+i*38,670+i*228,49,F.data,p.ink)}</g>)}</>;break
 case 'fry-talking-head': art=<><circle cx={860} cy={300} r={410} fill={p.signal}/>{text('Why',65,530,240,F.dek)}{text('count',65,790,240,F.dek)}{text('tails?',65,1050,240,F.dek)}{tail(820,1810,.58)}{text('The rat-tail problem',65,1750,60,F.dek)}</>;break
 case 'scoreboard-test': art=<>{text('WHICH CAME',65,200,125)}{text('FIRST?',65,370,190,F.display,p.signal)}{['TikTok','Charts'].map((s,i)=><g key={s}><rect x={60} y={520+i*570} width={960} height={510} rx={35} fill={i?p.paper:p.signal}/>{text(`0${i+1}`,100,820+i*570,270,F.display,p.ink)}{text(s,510,820+i*570,105,F.dek,p.ink)}</g>)}{rule(95,1720,985,1720)}{text('The audience found the song.',65,1820,49,F.data)}</>;break
 case 'kinetic-movement': art=<><g transform="rotate(-12 540 960)">{text('200',30,590,470)}{rule(50,450,970,450,p.signal,30)}{text('100',45,1150,470,F.display,p.signal)}{text('HALF THE',65,1470,150)}{text('TARGET',65,1650,180)}</g></>;break
 default: art=<><path d="M70 60H1010V1800L970 1770L930 1800L890 1770L850 1800L810 1770L770 1800L730 1770L690 1800L650 1770L610 1800L570 1770L530 1800L490 1770L450 1800L410 1770L370 1800L330 1770L290 1800L250 1770L210 1800L170 1770L130 1800L70 1770Z" fill={p.paper}/>{text('THE AI BILL',120,255,105,F.data,p.ink)}{['Usage ↑','Useful work ?','Computing bill ↑'].map((s,i)=> <g key={s}>{text(s,120,520+i*220,64,F.data,p.ink)}{rule(120,570+i*220,950,570+i*220,p.ink,2)}</g>)}{text('COUNT',120,1270,155,F.display,p.ink)}{text('WHAT GOT',120,1450,155,F.display,p.ink)}{text('DONE',120,1660,210,F.display,p.ink)}</>
 }
 } else switch(id) {
 case 'ai-music-slam': art=<><rect y={1236} width={1080} height={684} fill={p.paper}/>{wave(300)}<g transform="rotate(3 600 860)"><rect x={110} y={500} width={880} height={650} fill={p.signal}/>{text('SINGING',160,740,185,F.display,p.ink)}{text('STILL IN',160,970,190,F.display,p.ink)}</g>{text('AI bits still in it.',60,1470,65,F.data,p.ink)}{text('Human voice.',60,1680,100,F.display,p.ink)}{text('Grammys · reportedly',60,1820,38,F.data,p.ink)}</>;break
 case 'character-ai-receipts': art=<><rect y={1000} width={1080} height={920} fill={p.paper}/><rect width={1080} height={10} fill={p.signal}/>{text('THE USAGE BILL',100,180,95,F.data)}{text('Fortune · April 2026',62,954,36,F.data)}{text('60T',65,1400,330,F.display,p.ink)}{text('TOKENS',65,1580,145,F.display,p.ink)}{text('A bill is not an outcome.',65,1800,65,F.dek,p.ink)}</>;break
 case 'eating-jobs-ladder': art=<>{text('COUNT',27,300,200)}{text('THE WORK',27,485,190,F.display,p.signal)}<g transform="rotate(-3 540 960)">{rule(275,580,275,1340,p.paper,32)}{rule(825,580,825,1340,p.paper,32)}{[650,850,1050,1250].map((y,i)=><g key={y}>{rule(275,y,825,y,i===3?p.signal:p.paper,28)}</g>)}</g><rect x={60} y={1430} width={880} height={330} rx={28} fill={p.signal}/>{text('Sales',105,1540,70,F.dek,p.ink)}{text('+7%',105,1710,180,F.display,p.ink)}{text('Medical-device study · Sep 2026',65,1840,34,F.data)}</>;break
 case 'dark-keynote': art=<><path d="M-200 1700L850 -100H1250L200 1920Z" fill={p.signal} opacity={.08}/>{text('7',60,1310,1280,F.display,p.signal)}{text('%',700,1300,360,F.display,p.signal)}{text('MONTHLY SALES ↑',65,1550,82,F.data)}{text('Target halved. Useful work stayed.',65,1740,43,F.data)}{text('Preprint · September 2026',65,1830,38,F.data)}</>;break
 case 'data-story': art=<>{text('HALF THE TARGET',65,220,115)}{rule(110,1530,980,1530,p.paper,4)}{rule(110,520,110,1530,p.paper,4)}<rect x={210} y={560} width={260} height={970} fill={p.paper}/><rect x={620} y={1045} width={260} height={485} fill={p.signal}/>{text('200',210,510,105)}{text('100',620,995,105,F.display,p.signal)}{text('0',65,1575,42,F.data)}{text('Monthly queries',110,1670,57,F.data)}{text('Medical-device preprint · Sep 2026',65,1820,36,F.data)}</>;break
 case 'full-visual': art=<>{text('WHO DID',65,200,170)}{text('WHICH BIT?',65,400,165,F.display,p.signal)}{wave(1680)}</>;break
 case 'hud-terminal': art=<>{Array.from({length:25},(_,i)=>rule(0,65+i*72,1080,65+i*72,p.signal,1))}{text('> audit queries',60,230,65,F.data)}{text('> repeated / off-task',60,430,53,F.data)}<path d="M145 690H75V1240H145M935 690H1005V1240H935" stroke={p.signal} fill="none" strokeWidth={12}/>{text('31%',125,1090,340,F.data,p.signal)}{text('JUNK',70,1450,130,F.data)}{text('Preprint · Sep 2026',70,1770,48,F.data)}</>;break
 case 'line-boil': art=<>{tail(600,1730,1.3)}<g transform="translate(1 -1)" opacity={.4}>{tail(600,1730,1.3)}</g>{text('a cent',60,210,130,F.dek)}{text('a rat tail',60,360,130,F.dek)}<circle cx={600} cy={1730} r={30} fill={p.signal}/></>;break
 case 'living-ui': art=<><rect x={30} y={60} width={1020} height={1790} rx={30} fill={p.paper}/>{text('Suno · Create',80,180,64,F.structure,p.ink)}{text('Rebuilt from suno.com',80,250,35,F.data,p.ink)}{text('Nov 2026',80,300,35,F.data,p.ink)}{text('Lyrics',80,600,65,F.structure,p.ink)}<rect x={60} y={680} width={960} height={650} rx={20} fill={p.ink} stroke={p.signal} strokeWidth={8}/>{text('I’m movin’',105,875,100,F.structure)}{text('to the sun',105,1010,100,F.structure)}{rule(700,1050,750,1050,p.signal,9)}<rect x={80} y={1500} width={920} height={190} rx={30} fill={p.signal}/>{text('Create song',200,1625,88,F.structure,p.ink)}</>;break
 case 'paper-cutout': art=<><rect width={1080} height={1920} fill={p.paper}/><g transform="rotate(-8 540 960)"><path d="M70 220L930 170L1020 1490L150 1660Z" fill={p.ink} transform="translate(4 4)"/><path d="M70 220L930 170L1020 1490L150 1660Z" fill={p.signal} stroke={p.paper} strokeWidth={14}/>{text('SONG',120,570,210,F.display,p.ink)}{text('WRITING',120,820,190,F.display,p.ink)}{text('RULED',140,1140,210,F.display,p.ink)}{text('OUT',140,1400,250,F.display,p.ink)}</g>{text('Grammys · reportedly',90,1800,43,F.data,p.ink)}</>;break
 case 'riso-halftone': art=<><rect width={1080} height={1920} fill={p.paper}/><circle cx={540} cy={980} r={650} fill={p.signal}/><circle cx={544} cy={984} r={480} fill="url(#dots)"/><circle cx={540} cy={980} r={100} fill={p.paper}/>{text('AI MUSIC',55,270,190,F.display,p.ink)}{text('HUMAN',55,1610,210,F.display,p.ink)}{text('MUSIC',55,1820,210,F.display,p.ink)}</>;break
 case 'single-line-drawing': art=<><path d="M60 100V450Q60 570 200 570H850Q980 570 980 720V930Q980 1050 820 1050H200Q60 1050 60 1200V1460Q60 1580 210 1580H960V1820" stroke={p.paper} strokeWidth={6} fill="none" strokeLinecap="round"/>{text('TikTok',140,390,110,F.data)}{text('Listeners',140,890,110,F.data)}{text('The charts',140,1440,110,F.data)}<circle cx={960} cy={1820} r={22} fill={p.signal}/></>;break
 case 'swiss-kinetic-type': art=<>{[60,380,700,1020].map(x=><g key={x}>{rule(x,0,x,1920,p.paper,1)}</g>)}{['AI IS','ALREADY','IN THE','MUSIC','YOU LOVE'].map((s,i)=><g key={s}>{text(s,60,270+i*340,i===3?235:170,F.display,i===3?p.signal:p.paper)}</g>)}</>;break
 default: art=<>{wave(230)}{wave(1690)}{text('a robot',65,740,150,F.structure)}{text('humming',65,950,150,F.structure,p.signal)}{text('underneath',65,1160,135,F.structure)}</>
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
export function StyleStill({layer,id}:Props) {
 const plan=coverPlan(layer,id), p=PALETTES[plan.palette]!, captionIndex=CAPTION_THEMES.indexOf(id as CaptionThemeName)
 const tokens=tokensFor(p)
 const captionProps=EngineRenderPropsSchema.parse({...fixture,tokens,captionTheme:layer==='captions'?id:'pop',captionPlacement:'centre',
 captions:[{fromFrame:0,toFrame:240,words:plan.beat.split(' ').map((text,i)=>({text,atFrame:i*10})),swipeIndex:Math.max(0,plan.beat.split(' ').length-1)}]})
 const name=bank.bank.find(b=>b.id===id&&b.layer===layer)?.name ?? id.replaceAll('-',' ')
 return <AbsoluteFill style={{background:p.ground,overflow:'hidden'}}>
  {layer==='captions'? <><CaptionBackdrop index={captionIndex} p={p}/>{id==='art-directed'?<ArtDirectedCaption props={captionProps} frame={90}/>:THEMES[id as Exclude<CaptionThemeName,'art-directed'>](captionProps,90)}</> : <Art id={id} layer={layer} p={p}/>}
  {layer==='motion'&&id==='full-visual'&&<Arrangement object={{obj:'song',device:'arrangement',meaning:'Who made each layer of the song',fromFrame:0,toFrame:240,variants:{},params:{title:'Who made which bit',lanes:[{id:'lyrics',name:'Lyrics',kind:'human',who:'Reiki healer'},{id:'production',name:'Production',kind:'human',who:'Producer'},{id:'voice',name:'Lead vocal',kind:'human',who:'Ultra Naté'},{id:'ai',name:'Thin vocal layer',kind:'ai',who:'AI singer'}]}}} events={[{id:'enter',obj:'song',verb:'enter',toState:'all',atFrame:0}]} box={{left:35,top:510,width:1010,height:990}} tokens={tokens} aspect="9:16" frame={90}/>}
  {layer==='motion'&&id==='character-ai-receipts'&&<Receipt object={{obj:'bill',device:'receipt_print',meaning:'Usage as a bill',fromFrame:0,toFrame:240,variants:{},params:{title:'META · 30 DAYS',lines:[{key:'tokens',row:'Tokens'}]},dataset:{unit:'tokens',denominator:null,producerLabel:'Fortune · April 2026',rows:[{label:'Tokens',value:60000000000000}]}}} events={[{id:'in',obj:'bill',verb:'enter',toState:'all',atFrame:0},{id:'line',obj:'bill',verb:'fill',toState:'tokens',atFrame:5}]} box={{left:66,top:254,width:946,height:498}} tokens={tokens} aspect="9:16" frame={90}/>}
  <div style={{position:'absolute',left:50,right:50,bottom:24,fontFamily:F.data,fontSize:24,color:layer==='treatment'&&['voice-led-pictures','receipt-animation'].includes(id)||['paper-cutout','riso-halftone','living-ui','character-ai-receipts','ai-music-slam'].includes(id)?p.ink:p.paper}}>{name}</div>
 </AbsoluteFill>
}
