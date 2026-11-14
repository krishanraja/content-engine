import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth } from '../../../house/metrics'
import { MOTION } from '../../clock'
import { fitBox, fitScale } from '../../fit'
import { isRegion } from '../../kit/layout'
import { RegionFit } from '../../kit/regionFit'
import type { Box, DeviceProps } from '../types'
import { ParamsSchema } from './schema'
import { checklistState } from './state'

/** Reserve the final line's space even while blank; filling never moves another row. */
export function checklistLayout(box: Box, object: DeviceProps['object'], aspect: DeviceProps['aspect']) {
  const { slots } = ParamsSchema.parse(object.params)
  const tall = aspect === '9:16'
  const width = Math.min(box.width, tall ? 720 : 1040)
  const fontSize = tall ? 40 : 42
  const textArea = Math.max(fontSize, width - 172)
  const heights = slots.map(slot => {
    let lines = 1, used = 0
    // Explicit character wrapping also bounds long unbroken words and URLs.
    for (const char of slot.line) {
      const next = textWidth('anton', char, fontSize)
      if (char === '\n') { lines++; used = 0; continue }
      if (used + next > textArea && used > 0) { lines++; used = 0 }
      used += next
    }
    return Math.max(tall ? 88 : 84, lines * fontSize * 1.2 + 32)
  })
  const producerSize = tall ? 24 : 22
  const producerHeight = Math.ceil(textWidth('mono', object.dataset?.producerLabel ?? '', producerSize) / Math.max(1, width)) * producerSize * 1.4
  return { natural: { width, height: heights.reduce((sum, height) => sum + height, 0) + (slots.length - 1) * 16 + 18 + producerHeight },
    heights, fontSize, textArea, producerSize }
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = checklistState(object, events, frame)
  if (!state.visible) return null
  const l = checklistLayout(box, object, aspect)
  const content = <div data-device="checklist" style={{ width: l.natural.width, height: l.natural.height, opacity: 1 - state.exit }}>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {state.slots.map((slot, index) => <div key={slot.id} data-slot={slot.id} data-filled={slot.filled}
        style={{ position: 'relative', height: l.heights[index], opacity: slot.arrival,
          // Only the proof container rises. Its type stays fixed and fades with the paper.
          transform: `translateY(${(1 - slot.arrival) * Math.min(60, MOTION.risePx)}px)` }}>
        <div data-blank-paper="" style={{ position: 'absolute', inset: 0, background: tokens.cream, opacity: 1 - slot.dissolve }} />
        <div data-filled-paper="" style={{ position: 'absolute', inset: 0, background: tokens.cream, opacity: slot.dissolve }} />
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', height: '100%', color: tokens.ink }}>
          <span style={{ width: 76, flexShrink: 0, textAlign: 'center', fontFamily: HOUSE_FONTS.data, fontSize: 28 }}>{slot.number}</span>
          <span data-line="" style={{ width: l.textArea, opacity: slot.dissolve, fontFamily: HOUSE_FONTS.display,
            fontSize: l.fontSize, lineHeight: 1.2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', wordBreak: 'break-all' }}>{slot.line}</span>
          {slot.filled ? <svg data-tick="" width="52" height="52" viewBox="0 0 52 52" style={{ marginLeft: 16, flexShrink: 0 }}>
            <path d="M10 27 L22 39 L44 12" fill="none" stroke={tokens.mint} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"
              pathLength="1" strokeDasharray="1" strokeDashoffset={1 - slot.dissolve} />
          </svg> : null}
        </div>
      </div>)}
    </div>
    <div data-producer="" style={{ marginTop: 18, fontFamily: HOUSE_FONTS.data, fontSize: l.producerSize,
      lineHeight: 1.4, color: tokens.cream, overflowWrap: 'anywhere' }}>{state.producerLabel}</div>
  </div>
  if (isRegion(box)) return <RegionFit natural={l.natural} box={box}>{content}</RegionFit>
  const rect = fitBox(l.natural, box)
  return <div style={{ position: 'absolute', left: rect.left, top: rect.top, transformOrigin: '0 0',
    transform: `scale(${fitScale(l.natural, box)})` }}>{content}</div>
}
