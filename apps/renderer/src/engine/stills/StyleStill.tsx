import React from 'react'
import bank from '../../../../../config/style-references.json'
import { HOUSE_FONTS as F } from '../../house/geometry'
import { CAPTION_THEMES, type CaptionThemeName } from '../captions/names'
import { ThemedCaption } from '../chrome/ThemedCaption'
import { DEVICES } from '../devices/registry'
import type { EngineObject, EngineEvent, EngineRenderProps, EngineTokens } from '../props'
import { CANVAS, ZONES } from '../kit/lock'
import { MOTION_PROFILES } from '../kit/motionProfiles'
import { groundTexture } from '../kit/beatMotion'

export type StyleStillProps = { layer: 'treatment' | 'motion' | 'captions'; id: string }
// The engine's canonical token values, imported rather than restated as colours.
import base from '../../../../../fixtures/ve/engine-core/props.json'
import { EngineRenderPropsSchema } from '../props'
const tokens: EngineTokens = base.tokens

/** Only authored covers are advertised. Unsupported styles deliberately have no house fallback. */
const motionScenes: Record<string, string> = {
  'ai-music-slam': 'music', 'character-ai-receipts': 'receipt',
  'data-story': 'number', 'swiss-kinetic-type': 'type', 'dark-keynote': 'number',
}
const looks: Record<string, string> = {
  'voice-led-pictures': 'music', 'data-story': 'number',
  'receipt-animation': 'receipt', 'kinetic-movement': 'type',
}
export function stillIds(): StyleStillProps[] {
  return [
    ...Object.keys(looks).map(id => ({ layer: 'treatment' as const, id })),
    ...Object.keys(motionScenes).map(id => ({ layer: 'motion' as const, id })),
    ...CAPTION_THEMES.map(id => ({ layer: 'captions' as const, id })),
  ]
}

const event = (verb: EngineEvent['verb'], toState: string, atFrame: number): EngineEvent =>
  ({ id: `${verb}-${toState}`, obj: 'hero', verb, toState, atFrame })

/** Subjects and figures: Wed 11 script-short-v2 and Fri 13 article, THE LEADERBOARDS.
 * Nothing from the rejected Thursday piece, device fixtures, or a captured screen is rendered. */
function scene(kind: string): { object: EngineObject; events: EngineEvent[]; title: string } {
  const common = { obj: 'hero', meaning: 'Drawn illustration of the published argument', variants: {}, fromFrame: 0, toFrame: 180 }
  const enter = event('enter', 'visible', 0)
  if (kind === 'music') return {
    title: 'WHO DID\nWHICH BIT?',
    object: { ...common, device: 'arrangement', params: { title: 'Movin’ To The Sun', lanes: [
      { id: 'human', name: 'ULTRA NATÉ', kind: 'human', hidden: false },
      { id: 'robot', name: 'AI SINGER', kind: 'ai', hidden: false },
    ] } }, events: [enter],
  }
  if (kind === 'receipt') return {
    title: 'COUNTING\nTHE WRONG THING',
    object: { ...common, device: 'receipt_print', params: { title: 'META · TOKEN USE', lines: [
      { key: 'staff', row: 'Staff' }, { key: 'rank', row: 'Ranked users' },
    ] }, dataset: { unit: '', denominator: null, producerLabel: 'FORTUNE · APRIL 2026', rows: [
      { label: 'Staff', value: 85000 }, { label: 'Ranked users', value: 250 },
    ] } }, events: [enter, event('add', 'staff', 6), event('add', 'rank', 18), event('highlight', 'rank', 36)],
  }
  if (kind === 'type') return {
    title: 'AI MUSIC\nOR HUMAN MUSIC?',
    object: { ...common, device: 'headline', params: { lines: ['ALREADY', 'BOTH'], at: { x: 72, y: 500, w: 800, h: 420 }, swipe: { line: 1, word: 0 } } }, events: [enter],
  }
  return {
    title: 'A BILL BECAME\nA LEADERBOARD',
    object: { ...common, device: 'kinetic_stat', params: {}, dataset: {
      unit: 'TRILLION TOKENS · 30 DAYS', denominator: null,
      producerLabel: 'META · FORTUNE · APRIL 2026', rows: [{ label: 'Tokens', value: 60 }],
    } }, events: [enter, event('count_to', 'Tokens', 1)],
  }
}

export function StyleStill({ layer, id }: StyleStillProps): React.ReactElement | null {
  if (!stillIds().some(option => option.layer === layer && option.id === id)) return null
  const kind = layer === 'captions' ? 'music' : (layer === 'motion' ? motionScenes[id]! : looks[id]!)
  const subject = scene(kind)
  const profile = layer === 'motion' ? MOTION_PROFILES[id] : undefined
  const name = layer === 'captions' ? id.replaceAll('-', ' ') : layer === 'treatment'
    ? bank.formats.production.find(option => option.id === id)?.name
    : bank.bank.find(option => option.id === id)?.name
  const frame = 52
  const props = EngineRenderPropsSchema.parse({ ...base, tokens, captions: [{
    fromFrame: 0, toFrame: 180, words: ['Already', 'both'].map((text, i) => ({ text, atFrame: i * 18 })), swipeIndex: 1,
  }] })
  const Device = DEVICES[subject.object.device]!
  return <div data-style-still={`${layer}/${id}`} style={{ position: 'relative', width: CANVAS.w, height: CANVAS.h,
    overflow: 'hidden', background: tokens.ink, color: tokens.cream }}>
    <div style={{ position: 'absolute', inset: 0, ...groundTexture(profile?.ground.texture, tokens, frame) }} />
    <div style={{ position: 'absolute', left: ZONES.header.x, top: ZONES.header.y,
      fontFamily: F.data, fontSize: 30, letterSpacing: '0.14em' }}>{kind === 'music' || kind === 'type' ? 'under.the.hood' : 'mind.the.gap'}</div>
    <div style={{ position: 'absolute', left: ZONES.headline.x, top: ZONES.headline.y + 25, width: ZONES.headline.w,
      fontFamily: F.display, fontSize: kind === 'receipt' ? 100 : 116, lineHeight: 0.98, whiteSpace: 'pre-line' }}>{subject.title}</div>
    <div style={{ position: 'absolute', inset: 0, transform: `rotate(${profile?.entrance.tiltDeg ?? 0}deg)` }}>
      <Device object={subject.object} events={subject.events} box={{ left: 72, top: 480, width: 800, height: 540 }}
        tokens={tokens} aspect="9:16" frame={frame} />
    </div>
    {layer === 'captions' && <ThemedCaption props={props} theme={id as CaptionThemeName} frame={frame} />}
    <div style={{ position: 'absolute', left: ZONES.lower_line.x, top: ZONES.lower_line.y, width: ZONES.lower_line.w,
      fontFamily: F.structure, fontSize: 34, fontWeight: 900, textTransform: 'uppercase' }}>{name}</div>
  </div>
}
