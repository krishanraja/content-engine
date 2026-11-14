import React from 'react'
import { Easing, interpolate } from 'remotion'
import { Grain, HouseLogo } from '../../house/components'
import { HOUSE_FONTS } from '../../house/geometry'
import { textWidth } from '../../house/metrics'
import type { EngineRenderProps } from '../props'

/** The house close: one card after his last word, the same card quick-edit's kit films (scripts/quick-edit/kit/
 *  endcard.html). Krish picked this direction, "C: the statement", on 10 Nov 2026, with the copy "Built to help you
 *  decide." (docs/production/CLOSING.md). The tagline is the picture: Anton, each line rising out of its own mask, the
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

const SHAPE = {
  // Tall: every word inside the tall core box x 120 to 820, y 330 to 1180 (config/brand-palette.json safe.tall_core,
  // docs/production/SOCIAL-BEST-PRACTICES-2026.md section 3.5). Wide: a 160 x 120 margin.
  '9:16': { box: { left: 120, top: 330, width: 700, height: 850 }, logo: 420, statement: 176, days: 24, kick: 24, url: 46, gap: 30 },
  '16:9': { box: { left: 160, top: 120, width: 1600, height: 840 }, logo: 520, statement: 190, days: 26, kick: 24, url: 44, gap: 0 },
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

/** Full-frame ink with the statement; nothing of the last beat shows through. */
export function EndingBand({ props, frame }: { props: EngineRenderProps; frame: number }): React.ReactElement | null {
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
