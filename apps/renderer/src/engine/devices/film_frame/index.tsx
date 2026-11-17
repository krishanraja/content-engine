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

type Box = { x: number; y: number; width: number; height: number }
/** The plate filling the picture area at its own aspect (cropped, never stretched), the crop centred on what this
 *  plate's marks and lifts point at, so a ring is never cut off by the slot's shape. Pixels in the picture area. */
export function plateCrop(image: { pixelWidth: number; pixelHeight: number }, w: number, h: number, focus: { x: number; y: number }) {
  const k = Math.max(w / image.pixelWidth, h / image.pixelHeight), cw = image.pixelWidth * k, ch = image.pixelHeight * k
  const clamp = (v: number, lo: number) => Math.min(0, Math.max(lo, v))
  return { x: clamp(w / 2 - focus.x * cw, w - cw), y: clamp(h / 2 - focus.y * ch, h - ch), w: cw, h: ch }
}
/** A region given as fractions of the plate's picture, in pixels of the picture area. */
export function onPicture(r: { x: number; y: number; width: number; height: number }, crop: { x: number; y: number; w: number; h: number }): Box {
  return { x: crop.x + r.x * crop.w, y: crop.y + r.y * crop.h, width: r.width * crop.w, height: r.height * crop.h }
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = filmState(object, events, frame)
  if (!s.visible) return null
  const tall = aspect === '9:16', w = box.width, h = box.height
  const id = `film-${encodeURIComponent(object.obj)}`
  const plate = s.params.images[s.plate.image]!
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
  const crop = plateCrop(plate, w, picH, s.focus)
  const region = s.region && onPicture(s.region, crop), mark = s.mark && onPicture(s.mark, crop)
  const scaleY = (0.015 + 0.985 * s.warm) * (1 - s.collapse)
  const image = <image href={plate.src} x={crop.x} y={crop.y} width={crop.w} height={crop.h} preserveAspectRatio="none" />
  return <svg data-device="film_frame" role="img" aria-label={object.meaning} width={w} height={h}
    viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: box.left, top: box.top }}>
    <defs>
      <clipPath id={`${id}-picture`}><rect width={w} height={picH} /></clipPath>
      {region && <clipPath id={`${id}-lift`}><rect x={region.x} y={region.y} width={region.width} height={region.height} /></clipPath>}
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
          {mark && <path data-mark="" d={ringPath(mark.x, mark.y, mark.width, mark.height, s.marked)}
            fill="none" stroke={tokens.mint} strokeWidth={5} strokeLinecap="round" />}
        </g>
        {region && <g data-present="" transform={`translate(${region.x + region.width / 2} ${region.y + region.height / 2}) scale(${1 + 0.16 * s.lifted}) translate(${-region.x - region.width / 2} ${-region.y - region.height / 2})`}>
          <g clipPath={`url(#${id}-lift)`}>{image}</g>
          <rect x={region.x} y={region.y} width={region.width} height={region.height} fill="none" stroke={tokens.mint} strokeWidth={4} />
        </g>}
      </g>
    </g>
    <g data-provenance="" fontFamily={HOUSE_FONTS.data} fontSize={30} fill={tokens.cream}>
      <rect x={left - 12} y={labelY} width={labelWidth + 24} height={labelH} fill={tokens.ink} />
      {labels.map((line, i) => <text key={i} x={left} y={labelY + 34 + i * 38}>{line}</text>)}
    </g>
  </svg>
}
