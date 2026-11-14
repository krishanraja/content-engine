import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth, wrapWords } from '../../../house/metrics'
import { MOTION } from '../../clock'
import { freeRegion, isRegion, markRegion } from '../../kit/layout'
import { RegionFit } from '../../kit/regionFit'
import type { DeviceProps } from '../types'
import { takeoverState } from './state'

/** Graphics-only STAGE, plate.source="none": the composition removes the take and restores it on the next beat.
 * The ground is full bleed even when the layout hands the title a safe display region. */
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = takeoverState(object, events, frame)
  if (!s.visible) return null
  const lines = s.lines.map(line => line.toUpperCase())
  // Numeric claims must come from the object's dataset and carry its producer, never from invented title copy.
  const numbers = lines.join(' ').match(/\d+(?:[,.]\d+)*/g) ?? []
  if (numbers.some(number => !object.dataset?.rows.some(row => row.value === Number(number.replaceAll(',', '')))))
    throw new Error('Takeover numbers must come from object.dataset with a producerLabel')
  const producer = object.dataset?.producerLabel
  const region = isRegion(box) ? box : markRegion(freeRegion(aspect, undefined, false))
  // 96 px headline floor; breathing room contains the split offsets, back entrance and slow push.
  const size = 96, padding = 32, lineHeight = 1.05
  const width = Math.max(300, ...lines.map(line => textWidth('anton', line, size))) + padding * 2
  const creditLines = producer ? wrapWords('mono', producer, 30, width - padding * 2) : []
  const natural = {
    width,
    height: lines.length * size * lineHeight + padding * 2 + (producer ? 24 + creditLines.length * 36 : 0),
  }
  const title = (colour: string, offset: number, echo = false) => <div
    aria-hidden={echo || undefined} data-split={echo ? colour : undefined}
    style={{ position: 'absolute', left: padding, right: padding, top: padding,
      color: colour, fontFamily: HOUSE_FONTS.display, fontSize: size, lineHeight,
      transform: `translateX(${offset}px)`, whiteSpace: 'nowrap' }}>
    {lines.map((line, i) => <div key={i}>{line}</div>)}
  </div>
  return <div data-device="takeover" style={{ position: 'absolute', left: 0, top: 0,
    width: aspect === '9:16' ? 1080 : 1920, height: aspect === '9:16' ? 1920 : 1080,
    background: tokens.inkDeep, overflow: 'hidden', transform: `translateX(${-100 * s.exit}%)` }}>
    <RegionFit natural={natural} box={region}>
      <div data-title="takeover" style={{ position: 'relative', ...natural,
        transform: `translateY(${Math.min(MOTION.risePx, 24) * (1 - s.enter)}px) scale(${s.push})` }}>
        {!!s.split && <>{title(tokens.channel, s.split, true)}{title(tokens.mint, -s.split, true)}</>}
        {title(tokens.cream, 0)}
        {producer && <div style={{ position: 'absolute', left: padding, right: padding, bottom: padding,
          color: tokens.cream, fontFamily: HOUSE_FONTS.data, fontSize: 30, lineHeight: 1.2,
          overflowWrap: 'anywhere' }}>{creditLines.map((line, i) => <div key={i}>{line.join(' ')}</div>)}</div>}
      </div>
    </RegionFit>
    {s.streakVisible && <div data-streak="takeover" style={{ position: 'absolute', top: '-25%', height: '150%',
      left: `${-100 + 300 * s.streak}%`, width: '12%', transform: 'skewX(-20deg)', pointerEvents: 'none',
      background: `linear-gradient(90deg, transparent, ${tokens.cream}, transparent)`, opacity: 0.18 }} />}
  </div>
}
