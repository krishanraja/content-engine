import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { textWidth } from '../../../house/metrics'
import { isRegion } from '../../kit/layout'
import { RegionFit } from '../../kit/regionFit'
import type { DeviceProps } from '../types'
import { slamWordState } from './state'

/** One emphasis word, never a caption sentence. The tapes and slips stay behind
 *  the word. All geometry is local, so the slam never moves the panel or camera. */
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const s = slamWordState(object, events, frame)
  if (!s.visible) return null
  // Authored separately for the narrow panel and the wide desk.
  const natural = aspect === '9:16' ? { width: 800, height: 480 } : { width: 1200, height: 440 }
  const { width: w, height: h } = natural
  const word = s.word.toUpperCase()
  const fontSize = Math.min(aspect === '9:16' ? 180 : 220, (w - 96) / textWidth('anton', word, 1))
  if (fontSize < 40) throw new Error('slam_word copy cannot fit at the 40px floor')
  const body = <div data-device="slam_word" style={{ position: 'absolute', left: 0, top: 0, width: w, height: h,
    overflow: 'hidden', opacity: s.opacity, isolation: 'isolate' }}>
    {[-1, 1].map(direction => <div key={direction} data-caution-tape={direction} style={{ position: 'absolute',
      left: -w * 0.15, top: h * (direction === -1 ? 0.26 : 0.63), width: w * 1.3, height: 64,
      overflow: 'hidden', background: tokens.channel, color: tokens.ink,
      transform: `rotate(${direction * 7}deg)`, fontFamily: HOUSE_FONTS.data, fontSize: 40, lineHeight: '64px' }}>
      <div data-tape-drift={direction * s.tapeDrift} style={{ display: 'flex', width: 'max-content',
        transform: `translateX(${-240 + direction * s.tapeDrift}px)` }}>
        {Array.from({ length: 16 }, (_, i) => <span key={i} style={{ paddingRight: 48, whiteSpace: 'nowrap' }}>{s.tapeText}</span>)}
      </div>
    </div>)}
    {s.burstVisible && s.slips.map((slip, i) => {
      const x = Math.cos(slip.angle) * slip.reach * w * 0.46 * s.burst
      const y = Math.sin(slip.angle) * slip.reach * h * 0.46 * s.burst + 70 * s.burst ** 2
      return <div key={i} data-slip={i} style={{ position: 'absolute', left: w / 2, top: h / 2,
        width: slip.width, height: slip.height, background: tokens[slip.tone], opacity: 1 - s.burst,
        transform: `translate(${x}px, ${y}px) rotate(${slip.rotation + slip.spin * s.burst}deg)` }} />
    })}
    <div data-slam-word="" style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: tokens.cream, fontFamily: HOUSE_FONTS.display, fontSize, lineHeight: 1,
      textShadow: `4px 4px 0 ${tokens.ink}, -4px -4px 0 ${tokens.ink}, 4px -4px 0 ${tokens.ink}, -4px 4px 0 ${tokens.ink}`,
      transform: `scale(${s.scale})`, transformOrigin: 'center' }}>{word}</div>
  </div>
  if (isRegion(box)) return <RegionFit natural={natural} box={box}>{body}</RegionFit>
  return <div style={{ position: 'absolute', left: box.left + (box.width - w) / 2, top: box.top + (box.height - h) / 2 }}>{body}</div>
}
