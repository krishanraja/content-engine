import React from 'react'
import { font } from '../../kit/typeRole'
import type { DeviceProps } from '../types'
import { swarmState } from './state'

/** The same comment remains underneath the work and the final strike. */
export function Device(props: DeviceProps) {
  const s = swarmState(props)
  if (!s) return null
  const { box, tokens, aspect, object } = props
  const tall = aspect === '9:16'
  const w = box.width, h = box.height
  const cx = w * (tall ? 0.5 : 0.38), cy = h * (tall ? 0.36 : 0.44)
  const bw = w * (tall ? 0.66 : 0.46), bh = h * (tall ? 0.22 : 0.30)
  const rx = w * (tall ? 0.39 : 0.29), ry = h * (tall ? 0.24 : 0.34)
  const size = Math.min(w * 0.045, h * 0.05)
  const mx = tall ? w * 0.17 : w * 0.73, my = tall ? h * 0.74 : h * 0.36
  const value = s.rankMode ? s.rank : s.tokens
  const ink = s.marked ? tokens.inkSoft : tokens.ink
  return <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden' }}>
    <g opacity={s.enter * (1 - s.out)}>
      <g data-greyed={s.marked} style={{ filter: s.marked ? 'grayscale(1)' : undefined }}>
        {s.agents.map(a => {
          const angle = a.i / Math.max(1, s.params.agents) * Math.PI * 2 + s.work * Math.PI * 2
          const peck = Math.sin(s.work * Math.PI * 8 + a.i) * s.work * 0.06
          const tx = cx + Math.cos(angle) * rx * (1 - peck), ty = cy + Math.sin(angle) * ry * (1 - peck)
          const x = (a.i < s.params.agents / 2 ? size : w - size) * (1 - a.arrival) + tx * a.arrival
          const y = size * (1 - a.arrival) + ty * a.arrival
          return <g key={a.i} data-agent={a.i} opacity={a.arrival}>
            <line x1={x} y1={y} x2={cx} y2={cy} stroke={tokens.inkSoft} strokeWidth={2} />
            <g transform={`translate(${x} ${y})`}>
              <path d={`M ${-size / 2} ${-size / 2} L ${size / 2} 0 L 0 ${size / 4} L ${-size / 4} ${size / 2} Z`} fill={tokens.cream} stroke={ink} strokeWidth={3} />
              <rect x={-size * 0.42} y={-size * 0.65} width={size * 0.84} height={size * 0.5} rx={size * 0.12} fill={tokens.cream} stroke={ink} strokeWidth={3} />
              <circle cx={-size * 0.18} cy={-size * 0.4} r={size * 0.06} fill={ink} /><circle cx={size * 0.18} cy={-size * 0.4} r={size * 0.06} fill={ink} />
            </g>
          </g>
        })}
        <rect x={cx - bw / 2} y={cy - bh / 2} width={bw} height={bh} rx={28} fill={tokens.cream} stroke={tokens.inkSoft} strokeWidth={2} />
        <path d={`M ${cx - bw * 0.3} ${cy + bh / 2 - 2} l 0 24 l 32 -24`} fill={tokens.cream} stroke={tokens.inkSoft} strokeWidth={2} />
        <foreignObject x={cx - bw / 2 + 24} y={cy - bh / 2 + 20} width={bw - 48} height={bh - 40}>
          <div style={{ fontFamily: font('structure'), fontSize: 44, lineHeight: 1.2, color: ink, overflowWrap: 'anywhere' }}>{s.text}</div>
        </foreignObject>
        <text x={mx} y={my} fill={tokens.cream} fontFamily={font('data')} fontSize={30}>{s.rankMode ? s.params.labels.rank : s.params.labels.meter}</text>
        <g style={{ transformOrigin: `${mx}px ${my + 64}px`, transform: `rotateX(${s.rankMode ? Math.sin(s.rankProgress * Math.PI * 8) * (1 - s.rankProgress) * 70 : 0}deg)` }}>
          <text data-meter={!s.rankMode || undefined} data-rank={s.rankMode || undefined} x={mx} y={my + 110} fill={tokens.cream} fontFamily={font('display')} fontSize={100}>{value}</text>
        </g>
        <text x={w * 0.08} y={h * 0.94} fill={tokens.cream} fontFamily={font('data')} fontSize={30}>{object.dataset?.producerLabel}</text>
      </g>
      {s.marked && <g data-strike fill="none" stroke={tokens.cream} strokeWidth={8} strokeLinecap="round">
        <path d={`M ${cx - bw * 0.46} ${cy + bh * 0.25} Q ${cx} ${cy - bh * 0.12} ${cx + bw * 0.46} ${cy - bh * 0.25}`} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - s.strike} />
        <text x={cx} y={cy + bh * 0.85} textAnchor="middle" stroke="none" fill={tokens.cream} fontFamily={font('dek')} fontStyle="italic" fontSize={42}>{s.params.annotation}</text>
      </g>}
    </g>
  </svg>
}
