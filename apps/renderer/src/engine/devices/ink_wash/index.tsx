import React from 'react'
import { drift, MOTION } from '../../clock'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'
import { brushPath } from './brush'
import { washState } from './state'

/** A tall frame (frame pixels): the picture fills the slot from the top band at y 270 to the foot of the house caption
 *  box at y 1320, edge to edge; captions are their own layer, drawn over it. Krish, 13 Nov, of a set held in a band:
 *  "the use of the screen space is terrible". */
export const TALL_PICTURE = { left: 24, right: 1056, top: 270, bottom: 1320 } as const

type Rect = { x: number; y: number; w: number; h: number }

/** Where the paper, the pictures and the marks go, in box pixels, drawn at one scale (never stretched). */
export function washLayout({ object, box, aspect }: Pick<DeviceProps, 'object' | 'box' | 'aspect'>) {
  const params = ParamsSchema.parse(object.params)
  let paper: Rect = { x: box.width * 0.04, y: box.height * 0.05, w: box.width * 0.92, h: box.height * 0.9 }
  const tall = aspect === '9:16'
  if (tall) {
    const l = Math.max(box.left, TALL_PICTURE.left), r = Math.min(box.left + box.width, TALL_PICTURE.right)
    const t = Math.max(box.top, TALL_PICTURE.top), b = Math.min(box.top + box.height, TALL_PICTURE.bottom)
    if (r - l > 100 && b - t > 100) paper = { x: l - box.left, y: t - box.top, w: r - l, h: b - t }
  }
  // Pictures in rows on a tall frame and in columns on a wide one, each at its own aspect inside its cell.
  const n = params.images.length
  const pictures = params.images.map((image, i) => {
    const cell: Rect = tall ? { x: paper.x, y: paper.y + i * paper.h / n, w: paper.w, h: paper.h / n }
      : { x: paper.x + i * paper.w / n, y: paper.y, w: paper.w / n, h: paper.h }
    const k = Math.min(cell.w / image.pixelWidth, cell.h / image.pixelHeight)
    const w = image.pixelWidth * k, h = image.pixelHeight * k
    return { image, rect: { x: cell.x + (cell.w - w) / 2, y: cell.y + (cell.h - h) / 2, w, h } }
  })
  // Marks and washes are placed on the one picture, or on the paper when there are several.
  const marks = n === 1 ? pictures[0]!.rect : paper
  return { params, paper, pictures, marks }
}

/** Reflective imagery only. The original picture is duotoned in ink on the paper, never replaced by procedural art.
 * toState names a stroke or region id; 'all' addresses the whole collection. No text layer. */
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const { params, paper, pictures, marks } = washLayout({ object, box, aspect })
  const state = washState(object, events, frame)
  if (!state.visible) return null
  const id = `wash-${Array.from(object.obj).map(c => c.codePointAt(0)!.toString(16)).join('-')}`
  const seed = Math.max(0, Math.floor(frame)) + 1
  const push = drift(frame, object.fromFrame, object.toFrame, Math.max(.2, MOTION.driftPct))
  const wet = 1 - state.dry
  const cue = (verb: string, target: string) => state.fired.findLast(e => e.verb === verb && (e.toState === target || e.toState === 'all'))
  const cx = paper.x + paper.w / 2, cy = paper.y + paper.h / 2
  const at = (u: number, v: number) => [marks.x + u * marks.w, marks.y + v * marks.h] as const
  return <svg width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`}
    data-device="ink_wash" data-aspect={aspect} style={{ position: 'absolute', left: box.left, top: box.top }}>
    <defs>
      <filter id={`${id}-paper`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency=".65" numOctaves={3} seed={seed} result="grain" />
        <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  .333 .333 .333 0 0" result="fibres" />
        <feFlood floodColor={tokens.inkSoft} result="paperInk" />
        <feComposite in="paperInk" in2="fibres" operator="in" />
      </filter>
      <filter id={`${id}-bleed`} x="-20%" y="-20%" width="140%" height="140%">
        <feTurbulence type="fractalNoise" baseFrequency=".018" numOctaves={3} seed={seed} result="noise" />
        <feDisplacementMap in="SourceGraphic" in2="noise" scale={8 + 14 * wet} />
        <feGaussianBlur stdDeviation={.5 + wet} />
      </filter>
      {/* Ink where the picture is dark, paper where it is light, and nothing where the picture has no pixels: the
          alpha row keeps the source's own alpha, so the space round a picture never floods with ink. */}
      <filter id={`${id}-ink`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values={INK_MATRIX} result="luminance" />
        <feFlood floodColor={tokens.ink} result="pigment" />
        <feComposite in="pigment" in2="luminance" operator="in" />
      </filter>
      <radialGradient id={`${id}-wet`}><stop stopColor={tokens.inkSoft} stopOpacity=".38" /><stop offset="1" stopColor={tokens.inkSoft} stopOpacity="0" /></radialGradient>
      {/* The paper blooms open from the middle and closes again as it dries: nothing is left on screen after exit. */}
      <clipPath id={`${id}-reveal`}><ellipse cx={cx} cy={cy} rx={0.72 * paper.w * state.bloom * wet} ry={0.72 * paper.h * state.bloom * wet} /></clipPath>
    </defs>
    <g clipPath={`url(#${id}-reveal)`}>
      <rect data-paper x={paper.x} y={paper.y} width={paper.w} height={paper.h} fill={tokens.cream} />
      <g transform={`translate(${cx} ${cy}) scale(${1 + push}) translate(${-cx} ${-cy})`}>
        {pictures.map(({ image, rect }, i) => <image key={i} href={image.src} x={rect.x} y={rect.y} width={rect.w} height={rect.h}
          preserveAspectRatio="xMidYMid meet" filter={`url(#${id}-ink)`} style={{ mixBlendMode: 'multiply' }} />)}
      </g>
      <rect x={paper.x} y={paper.y} width={paper.w} height={paper.h} fill={tokens.cream} opacity=".07" filter={`url(#${id}-paper)`} />
      <ellipse cx={cx} cy={cy} rx={0.61 * paper.w * state.bloom * wet} ry={0.65 * paper.h * state.bloom * wet} fill={`url(#${id}-wet)`} filter={`url(#${id}-bleed)`} />
      {params.regions.map(region => {
        const grow = state.amount(cue('fill', region.id)) * wet
        const mint = state.amount(cue('highlight', region.id))
        const [x, y] = at(region.x, region.y)
        return <g key={region.id} filter={`url(#${id}-bleed)`}>
          <ellipse cx={x} cy={y} rx={region.rx * marks.w * grow} ry={region.ry * marks.h * grow} fill={tokens.inkSoft} opacity={.24 * (1 - mint)} />
          <ellipse cx={x} cy={y} rx={region.rx * marks.w * grow * mint} ry={region.ry * marks.h * grow * mint} fill={tokens.mint} opacity=".36" />
        </g>
      })}
      <g filter={`url(#${id}-bleed)`}>
        {params.strokes.map(stroke => {
          const offset = 1 - state.amount(cue('draw', stroke.id), MOTION.slideFrames)
          const common = { pathLength: 1, fill: 'none', stroke: tokens.ink, strokeWidth: 8 * wet, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, strokeDasharray: 1, strokeDashoffset: offset }
          if (stroke.d) return <path key={stroke.id} d={stroke.d} transform={`translate(${marks.x} ${marks.y}) scale(${marks.w} ${marks.h})`} vectorEffect="non-scaling-stroke" {...common} />
          const [u, v, bw, bh] = stroke.box!
          const [x, y] = at(u, v)
          return <path key={stroke.id} d={brushPath(stroke.shape!, [x, y, bw * marks.w, bh * marks.h], 1)} {...common} />
        })}
      </g>
    </g>
  </svg>
}

/** Alpha = the source's alpha less its luminance: dark pixels become ink, light and empty ones stay clear. */
export const INK_MATRIX = '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.2126 -.7152 -.0722 1 0'
