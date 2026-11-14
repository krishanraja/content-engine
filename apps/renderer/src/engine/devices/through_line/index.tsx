import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { drift } from '../../clock'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'
import { throughLineState } from './state'

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = throughLineState(object, events, frame)
  if (!s.visible) return null
  const p = ParamsSchema.parse(object.params)
  const tall = aspect === '9:16', w = box.width, h = box.height
  const left = w * .12, right = w * (tall ? .74 : .83)
  const top = h * (tall ? .28 : .25), bottom = h * (tall ? .72 : .69)
  const y = (i: number) => bottom - i * (bottom - top) / Math.max(1, s.parts.length - 1)
  const focused = s.parts.find(part => part.id === s.focus)
  const cameraWeight = s.camera.reduce((sum, v) => sum + v, 0)
  const cameraY = s.camera.reduce((sum, v, i) => sum + v * y(i), 0)
  const scale = 1 + cameraWeight * .12 + drift(frame, object.fromFrame, object.toFrame, .5)
  const shift = .12 * (cameraWeight * h * .45 - cameraY)
  const maxSize = Math.max(1, ...p.parts.map(part => part.size), ...Object.values(p.states).filter(c => c.verb === 'grow').map(c => c.size))
  const number = focused && focused.opacity > 0 ? focused.number : undefined
  const focusY = y(s.parts.findIndex(part => part.id === s.focus))
  const annotationY = y(s.parts.findIndex(part => part.id === s.annotationPart))
  const screenY = (py: number) => h * .45 + shift + (py - h * .45) * scale
  return <svg data-device="through_line" data-object={s.obj} width={w} height={h}
    style={{ position: 'absolute', left: box.left, top: box.top, overflow: 'hidden', opacity: s.opacity }}>
    <g transform={`translate(${w / 2} ${h * .45 + shift}) scale(${scale}) translate(${-w / 2} ${-h * .45})`}>
      <path d={`M${left} ${top}V${bottom}M${right} ${top}V${bottom}`} stroke={tokens.cream} strokeWidth={4} fill="none" opacity={.4}/>
      {s.parts.map((part, i) => {
        const py = y(i), colour = part.lit > 0 ? tokens.mint : tokens.cream
        const capacity = Math.min(1000, p.parts[i]!.count * events.filter(e => e.obj === object.obj).reduce((n, e) => {
          const c = p.states[e.toState]
          return c?.part === part.id && c.verb === 'multiply' ? n * Math.max(1, c.factor) : n
        }, 1))
        const columns = tall ? 10 : 16, spacing = (right - left) / columns
        return <g key={part.id} data-part={part.id} data-kind={part.kind} opacity={part.opacity}>
          {part.kind === 'units' ? Array.from({ length: Math.ceil(capacity) }, (_, j) => {
            // The final partial mark preserves area exactly; never round a count up.
            const fraction = Math.max(0, Math.min(1, part.count - j))
            return <circle key={j} data-unit={j} data-fraction={fraction} cx={left + spacing * (j % columns + .5)}
              cy={py - Math.floor(j / columns) * 20} r={8 * Math.sqrt(fraction)} fill={colour}/>
          }) : <rect x={left} y={part.kind === 'bar' ? py - 22 : py - 4 * part.thickness}
            width={(right - left) * (part.kind === 'bar' ? part.size / maxSize : 1)}
            height={part.kind === 'bar' ? 22 : 8 * part.thickness} fill={colour}/>}
          <text x={left} y={py + 38} fill={tokens.cream} fontFamily={HOUSE_FONTS.dek} fontSize={30}>{part.label}</text>
        </g>
      })}
      {s.connections.map((line, i) => {
        const a = s.parts.findIndex(p => p.id === line.from), b = s.parts.findIndex(p => p.id === line.to)
        return <line key={i} data-connection={`${line.from}:${line.to}`} x1={right} x2={right}
          y1={y(a)} y2={y(a) + (y(b) - y(a)) * line.amount} stroke={tokens.mint} strokeWidth={5}/>
      })}
      {number && <g data-number-on={focused!.id}>
        <text x={left + 16} y={focusY - 16} fill={tokens.cream} fontFamily={HOUSE_FONTS.display} fontSize={tall ? 96 : 112}>
          {Number(number.value.toFixed(2))}{number.unit}
        </text>
        <path d={`M${left} ${focusY - 6}H${left + w * .24}`} stroke={tokens.channel} strokeWidth={5}/>
      </g>}
    </g>
    {number && <g>
      <text x={left} y={h * .94} fill={tokens.cream} fontFamily={HOUSE_FONTS.data} fontSize={30}>{number.producer} · {number.date}</text>
    </g>}
    {s.annotation && <g>
      <path d={`M${right} ${h * .82}L${w / 2 + (right - w / 2) * scale} ${screenY(annotationY)}`} stroke={tokens.cream} strokeWidth={2}/>
      <text x={left} y={h * .86} fill={tokens.cream} fontFamily={HOUSE_FONTS.dek} fontSize={32}>{s.annotation}</text>
    </g>}
  </svg>
}
