import React from 'react'
import { AbsoluteFill } from 'remotion'
import { z } from 'zod'
import { HOUSE_FONTS as F } from '../../house/geometry'
import { CAPTION_THEMES, type CaptionThemeName } from '../captions/names'
import { THEMES } from '../captions/themes'
import { ArtDirectedCaption } from '../chrome/ArtDirectedCaption'
import { EngineRenderPropsSchema } from '../props'
import { Device as Arrangement } from '../devices/arrangement'
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
 case 'face-with-proof': art=<><rect x={60} y={90} width={960} height={650} fill={p.paper}/>{text('AMAZON MEMO',100,230,70,F.data,p.ink)}{text('AI didn’t',100,410,120,F.dek,p.ink)}{text('help here.',100,560,120,F.dek,p.ink)}<DrawnPresenter p={p} y={800}/>{text('Where AI works matters.',65,1810,58,F.dek)}</>;break
 case 'fry-talking-head': art=<><DrawnPresenter p={p} y={150} scale={1.2}/><path d="M120 500Q40 700 180 870M960 500Q1040 700 900 870" stroke={p.signal} fill="none" strokeWidth={10}/>{text('Why count',75,1480,160,F.structure)}{text('tails?',75,1690,210,F.structure,p.signal)}</>;break
 case 'voice-led-pictures': art=<><rect width={1080} height={1920} fill={p.paper}/>{Array.from({length:10},(_,i)=><g key={i}><rect x={i*130-60} y={250+i%3*100} width={120} height={1400} fill={i%2?p.ink:p.signal}/><path d={`M${i*130-70} ${250+i%3*100}l70 -150 70 150`} fill={p.ink}/></g>)}<path d="M0 1600Q540 1450 1080 1650V1920H0Z" fill={p.ink}/>{text('Hanoi paid for tails.',55,1770,90,F.dek)}{text('1902',55,1870,52,F.data)}</>;break
 case 'data-story': art=<>{text('THE THIN AI LAYER',65,240,106)}<circle cx={540} cy={890} r={360} fill="none" stroke={p.paper} strokeWidth={110}/><path d="M540 530A360 360 0 0 1 882 779" stroke={p.signal} strokeWidth={110} fill="none"/>{text('ONE',540,870,200,F.display,p.paper,{textAnchor:'middle'})}{text('LAYER',540,1050,160,F.display,p.signal,{textAnchor:'middle'})}{text('Human-led rebuild',65,1500,80,F.dek)}{text('AI vocal underneath',65,1630,70,F.dek,p.signal)}{text('Music reconstruction · Nov 2026',65,1800,40,F.data)}</>;break
 case 'scoreboard-test': art=<><rect x={40} y={160} width={1000} height={1450} rx={32} fill={p.paper}/>{text('LIVE / DISCOVERY TEST',85,300,58,F.data,p.ink)}{['TikTok   01','Charts   02'].map((line,i)=><g key={line}><rect x={80} y={450+i*370} width={920} height={300} fill={i?p.ink:p.signal}/>{text(line,110,650+i*370,102,F.data,i?p.paper:p.ink)}</g>)}{text('AUDIENCE FIRST',90,1410,105,F.display,p.ink)}{text('The song was found, then ranked.',65,1790,49,F.dek)}</>;break
 case 'kinetic-movement': art=<>{[0,1,2].map(i=><g key={i} opacity={.08+i*.08} transform={`translate(${-160+i*45} ${i*45}) rotate(-12 540 960)`}>{text('REBUILT',55,850,210)}</g>)}<g transform="rotate(-12 540 960)">{text('REBUILT',55,850,210)}{text('BY HAND',55,1100,210,F.display,p.signal)}</g>{text('The producer started again.',65,1750,65,F.dek)}</>;break
 default: art=<><rect x={240} y={100} width={600} height={120} rx={50} fill={p.signal}/><path d="M280 170H800V1720l-26 -16 -26 16 -26 -16 -26 16 -26 -16 -26 16 -26 -16 -26 16 -26 -16 -26 16 -26 -16 -26 16 -26 -16 -26 16 -26 -16 -26 16 -26 -16 -26 16 -26 -16Z" fill={p.paper}/>{text('THE AI BILL',320,330,61,F.data,p.ink)}{Array.from({length:8},(_,i)=><g key={i}>{rule(315,420+i*125,765,420+i*125,p.ink,2)}{text(['Usage up','Useful work?','Cost up','Tasks repeated','Hours saved?','Value unclear','Audit due','TOTAL: ?'][i]!,320,490+i*125,36,F.data,p.ink)}</g>)}{text('Count what got done.',65,1830,66,F.dek)}</>
 }
 } else switch(id) {
 case 'ai-music-slam': art=<><rect y={1236} width={1080} height={684} fill={p.paper}/>{wave(300)}<g transform="rotate(3 600 860)"><rect x={110} y={500} width={880} height={650} fill={p.signal}/>{text('SINGING',160,740,185,F.display,p.ink)}{text('STILL IN',160,970,190,F.display,p.ink)}</g>{text('AI bits still in it.',60,1470,65,F.data,p.ink)}{text('Human voice.',60,1680,100,F.display,p.ink)}{text('Grammys · reportedly',60,1820,38,F.data,p.ink)}</>;break
 case 'character-ai-receipts': art=<><path d="M110 140H970V1660L940 1640L910 1660L880 1640L850 1660L820 1640H110Z" fill={p.paper}/>{text('META · 30 DAYS',155,300,72,F.data,p.ink)}{rule(155,370,925,370,p.ink,3)}{['Usage statement','Tokens processed','60 TRILLION','Outcome: unmeasured','A bill is not an outcome.'].map((line,i)=>text(line,155,570+i*210,i===2?91:46,F.data,i===2?p.signal:p.ink))}{text('Fortune · April 2026',155,1530,38,F.data,p.ink)}</>;break
 case 'eating-jobs-ladder': art=<>{text('COUNT',27,300,200)}{text('THE WORK',27,485,190,F.display,p.signal)}<g transform="rotate(-3 540 960)">{rule(275,580,275,1340,p.paper,32)}{rule(825,580,825,1340,p.paper,32)}{[650,850,1050,1250].map((y,i)=><g key={y}>{rule(275,y,825,y,i===3?p.signal:p.paper,28)}</g>)}</g><rect x={60} y={1430} width={880} height={330} rx={28} fill={p.signal}/>{text('Sales',105,1540,70,F.dek,p.ink)}{text('+7%',105,1710,180,F.display,p.ink)}{text('Medical-device study · Sep 2026',65,1840,34,F.data)}</>;break
 case 'dark-keynote': art=<><rect width={1080} height={1920} fill="url(#grain)"/><path d="M0 1550L700 200H1080L350 1800Z" fill="url(#sweep)"/>{text('7%',540,1260,720,F.display,p.signal,{textAnchor:'middle',textLength:920,lengthAdjust:'spacingAndGlyphs'})}{text('MONTHLY SALES ↑',65,1550,82,F.data)}{text('Target halved. Useful work stayed.',65,1740,43,F.data)}{text('Preprint · September 2026',65,1830,38,F.data)}</>;break
 case 'data-story': art=<>{text('HALF THE TARGET',65,220,115)}{rule(110,1530,980,1530,p.paper,4)}{rule(110,520,110,1530,p.paper,4)}<rect x={210} y={560} width={260} height={970} fill={p.paper}/><rect x={620} y={1045} width={260} height={485} fill={p.signal}/>{text('200',210,510,105)}{text('100',620,995,105,F.display,p.signal)}{text('0',65,1575,42,F.data)}{text('Monthly queries',110,1670,57,F.data)}{text('Medical-device preprint · Sep 2026',65,1820,36,F.data)}</>;break
 case 'full-visual': art=<>{text('WHO DID',65,200,170)}{text('WHICH BIT?',65,400,165,F.display,p.signal)}{wave(1680)}</>;break
 case 'hud-terminal': art=<>{Array.from({length:25},(_,i)=>rule(0,65+i*72,1080,65+i*72,p.signal,1))}{text('> audit queries',60,230,65,F.data)}{text('> repeated / off-task',60,430,53,F.data)}<path d="M145 690H75V1240H145M935 690H1005V1240H935" stroke={p.signal} fill="none" strokeWidth={12}/>{text('31%',125,1090,340,F.data,p.signal)}{text('JUNK',70,1450,130,F.data)}{text('Preprint · Sep 2026',70,1770,48,F.data)}</>;break
 case 'line-boil': art=<>{[11,29,47].map(seed=><g key={seed} opacity={.65}><path d={jitterRat(seed)} fill="none" stroke={p.paper} strokeWidth={5} strokeLinejoin="round"/><circle cx={738+seed%3} cy={862+seed%5} r={8} fill={p.signal}/></g>)}{text('a cent',60,210,130,F.dek)}{text('a rat tail',60,360,130,F.dek)}{text('Hanoi · 1902',65,1800,50,F.data)}</>;break
 case 'living-ui': art=<><rect width={1080} height={1920} fill={p.ink}/>{text('Suno / Create',65,180,70,F.structure)}<svg x={40} y={360} width={1000} height={1220} viewBox="0 0 500 610" overflow="hidden" data-ui-zoom="2"><rect width={500} height={610} rx={18} fill={p.paper}/>{text('Custom',25,55,26,F.structure,p.ink)}{text('Lyrics',25,150,35,F.structure,p.ink)}<rect x={20} y={180} width={460} height={240} rx={12} stroke={p.signal} strokeWidth={5} fill={p.ink}/>{text('I’m movin’',40,250,40,F.structure)}{text('to the sun',40,310,40,F.structure)}<path d="M365 322v60l16 -15 14 28 13 -7 -15 -27 23 -1Z" fill={p.paper} stroke={p.ink} strokeWidth={3}/>{text('Styles',25,475,28,F.structure,p.ink)}{text('Soul, dance',25,525,26,F.structure,p.ink)}</svg>{text('Source: suno.com/create',65,1735,41,F.data)}{text('Drawn reconstruction · Nov 2026',65,1810,37,F.data)}</>;break
 case 'paper-cutout': art=<><rect width={1080} height={1920} fill={p.paper}/>{[0,1,2,3].map(i=><g key={i} transform={`rotate(${[-7,4,-3,2][i]} 540 960)`}><path d={`M${70+i*32} ${240+i*290}l110 -12 100 7 90 -14 100 8 90 -8 120 12 130 -6 90 14 -10 330 -105 9 -100 -12 -110 8 -100 -7 -100 12 -110 -8 -100 12Z`} fill={p.shade} transform="translate(3 4)"/><path d={`M${70+i*32} ${240+i*290}l110 -12 100 7 90 -14 100 8 90 -8 120 12 130 -6 90 14 -10 330 -105 9 -100 -12 -110 8 -100 -7 -100 12 -110 -8 -100 12Z`} fill={i%2?p.paper:p.signal} stroke={p.ink} strokeWidth={2}/>{text(['SONG','WRITING','RULED','OUT'][i]!,140+i*25,460+i*290,155,F.display,p.ink)}</g>)}{text('Grammys · reportedly',90,1810,43,F.data,p.ink)}</>;break
 case 'riso-halftone': art=<><rect width={1080} height={1920} fill={p.paper}/><circle cx={540} cy={980} r={650} fill={p.signal}/><circle cx={544} cy={984} r={480} fill="url(#dots)"/><circle cx={540} cy={980} r={100} fill={p.paper}/>{text('AI MUSIC',55,270,190,F.display,p.ink)}{text('HUMAN',55,1610,210,F.display,p.ink)}{text('MUSIC',55,1820,210,F.display,p.ink)}</>;break
 case 'single-line-drawing': art=<><path d="M60 100V450Q60 570 200 570H850Q980 570 980 720V930Q980 1050 820 1050H200Q60 1050 60 1200V1460Q60 1580 210 1580H960V1820" stroke={p.paper} strokeWidth={6} fill="none" strokeLinecap="round"/>{text('TikTok',140,390,110,F.data)}{text('Listeners',140,890,110,F.data)}{text('The charts',140,1440,110,F.data)}<circle cx={960} cy={1820} r={22} fill={p.signal}/></>;break
 case 'swiss-kinetic-type': art=<>{[60,380,700,1020].map(x=><g key={x}>{rule(x,0,x,1920,p.paper,1)}</g>)}{['AI IS','ALREADY','IN THE','MUSIC','YOU LOVE'].map((s,i)=><g key={s}>{text(s,60,270+i*340,i===3?235:170,F.display,i===3?p.signal:p.paper)}</g>)}</>;break
 default: art=<>{['a robot','humming','underneath'].map((word,i)=><g key={word}>{i===1&&<rect x={45} y={690} width={990} height={260} fill={p.signal}/ >}{text(word,65,610+i*300,i===2?140:170,F.structure,i===1?p.ink:p.paper)}</g>)}</>
 }
 return <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position:'absolute',inset:0}}><defs><linearGradient id="sweep"><stop stopColor={p.paper} stopOpacity={0}/><stop offset=".5" stopColor={p.paper} stopOpacity={.13}/><stop offset="1" stopColor={p.paper} stopOpacity={0}/></linearGradient><pattern id="grain" width={13} height={17} patternUnits="userSpaceOnUse"><circle cx={3} cy={7} r={1} fill={p.paper} opacity={.15}/></pattern><pattern id="dots" width={8} height={8} patternUnits="userSpaceOnUse"><circle cx={3} cy={3} r={2.3} fill={p.ink}/></pattern></defs>{art}</svg>
}

function CaptionBackdrop({index,p}:{index:number;p:Palette}) {
 return <svg data-caption-backdrop="room" width={1080} height={1920} viewBox="0 0 1080 1920" style={{position:'absolute',inset:0}}>
 <rect width={1080} height={1920} fill={p.ground}/>
 <rect x={100} y={100} width={360} height={430} rx={8} fill={p.paper} opacity={.08}/>
 <path d="M280 100V530M100 315H460" stroke={p.paper} opacity={.12} strokeWidth={6}/>
 <path d="M0 1570H1080V1920H0Z" fill={p.paper} opacity={.04}/>
 <rect x={700+index%3*15} y={1490} width={260} height={24} fill={p.paper} opacity={.15}/>
 <path d="M725 1514V1780M935 1514V1780" stroke={p.paper} opacity={.12} strokeWidth={16}/>
 </svg>
}
/** Schematic drawn presenter; no external character media is loaded. */
function DrawnPresenter({p,y,scale=1}:{p:Palette;y:number;scale?:number}) {
 return <g data-drawn-presenter="krish-schematic" transform={`translate(540 ${y}) scale(${scale}) translate(-540 0)`}>
 <path d="M150 890Q160 590 390 570H690Q920 590 930 890" fill={p.signal}/>
 <path d="M440 540V650Q540 740 640 650V540" fill={p.paper} stroke={p.ink} strokeWidth={8}/>
 <ellipse cx={540} cy={310} rx={220} ry={275} fill={p.paper} stroke={p.ink} strokeWidth={10}/>
 <path d="M320 270Q290 -20 530 20Q780 -20 760 280L710 150Q540 210 380 140Z" fill={p.ink}/>
 <path d="M365 290H505V390H365ZM575 290H715V390H575ZM505 325H575" fill="none" stroke={p.ink} strokeWidth={15}/>
 <path d="M540 345L515 435H560M455 480Q540 540 625 480" fill="none" stroke={p.ink} strokeWidth={9}/>
 </g>
}
/** Three seeded polygonal ink passes: body, ears, nose, feet and a long bent tail. */
function jitterRat(seed:number) {
 const points=[[180,1280],[240,1140],[310,1000],[470,870],[590,825],[620,725],[680,710],[715,805],[790,845],[875,935],[800,980],[710,1015],[630,1140],[560,1250],[600,1290],[510,1310],[445,1270],[345,1300],[285,1340],[180,1280],[115,1220],[80,1080],[130,920],[210,790]]
 return points.map(([x,y],i)=>`${i?'L':'M'}${x!+Math.sin(seed+i*7.13)*8} ${y!+Math.cos(seed*3+i*5.3)*8}`).join(' ')
}
function CaptionSample({id,props}:{id:string;props:React.ComponentProps<typeof ArtDirectedCaption>['props']}) {
 const node=id==='art-directed'?ArtDirectedCaption({props,frame:90}):THEMES[id as Exclude<CaptionThemeName,'art-directed'>](props,90)
 return <div data-caption-zone style={{position:'absolute',left:0,top:0,width:1080,height:1920,overflow:'hidden'}}>{node}</div>
}
export function StyleStill({layer,id}:Props) {
 const plan=coverPlan(layer,id), p=PALETTES[plan.palette]!, captionIndex=CAPTION_THEMES.indexOf(id as CaptionThemeName)
 const tokens=tokensFor(p)
 const captionProps=EngineRenderPropsSchema.parse({...fixture,tokens,captionTheme:layer==='captions'?id:'pop',captionPlacement:'centre',
 captions:[{fromFrame:0,toFrame:240,words:plan.beat.split(' ').map((text,i)=>({text,atFrame:i*10})),swipeIndex:Math.max(0,plan.beat.split(' ').length-1)}]})
 const name=bank.bank.find(b=>b.id===id&&b.layer===layer)?.name ?? id.replaceAll('-',' ')
 return <AbsoluteFill style={{background:p.ground,overflow:'hidden'}}>
  {layer==='captions'? <><CaptionBackdrop index={captionIndex} p={p}/><CaptionSample id={id} props={captionProps}/></> : <Art id={id} layer={layer} p={p}/>}
  {layer==='motion'&&id==='full-visual'&&<Arrangement object={{obj:'song',device:'arrangement',meaning:'Who made each layer of the song',fromFrame:0,toFrame:240,variants:{},params:{title:'Who made which bit',lanes:[{id:'lyrics',name:'Lyrics',kind:'human',who:'Reiki healer'},{id:'production',name:'Production',kind:'human',who:'Producer'},{id:'voice',name:'Lead vocal',kind:'human',who:'Ultra Naté'},{id:'ai',name:'Thin vocal layer',kind:'ai',who:'AI singer'}]}}} events={[{id:'enter',obj:'song',verb:'enter',toState:'all',atFrame:0}]} box={{left:35,top:510,width:1010,height:990}} tokens={tokens} aspect="9:16" frame={90}/>}

  <div style={{position:'absolute',left:50,right:50,bottom:24,fontFamily:F.data,fontSize:24,color:layer==='treatment'&&['voice-led-pictures','receipt-animation'].includes(id)||['paper-cutout','riso-halftone','living-ui','character-ai-receipts','ai-music-slam'].includes(id)?p.ink:p.paper}}>{name}</div>
 </AbsoluteFill>
}
