import React from 'react'
import { Img, OffthreadVideo, Sequence } from 'remotion'
import { HOUSE_FONTS } from '../../../house/geometry'
import type { DeviceProps } from '../types'
import { evidenceState } from './state'

/** Provenance has its own row, outside the animated/cropped evidence region. */
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = evidenceState(object, events, frame)
  if (!state.visible) return null
  const { params } = state
  const portrait = aspect === '9:16'
  return <div style={{ position: 'absolute', ...box, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: portrait ? 22 : 18, padding: portrait ? 28 : 24, background: tokens.cream, color: tokens.ink, border: `2px ${state.struck ? 'dashed' : 'solid'} ${tokens.ink}`, boxShadow: `8px 8px 0 ${tokens.inkDeep}`, opacity: state.enter, transformOrigin: 'center center', transform: `scale(${0.8 + 0.2 * state.enter})` }}>
    <div style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, opacity: 1 - state.collapse, transformOrigin: 'center top', transform: `translateY(${-24 * state.collapse}px) scaleY(${1 - state.collapse})`, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
        {state.media && params.src ? <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
          {params.kind === 'recording' && state.playbackFrom !== null
            ? <Sequence key={state.playbackFrom} from={state.playbackFrom} layout="none"><OffthreadVideo src={params.src} trimBefore={params.trimBefore} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></Sequence>
            : <Img src={params.src} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />}
        </div> : null}
        {state.text ? <div style={{ fontFamily: HOUSE_FONTS.structure, fontWeight: 800, fontSize: portrait ? 40 : 34, lineHeight: 1.2, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap', textDecoration: state.struck ? 'line-through' : 'none', textDecorationThickness: 3 }}>{state.text}</div> : null}
      </div>
      {state.struck ? <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: 3, background: tokens.ink, transformOrigin: 'left', transform: `scaleX(${Math.min(1, state.collapse * 2)})`, opacity: 1 - state.collapse }} /> : null}
    </div>
    <div style={{ flexShrink: 0, fontFamily: HOUSE_FONTS.data, fontSize: portrait ? 24 : 22, lineHeight: 1.3, overflowWrap: 'anywhere', borderTop: `1px solid ${tokens.inkSoft}`, paddingTop: 14 }}>{params.outlet} · {params.date}</div>
  </div>
}
