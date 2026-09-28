import React from 'react'
import { AbsoluteFill, staticFile } from 'remotion'
import { ColourBlock, Grain, HouseFontsGate, HouseLogo, MarkTile, MonoLabel, SectionPill, Sticker, SwipedText, type HouseImage, type HouseTokens } from '../house/components'
import { HOUSE, HOUSE_DEK_ON_INK, HOUSE_FONTS, HOUSE_RULE_ON_INK, houseLastWordIndex } from '../house/geometry'
import { fitDisplaySize, wrapWords } from '../house/metrics'
import type { CarouselRenderProps } from './props'

// A carousel card in the makeyourmindup house style (the mock Krish approved
// on 2026-09-28). The cover is the section's colour block; the middle and
// last cards are ink with grain, with the type doing the work and no scene
// artwork. Headlines are sized to fit before the card renders, so the same
// words always get the same card.

type House = NonNullable<NonNullable<CarouselRenderProps['branding']['publication']>['house']>
type Wordmark = NonNullable<CarouselRenderProps['branding']['publication']>['mark']

const card = HOUSE.card
const INNER_WIDTH = HOUSE.width - card.edge * 2
const SAFETY = 1.03

function imageOf(asset: Wordmark): HouseImage {
  return { src: asset.assetDataUrl || staticFile(asset.assetFile), pixelWidth: asset.pixelWidth, pixelHeight: asset.pixelHeight }
}

const dekLines = (text: string, sizePx: number) => wrapWords('fraunces', text, sizePx * SAFETY, INNER_WIDTH).length
const bodyLines = (text: string) => wrapWords('archivo600', text, card.inner.bodySize * SAFETY, INNER_WIDTH).length

/** What a card shows and where: its kind, its headline's size and swiped
 *  word, and its counter. Pure, so the Studio can test it. */
export function houseCardModel(props: CarouselRenderProps) {
  const house = props.branding.publication?.house
  if (!house) return null
  const { slide } = props
  const kind = slide.position === 1 ? 'cover' as const : slide.position === props.slideCount ? 'last' as const : 'middle' as const
  const counter = kind === 'cover' ? null : `${slide.position} / ${props.slideCount}`
  if (kind === 'cover') {
    const dek = slide.body ? dekLines(slide.body, card.dek.size) * card.dek.size * card.dek.lineHeight + card.head.gap : 0
    // The headline and dek end clear of the sticker at 880.
    const maxHeight = card.coverSticker.top - 40 - card.head.top - dek
    const fit = fitDisplaySize(slide.headline, { maxSizePx: card.head.size, minSizePx: 88, maxWidthPx: INNER_WIDTH, maxHeightPx: Math.max(maxHeight, 88 * 0.88) })
    return { kind, counter, headlineSize: fit.sizePx, headlineLines: fit.lines, swipeIndex: -1, sticker: house.coverSticker, question: house.question, footnote: null }
  }
  // One swiped word where the slide carries an accent, always on the call.
  const swipeIndex = slide.call || slide.accent !== 'none' ? houseLastWordIndex(slide.headline) : -1
  const swipeWord = swipeIndex < 0 ? undefined : slide.headline.split(/(\s+)/).filter((part) => !/^\s*$/.test(part)).length - 1
  const footnote = kind === 'last' && slide.call ? house.callFootnote : null
  // The last card keeps clear of its footer rule; a middle card of its counter.
  const limit = kind === 'last' ? 1140 : 1200
  const blocks = [
    slide.body ? bodyLines(slide.body) * card.inner.bodySize * card.inner.bodyLineHeight : 0,
    slide.dataLabel ? HOUSE.mono.size * 1.3 : 0,
    footnote ? dekLines(footnote, card.inner.dekSize) * card.inner.dekSize * card.dek.lineHeight : 0,
  ].filter((height) => height > 0)
  const maxHeight = limit - card.inner.top - blocks.reduce((sum, height) => sum + height + card.inner.gap, 0)
  const fit = fitDisplaySize(slide.headline, { maxSizePx: card.inner.size, minSizePx: 72, maxWidthPx: INNER_WIDTH, maxHeightPx: Math.max(maxHeight, 72 * 0.88), ...(swipeWord === undefined ? {} : { swipeWordIndex: swipeWord }) })
  return { kind, counter, headlineSize: fit.sizePx, headlineLines: fit.lines, swipeIndex, sticker: null, question: null, footnote }
}

function TopRow({ house, label, onColour, right, top = card.edge, daySize, pillSize }: { house: House; label: string; onColour: boolean; right: React.ReactNode; top?: number; daySize?: number; pillSize?: number }) {
  return (
    <div style={{ position: 'absolute', left: card.edge, right: card.edge, top, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: card.topRowGap, alignItems: 'flex-start' }}>
        <MonoLabel {...(daySize ? { sizePx: daySize } : {})}>{house.day}</MonoLabel>
        <SectionPill label={label} tokens={house.tokens} onColour={onColour} {...(pillSize ? { sizePx: pillSize } : {})} />
      </div>
      {right}
    </div>
  )
}

export function HouseCarouselCard(props: CarouselRenderProps) {
  const model = houseCardModel(props)
  const publication = props.branding.publication
  const house = publication?.house
  if (!model || !publication || !house) return null
  const tokens: HouseTokens = house.tokens
  const { slide } = props
  const mark = imageOf(publication.mark)
  const tile = <MarkTile image={mark} size={card.tile.size} imageWidth={card.tile.image} tokens={tokens} />

  if (model.kind === 'cover') {
    return (
      <AbsoluteFill style={{ background: tokens.section, color: tokens.ink, overflow: 'hidden' }}>
        <HouseFontsGate />
        <ColourBlock tokens={tokens} />
        <TopRow house={house} label={publication.channel.label} onColour right={tile} />
        <div style={{ position: 'absolute', left: card.edge, right: card.edge, top: card.head.top, display: 'flex', flexDirection: 'column', gap: card.head.gap }}>
          <h2 style={{ margin: 0, fontFamily: HOUSE_FONTS.display, fontWeight: 400, textTransform: 'uppercase', fontSize: model.headlineSize, lineHeight: card.head.lineHeight, letterSpacing: `${card.head.letterSpacingEm}em` }}>{slide.headline}</h2>
          {slide.body ? <p style={{ margin: 0, fontFamily: HOUSE_FONTS.dek, fontStyle: 'italic', fontWeight: 400, fontSize: card.dek.size, lineHeight: card.dek.lineHeight }}>{slide.body}</p> : null}
        </div>
        <Sticker text={model.sticker!} background={tokens.cream} tokens={tokens} sizePx={card.coverSticker.size} paddingX={card.coverSticker.paddingX} paddingY={card.coverSticker.paddingY} style={{ left: card.coverSticker.left, top: card.coverSticker.top, zIndex: 2, transform: `rotate(${card.coverSticker.rotateDegrees}deg)` }} />
        <div style={{ position: 'absolute', left: card.question.left, right: card.question.right, bottom: card.question.bottom, background: tokens.cream, color: tokens.ink, border: `${card.question.border}px solid ${tokens.ink}`, boxShadow: `${card.question.shadow}px ${card.question.shadow}px 0 ${tokens.ink}`, padding: `${card.question.paddingTop}px ${card.question.paddingX}px ${card.question.paddingBottom}px`, display: 'flex', flexDirection: 'column', gap: card.question.gap }}>
          <span style={{ fontFamily: HOUSE_FONTS.data, fontWeight: 600, fontSize: card.question.kickerSize, letterSpacing: '0.16em', textTransform: 'uppercase' }}>{house.questionKicker}</span>
          <p style={{ margin: 0, fontFamily: HOUSE_FONTS.structure, fontWeight: 700, fontSize: card.question.size, lineHeight: card.question.lineHeight }}>{model.question}</p>
        </div>
        {props.reviewMode ? <ReviewTag tokens={tokens} /> : null}
      </AbsoluteFill>
    )
  }

  const right = model.kind === 'last' ? <MonoLabel>{model.counter}</MonoLabel> : <MarkTile image={mark} size={card.tile.size} imageWidth={card.tile.image} tokens={tokens} grain={false} />
  return (
    <AbsoluteFill style={{ background: tokens.ink, color: tokens.cream, overflow: 'hidden' }}>
      <HouseFontsGate />
      <TopRow house={house} label={publication.channel.label} onColour={false} right={right} />
      <div style={{ position: 'absolute', left: card.edge, right: card.edge, top: card.inner.top, display: 'flex', flexDirection: 'column', gap: card.inner.gap }}>
        <h2 style={{ margin: 0, fontFamily: HOUSE_FONTS.display, fontWeight: 400, textTransform: 'uppercase', fontSize: model.headlineSize, lineHeight: card.head.lineHeight, letterSpacing: `${card.head.letterSpacingEm}em` }}>
          <SwipedText text={slide.headline} swipeIndex={model.swipeIndex} tokens={tokens} display />
        </h2>
        {slide.body ? <p style={{ margin: 0, fontFamily: HOUSE_FONTS.structure, fontWeight: card.inner.bodyWeight, fontSize: card.inner.bodySize, lineHeight: card.inner.bodyLineHeight }}>{slide.body}</p> : null}
        {slide.dataLabel ? <MonoLabel style={{ color: tokens.mint }}>{slide.dataLabel}</MonoLabel> : null}
        {model.footnote ? <p style={{ margin: 0, fontFamily: HOUSE_FONTS.dek, fontStyle: 'italic', fontWeight: 400, fontSize: card.inner.dekSize, lineHeight: card.dek.lineHeight, color: HOUSE_DEK_ON_INK }}>{model.footnote}</p> : null}
      </div>
      {model.kind === 'last' ? (
        <div style={{ position: 'absolute', left: card.edge, right: card.edge, bottom: card.foot.bottom, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderTop: `${card.foot.rule}px solid ${HOUSE_RULE_ON_INK}`, paddingTop: card.foot.paddingTop }}>
          <HouseLogo image={imageOf(publication.logo)} width={card.foot.logoWidth} />
          <MonoLabel style={{ letterSpacing: `${HOUSE.mono.siteLetterSpacingEm}em`, textTransform: 'none' }}>{house.site}</MonoLabel>
        </div>
      ) : (
        <div style={{ position: 'absolute', right: card.edge, bottom: card.foot.bottom }}><MonoLabel>{model.counter}</MonoLabel></div>
      )}
      {props.reviewMode ? <ReviewTag tokens={tokens} /> : null}
      <Grain />
    </AbsoluteFill>
  )
}

/** Marks a review render, so it is never mistaken for a final card. */
function ReviewTag({ tokens }: { tokens: HouseTokens }) {
  return <div style={{ position: 'absolute', right: card.edge, top: 210, border: `2px solid ${tokens.cream}`, background: tokens.ink, color: tokens.cream, padding: '6px 10px', fontFamily: HOUSE_FONTS.data, fontWeight: 500, fontSize: 14, letterSpacing: '0.14em' }}>DESIGN CANDIDATE</div>
}
