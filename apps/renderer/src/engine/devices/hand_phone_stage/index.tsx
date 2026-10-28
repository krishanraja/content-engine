import React from 'react'
import { Img, staticFile } from 'remotion'
import { glassKind } from '../../kit/glassRegistry'
import { PH, PW, Screen, uiClipPath } from '../../kit/phoneGlass'
import { footageLayout } from '../../kit/glass/footage'
import type { DeviceProps } from '../types'
import { phoneState } from './state'
const plateRoot='plates/hand-held-screen/'
const backdrops={cotton:'bg-cotton.jpg',cotton_flip:'bg-cotton-flip.jpg',hardware:'bg-hardware.jpg'} as const
/** Same resolved-src Img route as BrandFrame's house MarkTile. No silent image fallback. */
export function Plate({name,style}:{name:string;style?:React.CSSProperties}) {
  return <Img src={staticFile(plateRoot+name)} onError={()=>{throw new Error(`ve: missing phone plate ${plateRoot+name}`)}}
    style={{position:'absolute',left:0,top:0,width:PW,height:PH,maxWidth:'none',...style}} />
}
export function Device({object,events,box,tokens,frame}:DeviceProps) {
  const s=phoneState(object,events,frame)
  if(!s.visible) return null
  const screen=new Screen(s.cam)
  const ambient=`scale(${s.ambientScale}) rotate(${s.ambientRoll}deg)`
  // Backdrops and scrims use canvas placement inside the continuous plate world.
  const inverse=`rotate(${-s.ambientRoll}deg) scale(${1/s.ambientScale}) scale(${1/s.cam.k}) rotate(${-s.cam.rot}deg) translate(${-s.cam.tx}px,${-s.cam.ty}px)`
  const full:React.CSSProperties={position:'absolute',left:0,top:0,width:box.width,height:box.height,transformOrigin:'0 0'}
  // BrandFrame is the following sibling in FormatMaster. Its existing Grain has
  // no mask input, so scope a clip to that sibling's grain only. The viewport
  // intersection follows the very same glass, ambient and camera transforms.
  const footage=s.glass.find(l=>l.kind==='footage' && l.opacity>0)
  let grainClip: string | undefined
  const footageParams=s.params.glass.footage
  if(footage && typeof footageParams?.src==='string') {
    const l=footageLayout(footageParams as {src:string},s.cam.k)
    const u0=Math.max(0,l.cx-l.height/2),u1=Math.min(screen.W,l.cx+l.height/2)
    const v0=Math.max(0,l.cy-l.width/2),v1=Math.min(screen.H,l.cy+l.width/2)
    if(u1>u0 && v1>v0) {
      const rad=s.ambientRoll*Math.PI/180,c=Math.cos(rad),sn=Math.sin(rad)
      const points=[[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>{
        const [x,y]=screen.u2p(u!,v!)
        const p=s.cam.p2c(s.ambientScale*(c*x-sn*y),s.ambientScale*(sn*x+c*y))
        return `${p[0]+box.left}px ${p[1]+box.top}px`
      })
      grainClip=`polygon(evenodd, 0px 0px, ${box.width}px 0px, ${box.width}px ${box.height}px, 0px ${box.height}px, 0px 0px, ${points.join(', ')}, ${points[0]})`
    }
  }
  return <div data-device="hand_phone_stage" style={{...full,left:box.left,top:box.top,overflow:'hidden',background:tokens.ink,opacity:s.opacity}}>
    {grainClip && <style data-footage-grain-mask="">{`div:has(> div > [data-device="hand_phone_stage"]) ~ div > div[aria-hidden="true"][style*="mix-blend-mode:screen"] { clip-path: ${grainClip}; }`}</style>}
    <div data-phone-world="" style={{position:'absolute',left:0,top:0,width:PW,height:PH,transformOrigin:'0 0',transform:s.cam.css()+' '+ambient}}>
      <div style={{...full,transform:inverse}}>
        {s.backdrops.map(layer=>{
          const bg=layer.camera.bg
          const cover=Math.max(box.width/PW,box.height/PH)
          const k=bg?.k ?? cover, x=bg?.x ?? (box.width-PW*k)/2, y=bg?.y ?? (box.height-PH*k)/2
          const dx=0.35*(s.cam.tx-layer.camera.tx),dy=0.35*(s.cam.ty-layer.camera.ty)
          return <div key={layer.id} data-backdrop={layer.camera.backdrop} style={{position:'absolute',inset:0,opacity:layer.opacity}}>
            <Plate name={backdrops[layer.camera.backdrop]} style={{transformOrigin:'0 0',transform:`translate(${x+dx}px,${y+dy}px) rotate(${bg?.rot ?? 0}deg) scale(${k})`}} />
          </div>
        })}
        <div data-scrim="top" style={{...full,background:`linear-gradient(180deg, ${tokens.ink}, transparent 40%)`,opacity:0.78}} />
        <div data-scrim="bottom" style={{...full,background:`linear-gradient(0deg, ${tokens.ink}, transparent 32%)`,opacity:0.88}} />
      </div>
      <div style={{position:'absolute',left:0,top:0,width:PW,height:PH,clipPath:uiClipPath()}}>
        <div data-glass-plane="" style={{position:'absolute',left:0,top:0,width:screen.W,height:screen.H,transformOrigin:'0 0',transform:screen.css(),overflow:'hidden',background:tokens.inkSoft}}>
          {s.glass.map((layer,i)=>{
            const Glass=glassKind(layer.kind)
            return <div key={layer.atFrame+':'+i} data-glass-kind={layer.kind} style={{position:'absolute',inset:0,opacity:layer.opacity}}>
              <Glass frame={frame} sinceFrames={frame-layer.atFrame} tokens={tokens} params={(s.params.glass[layer.kind]?.[layer.camera] as Record<string, unknown> | undefined) ?? s.params.glass[layer.kind] ?? {}} k={s.cam.k} />
            </div>
          })}
        </div>
      </div>
      <Plate name="phone-bezel.png" />
      {s.glass.filter(l=>l.kind!=='footage').reduce((sum,l)=>sum+l.opacity,0)>0 && <Plate name="phone-glass.png" style={{opacity:Math.min(1,s.glass.filter(l=>l.kind!=='footage').reduce((sum,l)=>sum+l.opacity,0))}} />}
    </div>
  </div>
}
