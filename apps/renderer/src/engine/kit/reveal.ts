import type { CSSProperties } from 'react'
import { ENTER, HERO, MOTION, motionProfile, progress } from '../clock'

/** The one text reveal and the one entrance look, shared by headline, query_chip and the composition's beat layer.
 *  With no motion style both return exactly the house values (a line rises 24 px and fades in, text shows whole). */

/** How an entering thing looks at eased progress p (0 to 1, a little over 1 while an overshoot settles). */
export function entranceStyle(p: number): CSSProperties {
  const profile = motionProfile()
  const d = MOTION.risePx
  if (!profile) return { opacity: p, transform: `translateY(${d * (1 - p)}px)` }
  const opacity = Math.min(1, Math.max(0, p))
  const base = kindStyle(profile.entrance.kind, p, d, opacity)
  const { blurPx, spinDeg, tiltDeg } = profile.entrance
  if (!blurPx && !spinDeg && !tiltDeg) return base
  // The extras (blur-in, a turn while entering, a resting tilt) compose over the kind's own look.
  const turn = (tiltDeg ?? 0) + (spinDeg ?? 0) * (1 - Math.min(1, Math.max(0, p)))
  return { ...base,
    ...(turn ? { transform: `${base.transform ?? ''} rotate(${turn.toFixed(3)}deg)`.trim() } : {}),
    ...(blurPx && opacity < 1 ? { filter: `blur(${(blurPx * (1 - opacity)).toFixed(2)}px)` } : {}) }
}

function kindStyle(kind: string, p: number, d: number, opacity: number): CSSProperties {
  switch (kind) {
    case 'rise': return { opacity, transform: `translateY(${d * (1 - p)}px)` }
    case 'drop': return { opacity, transform: `translateY(${-d * (1 - p)}px)` }
    case 'slide': return { opacity, transform: `translateX(${-d * (1 - p)}px)` }
    // Lands from 5% larger: never scaled past 105% (swiss-kinetic-type, avoid list).
    case 'slap': return { opacity, transform: `scale(${1 + 0.05 * (1 - p)})` }
    case 'scale': return { opacity, transform: `scale(${0.92 + 0.08 * p})` }
    case 'draw': return { opacity: p > 0 ? 1 : 0, clipPath: `inset(0 ${(100 * (1 - opacity)).toFixed(3)}% 0 0)` }
    default: return { opacity }
  }
}

export interface WordReveal { p: number; chars: number }
export interface LineReveal { p: number; words: WordReveal[]; roll: boolean }

/** Per line and per word, how much of a block of type shows `age` frames after its entrance. */
export function revealLines(lines: readonly string[], age: number): LineReveal[] {
  const profile = motionProfile()
  const kind = profile?.typeReveal.kind ?? 'line'
  const words = lines.map((line) => line.split(/\s+/))
  if (kind === 'line' || kind === 'roll') {
    return words.map((row, i) => ({ p: progress(age - i * MOTION.staggerFrames, MOTION.enterFrames, ENTER), roll: kind === 'roll',
      words: row.map((word) => ({ p: 1, chars: word.length })) }))
  }
  if (kind === 'word') {
    let k = 0
    return words.map((row) => ({ p: 1, roll: false,
      words: row.map((word) => ({ p: progress(age - (k++) * MOTION.staggerFrames, MOTION.enterFrames, ENTER), chars: word.length })) }))
  }
  // typewriter: one character after another at the profile's readable rate, a space counted between words.
  const typed = age < 0 ? 0 : Math.floor(age * (profile!.typeReveal.cps ?? 30) / 30)
  let at = 0
  return words.map((row) => ({ p: 1, roll: false, words: row.map((word) => {
    const chars = Math.min(word.length, Math.max(0, typed - at))
    at += word.length + 1
    return { p: chars > 0 ? 1 : 0, chars }
  }) }))
}

/** How many characters of a single string show `age` frames after it entered: all of it unless the style types. */
export function revealChars(text: string, age: number): number {
  const profile = motionProfile()
  if (profile?.typeReveal.kind !== 'typewriter') return [...text].length
  if (age < 0) return 0
  return Math.min([...text].length, Math.floor(age * (profile.typeReveal.cps ?? 30) / 30))
}

export interface Typed { text: string; caret: boolean; done: boolean }

/** What a typed device (typing_bubble, query_chip) shows `age` frames after its typing began, its lead already spent
 *  (Infinity for opening text, which is already typed). `spanFrames` is how long the house spreads the text over and
 *  `houseP` the house's own 0 to 1 progress, which the house and the line and word styles keep exactly.
 *  - typewriter: one character after another at the profile's cps (living-ui 30, hud-terminal 32), with a caret while
 *    it types; never so slow it is still typing when its span ends, so the words are always read whole.
 *  - roll: the text lands whole and its figures roll up from 0 over the profile's count frames. */
export function typedText(text: string, age: number, spanFrames: number, houseP: number): Typed {
  const chars = Array.from(text)
  const profile = motionProfile()
  const kind = profile?.typeReveal.kind
  if (kind === 'typewriter') {
    if (age < 0) return { text: '', caret: false, done: false }
    const rate = Math.max((profile!.typeReveal.cps ?? 30) / 30, chars.length / Math.max(1, spanFrames))
    const shown = Math.min(chars.length, Math.floor(age * rate))
    return { text: chars.slice(0, shown).join(''), caret: shown < chars.length, done: shown >= chars.length }
  }
  if (kind === 'roll') {
    if (age < 0) return { text: '', caret: false, done: false }
    const q = Number.isFinite(age) ? progress(age, MOTION.countFrames, HERO) : 1
    const rolled = q >= 1 ? text : chars.map((c) => /[0-9]/.test(c) ? String(Math.floor(Number(c) * q)) : c).join('')
    return { text: rolled, caret: false, done: q >= 1 }
  }
  const shown = Math.floor(chars.length * houseP)
  return { text: chars.slice(0, shown).join(''), caret: false, done: houseP >= 1 }
}
