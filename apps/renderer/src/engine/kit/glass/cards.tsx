import React from 'react'
import { z } from 'zod'
import { MOTION, progress } from '../../clock'
import { GW } from '../phoneGlass'
import type { GlassProps } from '../glassRegistry'
import { cardStyle, Frame, HOUSE_FONTS, scale, Text, typeSize } from './shared'

export const CardsParams = z.object({
  cards: z.array(z.object({ name: Text, flags: z.array(z.object({ station: Text, planted: z.boolean() })).min(1),
    score: z.union([z.number().finite().nonnegative(), Text]).optional() })).min(1),
  scoreAt: Frame.default(22),
})
const flagPath = 'M15 10 Q38 2 60 13 L47 24 L60 36 Q38 44 15 36 Z'
/** Port of ref/H/build.py pennant, with a bounded SVG viewport. */
export function Pennant({ planted, elapsed, tokens, height = 72 }: { planted: boolean; elapsed: number; tokens: GlassProps['tokens']; height?: number }) {
  const drop = progress(elapsed, MOTION.dropFrames), slap = progress(elapsed, MOTION.slapFrames)
  return <svg data-pennant={planted ? 'planted' : 'bare'} width={height * 64 / 88} height={height} viewBox="0 0 64 88"
    style={{ overflow: 'hidden', flexShrink: 0, transformOrigin: '50% 90%',
      transform: planted ? `translateY(${-40 * (1 - drop)}px) rotate(${-12 * (1 - drop)}deg) scale(${1 + .4 * (1 - slap)})` : undefined }}>
    <line x1="12" y1="8" x2="12" y2="80" stroke={tokens.cream} strokeWidth="4" />
    {planted ? elapsed >= 0 && <path data-flag="planted" d={flagPath} fill={tokens.mint} stroke={tokens.ink} strokeWidth="3" strokeLinejoin="round" />
      : <path data-flag="ghost" d={flagPath} fill="none" stroke={tokens.cream} strokeWidth="3" strokeDasharray="5 6" strokeLinejoin="round" opacity=".55" />}
    <ellipse cx="12" cy="80" rx="10" ry="3" fill={tokens.cream} />
  </svg>
}
export function Cards({ params, tokens, sinceFrames, k }: GlassProps) {
  const p = CardsParams.parse(params), width = GW * scale(k) - 68
  return <div data-glass="cards" style={{ position: 'absolute', left: 34, top: 30 * k + 20, width, display: 'flex', flexDirection: 'column', gap: 28 }}>
    {p.cards.map((card, i) => {
      const start = i === 0 ? 8 : 60 + (i - 1) * 52
      const enter = progress(sinceFrames - start, 12)
      const scoreElapsed = sinceFrames - (p.scoreAt + (i === 0 ? 0 : 52 + (i - 1) * 52))
      const score = scoreElapsed >= 0 ? card.score : undefined
      return <div key={i} data-result-card="" style={{ ...cardStyle(tokens), padding: '22px 30px', opacity: enter,
        transform: `translateY(${120 * (1 - enter)}px)` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
          <div style={{ fontFamily: HOUSE_FONTS.structure, fontSize: Math.max(34, Math.min(46, typeSize(44, k, 1.9))), fontWeight: 900, fontStretch: '112%', textTransform: 'uppercase', lineHeight: 1 }}>{card.name}</div>
          {score !== undefined && <div data-score="" style={{ color: tokens.mint, fontFamily: HOUSE_FONTS.display,
            fontSize: typeSize(/^[01]$/.test(String(score)) ? 150 : 136, k, 1.9), lineHeight: 1,
            transform: `scale(${1 + .4 * (1 - progress(scoreElapsed, MOTION.slapFrames))})` }}>{score}</div>}
        </div>
        {card.flags.map((flag, j) => <div key={j} style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginTop: 10 }}>
          <Pennant planted={flag.planted} elapsed={sinceFrames - (22 + (i === 0 ? 0 : 52 + (i - 1) * 52) + j * MOTION.staggerFrames)} tokens={tokens} />
          <span style={{ fontFamily: HOUSE_FONTS.data, fontSize: typeSize(30, k, 1.9), letterSpacing: '.06em', lineHeight: 1.2 }}>{flag.station}</span>
        </div>)}
      </div>
    })}
  </div>
}
