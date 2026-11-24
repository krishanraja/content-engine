import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { wrapWords } from '../../../house/metrics'
import { drift, progress } from '../../clock'
import { isRegion } from '../../kit/layout'
import { RegionFit } from '../../kit/regionFit'
import type { DeviceProps } from '../types'
import { BADGE, BADGE_PITCH, badgeGridPosition, dotGridPosition, UnitMark } from './grid'
import { ParamsSchema, PLANE } from './schema'
import { CHANGE_FRAMES, unitFieldState } from './state'

export { dotGridPosition, UnitMark } from './grid'

/** The additive unit chart as Krish saw it in the Mon 2 Nov jobs piece (kept as it is: Krish, 2026-11-20): the source line
 *  on top, the giant numeral bound to the grid's own state, and the badges on a plane in slight 3D, right of centre.
 *  9:16: in the band panel, the grid at about 60%, the numeral 230 px; 16:9: in the 1312 px pillar panel, about 72%. */
export const BOARD = {
  '9:16': { natural: { width: 1080, height: 1000 }, pad: 72, source: 22, gridLeft: 0.5, gridScale: 0.6 },
  '16:9': { natural: { width: 1312, height: 1080 }, pad: 96, source: 22, gridLeft: 0.49, gridScale: 0.72 },
} as const

function UnitBoard({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = unitFieldState(object, events, frame)
  if (!s.visible) return null
  const region = isRegion(box)
  const layout = BOARD[aspect]
  const w = region ? layout.natural.width : box.width, h = region ? layout.natural.height : box.height
  const capacity = Math.max(s.marks.length, ...events.filter(e => e.obj === object.obj && e.atFrame < object.toFrame)
    .map(e => unitFieldState(object, events, e.atFrame).marks.length))
  const columns = Math.min(s.columns, capacity)
  const rows = Math.ceil(capacity / columns)
  const badge = s.mark === 'badge'
  const pitchX = badge ? BADGE_PITCH.x : 64, pitchY = badge ? BADGE_PITCH.y : 64
  const gridW = columns * pitchX - (badge ? BADGE.gap : 0), gridH = rows * pitchY - (badge ? BADGE.gap : 0)
  const numeralPx = s.counter?.numeralPx ?? 230
  const value = Math.round(s.counted)
  const top = layout.pad + numeralPx * 0.75
  const areaW = w * (1 - layout.gridLeft) - layout.pad * 0.5, areaH = h - top - layout.pad
  const scale = Math.min(areaW / gridW, areaH / gridH, layout.gridScale) * (1 + drift(frame, object.fromFrame, object.toFrame, 2))
  const plane = s.plane === true ? PLANE : s.plane ? { ...PLANE, ...s.plane } : null
  const mono = { fontFamily: HOUSE_FONTS.data, letterSpacing: '0.06em', textTransform: 'uppercase' } as const
  const drawing = <div data-device="unit_field" data-count={Number(s.count.toFixed(2))} data-counted={value}
    data-denominator={s.denominator ?? undefined}
    style={{ position: 'absolute', left: region ? 0 : box.left, top: region ? 0 : box.top, width: w, height: h, overflow: 'hidden', opacity: s.opacity }}>
    <div style={{ ...mono, position: 'absolute', left: layout.pad, top: layout.pad, fontSize: layout.source, color: tokens.cream, opacity: 0.75, whiteSpace: 'nowrap' }}>{s.producer}</div>
    <div data-counter style={{ position: 'absolute', left: layout.pad - numeralPx * 0.03, top: layout.pad + layout.source + 8, fontFamily: HOUSE_FONTS.display,
      fontSize: numeralPx, lineHeight: 0.88, color: tokens.cream, whiteSpace: 'nowrap' }}>{s.marks.some(m => m.stripe > 0) || s.counter?.of !== 'striped' ? `${value}${s.counter?.suffix ?? ''}` : ''}</div>
    <div style={{ position: 'absolute', left: w * layout.gridLeft, top, width: gridW, height: gridH, transformOrigin: '0 0',
      transform: `scale(${scale})` }}>
      <div style={{ width: gridW, height: gridH, transformOrigin: '50% 50%',
        transform: plane ? `perspective(${plane.perspective}px) rotateX(${plane.rotateX}deg) rotateZ(${plane.rotateZ}deg) skewX(${plane.skewX}deg)` : undefined }}>
      <svg width={gridW} height={gridH + 8} style={{ overflow: 'visible' }}>
        {s.marks.map(m => {
          if (m.amount <= 0) return null
          const at = badge ? badgeGridPosition(m.id, columns) : dotGridPosition(m.id, columns)
          const ox = badge ? 0 : 32, oy = badge ? 0 : 32
          return <g key={m.id} data-unit={m.id} data-stripe={m.stripe > 0 ? 1 : undefined} data-grey={m.grey > 0 ? 1 : undefined}
            transform={`translate(${at.x + ox} ${at.y + oy + 48 * m.drop})`} opacity={m.birth * (1 - m.drop)}>
            <g opacity={1 - m.grey}><UnitMark kind={s.mark} weight={m.weight} colour={tokens.cream} soft={tokens.ink}
              stripe={m.stripe} stripeColour={tokens.channel} shadow={tokens.inkDeep} /></g>
            {m.grey > 0 && <g opacity={m.grey * 0.32}><UnitMark kind={s.mark} weight={m.weight} colour={tokens.cream} soft={tokens.ink}
              stripe={m.stripe} stripeColour={tokens.cream} /></g>}
          </g>
        })}
      </svg>
      </div>
    </div>
  </div>
  return region ? <RegionFit natural={layout.natural} box={box}>{drawing}</RegionFit> : drawing
}

export function Device(props: DeviceProps) {
  const params = ParamsSchema.parse(props.object.params)
  // The badge board (badges, a plane, or a bound hero counter); every other unit field draws exactly as before.
  if (params.mark === 'badge' || params.plane || params.counter) return <UnitBoard {...props} />
  const { object, events, box, tokens, aspect, frame } = props
  const s = unitFieldState(object, events, frame)
  if (!s.visible) return null
  const region = isRegion(box)
  // Natural region size contains all slots, including the holes that carry the original denominator.
  const capacity = Math.max(s.marks.length, ...events.filter(e => e.obj === object.obj && e.atFrame < object.toFrame)
    .map(e => unitFieldState(object, events, e.atFrame).marks.length))
  const columns = Math.min(s.columns, capacity)
  const rows = Math.ceil(capacity / columns)
  const contentW = Math.max(columns * 64 + 48, 480)
  const credits = wrapWords('mono', s.producer, 30, contentW - 48)
  const units = wrapWords('mono', s.unit, 30, contentW - 48)
  const extraH = (credits.length + units.length - 2) * 38
  const natural = { width: contentW, height: rows * 64 + 240 + extraH }
  const w = region ? natural.width : box.width, h = region ? natural.height : box.height
  const contentH = rows * 64 + 220 + extraH
  const scale = region ? 1 : Math.min((w * .82) / contentW, (h * (aspect === '9:16' ? .48 : .78)) / contentH)
  const push = 1 + drift(frame, object.fromFrame, object.toFrame, 2)
  const x = region ? w / 2 : w * .46
  const y = region ? h / 2 : h * (aspect === '9:16' ? .37 : .46)
  const count = Number(s.count.toFixed(2))
  const drawing = <svg data-device="unit_field" data-count={count} data-denominator={s.denominator ?? undefined}
    width={w} height={h} style={{ position: 'absolute', left: region ? 0 : box.left, top: region ? 0 : box.top, overflow: 'hidden', opacity: s.opacity }}>
    <g transform={`translate(${x} ${y}) scale(${scale * push}) translate(${-contentW / 2} ${-contentH / 2})`}>
      <text x={24} y={100} fontFamily={HOUSE_FONTS.display} fontSize={100} fill={tokens.cream}>{count}</text>
      {units.map((line, i) => <text key={i} x={24} y={146 + i * 38} fontFamily={HOUSE_FONTS.data} fontSize={30} fill={tokens.cream}>{line.join(' ')}</text>)}
      {s.marks.map(m => {
        if (m.amount <= 0) return null
        const at = dotGridPosition(m.id, columns), from = dotGridPosition(m.source, columns)
        const travel = m.bornAt === undefined ? 1 : progress(frame - m.bornAt, CHANGE_FRAMES)
        const px = from.x + (at.x - from.x) * travel
        const py = from.y + (at.y - from.y) * travel + 48 * m.drop
        return <g key={m.id} data-unit={m.id} data-weight={m.weight} data-source={m.source}
          transform={`translate(${48 + px} ${196 + (units.length - 1) * 38 + py})`} opacity={m.birth * (1 - m.drop)}>
          <g opacity={1 - m.grey}><UnitMark kind={s.mark} weight={m.weight} colour={tokens.cream} soft={tokens.inkSoft}/></g>
          {m.grey > 0 && <g opacity={m.grey}><UnitMark kind={s.mark} weight={m.weight} colour={tokens.inkSoft} soft={tokens.inkSoft}/></g>}
        </g>
      })}
      {credits.map((line, i) => <text key={i} x={24} y={contentH - 6 - (credits.length - 1 - i) * 38} fontFamily={HOUSE_FONTS.data} fontSize={30} fill={tokens.cream}>{line.join(' ')}</text>)}
    </g>
  </svg>
  return region ? <RegionFit natural={natural} box={box}>{drawing}</RegionFit> : drawing
}
