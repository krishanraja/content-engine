import React from 'react'
import { ThreeCanvas } from '@remotion/three'
import * as T from 'three'
// @ts-ignore shared move library
import { draw as countCard } from '@mymu/moves/count-in-card/move.mjs'
import { ENTER, HERO, EXIT, progress, drift } from '../../clock'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { screenState, activityAt } from './state'
const ease={enter:ENTER,hero:HERO,exit:EXIT,utility:HERO}
export function viewport(p:DeviceProps){return {left:0,top:p.aspect==='9:16'?p.box.height*270/1920:0,width:p.box.width,height:p.aspect==='9:16'?p.box.height*1650/1920:p.box.height}}
export function safeBox(p:DeviceProps){return p.aspect==='9:16'?{left:p.box.width*60/1080,top:0,width:p.box.width*800/1080,height:p.box.height*1050/1920}:{left:80,top:40,width:p.box.width-160,height:p.box.height-80}}
// A shallow orbit keeps the whole working screen in view. The selected card steers
// the push without ever trading away the interface for an isolated number.
export function cameraFor(p:DeviceProps){
 const s=screenState(p.object,p.events,p.frame),v=viewport(p)
 const d=drift(p.frame,p.object.fromFrame,p.object.toFrame,3)
 const focus=new T.Vector3((s.target[0]!/2400-.5)*.12,(.5-s.target[1]!/1600)*.12,0)
 const distance=5/Math.tan(Math.PI/10)
 const eye=new T.Vector3(.08+d,.03+d*.3,distance-d)
 const rotation=new T.Euler().setFromRotationMatrix(new T.Matrix4().lookAt(eye,focus,new T.Vector3(0,1,0)))
 return {eye,rotation,focus,distance,aspect:v.width/v.height}
}
export function countText(value:number,sourced:number[]){return value.toFixed(Math.max(0,...sourced.map(v=>(String(v).split('.')[1]??'').length)))}
export function paint(g:CanvasRenderingContext2D,p:DeviceProps){
 const s=screenState(p.object,p.events,p.frame),a=activityAt(p.object,p.events,p.frame)
 const tall=p.aspect==='9:16',W=tall?1080:1920,H=tall?1650:1080
 const c={...p.tokens,creamSoft:p.tokens.cream,muted:p.tokens.cream,line:p.tokens.inkSoft}
 g.fillStyle=c.ink;g.fillRect(0,0,W,H)
 // The lower screen remains a working surface, but all readable content is in
 // the channel-safe column above global y1320.
 g.strokeStyle=c.inkSoft;g.lineWidth=3
 for(let y=80;y<H;y+=90){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}
 const credit=p.object.dataset?.producerLabel??''
 g.fillStyle=c.cream;g.font=`24px ${HOUSE_FONTS.data}`;g.fillText(credit,80,50)
 s.params.tabs.forEach((tab,i)=>{
  g.fillStyle=tab===s.tab?c.mint:c.cream;g.font=`28px ${HOUSE_FONTS.structure}`;g.fillText(tab,80+i*260,110)
  if(tab===s.tab)g.fillRect(80+i*260,125,190,5)
 })
 const cols=tall?2:3,cw=tall?365:500,ch=tall?(s.params.cards.length>4?130:205):200
 s.params.cards.forEach((card,i)=>{
  const x=80+(i%cols)*(cw+24),y=155+Math.floor(i/cols)*(ch+18)
  g.save();g.translate(x,y);g.scale(1,ch/205);g.fillStyle=c.inkSoft;g.fillRect(0,0,cw,205)
  // Reuse the count move's card heading; clip its avatar and year-chip regions.
  g.save();g.beginPath();g.rect(0,0,cw,85);g.clip()
  countCard(g,0,{c,e:ease,W:10000,H:ch,label:card.label,years:['',''],from:0,to:0,times:{countStart:Infinity,countLand:Infinity,drop:Infinity,yearSwitch:Infinity}},c);g.restore()
  g.fillStyle=s.highlight===card.id?c.mint:c.cream;g.font=`82px ${HOUSE_FONTS.display}`
  g.fillText(countText(s.values[card.id]!,p.object.dataset?.rows.filter(r=>r.label===card.id||r.label.startsWith(card.id+':')).map(r=>r.value)??[]),25,150)
  g.font=`20px ${HOUSE_FONTS.data}`;g.fillText(card.unit??p.object.dataset?.unit??'',25,185)
  if(s.mark===card.id&&s.old[card.id]!==undefined){g.font=`32px ${HOUSE_FONTS.display}`;g.fillText(String(s.old[card.id]),220,145);g.fillRect(215,130,70,4)}
  g.restore()
 })
 const base=155+Math.ceil(s.params.cards.length/cols)*(ch+18)
 const chart=s.params.chart
 if(chart&&s.draw){
  const ids=[chart.expected,...chart.lines.map(l=>l.id)],all=p.object.dataset!.rows.filter(r=>ids.some(id=>r.label===id||r.label.startsWith(id+':'))).map(r=>r.value)
  const low=Math.min(...all),high=Math.max(...all)
  ids.forEach((id,i)=>{
   const rows=p.object.dataset!.rows.filter(r=>r.label===id||r.label.startsWith(id+':'))
   if(!rows.length)throw new Error(`living_screen: missing chart ${id}`)
   const k=i===0?s.expected:s.real
   g.save();g.beginPath();g.rect(80,base,740*k,200);g.clip()
   g.strokeStyle=i===0?c.cream:c.mint;g.lineWidth=6;g.beginPath()
   rows.forEach((r,j)=>{const x=80+j*720/Math.max(1,rows.length-1),y=base+175-(r.value-low)/(high-low||1)*140;j?g.lineTo(x,y):g.moveTo(x,y)})
   g.stroke();g.restore()
  })
 }
 // Each explicit eight-frame UI cue moves the cursor to a different control.
 // Sweep and scan are geometric activity, never fabricated data updates.
 const k=progress(p.frame-a.current.atFrame,8,HERO)
 const x=a.previous.x+(a.current.x-a.previous.x)*k,y=a.previous.y+(a.current.y-a.previous.y)*k
 g.strokeStyle=c.mint;g.lineWidth=4;g.strokeRect(80,base+215,740,45)
 g.fillStyle=c.mint;g.fillRect(85,base+220,725*k,35)
 g.fillStyle=c.cream;g.beginPath();g.moveTo(x,y);g.lineTo(x+15,y+32);g.lineTo(x+20,y+20);g.lineTo(x+34,y+17);g.closePath();g.fill()
 s.params.rows.forEach((row,i)=>{g.font=`24px ${HOUSE_FONTS.structure}`;g.fillText(row,90,Math.min(base+300,850)+i*28)})
 if(s.add)for(let i=0;i<s.copies;i++){
  const k=progress(p.frame-s.add.atFrame-i*3,6,HERO)
  g.strokeStyle=c.mint;g.lineWidth=4;g.strokeRect(80+i*185,base+340,165,100*k)
 }
 // Non-verbal scan fills the rest of the screen without placing words beneath
 // the captions or in the action rail.
 g.fillStyle=c.mint;g.fillRect(0,H-320+190*k,W,3)
}
function Screen(p:DeviceProps){
 const v=viewport(p)
 const texture=React.useMemo(()=>{const cv=document.createElement('canvas');cv.width=p.aspect==='9:16'?1080:1920;cv.height=p.aspect==='9:16'?1650:1080;paint(cv.getContext('2d')!,p);const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;return tx},[p.object,p.events,p.frame,p.tokens,p.aspect])
 React.useEffect(()=>()=>texture.dispose(),[texture])
 return <mesh><planeGeometry args={[10*v.width/v.height*1.12,11.2]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>
}
export function Device(p:DeviceProps){const s=screenState(p.object,p.events,p.frame);if(!s.visible)return null
 const v=viewport(p),cam=cameraFor(p)
 return <div data-device="living_screen" style={{position:'absolute',...p.box,overflow:'hidden',opacity:s.opacity}}>
 <div style={{position:'absolute',...v}}><ThreeCanvas width={Math.round(v.width)} height={Math.round(v.height)} camera={{position:cam.eye.toArray(),rotation:[cam.rotation.x,cam.rotation.y,cam.rotation.z],fov:36}} gl={{antialias:true}}>
 <color attach="background" args={[p.tokens.ink]}/><Screen {...p}/>
 {[0,1,2].map(i=><mesh key={i} position={[-5+i*5,0,.1]} rotation={[0,0,-.12]}><boxGeometry args={[.018,20,.02]}/><meshBasicMaterial color={i===1?p.tokens.mint:p.tokens.channel} toneMapped={false}/></mesh>)}
 </ThreeCanvas></div></div>
}
