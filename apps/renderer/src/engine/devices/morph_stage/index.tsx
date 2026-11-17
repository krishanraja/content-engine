import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { morphState } from './state'

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = morphState(object, events, frame)
  if (!s.visible) return null
  const state = s.params.states[s.index]!, old = s.params.states[s.previous]!
  const tall = aspect === '9:16'
  const top = tall ? Math.max(0, 270 - box.top) : box.height * .06
  const bottom = tall ? Math.min(box.height, 1320 - box.top) : box.height * .94
  const h = Math.max(1, bottom - top), w = box.width * .94
  const x = box.width * .03, y = top
  const path = s.points.map((p, i) => `${i ? 'L' : 'M'}${x + p[0] * w},${y + p[1] * h}`).join(' ') + ' Z'
  const id = `morph-${Array.from(object.obj).map(c => c.codePointAt(0)!.toString(16)).join('-')}`
  const image = state.kind === 'image' ? s.params.images[state.image] : undefined
  const row = state.kind === 'number' ? object.dataset!.rows[state.row]! : undefined
  const previousRow = old.kind === 'number' ? object.dataset!.rows[old.row] : row
  const size = Math.min(tall ? 170 : 230, w * .22, h * .3)
  const textX = tall ? Math.min(box.width / 2, 460 - box.left) : box.width / 2
  const textY = top + h * .5
  return <svg data-aspect={aspect} width={box.width} height={box.height} viewBox={`0 0 ${box.width} ${box.height}`} style={{ position: 'absolute', left: box.left, top: box.top }}>
    <defs>
      <clipPath id={id}><path d={path}/></clipPath>
      <clipPath id={`${id}-roll`}><rect x={0} y={textY - size} width={box.width} height={size * 1.3}/></clipPath>
      <filter id={`${id}-brand`} colorInterpolationFilters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -.2126 -.7152 -.0722 1 0" result="luminance"/><feFlood floodColor={tokens.ink}/><feComposite in2="luminance" operator="in"/></filter>
    </defs>
    <g transform={`translate(${box.width / 2} ${top + h / 2}) scale(${s.scale * (1 + s.drift)}) translate(${-box.width / 2} ${-top - h / 2})`}>
      <path data-outline="" d={path} fill={tokens[state.role]}/>
      {image && <image href={image.src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid meet" clipPath={`url(#${id})`} filter={`url(#${id}-brand)`}/>}
      {s.highlighted && <path d={path} fill="none" stroke={tokens.mint} strokeWidth={12}/>}
      {row && <g clipPath={`url(#${id}-roll)`} fill={tokens.ink} textAnchor="middle" fontFamily={HOUSE_FONTS.display} fontSize={size}>
        {s.amount < 1 && <text x={textX} y={textY - s.amount * size * 1.3}>{previousRow!.value}</text>}
        <text x={textX} y={textY + (1 - s.amount) * size * 1.3}>{row.value}</text>
      </g>}
      {row && <text x={textX} y={Math.min(top + h * .77, tall ? 1260 - box.top : bottom - 30)} textAnchor="middle" fontFamily={HOUSE_FONTS.data} fontSize={28} fill={tokens.ink}>{object.dataset!.unit} {object.dataset!.denominator === null ? '' : `/ ${object.dataset!.denominator}`} · {object.dataset!.producerLabel}</text>}
    </g>
  </svg>
}
