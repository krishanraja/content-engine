import React from 'react'
import { TickerStar } from '../../../house/components'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth } from '../../../house/metrics'
import { HERO, progress } from '../../clock'
import { ZONES } from '../../kit/lock'
import { canvasRect, halftone } from '../../kit/overlay'
import type { DeviceProps } from '../types'
import { TAPE } from './schema'
import { marqueeState } from './state'

/** The event tape (mode 'tape'): two tapes and a one-time chip burst, drawn across the layout box. */
function EventTape({ object, events, box, tokens, frame }: DeviceProps) {
  const s = marqueeState(object, events, frame)
  if (!s.visible) return null
  const age = Math.max(0, s.age)
  const tape = (part: typeof TAPE.display | typeof TAPE.filing, text: string, index: number, display: boolean) => {
    const size = Math.round(box.width * part.px)
    const font = display ? 'anton' : 'mono'
    const unit = `${text.toUpperCase()}\u00a0·\u00a0`
    const unitWidth = textWidth(font, unit, size, display ? 0.005 : 0.06)
    const repeats = Math.ceil((box.width * 1.6 + (object.toFrame - object.fromFrame) * TAPE.driftPxPerFrame) / unitWidth) + 1
    const p = progress(age - index * TAPE.staggerFrames, TAPE.slideFrames, HERO)
    const slide = (1 - p) * part.from * box.width * 1.2
    const drift = (age * TAPE.driftPxPerFrame) % unitWidth
    const height = Math.round(size * (display ? 1.25 : 2.1))
    return <div key={index} data-tape={display ? 'display' : 'filing'} style={{ position: 'absolute', left: -box.width * 0.3,
      width: box.width * 1.6, top: box.height * part.y - height / 2, height, background: tokens.channel,
      transform: `translateX(${slide}px) rotate(${part.rotate}deg)`, overflow: 'hidden', display: 'flex', alignItems: 'center',
      boxShadow: `0 10px 24px ${tokens.inkDeep}` }}>
      <div style={{ display: 'flex', whiteSpace: 'nowrap', color: tokens.ink, transform: `translateX(${part.from > 0 ? -drift : drift - unitWidth}px)`,
        fontFamily: display ? HOUSE_FONTS.display : HOUSE_FONTS.data, fontWeight: display ? 400 : 600, fontSize: size,
        letterSpacing: display ? '0.005em' : '0.06em', lineHeight: 1 }}>
        {Array.from({ length: repeats }, (_, n) => <span key={n} style={{ flex: 'none' }}>{unit}</span>)}
      </div>
    </div>
  }
  // A one-time burst of chips from the middle of the box: out and down, gone by TAPE.chipFrames (1.2 s).
  const burst = age < TAPE.chipFrames ? Array.from({ length: s.chips }, (_, i) => {
    const angle = (i / s.chips) * Math.PI * 2 + (i % 2 ? 0.35 : -0.2)
    const t = age / TAPE.chipFrames
    const reach = box.width * TAPE.chipTravel * (0.6 + 0.4 * ((i * 7) % 5) / 4)
    const x = box.width / 2 + Math.cos(angle) * reach * Math.sqrt(t)
    const y = box.height / 2 + Math.sin(angle) * reach * Math.sqrt(t) + 180 * t * t
    const colour = [tokens.cream, tokens.mint, tokens.channel][i % 3]
    return <i key={i} data-chip style={{ position: 'absolute', left: x, top: y, width: 18, height: 7, background: colour,
      opacity: 1 - t, transform: `rotate(${(i * 47 + age * 9) % 360}deg)` }} />
  }) : null
  return <div data-device="marquee" data-mode="tape" aria-hidden style={{ position: 'absolute', ...box, overflow: 'hidden', opacity: 1 - s.exit,
    pointerEvents: 'none' }}>
    {tape(TAPE.display, s.items[0]!, 0, true)}
    {tape(TAPE.filing, s.items[1]!, 1, false)}
    {burst}
  </div>
}

export function Device(props: DeviceProps) {
  const { object, events, tokens, frame } = props
  const s = marqueeState(object, events, frame)
  if (s.mode === 'tape') return <EventTape {...props} />
  if (!s.visible) return null
  const at = s.at ?? ZONES.marquee
  const cycleWidth = s.items.reduce((sum, item) => sum + textWidth('mono', item, 30, 0.02) + 46 * 0.84 + 48, 0)
  const repeats = Math.ceil((1080 + (object.toFrame - object.fromFrame) * 2) / cycleWidth) + 1
  return <div aria-hidden style={{ ...canvasRect(0, at.y, 1080, at.h), ...halftone(tokens), overflow: 'hidden', opacity: s.opacity }}>
    <div style={{ display: 'flex', alignItems: 'center', height: at.h, width: cycleWidth * repeats,
      transform: `translateX(${-s.offset}px)`, color: tokens.ink, fontFamily: HOUSE_FONTS.data,
      fontSize: 30, fontWeight: 600, letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>
      {Array.from({ length: repeats }, (_, n) => s.items.map((item, i) => <React.Fragment key={`${n}-${i}`}>
        <span style={{ flex: 'none', marginRight: 24 }}>{item}</span><span style={{ flex: 'none', marginRight: 24 }}><TickerStar color={tokens.ink} /></span>
      </React.Fragment>))}
    </div>
  </div>
}
