import React from 'react'
import { HOUSE, HOUSE_FONTS } from '../../house/geometry'
import { Device as Buddy } from '../devices/cursor_buddy'
import { Device as Bubble } from '../devices/typing_bubble'
import { Mark } from '../devices/logo_orbit/mark'
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
export const FWP_SPLIT_SEAM_Y = 760
export const FWP_STAGE_SCALE = 0.76
const STAGE_LEFT = (1080 - 1080 * FWP_STAGE_SCALE) / 2
export const FWP_SPLIT_CAPTION_ZONE = { left: 72, top: 1460, width: 900, height: 180 } as const
/** Poster crop defaults for the Thursday still; override after camera-plate review. */
export const FWP_POSTER_POSITIONS = { hook: '50% 88%', face: '50% 0%', proof: '50% 88%', close: '50% 88%' } as const
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
    <img data-camera-plate src={posterSrc} alt="" style={{ position: 'absolute', left: 0, top: face ? 0 : FWP_SPLIT_SEAM_Y,
      width: 1080, height: face ? 1920 : 1920 - FWP_SPLIT_SEAM_Y, objectFit: 'cover', objectPosition: posterPosition }} />
    {!face && <div data-proof-stage style={{ position: 'absolute', left: 0, top: 0, width: 1080, height: FWP_SPLIT_SEAM_Y,
      background: tokens.cream, overflow: 'hidden' }}>
      <div data-stage-graphics style={{ position: 'absolute', left: STAGE_LEFT, top: 0,
        width: 1080, height: 1000, transform: `scale(${FWP_STAGE_SCALE})`,
        transformOrigin: 'top left', overflow: 'hidden' }}>{children}</div>
    </div>}
    <header style={{ position: 'absolute', left: 72, top: 79, width: 888, height: 56,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <img data-brand-logo src={logoSrc} alt="" style={{ width: 240, height: 56, objectFit: 'contain', objectPosition: 'left' }} />
      <span data-series style={{ fontFamily: HOUSE_FONTS.data, fontSize: 30, background: tokens.channel,
        color: tokens.ink, padding: '8px 12px' }}>{series}</span>
    </header>
    <div data-caption-zone style={{ position: 'absolute', ...(face ? { left: 72, top: 1180, width: 900, height: 320 } : FWP_SPLIT_CAPTION_ZONE) }}>
      <div style={{ boxSizing: 'border-box', background: tokens.ink, color: tokens.cream,
        padding: `${face ? HOUSE.caption.paddingTop : 10}px ${HOUSE.caption.paddingX}px ${face ? HOUSE.caption.paddingBottom : 10}px`,
        fontFamily: HOUSE_FONTS.structure, fontWeight: HOUSE.caption.weight, fontSize: HOUSE.caption.size,
        lineHeight: HOUSE.caption.lineHeight, letterSpacing: `${HOUSE.caption.letterSpacingEm}em`,
        boxShadow: `${HOUSE.caption.shadow}px ${HOUSE.caption.shadow}px 0 ${tokens.channel}` }}>{caption}</div>
    </div>
  </div>
}
// Annotation targets in unscaled stage pixels. Done! starts after the notification's
// 40px card padding and 24px row padding; its line starts at y=256.
export const FWP_TARGETS = {
  done: { x: 120, y: 256, w: 126, h: 58 },
  amazon: { x: 420, y: 220, w: 240, h: 240 },
  noSending: { x: 72, y: 440, w: 828, h: 163.2 },
} as const
/** Frame-pixel targets after the same centred transform as the stage graphics.
 * Device parameters retain stage coordinates to avoid applying the scale twice. */
export const FWP_SCALED_TARGETS = Object.fromEntries(Object.entries(FWP_TARGETS).map(([name, t]) => [name, {
  x: STAGE_LEFT + t.x * FWP_STAGE_SCALE, y: t.y * FWP_STAGE_SCALE,
  w: t.w * FWP_STAGE_SCALE, h: t.h * FWP_STAGE_SCALE,
}])) as Record<keyof typeof FWP_TARGETS, { x: number; y: number; w: number; h: number }>
function Annotation({ tokens, name, params }: { tokens: EngineTokens; name: keyof typeof FWP_TARGETS;
  params: EngineObject['params'] }) {
  return <div data-scribble-target={name} data-target-box={JSON.stringify(FWP_SCALED_TARGETS[name])} data-scribble-shape={String(params.shape)}>
    <Still component={Scribble} id="scribble" verb="draw" params={{ ...params,
      colour: 'mint', seed: 'fwp' }} slot={box(0, 0, 1080, 1920)} tokens={tokens} />
  </div>
}
function Hook(props: FWPMockProps) {
  return <Frame {...props} posterPosition={props.posterPosition ?? FWP_POSTER_POSITIONS.hook} caption="Proactive AI is coming">
    <Still component={Bubble} id="typing_bubble" params={{ kind: 'notification', rows: [
      { text: 'Done! Booked the team offsite in Ibiza' },
    ] }} slot={box(56, 160, 920, 300)} tokens={props.tokens} />
    <Still component={Buddy} id="cursor_buddy" params={{ mood: 'proud' }}
      slot={box(0, 0, 900, 1100)} tokens={props.tokens} left={66} top={190} />
    <Annotation tokens={props.tokens} name="done" params={{ shape: 'underline', target: FWP_TARGETS.done, double: false }} />
  </Frame>
}
function Face(props: FWPMockProps) {
  return <Frame {...props} face caption="It doesn't spend my money" />
}
function Proof(props: FWPMockProps) {
  return <Frame {...props} posterPosition={props.posterPosition ?? FWP_POSTER_POSITIONS.proof} caption="Amazon for your groceries">
    <svg width={1080} height={1000}>
      {['Meta', 'Amazon', 'Google', 'xAI', 'Anthropic'].map((id, i) => {
        const x = i < 3 ? 120 + i * 300 : 270 + (i - 3) * 300
        const y = i < 3 ? 220 : 570
        return <g key={id} data-logo-tile={id} transform={`translate(${x} ${y})`}>
          <rect width={240} height={240} rx={24} fill="white" />
          <g transform="translate(120 120)"><Mark id={id} size={140} /></g>
        </g>
      })}
    </svg>
    <Annotation tokens={props.tokens} name="amazon" params={{ shape: 'loop', target: FWP_TARGETS.amazon }} />
  </Frame>
}
function Close(props: FWPMockProps) {
  // Existing block stamp's paint slot is channel. Bind it to the answer mint;
  // the header and caption shadow retain the actual series identity colour.
  const slabTokens = { ...props.tokens, channel: props.tokens.mint }
  return <Frame {...props} posterPosition={props.posterPosition ?? FWP_POSTER_POSITIONS.close} caption="no spending, no sending">
    {['NO SPENDING', 'NO SENDING'].map((main, i) => <Still key={main} component={Stamp}
      id={`stamp-${i}`} verb="stamp" params={{ kind: 'block', main, tiltDeg: 0,
        at: { x: 0, y: 0, w: 345, h: 68 } }} slot={box(0, 0, 345, 68)}
      tokens={slabTokens} scale={2.4} left={72} top={230 + i * 210} />)}
    <Still component={Buddy} id="cursor_buddy" params={{ mood: 'sulk' }}
      slot={box(0, 0, 640, 800)} tokens={props.tokens} left={390} top={400} />
    <Annotation tokens={props.tokens} name="noSending" params={{ shape: 'tick', cx: 926, cy: 522, size: 72 }} />
  </Frame>
}
export const FWP_MOCKS = { hook: Hook, face: Face, proof: Proof, close: Close } as const
