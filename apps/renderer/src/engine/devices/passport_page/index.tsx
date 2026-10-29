import React from 'react'
import { HOUSE_FONTS } from '../../../house/geometry'
import { PASSPORT, PassportPaper } from '../../kit/passport'
import { PrintedFlag } from '../../kit/flags'
import type { DeviceProps } from '../types'
import { mrzLine, passportState } from './state'

/** Page-relative positions are frame pixels. The STAGE slot supplies the origin, never a fit scale.
 *  An unknown field is a dashed ??? that claims nothing; no SAMPLE sticker or disclaimer is drawn (Krish, 28 Oct 2026:
 *  "It's just the ones that say "Krish's read" or "illustrative" that are stupid because they add no value to the
 *  content."). */
export function Device({ object, events, box, tokens, aspect, frame }: DeviceProps) {
  const state = passportState(object, events, frame)
  if (!state.visible) return null
  const p = state.params
  const tall = aspect === '9:16'
  const labelLeft = p.spine === 'left' ? 92 : 46
  const mono: React.CSSProperties = { fontFamily: HOUSE_FONTS.data, color: tokens.ink }
  return <div data-device="passport_page" data-aspect={aspect} style={{ position: 'absolute',
    left: box.left + p.at.x, top: box.top + p.at.y, width: PASSPORT.width, height: PASSPORT.height,
    opacity: state.enter * (1 - state.exit),
    transform: `translate(${tall ? 0 : 80 * (1 - state.enter)}px,${(tall ? 120 : 40) * (1 - state.enter) + 160 * state.exit - 3 * state.drift}px)` }}>
    <PassportPaper spine={p.spine} tokens={tokens} shimmer={state.drift * 400}>
      {p.label ? <div data-part="label" style={{ ...mono, position: 'absolute', left: labelLeft, top: 40,
        fontSize: 30, fontWeight: 500, letterSpacing: '.14em', textTransform: 'uppercase' }}>{p.label}</div> : null}
      {p.portrait || p.ghostAI ? <div data-part="portrait" style={{ ...mono, position: 'absolute', left: 72, top: 90,
        width: 236, height: 306, border: `2px solid ${tokens.ink}`, opacity: 0.15, fontSize: 132,
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{p.ghostAI ? 'AI' : ''}</div> : null}
      {state.fields.map((field) => {
        const main = field.state === 'stamped' ? (field.main ?? field.label).toUpperCase() : '???'
        const size = main.includes('DELETED') ? 96 : main.includes('FLAGGED') ? 70
          : main === 'CHINA' ? 118 : main.length <= 3 ? 176 : main.length <= 6 ? 118 : main.length <= 10 ? 96 : 70
        // Flags are separate printed furniture, never children of a tilted stamp.
        const flagLeft = field.at.x > 250 ? field.at.x - 236 : field.at.x + 548
        return <React.Fragment key={field.id}>
          {field.flag ? <div style={{ position: 'absolute', left: flagLeft, top: field.at.y + 12 }}>
            <PrintedFlag kind={field.state === 'stamped' ? field.flag : 'unknown'} tokens={tokens} />
          </div> : null}
          {field.visible ? <div data-field={field.id} data-state={field.state} aria-label={field.label} style={{ ...mono,
            position: 'absolute', left: field.at.x, top: field.at.y, width: 520, height: 292,
            boxSizing: 'border-box', border: `3px ${field.state === 'stamped' ? 'solid' : 'dashed'} ${tokens.ink}`,
            mixBlendMode: 'multiply', opacity: field.opacity,
            transform: `rotate(${field.tilt}deg) scale(${field.scale})`, transformOrigin: 'center center' }}>
            <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: '.18em', lineHeight: 1.2,
              padding: '15px 24px 14px', borderBottom: `3px ${field.state === 'stamped' ? 'solid' : 'dashed'} ${tokens.ink}` }}>
              {(field.top ?? field.label).toUpperCase()}</div>
            <div style={{ fontSize: size, fontWeight: 700, letterSpacing: main.length > 6 ? '.08em' : '.18em',
              lineHeight: 1, textAlign: 'center', paddingTop: 22 }}>{main}</div>
          </div> : null}
          {field.marked && field.visible ? <svg data-mark={field.id} width="540" height="320" style={{
            position: 'absolute', left: field.at.x - 10, top: field.at.y - 10, pointerEvents: 'none' }}>
            <path d="M18 16 Q270 0 522 18 L526 300 Q270 318 14 300 Z" pathLength="1" fill="none"
              stroke={tokens.ink} strokeWidth="17" strokeDasharray="1" strokeDashoffset={1 - field.markProgress} />
            <path d="M18 16 Q270 0 522 18 L526 300 Q270 318 14 300 Z" pathLength="1" fill="none"
              stroke={tokens.mint} strokeWidth="8" strokeDasharray="1" strokeDashoffset={1 - field.markProgress} />
          </svg> : null}
        </React.Fragment>
      })}
      {p.mrz ? <div data-part="mrz" style={{ ...mono, position: 'absolute', left: labelLeft,
        top: tall ? 1128 : 650, fontSize: 30, fontWeight: 500, letterSpacing: '.02em', lineHeight: 1.3, whiteSpace: 'pre' }}>
        {p.mrz.map((line, index) => <div key={index}>{mrzLine(line)}</div>)}
      </div> : null}
    </PassportPaper>
  </div>
}
