import React from 'react'
import { ThreeCanvas } from '@remotion/three'
import * as T from 'three'
// @ts-ignore shared move library
import { draw as countCard } from '@mymu/moves/count-in-card/move.mjs'
// @ts-ignore shared move library
import { draw as liveChart } from '@mymu/moves/live-chart/move.mjs'
// @ts-ignore shared move library
import { draw as taskCopies } from '@mymu/moves/task-copies-2d/move.mjs'
// @ts-ignore shared move library
import { draw as toast } from '@mymu/moves/toast/move.mjs'
import { ENTER, HERO, EXIT, progress, drift } from '../../clock'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { screenState, rect } from './state'
const ease={enter:ENTER,hero:HERO,exit:EXIT,utility:HERO}
// The canvas fills the device box in both shapes (a smaller canvas shows the floor as a hard-edged rectangle); the
// camera frames the card being read inside safeBox: in 9:16 the words-safe x 60 to 860, from under the headline zone
// to the key band's bottom (y 470 to 1060), so the house caption box (y 1090 to 1320, kit/lock.ts) never covers it.
export function viewport(p:DeviceProps){return {left:0,top:0,width:p.box.width,height:p.box.height}}
export function safeBox(p:DeviceProps){const {width:W,height:H}=p.box;return p.aspect==='9:16'?{left:W*60/1080,top:H*470/1920,width:W*800/1080,height:H*590/1920}:{left:0,top:0,width:W,height:H}}
export function cameraFor(p:DeviceProps){
  const s=screenState(p.object,p.events,p.frame),v=viewport(p),safe=safeBox(p),[x,y,w,h]=s.target
  const focus=new T.Vector3((x!/2400-.5)*6,(.5-y!/1600)*4,0)
  const d=drift(p.frame,p.object.fromFrame,p.object.toFrame),tan=Math.tan(Math.PI/10)
  const distance=Math.max(w!/2400*6*v.height/safe.width,h!/1600*4*v.height/safe.height)*1.22/(2*tan)
  // Aim off the target so it lands in the centre of the safe box rather than the centre of the frame.
  const perPx=2*distance*tan/v.height
  const ox=(safe.left+safe.width/2-v.width/2)*perPx,oy=(safe.top+safe.height/2-v.height/2)*perPx
  const aim=focus.clone().add(new T.Vector3(-ox,oy,0))
  const eye=aim.clone().add(new T.Vector3(.09+d,.04+d*.2,1).normalize().multiplyScalar(distance))
  const rotation=new T.Euler().setFromRotationMatrix(new T.Matrix4().lookAt(eye,aim,new T.Vector3(0,1,0)))
  return {eye,rotation,focus,distance}
}
// A count shows only as many decimals as its sourced values carry: 20 to 13 never passes through 18.83.
export function countText(value:number,sourced:number[]){
  const places=Math.max(0,...sourced.map(v=>(String(v).split('.')[1]??'').length))
  return value.toFixed(places)
}
export function paint(g:CanvasRenderingContext2D,p:DeviceProps){
  const s=screenState(p.object,p.events,p.frame),c={...p.tokens,creamSoft:p.tokens.cream,muted:p.tokens.cream,line:p.tokens.inkSoft},t=p.frame/30
  g.fillStyle=c.ink;g.fillRect(0,0,2400,1600)
  g.font=`36px ${HOUSE_FONTS.structure}`
  s.params.tabs.forEach((tab,i)=>{g.fillStyle=tab===s.tab?c.mint:c.cream;g.fillText(tab,80+i*430,100)})
  s.params.cards.forEach((card,i)=>{
    const [x,y,w,h]=rect(i,s.params.cards.length)
    g.save();g.translate(x,y);g.fillStyle=c.inkSoft;g.fillRect(0,0,w,h)
    // The shared count move owns the card drawing. State replay supplies its exact sampled value;
    // avatars/year chips are clipped out because arbitrary measures are not people or years.
    g.beginPath();g.rect(0,0,w,320);g.clip()
    countCard(g,0,{c,e:ease,W:w,H:h,label:card.label,years:['',''],from:Math.abs(s.values[card.id]!),to:0,times:{countStart:-2,countLand:-1,drop:Infinity,yearSwitch:Infinity}},c)
    g.fillStyle=c.inkSoft;g.fillRect(20,110,w-40,210)
    g.fillStyle=s.highlight===card.id?c.mint:c.cream;g.font=`160px ${HOUSE_FONTS.display}`;g.fillText(countText(s.values[card.id]!,p.object.dataset?.rows.filter(r=>r.label===card.id||r.label.startsWith(card.id+':')).map(r=>r.value)??[]),36,290)
    if(s.mark===card.id&&s.old[card.id]!==undefined){g.font=`64px ${HOUSE_FONTS.display}`;g.fillText(String(s.old[card.id]),400,280);g.fillRect(390,250,170,5)}
    g.restore();g.fillStyle=c.cream;g.font=`30px ${HOUSE_FONTS.data}`;g.fillText(card.unit??p.object.dataset?.unit??'',x+36,y+365)
  })
  g.save();g.translate(60,1080);g.scale(2280/1240,460/940)
  if(s.add){taskCopies(g,t,{c,e:ease,W:1240,H:940,label:s.tab??'',copies:s.copies,times:{done:s.add.atFrame/30,copies:s.add.atFrame/30+.4}},c)
    g.font=`38px ${HOUSE_FONTS.structure}`;s.params.rows.forEach((row,i)=>g.fillText(row,80,180+i*60))
  }else if(s.params.chart&&s.draw){
    const chart=s.params.chart,ids=[chart.expected,...chart.lines.map(l=>l.id)]
    const numbers=ids.flatMap(id=>p.object.dataset!.rows.filter(r=>r.label===id||r.label.startsWith(id+':')).map(r=>r.value))
    if(!numbers.length)throw new Error('living_screen: chart needs sourced points')
    const min=Math.min(...numbers),max=Math.max(...numbers)
    // Keep the move's reveal, heads, axes and dash grammar, replacing its example curves
    // at the canvas boundary with the selected series' sourced samples.
    let series=-1
    const mapped=new Proxy(g,{get(ctx,key){if(key==='lineWidth')return ctx.lineWidth
      if(key==='moveTo'||key==='lineTo')return (x:number,y:number)=>{
        if([10,12,14,20].includes(ctx.lineWidth)&&series>=0){const id=ids[Math.min(series,ids.length-1)]!,rows=p.object.dataset!.rows.filter(r=>r.label===id||r.label.startsWith(id+':'));if(!rows.length)throw new Error(`living_screen: missing chart ${id}`)
          const u=Math.max(0,Math.min(1,(x-80)/1100))*(rows.length-1),a=Math.floor(u),b=Math.min(rows.length-1,a+1),value=rows[a]!.value+(rows[b]!.value-rows[a]!.value)*(u-a)
          y=840-(value-min)/(max-min||1)*640
        }return ctx[key as 'moveTo'](x,y)}
      const val=Reflect.get(ctx,key,ctx);return typeof val==='function'?val.bind(ctx):val},set(ctx,key,value){if(key==='lineWidth'&&[10,12,14,20].includes(value))series++;Reflect.set(ctx,key,value,ctx);return true}})
    liveChart(mapped,t,{c,e:ease,W:1240,H:940,label:s.tab??'',axis:['',''],expectLabel:chart.expected,labels:chart.lines.map(l=>l.label),times:{expect:s.draw.atFrame/30,expectEnd:Infinity,a:s.draw.atFrame/30+1.5,b:chart.lines.length>1?s.draw.atFrame/30+2.4:Infinity,watch:Infinity}},c)
  }
  g.restore()
  if(s.add){g.save();g.translate(1500,20);toast(g,t,{c,W:800,H:150,items:[[s.add.atFrame/30,s.params.rows[0]??s.tab??'',c.mint]]},c);g.restore()}
  if(s.pick){const k=progress(p.frame-s.pick.atFrame,12,HERO),i=s.params.tabs.indexOf(s.pick.toState),x=120+(i*430)*k,y=400-320*k
    g.fillStyle=c.cream;g.beginPath();g.moveTo(x,y);g.lineTo(x+40,y+60);g.lineTo(x+10,y+50);g.closePath();g.fill()
    const click=progress(p.frame-s.pick.atFrame-12,13.5,t=>t);if(p.frame>=s.pick.atFrame+12&&click<1){g.strokeStyle=c.mint;g.lineWidth=5;g.beginPath();g.arc(x,y,20+60*click,0,Math.PI*2);g.stroke()}}
}
function Screen(p:DeviceProps){
  const texture=React.useMemo(()=>{const cv=document.createElement('canvas');cv.width=2400;cv.height=1600;paint(cv.getContext('2d')!,p);const tx=new T.CanvasTexture(cv);tx.colorSpace=T.SRGBColorSpace;return tx},[p.object,p.events,p.frame,p.tokens])
  React.useEffect(()=>()=>texture.dispose(),[texture])
  return <mesh><planeGeometry args={[6,4]}/><meshBasicMaterial map={texture} toneMapped={false}/></mesh>
}
function Streak({p,index}:{p:DeviceProps,index:number}){
  const s=screenState(p.object,p.events,p.frame),k=progress(p.frame-(s.enter?.atFrame??Infinity),48,HERO)
  const geometry=React.useMemo(()=>new T.TubeGeometry(new T.CatmullRomCurve3([new T.Vector3(-5,-2+index*2,-1),new T.Vector3(-2,-2.4+index*2,.2),new T.Vector3(2,-2+index*2,-.4),new T.Vector3(5,1+index,-2)]),120,.025,8,false),[])
  React.useEffect(()=>()=>geometry.dispose(),[geometry]);geometry.setDrawRange(0,Math.floor((geometry.index!.count*k)/3)*3)
  return <mesh geometry={geometry}><meshBasicMaterial color={index===1?p.tokens.mint:p.tokens.channel} toneMapped={false}/></mesh>
}
export function Device(p:DeviceProps){const s=screenState(p.object,p.events,p.frame);if(!s.visible)return null
  const v=viewport(p),cam=cameraFor(p),tall=p.aspect==='9:16'
  return <div data-device="living_screen" style={{position:'absolute',...p.box,background:p.tokens.ink,opacity:s.opacity,overflow:'hidden'}}>
    <div style={{position:'absolute',...v,overflow:'hidden'}}><ThreeCanvas width={Math.round(v.width)} height={Math.round(v.height)} camera={{position:cam.eye.toArray(),rotation:[cam.rotation.x,cam.rotation.y,cam.rotation.z],fov:36}} gl={{antialias:true}}>
      <color attach="background" args={[p.tokens.ink]}/><fog attach="fog" args={[p.tokens.ink,cam.distance*1.05,cam.distance*2.4]}/><ambientLight intensity={.6}/><directionalLight color={p.tokens.cream} position={[-5,8,6]}/>
      <mesh position={[0,0,-.13]}><boxGeometry args={[6.2,4.2,.22]}/><meshStandardMaterial color={p.tokens.inkSoft} metalness={.7} roughness={.25}/></mesh>
      <Screen {...p}/>{[0,1,2].map(index=><Streak key={index} p={p} index={index}/>)}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-2.5,0]}><planeGeometry args={[80,80]}/><meshStandardMaterial color={p.tokens.inkSoft} metalness={.4} roughness={.4}/></mesh>
    </ThreeCanvas></div>
    <div style={{position:'absolute',left:tall?p.box.width*60/1080:p.box.width*.04,top:tall?p.box.height*270/1920:p.box.height*.06,color:p.tokens.cream,fontFamily:HOUSE_FONTS.data,fontSize:tall?p.box.width*40/1080:p.box.width*.02,maxWidth:v.width}}>{p.object.dataset?.producerLabel}</div>
  </div>
}
