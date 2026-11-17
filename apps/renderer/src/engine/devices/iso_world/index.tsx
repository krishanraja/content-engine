import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { project, worldState } from './state'
export { worldState, project, routePoint } from './state'
/** A 2:1 orthographic grid. All surfaces share this projection; faces never rotate pictures. */
export function worldGeometry(p: DeviceProps) {
  const s = worldState(p), t = p.tokens
  const maxA = Math.max(...s.params.blocks.map(b => b.cell[0])) + 1, maxB = Math.max(...s.params.blocks.map(b => b.cell[1])) + 1
  const floor = [[-0.55,-0.55],[maxA-0.45,-0.55],[maxA-0.45,maxB-0.45],[-0.55,maxB-0.45]].map(project)
  const left = Math.min(...floor.map(p => p.x)), right = Math.max(...floor.map(p => p.x))
  const top = Math.min(...s.params.blocks.map(b => project(b.cell).y - b.height * 90 - 110)), bottom = Math.max(...floor.map(p => p.y)) + 45
  const tall = p.aspect === '9:16'
  const availableW = Math.min(p.box.width, tall ? 820 : p.box.width * 0.9), availableH = Math.min(p.box.height, tall ? 1000 : p.box.height * 0.88)
  const scale = Math.min(availableW / (right-left+40), availableH / (bottom-top+40)) * (1+s.drift)
  const tx = (availableW - (left+right)*scale)/2 - s.focus.x*scale*0.12
  const ty = (tall ? Math.max(0,270-p.box.top) : (p.box.height-availableH)/2) - top*scale + 10 - s.focus.y*scale*0.12
  const polygons: { points: number[][]; color: string; id: string }[] = []
  const poly = (id: string, color: string, points: number[][]) => polygons.push({ id, color, points })
  const gy = -100*(1-s.ground)+s.out*100
  poly('ground',t.inkSoft,floor.map(p => [p.x,p.y+gy]))
  const faces = s.blocks.map(b => {
    const x=b.x, y=b.y-170*(1-b.drop)+b.sink*360, h=(b.heightNow*90+ (b.highlighted ? 9*Math.sin(b.pulse*Math.PI) : 0))*(1-b.sink), w=78
    poly(b.id+'-left',b.highlighted?t.mint:t.cream,[[x-w,y-h],[x,y+39-h],[x,y+39],[x-w,y]])
    poly(b.id+'-right',b.highlighted?t.mint:t.inkSoft,[[x,y+39-h],[x+w,y-h],[x+w,y],[x,y+39]])
    poly(b.id+'-top',b.highlighted?t.mint:t.cream,[[x,y-39-h],[x+w,y-h],[x,y+39-h],[x-w,y-h]])
    return { id:b.id, image:b.image?s.params.images[b.image]:undefined, label:b.label, x:x-47, y:y-h+36, width:94, height:Math.max(0,h-47), tagY:y-h-58 }
  })
  return { s, scale, tx, ty, polygons, faces }
}
export function Device(p: DeviceProps) {
  const g=worldGeometry(p), t=p.tokens
  if(!g.s.visible) return null
  return <svg width={p.box.width} height={p.box.height} style={{position:'absolute',left:p.box.left,top:p.box.top,overflow:'hidden'}}>
    <g transform={`translate(${g.tx} ${g.ty}) scale(${g.scale})`}>
      {g.polygons.slice(0,1).map(poly=><polygon key={poly.id} data-surface={poly.id} points={poly.points.map(p=>p.join(',')).join(' ')} fill={poly.color} stroke={t.ink} strokeWidth={2}/>)}
      {g.faces.map((f,i)=><g key={f.id} data-face={f.id}>
        {g.polygons.slice(1+i*3,4+i*3).map(poly=><polygon key={poly.id} data-surface={poly.id} points={poly.points.map(p=>p.join(',')).join(' ')} fill={poly.color} stroke={t.ink} strokeWidth={2}/>)}
        {f.image && f.height>0 && <image href={f.image.src} x={f.x} y={f.y} width={f.width} height={f.height} preserveAspectRatio="xMidYMid meet"/>}
        {f.label && <text x={f.x+47} y={f.tagY} textAnchor="middle" fontFamily={HOUSE_FONTS.data} fontSize={19} fill={t.cream}>{f.label}</text>}
      </g>)}
      {g.s.token && <circle data-route={g.s.token.route} cx={g.s.token.x} cy={g.s.token.y} r={12} fill={t.mint} stroke={t.ink} strokeWidth={3}/>}
    </g>
    {p.object.dataset && <text x={24} y={Math.min(p.box.height-20,1290-p.box.top)} fontFamily={HOUSE_FONTS.data} fontSize={22} fill={t.cream}>{p.object.dataset.producerLabel}</text>}
  </svg>
}
/** Caller supplies decoded evidence images. No loading, clock or random state in canvas drawing. */
export function drawCanvas(ctx: CanvasRenderingContext2D, p: DeviceProps, images: Readonly<Record<string, CanvasImageSource>> = {}) {
  const g=worldGeometry(p)
  if(!g.s.visible) return
  ctx.save(); ctx.translate(p.box.left,p.box.top); ctx.beginPath(); ctx.rect(0,0,p.box.width,p.box.height); ctx.clip(); ctx.translate(g.tx,g.ty); ctx.scale(g.scale,g.scale)
  const paint = (polys: typeof g.polygons) => { for(const poly of polys) { ctx.beginPath(); poly.points.forEach(([x,y],i)=>i?ctx.lineTo(x!,y!):ctx.moveTo(x!,y!)); ctx.closePath(); ctx.fillStyle=poly.color; ctx.fill(); ctx.strokeStyle=p.tokens.ink; ctx.lineWidth=2; ctx.stroke() } }
  paint(g.polygons.slice(0,1))
  for(const [i,f] of g.faces.entries()) { paint(g.polygons.slice(1+i*3,4+i*3)); if(f.image && images[f.image.src] && f.height>0) { const ratio=Math.min(f.width/f.image.pixelWidth,f.height/f.image.pixelHeight),w=f.image.pixelWidth*ratio,h=f.image.pixelHeight*ratio; ctx.drawImage(images[f.image.src]!,f.x+(f.width-w)/2,f.y+(f.height-h)/2,w,h) } if(f.label) { ctx.font=`19px "${HOUSE_FONTS.data}"`;ctx.textAlign='center';ctx.fillStyle=p.tokens.cream;ctx.fillText(f.label,f.x+47,f.tagY) } }
  if(g.s.token) { ctx.beginPath();ctx.arc(g.s.token.x,g.s.token.y,12,0,Math.PI*2);ctx.fillStyle=p.tokens.mint;ctx.fill();ctx.stroke() }
  ctx.restore()
  if(p.object.dataset) { ctx.save(); ctx.font=`22px "${HOUSE_FONTS.data}"`;ctx.textAlign='left';ctx.fillStyle=p.tokens.cream;ctx.fillText(p.object.dataset.producerLabel,p.box.left+24,p.box.top+Math.min(p.box.height-20,1290-p.box.top));ctx.restore() }
}
