import { textWidth, wrapWords } from './metrics'

/** The makeyourmindup house style as the Studio draws it: the CSS of the mock
 *  Krish approved on 2026-09-28 ("yes, approved", in answer to "approve the
 *  frames and the thumbnail?"; claude.ai/artifact/N77k2LJtZxSxAp1UZTTp8r,
 *  version 3), in 1080-wide frame pixels. Brand book v1.4 behind it: ink,
 *  cream and mint; a section's colour means that section only; type on a
 *  colour block is always ink; the logo sits only on ink and never tilts;
 *  stickers tilt between -8 and +5 degrees.
 *
 *  This module is pure (no React, no CSS) so the Studio's placement gates and
 *  the renderer measure the same boxes. */

export const HOUSE_FONTS = {
  display: '"MYMU Anton", "Arial Narrow", sans-serif',
  structure: '"MYMU Archivo", system-ui, sans-serif',
  dek: '"MYMU Fraunces", Georgia, serif',
  data: '"MYMU Plex Mono", ui-monospace, monospace',
} as const

/** The CSS family names the house faces register under (fonts.css). */
export const HOUSE_FONT_FAMILIES = {
  display: 'MYMU Anton',
  structure: 'MYMU Archivo',
  dek: 'MYMU Fraunces',
  data: 'MYMU Plex Mono',
} as const

/** Fractal noise, printed at 7% over every dark block (brand book p. 12). */
export const HOUSE_GRAIN_IMAGE = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'240\' height=\'240\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'.9\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3CfeColorMatrix values=\'0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0\'/%3E%3C/filter%3E%3Crect width=\'240\' height=\'240\' filter=\'url(%23n)\' opacity=\'.5\'/%3E%3C/svg%3E")'
export const HOUSE_GRAIN_OPACITY = 0.07
/** Halftone ink dots over a colour block. */
export const HOUSE_HALFTONE = { image: 'radial-gradient(rgba(12,21,18,.13) 1.6px,transparent 1.8px)', size: 18 } as const
/** The presenter's shade: a touch of ink deep at the top and the foot. */
export const HOUSE_PRESENTER_SHADE = 'linear-gradient(180deg,rgba(7,13,11,.18) 0%,rgba(7,13,11,0) 22%,rgba(7,13,11,0) 55%,rgba(7,13,11,.35) 100%)'
/** Cream at the mock's rgba levels on ink. */
export const HOUSE_RULE_ON_INK = 'rgba(244,239,228,.18)'
export const HOUSE_TICKER_RULE = 'rgba(244,239,228,.14)'
export const HOUSE_DEK_ON_INK = 'rgba(244,239,228,.85)'

export const HOUSE = {
  width: 1080,
  shortHeight: 1920,
  cardHeight: 1350,
  // .mark: the tile on every beat (its left and top come from the theme's
  // anchor offsets, 72 and 150, kept inside the platform's safe zone).
  mark: { size: 136, image: 96, shadow: 10 },
  // .cap
  caption: { left: 72, right: 108, top: 1180, paddingTop: 34, paddingX: 42, paddingBottom: 38, size: 68, lineHeight: 1.06, letterSpacingEm: -0.015, weight: 900, stretchPercent: 112, shadow: 12 },
  // .swipe and .swipe::before; h2 .swipe overrides the insets.
  swipe: { paddingEm: 0.1, skewDegrees: -8, text: { left: -0.04, right: -0.04, top: 0.08, bottom: 0.02 }, display: { left: -0.02, right: -0.06, top: -0.03, bottom: -0.05, lineHeight: 0.88 } },
  // .sticker
  sticker: { size: 34, letterSpacingEm: 0.14, weight: 600, paddingY: 16, paddingX: 34, border: 4, shadow: 7, lineHeight: 1.3 },
  shortSticker: { right: 84, top: 190, rotateDegrees: -6 },
  // .call
  call: { left: 72, right: 84, top: 930, border: 4, shadow: 16, paddingTop: 36, paddingX: 44, paddingBottom: 34, gap: 20, kickerSize: 26, kickerLetterSpacingEm: 0.16, headlineSize: 124, headlineLineHeight: 0.88, headlineLetterSpacingEm: 0.005, statementSize: 40, statementLineHeight: 1.18, statementLetterSpacingEm: -0.01, statementWeight: 700, dueSize: 28, dueLetterSpacingEm: 0.12, dueRule: 3, duePaddingTop: 20 },
  // .band, .marq, .mast, .side
  band: { tickerHeight: 104, tickerRule: 2, tickerPaddingLeft: 40, tickerGap: 30, tickerSize: 64, tickerLetterSpacingEm: 0.01, starSize: 46, mastPaddingTop: 62, mastPaddingX: 72, mastPaddingBottom: 70, mastGap: 30, sideGap: 18, logoWidth: 520, secondsPerLoop: 38 },
  // .pill and .mono
  pill: { size: 40, letterSpacingEm: 0.02, paddingY: 10, paddingX: 22, weight: 600 },
  mono: { size: 28, letterSpacingEm: 0.16, weight: 500, siteLetterSpacingEm: 0.06 },
  // Carousel, 1080 x 1350.
  card: {
    edge: 72,
    topRowGap: 16,
    tile: { size: 112, image: 80 },
    head: { top: 330, gap: 30, size: 178, lineHeight: 0.88, letterSpacingEm: 0.005 },
    dek: { size: 52, lineHeight: 1.18 },
    coverSticker: { left: 72, top: 880, rotateDegrees: -4, size: 28, paddingY: 12, paddingX: 26 },
    question: { left: 72, right: 88, bottom: 96, border: 4, shadow: 14, paddingTop: 32, paddingX: 40, paddingBottom: 36, gap: 14, kickerSize: 24, size: 40, lineHeight: 1.2 },
    inner: { top: 300, gap: 34, size: 160, bodySize: 44, bodyLineHeight: 1.2, bodyWeight: 600, dekSize: 40 },
    foot: { bottom: 72, rule: 2, paddingTop: 40, logoWidth: 470 },
  },
  // Thumbnail, 1080 x 1920; Instagram's grid shows the middle 1080 x 1440.
  thumbnail: {
    safeTop: 240,
    safeBottom: 1680,
    topRow: 300,
    daySize: 32,
    pillSize: 46,
    tile: { size: 128, image: 92 },
    head: { top: 600, gap: 36, size: 250 },
    dekSize: 60,
    sticker: { left: 72, top: 1545, rotateDegrees: -5, size: 36, paddingY: 16, paddingX: 34 },
  },
} as const

export interface HouseSafeZones { topPx: number; rightPx: number; bottomPx: number; leftPx: number }
export interface HouseBox { left: number; top: number; width: number; height: number }

/** The axis-aligned box a rotated rectangle covers, plus a hard shadow. */
function rotatedBox(left: number, top: number, width: number, height: number, degrees: number, shadow: number): HouseBox {
  const radians = Math.abs(degrees) * Math.PI / 180
  const coveredWidth = width * Math.cos(radians) + height * Math.sin(radians)
  const coveredHeight = width * Math.sin(radians) + height * Math.cos(radians)
  return {
    left: left + width / 2 - coveredWidth / 2,
    top: top + height / 2 - coveredHeight / 2,
    width: coveredWidth + shadow,
    height: coveredHeight + shadow,
  }
}

/** A sticker pill's size: Plex Mono 600, uppercase, tracked, in its padding
 *  and 4px ink border. */
export function houseStickerSize(text: string, sizePx: number = HOUSE.sticker.size, paddingX: number = HOUSE.sticker.paddingX, paddingY: number = HOUSE.sticker.paddingY): { width: number; height: number } {
  const border = HOUSE.sticker.border
  return {
    width: textWidth('mono', text.toUpperCase(), sizePx, HOUSE.sticker.letterSpacingEm) + paddingX * 2 + border * 2,
    height: sizePx * HOUSE.sticker.lineHeight + paddingY * 2 + border * 2,
  }
}

/** The channel sticker on a Short's second beat: top right, tilted -6
 *  degrees, kept inside the platform's safe zone. `box` is what it covers,
 *  its tilt and hard shadow included. */
export function houseShortStickerFrame(text: string, safe: HouseSafeZones) {
  const size = houseStickerSize(text)
  const right = Math.max(HOUSE.shortSticker.right, safe.rightPx)
  const top = Math.max(HOUSE.shortSticker.top, safe.topPx)
  const left = HOUSE.width - right - size.width
  return { right, top, left, width: size.width, height: size.height, rotateDegrees: HOUSE.shortSticker.rotateDegrees, box: rotatedBox(left, top, size.width, size.height, HOUSE.shortSticker.rotateDegrees, HOUSE.sticker.shadow) }
}

/** The caption block: where the director put the caption layer, or the
 *  mock's place for it (left 72, right 108, top 1180) inside the safe zone.
 *  Its height follows its lines. */
export function houseCaptionFrame(safe: HouseSafeZones, bounds?: { x: number; y: number; width: number }): { left: number; top: number; width: number } {
  if (bounds) return { left: Math.round(bounds.x * HOUSE.width), top: Math.round(bounds.y * HOUSE.shortHeight), width: Math.round(bounds.width * HOUSE.width) }
  const left = Math.max(HOUSE.caption.left, safe.leftPx)
  return { left, top: HOUSE.caption.top, width: HOUSE.width - left - Math.max(HOUSE.caption.right, safe.rightPx) }
}

/** The call card: left 72, right 84, top 930, inside the safe zone; its
 *  height follows the statement's lines. `box` includes its hard shadow. */
export function houseCallFrame(statement: string, safe: HouseSafeZones) {
  const c = HOUSE.call
  const left = Math.max(c.left, safe.leftPx)
  const right = Math.max(c.right, safe.rightPx)
  const width = HOUSE.width - left - right
  const textWidthPx = width - c.border * 2 - c.paddingX * 2
  const lines = wrapWords('archivo700', statement, c.statementSize, textWidthPx, c.statementLetterSpacingEm).length
  const kicker = c.kickerSize * 1.3
  const headline = c.headlineSize * c.headlineLineHeight
  const due = c.dueRule + c.duePaddingTop + c.dueSize * 1.3
  const height = c.border * 2 + c.paddingTop + c.paddingBottom + kicker + headline + lines * c.statementSize * c.statementLineHeight + due + c.gap * 3
  return { left, right, top: c.top, width, height, lines, box: { left, top: c.top, width: width + c.shadow, height: height + c.shadow } }
}

/** The ending band's side insets: the mock's 72, or the safe zone if wider. */
export function houseBandInsets(safe: HouseSafeZones): { left: number; right: number } {
  return { left: Math.max(HOUSE.band.mastPaddingX, safe.leftPx), right: Math.max(HOUSE.band.mastPaddingX, safe.rightPx) }
}

/** One cycle of the ticker: the promise, a star, the day, a star. */
export function houseTickerCycleWidth(promise: string, day: string): number {
  const b = HOUSE.band
  const star = b.starSize * 0.84
  return textWidth('anton', promise.toUpperCase(), b.tickerSize, b.tickerLetterSpacingEm) + textWidth('anton', day.toUpperCase(), b.tickerSize, b.tickerLetterSpacingEm) + star * 2 + b.tickerGap * 4
}

/** Where the ticker has scrolled to, a whole number of pixels: still until
 *  the band has arrived, then one cycle every 38 seconds (brand book p. 10). */
export function houseTickerOffset(promise: string, day: string, msSinceArrival: number): number {
  if (msSinceArrival <= 0) return 0
  const pixelsPerMs = houseTickerCycleWidth(promise, day) / (HOUSE.band.secondsPerLoop * 1000)
  return Math.round(msSinceArrival * pixelsPerMs * 10) / 10
}

/** The one loud word a caption may carry: the first of its emphasis words
 *  (Krish, 2026-09-26: sentence case, at most one loud word). Returns the
 *  index into `text.split(/(\s+)/)`, or -1. */
export function houseSwipeIndex(text: string, emphasis: readonly string[]): number {
  const wanted = new Set(emphasis.map((word) => word.replace(/[^a-z0-9]/gi, '').toLowerCase()).filter(Boolean))
  if (!wanted.size) return -1
  return text.split(/(\s+)/).findIndex((part) => !/^\s*$/.test(part) && wanted.has(part.replace(/[^a-z0-9]/gi, '').toLowerCase()))
}

/** A headline's last word takes the swipe (the call's "Our call."). Returns
 *  the index into `text.split(/(\s+)/)`, or -1 for an empty headline. */
export function houseLastWordIndex(text: string): number {
  const parts = text.split(/(\s+)/)
  for (let index = parts.length - 1; index >= 0; index -= 1) if (!/^\s*$/.test(parts[index]!)) return index
  return -1
}

/** Due 2027-09-30 and 75% sure, as the card sets them. */
export function houseDueLine(due: string, confidencePercent: number): { due: string; sure: string } {
  return { due: `Due ${due}`, sure: `${confidencePercent}% sure` }
}
