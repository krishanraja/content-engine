import React from 'react'
import { ThreeCanvas } from '@remotion/three'
import * as T from 'three'
import { staticFile, delayRender, continueRender, cancelRender } from 'remotion'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
// Shared moves own their geometry animation; this adapter supplies event-relative seconds.
// @ts-ignore shared JavaScript move
import { update as countParts } from '@mymu/moves/count-on-a-part/move.mjs'
// @ts-ignore shared JavaScript move
import { update as streetDrop } from '@mymu/moves/street-drop/move.mjs'
// @ts-ignore shared JavaScript move
import { update as levelLine } from '@mymu/moves/level-line/move.mjs'
// @ts-ignore shared JavaScript move
import { update as slabTowers } from '@mymu/moves/slab-towers/move.mjs'
// @ts-ignore shared JavaScript move
import { update as taskCopies } from '@mymu/moves/task-copies-3d/move.mjs'
import { HERO, ENTER, EXIT, MOTION, drift, progress } from '../../clock'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { ladderState } from './state'

const ease={hero:HERO,enter:ENTER,exit:EXIT}
export function buildSet(p:DeviceProps) {
  const s=ladderState(p.object,p.events,p.frame), c=p.tokens, root=new T.Group()
  const plain=new T.MeshStandardMaterial({color:c.cream,roughness:0.85})
  const lit=new T.MeshStandardMaterial({color:c.mint,emissive:c.mint,emissiveIntensity:0.22})
  const dark=new T.MeshStandardMaterial({color:c.inkSoft,roughness:0.7})
  const mesh=<M extends T.Material,>(w:number,h:number,d:number,mat:M,x=0,y=0,z=0)=>{
    const m=new T.Mesh(new RoundedBoxGeometry(w,h,d,2,0.04),mat)
    m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;return m
  }
  function branch(scale=1) {
    const group=new T.Group();group.scale.setScalar(scale)
    group.add(mesh(6,3.6,3.2,plain,0,2.1),mesh(6.6,0.3,3.8,plain,0,0.15),mesh(6.8,0.22,3.6,plain,0,3.95))
    const ped=new T.Shape();ped.moveTo(-3.3,0);ped.lineTo(3.3,0);ped.lineTo(0,1.1);ped.closePath()
    const roof=new T.Mesh(new T.ExtrudeGeometry(ped,{depth:3.4,bevelEnabled:false}),plain);roof.position.set(0,4,-1.7);group.add(roof)
    for(const x of [-2.6,2.6]) {const col=new T.Mesh(new T.CylinderGeometry(0.17,0.2,3.6,24),plain);col.position.set(x,2.1,1.75);col.castShadow=true;group.add(col)}
    const windows=Array.from({length:s.params.parts},(_,i)=>{
      const rows=Math.ceil(s.params.parts/5),x=-1.84+(i%5)*0.92,y=3.25-Math.floor(i/5)*2.88/rows
      group.add(mesh(0.78,0.6,0.12,dark,x,y,1.62))
      const glass=mesh(0.62,0.44,0.03,new T.MeshStandardMaterial({color:c.inkSoft,emissive:c.channel,emissiveIntensity:0}),x,y,1.7)
      group.add(glass)
      return {glass,head:new T.Object3D(),sh:new T.Object3D()}
    })
    root.add(group);return {group,windows}
  }
  // The plinth is part of the same architectural object, full bleed below the safe type.
  root.add(mesh(30,0.5,36,dark,0,-0.35,3))
  const hero=branch()
  countParts(hero.windows,s.count,{c,e:ease,from:Math.max(1,s.count),to:s.count,times:{countStart:-100,countLand:-99,drop:-100,ghost:Infinity,ghostEnd:Infinity,first:Infinity}},c)
  hero.windows.forEach((w,i)=>{if(s.highlight===String(i)){w.glass.material.color.set(c.mint);w.glass.material.emissive.set(c.mint)}})
  const street=Array.from({length:s.copies},(_,i)=>({...branch(0.55),home:new T.Vector3((i-(s.copies-1)/2)*4.2,0,-4)}))
  streetDrop(street,((s.add?.atFrame??0)+(p.frame-(s.add?.atFrame??0))*4)/30,{c,e:ease,first:0,times:{more:(s.add?.atFrame??Infinity)/30,first:Infinity,end:Infinity}},c)
  hero.group.visible=s.act==='branch'||(s.act==='street'&&s.copies===0)
  hero.group.position.y=-6*(1-s.rise)
  for(const b of street) b.group.visible=b.group.visible&&s.act==='street'
  const line=mesh(16,0.06,0.22,lit,0,0.04,-1)
  root.add(line);levelLine(line,p.frame/30,{c,e:ease,times:{start:(s.draw?.atFrame??Infinity)/30,end:Infinity}},c)
  line.visible=line.visible&&s.act==='street'
  const towers=[[],[]] as T.Mesh[][]
  const old=s.params.towers
  for(const [side,n] of [Math.max(old.left,s.heights.left),Math.max(old.right,s.heights.right)].entries())
    for(let i=0;i<n;i++){const m=mesh(2.4,0.22,1.6,plain);root.add(m);towers[side]!.push(m)}
  // The shared move's falling side is always the shrinking stack; reverse for symmetric cues.
  const at=(s.fill?.atFrame??-300)/30
  for(let side=0;side<2;side++){
    const key=side===0?'left':'right',before=old[key],after=s.heights[key],xs=[side===0?-2.4:2.4,side===0?-2.4:2.4]
    const falling=after<before
    slabTowers(falling?[towers[side],[]]:[[],towers[side]],at+(p.frame/30-at)*Math.max(3,Math.max(before,after)/2),{c,e:ease,xs,z:0,left:[before,after],right:[before,after],mats:{plain,lit},times:{show:-Infinity,fall:at,grow:at,watch:s.highlight===key?-Infinity:Infinity}},c)
    towers[side]!.forEach(m=>{m.visible=m.visible&&s.act==='towers';if(s.highlight===key)m.material=lit})
  }
  const tasks=Array.from({length:5},()=>{const m=mesh(2.4,0.22,1.6,lit);root.add(m);return m})
  taskCopies(tasks,((s.carry?.atFrame??0)+(p.frame-(s.carry?.atFrame??0))*5)/30,{c,e:ease,from:[2.4,Math.max(0,s.heights.right-1)*0.26],z:0,times:{lift:(s.carry?.atFrame??Infinity)/30,copies:(s.carry?.atFrame??Infinity)/30+0.9}},c)
  tasks.forEach(m=>m.visible=m.visible&&s.act==='towers')
  if(s.carry&&s.act==='towers') {const top=towers[1]?.[s.heights.right-1];if(top)top.visible=false}
  // Explicit highlight cues articulate a facade part (or slab), never change its count.
  const cue=s.detail
  const k=cue?progress(p.frame-cue.atFrame,MOTION.slapFrames,HERO):1
  const settle=4*k*(1-k)
  const index=Number(cue?.toState)
  if(Number.isInteger(index)&&index>=0) {
    for(const b of [hero,...street]) {
      const pane=b.windows[index]?.glass
      if(pane) {pane.position.z+=settle*0.35;pane.rotation.x=settle*0.12}
    }
  }
  if(cue?.toState==='right'||cue?.toState==='left') {
    const side=cue.toState==='left'?0:1
    const slab=towers[side]?.[s.heights[side===0?'left':'right']-1]
    if(slab) {slab.position.y+=settle*0.3;slab.rotation.y=settle*0.12}
  }
  // Non-repeating light travel and physical drift remain alive between authored cues.
  const travel=drift(p.frame,p.object.fromFrame,p.object.toFrame,8)
  root.rotation.y=travel
  root.visible=s.visible
  return {root,s,plain}
}
export function Device(p:DeviceProps) {
  const rig=React.useMemo(()=>buildSet(p),[p.object,p.events,p.frame,p.tokens])
  React.useEffect(()=>()=>{rig.root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose(); const mats=Array.isArray(o.material)?o.material:[o.material];mats.forEach(m=>m.dispose())}})},[rig])
  const {s}=rig
  if(!s.visible)return null
  const tall=p.aspect==='9:16',w=p.box.width,h=p.box.height
  const {eye,orientation}=cameraAt(p)
  const number=p.object.dataset?.rows.find(r=>r.value===s.count)
  return <div data-device="ladder_stage" style={{position:'absolute',...p.box,left:p.box.left,top:p.box.top,background:p.tokens.ink,opacity:s.opacity,overflow:'hidden'}}>
    <div style={{position:'absolute',left:0,top:0,width:w,height:h}}>
      <ThreeCanvas width={Math.round(w)} height={Math.round(h)} camera={{position:[eye.x,eye.y,eye.z],rotation:[orientation.x,orientation.y,orientation.z],fov:36}}
        shadows gl={{antialias:true,toneMapping:T.ACESFilmicToneMapping,toneMappingExposure:1.05}} onCreated={({gl})=>{
          gl.shadowMap.type=T.PCFSoftShadowMap
        }}>
        <color attach="background" args={[p.tokens.ink]}/><fog attach="fog" args={[p.tokens.ink,30,70]}/>
        <hemisphereLight args={[p.tokens.cream,p.tokens.ink,0.55]}/>
        <directionalLight color={p.tokens.cream} intensity={2.6} position={[-8+drift(p.frame,p.object.fromFrame,p.object.toFrame,100)*10,14,10]} castShadow shadow-mapSize={[2048,2048]}/>
        <directionalLight color={p.tokens.mint} intensity={0.3} position={[10,6,-12]}/>
        <mesh rotation={[-Math.PI/2,0,0]} receiveShadow><planeGeometry args={[200,200]}/><meshStandardMaterial color={p.tokens.inkSoft} roughness={0.92}/></mesh>
        <Evidence rig={rig} images={s.params.images} tokens={p.tokens}/><primitive object={rig.root}/>
      </ThreeCanvas>
    </div>
    <div style={{position:'absolute',left:tall?w*72/1080:w*0.06,top:tall?h*270/1920:h*0.14,color:p.tokens.cream,maxWidth:tall?w*760/1080:w*0.33}}>
      {number&&<div style={{fontFamily:HOUSE_FONTS.display,fontSize:tall?w*220/1080:w*0.11,lineHeight:1.1}}>{number.value}</div>}
      <div style={{fontFamily:HOUSE_FONTS.data,fontSize:tall?w*40/1080:w*0.02}}>{s.params.labels[s.act]??number?.label}</div>
      <div style={{fontFamily:HOUSE_FONTS.data,fontSize:tall?w*40/1080:w*0.018}}>{p.object.dataset?.producerLabel}</div>
    </div>
  </div>
}
/** A continuous orbit/crane, plus a hero-curve reframe when an act changes. */
export function cameraAt(p:DeviceProps) {
  const s=ladderState(p.object,p.events,p.frame)
  const tall=p.aspect==='9:16'
  const travel=drift(p.frame,p.object.fromFrame,p.object.toFrame,100)
  const shots={branch:[4,5,12],street:[1,8,15],towers:[4,5,12]} as const
  let camera:number[]=[...shots.branch]
  const fired=p.events.filter(e=>e.obj===p.object.obj&&e.verb==='move'&&e.atFrame<=p.frame).sort((a,b)=>a.atFrame-b.atFrame)
  for(let i=0;i<fired.length;i++) {
    const e=fired[i]!,target=shots[e.toState as keyof typeof shots]
    const k=progress(Math.min(p.frame,fired[i+1]?.atFrame??p.frame)-e.atFrame,33,HERO)
    camera=camera.map((v,j)=>v+(target[j]!-v)*k)
  }
  const angle=travel*0.32
  const distance=tall?0.78:1
  const eye=new T.Vector3((camera[0]!*Math.cos(angle)+camera[2]!*Math.sin(angle))*distance,
    (camera[1]!+travel*1.2)*distance,(camera[2]!*Math.cos(angle)-camera[0]!*Math.sin(angle))*distance)
  const aim=new T.Vector3(0,s.act==='street'?1:1.8,0)
  const orientation=new T.Euler().setFromRotationMatrix(new T.Matrix4().lookAt(eye,aim,new T.Vector3(0,1,0)))
  return {eye,orientation}
}

// Evidence is supplied by the piece. No stock texture, invented logo or icon fallback.
function Evidence({rig,images,tokens}:{rig:ReturnType<typeof buildSet>;images:string[];tokens:DeviceProps['tokens']}) {
  React.useEffect(()=>{
    const textures:T.Texture[]=[],plates:T.Mesh[]=[]
    const handles=new Set<number>()
    for(const [i,src] of images.entries()) {
      const handle=delayRender('ladder evidence');handles.add(handle)
      const tx=new T.TextureLoader().load(staticFile(src),()=>{handles.delete(handle);continueRender(handle)},undefined,error=>{
        handles.delete(handle);cancelRender(error instanceof Error?error:new Error(String(error)))
      })
      tx.colorSpace=T.SRGBColorSpace;textures.push(tx)
      const plate=new T.Mesh(new T.PlaneGeometry(1.5,0.85),new T.MeshStandardMaterial({map:tx,color:tokens.cream,roughness:0.8}))
      plate.position.set(-1.8+i*1.8,0.8,1.82);rig.root.add(plate);plates.push(plate)
    }
    return ()=>{handles.forEach(continueRender);textures.forEach(t=>t.dispose());plates.forEach(m=>{rig.root.remove(m);m.geometry.dispose();(m.material as T.Material).dispose()})}
  },[rig,images,tokens])
  return null
}
