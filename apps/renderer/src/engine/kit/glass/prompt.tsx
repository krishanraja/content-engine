import React from 'react'
import { z } from 'zod'
import { progress } from '../../clock'
import { GW } from '../phoneGlass'
import type { GlassProps } from '../glassRegistry'
import { cardStyle, Frame, HOUSE_FONTS, scale, Text, typeSize } from './shared'

export const PromptParams = z.object({ lead: Text, active: Text, next: Text.optional(), rollAt: Frame.optional() })
export function Prompt({ params, tokens, sinceFrames, k }: GlassProps) {
  const p = PromptParams.parse(params), width = GW * scale(k) - 76
  // With no `next` there is nothing to roll to and nothing dim to show: a prompt that names one place only.
  const t = p.next && p.rollAt !== undefined ? progress(sinceFrames - p.rollAt, 12) : 0
  const size = typeSize(84, k, 1.8), row = size * 1.12
  return <div data-glass="prompt" style={{ position: 'absolute', left: 38, top: 30 * k + 20, width, color: tokens.cream }}>
    <div style={{ boxSizing: 'border-box', border: `2px solid ${tokens.mint}`, borderRadius: 34, padding: '10px 20px 11px', height: 94,
      fontFamily: HOUSE_FONTS.data, fontWeight: 500, fontSize: typeSize(30, k, 1.8), letterSpacing: '.09em', lineHeight: 1.22, color: tokens.mint }}>
      SAME WORK PROMPT · ONLY THE COUNTRY CHANGES
    </div>
    <div style={{ ...cardStyle(tokens), position: 'absolute', top: 118, width, height: 362, padding: '16px 26px 24px' }}>
      <div style={{ fontFamily: HOUSE_FONTS.structure, fontSize: typeSize(33, k, 1.8), fontWeight: 500, lineHeight: 1.26 }}>{p.lead}</div>
      <div data-reel="" style={{ position: 'absolute', left: 22, top: 146, height: row, width: width - 44, overflow: 'hidden',
        fontFamily: HOUSE_FONTS.display, fontSize: size, lineHeight: 1.12, textTransform: 'uppercase' }}>
        <div style={{ transform: `translateY(${-t * row}px)` }}>
          {t < 1 && <div data-slot="active" style={{ height: row, color: tokens.mint }}>{p.active.toUpperCase()}</div>}
          {t === 1 && <div style={{ height: row }} />}
          {t > 0 && p.next && <div data-slot="next" style={{ height: row, color: tokens.mint }}>{p.next.toUpperCase()}</div>}
        </div>
      </div>
      {t === 0 && p.next && <div data-next="" style={{ fontFamily: HOUSE_FONTS.display, fontSize: size, lineHeight: 1.12, opacity: .45, position: 'absolute', left: 26, top: 246 }}>{p.next.toUpperCase()}</div>}
    </div>
  </div>
}
