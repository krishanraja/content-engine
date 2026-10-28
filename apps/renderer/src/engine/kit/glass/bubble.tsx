import React from 'react'
import { z } from 'zod'
import { progress } from '../../clock'
import { GW } from '../phoneGlass'
import type { GlassProps } from '../glassRegistry'
import { cardStyle, HOUSE_FONTS, scale, Text } from './shared'
import { textWidth, wrapWords } from '../../../house/metrics'

export const BubbleParams = z.object({ label: Text, quote: Text })
export function Bubble({ params, tokens, sinceFrames, k }: GlassProps) {
  const p = BubbleParams.parse(params), enter = progress(sinceFrames, 12)
  const innerWidth = GW * scale(k) - 124
  const paragraphs = p.quote.split('\n')
  const lines = paragraphs.reduce((sum, line) => sum + Math.max(1, wrapWords('archivo600', line, 44, innerWidth).length), 0)
  if (lines > 4 || p.quote.split(/\s+/).some(word => textWidth('archivo600', word, 44) > innerWidth)) {
    throw new Error('ve: bubble quote exceeds four lines at 44 px')
  }
  return <div data-glass="bubble" style={{ ...cardStyle(tokens), position: 'absolute', left: 34, top: 30 * scale(k) + 22,
    width: GW * k - 68, padding: '16px 26px 24px', opacity: enter, transform: `translateY(${-28 * (1 - enter)}px)` }}>
    <div style={{ fontFamily: HOUSE_FONTS.data, fontSize: 30, color: tokens.mint, textTransform: 'uppercase', lineHeight: 1.2 }}>{p.label.toUpperCase()}</div>
    <div data-quote="" style={{ marginTop: 16, fontFamily: HOUSE_FONTS.structure, fontSize: 44, fontWeight: 600,
      lineHeight: 1.25, whiteSpace: 'pre-wrap' }}>{p.quote}</div>
  </div>
}
