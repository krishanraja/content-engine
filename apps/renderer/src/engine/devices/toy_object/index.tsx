import React from 'react'
import * as T from 'three'
import { ThreeCanvas } from '@remotion/three'
import { staticFile, delayRender, continueRender, cancelRender } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { Params } from './schema'
import { buildSet, labelBox } from './scene'

export function Device(p:DeviceProps) {
  const src=Params.parse(p.object.params).images[0]!
  const [texture,setTexture]=React.useState<T.Texture>()
  React.useEffect(()=>{
    const handle=delayRender('toy_object picture');let active=true;let loaded:T.Texture|undefined
    new T.TextureLoader().load(src.startsWith('/')||src.startsWith('data:')||src.startsWith('https:')?src:staticFile(src),tx=>{
      loaded=tx;tx.colorSpace=T.SRGBColorSpace
      if(active)setTexture(tx);else tx.dispose()
      continueRender(handle)
    },undefined,error=>cancelRender(error))
    return ()=>{active=false;loaded?.dispose()}
  },[src])
  const scene=React.useMemo(()=>buildSet(p,texture),[p.object,p.events,p.frame,p.aspect,p.box,p.tokens,texture])
  React.useEffect(()=>()=>{scene.root.traverse(o=>{if(o instanceof T.Mesh){o.geometry.dispose();const materials=Array.isArray(o.material)?o.material:[o.material];materials.forEach(m=>m.dispose())}})},[scene])
  if(!scene.visible)return null
  const label=labelBox(p)
  return <div data-device="toy_object" style={{position:'absolute',...p.box,overflow:'hidden',background:p.tokens.ink}}>
    <ThreeCanvas width={Math.round(p.box.width)} height={Math.round(p.box.height)} camera={scene.camera} shadows gl={{antialias:true}}>
      <color attach="background" args={[p.tokens.ink]}/>
      <ambientLight intensity={.9}/><directionalLight color={p.tokens.cream} intensity={2.5} position={[-4,8,9]} castShadow shadow-mapSize={[2048,2048]} shadow-radius={8}/>
      <directionalLight color={p.tokens.mint} intensity={.5} position={[5,2,-4]}/>
      <primitive object={scene.root}/>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-3.15,0]} receiveShadow><planeGeometry args={[100,100]}/><meshStandardMaterial color={p.tokens.ink} roughness={1}/></mesh>
    </ThreeCanvas>
    {p.object.dataset&&<div style={{position:'absolute',...label,color:p.tokens.cream,fontFamily:HOUSE_FONTS.data,fontSize:Math.min(label.height*.65,label.width/(p.object.dataset.producerLabel.length+8)*1.5)}}>{p.object.dataset.producerLabel} {p.events.filter(e=>e.obj===p.object.obj&&e.verb==='count_to'&&e.atFrame<=p.frame).at(-1)?.toState??''}</div>}
  </div>
}
