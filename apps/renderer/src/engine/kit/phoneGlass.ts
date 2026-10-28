import { Cam } from './camera'
import { homography, matrix3d, type Homography, type Point } from './homography'
export const PW = 941, PH = 1672, GW = 352, GH = 720
export const QUAD: readonly Point[] = [[235.83583886200307, 50.249158994926], [568.4029309138018, 114.36341775001937], [336.2037393579055, 836.6757252153873], [-17.02490325538173, 731.8378625633443]]
export class Screen {
  readonly W: number; readonly H: number; readonly Hm: Homography
  constructor(public cam: Cam) {
    this.W = GW*cam.k; this.H = GH*cam.k
    this.Hm = homography([[0,0],[this.W,0],[this.W,this.H],[0,this.H]],QUAD)
  }
  u2p(u: number,v: number): Point {
    const h=this.Hm, z=h[2][0]*u+h[2][1]*v+1
    return [(h[0][0]*u+h[0][1]*v+h[0][2])/z,(h[1][0]*u+h[1][1]*v+h[1][2])/z]
  }
  u2c(u: number,v: number): Point { return this.cam.p2c(...this.u2p(u,v)) }
  css(): string { return matrix3d(this.Hm) }
  quadC(u0=0,v0=0,u1=this.W,v1=this.H): Point[] { return [[u0,v0],[u1,v0],[u1,v1],[u0,v1]].map(([u,v])=>this.u2c(u!,v!)) }
}
/** Clip the parent in plate pixels, before the child's perspective transform. */
export function uiClipPath(expand=9,rad=36): string {
  const center: Point = [QUAD.reduce((s,p)=>s+p[0],0)/4,QUAD.reduce((s,p)=>s+p[1],0)/4]
  const lines = QUAD.map((a,i) => {
    const b=QUAD[(i+1)%4]!, len=Math.hypot(b[0]-a[0],b[1]-a[1])
    const d: Point=[(b[0]-a[0])/len,(b[1]-a[1])/len]
    let n: Point=[-d[1],d[0]]
    if(n[0]*(a[0]-center[0])+n[1]*(a[1]-center[1])<0) n=[-n[0],-n[1]]
    return {p:[a[0]+n[0]*expand,a[1]+n[1]*expand] as Point,d}
  })
  const cross=(a: Point,b: Point)=>a[0]*b[1]-a[1]*b[0]
  const pts=lines.map((line,i)=>{
    const prev=lines[(i+3)%4]!, delta: Point=[line.p[0]-prev.p[0],line.p[1]-prev.p[1]]
    const t=cross(delta,line.d)/cross(prev.d,line.d)
    return [prev.p[0]+t*prev.d[0],prev.p[1]+t*prev.d[1]] as Point
  })
  const toward=(c: Point,p: Point): Point=>{ const len=Math.hypot(p[0]-c[0],p[1]-c[1]); return [c[0]+(p[0]-c[0])/len*rad,c[1]+(p[1]-c[1])/len*rad] }
  const fmt=(p: Point)=>p.map(v=>v.toFixed(1)).join(' ')
  return "path('"+pts.map((c,i)=>(i===0?'M':'L')+fmt(toward(c,pts[(i+3)%4]!))+'Q'+fmt(c)+' '+fmt(toward(c,pts[(i+1)%4]!))).join('')+"Z')"
}
