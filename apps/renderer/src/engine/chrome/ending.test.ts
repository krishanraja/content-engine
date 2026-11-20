import { readFileSync } from 'node:fs'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// Remotion's Img reads the frame for premounting, which needs a composition; a plain img renders the same markup here.
vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>()
  return { ...actual, Img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', props),
    Freeze: ({ children }: { children: React.ReactNode }) => children,
    OffthreadVideo: (props: React.VideoHTMLAttributes<HTMLVideoElement>) => React.createElement('video', props) }
})
import { houseDueLine } from '../../house/geometry'
import { EngineRenderPropsSchema, type EngineRenderProps } from '../props'
import { CallCard, callCardLayout, callCardModel, ENDING_SAFE } from './CallCard'
import { ENDING_DAYS, ENDING_SETTLED_S, ENDING_SETTLED_TALL_S, ENDING_TAGLINE, EndingBand, endingBandModel, statementLines } from './EndingBand'

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

describe('the statement close', () => {
  it('says exactly the tagline, broken only between words, the last word alone', () => {
    expect(ENDING_TAGLINE).toBe('Built to help you decide.')
    // The one copy of the close's words is config/brand-palette.json close_copy; this fallback must say the same.
    const palette = JSON.parse(readFileSync(new URL('../../../../../config/brand-palette.json', import.meta.url), 'utf8'))
    expect(ENDING_TAGLINE).toBe(palette.close_copy.tagline)
    expect(statementLines('9:16')).toEqual(['Built to', 'help you', 'decide.'])
    expect(statementLines('16:9')).toEqual(['Built to help you', 'decide.'])
  })

  it('starts on his last word, moves in reading order, settles by 2.75 s and then holds still', () => {
    const props = fixture('16:9')
    const start = props.ending!.fromFrame
    expect(endingBandModel(props, start - 1)).toBeNull()
    const first = endingBandModel(props, start)!
    expect(first.lines.every((line) => line.rise === 0)).toBe(true)
    expect(first.logo).toBe(0)
    const mid = endingBandModel(props, start + 30)!
    expect(mid.lines[0]!.rise).toBe(1)
    expect(mid.logo).toBe(0)
    expect(ENDING_SETTLED_S).toBeCloseTo(2.75)
    const settled = endingBandModel(props, start + Math.ceil(ENDING_SETTLED_S * 30))!
    const later = endingBandModel(props, start + 170)!
    expect(settled.settled).toBe(true)
    for (const model of [settled, later]) {
      expect(model.lines.every((line) => line.rise === 1)).toBe(true)
      expect([model.logo, model.days, model.cta, model.url, model.underline]).toEqual([1, 1, 1, 1, 1])
    }
    expect(endingBandModel(props, props.durationFrames)).toBeNull()
  })

  it('on the tall cut is a 2 s beat: the logo first, everything settled by 1.3 s (config/brand-palette.json statement_beat)', () => {
    const props = fixture('9:16')
    const start = props.ending!.fromFrame
    expect(ENDING_SETTLED_TALL_S).toBeCloseTo(1.3)
    expect(endingBandModel(props, start + 15)!.logo).toBe(1)
    const settled = endingBandModel(props, start + Math.ceil(ENDING_SETTLED_TALL_S * 30))!
    expect(settled.settled).toBe(true)
    expect(settled.lines.every((line) => line.rise === 1)).toBe(true)
    expect([settled.logo, settled.days, settled.cta, settled.url, settled.underline]).toEqual([1, 1, 1, 1, 1])
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

  it('covers the whole frame in ink and keeps every word inside the safe box', () => {
    const props = fixture(aspect)
    const model = endingBandModel(props, 300)!
    const width = aspect === '9:16' ? 1080 : 1920
    const height = aspect === '9:16' ? 1920 : 1080
    expect([model.left, model.top, model.width, model.height]).toEqual([0, 0, width, height])
    const box = model.contentBox
    if (aspect === '9:16') expect([box.left, box.top, box.left + box.width, box.top + box.height]).toEqual([120, 330, 820, 1180])
    else expect([box.left, box.top, box.left + box.width, box.top + box.height]).toEqual([160, 120, 1760, 960])
    expect(model.statementPx).toBeGreaterThanOrEqual(aspect === '9:16' ? 170 : 180)
    expect(model.logoWidth).toBe(aspect === '9:16' ? 420 : 520)
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
    for (const text of [props.brand.stacked.src, 'Built to', 'help you', 'decide.', 'Subscribe free', props.ending!.url, 'MYMU Plex Mono', 'MYMU Anton',
      ...ENDING_DAYS.map((d) => d.day)]) expect(band).toContain(text)
    expect(band).not.toContain(props.series.promise)
    expect(renderToStaticMarkup(React.createElement(EndingBand, { props, frame: 179 }))).toBe('')
  })
})

describe('the close uses what compile passes', () => {
  it('draws the days and copy compile gives it, and the old ticker flag changes nothing', () => {
    const base = fixture('16:9')
    const given = EngineRenderPropsSchema.parse({ ...base, ending: { ...base.ending, ticker: false, cta: 'Read the full piece',
      days: [{ day: 'Mondays', colour: '#FFD84D' }] } })
    const markup = renderToStaticMarkup(React.createElement(EndingBand, { props: given, frame: 300 }))
    expect(markup).toContain('Read the full piece')
    expect(markup).toContain('Mondays')
    expect(markup).not.toContain('Fridays')
    expect(markup).not.toContain(base.series.promise)
  })
})

describe('the close card clears the small-text floor (Krish, 2026-11-19)', () => {
  it('SUBSCRIBE FREE is 26 px on both shapes: 24 px read 17 px tall, under the 18 px floor', async () => {
    const { SHAPE } = await import('./EndingBand')
    // ve qc measured 17 px of glyph height at 24 px (0.71 of the size); the floor is 18 px.
    for (const shape of Object.values(SHAPE)) expect(Math.floor(shape.kick * 17 / 24)).toBeGreaterThanOrEqual(18)
  })
})

describe('the series close on the intro sting (Ruling, Krish, 2026-11-20)', () => {
  const sha = '09da1e77bcd128b1bf53e022ace6056588448bde9bc6711716b8ce01ede57ed8'
  const withSting = (aspect: EngineRenderProps['aspect']) => { const base = fixture(aspect)
    return EngineRenderPropsSchema.parse({ ...base, ending: { ...base.ending, days: [...ENDING_DAYS], sting: { src: 'sting.mp4', series: 'follow_the_money', frames: 56, sha256: sha } } }) }

  it('tall: the sting at 1.5x for 30 frames, its band held, the line and the action landing inside the 2 s beat', async () => {
    const { STING_CLOSE, STING_CLOSE_SETTLED, stingCloseFrame, stingCloseModel } = await import('./EndingBand')
    expect([stingCloseFrame('9:16', 0), stingCloseFrame('9:16', 29), stingCloseFrame('9:16', 30), stingCloseFrame('9:16', 59)]).toEqual([1, 44, 48, 48])
    expect(STING_CLOSE_SETTLED.tall).toBeLessThanOrEqual(60)
    const props = withSting('9:16')
    const start = props.ending!.fromFrame
    expect(stingCloseModel(props, start + 10)!.lift).toBe(0)
    const settled = stingCloseModel(props, start + 59)!
    expect(settled.tall && [settled.lift, settled.line, settled.accent, settled.action]).toEqual([STING_CLOSE.tall.lift.px, 1, 1, 1])
    // every word inside the tall core box x 120 to 820, y 330 to 1180 (config/brand-palette.json safe.tall_core)
    const box = STING_CLOSE.tall.box
    expect(box.left).toBeGreaterThanOrEqual(120); expect(box.left + box.width).toBeLessThanOrEqual(820)
    expect(box.lineTop).toBeGreaterThanOrEqual(330); expect(box.actionTop + 60).toBeLessThanOrEqual(1180)
    const markup = renderToStaticMarkup(React.createElement(EndingBand, { props, frame: start + 59 }))
    for (const text of ['Built to help you', 'decide.', 'Subscribe free', 'makeyourmindup.ai', 'sting-beat']) expect(markup).toContain(text)
    expect(markup).not.toContain('Mondays') // no days row on the tall close
  })

  it('wide: the full sting, then the ink wipes in, settled by 2.75 s and the end-screen area left clear', async () => {
    const { STING_CLOSE, STING_CLOSE_SETTLED, stingCloseModel } = await import('./EndingBand')
    expect(STING_CLOSE_SETTLED.wide / 30).toBeLessThanOrEqual(2.75)
    const props = withSting('16:9')
    const start = props.ending!.fromFrame
    expect(stingCloseModel(props, start + 30)!.stingFrame).toBe(30)
    const settled = stingCloseModel(props, start + STING_CLOSE_SETTLED.wide)!
    expect(!settled.tall && [settled.wipe, settled.line, settled.action]).toEqual([1, 1, 1])
    const w = STING_CLOSE.wide
    expect(w.box.left + w.box.lineWidth).toBeLessThanOrEqual(w.endScreen.left)
    const markup = renderToStaticMarkup(React.createElement(EndingBand, { props, frame: start + 120 }))
    for (const text of ['Built to help you', 'decide.', 'Subscribe free', 'Mondays', 'sting-card']) expect(markup).toContain(text)
  })

  it('refuses another series\' sting, and any sting on an off day', () => {
    const base = withSting('9:16')
    expect(() => EngineRenderPropsSchema.parse({ ...base, ending: { ...base.ending, sting: { ...base.ending!.sting!, series: 'mind_the_gap' } } })).toThrow()
    expect(() => EngineRenderPropsSchema.parse({ ...base, ending: { ...base.ending, days: [] } })).toThrow()
  })
})
