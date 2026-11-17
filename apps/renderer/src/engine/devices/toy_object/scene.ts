import * as T from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
// @ts-ignore shared JavaScript move
import { update as countParts } from '@mymu/moves/count-on-a-part/move.mjs'
import { stateAt, progress, drift, MOTION, ENTER, HERO, EXIT } from '../../clock'
import type { DeviceProps } from '../types'
import { Params } from './schema'

export function buildSet(p: DeviceProps, texture?: T.Texture) {
  const params = Params.parse(p.object.params), fired = stateAt(p.events, p.object.obj, p.frame).fired
  const last = (verb: string) => fired.filter(e => e.verb === verb).at(-1)
  const enter = last('enter'), exit = last('exit'), move = last('move'), add = last('add')
  const copies = add ? Number(add.toState) : 0
  if (!Number.isInteger(copies) || copies < 0 || copies > 4) throw new Error('toy_object: add expects 0 to 4 copies')
  const tall = p.aspect === '9:16', worldWidth = tall ? 7.1 : 7 * p.box.width / p.box.height
  const worldHeight = worldWidth * p.box.height / p.box.width
  const camera = new T.OrthographicCamera(-worldWidth/2, worldWidth/2, worldHeight/2, -worldHeight/2, .1, 100)
  // A bounded orbit keeps the front readable. 18 degrees in 1.1 seconds, plus a small continuous drift.
  let angle = 0
  const moves = fired.filter(e => e.verb === 'move')
  for (let i=0;i<moves.length;i++) {
    const cue=moves[i]!, target=cue.toState==='left'?-.3:cue.toState==='front'?0:cue.toState==='right'?.3:NaN
    if (!Number.isFinite(target)) throw new Error('toy_object: move expects left, front or right')
    angle += (target-angle)*progress(Math.min(p.frame,moves[i+1]?.atFrame??p.frame)-cue.atFrame,33,t=>t)
  }
  angle += drift(p.frame,p.object.fromFrame,p.object.toFrame,1.5)
  camera.position.set(20*Math.sin(angle), .25, 20*Math.cos(angle)); camera.lookAt(0,0,0); camera.updateMatrixWorld()
  const root = new T.Group(), cream = new T.MeshStandardMaterial({color:p.tokens.cream,roughness:.85})
  const mint = new T.MeshStandardMaterial({color:p.tokens.mint,roughness:params.object==='candy'?.45:.9})
  const dark = new T.MeshStandardMaterial({color:p.tokens.inkSoft,roughness:1})
  function toy(scale:number,x:number,y:number,hero:boolean) {
    const group=new T.Group(); group.scale.setScalar(scale);group.position.set(x,y,0)
    const body=new T.Mesh(new RoundedBoxGeometry(6,3.2,1.3,5,params.object==='capsule'?.6:.35),hero?mint:cream)
    body.name='body';body.castShadow=body.receiveShadow=true;group.add(body)
    const studs: T.Mesh<T.SphereGeometry,T.MeshStandardMaterial>[]=[]
    for(let i=0;i<params.parts;i++) {
      const stud=new T.Mesh(new T.SphereGeometry(.1,16,12),dark.clone())
      stud.name='stud';stud.position.set(-2.5+5*i/Math.max(1,params.parts-1),-1.05,.68);group.add(stud);studs.push(stud)
    }
    if(hero) {
      const counts=fired.filter(e=>e.verb==='count_to'); let count=0
      for(let i=0;i<counts.length;i++) {
        const cue=counts[i]!,target=Number(cue.toState)
        if(!Number.isInteger(target)||target<0||target>params.parts||!p.object.dataset?.rows.some(r=>r.value===target)) throw new Error('toy_object: count requires a dataset value within parts')
        count += (target-count)*progress(Math.min(p.frame,counts[i+1]?.atFrame??p.frame)-cue.atFrame,Math.min(18,MOTION.countFrames),t=>t)
      }
      const windows=studs.map(glass=>({glass,head:{visible:false},sh:{visible:false}}))
      countParts(windows,count,{c:{...p.tokens,channel:p.tokens.mint},e:{enter:ENTER,hero:HERO,exit:EXIT},from:params.parts,to:params.parts,times:{countStart:0,countLand:params.parts,drop:Infinity,ghost:Infinity,ghostEnd:Infinity,first:Infinity}})
      const hi=last('highlight')
      if(hi){const index=Number(hi.toState);if(!Number.isInteger(index)||!studs[index])throw new Error('toy_object: invalid part');const k=progress(p.frame-hi.atFrame,MOTION.slapFrames);studs[index]!.material.color.lerp(new T.Color(p.tokens.mint),k);studs[index]!.scale.setScalar(1+.3*k)}
      const face=new T.Mesh(new T.PlaneGeometry(3.8,1.55),new T.MeshBasicMaterial({map:texture,color:texture?p.tokens.cream:p.tokens.inkSoft,toneMapped:false}))
      face.name='picture';face.position.set(0,.25,.656);group.add(face)
    }
    root.add(group);return group
  }
  const drop=enter?1-progress(p.frame-enter.atFrame,Math.min(7,MOTION.dropFrames)):1
  const fall=exit?progress(p.frame-exit.atFrame,MOTION.exitFrames,EXIT):0
  const hero=toy(1,0,(tall?.7:.65)+drop*worldHeight-fall*worldHeight*2,true)
  const copyGroups=[]
  for(let i=0;i<copies;i++) {
    const k=progress(p.frame-(add?.atFrame??0)-i*Math.min(2,MOTION.staggerFrames),Math.min(7,MOTION.dropFrames))
    const scale=tall?.25:.3, x=(i-(copies-1)/2)*(tall?1.65:2.2)
    copyGroups.push(toy(scale,x,(tall?-2.5:-2)+ (1-k)*worldHeight-fall*worldHeight*2,false))
  }
  root.updateMatrixWorld(true)
  return {root,hero,copies:copyGroups,camera,move,visible:!!enter&&(!exit||p.frame<exit.atFrame+MOTION.exitFrames)}
}
export function projectedBounds(node:T.Object3D,camera:T.Camera,p:DeviceProps) {
  const b=new T.Box3().setFromObject(node),points=[]
  for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]) {
    const v=new T.Vector3(x,y,z).project(camera);points.push({x:(v.x+1)*p.box.width/2,y:(1-v.y)*p.box.height/2})
  }
  return {left:Math.min(...points.map(v=>v.x)),right:Math.max(...points.map(v=>v.x)),top:Math.min(...points.map(v=>v.y)),bottom:Math.max(...points.map(v=>v.y))}
}
export function labelBox(p:DeviceProps){return {left:p.box.width*.06,top:p.box.height*(p.aspect==='9:16'?.16:.06),width:p.box.width*.7,height:p.box.height*.045}}
