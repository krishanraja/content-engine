import React from 'react'
import { HOUSE_FONTS } from '../../house/geometry'
import { textWidth, wrapWords } from '../../house/metrics'
import { ENTER, MOTION, progress } from '../clock'
import type { EngineBeat, EngineEvent, EngineObject, EngineRenderProps, EngineTokens } from '../props'

type EngineCaptionPage = EngineRenderProps['captions'][number]
import { entranceStyle } from './reveal'
import { chromeZone } from '../geometry'

/** Type as hero (swiss-kinetic-type, "Type is the picture: one headline set huge on a strict modular grid, words
 *  entering on the grid lines"). The beat's key phrase is set in Anton at the largest size that fits the channel safe
 *  area, words sliding in on the grid, one accent (mint, as a fill behind the answer word so it reads on cream). The
 *  phrase is the text of the beat's text devices (which it then stands in for), else the clause of his words being
 *  spoken on that beat (the captions). Only drawn when the profile says `type.hero`. */

type Box = { left: number; top: number; width: number; height: number }
export interface HeroWord { text: string; at: number; accent: boolean }
export interface HeroPhrase { label?: string | undefined; words: HeroWord[]; replaces: string[] }
export interface HeroLayout { size: number; lineHeight: number; words: (HeroWord & { x: number; y: number; width: number })[]; label?: { text: string; x: number; y: number; size: number } | undefined }

/** Text devices whose words the hero type can carry, and how to read them. */
const TEXT_OF: Readonly<Record<string, (params: Record<string, unknown>) => { label?: string | undefined; lines: string[] } | undefined>> = {
  headline: (p) => Array.isArray(p.lines) ? { lines: p.lines as string[] } : undefined,
  query_chip: (p) => typeof p.text === 'string' ? { lines: [p.text] } : undefined,
  quote_card: (p) => typeof p.quote === 'string' ? { lines: [p.quote] } : undefined,
  typing_bubble: (p) => {
    const rows = Array.isArray(p.rows) ? p.rows as { who?: string; text?: string }[] : []
    const lines = rows.map(r => r.text).filter((t): t is string => !!t && t.trim().length > 0)
    if (!lines.length) return undefined
    // A chat names its people; a notification's first sender is the label over the words.
    return { label: p.kind === 'chat' ? undefined : rows.find(r => r.who)?.who, lines }
  },
}
export const HERO_TEXT_DEVICES: readonly string[] = Object.keys(TEXT_OF)

const STAGGER = () => MOTION.staggerFrames
// Opening text is already landed (clock.stateAt pre-rolls opening entrances): far enough back that it shows whole.
const LANDED = -100000

/** The beat's key phrase at `frame`: its text devices' words, or the clause of the captions spoken now. */
export function heroPhrase(beat: EngineBeat, objects: ReadonlyMap<string, EngineObject>, events: readonly EngineEvent[],
  captions: readonly EngineCaptionPage[], frame: number): HeroPhrase | undefined {
  const replaces: string[] = []
  const words: HeroWord[] = []
  let label: string | undefined
  for (const id of beat.uses) {
    const object = objects.get(id)
    const read = object && Object.hasOwn(TEXT_OF, object.device) ? TEXT_OF[object.device]!(object.params) : undefined
    if (!object || !read) continue
    replaces.push(id)
    label ??= read.label
    // Each line enters on its own cue (the device's type or enter events, in order), its words staggered on the grid.
    const cues = events.filter(e => e.obj === id && (e.verb === 'type' || e.verb === 'enter')).map(e => e.atFrame).sort((a, b) => a - b)
    const typed = events.filter(e => e.obj === id && e.verb === 'type').map(e => e.atFrame).sort((a, b) => a - b)
    read.lines.forEach((line, i) => {
      const start = typed[i] ?? cues[i] ?? cues[0] ?? beat.fromFrame
      line.trim().split(/\s+/).forEach((text, k) => words.push({ text, at: start === 0 ? LANDED : start + k * STAGGER(), accent: false }))
    })
  }
  if (!words.length) {
    // No text device: the clause of his words being spoken on this beat.
    const spoken = captions.flatMap(page => page.words.map((w, i) => ({ text: w.text, at: w.atFrame, loud: page.swipeIndex === i })))
      .filter(w => w.at >= beat.fromFrame && w.at < beat.toFrame)
    if (!spoken.length) return undefined
    const clauses: (typeof spoken)[] = [[]]
    for (const w of spoken) {
      const clause = clauses.at(-1)!
      clause.push(w)
      if (/[.,;:!?]$/.test(w.text) || clause.length >= 5) clauses.push([])
    }
    const live = clauses.filter(c => c.length)
    const now = [...live].reverse().find(c => c[0]!.at <= frame) ?? live[0]!
    const loud = now.findIndex(w => w.loud)
    now.forEach((w, i) => words.push({ text: w.text.replace(/[,;:]$/, ''), at: w.at, accent: loud >= 0 ? i === loud : i === now.length - 1 }))
    return { words, replaces }
  }
  words[words.length - 1]!.accent = true
  return { label, words, replaces }
}

/** Where the hero type may sit: the channel safe area of the beat's graphic ground (tall: y 200 to 1320, x 60 to 860
 *  below y 520, config/channel-safe-zones.json), under the wide cut's mark tile and pill or the tall cut's top bar (nothing collides with the mark tile,
 *  MOTION_STANDARD rule 3), above the seam on a SPLIT beat, and above the devices it keeps. */
export function heroArea(aspect: '9:16' | '16:9', groundHeight: number, keepsDevices: boolean): Box {
  const chrome = chromeZone(aspect)
  const clear = chrome.top + chrome.height + 24
  if (aspect === '16:9') {
    const top = Math.max(120, clear)
    const bottom = Math.min(960, groundHeight - 60)
    return { left: 120, top, width: 1680, height: keepsDevices ? (bottom - top) * 0.36 : bottom - top }
  }
  const top = Math.max(200, clear)
  const floor = Math.min(1320, groundHeight - 30)
  const bottom = keepsDevices ? top + (floor - top) * 0.36 : floor
  const right = bottom > 520 ? 860 : 1020
  return { left: 60, top, width: right - 60, height: bottom - top }
}

/** The largest Anton size, uppercase, line height 0.9, at which the phrase fits the area under its label. */
export function heroLayout(phrase: HeroPhrase, area: Box): HeroLayout {
  const labelSize = 34
  const labelRoom = phrase.label ? labelSize * 1.6 : 0
  const text = phrase.words.map(w => w.text.toUpperCase()).join(' ')
  const lineHeight = 0.9
  let size = 300
  let lines = wrapWords('anton', text, size, area.width)
  for (; size > 48; size -= 2) {
    lines = wrapWords('anton', text, size, area.width)
    const widest = Math.max(...lines.map(l => textWidth('anton', l.join(' '), size)))
    if (lines.length * size * lineHeight <= area.height - labelRoom && widest <= area.width) break
  }
  const space = textWidth('anton', ' ', size)
  const placed: HeroLayout['words'] = []
  let k = 0
  lines.forEach((line, row) => {
    let x = area.left
    for (const word of line) {
      const w = textWidth('anton', word, size)
      placed.push({ ...phrase.words[k++]!, x, y: area.top + labelRoom + row * size * lineHeight, width: w })
      x += w + space
    }
  })
  return { size, lineHeight, words: placed,
    label: phrase.label ? { text: phrase.label, x: area.left, y: area.top, size: labelSize } : undefined }
}

/** The hero type itself, over a faint six-column grid on the ground. `onDark` sets it in cream. */
export function HeroType({ layout, frame, tokens, width, height, onDark }: {
  layout: HeroLayout; frame: number; tokens: EngineTokens; width: number; height: number; onDark: boolean
}) {
  const ink = onDark ? tokens.cream : tokens.ink
  const columns = Array.from({ length: 7 }, (_, i) => 60 + i * (width - 120) / 6)
  return <div data-hero-type style={{ position: 'absolute', left: 0, top: 0, width, height, pointerEvents: 'none' }}>
    {columns.map((x, i) => <div key={`col-${i}`} data-grid-line style={{ position: 'absolute', left: x, top: 0, width: 2, height,
      background: `color-mix(in srgb, ${ink} 9%, transparent)` }} />)}
    {layout.label && <div data-hero-label style={{ position: 'absolute', left: layout.label.x, top: layout.label.y,
      fontFamily: HOUSE_FONTS.data, fontSize: layout.label.size, lineHeight: 1, color: ink, letterSpacing: '0.02em' }}>{layout.label.text.toUpperCase()}</div>}
    {layout.words.map((w, i) => {
      const age = frame - w.at
      if (age < 0) return null
      const e = entranceStyle(progress(age, MOTION.enterFrames, ENTER))
      return <div key={i} data-hero-word data-accent={w.accent || undefined} style={{ position: 'absolute', left: w.x, top: w.y,
        width: w.width, height: layout.size * layout.lineHeight, ...e }}>
        {w.accent && <div style={{ position: 'absolute', left: -layout.size * 0.06, right: -layout.size * 0.06,
          top: layout.size * 0.06, bottom: -layout.size * 0.02, background: tokens.mint }} />}
        <span style={{ position: 'relative', display: 'block', fontFamily: HOUSE_FONTS.display, fontSize: layout.size,
          lineHeight: layout.lineHeight, color: w.accent ? tokens.inkDeep : ink, whiteSpace: 'nowrap', letterSpacing: '0.005em' }}>{w.text.toUpperCase()}</span>
      </div>
    })}
  </div>
}
