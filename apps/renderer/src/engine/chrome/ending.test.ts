import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// Remotion's Img reads the frame for premounting, which needs a composition; a plain img renders the same markup here.
vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>()
  return { ...actual, Img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', props) }
})
import { HOUSE, houseDueLine, houseTickerCycleWidth, houseTickerOffset } from '../../house/geometry'
import { EngineRenderPropsSchema, type EngineRenderProps } from '../props'
import { CallCard, callCardLayout, callCardModel, ENDING_SAFE } from './CallCard'
import { BAND_ARRIVAL_FRAMES, EndingBand, endingBandModel } from './EndingBand'

function fixture(aspect: EngineRenderProps['aspect']): EngineRenderProps {
  const image = { src: 'stacked.svg', pixelWidth: 1040, pixelHeight: 320 }
  return EngineRenderPropsSchema.parse({
    pieceId: 'call-ending', cutId: 'short', format: 'face-with-proof', aspect, fps: 30, durationFrames: 2000,
    tokens: { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'white', mint: 'aquamarine', channel: 'gold' },
    series: { label: 'follow.the.money', day: 'Monday', promise: 'Where the money moves', site: 'makeyourmindup.ai' },
    brand: { mark: image, logo: image, stacked: image },
    audio: { stem: { src: 'stem.wav', trimBeforeFrames: 0 } },
    captions: [{ fromFrame: 0, toFrame: 2000, words: [{ text: 'Call', atFrame: 0 }], swipeIndex: null }],
    beats: [{ id: 'call', role: 'call', layout: 'F1', fromFrame: 100, toFrame: 180, uses: [], transitionOut: 'cut' }],
    objects: [], events: [], call: { statement: 'Teams will spend less on tools and more on checking the work.', due: '2027-09-30', confidencePercent: 75 },
    ending: { fromFrame: 180, url: 'makeyourmindup.ai' },
  })
}

describe('ending ticker', () => {
  it('holds until arrival, then moves monotonically over 600 frames', () => {
    const props = fixture('9:16')
    const start = props.ending!.fromFrame
    expect(endingBandModel(props, start - 1)).toBeNull()
    expect(endingBandModel(props, start + BAND_ARRIVAL_FRAMES)!.offset).toBe(0)
    let previous = 0
    for (let elapsed = 1; elapsed <= 600; elapsed++) {
      const model = endingBandModel(props, start + BAND_ARRIVAL_FRAMES + elapsed)!
      expect(model.offset).toBeGreaterThan(previous)
      expect(model.offset).toBe(houseTickerOffset(props.series.promise, props.series.day, elapsed / 30 * 1000))
      previous = model.offset
    }
  })

  it('does not reset after a whole cycle and supplies enough strip for the cut', () => {
    const props = fixture('16:9')
    const start = props.ending!.fromFrame + BAND_ARRIVAL_FRAMES
    const before = endingBandModel(props, start + 1139)!
    const after = endingBandModel(props, start + 1141)!
    const cycle = houseTickerCycleWidth(props.series.promise, props.series.day)
    expect(after.offset).toBeGreaterThan(before.offset)
    expect(after.offset).toBeGreaterThan(cycle)
    const last = endingBandModel(props, props.durationFrames - 1)!
    expect(last.cycles * cycle - last.offset).toBeGreaterThan(last.width)
    expect(endingBandModel(props, props.durationFrames)).toBeNull()
  })
})

describe.each(['9:16', '16:9'] as const)('%s chrome', (aspect) => {
  it('keeps the call, its shadow and arrival inside the safe area', () => {
    const props = fixture(aspect)
    const safe = ENDING_SAFE[aspect]
    const width = aspect === '9:16' ? 1080 : 1920
    const height = aspect === '9:16' ? 1920 : 1080
    for (const statement of [props.call!.statement, 'We expect costs to fall.', 'Teams will spend less on tools and more on checking the work before it reaches their customers next year.']) {
      const layout = callCardLayout(aspect, statement)
      expect(layout.box.left).toBeGreaterThanOrEqual(safe.leftPx)
      expect(layout.box.top - 60).toBeGreaterThanOrEqual(safe.topPx)
      expect(layout.box.left + layout.box.width).toBeLessThanOrEqual(width - safe.rightPx)
      expect(layout.box.top + layout.box.height).toBeLessThanOrEqual(height - safe.bottomPx)
      if (aspect === '16:9') {
        expect(layout.width).toBe(1200)
        expect(layout.left + layout.width / 2).toBe(960)
      }
    }
    expect(callCardModel(props, 99)).toBeNull()
    expect(callCardModel(props, 100)!.arrival).toBe(0)
    expect(callCardModel(props, 105)!.arrival).toBe(1)
    expect(callCardModel(props, 180)).toBeNull()
    const { call: _call, ...withoutCall } = props
    expect(callCardModel(withoutCall, 105)).toBeNull()
  })

  it('keeps band identity inside safe insets with full-width ink and ticker', () => {
    const props = fixture(aspect)
    const safe = ENDING_SAFE[aspect]
    const model = endingBandModel(props, 200)!
    const width = aspect === '9:16' ? 1080 : 1920
    const height = aspect === '9:16' ? 1920 : 1080
    expect(model.left).toBe(0)
    expect(model.width).toBe(width)
    expect(model.contentBox.left).toBeGreaterThanOrEqual(safe.leftPx)
    expect(model.contentBox.left + model.contentBox.width).toBeLessThanOrEqual(width - safe.rightPx)
    expect(model.top).toBeGreaterThanOrEqual(safe.topPx)
    expect(model.top + model.height).toBeLessThanOrEqual(height - safe.bottomPx)
    expect(model.logoWidth).toBeGreaterThan(0)
    if (aspect === '16:9') expect(model.height).toBe(320)
    else expect(model.tickerHeight).toBe(HOUSE.band.tickerHeight + HOUSE.band.tickerRule)
  })

  it('renders the call data, stacked logo, day, promise, pill and URL', () => {
    const props = fixture(aspect)
    const call = renderToStaticMarkup(React.createElement(CallCard, { props, frame: 105 }))
    expect(call).toContain('The call')
    expect(call).toContain('Our ')
    expect(call).toContain('call.')
    expect(call).toContain(props.call!.statement)
    const due = houseDueLine(props.call!.due, props.call!.confidencePercent)
    expect(call).toContain(due.due)
    expect(call).toContain(due.sure)
    const band = renderToStaticMarkup(React.createElement(EndingBand, { props, frame: 200 }))
    for (const text of [props.brand.stacked.src, props.series.day, props.series.promise, props.series.label, props.ending!.url, 'MYMU Plex Mono']) expect(band).toContain(text)
    expect(renderToStaticMarkup(React.createElement(EndingBand, { props, frame: 179 }))).toBe('')
  })
})

describe('ending band without the ticker', () => {
  it('draws ink, logo, day, pill and URL with no scrolling strip, and a shorter band', () => {
    const base = fixture('9:16')
    const quiet = EngineRenderPropsSchema.parse({ ...base, ending: { ...base.ending, ticker: false } })
    expect(base.ending!.ticker).toBe(true)
    expect(endingBandModel(quiet, 200)!.tickerHeight).toBe(0)
    expect(endingBandModel(quiet, 200)!.height).toBe(endingBandModel(base, 200)!.height - (HOUSE.band.tickerHeight + HOUSE.band.tickerRule))
    const withTicker = renderToStaticMarkup(React.createElement(EndingBand, { props: base, frame: 200 }))
    const without = renderToStaticMarkup(React.createElement(EndingBand, { props: quiet, frame: 200 }))
    expect(withTicker.toUpperCase()).toContain(base.series.promise.toUpperCase())
    expect(without.toUpperCase()).not.toContain(base.series.promise.toUpperCase())
    expect(without).toContain('makeyourmindup.ai')
  })
})
