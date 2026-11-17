import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { project, worldState } from './state'
import { FillSchema } from './schema'
export { worldState, project, routePoint } from './state'

/** Half a block's width and the slope of its edges on the 2:1 grid. */
const HALF = 78, SLOPE = 39, STOREY = 90
/** The label face's size and its average advance per character (IBM Plex Mono is 0.6 em). */
const LABEL_SIZE = 19, LABEL_ADVANCE = LABEL_SIZE * 0.62
/** A tall frame (frame pixels). The picture fills the slot from the top band at y 270 to the foot of the house caption
 *  box at y 1320 (captions are their own layer, drawn over it); what must be read (the labels) stays right of x 60, left
 *  of x 860 (config/channel-safe-zones.json) and above the caption box at y 1090 (kit/lock.ts). Krish, 13 Nov, of a
 *  set held in a safe band: "the use of the screen space is terrible". */
export const TALL_PICTURE = { left: 24, right: 1056, top: 270, bottom: 1320 } as const
export const TALL_READ = { left: 60, right: 860, top: 270, bottom: 1080 } as const
/** The largest drift a scene takes (clock.ts drift is under 0.5% of its scale), fitted for in advance. */
const MAX_DRIFT = 0.006

type Poly = { id: string; color: string; points: number[][]; lit?: boolean }
/** A picture set on a block's lit face: the face's own plane, verticals kept upright (no rotation, only the 2:1 slope). */
type Picture = { src: string; pixelWidth: number; pixelHeight: number; matrix: [number, number, number, number, number, number] }

/** The tallest each block ever stands in this object's events, so the view is fitted once and nothing grows off frame. */
function tallest(p: DeviceProps, blocks: readonly { id: string; height: number }[]) {
  const most = new Map(blocks.map(b => [b.id, b.height]))
  for (const e of p.events) {
    if (e.obj !== p.object.obj || e.verb !== 'fill') continue
    let raw: unknown
    try { raw = JSON.parse(e.toState) } catch { continue }
    const fill = FillSchema.safeParse(raw)
    if (fill.success && most.has(fill.data.id)) most.set(fill.data.id, Math.max(most.get(fill.data.id)!, fill.data.height))
  }
  return most
}

type Rect = { left: number; right: number; top: number; bottom: number }
/** A frame rect in box pixels, or the box itself when the box does not reach it. */
function inBox(p: DeviceProps, r: Rect): Rect {
  const { left, top, width, height } = p.box
  const l = Math.max(left, r.left), rr = Math.min(left + width, r.right), t = Math.max(top, r.top), b = Math.min(top + height, r.bottom)
  return rr - l > 100 && b - t > 100 ? { left: l - left, right: rr - left, top: t - top, bottom: b - top } : { left: 0, right: width, top: 0, bottom: height }
}

/** Where the picture may reach and where its labels must stay, in box pixels. */
function regions(p: DeviceProps): { picture: Rect; read: Rect } {
  if (p.aspect === '9:16') return { picture: inBox(p, TALL_PICTURE), read: inBox(p, TALL_READ) }
  const { width: w, height: h } = p.box
  return { picture: { left: w * 0.04, right: w * 0.96, top: h * 0.05, bottom: h * 0.95 }, read: { left: w * 0.05, right: w * 0.95, top: h * 0.06, bottom: h * 0.94 } }
}

/** The view's scale and offset: as large as the picture region allows while every label stays in the readable region,
 *  then centred in the picture region as far as the labels let it. `scale` and `range` are fitted once per scene. */
function fit(p: DeviceProps, world: Rect, labels: Rect | undefined) {
  const { picture, read } = regions(p)
  let scale = Math.min((picture.right - picture.left) / (world.right - world.left), (picture.bottom - picture.top) / (world.bottom - world.top))
  const range = (k: number) => ({
    x: [Math.max(picture.left - world.left * k, labels ? read.left - labels.left * k : -Infinity), Math.min(picture.right - world.right * k, labels ? read.right - labels.right * k : Infinity)],
    y: [Math.max(picture.top - world.top * k, labels ? read.top - labels.top * k : -Infinity), Math.min(picture.bottom - world.bottom * k, labels ? read.bottom - labels.bottom * k : Infinity)],
  })
  for (let i = 0; i < 60; i++) {
    const r = range(scale * (1 + MAX_DRIFT))
    if (r.x[0]! <= r.x[1]! && r.y[0]! <= r.y[1]!) break
    scale *= 0.97
  }
  return { scale, range, centre: { x: (picture.left + picture.right) / 2, y: (picture.top + picture.bottom) / 2 } }
}

const clamp = (v: number, [lo, hi]: number[]) => Math.min(Math.max(v, lo!), Math.max(lo!, hi!))

/** A 2:1 orthographic grid. All surfaces share this projection. */
export function worldGeometry(p: DeviceProps) {
  const s = worldState(p), t = p.tokens
  const most = tallest(p, s.params.blocks)
  const maxA = Math.max(...s.params.blocks.map(b => b.cell[0])) + 1, maxB = Math.max(...s.params.blocks.map(b => b.cell[1])) + 1
  const floor = [[-0.55, -0.55], [maxA - 0.45, -0.55], [maxA - 0.45, maxB - 0.45], [-0.55, maxB - 0.45]].map(project)
  const left = Math.min(...floor.map(p => p.x)), right = Math.max(...floor.map(p => p.x))
  const bottom = Math.max(...floor.map(p => p.y)) + 20
  // Each label at the height its block will reach (its top) and at no height at all (its baseline), so a fill never
  // carries one out of the readable region; its width is the data face's average advance, with its ink edge.
  const named = s.params.blocks.filter(b => b.label)
  const labels: Rect | undefined = named.length ? {
    left: Math.min(...named.map(b => project(b.cell).x - b.label!.length * LABEL_ADVANCE / 2 - 6)),
    right: Math.max(...named.map(b => project(b.cell).x + b.label!.length * LABEL_ADVANCE / 2 + 6)),
    top: Math.min(...named.map(b => project(b.cell).y - most.get(b.id)! * STOREY - SLOPE - 22 - LABEL_SIZE)),
    // A landed block can still be in its drop's overshoot (about 12% of the 170 px fall), so allow for it below.
    bottom: Math.max(...named.map(b => project(b.cell).y - SLOPE - 22 + 26)),
  } : undefined
  const top = Math.min(labels?.top ?? Infinity, ...s.params.blocks.map(b => project(b.cell).y - most.get(b.id)! * STOREY - SLOPE))
  const view = fit(p, { left, right, top, bottom }, labels)
  const scale = view.scale * (1 + s.drift), room = view.range(scale)
  // Centred in the picture region as far as the labels allow; `move` slides the view a little towards its block.
  const tx = clamp(view.centre.x - ((left + right) / 2 + s.focus.x * 0.12) * scale, room.x)
  const ty = clamp(view.centre.y - ((top + bottom) / 2 + s.focus.y * 0.12) * scale, room.y)
  const gy = -100 * (1 - s.ground) + s.out * 100
  const ground: Poly = { id: 'ground', color: t.inkSoft, points: floor.map(p => [p.x, p.y + gy]) }
  const blocks = s.blocks.map(b => {
    // A block drops in from above with weight and, on exit, sinks into its own cell: its base never leaves the ground.
    const x = b.x, y = b.y - 170 * (1 - b.drop)
    const h = (b.heightNow * STOREY + (b.highlighted ? 9 * Math.sin(b.pulse * Math.PI) : 0)) * (1 - b.sink)
    // One light from the upper left: the top is lit, the left face takes the light half-on, the right face is in shade.
    const lit = b.highlighted ? t.mint : t.cream
    const polys: Poly[] = [
      { id: b.id + '-left', color: lit, lit: !b.highlighted, points: [[x - HALF, y - h], [x, y + SLOPE - h], [x, y + SLOPE], [x - HALF, y]] },
      { id: b.id + '-right', color: b.highlighted ? t.mint : t.inkSoft, points: [[x, y + SLOPE - h], [x + HALF, y - h], [x + HALF, y], [x, y + SLOPE]] },
      { id: b.id + '-top', color: lit, points: [[x, y - SLOPE - h], [x + HALF, y - h], [x, y + SLOPE - h], [x - HALF, y - h]] },
    ]
    const image = b.image ? s.params.images[b.image] : undefined
    // The picture goes on a face nothing in the scene stands in front of: the lit left face unless a block holds the
    // cell it looks onto, then the right face. Read from the whole scene, so a picture never jumps faces mid-cut.
    const taken = (a: number, c: number) => s.params.blocks.some(o => o.cell[0] === a && o.cell[1] === c)
    const side = taken(b.cell[0], b.cell[1] + 1) && !taken(b.cell[0] + 1, b.cell[1]) ? 'right' : 'left'
    // Its label is pinned once it has landed, so a label never rides a falling block above the readable region.
    return { id: b.id, polys, picture: image && h > 30 ? onFace(image, x, y, h, side) : undefined, label: b.drop >= 0.98 ? b.label : undefined,
      labelX: x, labelY: y - h - SLOPE - 22, shown: h > 4 }
  })
  return { s, scale, tx, ty, ground, blocks }
}

/** Fit a picture inside a face with a margin, on the face's own plane: x runs along the 2:1 edge, y stays upright. */
function onFace(image: { src: string; pixelWidth: number; pixelHeight: number }, x: number, y: number, h: number, side: 'left' | 'right'): Picture {
  const along = Math.hypot(HALF, SLOPE), ux = HALF / along, uy = (side === 'left' ? SLOPE : -SLOPE) / along
  const k = Math.min(0.82 * along / image.pixelWidth, 0.82 * h / image.pixelHeight)
  const s0 = (along - image.pixelWidth * k) / 2, t0 = (h - image.pixelHeight * k) / 2
  // The face's top corner nearest the viewer's left: the left face starts at its outer edge, the right face at the front edge.
  const [ox, oy] = side === 'left' ? [x - HALF, y - h] : [x, y + SLOPE - h]
  return { ...image, matrix: [k * ux, k * uy, 0, k, ox + s0 * ux, oy + s0 * uy + t0] }
}

export function Device(p: DeviceProps) {
  const g = worldGeometry(p), t = p.tokens
  if (!g.s.visible) return null
  const polygon = (poly: Poly) => <React.Fragment key={poly.id}>
    <polygon data-surface={poly.id} points={poly.points.map(q => q.join(',')).join(' ')} fill={poly.lit ? t.inkSoft : poly.color} stroke={t.ink} strokeWidth={2} strokeLinejoin="round" />
    {poly.lit && <polygon points={poly.points.map(q => q.join(',')).join(' ')} fill={poly.color} fillOpacity={0.8} />}
  </React.Fragment>
  return <svg width={p.box.width} height={p.box.height} style={{ position: 'absolute', left: p.box.left, top: p.box.top, overflow: 'hidden' }}>
    <g transform={`translate(${g.tx} ${g.ty}) scale(${g.scale})`}>
      {polygon(g.ground)}
      {g.blocks.map(b => <g key={b.id} data-face={b.id}>
        {b.shown && b.polys.map(polygon)}
        {b.picture && <image href={b.picture.src} x={0} y={0} width={b.picture.pixelWidth} height={b.picture.pixelHeight}
          preserveAspectRatio="none" transform={`matrix(${b.picture.matrix.join(' ')})`} />}
      </g>)}
      {g.s.token && <circle data-route={g.s.token.route} cx={g.s.token.x} cy={g.s.token.y} r={12} fill={t.mint} stroke={t.ink} strokeWidth={3} />}
      {/* Labels last, each on its own ink edge, so no block in front can hide one and none sits cream on a cream face. */}
      {g.blocks.map(b => b.label && b.shown && <text key={b.id} data-label={b.id} x={b.labelX} y={b.labelY} textAnchor="middle"
        fontFamily={HOUSE_FONTS.data} fontSize={LABEL_SIZE} fill={t.cream} stroke={t.ink} strokeWidth={5} paintOrder="stroke" strokeLinejoin="round">{b.label}</text>)}
    </g>
    {p.object.dataset && <text x={24} y={Math.min(p.box.height - 20, 1290 - p.box.top)} fontFamily={HOUSE_FONTS.data} fontSize={22} fill={t.cream}>{p.object.dataset.producerLabel}</text>}
  </svg>
}

/** Caller supplies decoded evidence images. No loading, clock or random state in canvas drawing. */
export function drawCanvas(ctx: CanvasRenderingContext2D, p: DeviceProps, images: Readonly<Record<string, CanvasImageSource>> = {}) {
  const g = worldGeometry(p), t = p.tokens
  if (!g.s.visible) return
  ctx.save(); ctx.translate(p.box.left, p.box.top); ctx.beginPath(); ctx.rect(0, 0, p.box.width, p.box.height); ctx.clip(); ctx.translate(g.tx, g.ty); ctx.scale(g.scale, g.scale)
  const trace = (poly: Poly) => { ctx.beginPath(); poly.points.forEach(([x, y], i) => i ? ctx.lineTo(x!, y!) : ctx.moveTo(x!, y!)); ctx.closePath() }
  const paint = (poly: Poly) => {
    trace(poly); ctx.fillStyle = poly.lit ? t.inkSoft : poly.color; ctx.fill()
    if (poly.lit) { ctx.globalAlpha = 0.8; ctx.fillStyle = poly.color; ctx.fill(); ctx.globalAlpha = 1 }
    ctx.strokeStyle = t.ink; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke()
  }
  paint(g.ground)
  for (const b of g.blocks) {
    if (b.shown) b.polys.forEach(paint)
    const pic = b.picture, img = pic && images[pic.src]
    if (pic && img) { ctx.save(); ctx.transform(...pic.matrix); ctx.drawImage(img, 0, 0, pic.pixelWidth, pic.pixelHeight); ctx.restore() }
  }
  if (g.s.token) { ctx.beginPath(); ctx.arc(g.s.token.x, g.s.token.y, 12, 0, Math.PI * 2); ctx.fillStyle = t.mint; ctx.fill(); ctx.strokeStyle = t.ink; ctx.lineWidth = 3; ctx.stroke() }
  ctx.font = `${LABEL_SIZE}px "${HOUSE_FONTS.data}"`; ctx.textAlign = 'center'; ctx.lineJoin = 'round'
  for (const b of g.blocks) if (b.label && b.shown) { ctx.strokeStyle = t.ink; ctx.lineWidth = 5; ctx.strokeText(b.label, b.labelX, b.labelY); ctx.fillStyle = t.cream; ctx.fillText(b.label, b.labelX, b.labelY) }
  ctx.restore()
  if (p.object.dataset) { ctx.save(); ctx.font = `22px "${HOUSE_FONTS.data}"`; ctx.textAlign = 'left'; ctx.fillStyle = t.cream; ctx.fillText(p.object.dataset.producerLabel, p.box.left + 24, p.box.top + Math.min(p.box.height - 20, 1290 - p.box.top)); ctx.restore() }
}
