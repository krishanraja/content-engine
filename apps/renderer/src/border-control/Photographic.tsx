import React from 'react'
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion'
import '../house/fonts.css'

export type PhotographicProps = {frames:number; assets:Record<string,string>}
const INK='#0C1512', MINT='#7EF0C0', CREAM='#F4EFE4'
const clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const
const t=(f:number,a:number,b:number)=>interpolate(f,[a,b],[0,1],clamp)
const smooth=(p:number)=>p*p*(3-2*p)
const go=(f:number,a:number,b:number)=>smooth(t(f,a,b))

// Pressure variation and a fixed paper texture keep the drawn-on ink stable.
// The stroke is revealed along its path; it is not a static arrow sliding in.
export function Pen({d,progress,width=13,opacity=1}:{d:string;progress:number;width?:number;opacity?:number}) {
 return <g opacity={opacity} fill="none" stroke={MINT} strokeLinecap="round" strokeLinejoin="round" filter="url(#pen-fibre)">
  <path d={d} strokeWidth={width} pathLength={1} strokeDasharray={1} strokeDashoffset={1-progress}/>
  <path d={d} transform="translate(2 -1)" strokeWidth={width*.32} opacity={.45} pathLength={1} strokeDasharray={1} strokeDashoffset={1-progress}/>
 </g>
}

export function Photographic(p:PhotographicProps) {
 const f=useCurrentFrame(),reveal=go(f,16,83),draw=go(f,112,183),arrival=go(f,144,188),place=go(f,202,215)
 // A photographic copy of a conversation bubble is retained after its journey. Its original
 // remains on the device; neither an exact facility nor government access is implied.
 const q=1-arrival
 const copyX=q*q*q*332+3*q*q*arrival*510+3*q*arrival*arrival*680+arrival*arrival*arrival*680
 const copyY=q*q*q*472+3*q*q*arrival*620+3*q*arrival*arrival*810+arrival*arrival*arrival*1086
 const copyScale=1-.48*arrival
 return <AbsoluteFill style={{background:INK}}>
  <svg width="1080" height="1920" viewBox="0 0 941 1672">
   <defs>
    <filter id="pen-fibre" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency=".08 .19" numOctaves={2} seed={17} result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale={3}/></filter>
    <linearGradient id="bottom-ink" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={INK} stopOpacity={0}/><stop offset="1" stopColor={INK} stopOpacity={.95}/></linearGradient>
    <clipPath id="message-photo"><path d="M205 378Q211 372 222 376L429 426Q443 430 438 447L425 493Q421 511 404 507L180 453Q166 449 171 432L185 389Q189 375 205 378Z"/></clipPath>
   </defs>
   <g transform={`translate(${(1-reveal)*-36} ${(1-reveal)*-75}) scale(${1+(1-reveal)*.12})`}>
    <image href={p.assets.hardware} width={941} height={1672}/>
   </g>
   <path d="M-90 1170Q262 923 490 717T1020 189" fill="none" stroke={MINT} strokeWidth={24} opacity={.7*reveal*(1-.82*go(f,95,117))} filter="url(#pen-fibre)"/>
   <g transform={`translate(${-30*reveal} ${-20*reveal}) rotate(${-1.4*reveal} 340 480)`}>
    <image href={p.assets.phone} width={941} height={1672}/>
   </g>
   <Pen d="M332 472C510 620 680 810 680 1086" progress={draw} width={14}/>
   <Pen d="M642 1045Q663 1070 680 1090L709 1038" progress={go(f,176,188)} width={15}/>
   {f>=144&&<g transform={`translate(${copyX} ${copyY}) scale(${copyScale}) translate(-320 -445)`} opacity={go(f,140,150)}>
    <image href={p.assets.phone} width={941} height={1672} clipPath="url(#message-photo)"/>
   </g>}
   <Pen d="M608 1009L568 1003Q559 1004 560 1018L557 1168Q557 1182 572 1185L592 1188M776 1051L803 1058Q815 1064 812 1080L807 1200Q805 1213 793 1213L764 1209" progress={go(f,183,205)} width={12}/>
   <g opacity={go(f,111,126)}>
    <path d="M747 1228v33" stroke={CREAM} strokeWidth={2}/>
    <text x={906} y={1310} textAnchor="end" fill={CREAM} stroke={INK} strokeWidth={2} paintOrder="stroke" fontFamily="MYMU Plex Mono" fontSize={39}>HOSTED SERVICE</text>
   </g>
   <rect x={0} y={1350} width={941} height={322} fill="url(#bottom-ink)"/>
   <g opacity={place} transform={`translate(0 ${20*(1-place)})`}>
    <text x={760} y={1502} textAnchor="end" fill={CREAM} fontFamily="MYMU Anton" fontSize={126}>CHINA</text>
    <image href={p.assets.cn} x={793} y={1417} width={112} height={84}/>
   </g>
  </svg>
 </AbsoluteFill>
}
