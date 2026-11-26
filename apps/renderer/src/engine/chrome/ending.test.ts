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
import { EngineRenderPropsSchema, type EngineRenderProps } from '../props'
import { ENDING_SAFE, LANDING_KICKER, LandingCard, landingCardLayout, landingCardModel } from './LandingCard'
import { WhyStep, whyStepModel } from './WhyStep'
import { ENDING_DAYS, ENDING_SETTLED_S, ENDING_SETTLED_TALL_S, ENDING_TAGLINE, EndingBand, endingBandModel, statementLines } from './EndingBand'
import { V5_OUTRO, V5_OUTRO_TRACKS, V5_OUTRO_WORDS, libraryEase, v5OutroBars, v5OutroModel } from './V5Outro'

function fixture(aspect: EngineRenderProps['aspect']): EngineRenderProps {
  const image = { src: 'stacked.svg', pixelWidth: 1040, pixelHeight: 320 }
  return EngineRenderPropsSchema.parse({
    pieceId: 'landing-ending', cutId: 'short', format: 'face-with-proof', aspect, fps: 30, durationFrames: 2000,
    tokens: { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'white', mint: 'aquamarine', channel: 'gold' },
    series: { label: 'follow.the.money', day: 'Monday', promise: 'Where the money moves', site: 'makeyourmindup.ai' },
    brand: { mark: image, logo: image, stacked: image },
    audio: { stem: { src: 'stem.wav', trimBeforeFrames: 0 } },
    captions: [{ fromFrame: 0, toFrame: 2000, words: [{ text: 'Why', atFrame: 0 }], swipeIndex: null }],
    beats: [
      { id: 'why-1', role: 'why', layout: 'F1', fromFrame: 0, toFrame: 100, uses: [], transitionOut: 'cut',
        why: { n: 1, question: 'Why are teams spending more on checking the work?', strength: 'documented' } },
      { id: 'landing', role: 'landing', layout: 'F1', fromFrame: 100, toFrame: 180, uses: [], transitionOut: 'cut',
        landing: { shows: 'Teams now spend less on tools and more on checking the work.', open_question: 'Who in your team checks the work today?' } },
    ],
    objects: [], events: [],
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
  it('keeps the landing card, its shadow and arrival inside the safe area', () => {
    const props = fixture(aspect)
    const safe = ENDING_SAFE[aspect]
    const width = aspect === '9:16' ? 1080 : 1920
    const height = aspect === '9:16' ? 1920 : 1080
    const question = 'Who in your team checks the work today, and who would notice if nobody did?'
    for (const shows of [props.beats[1]!.landing!.shows, 'Costs fell.', 'Teams now spend less on tools and more on checking the work before it reaches their customers, and the checking is the new cost.']) {
      const layout = landingCardLayout(aspect, shows, question)
      expect(layout.box.left).toBeGreaterThanOrEqual(safe.leftPx)
      expect(layout.box.top - 60).toBeGreaterThanOrEqual(safe.topPx)
      expect(layout.box.left + layout.box.width).toBeLessThanOrEqual(width - safe.rightPx)
      expect(layout.box.top + layout.box.height).toBeLessThanOrEqual(height - safe.bottomPx)
      if (aspect === '16:9') {
        expect(layout.width).toBe(1200)
        expect(layout.left + layout.width / 2).toBe(960)
      }
    }
    expect(landingCardModel(props, 99)).toBeNull()
    expect(landingCardModel(props, 100)!.arrival).toBe(0)
    expect(landingCardModel(props, 112)!.arrival).toBe(1)
    expect(landingCardModel(props, 180)).toBeNull()
    // A landing beat with no landing (an archived cut's closing beat) draws no card.
    const bare = { ...props, beats: props.beats.map(({ landing: _landing, ...beat }) => beat) }
    expect(landingCardModel(bare, 112)).toBeNull()
  })

  it('holds the why step for 1.5 s from its beat, marks its strength, and draws nothing on other beats', () => {
    const props = fixture(aspect)
    const [why, landing] = props.beats
    expect(whyStepModel(props, why!, 0)!.label).toBe('Why 1')
    expect(whyStepModel(props, why!, 12)!.opacity).toBe(1)
    expect(whyStepModel(props, why!, 45)!.opacity).toBe(1)
    expect(whyStepModel(props, why!, 45 + 6)).toBeNull()
    expect(whyStepModel(props, landing!, 120)).toBeNull()
    const markup = (strength: 'documented' | 'inferred' | 'open') => renderToStaticMarkup(React.createElement(WhyStep, { props, beat: { ...why!, why: { ...why!.why!, strength } }, frame: 20 }))
    expect(markup('documented')).toContain('Why 1')
    expect(markup('documented')).toContain(why!.why!.question)
    expect(markup('documented')).toMatch(/data-strength-marker="" style="[^"]*background:black;border:4px solid black/)
    expect(markup('inferred')).toMatch(/data-strength-marker="" style="[^"]*background:transparent;border:4px solid black/)
    expect(markup('open')).toMatch(/data-strength-marker="" style="[^"]*background:transparent;border:4px dashed black/)
    expect(markup('open')).toContain('open question')
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

  it('renders the landing, stacked logo, day, promise, pill and URL, and no prediction anywhere', () => {
    const props = fixture(aspect)
    const landing = renderToStaticMarkup(React.createElement(LandingCard, { props, frame: 112 }))
    expect(landing).toContain(LANDING_KICKER)
    expect(landing).toContain(props.beats[1]!.landing!.shows)
    expect(landing).toContain(props.beats[1]!.landing!.open_question)
    // No verdict, odds, meter or date on the landing (Ruling, Krish, 2026-11-24).
    expect(landing).not.toMatch(/our call|the call|% sure|how sure|\bdue\b|\d{4}-\d{2}-\d{2}|predict|odds/i)
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

describe('every video ends on the v5 outro card, the Library\'s outro (Ruling, Krish, 2026-11-26: "1 agreed")', () => {
  const library = JSON.parse(readFileSync(new URL('../../../../../docs/ve/cards/library/library.json', import.meta.url), 'utf8')) as {
    items: { id: string; width: number; height: number; wordmarks: number; step_edges?: number[]; scene: { kind: string; rect: number[]; value?: string; slot?: string; color?: string }[]
      motion: { fps: number; frames: number; hold_from: number; tracks: { element: string; property: string; start: number; duration: number; from: number }[] } }[] }
  const lock = JSON.parse(readFileSync(new URL('../../../../../docs/ve/cards/library/lock.json', import.meta.url), 'utf8')) as {
    locked: { id: string; approved_by: string; words: string }[]; pending_approval: string[] }
  const outro = (aspect: EngineRenderProps['aspect']) => { const base = fixture(aspect)
    return EngineRenderPropsSchema.parse({ ...base, renderTheme: 'makeyourmindup-v5', durationFrames: base.ending!.fromFrame + V5_OUTRO[aspect].closeFrames,
      beats: base.beats.map((beat, i) => i === base.beats.length - 1 ? { ...beat, toFrame: base.ending!.fromFrame + V5_OUTRO[aspect].closeFrames } : beat),
      ending: { ...base.ending, days: [], look: 'v5_outro' } }) }

  it.each(['9:16', '16:9'] as const)('%s: shows what the template shows: S3h, Follow for more, the address, no tagline, days or stacked mark', (aspect) => {
    const props = outro(aspect)
    const markup = renderToStaticMarkup(React.createElement(EndingBand, { props, frame: props.durationFrames - 1 }))
    expect(markup).toContain(`data-template="${V5_OUTRO[aspect].item}"`)
    expect(markup).toContain('s3h.svg')
    for (const text of ['Follow for more', 'makeyourmindup.ai']) expect(markup).toContain(text)
    // One wordmark (ONE-MARK.md): S3h once, never the stacked V10 or V6 it replaced.
    expect(markup.match(/<img[^>]*s3h\.svg/g)).toHaveLength(1)
    expect(markup).not.toContain(props.brand.stacked.src)
    for (const text of [...statementLines(aspect), 'Subscribe free', ...ENDING_DAYS.map((d) => d.day), props.series.promise, 'follow.the.money', 'Follow the money'])
      expect(markup).not.toContain(text)
    expect(markup).not.toContain('<video')
  })

  it.each(['9:16', '16:9'] as const)('%s: its words, mark, bars and motion are the Library template\'s (library.json)', (aspect) => {
    const shape = V5_OUTRO[aspect]
    const item = library.items.find((i) => i.id === shape.item)!
    expect([item.width, item.height, item.wordmarks]).toEqual([shape.width, shape.height, 1])
    expect(item.scene.filter((op) => op.kind === 'mark').map((op) => op.value)).toEqual(['s3h'])
    expect(item.scene.filter((op) => op.kind === 'text').map((op) => op.value)).toEqual([V5_OUTRO_WORDS.invitation, V5_OUTRO_WORDS.site])
    const bars = item.scene.find((op) => op.kind === 'bars')!.rect
    expect([bars[1], bars[3]]).toEqual([shape.bars.top, shape.bars.height])
    expect(item.step_edges ?? [0, 0.25, 0.5, 0.75, 1]).toEqual([...shape.bars.edges])
    expect([item.motion.fps, item.motion.frames, item.motion.hold_from]).toEqual([25, shape.frames, shape.holdFrom])
    const track = (element: string, property: string) => item.motion.tracks.find((t) => t.element === element && t.property === property)!
    expect([1, 2, 3, 4].map((n) => { const t = track(`bar-${n}`, 'drop'); return { start: t.start, duration: t.duration } })).toEqual(V5_OUTRO_TRACKS.drop)
    expect([1, 2, 3, 4].map((n) => track(`bar-${n}`, 'pulse').start)).toEqual(V5_OUTRO_TRACKS.pulse)
    for (const name of ['make', 'your', 'mind', 'up'] as const) {
      const t = track(name, 'land')
      expect({ start: t.start, duration: t.duration }).toEqual(V5_OUTRO_TRACKS[name])
    }
    expect({ start: track('disc', 'land').start, duration: track('disc', 'land').duration }).toEqual(V5_OUTRO_TRACKS.disc)
    expect({ start: track('disc', 'lock').start, duration: track('disc', 'lock').duration }).toEqual(V5_OUTRO_TRACKS.lock)
    const enter = track('body_1', 'enterY')
    expect([enter.start, enter.duration, enter.from, track('label_1', 'enterY').from]).toEqual([shape.enter.start, shape.enter.duration, shape.enter.invitation, shape.enter.site])
    // The settled staircase is the template's: each bar a quarter wide (the wide one stepped), rising a quarter of the foot each.
    const props = outro(aspect)
    const settled = v5OutroBars(props, v5OutroModel(props, props.durationFrames - 1)!)
    settled.forEach((bar, i) => {
      expect(bar.left).toBeCloseTo(shape.bars.edges[i]! * shape.width)
      expect(bar.width).toBeCloseTo((shape.bars.edges[i + 1]! - shape.bars.edges[i]!) * shape.width)
      expect(bar.top).toBeCloseTo(shape.height - shape.bars.height * (i + 1) / 4)
      expect(bar.colour).toBe(['#FF6A4D', '#FFD84D', '#B7A6FF', '#7EF0C0'][i])
      expect(bar.pulse).toBe(false)
    })
  })

  it('the outro templates are approved in the Library (lock.json), on the delegation and his "1 agreed"', () => {
    for (const id of ['video-vertical-outro', 'video-wide-outro']) {
      const row = lock.locked.find((r) => r.id === id)!
      expect(row.words).toContain('1 agreed')
      expect(lock.pending_approval).not.toContain(id)
    }
  })

  it('plays the template\'s motion: four full-height bars on its first frame, settled by 2.4 s wide and 1.33 s tall', () => {
    for (const aspect of ['16:9', '9:16'] as const) {
      const props = outro(aspect)
      const start = props.ending!.fromFrame
      expect(v5OutroModel(props, start - 1)).toBeNull()
      const first = v5OutroModel(props, start)!
      expect(first.snap).toBe(true)
      expect(v5OutroBars(props, first).map((bar) => [bar.top, bar.height])).toEqual([[0, V5_OUTRO[aspect].height], [0, V5_OUTRO[aspect].height], [0, V5_OUTRO[aspect].height], [0, V5_OUTRO[aspect].height]])
      expect([first.make, first.your, first.mind, first.up, first.words]).toEqual([0, 0, 0, 0, null])
      const hold = aspect === '16:9' ? 72 : 40  // Library frame 60 at 25 fps: 2.4 s wide; 60 of its 90 in the 2 s beat tall
      expect(v5OutroModel(props, start + hold - 1)!.settled).toBe(false)
      const settled = v5OutroModel(props, start + hold)!
      expect(settled.settled).toBe(true)
      expect([settled.make, settled.your, settled.disc, settled.lock, settled.mind, settled.up, settled.words]).toEqual([1, 1, 1, 1, 1, 1, 1])
      expect(v5OutroModel(props, props.durationFrames)).toBeNull()
    }
    expect(libraryEase(0)).toBe(0)
    expect(libraryEase(1)).toBe(1)
    expect(libraryEase(0.5)).toBeGreaterThan(0.9)
  })

  it('a cut with no look keeps the close it was signed with, and the outro carries no days row or sting', () => {
    const base = fixture('16:9')
    const signed = renderToStaticMarkup(React.createElement(EndingBand, { props: base, frame: 300 }))
    expect(signed).toContain('Built to')
    expect(signed).not.toContain('v5-outro')
    expect(() => EngineRenderPropsSchema.parse({ ...base, ending: { ...base.ending, days: [...ENDING_DAYS], look: 'v5_outro' } })).toThrow(/no series days row/)
  })

  it('the palette: no sting close, the series close is the outro on both shapes, and no days row', () => {
    const palette = JSON.parse(readFileSync(new URL('../../../../../config/brand-palette.json', import.meta.url), 'utf8'))
    expect(palette.series_close.close).toEqual({ long_cut: 'statement_card', short_cut: 'statement_beat' })
    expect(palette.series_close.outro.templates).toEqual({ '16x9': V5_OUTRO['16:9'].item, '9x16': V5_OUTRO['9:16'].item })
    expect(palette.series_close.outro.look).toBe('v5_outro')
    expect(palette.formats.long_cut.series.days_row).toBe(false)
    expect(palette.formats.short_cut.series.days_row).toBe(false)
    expect(palette.closes.sting_beat).toBeUndefined()
    expect(palette.closes.sting_card).toBeUndefined()
  })
})

describe('the retired series close on the intro sting, kept for cuts signed 23 to 25 Nov (Ruling, Krish, 2026-11-20)', () => {
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
    expect(box.lineTop).toBeGreaterThanOrEqual(330); expect(box.urlTop + STING_CLOSE.tall.sizes.url * 1.1).toBeLessThanOrEqual(1180)
    // the wordmark lifted with the band stays inside the core box too (frame 48: y 784 to 1022)
    expect(784 - STING_CLOSE.tall.lift.px).toBeGreaterThanOrEqual(330)
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

describe('every word of the retired sting close is legible (config/ve/shot-grammar.json evidence.words_min_px)', () => {
  it('each size is at least words_min_px, and the pill and the address at least 40 px of cap height, on both shapes', async () => {
    const { STING_CLOSE, CAP_HEIGHT } = await import('./EndingBand')
    const grammar = JSON.parse(readFileSync(new URL('../../../../../config/ve/shot-grammar.json', import.meta.url), 'utf8'))
    const min = grammar.evidence.words_min_px as number
    expect(min).toBe(40)
    for (const shape of [STING_CLOSE.tall, STING_CLOSE.wide]) {
      for (const size of Object.values(shape.sizes)) expect(size).toBeGreaterThanOrEqual(min)
      expect(shape.sizes.pill * CAP_HEIGHT.structure).toBeGreaterThanOrEqual(40)
      expect(shape.sizes.url * CAP_HEIGHT.data).toBeGreaterThanOrEqual(40)
    }
  })

  it('the wide close keeps every word left of the end-screen area', async () => {
    const { STING_CLOSE } = await import('./EndingBand')
    const { textWidth } = await import('../../house/metrics')
    const w = STING_CLOSE.wide
    expect(w.box.left + textWidth('mono', 'makeyourmindup.ai', w.sizes.url, 0.06)).toBeLessThanOrEqual(w.endScreen.left)
    expect(w.box.left + textWidth('mono', 'MONDAYS · WEDNESDAYS · FRIDAYS', w.sizes.days, 0.12)).toBeLessThanOrEqual(w.endScreen.left)
    expect(w.box.left + textWidth('anton', 'BUILT TO HELP YOU', w.sizes.line, 0.005)).toBeLessThanOrEqual(w.endScreen.left)
  })
})
