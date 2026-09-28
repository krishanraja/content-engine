import React from 'react'
import { AbsoluteFill, staticFile } from 'remotion'
import { ColourBlock, HouseFontsGate, MarkTile, MonoLabel, SectionPill, Sticker } from '../house/components'
import { HOUSE, HOUSE_FONTS, houseStickerSize } from '../house/geometry'
import { fitDisplaySize, wrapWords } from '../house/metrics'
import type { ThumbnailProps } from './props'

const t = HOUSE.thumbnail
const INNER_WIDTH = HOUSE.width - HOUSE.card.edge * 2
const SAFETY = 1.03

/** Sizes the headline and dek so the whole cover sits inside the middle
 *  1080 x 1440 that Instagram's grid shows. Pure, so the Studio can test it. */
export function houseThumbnailModel(props: ThumbnailProps) {
  const dekSize = wrapWords('fraunces', props.dek, t.dekSize * SAFETY, INNER_WIDTH).length > 3 ? 52 : t.dekSize
  const dekLines = wrapWords('fraunces', props.dek, dekSize * SAFETY, INNER_WIDTH).length
  const dekHeight = dekLines * dekSize * HOUSE.card.dek.lineHeight
  const maxHeight = t.sticker.top - 40 - t.head.top - t.head.gap - dekHeight
  const fit = fitDisplaySize(props.headline, { maxSizePx: t.head.size, minSizePx: 96, maxWidthPx: INNER_WIDTH, maxHeightPx: Math.max(maxHeight, 96 * 0.88) })
  const sticker = houseStickerSize(props.sticker, t.sticker.size, t.sticker.paddingX, t.sticker.paddingY)
  const headEnd = t.head.top + fit.lines * fit.sizePx * HOUSE.card.head.lineHeight + t.head.gap + dekHeight
  return {
    headlineSize: fit.sizePx,
    headlineLines: fit.lines,
    dekSize,
    dekLines,
    // Every part's top and foot, to check against the grid's crop.
    extent: { top: t.topRow, bottom: Math.max(headEnd, t.sticker.top + sticker.height + HOUSE.sticker.shadow + sticker.width * Math.sin(Math.abs(t.sticker.rotateDegrees) * Math.PI / 180) / 2) },
    visible: { top: t.safeTop, bottom: t.safeBottom },
  }
}

export function MakeyourmindupThumbnail(props: ThumbnailProps) {
  const model = houseThumbnailModel(props)
  const tokens = props.tokens
  const mark = { src: props.mark.assetDataUrl || staticFile(props.mark.assetFile), pixelWidth: props.mark.pixelWidth, pixelHeight: props.mark.pixelHeight }
  return (
    <AbsoluteFill style={{ background: tokens.section, color: tokens.ink, overflow: 'hidden' }}>
      <HouseFontsGate />
      <ColourBlock tokens={tokens} />
      <div style={{ position: 'absolute', left: HOUSE.card.edge, right: HOUSE.card.edge, top: t.topRow, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: HOUSE.card.topRowGap, alignItems: 'flex-start' }}>
          <MonoLabel sizePx={t.daySize}>{props.day}</MonoLabel>
          <SectionPill label={props.channelLabel} tokens={tokens} onColour sizePx={t.pillSize} />
        </div>
        <MarkTile image={mark} size={t.tile.size} imageWidth={t.tile.image} tokens={tokens} />
      </div>
      <div style={{ position: 'absolute', left: HOUSE.card.edge, right: HOUSE.card.edge, top: t.head.top, display: 'flex', flexDirection: 'column', gap: t.head.gap }}>
        <h2 style={{ margin: 0, fontFamily: HOUSE_FONTS.display, fontWeight: 400, textTransform: 'uppercase', fontSize: model.headlineSize, lineHeight: HOUSE.card.head.lineHeight, letterSpacing: `${HOUSE.card.head.letterSpacingEm}em` }}>{props.headline}</h2>
        <p style={{ margin: 0, fontFamily: HOUSE_FONTS.dek, fontStyle: 'italic', fontWeight: 400, fontSize: model.dekSize, lineHeight: HOUSE.card.dek.lineHeight }}>{props.dek}</p>
      </div>
      <Sticker text={props.sticker} background={tokens.cream} tokens={tokens} sizePx={t.sticker.size} paddingX={t.sticker.paddingX} paddingY={t.sticker.paddingY} style={{ left: t.sticker.left, top: t.sticker.top, transform: `rotate(${t.sticker.rotateDegrees}deg)` }} />
      {props.reviewMode ? <div style={{ position: 'absolute', right: HOUSE.card.edge, top: 470, border: `2px solid ${tokens.ink}`, padding: '6px 10px', fontFamily: HOUSE_FONTS.data, fontWeight: 500, fontSize: 14, letterSpacing: '0.14em' }}>DESIGN CANDIDATE</div> : null}
    </AbsoluteFill>
  )
}
