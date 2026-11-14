import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { wrapWords } from '../../../house/metrics'
import { drift, progress } from '../../clock'
import { isRegion } from '../../kit/layout'
import { RegionFit } from '../../kit/regionFit'
import type { DeviceProps } from '../types'
import { dotGridPosition, UnitMark } from './grid'
import { CHANGE_FRAMES, unitFieldState } from './state'

export { dotGridPosition, UnitMark } from './grid'
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
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
