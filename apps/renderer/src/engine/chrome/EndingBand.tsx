import React from 'react'
import { Grain, HouseLogo, MonoLabel, SectionPill, TickerStar } from '../../house/components'
import { HOUSE, HOUSE_FONTS, HOUSE_TICKER_RULE, houseTickerCycleWidth, houseTickerOffset } from '../../house/geometry'
import { textWidth } from '../../house/metrics'
import { FPS, progress } from '../clock'
import type { EngineRenderProps } from '../props'
import { ENDING_SAFE } from './CallCard'

export const BAND_ARRIVAL_FRAMES = 10
export interface EndingBandProps { props: EngineRenderProps; frame: number }

export function endingBandLayout(props: Pick<EngineRenderProps, 'aspect' | 'brand' | 'series' | 'ending'>) {
  const tall = props.aspect === '9:16'
  const safe = ENDING_SAFE[props.aspect]
  const width = tall ? 1080 : 1920
  const sideWidth = Math.max(
    textWidth('mono', props.series.day.toUpperCase(), HOUSE.mono.size, HOUSE.mono.letterSpacingEm),
    textWidth('mono', props.series.label, HOUSE.pill.size, HOUSE.pill.letterSpacingEm) + 2 * HOUSE.pill.paddingX,
    textWidth('mono', props.ending?.url ?? props.series.site, HOUSE.mono.size, HOUSE.mono.siteLetterSpacingEm),
  )
  const logoWidth = tall ? Math.min(HOUSE.band.logoWidth, width - safe.leftPx - safe.rightPx - HOUSE.band.mastGap - sideWidth) : 420
  const logoHeight = logoWidth * props.brand.stacked.pixelHeight / props.brand.stacked.pixelWidth
  const mastHeight = tall ? Math.max(logoHeight, 2 * HOUSE.mono.size * 1.3 + HOUSE.pill.size + 2 * HOUSE.band.sideGap + 2 * HOUSE.pill.paddingY) : 220
  const tickerHeight = tall ? HOUSE.band.tickerHeight + HOUSE.band.tickerRule : 100
  const height = tall ? tickerHeight + HOUSE.band.mastPaddingTop + mastHeight + HOUSE.band.mastPaddingBottom : 320
  const top = tall ? Math.min(1060, 1920 - safe.bottomPx - height) : 1080 - safe.bottomPx - height
  return { left: 0, top, width, height, logoWidth, tickerHeight,
    contentBox: { left: safe.leftPx, top, width: width - safe.leftPx - safe.rightPx, height } }
}

export function endingBandModel(props: EngineRenderProps, frame: number) {
  if (!props.ending || frame < props.ending.fromFrame || frame >= props.durationFrames) return null
  const layout = endingBandLayout(props)
  const since = frame - props.ending.fromFrame
  const offset = houseTickerOffset(props.series.promise, props.series.day, (since - BAND_ARRIVAL_FRAMES) / FPS * 1000)
  const cycleWidth = houseTickerCycleWidth(props.series.promise, props.series.day)
  // Extend the strip for the whole cut. The offset never wraps or jumps backwards.
  const finalOffset = houseTickerOffset(props.series.promise, props.series.day, Math.max(0, props.durationFrames - props.ending.fromFrame - BAND_ARRIVAL_FRAMES) / FPS * 1000)
  const cycles = Math.ceil((finalOffset + layout.width) / cycleWidth) + 1
  return { ...layout, offset, cycles, arrival: progress(since, BAND_ARRIVAL_FRAMES) }
}

/** Full-bleed ink and ticker; the identity and URL stay inside title-safe insets. */
export function EndingBand({ props, frame }: EndingBandProps): React.ReactElement | null {
  const model = endingBandModel(props, frame)
  if (!model || !props.ending) return null
  const tall = props.aspect === '9:16'
  const b = HOUSE.band
  const safe = ENDING_SAFE[props.aspect]
  const tokens = { ...props.tokens, section: props.tokens.channel }
  const cycle = [props.series.promise, '*', props.series.day, '*']
  return (
    <div style={{ position: 'absolute', zIndex: 920, left: 0, top: model.top, width: model.width, height: model.height,
      background: tokens.ink, color: tokens.cream, opacity: Math.min(1, model.arrival * 1.5), pointerEvents: 'none' }}>
      <div style={{ boxSizing: 'border-box', height: model.tickerHeight, display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', overflow: 'hidden', borderBottom: `${b.tickerRule}px solid ${HOUSE_TICKER_RULE}`, paddingLeft: b.tickerPaddingLeft, fontFamily: HOUSE_FONTS.display, fontSize: b.tickerSize, textTransform: 'uppercase', letterSpacing: `${b.tickerLetterSpacingEm}em` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: b.tickerGap, flex: 'none', transform: `translateX(${-model.offset}px)` }}>
          {Array.from({ length: model.cycles }, () => cycle).flat().map((item, index) => item === '*' ? <TickerStar key={index} color={tokens.mint} /> : <span key={index}>{item}</span>)}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: b.mastGap,
        height: model.height - model.tickerHeight, boxSizing: 'border-box', padding: tall ? `${b.mastPaddingTop}px ${safe.rightPx}px ${b.mastPaddingBottom}px ${safe.leftPx}px` : `32px ${safe.rightPx}px 32px ${safe.leftPx}px` }}>
        <HouseLogo image={props.brand.stacked} width={model.logoWidth} />
        <div style={{ display: 'flex', flexDirection: tall ? 'column' : 'row', alignItems: tall ? 'flex-end' : 'center', gap: tall ? b.sideGap : 40 }}>
          <MonoLabel style={{ lineHeight: 1.3 }}>{props.series.day}</MonoLabel>
          <SectionPill label={props.series.label} tokens={tokens} onColour={false} />
          <MonoLabel style={{ lineHeight: 1.3, letterSpacing: `${HOUSE.mono.siteLetterSpacingEm}em`, textTransform: 'none' }}>{props.ending.url}</MonoLabel>
        </div>
      </div>
      <Grain />
    </div>
  )
}
