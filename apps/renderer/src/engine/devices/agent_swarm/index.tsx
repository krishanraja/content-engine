import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { swarmState } from './state'

const SIZE = 72
/** Decimal reels carry independently, and land on the exact sourced integer. */
function Odometer({ value, position, x, y, color }: { value: number; position: number; x: number; y: number; color: string }) {
  const label = value.toLocaleString('en-US')
  const chars = [...label]
  const width = chars.reduce((sum, c) => sum + (c === ',' ? 35 : 88), 0)
  let offset = 0
  return <svg x={x - width / 2} y={y} width={width} height={210} overflow="hidden" data-token-value={label} aria-label={label}>
    {chars.map((c, i) => {
      const left = offset; offset += c === ',' ? 35 : 88
      const power = chars.slice(i + 1).filter(v => v !== ',').length
      const reel = position / 10 ** power
      // A real odometer: the last reel turns continuously; a higher reel turns only while every reel below it
      // rolls over from 9, so a frame never shows every digit half-way between two numbers.
      const below = position % 10 ** power
      const fraction = power === 0 ? reel - Math.floor(reel) : Math.max(0, below - (10 ** power - 1))
      return c === ',' ? <text key={i} x={left} y={174} fontSize={180} fill={color} fontFamily={HOUSE_FONTS.display}>,</text> :
        <svg key={i} x={left} width={88} height={210} overflow="hidden">
          <g transform={`translate(0 ${-fraction * 210})`} fill={color} fontFamily={HOUSE_FONTS.display} fontSize={180}>
            <text x={0} y={174}>{Math.floor(reel) % 10}</text>
            <text x={0} y={384}>{(Math.floor(reel) + 1) % 10}</text>
          </g>
        </svg>
    })}
  </svg>
}

/** The comment stays the same object through the work, the climb and the rejection. */
export function Device(props: DeviceProps) {
  const s = swarmState(props)
  if (!s) return null
  const { box, tokens, aspect, object } = props
  const tall = aspect === '9:16'
  const w = box.width, h = box.height
  const cx = w * (tall ? 0.5 : 0.30), cy = h * (tall ? 0.32 : 0.43)
  const bw = w * (tall ? 0.66 : 0.40), bh = h * (tall ? 0.19 : 0.32)
  const rx = bw / 2 + 72, ry = bh / 2 + 94
  const mx = w * (tall ? 0.5 : 0.76), my = h * (tall ? 0.65 : 0.31)
  // This Friday card explicitly assigns the series token to its coral motion marks.
  const coral = tokens.channel
  const muted = s.marked ? tokens.inkSoft : coral
  const robotInk = s.marked ? tokens.inkSoft : tokens.ink
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden' }}>
    <g opacity={s.enter * (1 - s.out)}>
      <g data-greyed={s.marked} style={{ filter: s.marked ? 'grayscale(1)' : undefined }}>
        {s.agents.map(a => {
          const angle = a.i / Math.max(1, s.params.agents) * Math.PI * 2
          const phase = s.work * Math.PI * 12 + a.i * 1.7
          const peck = 4 * Math.sin(phase)
          const point = (p: number) => {
            const spiral = angle + (1 - p) * Math.PI * 2
            const radius = 1 + (1 - p) * 5
            return { x: cx + Math.cos(spiral) * (rx * radius - peck * p), y: cy + Math.sin(spiral) * (ry * radius - peck * p) + Math.sin(phase * 0.7) * 4 * p }
          }
          const { x, y } = point(a.arrival)
          const trail = Array.from({ length: 9 }, (_, i) => point(Math.max(0, a.arrival - i * 0.025)))
          return <g key={a.i} data-agent={a.i} data-agent-size={SIZE}>
            {trail.slice(1).map((p, i) => <line key={i} x1={trail[i]!.x} y1={trail[i]!.y} x2={p.x} y2={p.y} stroke={muted} strokeWidth={8 - i * 0.7} strokeLinecap="round" opacity={(1 - a.arrival) * (1 - i / 9)} />)}
            <g transform={`translate(${x} ${y}) rotate(${Math.sin(phase) * 3 * a.arrival})`}>
              <rect x={-36} y={-36} width={72} height={72} rx={18} fill={s.marked ? tokens.inkSoft : tokens.cream} stroke={robotInk} strokeWidth={4} />
              <path d="M 0 -36 V -47 M -24 37 V 44 M 24 37 V 44" stroke={robotInk} strokeWidth={5} />
              <circle cx={0} cy={-47} r={5} fill={muted} />
              <rect x={-28} y={-19} width={56} height={30} rx={10} fill={tokens.ink} />
              <rect x={-18} y={-10} width={10} height={12} rx={3} fill={s.marked ? tokens.inkSoft : tokens.mint} />
              <rect x={8} y={-10} width={10} height={12} rx={3} fill={s.marked ? tokens.inkSoft : tokens.mint} />
              <path d="M -10 24 H 10" stroke={robotInk} strokeWidth={4} />
            </g>
          </g>
        })}
        <rect x={cx - bw / 2 + 12} y={cy - bh / 2 + 14} width={bw} height={bh} rx={24} fill={tokens.inkDeep} />
        <rect x={cx - bw / 2} y={cy - bh / 2} width={bw} height={bh} rx={24} fill={tokens.cream} stroke={tokens.ink} strokeWidth={4} />
        <path d={`M ${cx - bw * 0.3} ${cy + bh / 2 - 3} v 30 l 40 -30`} fill={tokens.cream} stroke={tokens.ink} strokeWidth={4} />
        <foreignObject x={cx - bw / 2 + 36} y={cy - bh / 2 + 32} width={bw - 72} height={bh - 64}>
          <div style={{ fontFamily: HOUSE_FONTS.dek, fontWeight: 600, fontSize: tall ? 64 : 56, lineHeight: 1.15, color: tokens.ink, overflowWrap: 'anywhere' }}>{s.text}</div>
        </foreignObject>
        <text x={mx} y={my - 18} textAnchor="middle" fill={s.marked ? tokens.inkSoft : tokens.cream} fontFamily={HOUSE_FONTS.data} fontSize={36}>{s.params.labels.meter}</text>
        <g data-meter={!s.rankMode || undefined}>
          <Odometer value={s.tokens} position={s.tokenPosition} x={mx} y={my} color={muted} />
        </g>
        {s.rankMode && <g data-rank="true" transform={`translate(${mx - 145} ${my + 240})`}>
          <rect width={290} height={90} rx={8} fill={tokens.inkDeep} stroke={tokens.inkSoft} strokeWidth={2} />
          <text x={18} y={57} fontFamily={HOUSE_FONTS.data} fontSize={30} fill={tokens.cream}>{s.params.labels.rank}</text>
          <g transform={`translate(223 45) scale(1 ${Math.max(0.08, Math.abs(Math.cos(s.rankProgress * Math.PI * Math.abs(s.params.rank.to - s.params.rank.from))))})`}>
            <text textAnchor="middle" y={19} fontFamily={HOUSE_FONTS.data} fontSize={56} fill={tokens.cream}>{s.rank}</text>
          </g>
          <path d="M 170 45 H 280" stroke={tokens.inkSoft} strokeWidth={2} />
        </g>}
        <text x={w * 0.08} y={h * 0.94} fill={tokens.cream} fontFamily={HOUSE_FONTS.data} fontSize={30}>{object.dataset?.producerLabel}</text>
      </g>
      {s.marked && <g data-strike fill="none" stroke={coral} strokeWidth={14} strokeLinecap="round">
        <path d={`M ${cx - bw * 0.46} ${cy + bh * 0.25} Q ${cx - bw * 0.1} ${cy - bh * 0.03} ${cx + bw * 0.46} ${cy - bh * 0.25}`} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - s.strike} />
        <text x={cx} y={cy + bh / 2 + 100} textAnchor="middle" stroke="none" fill={tokens.cream} fontFamily={HOUSE_FONTS.dek} fontStyle="italic" fontSize={42}>{s.params.annotation}</text>
      </g>}
    </g>
  </svg>
}
