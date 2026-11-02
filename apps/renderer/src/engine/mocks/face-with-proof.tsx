import React from 'react'
import { HOUSE, HOUSE_FONTS } from '../../house/geometry'
import { Device as Buddy } from '../devices/cursor_buddy'
import { Device as Bubble } from '../devices/typing_bubble'
import { Device as Logos } from '../devices/logo_card'
import { Device as Stamp } from '../devices/stamp'
import { Device as Scribble } from '../devices/scribble'
import type { DeviceComponent, Box } from '../devices/types'
import type { EngineObject, EngineTokens } from '../props'

/** Supply a real recording poster and the pinned house logo. No generated face.
 * posterPosition must be chosen with the eyes clear of captions at still review. */
export interface FWPMockProps {
  tokens: EngineTokens
  posterSrc: string
  logoSrc: string
  series: string
  posterPosition?: string
}
const box = (left: number, top: number, width: number, height: number): Box => ({ left, top, width, height })
function Still({ component: Component, id, params, slot, tokens, verb = 'enter', scale = 1, left = 0, top = 0 }:
  { component: DeviceComponent; id: string; params: EngineObject['params']; slot: Box; tokens: EngineTokens;
    verb?: 'enter' | 'stamp' | 'draw'; scale?: number; left?: number; top?: number }) {
  const object: EngineObject = { obj: id, device: id, meaning: id, params, variants: {}, fromFrame: 0, toFrame: 180 }
  return <div data-device={id} data-scale={scale} style={{ position: 'absolute', left, top,
    transform: `scale(${scale})`, transformOrigin: 'top left' }}>
    <Component object={object} events={[
      { id: `${id}-enter`, obj: id, verb, toState: 'visible', atFrame: 0 },
      ...(id === 'typing_bubble' ? [{ id: 'typed', obj: id, verb: 'type' as const, toState: '0', atFrame: 1 },
        { id: 'typed-hold', obj: id, verb: 'carry' as const, toState: 'hold', atFrame: 90 }] : []),
    ]} box={slot} tokens={tokens} aspect="9:16" frame={120} />
  </div>
}
function Frame({ children, caption, face = false, tokens, posterSrc, logoSrc, series, posterPosition = '50% 0%' }:
  FWPMockProps & { children?: React.ReactNode; caption: string; face?: boolean }) {
  return <div data-fwp-frame data-layout={face ? 'face' : 'split'} style={{ position: 'relative', width: 1080,
    height: 1920, overflow: 'hidden', background: tokens.ink, color: tokens.cream }}>
    <img data-camera-plate src={posterSrc} alt="" style={{ position: 'absolute', left: 0, top: face ? 0 : 1000,
      width: 1080, height: face ? 1920 : 920, objectFit: 'cover', objectPosition: posterPosition }} />
    {!face && <div data-proof-stage style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: 1000,
      background: tokens.cream }}>{children}</div>}
    <header style={{ position: 'absolute', left: 72, top: 79, width: 888, height: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <img data-brand-logo src={logoSrc} alt="" style={{ width: 240, height: 56, objectFit: 'contain', objectPosition: 'left' }} />
      <span data-series style={{ fontFamily: HOUSE_FONTS.data, fontSize: 30, background: tokens.channel,
        color: tokens.ink, padding: '8px 12px' }}>{series}</span>
    </header>
    <div data-caption-zone style={{ position: 'absolute', left: 72, top: 1180, width: 900, height: 320 }}>
      <div style={{ boxSizing: 'border-box', background: tokens.ink, color: tokens.cream,
        padding: `${HOUSE.caption.paddingTop}px ${HOUSE.caption.paddingX}px ${HOUSE.caption.paddingBottom}px`,
        fontFamily: HOUSE_FONTS.structure, fontWeight: HOUSE.caption.weight, fontSize: HOUSE.caption.size,
        lineHeight: HOUSE.caption.lineHeight, letterSpacing: `${HOUSE.caption.letterSpacingEm}em`,
        boxShadow: `${HOUSE.caption.shadow}px ${HOUSE.caption.shadow}px 0 ${tokens.channel}` }}>{caption}</div>
    </div>
  </div>
}
function Annotation({ tokens, from, to }: { tokens: EngineTokens; from: number[]; to: number[] }) {
  return <Still component={Scribble} id="scribble" verb="draw" params={{ shape: 'underline', from, to,
    colour: 'mint', seed: 'fwp' }} slot={box(0, 0, 1080, 1920)} tokens={tokens} />
}
function Hook(props: FWPMockProps) {
  return <Frame {...props} caption="Proactive AI is coming">
    <Still component={Bubble} id="typing_bubble" params={{ kind: 'notification', rows: [
      { text: 'Done! Booked the team offsite in Ibiza' },
    ] }} slot={box(56, 160, 920, 300)} tokens={props.tokens} />
    <Still component={Buddy} id="cursor_buddy" params={{ mood: 'proud' }}
      slot={box(0, 0, 900, 1100)} tokens={props.tokens} left={66} top={190} />
    <Annotation tokens={props.tokens} from={[180, 450]} to={[840, 450]} />
  </Frame>
}
function Face(props: FWPMockProps) {
  return <Frame {...props} face caption="It doesn't spend my money" />
}
function Proof(props: FWPMockProps) {
  return <Frame {...props} caption="Amazon for your groceries">
    <Still component={Logos} id="logo_card-top" params={{ logos: [{ id: 'Meta' }, { id: 'Amazon' }, { id: 'Google' }] }}
      slot={box(72, 220, 880, 500)} tokens={props.tokens} />
    <Still component={Logos} id="logo_card-bottom" params={{ logos: [{ id: 'xAI' }, { id: 'Anthropic' }] }}
      slot={box(172, 570, 680, 500)} tokens={props.tokens} />
    <Annotation tokens={props.tokens} from={[402, 555]} to={[610, 555]} />
  </Frame>
}
function Close(props: FWPMockProps) {
  // Existing block stamp's paint slot is channel. Bind it to the answer mint;
  // the header and caption shadow retain the actual series identity colour.
  const slabTokens = { ...props.tokens, channel: props.tokens.mint }
  return <Frame {...props} caption="no spending, no sending">
    {['NO SPENDING', 'NO SENDING'].map((main, i) => <Still key={main} component={Stamp}
      id={`stamp-${i}`} verb="stamp" params={{ kind: 'block', main, tiltDeg: 0,
        at: { x: 0, y: 0, w: 345, h: 68 } }} slot={box(0, 0, 345, 68)}
      tokens={slabTokens} scale={2.4} left={72} top={230 + i * 210} />)}
    <Still component={Buddy} id="cursor_buddy" params={{ mood: 'sulk' }}
      slot={box(0, 0, 640, 800)} tokens={props.tokens} left={390} top={400} />
    <Annotation tokens={props.tokens} from={[100, 665]} to={[430, 665]} />
  </Frame>
}
export const FWP_MOCKS = { hook: Hook, face: Face, proof: Proof, close: Close } as const
