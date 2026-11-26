import React from 'react'
import { Easing, Freeze, OffthreadVideo, interpolate } from 'remotion'
import { Grain, HouseLogo } from '../../house/components'
import { HOUSE_FONTS } from '../../house/geometry'
import { textWidth } from '../../house/metrics'
import type { EngineRenderProps } from '../props'
import { V5Outro } from './V5Outro'

/** The house close. Every whole cut dated from 26 Nov, series or off day, wide or tall, ends on the v5 outro card, the
 *  Library's video-vertical-outro or video-wide-outro (Ruling, Krish, 2026-11-26: "1 agreed"; config/brand-palette.json
 *  series_close): compile marks its props ending.look 'v5_outro' and V5Outro.tsx draws it, with S3h, "Follow for more",
 *  the address and the climb bars, and no tagline, days row or series name.
 *
 *  The statement card below is the close every cut dated before 26 Nov was signed with, and still renders as it was
 *  (props with no ending.look). It is the same card quick-edit's kit films (scripts/quick-edit/kit/endcard.html).
 *  Krish picked this direction, "C: the statement", on 10 Nov 2026,
 *  with the copy "Built to help you decide." (docs/production/CLOSING.md). The tagline is the picture: Anton, each line rising out of its own mask, the
 *  last word in the series colour; then, in reading order, the stacked logo on ink, the three days in their series
 *  colours, "Subscribe free" and the address, whose underline draws on last. Everything arrives fast and settles
 *  softly and has settled by 2.75 s; the wide card then holds to the end of its 6 s (compile ENDING_FRAMES = 180).
 *  The tall card is a compact end beat of 2 s (compile ENDING_FRAMES_BY_ASPECT), the same arrivals quicker and
 *  settled by 1.3 s, every word inside the tall core box x 120 to 820, y 330 to 1180 (config/brand-palette.json
 *  statement_beat; Ruling, Krish, 2026-11-12). An off-day card carries no series days (compile passes none).
 *  It replaces the ticker band (Krish, 10 Nov 2026: "This house card looks awful."; and earlier, no marquee). */

export const BAND_ARRIVAL_FRAMES = 0  // a hard cut to ink on his last word; the type brings the motion
const FPS = 30
const ARRIVE = Easing.bezier(0.16, 1, 0.3, 1)
const DRAW = Easing.bezier(0.65, 0, 0.35, 1)
export const ENDING_TAGLINE = 'Built to help you decide.'
export const ENDING_CTA = 'Subscribe free'
/** The three days in their series colours, used when compile does not pass them. */
export const ENDING_DAYS = [
  { day: 'Mondays', colour: '#FFD84D' }, { day: 'Wednesdays', colour: '#B7A6FF' }, { day: 'Fridays', colour: '#FF6A4D' },
] as const

/** When each part starts and how long it moves, in seconds (the same timings as kit's endcard.html). */
export const ENDING_TIMING = {
  line: { start: 0.1, step: 0.14, dur: 0.75 },
  logo: { start: 1.3, dur: 0.8 },
  days: { start: 1.5, dur: 0.8 },
  cta: { start: 1.6, dur: 0.8 },
  url: { start: 1.7, dur: 0.8 },
  underline: { start: 2.05, dur: 0.7 },
} as const
export const ENDING_SETTLED_S = ENDING_TIMING.underline.start + ENDING_TIMING.underline.dur
/** The tall beat's timings: the same order, quicker, settled by 1.3 s inside its 2 s (kit's endcard.html, tall). */
export const ENDING_TIMING_TALL = {
  line: { start: 0.1, step: 0.08, dur: 0.5 },
  logo: { start: 0, dur: 0.5 },
  days: { start: 0.5, dur: 0.5 },
  cta: { start: 0.6, dur: 0.5 },
  url: { start: 0.66, dur: 0.5 },
  underline: { start: 0.8, dur: 0.5 },
} as const
export const ENDING_SETTLED_TALL_S = ENDING_TIMING_TALL.underline.start + ENDING_TIMING_TALL.underline.dur

/** The close card's sizes. The SUBSCRIBE FREE line is 26 px on both (Ruling, Krish, 2026-11-19: "Yes on raising subscribe free"):
 *  at 24 px it read 17 px tall, under ve qc's small-text floor of 18 px, so every whole cut failed composition small_text on
 *  its own close. */
export const SHAPE = {
  // Tall: every word inside the tall core box x 120 to 820, y 330 to 1180 (config/brand-palette.json safe.tall_core,
  // docs/production/SOCIAL-BEST-PRACTICES-2026.md section 3.5). Wide: a 160 x 120 margin.
  '9:16': { box: { left: 120, top: 330, width: 700, height: 850 }, logo: 420, statement: 176, days: 24, kick: 26, url: 46, gap: 30 },
  '16:9': { box: { left: 160, top: 120, width: 1600, height: 840 }, logo: 520, statement: 190, days: 26, kick: 26, url: 44, gap: 0 },
} as const

/** The tagline as the card sets it: the last word alone on the last line; the rest two words a line on the tall card,
 *  one line on the wide. Lines break only between words. */
export function statementLines(aspect: EngineRenderProps['aspect'], tagline: string = ENDING_TAGLINE): string[] {
  const words = tagline.split(/\s+/).filter(Boolean)
  const head = words.slice(0, -1)
  const last = words[words.length - 1] ?? ''
  const lines = aspect === '9:16'
    ? Array.from({ length: Math.ceil(head.length / 2) }, (_, i) => head.slice(2 * i, 2 * i + 2).join(' '))
    : head.length ? [head.join(' ')] : []
  return [...lines, last]
}

export function endingBandLayout(props: Pick<EngineRenderProps, 'aspect' | 'brand' | 'series' | 'ending'>) {
  const tall = props.aspect === '9:16'
  const width = tall ? 1080 : 1920
  const height = tall ? 1920 : 1080
  const shape = SHAPE[props.aspect]
  const lines = statementLines(props.aspect, props.ending?.tagline)
  // The statement shrinks, never wraps or overflows, if a longer tagline is ever given.
  let statementPx: number = shape.statement
  const widest = () => Math.max(...lines.map((line) => textWidth('anton', line.toUpperCase(), statementPx, 0.005)))
  while (statementPx > 60 && widest() > shape.box.width) statementPx -= 2
  const logoWidth = shape.logo
  const logoHeight = logoWidth * props.brand.stacked.pixelHeight / props.brand.stacked.pixelWidth
  return { left: 0, top: 0, width, height, lines, statementPx, logoWidth, logoHeight, contentBox: { ...shape.box } }
}

function moved(since: number, part: { start: number; dur: number }, easing = ARRIVE): number {
  return interpolate(since / FPS, [part.start, part.start + part.dur], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing })
}

export function endingBandModel(props: EngineRenderProps, frame: number) {
  if (!props.ending || frame < props.ending.fromFrame || frame >= props.durationFrames) return null
  const layout = endingBandLayout(props)
  const since = frame - props.ending.fromFrame
  const tall = props.aspect === '9:16'
  const t = tall ? ENDING_TIMING_TALL : ENDING_TIMING
  return {
    ...layout,
    since,
    lines: layout.lines.map((text, i) => ({ text, rise: moved(since, { start: t.line.start + t.line.step * i, dur: t.line.dur }) })),
    logo: moved(since, t.logo), days: moved(since, t.days), cta: moved(since, t.cta), url: moved(since, t.url),
    underline: moved(since, t.underline, DRAW),
    settled: since / FPS >= (tall ? ENDING_SETTLED_TALL_S : ENDING_SETTLED_S),
    // Kept for callers that read the old band's arrival: the card is on screen from its first frame.
    arrival: 1,
  }
}

const rise = (p: number): React.CSSProperties => ({ opacity: p, transform: `translateY(${(1 - p) * 34}px)` })

/** The retired series close on the intro sting (Ruling, Krish, 2026-11-20: "A, with Built to help you decide, and then
 *  Subscribe free at makeyourmindup.ai"; retired by Ruling, Krish, 2026-11-26: "1 agreed"). Drawn only for a series cut
 *  dated 23 to 25 Nov that was signed with it (props.ending.sting, F33); compile gives no other cut one. All timings in
 *  frames from the close's first frame, at 30 fps, on the house curves (config/ve/brand-tokens.json motion). */
const HERO = Easing.bezier(0.16, 1, 0.3, 1)
const UTILITY = Easing.bezier(0.2, 0, 0, 1)
export const STING_CLOSE = {
  tall: {
    /** c 0 to 29: the sting's frames 1 to 44 at 1.5x; then its settled band, frame 48, held. */
    playFrames: 30, firstFrame: 1, lastPlayed: 44, holdFrame: 48,
    /** The band lifts 450 px (the mock's 330 left the lower core box empty): the wordmark then sits at y 334 to 572, just
     *  inside the tall core box, and the line block fills the box below it down to y 1180. */
    lift: { start: 30, dur: 12, px: 450 },
    line: { start: 34, dur: 10, travel: 500 }, accent: { start: 40, dur: 10, travel: 500 },
    action: { start: 46, dur: 8, rise: 14 },
    /** Left-aligned on the wordmark's own left edge (x 122 in every 9:16 clip's frame 48), to the core box's right edge.
     *  "BUILT TO HELP YOU" at 100 px is 683 px wide, about the wordmark's 730. */
    box: { left: 122, width: 698, lineTop: 735, accentTop: 812, pillTop: 1012, urlTop: 1108 },
    sizes: { line: 100, accent: 190, pill: 56, url: 58 },
  },
  wide: {
    /** The full sting, then on its band frame the ink ground wipes in from the right and the band takes the masthead slot. */
    bandFrame: 48, wipe: { start: 48, dur: 12 }, line: { start: 54, dur: 12, travel: 300 }, action: { start: 66, dur: 10 },
    /** The band as the sting draws it on its settled frame (measured from the 16:9 clips, every series alike). */
    band: [[0, 444], [1920, 310], [1920, 711], [0, 846]] as const,
    masthead: { dx: -80, dy: -110, scale: 0.5 },
    box: { left: 120, lineTop: 400, lineWidth: 920, daysTop: 720, actionTop: 790, urlTop: 892 },
    sizes: { line: 120, accent: 180, pill: 56, url: 58, days: 44 },
    /** YouTube's end-screen elements: nothing of the close is drawn here once it has settled. */
    endScreen: { left: 1100, top: 150, right: 1800, bottom: 880 },
  },
} as const
/** Words on screen are at least 40 px (config/ve/shot-grammar.json evidence.words_min_px), and the action's pill and
 *  address at least 40 px of cap height: the faces' cap heights as a share of their size. */
export const CAP_HEIGHT = { display: 0.86, structure: 0.72, data: 0.7, dek: 0.7 } as const
/** Settled frames: the tall beat at its action's end (well inside its 60), the wide card by 2.75 s. */
export const STING_CLOSE_SETTLED = { tall: STING_CLOSE.tall.action.start + STING_CLOSE.tall.action.dur,
  wide: STING_CLOSE.wide.action.start + STING_CLOSE.wide.action.dur } as const

/** The sting's own frame shown at the close's frame `since`. */
export function stingCloseFrame(aspect: EngineRenderProps['aspect'], since: number): number {
  const t = STING_CLOSE.tall
  if (aspect === '9:16') {
    return since < t.playFrames ? t.firstFrame + Math.round(since * (t.lastPlayed - t.firstFrame) / (t.playFrames - 1)) : t.holdFrame
  }
  return Math.min(Math.max(0, since), STING_CLOSE.wide.bandFrame)
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const phase = (since: number, part: { start: number; dur: number }, easing = HERO) => easing(clamp01((since - part.start) / part.dur))
/** Speed blur: a half-frame shutter, capped at 18 px (kit/ingredients.ts MAX_BLUR_PX). */
const speedBlur = (since: number, part: { start: number; dur: number; travel: number }) =>
  Math.min(18, Math.abs((1 - phase(since + 0.5, part)) * part.travel - (1 - phase(since - 0.5, part)) * part.travel) * 0.5)

export function stingCloseModel(props: EngineRenderProps, frame: number) {
  if (!props.ending?.sting || frame < props.ending.fromFrame || frame >= props.durationFrames) return null
  const since = frame - props.ending.fromFrame
  if (props.aspect === '9:16') {
    const t = STING_CLOSE.tall
    return { tall: true as const, since, stingFrame: stingCloseFrame('9:16', since), lift: phase(since, t.lift) * t.lift.px,
      line: phase(since, t.line), lineBlur: speedBlur(since, t.line), accent: phase(since, t.accent), accentBlur: speedBlur(since, t.accent),
      action: phase(since, t.action, UTILITY), settled: since >= STING_CLOSE_SETTLED.tall }
  }
  const w = STING_CLOSE.wide
  return { tall: false as const, since, stingFrame: stingCloseFrame('16:9', since), wipe: phase(since, w.wipe),
    line: phase(since, { ...w.line }), action: phase(since, w.action, UTILITY), settled: since >= STING_CLOSE_SETTLED.wide }
}

function StingPlate({ src, at, style }: { src: string; at: number; style?: React.CSSProperties }) {
  return <Freeze frame={at}><OffthreadVideo src={src} muted style={{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%', objectFit: 'cover', ...style }} /></Freeze>
}

/** Krish's pick of 20 Nov, direction A. Tall: the band lifts and the line lands under it in ink, inside the tall core box.
 *  Wide: the sting resolves into the statement card, the right 44% clear for the end screen. */
export function StingClose({ props, frame }: { props: EngineRenderProps; frame: number }): React.ReactElement | null {
  const model = stingCloseModel(props, frame)
  const sting = props.ending?.sting
  if (!model || !sting || !props.ending) return null
  const tokens = props.brandTokens ?? props.tokens
  const url = props.ending.url
  const cta = props.ending.cta ?? ENDING_CTA
  const pill = (size: number, onInk: boolean, p: number, rise: number): React.ReactElement => (
    <span style={{ fontFamily: HOUSE_FONTS.structure, fontStretch: '62%', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
      fontSize: size, lineHeight: 1.1, whiteSpace: 'nowrap', background: onInk ? tokens.mint : tokens.ink, color: onInk ? tokens.ink : tokens.cream,
      display: 'inline-block', padding: `${Math.round(size * 0.22)}px ${Math.round(size * 0.5)}px`, borderRadius: 60, opacity: p, transform: `translateY(${(1 - p) * rise}px)` }}>{cta}</span>
  )
  const mono: React.CSSProperties = { fontFamily: HOUSE_FONTS.data, fontWeight: 500, letterSpacing: '0.06em', whiteSpace: 'nowrap' }
  const accent: React.CSSProperties = { fontFamily: HOUSE_FONTS.dek, fontStyle: 'italic', fontWeight: 560, letterSpacing: '-0.01em',
    lineHeight: 1.02, fontVariationSettings: '"opsz" 144, "SOFT" 60, "WONK" 0', whiteSpace: 'nowrap' }
  const display: React.CSSProperties = { fontFamily: HOUSE_FONTS.display, textTransform: 'uppercase', lineHeight: 0.88, letterSpacing: '0.005em', whiteSpace: 'nowrap' }
  const [tagHead, tagLast] = (() => {
    const words = (props.ending.tagline ?? ENDING_TAGLINE).split(/\s+/).filter(Boolean)
    return [words.slice(0, -1).join(' '), words[words.length - 1] ?? '']
  })()
  if (model.tall) {
    const t = STING_CLOSE.tall
    return (
      <div data-close="sting-beat" style={{ position: 'absolute', zIndex: 920, left: 0, top: 0, width: 1080, height: 1920, overflow: 'hidden', background: tokens.channel, pointerEvents: 'none' }}>
        <StingPlate src={sting.src} at={model.stingFrame} style={{ height: 1920, top: -model.lift }} />
        <div style={{ ...display, position: 'absolute', left: t.box.left, top: t.box.lineTop, color: tokens.ink, fontSize: t.sizes.line,
          opacity: model.line > 0 ? 1 : 0, transform: `translateX(${(1 - model.line) * t.line.travel}px)`, filter: `blur(${model.lineBlur}px)` }}>{tagHead}</div>
        <div style={{ ...accent, position: 'absolute', left: t.box.left - 4, top: t.box.accentTop, color: tokens.ink, fontSize: t.sizes.accent,
          opacity: model.accent > 0 ? 1 : 0, transform: `translateX(${(1 - model.accent) * t.accent.travel}px)`, filter: `blur(${model.accentBlur}px)` }}>{tagLast}</div>
        <div style={{ position: 'absolute', left: t.box.left, top: t.box.pillTop, opacity: model.action, transform: `translateY(${(1 - model.action) * t.action.rise}px)` }}>
          {pill(t.sizes.pill, false, 1, 0)}
        </div>
        <div style={{ ...mono, position: 'absolute', left: t.box.left, top: t.box.urlTop, fontSize: t.sizes.url, lineHeight: 1.1, color: tokens.ink,
          opacity: model.action, transform: `translateY(${(1 - model.action) * t.action.rise}px)` }}>{url}</div>
      </div>
    )
  }
  const w = STING_CLOSE.wide
  const days = props.ending.days ?? ENDING_DAYS
  const band = `polygon(${w.band.map(([x, y]) => `${x}px ${y}px`).join(', ')})`
  if (model.since < w.bandFrame) {
    return <div data-close="sting-card" style={{ position: 'absolute', zIndex: 920, inset: 0, width: 1920, height: 1080, background: tokens.ink, pointerEvents: 'none' }}>
      <StingPlate src={sting.src} at={model.stingFrame} />
    </div>
  }
  const m = w.masthead
  return (
    <div data-close="sting-card" style={{ position: 'absolute', zIndex: 920, left: 0, top: 0, width: 1920, height: 1080, overflow: 'hidden', background: tokens.channel, color: tokens.cream, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', inset: 0, background: tokens.ink, clipPath: `inset(0 0 0 ${(1 - model.wipe) * 1920}px)` }}><Grain /></div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: 1920, height: 1080, transformOrigin: '0 0',
        transform: `translate(${m.dx * model.wipe}px, ${m.dy * model.wipe}px) scale(${1 - (1 - m.scale) * model.wipe})`, clipPath: band }}>
        <StingPlate src={sting.src} at={w.bandFrame} />
      </div>
      <div style={{ position: 'absolute', left: w.box.left, top: w.box.lineTop, width: w.box.lineWidth, opacity: model.line, transform: `translateX(${(1 - model.line) * w.line.travel}px)` }}>
        <div style={{ ...display, fontSize: w.sizes.line, color: tokens.cream }}>{tagHead}</div>
        <div style={{ ...accent, fontSize: w.sizes.accent, color: tokens.channel, marginTop: -10 }}>{tagLast}</div>
      </div>
      <div style={{ position: 'absolute', left: w.box.left, top: w.box.actionTop, opacity: model.action }}>{pill(w.sizes.pill, true, 1, 0)}</div>
      {/* The address on its own line under the pill: at 58 px it would run past x 1100 beside it. */}
      <div style={{ ...mono, position: 'absolute', left: w.box.left, top: w.box.urlTop, fontSize: w.sizes.url, lineHeight: 1.1, color: tokens.cream, opacity: model.action }}>{url}</div>
      {/* The days row on a line of its own above the action, so nothing of the close reaches x 1100, where YouTube draws
          its end-screen elements (the mock ran it on the action's line into that area). */}
      {days.length > 0 && <div style={{ position: 'absolute', left: w.box.left, top: w.box.daysTop, ...mono, fontSize: w.sizes.days, letterSpacing: '0.12em',
        textTransform: 'uppercase', opacity: model.action }}>
        {days.map((d, i) => <React.Fragment key={d.day}>{i > 0 && <span style={{ color: tokens.cream, opacity: 0.5 }}> · </span>}<span style={{ color: d.colour }}>{d.day}</span></React.Fragment>)}
      </div>}
    </div>
  )
}

/** The close: the v5 outro card (V5Outro) for props compile marked ending.look 'v5_outro', every whole cut dated from
 *  26 Nov. Otherwise the close the cut was signed with: the retired sting close (StingClose) for a series cut signed 23
 *  to 25 Nov (props.ending.sting), else the statement card, full-frame ink with the statement, nothing of the last beat
 *  showing through. */
export function EndingBand({ props, frame }: { props: EngineRenderProps; frame: number }): React.ReactElement | null {
  if (props.ending?.sting) return <StingClose props={props} frame={frame} />
  if (props.ending?.look === 'v5_outro') return <V5Outro props={props} frame={frame} />
  const model = endingBandModel(props, frame)
  if (!model || !props.ending) return null
  const tall = props.aspect === '9:16'
  const shape = SHAPE[props.aspect]
  const tokens = props.tokens
  // compile passes [] on an off day: no series days on its card (config/brand-palette.json; F36).
  const days = props.ending.days ?? ENDING_DAYS
  const mono: React.CSSProperties = { fontFamily: HOUSE_FONTS.data, fontWeight: 700, textTransform: 'uppercase', whiteSpace: 'nowrap' }
  const dayLine = (
    <div style={{ ...mono, ...rise(model.days), fontSize: shape.days, letterSpacing: '0.08em', ...(tall ? {} : { marginBottom: 24 }) }}>
      {days.map((d, i) => <React.Fragment key={d.day}>
        {i > 0 && <span style={{ color: tokens.cream, opacity: 0.35, fontWeight: 400 }}> · </span>}
        <span style={{ color: d.colour }}>{d.day}</span>
      </React.Fragment>)}
    </div>
  )
  const address = (
    <div>
      <div style={{ ...mono, ...rise(model.cta), fontSize: shape.kick, letterSpacing: '0.14em', color: tokens.mint, marginBottom: tall ? 12 : 10 }}>
        {props.ending.cta ?? ENDING_CTA}
      </div>
      <div style={{ ...mono, ...rise(model.url), position: 'relative', display: 'inline-block', textTransform: 'none', fontSize: shape.url, color: tokens.cream, paddingBottom: '0.32em' }}>
        {props.ending.url}
        <i style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '0.12em', background: tokens.channel, transformOrigin: 'left', transform: `scaleX(${model.underline})` }} />
      </div>
    </div>
  )
  return (
    <div style={{ position: 'absolute', zIndex: 920, left: 0, top: 0, width: model.width, height: model.height, background: tokens.ink, color: tokens.cream, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', ...model.contentBox, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={rise(model.logo)}><HouseLogo image={props.brand.stacked} width={model.logoWidth} /></div>
        <div style={{ fontFamily: HOUSE_FONTS.display, textTransform: 'uppercase', fontSize: model.statementPx, lineHeight: 0.9, letterSpacing: '0.005em' }}>
          {model.lines.map((line, i) => (
            <span key={i} style={{ display: 'block', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              <span style={{ display: 'block', transform: `translateY(${(1 - line.rise) * 105}%)`, color: i === model.lines.length - 1 ? tokens.channel : tokens.cream }}>{line.text}</span>
            </span>
          ))}
        </div>
        {tall
          ? <div style={{ display: 'flex', flexDirection: 'column', gap: shape.gap }}>{days.length > 0 && dayLine}{address}</div>
          : <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>{address}{days.length > 0 && dayLine}</div>}
      </div>
      <Grain />
    </div>
  )
}
