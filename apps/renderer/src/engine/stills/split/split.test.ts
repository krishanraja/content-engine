import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { REFERENCES, SplitKeyFrame, STAGE_TEXT, captionTokens } from './SplitKeyFrame'

vi.mock('remotion', () => ({ staticFile: (path: string) => '/' + path, Img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', props) }))

describe('SplitKeyFrame', () => {
  for (const variant of ['slam', 'receipt'] as const) {
    it(`${variant} references four different measured moments`, () => {
      expect(new Set(Object.values(REFERENCES[variant])).size).toBe(4)
    })
    for (const beat of ['hook', 'face', 'proof', 'close'] as const) {
      it(`${variant}/${beat} retains the measured geometry and safe caption`, () => {
        const markup = renderToStaticMarkup(React.createElement(SplitKeyFrame, { variant, beat, plateSrc: 'real-take-frame.png', series: variant==='slam'?'under.the.hood':'follow.the.money' }))
        expect(Number(markup.match(/data-stage-height="(\d+)"/)![1])).toBeGreaterThanOrEqual(1000)
        expect(markup).toContain(`data-reference="${REFERENCES[variant][beat]}"`)
        expect(markup).toContain('data-logo="true"')
        expect(markup).toContain('data-series="true"')
        expect(markup).toContain('left:72px;top:79px;width:888px;height:56px')
        expect(markup).not.toMatch(/proactive ai is coming|it doesn't spend my money|amazon for your groceries|ibiza|no spending|no sending/i)
        for (const match of markup.matchAll(/font(?:-size|Size)[:=]"?(\d+)/g)) expect(Number(match[1])).toBeGreaterThanOrEqual(30)
        if (beat==='face'||beat==='proof') {
          expect(markup).toContain('data-band="hard-edge"')
          expect(markup).toContain('border:0;border-radius:0')
          expect(markup).toContain('object-fit:cover;object-position:center top')
          expect(markup).toContain('data-caption-left="60" data-caption-right="860"')
          expect(markup).not.toMatch(/filter:blur|scale\(/)
        }
        if (beat==='proof') expect(markup).toContain(variant==='slam'?'data-proof-object="official-charts"':'WIRED · REBUILT RECEIPT')
      })
    }
  }
  it('keeps his whole head in the band: plateY sets the crop, and a plate with none is cropped from the top', () => {
    const base = { variant: 'receipt' as const, beat: 'face' as const, plateSrc: 'real.png', series: 'follow.the.money' as const }
    expect(renderToStaticMarkup(React.createElement(SplitKeyFrame, { ...base, plateY: 56 }))).toContain('object-position:50% 56%')
    expect(renderToStaticMarkup(React.createElement(SplitKeyFrame, base))).toContain('object-position:center top')
    expect(() => SplitKeyFrame({ ...base, plateY: 120 })).toThrow()
  })
  it('refuses prohibited captions', () => {
    expect(()=>SplitKeyFrame({variant:'slam',beat:'face',plateSrc:'real.png',series:'under.the.hood',caption:'NO SENDING'})).toThrow()
  })
  it('refuses caption echoes and missing camera plates', () => {
    expect(()=>SplitKeyFrame({variant:'slam',beat:'face',plateSrc:'real.png',series:'under.the.hood',caption:'Singing still in'})).toThrow()
    expect(()=>SplitKeyFrame({variant:'slam',beat:'face',plateSrc:'',series:'under.the.hood'})).toThrow()
  })
})

describe('round two regressions', () => {
  const draw = (variant: 'slam' | 'receipt', beat: 'hook' | 'face' | 'proof' | 'close', caption?: string) =>
    renderToStaticMarkup(React.createElement(SplitKeyFrame, { variant, beat, plateSrc: 'real.png', series: 'follow.the.money', caption }))
  it('fills full-frame cards through the drawn lower edge', () => {
    for (const variant of ['slam', 'receipt'] as const) for (const beat of ['hook', 'close'] as const) {
      const html = draw(variant, beat)
      const bottom = Number(html.match(/data-content-bottom="(\d+)"/)![1])
      expect(bottom).toBeGreaterThanOrEqual(1650)
      expect(1920-bottom).toBeLessThan(1920*.2)
      // The final foreground rectangle, not a ground field, ends at this bound.
      expect(html).toMatch(beat==='hook' && variant==='slam'
        ? /y="1370" width="780" height="330"/
        : beat==='hook' ? /y="1400" width="730" height="300"/ : /y="1590" width="730" height="110"/)
    }
  })
  it('puts the receipt end colour above ink and content in both fields', () => {
    const html = draw('receipt','close')
    expect(html).toMatch(/data-close-upper="true" y="0" width="1080" height="1300" fill="#FFD84D"/i)
    expect(html).toMatch(/data-close-lower="true" y="1300" width="1080" height="620" fill="#070D0B"/i)
    expect(html).toMatch(/x="120" y="450"/)
    expect(html).toContain('y="1460"')
    expect(html).toContain('data-close-pill="true" x="120" y="1590"')
    expect(html).toContain('makeyourmindup.ai')
  })
  it('closes the music argument with a different question', () => {
    expect(draw('slam','close')).toContain('THE CREDIT')
    expect(draw('slam','close')).not.toContain('HUMAN MUSIC?')
  })
  it('keeps the real chart intact, wide and horizontal', () => {
    const object = draw('slam','proof').match(/<img data-proof-object[^>]+/)![0]
    expect(object).toContain('officialcharts_song_page.png')
    expect(object).toContain('width:888px;height:444px;object-fit:contain')
    expect(object).not.toMatch(/rotate|object-fit:cover|clip/)
  })
  it('keeps the reported hedge on both figures', () => {
    for (const beat of ['hook','proof'] as const) {
      expect(draw('receipt',beat)).toContain('$2.7B')
      expect(draw('receipt',beat)).toContain('(REPORTED)')
    }
  })
  it('leaves at least 40px after the court source, including descenders', () => {
    const html = draw('receipt','face')
    const baseline = Number(html.match(/data-court-baseline="(\d+)"/)![1])
    expect(920 - (baseline + 36*.25)).toBeGreaterThanOrEqual(40)
  })
  it('shares no meaningful token between each face/proof stage and its caption', () => {
    for (const variant of ['slam','receipt'] as const) for (const beat of ['face','proof'] as const) {
      const html = draw(variant,beat)
      const caption = html.match(/data-caption[^>]*>([^<]+)<\/div>/)![1]
      const stage = captionTokens(STAGE_TEXT[variant][beat])
      expect(captionTokens(caption!).filter(token => stage.includes(token))).toEqual([])
    }
  })
  it('rejects shared names, inflections, numbers and semantic bankruptcy echoes', () => {
    for (const [variant, beat, caption] of [
      ['slam','proof','It reached number two.'],
      ['slam','proof','Second place.'],
      ['slam','face','She sings.'],
      ['slam','proof','Official Charts.'],
      ['receipt','face','The company went bust.'],
      ['receipt','face','Bankruptcy.'],
      ['receipt','proof','Google paid.'],
    ] as const) expect(() => draw(variant,beat,caption)).toThrow('Caption repeats stage words')
  })
})
