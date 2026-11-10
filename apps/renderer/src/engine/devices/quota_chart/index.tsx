import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { quotaState } from './state'

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = quotaState(object, events, frame)
  if (!s.visible) return null
  const tall = aspect === '9:16'
  const w = box.width, h = box.height, pad = 36
  const chartW = tall ? w - pad * 2 : (w - pad * 3) * 0.64
  const chartH = tall ? h * 0.38 : h * 0.6
  const x = pad, y = pad + 90, base = y + chartH
  const salesX = tall ? pad : chartW + pad * 2
  const salesY = tall ? base + 150 : y
  const salesW = tall ? w - pad * 2 : w - salesX - pad
  const salesH = tall ? h * 0.19 : chartH
  const bw = chartW / s.bins.length * 0.76
  const grey = `color-mix(in srgb, ${tokens.cream} 40%, ${tokens.ink})`
  return <svg data-device="quota_chart" width={w} height={h} style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden', background: tokens.ink, opacity: s.opacity }}>
    <g fontFamily={HOUSE_FONTS.data} fontSize={30} fill={tokens.cream}>
      <text x={pad} y={pad + 32}>{s.labels.questions}</text>
      <path d={`M ${x} ${y} V ${base} H ${x + chartW}`} fill="none" stroke={tokens.cream} strokeWidth={3} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - s.enter}/>
      <text x={x} y={base + 38}>0</text>
      {s.bars.map((b, i) => {
        // Stable bar identities retain their useful portion through the target change.
        const bx = x + b.x * chartW - bw / 2
        if (bx < x || bx + bw > x + chartW) return null
        const solidH = b.solid * chartH, junkH = b.junk * chartH
        return <g key={i} data-bin={i}>
          <rect x={bx} y={base - solidH} width={bw} height={solidH} fill={tokens.cream}/>
          {junkH > 0 && <g data-junk={b.junk}>
            <rect x={bx} y={base - solidH - junkH} width={bw} height={junkH} fill={grey}/>
            {Array.from({ length: Math.ceil(junkH / 10) }, (_, k) => <path key={k} d={`M ${bx} ${base - solidH - k * 10} l ${bw} ${-Math.min(8, junkH - k * 10)}`} stroke={tokens.ink} strokeWidth={2}/>)}
            <path d={`M ${bx} ${base - solidH - junkH / 2} h ${bw}`} stroke={tokens.cream} strokeWidth={2}/>
          </g>}
        </g>
      })}
      <path data-target={s.target} d={`M ${x + chartW * s.target} ${base} v ${-chartH * s.draw}`} stroke={tokens.cream} strokeWidth={4} strokeDasharray="10 8"/>
      {s.draw > 0 && <text x={Math.max(x, Math.min(x + chartW * s.target, x + chartW - 240))} y={y - 14}>{s.labels.target}</text>}
      {s.mark > 0 && s.move < 1 && <g opacity={s.mark * (1 - s.move)}>
        <text x={x} y={base + 85}>{s.labels.junk}</text>
        <path d={`M ${x + 100} ${base + 50} L ${x + chartW * s.target} ${base - chartH * (1 - s.junkShare / 2)}`} stroke={grey} strokeWidth={3}/>
      </g>}
      {s.sales[0]! > 0 && <g>
        <text x={salesX} y={salesY - 20}>{s.labels.sales}</text>
        <path d={`M ${salesX} ${salesY} V ${salesY + salesH} h ${salesW}`} stroke={tokens.cream} fill="none" strokeWidth={3}/>
        {s.sales.map((v, i) => {
          const barH = v / (1 + s.salesLift) * (salesH - 70)
          const bx = salesX + salesW * (i === 0 ? 0.12 : 0.58)
          return <g key={i}><rect data-sales={i} x={bx} y={salesY + salesH - barH} width={salesW * 0.22} height={barH} fill={i ? tokens.mint : tokens.cream}/>
            <text x={bx} y={salesY + salesH + 38}>{i ? s.halfTarget : object.params.target as number}</text>
            {i === 1 && s.lift > 0 && <g><rect x={bx - 6} y={salesY + salesH - barH - 46} width={150} height={40} fill={tokens.mint}/><text x={bx} y={salesY + salesH - barH - 14} fill={tokens.ink}>+{Number((s.salesLift * s.lift * 100).toFixed(2))}%</text></g>}
          </g>
        })}
      </g>}
      <text x={pad} y={h - pad}>{s.source}</text>
    </g>
  </svg>
}
