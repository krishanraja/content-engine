import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { REFERENCES, SplitKeyFrame } from './SplitKeyFrame'

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
  it('refuses prohibited captions', () => {
    expect(()=>SplitKeyFrame({variant:'slam',beat:'face',plateSrc:'real.png',series:'under.the.hood',caption:'NO SENDING'})).toThrow()
  })
  it('refuses caption echoes and missing camera plates', () => {
    expect(()=>SplitKeyFrame({variant:'slam',beat:'face',plateSrc:'real.png',series:'under.the.hood',caption:'Singing still in'})).toThrow()
    expect(()=>SplitKeyFrame({variant:'slam',beat:'face',plateSrc:'',series:'under.the.hood'})).toThrow()
  })
})
