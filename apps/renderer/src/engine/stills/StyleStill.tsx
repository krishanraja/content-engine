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
 case 'face-with-proof': art=<><rect x={60} y={90} width={960} height={650} fill={p.paper}/>{text('AMAZON MEMO',100,230,70,F.data,p.ink)}{text('AI didn’t',100,410,120,F.dek,p.ink)}{text('help here.',100,560,120,F.dek,p.ink)}{text('Fortune · October 2026',100,680,40,F.data,p.ink)}<DrawnPresenter p={p} y={800}/>{text('Where AI works matters.',65,1810,58,F.dek)}</>;break
 case 'fry-talking-head': art=<><DrawnPresenter p={p} y={-20} scale={2.2}/>{text('Why count tails?',70,1725,105,F.display,p.ink)}<path d="M140 290Q60 450 170 590M170 590Q115 590 100 545M170 590Q172 540 195 520M800 460Q1020 400 1000 700Q970 780 850 730" fill="none" stroke={p.signal} strokeWidth={9} strokeLinecap="round"/>{text('wrong metric',40,250,58,F.dek,p.signal,{fontStyle:'italic',transform:'rotate(-8 40 250)'})}{text('The rat-tail problem',70,1815,52,F.dek,p.ink)}</>;break
 case 'voice-led-pictures': art=<><rect width={1080} height={1920} fill={p.paper}/><path d="M0 550Q220 430 440 550T1080 520V1920H0Z" fill={p.signal}/>{[80,320,780].map(x=><g key={x}><path d={`M${x} 600V240Q${x+90} 100 ${x+180} 240V600`} fill={p.ink}/><path d={`M${x-30} 250Q${x+90} 40 ${x+210} 250`} fill={p.signal}/></g>)}{[230,500].map((x,i)=><g key={x} transform={`translate(${x} ${850+i*250})`}><circle cy={-100} r={65} fill={p.ink}/><path d="M-60 -40Q-130 150 -90 310H80Q120 140 60 -40M-55 285Q-90 430 -110 500M55 285Q90 420 110 500M30 30Q180 80 250 -80" fill="none" stroke={p.ink} strokeWidth={38} strokeLinecap="round"/><path d="M250 -80Q310 -170 270 -220T300 -300" fill="none" stroke={p.ink} strokeWidth={9}/></g>)}<path d="M760 1000H1080V1500H760Z" fill={p.ink}/>{text('PAY',800,1150,80,F.data)}<circle cx={920} cy={790} r={65} fill={p.ink}/><path d="M900 840Q830 900 820 1010H1080V880Z" fill={p.ink}/>{text('Hanoi · 1902',55,1690,60,F.data,p.ink)}{text('Tails for payment',55,1790,80,F.dek,p.ink)}</>;break
 case 'data-story': art=<>{text('7%',65,650,480,F.display,p.paper)}{text('MONTHLY SALES GAIN',65,800,66,F.data)}{text('Medical-device preprint · Sep 2026',65,900,35,F.data)}{rule(100,1530,980,1530,p.paper,3)}{[[380,100],[700,107]].map(([x,v],i)=><g key={x}><rect x={x} y={1530-v!*4} width={170} height={v!*4} fill={i?p.signal:p.paper}/>{text(String(v),x!+30,1500-v!*4,56,F.data,i?p.signal:p.paper)}</g>)}{text('Before',340,1620,52,F.data)}{text('After',700,1620,52,F.data)}{text('Indexed to the start',65,1000,44,F.data)}</>;break
 case 'scoreboard-test': art=<><rect x={40} y={160} width={1000} height={1450} rx={32} fill={p.paper}/>{text('LIVE / DISCOVERY TEST',85,300,58,F.data,p.ink)}{['TikTok   01','Charts   02'].map((line,i)=><g key={line}><rect x={80} y={450+i*370} width={920} height={300} fill={i?p.ink:p.signal}/>{text(line,110,650+i*370,102,F.data,i?p.paper:p.ink)}</g>)}{text('AUDIENCE FIRST',90,1410,105,F.display,p.ink)}{text('The song was found, then ranked.',65,1790,49,F.dek)}</>;break
 case 'kinetic-movement': art=<>{[0,1,2].map(i=><g key={i} opacity={.08+i*.08} transform={`translate(${-160+i*45} ${i*45}) rotate(-12 540 960)`}>{text('REBUILT',55,850,210)}</g>)}<g transform="rotate(-12 540 960)">{text('REBUILT',55,850,210)}{text('BY HAND',55,1100,210,F.display,p.signal)}</g>{text('The producer started again.',65,1750,65,F.dek)}</>;break
 default: art=<><rect x={240} y={100} width={600} height={120} rx={50} fill={p.signal}/><path d="M280 170H800V1720l-26 -16 -26 16 -26 -16 -26 16 -26 -16 -26 16 -26 -16 -26 16 -26 -16 -26 16 -26 -16 -26 16 -26 -16 -26 16 -26 -16 -26 16 -26 -16 -26 16 -26 -16Z" fill={p.paper}/>{text('THE AI BILL',320,330,61,F.data,p.ink)}{Array.from({length:8},(_,i)=><g key={i}>{rule(315,420+i*125,765,420+i*125,p.ink,2)}{text(['Usage up','Useful work?','Cost up','Tasks repeated','Hours saved?','Value unclear','Audit due','TOTAL: ?'][i]!,320,490+i*125,36,F.data,p.ink)}</g>)}{text('Count what got done.',65,1830,66,F.dek)}</>
 }
 } else switch(id) {
 case 'ai-music-slam': art=<><rect y={1236} width={1080} height={684} fill={p.paper}/>{wave(300)}<g transform="rotate(3 600 860)"><rect x={110} y={500} width={880} height={650} fill={p.signal}/>{text('SINGING',160,740,185,F.display,p.ink)}{text('STILL IN',160,970,190,F.display,p.ink)}</g>{text('AI bits still in it.',60,1470,65,F.data,p.ink)}{text('Human voice.',60,1680,100,F.display,p.ink)}{text('Grammys · reportedly',60,1820,38,F.data,p.ink)}</>;break
 case 'character-ai-receipts': art=<><path d="M110 140H970V1660L940 1640L910 1660L880 1640L850 1660L820 1640L790 1660L760 1640L730 1660L700 1640L670 1660L640 1640L610 1660L580 1640L550 1660L520 1640L490 1660L460 1640L430 1660L400 1640L370 1660L340 1640L310 1660L280 1640L250 1660L220 1640L190 1660L160 1640L130 1660L110 1640L110 1660Z" fill={p.paper}/>{text('META · 30 DAYS',155,300,72,F.data,p.ink)}{rule(155,370,925,370,p.ink,3)}{['Usage statement','Tokens processed','60 TRILLION','Outcome: unmeasured','A bill is not an outcome.'].map((line,i)=><g key={line}>{text(line,155,570+i*210,i===2?91:46,F.data,p.ink)}{i===2&&rule(155,1015,800,1015,p.signal,14)}</g>)}{text('Fortune · April 2026',155,1530,38,F.data,p.ink)}</>;break
 case 'eating-jobs-ladder': art=<>{text('COUNT',27,300,200)}{text('THE WORK',27,485,190,F.display,p.signal)}<g transform="rotate(-3 540 960)">{rule(275,580,275,1340,p.paper,32)}{rule(825,580,825,1340,p.paper,32)}{[650,850,1050,1250].map((y,i)=><g key={y}>{rule(275,y,825,y,i===3?p.signal:p.paper,28)}</g>)}</g><rect x={60} y={1430} width={880} height={330} rx={28} fill={p.signal}/>{text('Sales',105,1540,70,F.dek,p.ink)}{text('+7%',105,1710,180,F.display,p.ink)}{text('Medical-device study · Sep 2026',65,1840,34,F.data)}</>;break
 case 'dark-keynote': art=<><rect width={1080} height={1920} fill="url(#grain)"/><path d="M0 1550L700 200H1080L350 1800Z" fill="url(#sweep)"/>{text('7%',540,1260,720,F.display,p.signal,{textAnchor:'middle',textLength:920,lengthAdjust:'spacingAndGlyphs'})}{text('MONTHLY SALES ↑',65,1550,82,F.data)}{text('Target halved. Useful work stayed.',65,1740,43,F.data)}{text('Preprint · September 2026',65,1830,38,F.data)}</>;break
 case 'data-story': art=<>{text('HALF THE TARGET',65,220,115)}{rule(110,1530,980,1530,p.paper,4)}{rule(110,520,110,1530,p.paper,4)}<rect x={210} y={560} width={260} height={970} fill={p.paper}/><rect x={620} y={1045} width={260} height={485} fill={p.signal}/>{text('200',210,510,105)}{text('100',620,995,105,F.display,p.signal)}{text('0',65,1575,42,F.data)}{text('Monthly queries',110,1670,57,F.data)}{text('Medical-device preprint · Sep 2026',65,1820,36,F.data)}</>;break
 case 'full-visual': art=<>{text('WHO DID',65,200,170)}{text('WHICH BIT?',65,400,165,F.display,p.signal)}{wave(1680)}</>;break
 case 'hud-terminal': art=<>{Array.from({length:25},(_,i)=>rule(0,65+i*72,1080,65+i*72,p.signal,1))}{text('> audit queries',60,230,65,F.data)}{text('> repeated / off-task',60,430,53,F.data)}<path d="M145 690H75V1240H145M935 690H1005V1240H935" stroke={p.signal} fill="none" strokeWidth={12}/>{text('31%',125,1090,340,F.data,p.signal)}{text('JUNK',70,1450,130,F.data)}{text('Preprint · Sep 2026',70,1770,48,F.data)}</>;break
 case 'line-boil': art=<>{[-1,0,1].map((o)=><g key={o} transform={`translate(${o*3} ${-o*3})`} opacity={o===0?1:.6}><path d="M320 1200C140 1110 170 820 390 780C550 640 800 800 870 1000Q1000 1040 920 1110Q790 1190 700 1130Q530 1290 320 1200C230 1320 820 1390 660 1600S220 1630 350 1760M740 820C650 610 890 670 830 860M330 1180Q300 1270 420 1250M650 1170Q640 1260 760 1230M900 1050Q990 1010 1020 1030M900 1080Q980 1100 1010 1140" fill="none" stroke={p.paper} strokeWidth={3} strokeLinecap="round"/><circle cx={850} cy={990} r={10} fill={p.paper}/></g>)}{text('a cent',60,210,130,F.dek)}{text('a rat tail',60,360,130,F.dek)}</>;break
 case 'living-ui': art=<><rect width={1080} height={1920} fill={p.ink}/>{text('Suno / Create',65,180,70,F.structure)}<svg x={40} y={360} width={1000} height={1220} viewBox="0 0 500 610" overflow="hidden" data-ui-zoom="2"><rect width={500} height={610} rx={18} fill={p.paper}/>{text('Custom',25,55,26,F.structure,p.ink)}{text('Lyrics',25,150,35,F.structure,p.ink)}<rect x={20} y={180} width={460} height={240} rx={12} stroke={p.signal} strokeWidth={5} fill={p.ink}/>{text('I’m movin’',40,250,40,F.structure)}{text('to the sun',40,310,40,F.structure)}<path d="M365 322v60l16 -15 14 28 13 -7 -15 -27 23 -1Z" fill={p.paper} stroke={p.ink} strokeWidth={3}/>{text('Styles',25,475,28,F.structure,p.ink)}{text('Soul, dance',25,525,26,F.structure,p.ink)}</svg>{text('Source: suno.com/create',65,1735,41,F.data)}{text('Drawn reconstruction · Nov 2026',65,1810,37,F.data)}</>;break
 case 'paper-cutout': art=<><rect width={1080} height={1920} fill={p.paper}/><defs><filter id="paper-shadow"><feGaussianBlur stdDeviation="6"/></filter><pattern id="paper-grain" width="13" height="17" patternUnits="userSpaceOnUse"><path d="M2 3q3 4 5 0M8 12q2 -3 4 1" stroke={p.ink} opacity=".15" fill="none"/></pattern></defs>{[true,false].map(shadow=><path key={String(shadow)} d="M110 250L145 231L180 246L220 220L265 235L310 211L360 225L410 203L455 220L500 200L550 216L600 195L655 210L710 188L755 207L810 185L865 205L910 190L960 1480L930 1500L880 1495L830 1520L780 1510L730 1540L680 1526L630 1550L580 1542L530 1570L480 1557L430 1580L380 1572L330 1600L280 1587L220 1620Z" fill={shadow?p.ink:p.signal} filter={shadow?'url(#paper-shadow)':undefined} transform={shadow?'translate(6 8)':undefined}/>)}<path d="M110 250L910 190L960 1480L220 1620Z" fill="url(#paper-grain)"/>{text('SONG',170,570,190,F.display,p.ink)}{text('WRITING',170,820,170,F.display,p.ink)}{text('RULED',190,1140,190,F.display,p.ink)}{text('OUT',210,1410,240,F.display,p.ink)}{text('Grammys · reportedly',90,1800,43,F.data,p.ink)}</>;break
 case 'riso-halftone': art=<><rect width={1080} height={1920} fill={p.paper}/><circle cx={540} cy={980} r={650} fill={p.signal}/><circle cx={544} cy={984} r={480} fill="url(#dots)"/><circle cx={540} cy={980} r={100} fill={p.paper}/>{text('AI MUSIC',55,270,190,F.display,p.ink)}{text('HUMAN',55,1610,210,F.display,p.ink)}{text('MUSIC',55,1820,210,F.display,p.ink)}</>;break
 case 'single-line-drawing': art=<><path d="M60 100V450Q60 570 200 570H850Q980 570 980 720V930Q980 1050 820 1050H200Q60 1050 60 1200V1460Q60 1580 210 1580H960V1820" stroke={p.paper} strokeWidth={6} fill="none" strokeLinecap="round"/>{text('TikTok',140,390,110,F.data)}{text('Listeners',140,890,110,F.data)}{text('The charts',140,1440,110,F.data)}<circle cx={960} cy={1820} r={22} fill={p.signal}/></>;break
 case 'swiss-kinetic-type': art=<>{[60,380,700,1020].map(x=><g key={x}>{rule(x,0,x,1920,p.paper,1)}</g>)}{['AI IS','ALREADY','IN THE','MUSIC','YOU LOVE'].map((s,i)=><g key={s}>{text(s,60,270+i*340,i===3?235:170,F.display,i===3?p.signal:p.paper)}</g>)}</>;break
 default: art=<>{['A','ROBOT','HUMMING','UNDERNEATH'].map((w,i)=>{const size=Math.min(220,940/(w.length*.76)),len=w.length*.76*size,y=400+i*400;return <g key={w}>{i===2&&<rect x={45} y={y-size*.8} width={len+40} height={size*.98} fill={p.signal}/>}{text(w,65,y,size,F.structure,i===2?p.ink:p.paper,{fontWeight:900,textLength:len,lengthAdjust:'spacingAndGlyphs'})}</g>})}</>
 }
 return <svg width={1080} height={1920} viewBox="0 0 1080 1920" style={{position:'absolute',inset:0}}><defs><linearGradient id="sweep"><stop stopColor={p.paper} stopOpacity={0}/><stop offset=".5" stopColor={p.paper} stopOpacity={.13}/><stop offset="1" stopColor={p.paper} stopOpacity={0}/></linearGradient><pattern id="grain" width={13} height={17} patternUnits="userSpaceOnUse"><circle cx={3} cy={7} r={1} fill={p.paper} opacity={.15}/></pattern><pattern id="dots" width={8} height={8} patternUnits="userSpaceOnUse"><circle cx={3} cy={3} r={2.3} fill={p.ink}/></pattern></defs>{art}</svg>
}

export const CAPTION_ZOOM = 2.4   // the most a caption is enlarged
const CAPTION_W = 940              // the width a fitted caption may take
const CAPTION_H = 700              // and its height
const CAPTION_Y = 1180             // the centre it sits on: over the presenter's chest, as captions play
/** The video frame a caption plays over: his drawn character to camera, quiet behind the caption. */
function CaptionBackdrop({index,p}:{index:number;p:Palette}) {
 return <svg data-caption-backdrop="talking-head" width={1080} height={1920} viewBox="0 0 1080 1920" style={{position:'absolute',inset:0}}>
 <rect width={1080} height={1920} fill={p.ground}/>
 <g opacity={.3}><DrawnPresenter p={p} y={200 + (index % 3) * 20} scale={1.5}/></g>
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
// Sample the native theme during its entrance, rather than redrawing its move.
const sampleOffsets:Record<string,number> = {'slam':6,'stair-flash':0,'slot-roll':2,'flip-hinge':2,'slice':2,'ink-block':7,'cinematic':12,'art-directed':12}
function sampleFinish(node:React.ReactNode,id:string,p:Palette):React.ReactNode {
 if(!React.isValidElement(node)) return node
 const el=node as React.ReactElement<{style?:React.CSSProperties;children?:React.ReactNode;'data-caption-echo'?:boolean}>
 let style=el.props.style
 if(style && id==='cinematic' && style.backgroundClip==='text') style={...style,color:p.paper,backgroundImage:'none',WebkitTextStroke:'0px',backgroundClip:undefined,WebkitBackgroundClip:undefined}
 if(style && id==='art-directed' && el.props['data-caption-echo']!==undefined) style={...style,opacity:.3}
 if(style && id==='slam' && typeof style.opacity==='number' && style.opacity>=.55) style={...style,opacity:1}
 return React.cloneElement(el,style?{style}:{},React.Children.map(el.props.children,c=>sampleFinish(c,id,p)))
}
// A trail: earlier frames of the move, laid faintly under the sampled one (the hit behind the landed word).
const trails:Record<string,number[]> = {'slam':[1]}
// Themes whose slab is part of the caption: measured with their text, so the slab stays inside the frame.
const SLABS=new Set(['ink-block'])
function CaptionSample({id,props,p}:{id:string;props:React.ComponentProps<typeof ArtDirectedCaption>['props'];p:Palette}) {
 const last=props.captions[0]!.words.at(-1)!.atFrame, frame=id in sampleOffsets?last+sampleOffsets[id]!:90
 const draw=(f:number)=>id==='art-directed'?ArtDirectedCaption({props,frame:f}):THEMES[id as Exclude<CaptionThemeName,'art-directed'>](props,f)
 const drawn=draw(frame)
 const sampled=id in sampleOffsets?sampleFinish(drawn,id,p):drawn
 const node=trails[id]?<>{trails[id]!.map(o=><div key={o} data-caption-trail style={{position:'absolute',inset:0,opacity:.3}}>{sampleFinish(draw(last+o),id,p)}</div>)}{sampled}</>:sampled
 // A shop window, not the cut at its true size (Krish, 2026-11-16: "shop window examples of how that element looks"):
 // the caption as it plays, measured and fitted to the frame (at most CAPTION_ZOOM times larger), centred, so it reads
 // on a thumbnail and never runs off an edge.
 const ref=React.useRef<HTMLDivElement>(null)
 const [fit,setFit]=React.useState<{s:number;x:number;y:number}|null>(null)
 React.useLayoutEffect(()=>{
  const el=ref.current; if(!el) return
  const rects:DOMRect[]=[]
  el.querySelectorAll('*').forEach(n=>{
   const hasText=Array.from(n.childNodes).some(c=>c.nodeType===3&&(c.textContent||'').trim())
   const slab=SLABS.has(id)&&!['rgba(0, 0, 0, 0)','transparent'].includes(getComputedStyle(n as Element).backgroundColor)
   if(hasText||slab) { const r=(n as Element).getBoundingClientRect(); if(r.width>0&&r.height>0) rects.push(r) }
  })
  if(!rects.length) return
  const box=el.getBoundingClientRect()
  const x0=Math.min(...rects.map(r=>r.left))-box.left, x1=Math.max(...rects.map(r=>r.right))-box.left
  const y0=Math.min(...rects.map(r=>r.top))-box.top, y1=Math.max(...rects.map(r=>r.bottom))-box.top
  const s=Math.min(CAPTION_ZOOM,CAPTION_W/Math.max(1,x1-x0),CAPTION_H/Math.max(1,y1-y0))
  setFit({s,x:540-(x0+x1)/2*s,y:CAPTION_Y-(y0+y1)/2*s})
 },[])
 return <div data-caption-zone style={{position:'absolute',left:0,top:0,width:1080,height:1920,overflow:'hidden'}}>
  <div ref={ref} style={{position:'absolute',left:0,top:0,width:1080,height:1920,transformOrigin:'0 0',
   transform:fit?`translate(${fit.x}px, ${fit.y}px) scale(${fit.s})`:undefined}}>{node}</div>
 </div>
}
/** Looks whose drawing runs to the foot: their style label sits on a band of the ground colour. */
const BANDED=['face-with-proof','voice-led-pictures','data-story','fry-talking-head']
export function StyleStill({layer,id}:Props) {
 const plan=coverPlan(layer,id), p=PALETTES[plan.palette]!, captionIndex=CAPTION_THEMES.indexOf(id as CaptionThemeName)
 const tokens=tokensFor(p)
 const captionProps=EngineRenderPropsSchema.parse({...fixture,tokens,captionTheme:layer==='captions'?id:'pop',captionPlacement:'centre',
 captions:[{fromFrame:0,toFrame:240,words:plan.beat.split(' ').map((text,i)=>({text,atFrame:i*10})),swipeIndex:Math.max(0,plan.beat.split(' ').length-1)}]})
 const name=bank.bank.find(b=>b.id===id&&b.layer===layer)?.name ?? id.replaceAll('-',' ')
 return <AbsoluteFill style={{background:p.ground,overflow:'hidden'}}>
  {layer==='captions'? <><CaptionBackdrop index={captionIndex} p={p}/><CaptionSample id={id} props={captionProps} p={p}/></> : <Art id={id} layer={layer} p={p}/>}
  {layer==='motion'&&id==='full-visual'&&<Arrangement object={{obj:'song',device:'arrangement',meaning:'Who made each layer of the song',fromFrame:0,toFrame:240,variants:{},params:{title:'Who made which bit',lanes:[{id:'lyrics',name:'Lyrics',kind:'human',who:'Reiki healer'},{id:'production',name:'Production',kind:'human',who:'Producer'},{id:'voice',name:'Lead vocal',kind:'human',who:'Ultra Naté'},{id:'ai',name:'Thin vocal layer',kind:'ai',who:'AI singer'}]}}} events={[{id:'enter',obj:'song',verb:'enter',toState:'all',atFrame:0}]} box={{left:35,top:510,width:1010,height:990}} tokens={tokens} aspect="9:16" frame={90}/>}

  <div style={{position:'absolute',left:50,right:50,bottom:24,fontFamily:F.data,fontSize:24,...(BANDED.includes(id)&&layer==='treatment'?{background:p.ground,padding:'8px 12px',color:p.paper}:{}),color:BANDED.includes(id)&&layer==='treatment'?p.paper:layer==='treatment'&&['voice-led-pictures','receipt-animation'].includes(id)||['paper-cutout','riso-halftone','ai-music-slam'].includes(id)?p.ink:p.paper}}>{name}</div>
 </AbsoluteFill>
}
