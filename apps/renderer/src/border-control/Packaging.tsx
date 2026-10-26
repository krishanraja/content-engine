import React from 'react'
import {AbsoluteFill, Img, useCurrentFrame, interpolate} from 'remotion'
import '../house/fonts.css'
export type PackagingProps={mode:'intro'|'outro';title:string;question:string;wordmark:string;link:string;flags:string[]}
export function Packaging(p:PackagingProps){
 const f=useCurrentFrame(),clamp={extrapolateLeft:'clamp',extrapolateRight:'clamp'} as const;
 const brand=p.mode==='outro'&&f>=90;
 const enter=interpolate(f,brand?[90,104]:[0,14],[0,1],clamp);
 return <AbsoluteFill style={{background:brand?'#0C1512':'#F4EFE4',color:brand?'#F4EFE4':'#0C1512',justifyContent:'center',alignItems:'center'}}>
  {brand?<div style={{width:820,textAlign:'center',opacity:enter,transform:`translateY(${(1-enter)*35}px)`}}><Img src={p.wordmark} style={{width:820}}/><div style={{fontFamily:'MYMU Archivo',fontSize:62,fontWeight:700,marginTop:60}}>{p.link}</div></div>:
   <div style={{width:880,opacity:enter,transform:`translateY(${(1-enter)*80}px)`}}>
    <div style={{fontFamily:'MYMU Anton',fontSize:116,lineHeight:1.08,textTransform:'uppercase'}}>{p.mode==='intro'?p.title:p.question}</div>
    <div style={{display:'flex',gap:24,marginTop:90}}>{p.flags.map((src,i)=><Img key={i} src={src} style={{width:144,height:108,objectFit:'contain',opacity:interpolate(f,[14+i*5,23+i*5],[0,1],clamp)}}/>)}</div>
   </div>}
 </AbsoluteFill>
}
