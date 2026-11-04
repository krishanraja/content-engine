import React from 'react'
import { font } from '../../kit/typeRole'
import { fitBox, fitScale } from '../../fit'
import type { Focus } from '../../kit/focus'
import type { Box, DeviceProps } from '../types'
import { queryState } from './state'

export function queryLayout(box: Box, text: string, aspect: DeviceProps['aspect']) {
  const fontSize = aspect === '9:16' ? 28 : 26
  const paddingX = aspect === '9:16' ? 28 : 32
  const paddingY = aspect === '9:16' ? 18 : 14
  const natural = { width: [...text].length * 0.6 * fontSize + 2 * paddingX + 4, height: fontSize * 1.25 + 2 * paddingY + 4 }
  return { natural, scale: fitScale(natural, box), rect: fitBox(natural, box), fontSize, paddingX, paddingY }
}

export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = queryState(object, events, frame)
  if (!state.visible) return null
  const l = queryLayout(box, state.text, aspect)
  return <div style={{ position: 'absolute', left: l.rect.left, top: l.rect.top,
    width: l.natural.width, height: l.natural.height, boxSizing: 'border-box',
    opacity: state.enter * (1 - state.exit), transformOrigin: 'top left',
    transform: `scale(${l.scale * state.scale / 1.05})`,
    borderRadius: 999, border: `2px solid ${tokens.ink}`, background: tokens.cream, color: tokens.ink,
    padding: `${l.paddingY}px ${l.paddingX}px`, fontFamily: font('data'),
    fontSize: l.fontSize, lineHeight: 1.25, whiteSpace: 'nowrap' }}>{state.shown === state.text && !state.caret ? state.text
      : <>{state.shown}{state.caret && <span data-caret style={{ display: 'inline-block', width: 0, height: '1.05em',
        verticalAlign: '-0.18em', boxShadow: `0 0 0 1.5px ${tokens.ink}` }} />}<span style={{ opacity: 0 }}>{[...state.text].slice(state.chars).join('')}</span></>}</div>
}

/** living-ui's camera target (kit/focus.ts): the chip itself, in the device's own box pixels, from its entrance. */
export function chipFocus({ object, events, box, aspect, frame }: Pick<DeviceProps, 'object' | 'events' | 'box' | 'aspect' | 'frame'>): Focus | undefined {
  const state = queryState(object, events, frame)
  if (!state.visible || state.exit > 0) return undefined
  const l = queryLayout(box, state.text, aspect)
  return { rect: { left: l.rect.left, top: l.rect.top, width: l.natural.width * l.scale, height: l.natural.height * l.scale },
    since: Math.max(0, state.since) }
}
