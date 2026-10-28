import type { Point } from './homography'
export interface Camera { k: number; rot: number; tx: number; ty: number }
export class Cam implements Camera {
  constructor(public k: number, public rot: number, public tx: number, public ty: number) {
    if (![k,rot,tx,ty].every(Number.isFinite) || k <= 0) throw new Error('invalid phone camera')
  }
  p2c(x: number, y: number): Point {
    const r = this.rot * Math.PI / 180
    return [this.k * (x * Math.cos(r) - y * Math.sin(r)) + this.tx, this.k * (x * Math.sin(r) + y * Math.cos(r)) + this.ty]
  }
  c2p(X: number, Y: number): Point {
    const r = this.rot * Math.PI / 180, x = (X-this.tx)/this.k, y = (Y-this.ty)/this.k
    return [x*Math.cos(r)+y*Math.sin(r), -x*Math.sin(r)+y*Math.cos(r)]
  }
  css(): string { return `translate(${this.tx.toFixed(2)}px,${this.ty.toFixed(2)}px) rotate(${this.rot.toFixed(3)}deg) scale(${this.k.toFixed(4)})` }
}
export function lerpCam(a: Camera, b: Camera, t: number): Cam {
  const p = Math.max(0, Math.min(1,t)), mix = (x: number,y: number) => x+(y-x)*p
  if (p===0) return new Cam(a.k,a.rot,a.tx,a.ty)
  if (p===1) return new Cam(b.k,b.rot,b.tx,b.ty)
  return new Cam(mix(a.k,b.k),mix(a.rot,b.rot),mix(a.tx,b.tx),mix(a.ty,b.ty))
}
