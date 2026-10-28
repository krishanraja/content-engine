import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
vi.mock('remotion', async (original) => ({
  ...await original<typeof import('remotion')>(),
  Img: (p: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', p),
  OffthreadVideo: ({ trimBefore, ...p }: React.VideoHTMLAttributes<HTMLVideoElement> & { trimBefore: number }) => React.createElement('video', { ...p, 'data-trim': trimBefore }),
  Sequence: ({ from, children }: { from: number; children: React.ReactNode }) => React.createElement('div', { 'data-from': from }, children),
}))
import { glassKind, type GlassProps } from '../glassRegistry'
import { Screen } from '../phoneGlass'
import { Cam } from '../camera'
import { footageLayout, footagePointToCanvas } from './footage'
import { Device } from '../../devices/hand_phone_stage'
import { EngineObjectSchema } from '../../props'
import fixture from '../../devices/hand_phone_stage/fixture.json'

const tokens = { ink: 'black', inkDeep: 'black', inkSoft: 'gray', cream: 'ivory', mint: 'green', channel: 'coral' }
const data: Record<string, Record<string, unknown>> = {
  prompt: { lead: 'Our supplier gets cotton from', active: 'Xinjiang', next: 'Turkmenistan', rollAt: 10 },
  cards: { cards: [{ name: 'Claude', flags: [{ station: 'Xinjiang', planted: true }, { station: 'Turkmenistan', planted: false }], score: '2/2' }], scoreAt: 25 },
  footage: { src: 'recording.jpg', underline: { x: 597, y: 320, w: 357 } },
  bubble: { label: 'DeepSeek', quote: "Sorry, that's beyond my current scope.\nLet's talk about something else." },
}
const render = (kind: string, sinceFrames: number, params = data[kind]!, k = 1.8, frame = sinceFrames) =>
  renderToStaticMarkup(React.createElement(glassKind(kind), { frame, sinceFrames, params, tokens, k }))

describe('H glass kinds', () => {
  it.each(Object.keys(data))('%s validates required data and renders at 0, 5, 30', kind => {
    expect(() => render(kind, 0, {})).toThrow()
    for (const frame of [0, 5, 30]) {
      const html = render(kind, frame)
      expect(html).toContain(`data-glass="${kind}"`)
      expect(html).not.toMatch(/overflow:\s*visible|#[\da-fA-F]{3,8}\b|rgb\(/)
      expect(html).toBe(render(kind, frame))
    }
  })
  it('masks the reel through 12 frames and settles on next', () => {
    expect(render('prompt', 9)).toContain('data-slot="active"')
    expect(render('prompt', 9)).not.toContain('data-slot="next"')
    expect(render('prompt', 15)).toContain('data-slot="next"')
    expect(render('prompt', 22)).not.toContain('XINJIANG')
    expect(render('prompt', 22)).toContain('TURKMENISTAN')
    for (const k of [1, 1.8, 2.1]) {
      const html = render('prompt', 30, data.prompt!, k)
      expect(html).toContain(`top:${30 * k + 20}px`)
      const sizes = [...html.matchAll(/font-size:([\d.]+)px/g)].map(m => Number(m[1]))
      expect(Math.min(...sizes)).toBeGreaterThanOrEqual(30)
      expect(sizes).toContain(Math.max(30, 84 * k / 1.8))
    }
  })
  it('names one place only when the prompt has no next', () => {
    const one = { lead: 'Our supplier gets cotton from', active: 'Xinjiang' }
    for (const frame of [0, 15, 60, 400]) {
      const html = render('prompt', frame, one)
      expect(html).toContain('data-slot="active"')
      expect(html).toContain('XINJIANG')
      expect(html).not.toContain('data-slot="next"')
      expect(html).not.toContain('data-next')
    }
    expect(() => render('prompt', 0, { lead: 'x', next: 'y' })).toThrow()
  })
  it('plants flags on their own cues, preserves ghosts and slaps the supplied score', () => {
    expect(render('cards', 21)).not.toContain('data-flag="planted"')
    expect(render('cards', 22)).toContain('data-flag="planted"')
    expect(render('cards', 30)).toContain('data-flag="ghost"')
    expect(render('cards', 24)).not.toContain('data-score')
    expect(render('cards', 25)).toContain('>2/2</div>')
    expect(render('cards', 30)).not.toMatch(/<table|<td|<th|border-collapse|border-top|border-bottom/)
    const p = { cards: [{ name: 'DeepSeek', flags: [{ station: 'Xinjiang', planted: false }], score: 0 }], scoreAt: 0 }
    expect(render('cards', 30, p, 1.9)).toContain('font-size:150px')
    expect(render('cards', 30, p, 1.9)).toContain('>0</div>')
  })
  it('keeps the real image and video untouched, rotated clockwise with no text', () => {
    for (const params of [data.footage!, { src: 'clip.mp4', kind: 'recording', trimBefore: 7 }]) {
      const html = render('footage', 5, params, 1.95, 425)
      expect(html).toContain(params.src)
      expect(html).toContain('transform:rotate(90deg)')
      expect(html.replace(/<[^>]*>/g, '')).toBe('')
      expect(html).not.toMatch(/filter:|background:|sheen/)
      if (params.kind) {
        expect(html).toContain('<video')
        expect(html).toContain('data-from="420"')
        expect(html).toContain('data-trim="7"')
      } else expect(html).toContain('<img')
    }
  })
  it('maps recording pixels through the exact screen homography at every camera scale', () => {
    for (const k of [1, 1.55, 1.95, 2.1]) {
      const screen = new Screen(new Cam(k, -104.5, -197.2, 1648.3))
      const p = { src: 'real.png', pixelWidth: 1087, pixelHeight: 780 }
      const l = footageLayout(p, k)
      for (const [x, y] of [[0, 0], [597, 320], [954, 320], [1087, 780]]) {
        const expected = screen.u2c(l.cx - (y! - 390) * 1.14, l.cy + (x! - 543.5) * 1.14)
        const actual = footagePointToCanvas(screen, p, x!, y!)
        expect(Math.abs(actual[0] - expected[0])).toBeLessThan(1e-6)
        expect(Math.abs(actual[1] - expected[1])).toBeLessThan(1e-6)
      }
    }
  })
  it('renders the verbatim quote at 44 px and enters over 12 frames', () => {
    const html = render('bubble', 30)
    expect(html).toContain("Sorry, that&#x27;s beyond my current scope.\nLet&#x27;s talk about something else.")
    expect(html).toContain('font-size:44px')
    expect(render('bubble', 0)).toContain('opacity:0')
    expect(render('bubble', 12)).toContain('opacity:1')
  })
  it.each([['open', 'prompt'], ['result_a', 'cards'], ['result_b', 'cards'], ['evidence', 'footage'], ['verdict', 'bubble']])('renders %s through a fill event', (start, kind) => {
    const object = EngineObjectSchema.parse({ ...fixture.object, params: { ...fixture.object.params, start, glass: data } })
    for (const elapsed of [0, 5, 30]) {
      const html = renderToStaticMarkup(React.createElement(Device, {
        object, events: [{ id: 'enter', obj: 'phone', verb: 'enter', toState: start!, atFrame: 0 },
          { id: 'fill', obj: 'phone', verb: 'fill', toState: kind!, atFrame: 10 }],
        frame: 10 + elapsed, tokens, aspect: '9:16', box: { left: 0, top: 0, width: 1080, height: 1920 },
      }))
      if (elapsed > 0) expect(html).toContain(`data-glass="${kind}"`)
      if (kind === 'footage' && elapsed === 30) {
        expect(html).not.toContain('phone-glass.png')
        expect(html).toContain('data-footage-grain-mask')
        expect(html).toContain('polygon(evenodd,')
      }
    }
  })
  it('rejects invalid scale and incomplete nested data', () => {
    expect(() => render('prompt', 0, data.prompt!, 0)).toThrow()
    expect(() => render('cards', 0, { cards: [{ name: 'Claude', flags: [{}] }] })).toThrow()
  })
})
