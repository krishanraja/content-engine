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
        : beat==='hook' ? /y="1400" width="788" height="300"/ : /y="1590" width="730" height="110"/)
    }
  })
  it('puts the receipt end colour above ink and content in both fields', () => {
    const html = draw('receipt','close')
    expect(html).toMatch(/data-close-upper="true" y="0" width="1080" height="1300" fill="#F4EFE4"/i)
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


// Bounds use the rendered SVG coordinates and a conservative em ascent plus
// quarter-em descent, rather than a second set of hand-maintained baselines.
describe('round three receipt regressions', () => {
  const draw = (beat: 'hook' | 'close', series = 'follow.the.money' as 'follow.the.money' | 'under.the.hood' | 'mind.the.gap') =>
    renderToStaticMarkup(React.createElement(SplitKeyFrame, {variant:'receipt', beat, plateSrc:'real.png', series}))
  const attr = (tag: string, name: string) => Number(tag.match(new RegExp(name + '="([0-9.]+)"'))![1])
  it('keeps every full-frame text box clear of the caption rectangle', () => {
    for (const beat of ['hook', 'close'] as const) {
      const html = draw(beat)
      for (const [tag, words] of [...html.matchAll(/(<text [^>]+)>([^<]+)<\/text>/g)].map(m => [m[1]!, m[2]!])) {
        const x = attr(tag!, 'x'), baseline = attr(tag!, 'y'), size = attr(tag!, 'font-size')
        const box = {left:x, right:x + words!.length*size, top:baseline-size, bottom:baseline+size*.25}
        expect(box.right <= 60 || box.left >= 860 || box.bottom <= 1090 || box.top >= 1320, words).toBe(true)
      }
      // The HTML header is also text, above the reserved caption rectangle.
      const header = html.match(/<header[^>]+/)![0]
      const top = Number(header.match(/top:(\d+)px/)![1])
      const height = Number(header.match(/height:(\d+)px/)![1])
      expect(top+height).toBeLessThan(1090)
    }
  })
  it('leaves at least 24px of card below the reported hedge including descent', () => {
    const html = draw('hook')
    const card = html.match(/<rect data-reported-card[^>]+/)![0]
    const hedge = html.match(/(<text [^>]+)>\(REPORTED\)<\/text>/)![1]
    expect(attr(card,'y')+attr(card,'height')-(attr(hedge!,'y')+attr(hedge!,'font-size')*.25)).toBeGreaterThanOrEqual(24)
  })
  it('gives the logo its own ink bar and the series tag a contrasting pill', () => {
    for (const series of ['follow.the.money', 'under.the.hood', 'mind.the.gap'] as const) {
      const html = draw('close',series)
      const field = html.match(/data-close-upper[^>]+fill="([^"]+)"/)![1]
      const header = html.match(/<header[^>]+/)![0]
      const logo = html.match(/<img data-logo[^>]+/)![0]
      const pill = html.match(/<span data-series[^>]+/)![0]
      expect(header).not.toContain('background:')
      const background = logo.match(/background:([^;"]+)/)![1]
      expect(background).not.toBe(field)
      expect(logo).toContain('split/wordmark.png')
      expect(logo).toContain('width:260px;height:56px;object-fit:contain')
      expect(pill.match(/background:([^;"]+)/)![1]).not.toBe(field)
      expect(pill.match(/color:([^;"]+)/)![1]).not.toBe(pill.match(/background:([^;"]+)/)![1])
    }
  })
})
