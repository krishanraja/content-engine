import React from 'react'
// @ts-expect-error shared plain JavaScript move bank
import { handCircle } from '@mymu/moves/freeze-circle-magnify/move.mjs'
import { HOUSE_FONTS, HOUSE_GRAIN_OPACITY } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { filmState, grainSample } from './state'

/** Reuse the bank's hand circle through its tiny canvas path interface. */
function ringPath(x: number, y: number, w: number, h: number, k: number) {
  const points: string[] = []
  const pen = { save() {}, restore() {}, beginPath() {}, stroke() {},
    moveTo(a: number, b: number) { points.push(`M${a},${b}`) },
    lineTo(a: number, b: number) { points.push(`L${a},${b}`) } }
  handCircle(pen, x, y, w, h, k, '', 5, 8)
  return points.join(' ')
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = filmState(object, events, frame)
  if (!s.visible) return null
  const tall = aspect === '9:16', w = box.width, h = box.height
  const id = `film-${encodeURIComponent(object.obj)}`
  const src = s.params.images[s.plate.image] ?? s.plate.image
  // Labels stay in the safe area, even when the footage fills a full-bleed slot.
  const left = Math.max(24, tall ? 60 - box.left : 24)
  const right = Math.min(w - 24, tall ? 860 - box.left : w - 24)
  const labelY = Math.max(24, tall ? 270 - box.top + 24 : 24)
  const labelWidth = right - left
  const wrap = (text: string) => text.match(new RegExp(`.{1,${Math.max(1, Math.floor(labelWidth / 20))}}`, 'gu')) ?? []
  const labels = [...wrap(s.plate.date), ...wrap(s.plate.source)]
  const labelH = labels.length * 38 + 24
  if (tall && box.top + labelY + labelH > 1320) throw new Error('film_frame provenance exceeds safe area')
  const picY = labelY + labelH + 12, picH = Math.max(1, h - picY - 12)
  const region = s.region, mark = s.mark
  const scaleY = (0.015 + 0.985 * s.warm) * (1 - s.collapse)
  const image = <image href={src} width={w} height={picH} preserveAspectRatio="xMidYMid slice" />
  return <svg data-device="film_frame" role="img" aria-label={object.meaning} width={w} height={h}
    viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: box.left, top: box.top }}>
    <defs>
      <clipPath id={`${id}-picture`}><rect width={w} height={picH} /></clipPath>
      {region && <clipPath id={`${id}-lift`}><rect x={region.x * w} y={region.y * picH} width={region.width * w} height={region.height * picH} /></clipPath>}
    </defs>
    <g transform={`translate(0 ${picY + picH / 2}) scale(1 ${scaleY}) translate(0 ${-picH / 2})`}>
      <rect width={w} height={picH} fill={tokens.inkDeep} />
      <g clipPath={`url(#${id}-picture)`}>
        <g transform={`translate(${s.weaveX - s.push * w / 2} ${s.weaveY - s.push * picH / 2}) scale(${1.005 + s.push})`}>
          {image}
          <rect width={w} height={picH} fill={tokens.ink} opacity={0.12} />
          <g data-texture="grain" opacity={HOUSE_GRAIN_OPACITY}>
            {Array.from({ length: 700 }, (_, i) => <rect key={i} x={grainSample(frame, i * 3 + 3) * w}
              y={grainSample(frame, i * 3 + 4) * picH} width={1 + grainSample(frame, i * 3 + 5) * 3} height={2}
              fill={i & 1 ? tokens.cream : tokens.inkDeep} />)}
          </g>
          {s.params.mode === 'crt' && <g data-texture="scanlines" stroke={tokens.inkDeep} opacity={0.16} strokeWidth={1}>
            {Array.from({ length: Math.ceil(picH / 5) }, (_, i) => <path key={i} d={`M0 ${i * 5} H${w}`} />)}
          </g>}
          {s.params.mode === 'crt' && <rect data-texture="tracking" y={grainSample(frame, 2500) * picH} width={w} height={2} fill={tokens.cream} opacity={0.12} />}
          {mark && <path data-mark="" d={ringPath(mark.x * w, mark.y * picH, mark.width * w, mark.height * picH, s.marked)}
            fill="none" stroke={tokens.mint} strokeWidth={5} strokeLinecap="round" />}
        </g>
        {region && <g data-present="" transform={`translate(${region.x * w + region.width * w / 2} ${region.y * picH + region.height * picH / 2}) scale(${1 + 0.16 * s.lifted}) translate(${-region.x * w - region.width * w / 2} ${-region.y * picH - region.height * picH / 2})`}>
          <g clipPath={`url(#${id}-lift)`}>{image}</g>
          <rect x={region.x * w} y={region.y * picH} width={region.width * w} height={region.height * picH} fill="none" stroke={tokens.mint} strokeWidth={4} />
        </g>}
      </g>
    </g>
    <g data-provenance="" fontFamily={HOUSE_FONTS.data} fontSize={30} fill={tokens.cream}>
      <rect x={left - 12} y={labelY} width={labelWidth + 24} height={labelH} fill={tokens.ink} />
      {labels.map((line, i) => <text key={i} x={left} y={labelY + 34 + i * 38}>{line}</text>)}
    </g>
  </svg>
}
