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
// Slot coordinates are local to the layout box; the parent owns its offset.
export function viewport(p:DeviceProps){return p.aspect==='9:16'
 ?{left:p.box.width*24/1080,top:p.box.height*270/1920,width:p.box.width*1032/1080,height:p.box.height*1050/1920}
 :{left:p.box.width*.04,top:p.box.height*.04,width:p.box.width*.92,height:p.box.height*.92}}
export function safeBox(p:DeviceProps){return p.aspect==='9:16'
 ?{left:p.box.width*60/1080,top:p.box.height*290/1920,width:p.box.width*800/1080,height:p.box.height*800/1920}
 :{left:p.box.width*.08,top:p.box.height*.08,width:p.box.width*.84,height:p.box.height*.84}}
export function screenSize(p:DeviceProps){const v=viewport(p);return {width:9.6*v.width/v.height,height:9.6}}
// A bounded dolly/orbit: even the closest point retains all four screen corners.
export function cameraFor(p:DeviceProps){
 const s=screenState(p.object,p.events,p.frame),v=viewport(p)
 const d=drift(p.frame,p.object.fromFrame,p.object.toFrame,100)
 const focus=new T.Vector3((s.target[0]!/2400-.5)*.06,(.5-s.target[1]!/1600)*.06,0)
 const distance=5/Math.tan(Math.PI/10)
 const eye=new T.Vector3(-.4+d*.8,.08+d*.08,distance-d*.06)
 const rotation=new T.Euler().setFromRotationMatrix(new T.Matrix4().lookAt(eye,focus,new T.Vector3(0,1,0)))
 return {eye,rotation,focus,distance,aspect:v.width/v.height}
}
export function projectScreen(p:DeviceProps,x:number,y:number){
 const v=viewport(p),size=screenSize(p),cam=cameraFor(p)
 const camera=new T.PerspectiveCamera(36,v.width/v.height,.1,100)
 camera.position.copy(cam.eye);camera.rotation.copy(cam.rotation);camera.updateMatrixWorld()
 const q=new T.Vector3((x-.5)*size.width,(.5-y)*size.height,0).project(camera)
 return {x:v.left+(q.x+1)*v.width/2,y:v.top+(1-q.y)*v.height/2}
}
export function countText(value:number,sourced:number[]){return value.toFixed(Math.max(0,...sourced.map(v=>(String(v).split('.')[1]??'').length)))}
export function paint(g:CanvasRenderingContext2D,p:DeviceProps){
 const s=screenState(p.object,p.events,p.frame),a=activityAt(p.object,p.events,p.frame)
 const tall=p.aspect==='9:16',W=tall?1080:1920,H=tall?1050:1080
 const c={...p.tokens,creamSoft:p.tokens.cream,muted:p.tokens.cream,line:p.tokens.inkSoft}
 g.fillStyle=c.ink;g.fillRect(0,0,W,H)
 // The lower screen remains a working surface, but all readable content is in
 // the channel-safe column above global y1320.
 g.strokeStyle=c.inkSoft;g.lineWidth=3
 for(let y=80;y<H;y+=90){g.beginPath();g.moveTo(0,y);g.lineTo(W,y);g.stroke()}
 g.save()
 // Fit all authored content into the safe column, independently of the screen.
 if(tall){g.translate(12,10);g.scale(.94,.62)}
 const credit=p.object.dataset?.producerLabel??''
 g.fillStyle=c.cream;g.font=`24px ${HOUSE_FONTS.data}`;g.fillText(credit,80,50,tall?740:1700)
 s.params.tabs.forEach((tab,i)=>{
  g.fillStyle=tab===s.tab?c.mint:c.cream;g.font=`28px ${HOUSE_FONTS.structure}`;g.fillText(tab,80+i*(tall?148:300),110,tall?135:280)
  if(tab===s.tab)g.fillRect(80+i*(tall?148:300),125,tall?135:280,5)
 })
 const cols=tall?2:3,cw=tall?365:500,ch=tall?150:170
 s.params.cards.forEach((card,i)=>{
  const x=80+(i%cols)*(cw+24),y=155+Math.floor(i/cols)*(ch+18)
  g.save();g.translate(x,y);g.scale(1,ch/205);g.fillStyle=c.inkSoft;g.fillRect(0,0,cw,205)
  // Reuse the count move's card heading; clip its avatar and year-chip regions.
  g.save();g.beginPath();g.rect(0,0,cw,85);g.clip()
  countCard(g,0,{c,e:ease,W:10000,H:ch,label:card.label,years:['',''],from:0,to:0,times:{countStart:Infinity,countLand:Infinity,drop:Infinity,yearSwitch:Infinity}},c);g.restore()
  g.fillStyle=s.highlight===card.id?c.mint:c.cream;g.font=`82px ${HOUSE_FONTS.display}`
  g.fillText(countText(s.values[card.id]!,p.object.dataset?.rows.filter(r=>r.label===card.id||r.label.startsWith(card.id+':')).map(r=>r.value)??[]),25,150,cw-50)
  g.font=`20px ${HOUSE_FONTS.data}`;g.fillText(card.unit??p.object.dataset?.unit??'',25,185,cw-50)
  if(s.mark===card.id&&s.old[card.id]!==undefined){g.font=`32px ${HOUSE_FONTS.display}`;g.fillText(String(s.old[card.id]),220,145,cw-230);g.fillRect(215,130,70,4)}
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
 s.params.rows.forEach((row,i)=>{g.font=`24px ${HOUSE_FONTS.structure}`;g.fillText(row,90,base+285+i*28,700)})
 if(s.add)for(let i=0;i<s.copies;i++){
  const k=progress(p.frame-s.add.atFrame-i*3,6,HERO)
  g.strokeStyle=c.mint;g.lineWidth=4;g.strokeRect(80+i*185,base+340,165,100*k)
 }
 // Non-verbal scan fills the rest of the screen without placing words beneath
 // the captions or in the action rail.
 g.restore()
 g.fillStyle=c.mint;g.fillRect(0,H-170+120*k,W,3)
}
function Screen(p:DeviceProps){
 const size=screenSize(p)
 const texture=React.useMemo(()=>{const cv=document.createElement('canvas');cv.width=p.aspect==='9:16'?1080:1920;cv.height=p.aspect==='9:16'?1050:1080;paint(cv.getContext('2d')!,p);const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;return tx},[p.object,p.events,p.frame,p.tokens,p.aspect])
 React.useEffect(()=>()=>texture.dispose(),[texture])
 return <group>
 <mesh position={[0,0,-.06]}><boxGeometry args={[size.width+.025,size.height+.025,.1]}/><meshBasicMaterial color={p.tokens.inkSoft} toneMapped={false}/></mesh>
 <mesh><planeGeometry args={[size.width,size.height]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>
 </group>
}
export function Device(p:DeviceProps){const s=screenState(p.object,p.events,p.frame);if(!s.visible)return null
 const v=viewport(p),cam=cameraFor(p)
 return <div data-device="living_screen" style={{position:'absolute',...p.box,overflow:'hidden',opacity:s.opacity}}>
 <div style={{position:'absolute',...v}}><ThreeCanvas width={Math.round(v.width)} height={Math.round(v.height)} camera={{position:cam.eye.toArray(),rotation:[cam.rotation.x,cam.rotation.y,cam.rotation.z],fov:36}} gl={{antialias:true}}>
 <color attach="background" args={[p.tokens.ink]}/><Screen {...p}/>

 </ThreeCanvas></div></div>
}
