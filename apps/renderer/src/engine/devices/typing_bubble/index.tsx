import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { EXIT, MOTION, progress, stateAt } from '../../clock'
import type { DeviceProps } from '../types'
import { ParamsSchema } from './schema'

const linear = (t: number) => t
// Engine events currently have no duration. The next cue on this object closes
// a type span; the final span closes at object.toFrame. Unrelated cues do not.
export function bubbleState({ object, events, frame }: Pick<DeviceProps, 'object' | 'events' | 'frame'>) {
  const params = ParamsSchema.parse(object.params)
  const fired = stateAt(events, object.obj, frame).fired
  const enter = fired.filter(e => String(e.verb) === 'enter').at(-1)
  if (!enter || frame < object.fromFrame || frame >= object.toFrame) return null
  const active = fired.filter(e => e.atFrame >= enter.atFrame)
  const exit = active.filter(e => String(e.verb) === 'exit').at(-1)
  const out = exit ? progress(frame - exit.atFrame, MOTION.exitFrames, EXIT) : 0
  if (out >= 1) return null
  const index = (value: string, count: number) => {
    if (!/^\d+$/.test(value) || Number(value) >= count) throw new Error('typing_bubble requires a zero-based index within range')
    return Number(value)
  }
  const all = stateAt(events, object.obj, object.toFrame).fired
  const rows = params.rows.map(row => ({ ...row, shown: '', dots: 0, visible: false }))
  let picked: number | null = null
  let pickProgress = 0
  let sent = false
  let sendProgress = 0
  for (const event of active) {
    const verb = String(event.verb)
    if (verb === 'type') {
      const i = index(event.toState, rows.length)
      const next = all.find(e => e.atFrame > event.atFrame)
      const span = Math.max(1, (next?.atFrame ?? object.toFrame) - event.atFrame)
      // Chat dots occupy the first quarter, capped at house enter timing.
      const lead = params.kind === 'chat' ? Math.min(MOTION.enterFrames, span / 4) : 0
      const age = frame - event.atFrame
      const p = progress(age - lead, span - lead, linear)
      rows[i] = { ...rows[i]!, visible: true,
        shown: Array.from(rows[i]!.text).slice(0, Math.floor(Array.from(rows[i]!.text).length * p)).join(''),
        dots: age < lead ? progress(age, lead, linear) : 0 }
      // The first frame of a chat cue still shows its three static dots.
      if (age < lead) rows[i]!.dots = Math.max(0.01, rows[i]!.dots)
    }
    if (verb === 'pick') {
      if (params.kind !== 'choice') throw new Error('pick requires choice')
      picked = index(event.toState, params.options!.length)
      pickProgress = progress(frame - event.atFrame, MOTION.slapFrames)
    }
    if (verb === 'send') {
      sent = true
      sendProgress = progress(frame - event.atFrame, MOTION.slapFrames)
    }
  }
  return { params, rows, picked, pickProgress, sent, sendProgress, out,
    enter: progress(frame - enter.atFrame, MOTION.enterFrames) }
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = bubbleState({ object, events, frame })
  if (!s) return null
  const tall = aspect === '9:16'
  const width = box.width * (tall ? 0.88 : 0.66)
  const font = tall ? 34 : 36
  const padding = tall ? 32 : 40
  return <div data-device="typing_bubble" data-kind={s.params.kind} style={{ position: 'absolute',
    left: box.left + (box.width - width) / 2, top: box.top + box.height * (tall ? 0.12 : 0.08), width,
    maxHeight: box.height * (tall ? 0.82 : 0.84), boxSizing: 'border-box', padding,
    overflow: 'hidden', borderRadius: s.params.kind === 'chat' ? 36 : 20,
    background: tokens.cream, color: tokens.ink, border: `2px solid ${tokens.inkSoft}`,
    boxShadow: `0 14px 36px color-mix(in srgb, ${tokens.inkDeep} 18%, transparent)`,
    opacity: s.enter * (1 - s.out), transform: `translateY(${36 * (1 - s.enter) + 80 * s.out}px)`,
    fontFamily: HOUSE_FONTS.structure, fontSize: font, lineHeight: 1.25 }}>
    {s.rows.map((row, i) => row.visible && <div key={i} data-row={i} style={{
      marginTop: i ? 16 : 0, marginLeft: row.side === 'right' ? '8%' : 0,
      marginRight: row.side === 'right' ? 0 : '8%', padding: s.params.kind === 'chat' ? '16px 22px' : '8px 0',
      borderRadius: s.params.kind === 'chat' ? 24 : 0,
      background: s.params.kind === 'chat' && row.side === 'right' ? tokens.mint : tokens.cream,
      border: s.params.kind === 'chat' && row.side === 'right' ? `2px solid ${tokens.ink}` : undefined,
      borderBottom: s.params.kind === 'email' || s.params.kind === 'order' ? `1px solid ${tokens.inkSoft}` : undefined,
      overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>
      {row.who && <div style={{ fontFamily: HOUSE_FONTS.data, fontSize: 30, marginBottom: 8 }}>{row.who}</div>}
      {row.dots > 0 ? <span data-typing-dots="true" style={{ display: 'flex', gap: 8, height: font, alignItems: 'center' }}>
        {[0, 1, 2].map(dot => <span key={dot} style={{ width: 9, height: 9, borderRadius: '50%', background: tokens.inkSoft,
          opacity: 0.35 + 0.65 * progress(row.dots - dot * 0.15, 0.4, linear) }} />)}
      </span> : <span data-text={i}>{row.shown}</span>}
    </div>)}
    {s.params.options?.map((option, i) => <div key={i} data-option={i} data-picked={s.picked === i} style={{
      display: 'flex', alignItems: 'center', gap: 18, padding: '16px 0', borderTop: `1px solid ${tokens.inkSoft}` }}>
      <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: '50%', border: `2px solid ${tokens.ink}`,
        display: 'grid', placeItems: 'center' }}>
        {s.picked === i && <span data-radio-dot={i} style={{ width: 16, height: 16, borderRadius: '50%',
          background: tokens.ink, transform: `scale(${s.pickProgress})` }} />}
      </span><span style={{ overflowWrap: 'anywhere' }}>{option}</span>
    </div>)}
    {s.sent && s.params.status && <div data-status="true" style={{ marginTop: 20, fontFamily: HOUSE_FONTS.data,
      fontSize: 30, opacity: s.sendProgress, transform: `translateX(${16 * (1 - s.sendProgress)}px)` }}>{s.params.status}</div>}
  </div>
}
