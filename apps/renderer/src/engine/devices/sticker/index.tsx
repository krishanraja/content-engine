import React from 'react'
import { Sticker } from '../../../house/components'
import { textWidth } from '../../../house/metrics'
import { canvasRect, halftone, houseTokens, rotatedBounds } from '../../kit/overlay'
import type { DeviceProps } from '../types'
import { stickerState } from './state'
export function Device({ object, events, tokens, frame }: DeviceProps) {
  const s = stickerState(object, events, frame)
  if (!s.visible) return null
  const width = Math.max(...s.text.toUpperCase().split('\n').map(line => textWidth('mono', line, 30, 0.03))) + 48
  const height = 28 + s.text.split('\n').length * 32.4
  rotatedBounds(s.at.x, s.at.y, width, height, s.tiltDeg, 5)
  return <Sticker text={s.text.toUpperCase()} tokens={houseTokens(tokens)} background={tokens[s.tone]}
    sizePx={30} paddingX={22} paddingY={12} style={{ ...canvasRect(s.at.x, s.at.y, width, height),
      ...(s.tone === 'channel' ? halftone(tokens) : {}), whiteSpace: 'pre-line', lineHeight: 1.08, letterSpacing: '0.03em',
      border: `2px solid ${tokens.ink}`, boxShadow: `5px 5px 0 ${tokens.ink}`,
      transform: `translateY(${s.drop}px) rotate(${s.rotation}deg)`, opacity: s.opacity }} />
}
