import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { quotaState } from './state'

/** Geometry is authored in slot pixels, independently for each aspect. */
export function chartLayout(w: number, h: number, tall: boolean) {
  return { x: w * .07, y: h * .16, width: w * .86, height: h * (tall ? .34 : .32),
    salesY: h * (tall ? .64 : .68), salesH: h * (tall ? .22 : .18) }
}
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = quotaState(object, events, frame)
  if (!s.visible) return null
  const tall = aspect === '9:16', w = box.width, h = box.height
  const {x, y, width: cw, height: ch, salesY, salesH} = chartLayout(w, h, tall)
  const base = y + ch, bw = cw / s.bins.length * .76
  const coral = tokens.channel
  const hatchId = `quota-hatch-${object.obj}`
  const tx = x + cw * s.target
  const peak = s.bars[Math.min(s.bins.length - 1, Math.floor((object.params.target as number) * s.bins.length))]!
  const px = x + peak.x * cw
  const py = base - (peak.solid + peak.junk / 2) * ch
  return <svg data-device="quota_chart" width={w} height={h} style={{position:'absolute',left:box.left,top:box.top,overflow:'hidden',background:tokens.ink,opacity:s.opacity}}>
    <defs><pattern id={hatchId} width={16} height={16} patternUnits="userSpaceOnUse"><rect width={16} height={16} fill={tokens.ink}/><path d="M -4 4 L 4 -4 M 0 16 L 16 0 M 12 20 L 20 12" stroke={coral} strokeWidth={5}/></pattern></defs>
    <g fontFamily={HOUSE_FONTS.data} fontSize={tall ? 34 : 30} fill={tokens.cream}>
      <text x={x} y={y - 90}>{s.labels.questions}</text>
      <g data-chart-bounds={`${x},${y},${cw},${ch}`}>
        <path d={`M ${x} ${y} V ${base} H ${x+cw}`} stroke={tokens.cream} strokeWidth={3} fill="none" pathLength={1} strokeDasharray={1} strokeDashoffset={1-s.enter}/>
        <text x={x} y={base+44}>0</text>
        {s.bars.map((b,i) => {
          const bx=x+b.x*cw-bw/2, solidH=b.solid*ch, junkH=b.junk*ch
          return <g key={i} data-bin={i}>
            <rect x={bx} y={base-solidH} width={bw} height={solidH} fill={tokens.cream}/>
            {junkH>0 && <rect data-junk={b.junk} x={bx} y={base-solidH-junkH} width={bw} height={junkH} fill={`url(#${hatchId})`}/>}
          </g>
        })}
      </g>
      {s.draw>0 && <g opacity={s.draw}>
        <path data-target={s.target} d={`M ${tx} ${base} V ${base-ch*s.draw}`} stroke={coral} strokeWidth={6} strokeDasharray="16 12"/>
        <g transform={`translate(${tx-145},${y-65})`}><rect width={290} height={50} fill={coral}/><text x={14} y={36} fill={tokens.ink}>{s.labels.target}: {Math.round(s.targetValue+(s.halfTargetValue-s.targetValue)*s.move)}</text></g>
      </g>}
      {s.mark>0 && peak.junk>0 && <g opacity={s.mark}>
        <text x={px-bw/2-85} y={py-55} textAnchor="end" fontFamily={HOUSE_FONTS.structure} fontSize={40} fontWeight={600}>{s.labels.junk}</text>
        <path data-leader="short" d={`M ${px-bw/2-75} ${py-45} l 75 45`} fill="none" stroke={coral} strokeWidth={4}/>
      </g>}
      {s.sales[0]!>0 && <g>
        <text x={x} y={salesY-35}>{s.labels.sales}</text>
        <path d={`M ${x} ${salesY+salesH} h ${cw}`} stroke={tokens.cream} strokeWidth={3}/>
        {s.sales.map((v,i)=>{
          const bx=x+cw*(i ? .55 : .06), bh=v/(1+s.salesLift)*salesH
          return <g key={i}>
            <rect data-sales={i} x={bx} y={salesY+salesH-bh} width={cw*.35} height={bh} fill={i ? tokens.mint : tokens.cream}/>
            <text x={bx} y={salesY+salesH+48}>{i ? 'Half target' : 'Old target'}</text>
            {i===1 && s.lift>0 && <text x={bx+cw*.175} y={salesY+salesH-bh-22} textAnchor="middle" fontFamily={HOUSE_FONTS.display} fontSize={140} fill={tokens.mint}>+{Number((s.salesLift*s.lift*100).toFixed(2))}%</text>}
          </g>
        })}
      </g>}
      <text x={x} y={h-36}>{s.source}</text>
    </g>
  </svg>
}
