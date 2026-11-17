import React from 'react'
import { drift, MOTION } from '../../clock'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'
import { brushPath } from './brush'
import { washState } from './state'

/** Reflective imagery only. The original picture is duotoned, never replaced by procedural art.
 * toState names a stroke/region ID; 'all' addresses the complete collection. No text layer. */
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const params = ParamsSchema.parse(object.params)
  const state = washState(object, events, frame)
  if (!state.visible) return null
  const id = `wash-${Array.from(object.obj).map(c => c.codePointAt(0)!.toString(16)).join('-')}`
  const seed = Math.max(0, Math.floor(frame)) + 1
  const push = drift(frame, object.fromFrame, object.toFrame, Math.max(.2, MOTION.driftPct))
  const wet = 1 - state.dry
  const cue = (verb: string, target: string) => state.fired.findLast(e => e.verb === verb && (e.toState === target || e.toState === 'all'))
  return <svg width={box.width} height={box.height} viewBox="0 0 1000 1000" preserveAspectRatio="none"
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
      <filter id={`${id}-ink`} colorInterpolationFilters="sRGB">
        <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.2126 -.7152 -.0722 0 1" result="luminance" />
        <feFlood floodColor={tokens.ink} result="pigment" />
        <feComposite in="pigment" in2="luminance" operator="in" />
      </filter>
      <radialGradient id={`${id}-wet`}><stop stopColor={tokens.inkSoft} stopOpacity=".38" /><stop offset="1" stopColor={tokens.inkSoft} stopOpacity="0" /></radialGradient>
      <clipPath id={`${id}-reveal`}><ellipse cx="500" cy="500" rx={720 * state.bloom * wet} ry={760 * state.bloom * wet} /></clipPath>
    </defs>
    <rect width="1000" height="1000" fill={tokens.cream} />
    <g clipPath={`url(#${id}-reveal)`}>
      <g transform={`translate(${-push * 200} ${-push * 120}) scale(${1 + push})`}>
        {params.images.map((image, i) => {
          const tall = aspect === '9:16'
          const cols = tall ? 1 : params.images.length
          const rows = tall ? params.images.length : 1
          return <image key={i} href={image.src} x={i % cols * 1000 / cols} y={Math.floor(i / cols) * 1000 / rows}
            width={1000 / cols} height={1000 / rows} preserveAspectRatio="xMidYMid meet"
            filter={`url(#${id}-ink)`} style={{ mixBlendMode: 'multiply' }} />
        })}
      </g>
      <rect width="1000" height="1000" fill={tokens.cream} opacity=".07" filter={`url(#${id}-paper)`} />
      <ellipse cx="480" cy="510" rx={610 * state.bloom * wet} ry={650 * state.bloom * wet} fill={`url(#${id}-wet)`} filter={`url(#${id}-bleed)`} />
      {params.regions.map(region => {
        const fill = cue('fill', region.id)
        const highlight = cue('highlight', region.id)
        const grow = state.amount(fill) * wet
        const mint = state.amount(highlight)
        return <g key={region.id} filter={`url(#${id}-bleed)`}>
          <ellipse cx={region.x * 1000} cy={region.y * 1000} rx={region.rx * 1000 * grow} ry={region.ry * 1000 * grow}
            fill={tokens.inkSoft} opacity={.24 * (1 - mint)} />
          <ellipse cx={region.x * 1000} cy={region.y * 1000} rx={region.rx * 1000 * grow * mint} ry={region.ry * 1000 * grow * mint}
            fill={tokens.mint} opacity=".36" />
        </g>
      })}
      <g filter={`url(#${id}-bleed)`}>
      <svg viewBox="0 0 1000 1000" width="1000" height="1000" preserveAspectRatio="none">
        {params.strokes.map(stroke => <path key={stroke.id} d={stroke.d ? stroke.d : brushPath(stroke.shape!, stroke.box!, 1)} transform={stroke.d ? 'scale(1000)' : undefined} pathLength="1" fill="none" stroke={tokens.ink}
          strokeWidth={(stroke.d ? .008 : 8) * wet} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="1"
          strokeDashoffset={1 - state.amount(cue('draw', stroke.id), MOTION.slideFrames)} />)}
      </svg>
      </g>
    </g>
  </svg>
}
