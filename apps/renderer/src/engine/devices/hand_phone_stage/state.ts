import { drift, EXIT, HERO, MOTION, progress, stateAt } from '../../clock'
import { Cam, lerpCam } from '../../kit/camera'
import type { EngineEvent, EngineObject } from '../../props'
import { ParamsSchema, type StageCamera } from './schema'
interface BackdropLayer { id: string; camera: StageCamera; opacity: number }
interface GlassLayer { kind: string; atFrame: number; opacity: number }
const asCam=(c: StageCamera)=>new Cam(c.k,c.rot,c.tx,c.ty)
export function phoneState(object: EngineObject, events: readonly EngineEvent[], frame: number) {
  const params=ParamsSchema.parse(object.params)
  const fired=stateAt(events,object.obj,frame).fired
  const entrance=fired.findLast(e=>e.verb==='enter')
  const relevant=fired.filter(e=>e.atFrame >= (entrance?.atFrame ?? Infinity))
  const cameraFor=(id: string)=>{
    const c=params.cameras[id]
    if (!c) throw new Error(`ve: unknown phone camera ${id}`)
    return c
  }
  let target=cameraFor(params.start), from=asCam(target), moveAt=-Infinity
  let backdropLayers: BackdropLayer[]=[{id:params.start,camera:target,opacity:1}], backdropAt=-Infinity
  let glassLayers: GlassLayer[]=[{kind:'blank',atFrame:entrance?.atFrame ?? object.fromFrame,opacity:1}], fillAt=-Infinity
  const fadeBack=(at: number)=>{
    const t=progress(at-backdropAt,12)
    return backdropLayers.map((l,i)=>({...l,opacity:i===backdropLayers.length-1?t:l.opacity*(1-t)})).filter(l=>l.opacity>0)
  }
  const fadeGlass=(at: number)=>{
    const t=progress(at-fillAt,MOTION.enterFrames)
    return glassLayers.map((l,i)=>({...l,opacity:i===glassLayers.length-1?t:l.opacity*(1-t)})).filter(l=>l.opacity>0)
  }
  // Before any transition the initial layer is fully opaque.
  const cameraAt=(at: number)=>Number.isFinite(moveAt)?lerpCam(from,target,progress(at-moveAt,18,HERO)):asCam(target)
  for (const event of relevant) {
    if(event.verb==='move') {
      const next=cameraFor(event.toState)
      from=cameraAt(event.atFrame); moveAt=event.atFrame; target=next
      const last=backdropLayers.at(-1)!.camera
      if(last.backdrop!==next.backdrop || JSON.stringify(last.bg)!==JSON.stringify(next.bg)) {
        const prior=Number.isFinite(backdropAt)?fadeBack(event.atFrame):backdropLayers
        backdropLayers=[...prior,{id:event.id,camera:next,opacity:1}]; backdropAt=event.atFrame
      }
    }
    if(event.verb==='fill') {
      if(event.toState!=='blank' && !Object.hasOwn(params.glass,event.toState)) throw new Error(`ve: missing glass params ${event.toState}`)
      const prior=Number.isFinite(fillAt)?fadeGlass(event.atFrame):glassLayers
      glassLayers=[...prior,{kind:event.toState,atFrame:event.atFrame,opacity:1}]; fillAt=event.atFrame
    }
  }
  const exitEvent=relevant.findLast(e=>e.verb==='exit')
  const exit=exitEvent?progress(frame-exitEvent.atFrame,MOTION.exitFrames,EXIT):0
  return {params,cam:cameraAt(frame),visible:!!entrance && frame>=object.fromFrame && frame<object.toFrame && exit<1,
    opacity:(entrance?progress(frame-entrance.atFrame,MOTION.enterFrames):0)*(1-exit),
    backdrops:Number.isFinite(backdropAt)?fadeBack(frame):backdropLayers,
    glass:Number.isFinite(fillAt)?fadeGlass(frame):glassLayers,
    ambientScale:1+drift(frame,object.fromFrame,object.toFrame),
    ambientRoll:0.5*Math.sin((frame-object.fromFrame)*2*Math.PI/90)}
}
