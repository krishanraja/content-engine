import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { drift } from '../../clock'
// @ts-ignore Shared deterministic move arithmetic has no TypeScript declarations.
import { lerp } from '../../../../../../packages/moves/_kit.mjs'
import type { DeviceProps } from '../types'
import { creditState } from './state'

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = creditState(object, events, frame)
  if (!s.visible) return null
  const tall = aspect === '9:16', w = box.width, h = box.height
  const x = w * .055, y = h * .18, tw = w * (tall ? .58 : .62), th = h * .68
  const base = th * s.base / s.capacity, extra = th * s.extra / s.capacity
  const surface = y + th - base - extra, boundary = y + th - base
  const push = drift(frame, object.fromFrame, object.toFrame, .7)
  const shimmer = drift(frame, object.fromFrame, object.toFrame, 100)
  const id = `credit-${object.obj.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  const size = Math.min(tall ? 68 : 84, w / 13, h * .1)
  const mono = Math.min(30, w / 30, h * .042)
  return <svg data-device="credit_meter" data-level={(s.base + s.extra) / s.capacity}
    width={w} height={h} style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden' }}>
    <defs>
      <linearGradient id={`${id}-glass`}><stop stopColor={tokens.cream} stopOpacity=".22"/><stop offset=".3" stopColor={tokens.inkDeep} stopOpacity=".4"/><stop offset="1" stopColor={tokens.cream} stopOpacity=".15"/></linearGradient>
      <linearGradient id={`${id}-liquid`} x2="1" y2=".5"><stop stopColor={tokens.cream} stopOpacity=".72"/><stop offset=".6" stopColor={tokens.inkSoft}/><stop offset="1" stopColor={tokens.cream} stopOpacity=".9"/></linearGradient>
      <clipPath id={`${id}-clip`}><rect x={x} y={y} width={tw} height={th} rx={20}/></clipPath>
    </defs>
    <g opacity={s.opacity} transform={`translate(${w / 2} ${h / 2 + (1 - s.opacity) * 30}) scale(${1 + push}) translate(${-w / 2} ${-h / 2})`}>
      <text x={x} y={h * .1} fill={tokens.cream} fontFamily={HOUSE_FONTS.display} fontSize={size} data-total="">{s.value.toLocaleString('en-US')} {s.unit}</text>
      <rect x={x + 8} y={y + 9} width={tw} height={th} rx={20} fill={tokens.inkDeep}/>
      <rect x={x} y={y} width={tw} height={th} rx={20} fill={`url(#${id}-glass)`} stroke={tokens.cream} strokeWidth={3}/>
      <g clipPath={`url(#${id}-clip)`}>
        <rect data-plan-level={s.base} x={x} y={boundary} width={tw} height={base} fill={`url(#${id}-liquid)`}/>
        <rect data-bonus-level={s.extra} x={x} y={surface} width={tw} height={extra} fill={tokens.channel}/>
        {(base + extra > 0) && <path d={`M${x} ${surface + 5} Q${lerp(x + tw * .2, x + tw * .8, shimmer)} ${surface - 8} ${x + tw} ${surface + 5}`} fill="none" stroke={tokens.cream} strokeWidth={5} opacity={.7}/>}
        {Array.from({ length: 9 }, (_, i) => <line key={i} x1={x + tw * (.1 + i * .1)} x2={x + tw * (.1 + i * .1) + shimmer * 8} y1={surface + 12} y2={y + th} stroke={tokens.cream} opacity={.035 + ((Math.imul(frame + 1, i + 7) >>> 0) / 4294967296) * .02}/>)}
        <path d={`M${x + 14} ${y + 16}V${y + th - 18}`} stroke={tokens.cream} strokeWidth={8} opacity={.25}/>
      </g>
      {Array.from({ length: 11 }, (_, i) => <line key={i} x1={x + tw - 22} x2={x + tw - 5} y1={y + th * i / 10} y2={y + th * i / 10} stroke={tokens.cream} opacity={.6}/>)}
      <g fill={tokens.cream} fontFamily={HOUSE_FONTS.data} fontSize={mono}>
        {base > 0 && <text x={x + 28} y={y + th - 28}>{s.params.plan.label}</text>}
        {extra > 0 && <text x={x + 28} y={Math.min(boundary - 12, surface + mono + 12)}>{s.params.bonus.label}</text>}
        <text x={x + tw + 18} y={y + 36}>Day {s.day}</text>
        <text x={x} y={h * .93}>{s.producer}</text>
        <text x={x} y={h * .98}>{s.params.source.outlet} · {s.params.source.date}</text>
      </g>
      {s.params.src && s.mark > 0 && <g opacity={s.mark} transform={`translate(${(1 - s.mark) * 24} 0)`}>
        <path d={`M${x + tw} ${surface + extra / 2}H${w * .72}V${y + th * .4}`} fill="none" stroke={tokens.mint} strokeWidth={3}/>
        <image href={s.params.src} x={w * .66} y={y + th * .4} width={w * .32} height={th * .28} preserveAspectRatio="xMidYMid meet"/>
        <rect x={w * .66} y={y + th * .4} width={w * .32} height={th * .28} rx={12} fill="none" stroke={tokens.mint} strokeWidth={3}/>
      </g>}
    </g>
  </svg>
}
