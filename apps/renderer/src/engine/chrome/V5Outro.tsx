import React from 'react'
import { Img } from 'remotion'
import brand from '../../../../../config/ve/brand-tokens.json'
import { HOUSE_FONTS, V5_DATA_FONT } from '../../house/geometry'
import type { EngineRenderProps } from '../props'

/** The v5 close is the Library's outro (Ruling, Krish, 2026-11-26: "1 agreed", ending every video on the v5 outro card;
 *  docs/ve/cards/library video-vertical-outro and video-wide-outro, approved in lock.json). It shows what those
 *  templates show and nothing else: S3h, the one wordmark (ONE-MARK.md: "there should only be one of these wordmarks on
 *  any given artifact"), "Follow for more", the address, and the climb bars, coral, butter, lilac and mint, rising left
 *  to right along the foot. No headline, no "Built to help you decide.", no days row and no series name (Krish,
 *  2026-11-26: "the sub brands do not need to feature").
 *
 *  The motion is the template's (library.html art() and motion.js outroSweep / outroSignature): the four bars fill the
 *  frame and drop into the staircase, the S3h lands word by word with the D's two halves locking, then the invitation
 *  and the address rise in and each step lifts once. The Library draws at 25 fps; the wide close plays it at its own
 *  speed in 6 s (150 Library frames in compile's 180), the tall close plays all of it inside the 2 s beat
 *  (config/brand-palette.json statement_beat; compile ENDING_FRAMES_BY_ASPECT), settled by 1.33 s.
 *
 *  Every position is the template's settled frame as the Library draws it (library.html at hold_from, after its
 *  measured ink stack), so the last frame of the close is the approved template. ending.test.ts holds these numbers to
 *  library.json. */

const { ink, cream, mint, climb } = brand.colours
/** coral, butter, lilac, mint: the Library's rungs plus mint, left to right. */
export const V5_OUTRO_BARS = [...climb, mint] as const
export const V5_OUTRO_WORDS = { invitation: 'Follow for more', site: 'makeyourmindup.ai' } as const
export const V5_OUTRO_MARK = new URL('../../../../../assets/brand/makeyourmindup/v5/s3h.svg', import.meta.url).href
/** The Library's own grain tile (library.html, <pattern id="grain">: a 64 px noise PNG drawn at 96 px from the frame's
 *  origin), laid at 7% over the ink and over each bar, as the template lays it (brand-tokens grain_on_ink). */
const LIBRARY_GRAIN = 'data:image/png;base64,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'
/** Fraunces as the Library sets it (library.html @font-face: "opsz" 14, "SOFT" 50, "WONK" 0). */
const FRAUNCES_AXES = `"opsz" 14, "SOFT" ${brand.colours.fraunces_axes.SOFT}, "WONK" ${brand.colours.fraunces_axes.WONK}`

function LibraryGrain({ left = 0, top = 0 }: { left?: number; top?: number }) {
  return <div aria-hidden style={{ position: 'absolute', inset: 0, backgroundImage: `url("${LIBRARY_GRAIN}")`, backgroundSize: '96px 96px',
    backgroundPosition: `${-left}px ${-top}px`, opacity: brand.colours.grain_on_ink, pointerEvents: 'none' }} />
}

type Shape = {
  item: string; width: number; height: number
  /** The template's length and its still hold, in Library frames (25 fps), and the close's length in ve frames (30 fps). */
  frames: number; holdFrom: number; closeFrames: number
  /** S3h's 700-unit frame, placed as the template places it. */
  mark: { x: number; y: number; size: number }
  invitation: { x: number; baseline: number; size: number }
  site: { x: number; baseline: number; size: number; tracking: number }
  /** The staircase: the bars' band at the foot and the step edges as shares of the width. */
  bars: { top: number; height: number; edges: readonly number[] }
  /** The words' entrance (enterY) in Library frames, and how far each rises. */
  enter: { start: number; duration: number; invitation: number; site: number }
}

export const V5_OUTRO: Record<EngineRenderProps['aspect'], Shape> = {
  '9:16': {
    item: 'video-vertical-outro', width: 1080, height: 1920, frames: 90, holdFrom: 60, closeFrames: 60,
    mark: { x: 113.15500304040272, y: 168.11158753497338, size: 857.3644222160799 },
    invitation: { x: 141, baseline: 1114.7865258776312, size: 88 },
    site: { x: 144, baseline: 1215.7865258776312, size: 45, tracking: 1.8 },
    bars: { top: 1440, height: 480, edges: [0, 0.25, 0.5, 0.75, 1] },
    enter: { start: 55, duration: 5, invitation: 20, site: 12 },
  },
  '16:9': {
    item: 'video-wide-outro', width: 1920, height: 1080, frames: 150, holdFrom: 60, closeFrames: 180,
    mark: { x: 251.08679936956827, y: 28.0725904613912, size: 536.1240817401816 },
    invitation: { x: 268, baseline: 663.9880301057593, size: 71.11111111111111 },
    site: { x: 270, baseline: 774.0991412168704, size: 48, tracking: 1.92 },
    bars: { top: 842, height: 238, edges: [0, 0.25, 0.5, 0.8125, 1] },
    enter: { start: 53, duration: 7, invitation: 12, site: 7.2 },
  },
}

/** The Library's tracks (library.json motion.tracks, the same on both shapes but the words' entrance), in Library frames. */
export const V5_OUTRO_TRACKS = {
  drop: [{ start: 15, duration: 12 }, { start: 17, duration: 12 }, { start: 19, duration: 12 }, { start: 21, duration: 12 }],
  pulse: [55, 56, 57, 58], pulseFrames: 2,
  make: { start: 25, duration: 8 }, your: { start: 31, duration: 8 }, disc: { start: 31, duration: 9 },
  lock: { start: 40, duration: 5 }, mind: { start: 40, duration: 8 }, up: { start: 45, duration: 8 },
} as const

/** motion.js progress(): the Library's ease, the x of cubic-bezier(0.22, 1, 0.36, 1) solved by bisection and eased out. */
export function libraryEase(value: number): number {
  if (value <= 0) return 0
  if (value >= 1) return 1
  let lo = 0
  let hi = 1
  for (let i = 0; i < 22; i++) {
    const u = (lo + hi) / 2
    const v = 1 - u
    if (3 * v * v * u * 0.22 + 3 * v * u * u * 0.36 + u * u * u < value) lo = u
    else hi = u
  }
  return 1 - (1 - (lo + hi) / 2) ** 3
}

/** S3h in its own units: the three-line name's frame inside the 700-unit square (s3h.svg, <use href="#three-h">). */
const THREE_H = { x: 26, y: 35, scale: 645 / 400 }
/** The parts the Library lands one by one (motion.js outroSignature), as regions of the three-line name (400 wide):
 *  each row's band, split in the gaps between glyphs, and how far each part travels in from (startX). */
const ROWS = { make: [-3, 143], your: [143, 296.5], mind: [296.5, 397] } as const
const PARTS = [
  { name: 'make', row: ROWS.make, from: -5, to: 407, startX: -18 },
  { name: 'your', row: ROWS.your, from: -5, to: 78.7, startX: 16 },
  { name: 'your', row: ROWS.your, from: 237.8, to: 407, startX: 16 },
  { name: 'mind', row: ROWS.mind, from: -5, to: 287, startX: -14 },
  { name: 'up', row: ROWS.mind, from: 287, to: 407, startX: 18 },
] as const
/** The D's two halves in the YOUR row: cream left, mint right (the gap between them is at 157.3). */
const DISC = { cream: [78.7, 157.3], mint: [157.3, 237.8] } as const

export function v5OutroModel(props: EngineRenderProps, frame: number) {
  const ending = props.ending
  if (!ending || ending.look !== 'v5_outro' || ending.sting || frame < ending.fromFrame || frame >= props.durationFrames) return null
  const shape = V5_OUTRO[props.aspect]
  const since = frame - ending.fromFrame
  // The Library frame this ve frame shows.
  const at = since * shape.frames / shape.closeFrames
  const building = at < shape.holdFrom
  const track = (part: { start: number; duration: number }) => building ? libraryEase((at - part.start) / part.duration) : 1
  const t = V5_OUTRO_TRACKS
  const whole = Math.floor(at)
  return {
    since, at, building, settled: !building,
    drops: t.drop.map(track),
    pulses: t.pulse.map((start) => building && whole >= start && whole < start + t.pulseFrames),
    snap: whole === 0,
    make: track(t.make), your: track(t.your), disc: track(t.disc), lock: track(t.lock), mind: track(t.mind), up: track(t.up),
    words: building && at < shape.enter.start ? null : track(shape.enter),
  }
}

/** The bars: while the close builds they fill the frame and drop into the staircase (outroSweep), then hold as the
 *  template's signature bars. */
export function v5OutroBars(props: EngineRenderProps, model: NonNullable<ReturnType<typeof v5OutroModel>>) {
  const shape = V5_OUTRO[props.aspect]
  const { width: w, height: h } = shape
  const spread = model.drops[3]!
  const edge = (n: number) => w * (n / 4 + (shape.bars.edges[n]! - n / 4) * spread)
  return V5_OUTRO_BARS.map((colour, i) => {
    const height = h + (shape.bars.height * (i + 1) / 4 - h) * model.drops[i]!
    return { colour, left: edge(i), top: h - height, width: edge(i + 1) - edge(i), height, pulse: model.pulses[i]! }
  })
}

function Mark({ size, model }: { size: number; model: NonNullable<ReturnType<typeof v5OutroModel>> }) {
  const unit = size / 700
  const k = unit * THREE_H.scale
  // One copy of the real file per part, clipped to the part and moved with it. Lighten keeps each copy's own ink ground
  // from covering a neighbour or a bar as the parts travel; on the settled card it is one plain copy of the file.
  const copy = (key: string, region: { from: number; to: number; row: readonly [number, number] }, dx: number) => {
    const left = unit * THREE_H.x + k * region.from
    const right = size - (unit * THREE_H.x + k * region.to)
    const top = unit * THREE_H.y + k * region.row[0]
    const bottom = size - (unit * THREE_H.y + k * region.row[1])
    return <Img key={key} data-sign-part={key} src={V5_OUTRO_MARK} style={{ position: 'absolute', left: 0, top: 0, width: size, height: size,
      mixBlendMode: 'lighten', clipPath: `inset(${top}px ${right}px ${bottom}px ${left}px)`, transform: `translateX(${dx * k}px)` }} />
  }
  if (!model.building || (model.up >= 1 && model.lock >= 1)) {
    return <Img data-v5-outro-mark="s3h" src={V5_OUTRO_MARK} style={{ position: 'absolute', left: 0, top: 0, width: size, height: size, mixBlendMode: 'lighten' }} />
  }
  const land: Record<(typeof PARTS)[number]['name'], number> = { make: model.make, your: model.your, mind: model.mind, up: model.up }
  const parts = PARTS.flatMap((part, i) => land[part.name] > 0 ? [copy(`${part.name}-${i}`, part, part.startX * (1 - land[part.name]))] : [])
  if (model.disc > 0) {
    // The D's halves meet, overshoot by 2.6 and lock, riding with YOUR as it lands (outroSignature).
    const offset = (1 - model.disc) * 9 - model.disc * (1 - model.lock) * 2.6
    const shift = 16 * (1 - model.your)
    parts.push(copy('disc-cream', { from: DISC.cream[0], to: DISC.cream[1], row: ROWS.your }, shift - offset))
    parts.push(copy('disc-mint', { from: DISC.mint[0], to: DISC.mint[1], row: ROWS.your }, shift + offset))
  }
  return <>{parts}</>
}

/** The v5 outro card: the Library's video-vertical-outro (9:16) or video-wide-outro (16:9), frame for frame. */
export function V5Outro({ props, frame }: { props: EngineRenderProps; frame: number }): React.ReactElement | null {
  const model = v5OutroModel(props, frame)
  if (!model) return null
  const shape = V5_OUTRO[props.aspect]
  const { width, height } = shape
  const rise = (by: number) => model.words === null ? 0 : by * (1 - model.words)
  const text = { fill: cream, dominantBaseline: 'alphabetic' } as const
  return (
    <div data-close="v5-outro" data-template={shape.item} style={{ position: 'absolute', zIndex: 920, left: 0, top: 0, width, height,
      overflow: 'hidden', background: ink, isolation: 'isolate', pointerEvents: 'none' }}>
      <LibraryGrain />
      {v5OutroBars(props, model).map((bar, i) => (
        <div key={i} data-step={i + 1} style={{ position: 'absolute', left: bar.left, top: bar.top, width: bar.width, height: bar.height,
          background: bar.colour, overflow: 'hidden' }}>
          {bar.pulse && <div data-step-pulse={i + 1} style={{ position: 'absolute', inset: 0, background: cream, opacity: 0.24 }} />}
          <LibraryGrain left={bar.left} top={bar.top} />
        </div>
      ))}
      {model.snap && <div data-roll="snap" style={{ position: 'absolute', left: 0, top: height * 0.35, width, height: height * 0.008, background: ink, opacity: 0.2 }} />}
      <div style={{ position: 'absolute', left: shape.mark.x, top: shape.mark.y, width: shape.mark.size, height: shape.mark.size }}>
        <Mark size={shape.mark.size} model={model} />
      </div>
      {model.words !== null && (
        <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
          <text {...text} x={shape.invitation.x} y={shape.invitation.baseline + rise(shape.enter.invitation)} fontFamily={HOUSE_FONTS.dek}
            fontSize={shape.invitation.size} fontWeight={500} style={{ fontVariationSettings: FRAUNCES_AXES }}>{V5_OUTRO_WORDS.invitation}</text>
          <text {...text} x={shape.site.x} y={shape.site.baseline + rise(shape.enter.site)} fontFamily={V5_DATA_FONT}
            fontSize={shape.site.size} fontWeight={400} letterSpacing={shape.site.tracking}>{V5_OUTRO_WORDS.site}</text>
        </svg>
      )}
    </div>
  )
}
