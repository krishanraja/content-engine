import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { TitleMoment, titleLayout, type TitleMomentProps } from './TitleMoment'
import { fitScale } from '../fit'

const words = 'where does AI get built when the residents of towns say no?'.split(' ').map((text, i) => ({ text, atFrame: 10 + i * 6 }))
const base: TitleMomentProps = {
  words, fromFrame: 10, toFrame: 130, frame: 100, aspect: '9:16', width: 1080, height: 1920,
  stage: { left: 60, top: 290, width: 800, height: 550 },
  captionBox: { left: 60, top: 1090, width: 800, height: 230 },
  tokens: { cream: 'ivory', ink: 'black', brand: 'ivory' },
}
const draw = (p: Partial<TitleMomentProps> = {}) => renderToStaticMarkup(React.createElement(TitleMoment, { ...base, ...p }))
describe('TitleMoment', () => {
  it('includes each word only from its spoken frame', () => {
    for (let frame = base.fromFrame; frame <= words.at(-1)!.atFrame; frame++) {
      const html = draw({ frame })
      words.forEach((w, i) => expect(html.includes(`data-title-word="${i}"`)).toBe(frame >= w.atFrame))
    }
    words.forEach(w => expect(draw({ frame: words.at(-1)!.atFrame })).toContain(`>${w.text}</span>`))
  })
  it('renders nothing outside the half-open interval or for empty words', () => {
    expect(draw({ frame: 9 })).toBe('')
    expect(draw({ frame: 130 })).toBe('')
    expect(draw({ words: [] })).toBe('')
  })
  it.each(['9:16', '16:9'] as const)('fills at least 80 percent of the %s stage with measured type', aspect => {
    const stage = aspect === '9:16' ? base.stage : { left: 96, top: 54, width: 1728, height: 850 }
    const layout = titleLayout(words, stage, aspect)
    const left = Math.min(...layout.map(p => p.x)), right = Math.max(...layout.map(p => p.x + p.width))
    const width = right - left
    expect(width * fitScale({ width, height: 1 }, stage)).toBeGreaterThanOrEqual(stage.width * 0.8)
    expect(right).toBeLessThanOrEqual(stage.left + stage.width)
    expect(new Set(layout.map(p => p.row)).size).toBeGreaterThanOrEqual(2)
    expect(new Set(layout.map(p => p.row)).size).toBeLessThanOrEqual(4)
    expect(draw({ aspect, stage })).toContain('data-title-moment')
  })
  it('is deterministic through entry, settle, hold and return', () => {
    for (const frame of [10, 32, 76, 80, 100, 125, 129]) expect(draw({ frame })).toBe(draw({ frame }))
  })
  it('returns towards captions with a continuous fade', () => {
    expect(draw({ frame: 120 })).toContain('opacity:1')
    expect(draw({ frame: 125 })).toContain('opacity:0.5')
    expect(draw({ frame: 129 })).toContain('opacity:0.028')
  })
  it('fades where it stands when the captions already took his next words', () => {
    const at = (html: string) => html.match(/data-title-word="0"[^>]*left:([0-9.]+)px;top:([0-9.]+)px/)?.slice(1)
    const moved = (a?: string[], b?: string[]) => Math.hypot(Number(a![0]) - Number(b![0]), Number(a![1]) - Number(b![1]))
    // Only the slow push moves it while it fades in place; flying home to the captions moves it far.
    expect(moved(at(draw({ frame: 125, release: 'fade' })), at(draw({ frame: 119, release: 'fade' })))).toBeLessThan(3)
    expect(moved(at(draw({ frame: 125 })), at(draw({ frame: 119 })))).toBeGreaterThan(40)
    expect(draw({ frame: 125, release: 'fade' })).toContain('opacity:0.5')
  })

  it('grows its card line by line as the words land, never an empty panel waiting for them (Tue 17, 19 Nov)', () => {
    const height = (frame: number) => Number(draw({ card: true, frame }).match(/data-title-card="" style="[^"]*height:([\d.]+)px/)?.[1])
    const first = height(12), last = height(words.at(-1)!.atFrame + 20)
    expect(first).toBeGreaterThan(0)
    expect(last).toBeGreaterThan(first * 1.5)
  })
})
