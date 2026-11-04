import React, { type CSSProperties } from 'react'
import { ENTER, MOTION, motionProfile, progress } from '../clock'
import type { EngineTokens } from '../props'
import type { Focus } from './focus'
import type { MotionProfile } from './motionProfiles'

/** What a motion style lays on its grounds and over its graphics, each switched on only by that style's profile
 *  (kit/motion-profiles.json: ground.kind, ground.texture, overlays, boil). With no style none of these draws, so the
 *  house render is unchanged (houseGolden.test.ts). Every texture is generated from a seed, never an image asset, and
 *  is the same on every render of the same frame. */

type Box = { left: number; top: number; width: number; height: number }
const fixed = (n: number) => Number(n.toFixed(3))
const lerp = (a: number, b: number, q: number) => a + (b - a) * q

/** A stable small integer from a string: the seed of a beat's or an object's texture. */
export function seedOf(text: string): number {
  let h = 2166136261
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  return (h >>> 0) % 997 + 1
}

/** A deterministic 0 to 1 value for step `n` of seed `seed` (no Math.random: a render is the same every time). */
export function jitter(seed: number, n: number): number {
  const x = Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453
  return x - Math.floor(x)
}

// ---- grounds ---------------------------------------------------------------------------------------------------

/** Text devices whose words sit on a card of their own; under a dark ground they invert unless the style keeps cards. */
export const CARD_DEVICES: readonly string[] = ['typing_bubble', 'query_chip', 'evidence_card', 'quote_card', 'record_card', 'thread_card']
/** Text devices that draw their words straight on the ground: on a dark ground they always invert so they read. */
export const GROUND_TEXT_DEVICES: readonly string[] = ['headline', 'kinetic_stat', 'stat_strip', 'marquee']

/** Whether the active style lays its dark ground (ink_deep) under every graphic beat. */
export function darkGround(profile: MotionProfile | undefined): boolean {
  return profile?.ground.kind === 'dark'
}

/** Whether a text card is drawn inverted (dark card, cream type) under the active style. */
export function cardsInvert(profile: MotionProfile | undefined = motionProfile()): boolean {
  return darkGround(profile) && profile!.ground.cards !== 'keep'
}

/** The brand tokens a device draws with on a dark ground: card fill ink_soft, type cream, mint kept for the result.
 *  Logos, pictures and scribbles keep the house tokens (real logos are never recoloured). */
export function tokensFor(device: string, tokens: EngineTokens, profile: MotionProfile | undefined): EngineTokens {
  if (profile?.ground.kind !== 'dark') return tokens
  const invert = GROUND_TEXT_DEVICES.includes(device) || (CARD_DEVICES.includes(device) && profile!.ground.cards !== 'keep')
  return invert ? { ...tokens, cream: tokens.inkSoft, ink: tokens.cream, inkSoft: tokens.cream } : tokens
}

/** The ground colour of a SPLIT stage under the active style: the house cream, ink_deep, or the paper stock. */
export function splitGroundColour(profile: MotionProfile | undefined, tokens: EngineTokens): string {
  if (darkGround(profile)) return tokens.inkDeep
  if (profile?.ground.texture === 'paper') return paperStock(tokens)
  return tokens.cream
}

/** A hex colour multiplied by itself `times` times (the multiply blend of a stock laid on itself): the house cream
 *  this way grows warmer and deeper without leaving its own hue, so the paper stays in the cream family. Anything that
 *  is not a six digit hex falls back to a plain mix toward `toward`. */
export function deepen(hex: string, times: number, fallbackPct = 88, toward = '#000'): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) return `color-mix(in srgb, ${hex} ${fallbackPct}%, ${toward})`
  const n = parseInt(m[1]!, 16)
  return '#' + [16, 8, 0].map(shift => Math.round(255 * ((n >> shift & 255) / 255) ** (times + 1)))
    .map(v => v.toString(16).padStart(2, '0')).join('')
}

/** The paper stock under a paper-cutout beat: the house cream laid on itself twice, a warm card stock a step deeper
 *  than the cream cut-outs, so they stand off it. Brand roles only. */
export function paperStock(tokens: EngineTokens): string {
  return deepen(tokens.cream, 2, 90, tokens.inkSoft)
}

/** The white of a torn paper edge: the house cream lifted toward white, the paper's core showing where it tore. */
export function paperCore(tokens: EngineTokens): string {
  return `color-mix(in srgb, ${tokens.cream} 35%, #fff)`
}

/** The colour of a fleck or fibre in the stock: the cream laid on itself many times, a warm brown of its own hue. */
function fleck(tokens: EngineTokens): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(deepen(tokens.cream, 12))
  if (!m) return [0.35, 0.28, 0.18]
  const n = parseInt(m[1]!, 16)
  return [16, 8, 0].map(shift => fixed((n >> shift & 255) / 255)) as [number, number, number]
}

/** A seeded paper surface: mottled stock, grain, dark flecks and long pale and dark fibres, generated by SVG turbulence
 *  (no image asset) at sizes that still read on a 540 px wide phone frame. Fixed for the beat, as paper is. */
export function PaperTexture({ id, width, height, tokens }: { id: string; width: number; height: number; tokens: EngineTokens }) {
  const seed = seedOf(id)
  const [r, g, b] = fleck(tokens)
  const dark = (alpha: number, bias: number) => `0 0 0 0 ${r}  0 0 0 0 ${g}  0 0 0 0 ${b}  0 0 0 ${alpha} ${bias}`
  const layer = (name: string, opacity: number) =>
    <rect width={width} height={height} filter={`url(#paper-${name}-${id})`} opacity={opacity} />
  return <svg data-paper width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true"
    style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
    <defs>
      {/* Mottle: the slow unevenness of card stock. */}
      <filter id={`paper-mottle-${id}`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.008 0.012" numOctaves={3} seed={seed + 3} />
        <feColorMatrix values={dark(1.6, -0.62)} />
      </filter>
      {/* Grain: a tooth fine enough to be paper, coarse enough to survive a half size frame. */}
      <filter id={`paper-grain-${id}`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.42" numOctaves={2} seed={seed} />
        <feColorMatrix values={dark(2.4, -1.05)} />
      </filter>
      {/* Flecks: the odd dark speck pressed into the pulp. */}
      <filter id={`paper-fleck-${id}`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={1} seed={seed + 11} />
        <feColorMatrix values={dark(9, -6.1)} />
      </filter>
      {/* Fibres: long, thin, mostly level, dark and pale. */}
      <filter id={`paper-fibre-${id}`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.035 0.11" numOctaves={3} seed={seed + 7} />
        <feColorMatrix values={dark(5, -3.2)} />
      </filter>
      <filter id={`paper-pale-${id}`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.04 0.13" numOctaves={3} seed={seed + 19} />
        <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 5 -3.1" />
      </filter>
      <radialGradient id={`paper-light-${id}`} cx="42%" cy="30%" r="80%">
        <stop offset="0%" stopColor={tokens.cream} stopOpacity={0.42} />
        <stop offset="100%" stopColor={deepen(tokens.cream, 5)} stopOpacity={0.35} />
      </radialGradient>
    </defs>
    <rect width={width} height={height} fill={`url(#paper-light-${id})`} />
    {layer('mottle', 0.5)}{layer('grain', 0.7)}{layer('fibre', 0.5)}{layer('pale', 0.6)}{layer('fleck', 0.55)}
  </svg>
}

/** Faint static scan lines on a dark ground, under the devices: never noise over the proof (hud-terminal's avoid
 *  list). */
export function scanLines(tokens: EngineTokens): CSSProperties {
  return { backgroundImage: `repeating-linear-gradient(0deg, color-mix(in srgb, ${tokens.cream} 7%, transparent) 0px, color-mix(in srgb, ${tokens.cream} 7%, transparent) 2px, transparent 2px, transparent 6px)`,
    pointerEvents: 'none' }
}

// ---- overlays --------------------------------------------------------------------------------------------------

/** The focus rect the brackets hold at this frame: between the last line and this one while the lock travels. */
export function bracketRect(focus: Focus): { rect: Box; lock: number } {
  const lock = progress(focus.since, MOTION.slapFrames, ENTER)
  const move = focus.from ? progress(focus.since, MOTION.slapFrames, ENTER) : 1
  const r = focus.from ? { left: lerp(focus.from.left, focus.rect.left, move), top: lerp(focus.from.top, focus.rect.top, move),
    width: lerp(focus.from.width, focus.rect.width, move), height: lerp(focus.from.height, focus.rect.height, move) } : focus.rect
  // The corners land from 36 px out with the slap token and close onto the line with 14 px of air.
  const grow = 14 + 36 * (1 - Math.min(1, lock))
  return { lock, rect: { left: r.left - grow, top: r.top - grow, width: r.width + 2 * grow, height: r.height + 2 * grow } }
}

/** Lock-on bracket corners round the line that proves the words (hud-terminal), in mint, the result colour. */
export function Brackets({ focus, width, height, tokens }: { focus: Focus; width: number; height: number; tokens: EngineTokens }) {
  const { rect, lock } = bracketRect(focus)
  const arm = Math.min(56, rect.width / 3, rect.height / 2)
  const { left: x, top: y } = rect
  const r = x + rect.width, b = y + rect.height
  const d = [`M${fixed(x)} ${fixed(y + arm)}V${fixed(y)}H${fixed(x + arm)}`, `M${fixed(r - arm)} ${fixed(y)}H${fixed(r)}V${fixed(y + arm)}`,
    `M${fixed(r)} ${fixed(b - arm)}V${fixed(b)}H${fixed(r - arm)}`, `M${fixed(x + arm)} ${fixed(b)}H${fixed(x)}V${fixed(b - arm)}`].join('')
  return <svg data-brackets width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true"
    style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', opacity: Math.min(1, Math.max(0, lock)) }}>
    <path d={d} fill="none" stroke={tokens.mint} strokeWidth={6} strokeLinecap="square" />
  </svg>
}

/** Devices that are a card or a logo tile: under paper-cutout each is cut out with a torn edge and a hard shadow. */
export const TORN_DEVICES: readonly string[] = [...CARD_DEVICES, 'logo_card', 'sticker', 'stamp', 'passport_page']

/** The most a cut-out may lean, in degrees: a text card a little less than a logo tile, so its words read level.
 *  Captions and the mark tile are never cut-outs and never lean. */
export const CUTOUT_TILT = { card: 1.5, tile: 2 } as const

/** How one cut-out sits on frame step `step` (the style's twos): a small fixed lean of its own, seeded by the object,
 *  never zero and never past CUTOUT_TILT; and a nudge of at most 1 px a step, as a hand moving paper would leave it.
 *  Only for TORN_DEVICES; the same for the same object and step on every render. */
export function cutoutPose(objectId: string, device: string, step: number, ownLean = true): { tiltDeg: number; dx: number; dy: number } {
  const seed = seedOf(objectId)
  const dx = fixed(2 * jitter(seed + 13, step) - 1), dy = fixed(2 * jitter(seed + 29, step) - 1)
  return { tiltDeg: ownLean ? lean(seed, CARD_DEVICES.includes(device) ? CUTOUT_TILT.card : CUTOUT_TILT.tile) : 0, dx, dy }
}

/** A seeded lean between 45% and 100% of `most`, either way: never level, never past `most`. */
function lean(seed: number, most: number): number {
  return fixed((jitter(seed, 0) < 0.5 ? -1 : 1) * most * (0.45 + 0.55 * jitter(seed + 5, 1)))
}

/** The lean of tile `index` of a logo_card under paper-cutout: each tile is its own cut-out, so the card leans tile by
 *  tile (and the device itself does not, cutoutPose's ownLean false). 0 under any other style, so nothing else moves. */
export function tileLean(objectId: string, index: number, profile: MotionProfile | undefined = motionProfile()): number {
  return profile?.overlays?.includes('torn') ? lean(seedOf(`${objectId}#${index}`), CUTOUT_TILT.tile) : 0
}

/** The torn paper filter of one beat: the card's own outline grown into a thick rim of paper, torn by two seeded
 *  turbulences (the rough tear and its fibres), white at the core, with a sliver of its cut side showing and a hard
 *  4 px offset shadow under it. The content inside is never displaced, so type stays crisp. Still for the beat: the
 *  paper is what it is; the hand moves it (cutoutPose). */
export function TornFilter({ id, tokens }: { id: string; tokens: EngineTokens }) {
  const seed = seedOf(id)
  return <svg width={0} height={0} aria-hidden="true" style={{ position: 'absolute' }}>
    <defs>
      <filter id={`torn-${id}`} x="-6%" y="-6%" width="112%" height="112%" colorInterpolationFilters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={4} seed={seed} result="tear" />
        <feTurbulence type="fractalNoise" baseFrequency="0.6" numOctaves={1} seed={seed + 2} result="fibre" />
        <feMorphology in="SourceAlpha" operator="dilate" radius={12} result="grown" />
        <feDisplacementMap in="grown" in2="tear" scale={26} xChannelSelector="R" yChannelSelector="G" result="torn" />
        <feDisplacementMap in="torn" in2="fibre" scale={7} xChannelSelector="R" yChannelSelector="G" result="rim" />
        <feFlood floodColor={paperCore(tokens)} result="white" />
        <feComposite in="white" in2="rim" operator="in" result="paper" />
        {/* The cut side: the rim again, 2 px down and right, in a deeper stock. */}
        <feOffset in="rim" dx={2} dy={2} result="sideAt" />
        <feFlood floodColor={deepen(tokens.cream, 4)} result="sideColour" />
        <feComposite in="sideColour" in2="sideAt" operator="in" result="side" />
        {/* A hard shadow 4 px off, barely blurred, and a faint wider one so it lifts off the stock. */}
        <feGaussianBlur in="rim" stdDeviation={1} result="hardBlur" />
        <feOffset in="hardBlur" dx={4} dy={4} result="hardAt" />
        <feFlood floodColor={tokens.inkDeep} floodOpacity={0.62} result="hardShade" />
        <feComposite in="hardShade" in2="hardAt" operator="in" result="hard" />
        <feGaussianBlur in="rim" stdDeviation={7} result="softBlur" />
        <feOffset in="softBlur" dx={3} dy={9} result="softAt" />
        <feFlood floodColor={tokens.inkDeep} floodOpacity={0.3} result="softShade" />
        <feComposite in="softShade" in2="softAt" operator="in" result="soft" />
        <feMerge><feMergeNode in="soft" /><feMergeNode in="hard" /><feMergeNode in="side" /><feMergeNode in="paper" /><feMergeNode in="SourceGraphic" /></feMerge>
      </filter>
    </defs>
  </svg>
}

/** The torn bottom edge of the graphic paper on a SPLIT beat: where the stock meets his take it is torn, its white core
 *  showing, with a hard shadow onto the picture. Seeded per beat and still. Drawn under the captions and the mark
 *  tile, which stay clean. */
export function TornSeam({ id, width, seam, tokens }: { id: string; width: number; seam: number; tokens: EngineTokens }) {
  const seed = seedOf(id)
  const edge = (base: number, reach: number, s: number) => {
    const out: string[] = []
    for (let x = 0, k = 0; x < width + 9; x += 9, k++) {
      const slow = Math.sin((x / width) * Math.PI * (2 + jitter(s, 99)) + jitter(s, 98) * 6)
      out.push(`${fixed(Math.min(x, width))} ${fixed(base + reach * (0.5 + 0.3 * slow + 0.35 * (jitter(s, k) - 0.5)))}`)
    }
    return out
  }
  // The coloured surface tears back above the line; the white core hangs below it.
  const top = edge(seam - 12, 10, seed), bottom = edge(seam + 2, 14, seed + 41)
  const core = `M${top.join('L')}L${[...bottom].reverse().join('L')}Z`
  return <svg data-torn-seam width={width} height={seam + 40} viewBox={`0 0 ${width} ${seam + 40}`} aria-hidden="true"
    style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
    <defs>
      <filter id={`seam-shadow-${id}`} x="-2%" y="-50%" width="104%" height="200%"><feGaussianBlur stdDeviation={1.2} /></filter>
    </defs>
    <path d={core} transform="translate(0 4)" fill={tokens.inkDeep} opacity={0.55} filter={`url(#seam-shadow-${id})`} />
    <path d={core} fill={paperCore(tokens)} />
  </svg>
}

/** The seed a boiling line uses at `sinceFrames`: a new one every `everyFrames` frames, never repeating. */
export function boilSeed(base: number, sinceFrames: number, everyFrames: number): number {
  return base + Math.max(0, Math.floor(Math.max(0, sinceFrames) / everyFrames))
}

/** A seeded displacement for stroked shapes only (scribbles, drawn lines, outlines): line-boil. Never put on text or
 *  numbers; kit/Scribble.tsx and SketchFrame are its only users. */
export function BoilFilter({ id, seed, amplitudePx }: { id: string; seed: number; amplitudePx: number }) {
  return <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
    <feTurbulence type="turbulence" baseFrequency="0.035" numOctaves={2} seed={seed} result="wobble" />
    {/* feDisplacementMap moves a pixel by scale x (channel - 0.5): scale 2a keeps it within a px of the line. */}
    <feDisplacementMap in="SourceGraphic" in2="wobble" scale={fixed(2 * amplitudePx)} xChannelSelector="R" yChannelSelector="G" />
  </filter>
}

/** A hand-drawn panel line round the graphic ground (line-boil): a cream line on ink, wobbling as it boils. */
export function SketchFrame({ id, width, height, tokens, sinceFrames, boil }: {
  id: string; width: number; height: number; tokens: EngineTokens; sinceFrames: number; boil: { amplitudePx: number; everyFrames: number }
}) {
  const seed = seedOf(id)
  const inset = 36
  const points: [number, number][] = []
  const corners: [number, number][] = [[inset, inset], [width - inset, inset], [width - inset, height - inset], [inset, height - inset]]
  corners.forEach(([x, y], i) => {
    const [nx, ny] = corners[(i + 1) % 4]!
    for (let k = 0; k < 6; k++) {
      const q = k / 6
      points.push([x + (nx - x) * q + 5 * (jitter(seed, i * 6 + k) - 0.5), y + (ny - y) * q + 5 * (jitter(seed + 3, i * 6 + k) - 0.5)])
    }
  })
  const d = `M${points.map(([x, y]) => `${fixed(x)} ${fixed(y)}`).join('L')}Z`
  const filter = `boil-frame-${id}`
  // The pen draws the frame on over the entrance, the way a hand would.
  const drawn = progress(sinceFrames, MOTION.enterFrames * 3, ENTER)
  return <svg data-sketch-frame width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true"
    style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none' }}>
    <defs><BoilFilter id={filter} seed={boilSeed(seed, sinceFrames, boil.everyFrames)} amplitudePx={boil.amplitudePx} /></defs>
    <path data-boil d={d} pathLength={1} strokeDasharray={1} strokeDashoffset={fixed(1 - drawn)} fill="none" stroke={tokens.cream}
      strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" filter={`url(#${filter})`} />
  </svg>
}
