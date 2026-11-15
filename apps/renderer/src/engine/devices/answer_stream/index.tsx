import type { CSSProperties } from 'react'
import { Img } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps, Box } from '../types'
import { answerState } from './state'

type Rect = { x: number; y: number; w: number; h: number }
const absolute: CSSProperties = { position: 'absolute' }
const rectStyle = (b: Rect): CSSProperties => ({ ...absolute, left: b.x, top: b.y, width: b.w, height: b.h })
export function answerLayout(box: Box, aspect: DeviceProps['aspect'], answer: { pixelWidth: number; pixelHeight: number }, source: { pixelWidth: number; pixelHeight: number }, light: number) {
  const tall = aspect === '9:16'
  const gap = tall ? 72 : 80
  const width = tall ? box.width - 80 : (box.width - 160) / 2
  const height = tall ? (box.height - 180) / 2 : box.height - 140
  const a = Math.min(width / answer.pixelWidth, height / answer.pixelHeight)
  const s = Math.min(width / source.pixelWidth, height / source.pixelHeight)
  return { a, s, ax: tall ? (box.width - answer.pixelWidth * a) / 2 : 40 + (1 - light) * (box.width / 2 - 40 - answer.pixelWidth * a / 2),
    ay: tall ? 40 + (1 - light) * 100 : (box.height - answer.pixelHeight * a - 60) / 2,
    sx: tall ? (box.width - source.pixelWidth * s) / 2 : 40 + width + gap,
    sy: tall ? 40 + height + gap : (box.height - source.pixelHeight * s - 60) / 2 }
}
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = answerState(object, events, frame)
  const p = state.params
  const l = answerLayout(box, aspect, p.answer, p.source, state.light)
  if (aspect === '9:16') p.lines.forEach((line, i) => {
    if (line.h * l.a < 40) throw new Error(`answer_stream line ${i} under 40 px: crop tighter, never shrink`)
  })
  if (!state.visible) return null
  const image = (src: string, width: number, height: number, style: CSSProperties = {}) =>
    <Img src={src} style={{ ...absolute, left: 0, top: 0, width, height, maxWidth: 'none', ...style }} />
  const ring = (b: Rect, amount: number) => <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={6} fill="none" stroke={tokens.mint} strokeWidth={3 / l.a} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - amount} />
  const c = p.citation, b = p.passage
  const x1 = l.ax + (c.x + c.w / 2) * l.a, y1 = l.ay + (c.y + c.h / 2) * l.a
  const x2 = l.sx + (b.x + b.w / 2) * l.s, y2 = l.sy + (b.y + b.h / 2) * l.s
  return <div data-device="answer_stream" style={{ ...absolute, left: box.left, top: box.top, width: box.width, height: box.height,
    opacity: state.enter * (1 - state.exit), transform: `translateY(${(1 - state.enter) * 48}px)` }}>
    <div data-answer="capture" style={{ ...absolute, left: l.ax, top: l.ay, width: p.answer.pixelWidth, height: p.answer.pixelHeight, transformOrigin: 'top left', transform: `scale(${l.a})` }}>
      {image(p.answer.src, p.answer.pixelWidth, p.answer.pixelHeight)}
      {p.lines.map((line, i) => {
        const revealed = state.revealed[i]! / line.chars
        return <div key={i} data-covered={i} style={{ ...rectStyle({ ...line, x: line.x + line.w * revealed, w: line.w * (1 - revealed) }), overflow: 'hidden' }}>
          {image(p.answer.src, p.answer.pixelWidth, p.answer.pixelHeight, {
            width: p.answer.pixelWidth * line.w / p.blank.w, height: p.answer.pixelHeight * line.h / p.blank.h,
            left: -p.blank.x * line.w / p.blank.w - line.w * revealed, top: -p.blank.y * line.h / p.blank.h })}
        </div>
      })}
      {state.marked && <div style={{ ...rectStyle(c), transform: `scale(${state.pop})`, overflow: 'hidden' }}>
        {image(p.answer.src, p.answer.pixelWidth, p.answer.pixelHeight, { left: -c.x, top: -c.y })}
      </div>}
      <svg style={{ ...absolute, inset: 0, overflow: 'visible' }} width={p.answer.pixelWidth} height={p.answer.pixelHeight}>{ring(c, state.ring)}</svg>
    </div>
    {state.light > 0 && <div data-source="capture" style={{ ...absolute, left: l.sx, top: l.sy + (1 - state.light) * 48, width: p.source.pixelWidth, height: p.source.pixelHeight,
      transformOrigin: 'top left', transform: `scale(${l.s})`, opacity: state.light }}>
      {image(p.source.src, p.source.pixelWidth, p.source.pixelHeight, { opacity: 0.4 })}
      <div data-passage="proof" style={{ ...rectStyle(b), overflow: 'hidden' }}>
        {image(p.source.src, p.source.pixelWidth, p.source.pixelHeight, { left: -b.x, top: -b.y })}
        <div style={{ ...absolute, inset: 0, background: tokens.mint, opacity: 0.2 }} />
      </div>
      <svg style={{ ...absolute, inset: 0, overflow: 'visible' }} width={p.source.pixelWidth} height={p.source.pixelHeight}>{ring(b, state.hairline)}</svg>
    </div>}
    <svg width={box.width} height={box.height} style={{ ...absolute, inset: 0, pointerEvents: 'none' }}>
      <path d={`M ${x1} ${y1} L ${x2} ${y2}`} fill="none" stroke={tokens.mint} strokeWidth={1.5} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - state.hairline} />
    </svg>
    <div style={{ ...absolute, left: 40, right: 40, bottom: 24, fontFamily: HOUSE_FONTS.data, fontSize: 24, color: tokens.cream, overflowWrap: 'anywhere' }}>{p.label}</div>
  </div>
}
