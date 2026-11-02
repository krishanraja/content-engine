import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { EXIT, MOTION, progress, stateAt } from '../../clock'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'

const linear = (t: number) => t
export function bubbleState({ object, events, frame }: Pick<DeviceProps, 'object' | 'events' | 'frame'>) {
  const params = ParamsSchema.parse(object.params)
  const fired = stateAt(events, object.obj, frame).fired
  const enter = fired.filter(e => e.verb === 'enter').at(-1)
  if (!enter) return null
  const active = fired.filter(e => e.atFrame >= enter.atFrame)
  const exit = active.filter(e => e.verb === 'exit').at(-1)
  const out = exit ? progress(frame - exit.atFrame, MOTION.exitFrames, EXIT) : 0
  if (out >= 1) return null
  const pick = active.filter(e => e.verb === 'pick').at(-1)
  const index = (value: string, count: number) => {
    if (!/^\d+$/.test(value) || Number(value) >= count) throw new Error('typing_bubble event needs a valid zero-based index')
    return Number(value)
  }
  for (const e of active.filter(e => e.verb === 'type')) index(e.toState, params.rows.length)
  const picked = pick ? index(pick.toState, params.kind === 'choice' ? params.options!.length : 0) : null
  const send = active.filter(e => e.verb === 'send').at(-1)
  return { params, out, enter: progress(frame - enter.atFrame, MOTION.enterFrames), picked,
    pickProgress: pick ? progress(frame - pick.atFrame, MOTION.slapFrames) : 0,
    sent: !!send, sendProgress: send ? progress(frame - send.atFrame, MOTION.slapFrames) : 0,
    rows: params.rows.map((row, i) => {
      const cue = active.filter(e => e.verb === 'type' && Number(e.toState) === i).at(-1)
      if (!cue) return { ...row, text: '', visible: false, dots: false }
      // The next cue bounds the span; unrelated objects cannot alter typing speed.
      const end = Math.min(object.toFrame, ...events.filter(e => e.obj === object.obj && e.atFrame > cue.atFrame).map(e => e.atFrame))
      const span = Math.max(1, end - cue.atFrame)
      const lead = params.kind === 'chat' ? Math.min(MOTION.staggerFrames, span / 4) : 0
      const p = progress(frame - cue.atFrame - lead, Math.max(1, span - lead), linear)
      return { ...row, text: Array.from(row.text).slice(0, Math.floor(Array.from(row.text).length * p)).join(''),
        visible: true, dots: frame < cue.atFrame + lead }
    }),
  }
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = bubbleState({ object, events, frame })
  if (!s) return null
  const tall = aspect === '9:16'
  const size = tall ? 32 : 30
  const width = box.width * (tall ? 0.88 : 0.64)
  return <div data-kind={s.params.kind} style={{ position: 'absolute', left: box.left + (box.width - width) / 2,
    top: box.top + box.height * (tall ? 0.16 : 0.1), width, boxSizing: 'border-box', padding: tall ? 36 : 30,
    borderRadius: 28, background: tokens.cream, color: tokens.ink, border: `1px solid ${tokens.inkSoft}`,
    boxShadow: `0 14px 32px color-mix(in srgb, ${tokens.inkDeep} 18%, transparent)`,
    fontFamily: HOUSE_FONTS.structure, fontSize: size, opacity: s.enter * (1 - s.out),
    transform: `translateY(${(1 - s.enter) * 30 + s.out * 80}px)` }}>
    {s.rows.map((row, i) => row.visible && <div key={i} data-row={i} style={{ display: 'flex',
      justifyContent: row.side === 'right' ? 'flex-end' : 'flex-start', marginBottom: 16 }}>
      <div style={{ maxWidth: '92%', padding: s.params.kind === 'chat' ? '16px 22px' : '8px 0',
        borderRadius: 20, background: s.params.kind === 'chat' ? (row.side === 'right' ? tokens.mint : tokens.cream) : tokens.cream,
        borderBottom: s.params.kind === 'chat' ? undefined : `1px solid ${tokens.inkSoft}`, overflowWrap: 'anywhere' }}>
        {row.who && <div style={{ fontFamily: HOUSE_FONTS.data, fontSize: size * 0.58, marginBottom: 8 }}>{row.who}</div>}
        {row.dots ? <span data-typing-dots="true" style={{ display: 'flex', gap: 7, padding: 8 }}>
          {[0, 1, 2].map(dot => <span key={dot} style={{ width: 8, height: 8, borderRadius: '50%', background: tokens.inkSoft }} />)}
        </span> : <span style={{ whiteSpace: 'pre-wrap' }}>{row.text}</span>}
      </div>
    </div>)}
    {s.params.kind === 'choice' && s.params.options!.map((option, i) => <div key={i} data-picked={s.picked === i}
      style={{ display: 'flex', alignItems: 'center', gap: 18, padding: '16px 0', borderTop: `1px solid ${tokens.inkSoft}` }}>
      <span style={{ width: 24, height: 24, flexShrink: 0, border: `2px solid ${tokens.ink}`, borderRadius: '50%', display: 'grid', placeItems: 'center' }}>
        {s.picked === i && <span data-radio-dot="true" style={{ width: 14, height: 14, borderRadius: '50%', background: tokens.mint, transform: `scale(${s.pickProgress})` }} />}
      </span><span style={{ overflowWrap: 'anywhere' }}>{option}</span>
    </div>)}
    {s.sent && s.params.status && <div data-status="true" style={{ fontFamily: HOUSE_FONTS.data, fontSize: size * 0.65,
      textAlign: 'right', marginTop: 16, opacity: s.sendProgress, transform: `translateX(${(1 - s.sendProgress) * 18}px)` }}>{s.params.status}</div>}
  </div>
}
