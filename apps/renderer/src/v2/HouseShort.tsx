import React from 'react'
import { useCurrentFrame, useVideoConfig } from 'remotion'
import { Grain, HouseLogo, MarkTile, MonoLabel, SectionPill, Sticker, SwipedText, TickerStar, type HouseImage, type HouseTokens } from '../house/components'
import { HOUSE, HOUSE_FONTS, HOUSE_TICKER_RULE, houseBandInsets, houseCallFrame, houseCaptionFrame, houseDueLine, houseLastWordIndex, houseShortStickerFrame, houseSwipeIndex, houseTickerOffset, type HouseSafeZones } from '../house/geometry'
import type { V2RenderProps, V2RuntimeShot } from './props'

// A Short in the makeyourmindup house style (the mock Krish approved on
// 2026-09-28): the mark on its ink tile on every beat, captions on an ink
// block with the channel colour's hard shadow and one mint swipe, the channel
// sticker on the second beat, the call card on the beat that carries the
// call, and the ending band once, at the end. Things arrive with a short
// slide, drop or slap; only the ticker keeps moving. Every motion is a pure
// function of the frame.

type RuntimeBranding = V2RenderProps['branding']
type RuntimeHouse = NonNullable<NonNullable<RuntimeBranding['publication']>['house']>
type RuntimeBrandCue = NonNullable<V2RuntimeShot['brandCues']>[number]
type RuntimeCaption = V2RenderProps['captions'][number]

export const HOUSE_MOTION = {
  markFrames: 8,
  captionFrames: 6,
  stickerFrames: 6,
  callFrames: 9,
  bandFrames: 10,
} as const

/** Ease out: quick arrival, soft landing. 0 before, 1 once arrived. */
export function houseArrival(frame: number, frames: number): number {
  const t = Math.min(1, Math.max(0, frame / frames))
  return 1 - (1 - t) ** 3
}

const toSafe = (zones: V2RenderProps['safeZones']): HouseSafeZones => zones

function houseOf(branding: RuntimeBranding): RuntimeHouse | undefined {
  return branding.mode === 'none' ? undefined : branding.publication?.house
}

export function houseTokens(house: RuntimeHouse): HouseTokens {
  return house.tokens
}

const image = (asset: { assetFile: string; pixelWidth: number; pixelHeight: number }, resolve: (file: string) => string): HouseImage => ({ src: resolve(asset.assetFile), pixelWidth: asset.pixelWidth, pixelHeight: asset.pixelHeight })

/** The mark tile on a beat: where its cue puts it, its size and its shadow
 *  in the channel colour. Null during the ending band or with no house. */
export function houseMarkModel(branding: RuntimeBranding, cue: RuntimeBrandCue | undefined) {
  const house = houseOf(branding)
  if (!house || !cue || cue.mode !== 'mindmake_only') return null
  return {
    left: cue.leftPx,
    top: cue.topPx,
    size: house.tile.size,
    imageWidth: house.tile.markWidth,
    shadow: { px: house.tile.shadowPx, color: house.tokens.section },
    background: house.tokens.ink,
    grain: true as const,
  }
}

/** The ending band while its cue is live: where it sits, its insets inside
 *  the safe zone, the ticker's run and where it has scrolled to. */
export function houseBandModel(branding: RuntimeBranding, cue: RuntimeBrandCue | undefined, safeZones: V2RenderProps['safeZones'], atMs: number, fps = 30) {
  const house = houseOf(branding)
  if (!house || !cue || cue.mode !== 'stacked_identity') return null
  const arrivalMs = HOUSE_MOTION.bandFrames / fps * 1000
  const insets = houseBandInsets(toSafe(safeZones))
  const cycle = [house.promise, '*', house.day, '*'] as const
  return {
    top: house.band.topPx,
    heightPx: house.band.heightPx,
    insets,
    background: house.tokens.ink,
    ticker: {
      items: [...cycle, ...cycle, ...cycle],
      offsetPx: houseTickerOffset(house.promise, house.day, atMs - cue.startMs - arrivalMs),
    },
    logoWidth: house.band.logoWidth,
    day: house.day,
    pill: { label: branding.publication!.channel.label, background: house.tokens.section, color: house.tokens.ink },
    site: house.site,
    grain: true as const,
  }
}

/** The caption block: where it sits, its one swiped word and its shadow. */
export function houseCaptionModel(branding: RuntimeBranding, cue: RuntimeCaption, safeZones: V2RenderProps['safeZones'], bounds?: { x: number; y: number; width: number }) {
  const house = houseOf(branding)
  if (!house) return null
  const frame = houseCaptionFrame(toSafe(safeZones), bounds)
  return {
    ...frame,
    background: house.tokens.ink,
    color: house.tokens.cream,
    shadow: { px: HOUSE.caption.shadow, color: house.tokens.section },
    text: cue.text,
    swipeIndex: houseSwipeIndex(cue.text, cue.emphasis),
    grain: true as const,
  }
}

/** The channel sticker, only on the second beat. */
export function houseStickerModel(branding: RuntimeBranding, safeZones: V2RenderProps['safeZones'], atMs: number) {
  const house = houseOf(branding)
  const sticker = house?.sticker
  if (!house || !sticker || atMs < sticker.startMs || atMs >= sticker.endMs) return null
  const frame = houseShortStickerFrame(sticker.text, toSafe(safeZones))
  return { text: sticker.text, right: frame.right, top: frame.top, rotateDegrees: frame.rotateDegrees, background: house.tokens.section, startMs: sticker.startMs }
}

/** The call card, only on the beat that carries the call. */
export function houseCallModel(branding: RuntimeBranding, safeZones: V2RenderProps['safeZones'], atMs: number) {
  const house = houseOf(branding)
  const call = house?.call
  if (!house || !call || atMs < call.startMs || atMs >= call.endMs) return null
  const frame = houseCallFrame(call.statement, toSafe(safeZones))
  const due = houseDueLine(call.due, call.confidencePercent)
  return {
    left: frame.left,
    top: frame.top,
    width: frame.width,
    kicker: call.kicker,
    headline: call.headline,
    swipeIndex: houseLastWordIndex(call.headline),
    statement: call.statement,
    due: due.due,
    sure: due.sure,
    startMs: call.startMs,
  }
}

/** The band and the call card each take the caption's place while they are
 *  up, as in the mock: frames 3 and 4 carry no caption. */
export function houseCaptionHidden(branding: RuntimeBranding, cue: RuntimeBrandCue | undefined, safeZones: V2RenderProps['safeZones'], atMs: number): boolean {
  if (!houseOf(branding)) return false
  return Boolean(houseBandModel(branding, cue, safeZones, atMs) || houseCallModel(branding, safeZones, atMs))
}

const frameOf = (ms: number, fps: number) => Math.round(ms / 1000 * fps)

export function HouseMark({ branding, cue, resolve }: { branding: RuntimeBranding; cue: RuntimeBrandCue | undefined; resolve: (file: string) => string }) {
  const frame = useCurrentFrame()
  const model = houseMarkModel(branding, cue)
  const house = houseOf(branding)
  if (!model || !house) return null
  // It drops in once, at the opening, and then holds.
  const arrival = houseArrival(frame, HOUSE_MOTION.markFrames)
  return (
    <MarkTile
      image={image(branding.publication!.mark, resolve)}
      size={model.size}
      imageWidth={model.imageWidth}
      tokens={houseTokens(house)}
      style={{ position: 'absolute', zIndex: 900, left: model.left, top: model.top, boxShadow: `${model.shadow.px}px ${model.shadow.px}px 0 ${model.shadow.color}`, transform: `translateY(${(arrival - 1) * 36}px)`, opacity: Math.min(1, arrival * 1.6) }}
    />
  )
}

export function HouseCaption({ cue, branding, safeZones, bounds }: { cue: RuntimeCaption; branding: RuntimeBranding; safeZones: V2RenderProps['safeZones']; bounds?: { x: number; y: number; width: number } }) {
  const frame = useCurrentFrame()
  const model = houseCaptionModel(branding, cue, safeZones, bounds)
  const house = houseOf(branding)
  if (!model || !house) return null
  const arrival = houseArrival(frame, HOUSE_MOTION.captionFrames)
  const c = HOUSE.caption
  return (
    <div style={{
      position: 'absolute',
      left: model.left,
      top: model.top,
      width: model.width,
      boxSizing: 'border-box',
      background: model.background,
      padding: `${c.paddingTop}px ${c.paddingX}px ${c.paddingBottom}px`,
      boxShadow: `${model.shadow.px}px ${model.shadow.px}px 0 ${model.shadow.color}`,
      transform: `translateY(${(1 - arrival) * 24}px)`,
      opacity: arrival,
      pointerEvents: 'none',
    }}>
      <p style={{ margin: 0, fontFamily: HOUSE_FONTS.structure, fontWeight: c.weight, fontStretch: `${c.stretchPercent}%`, fontSize: c.size, lineHeight: c.lineHeight, letterSpacing: `${c.letterSpacingEm}em`, color: model.color }}>
        <SwipedText text={model.text} swipeIndex={model.swipeIndex} tokens={houseTokens(house)} />
      </p>
      <Grain />
    </div>
  )
}

export function HouseSticker({ branding, safeZones, atMs }: { branding: RuntimeBranding; safeZones: V2RenderProps['safeZones']; atMs: number }) {
  const { fps } = useVideoConfig()
  const model = houseStickerModel(branding, safeZones, atMs)
  const house = houseOf(branding)
  if (!model || !house) return null
  // Slapped on: a little large and more tilted, then it lands.
  const arrival = houseArrival(frameOf(atMs - model.startMs, fps), HOUSE_MOTION.stickerFrames)
  const scale = 1 + (1 - arrival) * 0.3
  const rotate = model.rotateDegrees - (1 - arrival) * 6
  return <Sticker text={model.text} background={model.background} tokens={houseTokens(house)} style={{ zIndex: 910, right: model.right, top: model.top, transform: `rotate(${rotate}deg) scale(${scale})`, opacity: Math.min(1, arrival * 2) }} />
}

export function HouseCall({ branding, safeZones, atMs }: { branding: RuntimeBranding; safeZones: V2RenderProps['safeZones']; atMs: number }) {
  const { fps } = useVideoConfig()
  const model = houseCallModel(branding, safeZones, atMs)
  const house = houseOf(branding)
  if (!model || !house) return null
  const tokens = houseTokens(house)
  const c = HOUSE.call
  const arrival = houseArrival(frameOf(atMs - model.startMs, fps), HOUSE_MOTION.callFrames)
  return (
    <div style={{
      position: 'absolute',
      zIndex: 905,
      left: model.left,
      top: model.top,
      width: model.width,
      boxSizing: 'border-box',
      background: tokens.cream,
      color: tokens.ink,
      border: `${c.border}px solid ${tokens.ink}`,
      boxShadow: `${c.shadow}px ${c.shadow}px 0 ${tokens.ink}`,
      padding: `${c.paddingTop}px ${c.paddingX}px ${c.paddingBottom}px`,
      display: 'flex',
      flexDirection: 'column',
      gap: c.gap,
      transform: `translateY(${(arrival - 1) * 60}px)`,
      opacity: Math.min(1, arrival * 1.5),
    }}>
      <span style={{ fontFamily: HOUSE_FONTS.data, fontWeight: 600, fontSize: c.kickerSize, letterSpacing: `${c.kickerLetterSpacingEm}em`, textTransform: 'uppercase' }}>{model.kicker}</span>
      <h2 style={{ margin: 0, fontFamily: HOUSE_FONTS.display, fontWeight: 400, textTransform: 'uppercase', fontSize: c.headlineSize, lineHeight: c.headlineLineHeight, letterSpacing: `${c.headlineLetterSpacingEm}em` }}>
        <SwipedText text={model.headline} swipeIndex={model.swipeIndex} tokens={tokens} display />
      </h2>
      <p style={{ margin: 0, fontFamily: HOUSE_FONTS.structure, fontWeight: c.statementWeight, fontSize: c.statementSize, lineHeight: c.statementLineHeight, letterSpacing: `${c.statementLetterSpacingEm}em` }}>{model.statement}</p>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `${c.dueRule}px solid ${tokens.ink}`, paddingTop: c.duePaddingTop, fontFamily: HOUSE_FONTS.data, fontWeight: 600, fontSize: c.dueSize, letterSpacing: `${c.dueLetterSpacingEm}em`, textTransform: 'uppercase' }}>
        <span>{model.due}</span><span>{model.sure}</span>
      </div>
    </div>
  )
}

export function HouseBand({ branding, cue, safeZones, atMs, resolve }: { branding: RuntimeBranding; cue: RuntimeBrandCue | undefined; safeZones: V2RenderProps['safeZones']; atMs: number; resolve: (file: string) => string }) {
  const { fps } = useVideoConfig()
  const model = houseBandModel(branding, cue, safeZones, atMs, fps)
  const house = houseOf(branding)
  if (!model || !house || !cue) return null
  const tokens = houseTokens(house)
  const b = HOUSE.band
  const arrival = houseArrival(frameOf(atMs - cue.startMs, fps), HOUSE_MOTION.bandFrames)
  return (
    <div style={{ position: 'absolute', zIndex: 900, left: 0, right: 0, top: model.top, background: model.background, transform: `translateY(${(1 - arrival) * 80}px)`, opacity: Math.min(1, arrival * 1.5) }}>
      <div style={{ boxSizing: 'content-box', height: b.tickerHeight, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', borderBottom: `${b.tickerRule}px solid ${HOUSE_TICKER_RULE}`, paddingLeft: b.tickerPaddingLeft, fontFamily: HOUSE_FONTS.display, fontSize: b.tickerSize, textTransform: 'uppercase', color: tokens.cream, letterSpacing: `${b.tickerLetterSpacingEm}em` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: b.tickerGap, flex: 'none', transform: `translateX(${-model.ticker.offsetPx}px)` }}>
          {model.ticker.items.map((item, index) => item === '*' ? <TickerStar key={index} color={tokens.mint} /> : <span key={index}>{item}</span>)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: b.mastGap, padding: `${b.mastPaddingTop}px ${model.insets.right}px ${b.mastPaddingBottom}px ${model.insets.left}px` }}>
        <HouseLogo image={image(house.stacked, resolve)} width={model.logoWidth} />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: b.sideGap, color: tokens.cream }}>
          <MonoLabel>{model.day}</MonoLabel>
          <SectionPill label={model.pill.label} tokens={tokens} onColour={false} />
          <MonoLabel style={{ letterSpacing: `${HOUSE.mono.siteLetterSpacingEm}em`, textTransform: 'none' }}>{model.site}</MonoLabel>
        </div>
      </div>
      <Grain />
    </div>
  )
}

