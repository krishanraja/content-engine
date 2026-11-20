import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// Remotion's Img reads the frame for premounting, which needs a composition; a plain img renders the same markup here.
vi.mock('remotion', async (importOriginal) => {
  const actual = await importOriginal<typeof import('remotion')>()
  return { ...actual, Img: (props: React.ImgHTMLAttributes<HTMLImageElement>) => React.createElement('img', props) }
})
import { EngineEventSchema, EngineObjectSchema } from '../props'
import { overlayTestProps } from '../kit/overlayInvariants'
import { Device as Marquee } from './marquee/index'
import { ParamsSchema as MarqueeParams, TAPE } from './marquee/schema'
import { Device as PhotoPlate } from './photo_plate/index'
import { LOOP, photoPlateState } from './photo_plate/state'
import { ParamsSchema as ScribbleParams } from './scribble/schema'
import { Device as VideoWall, TILES } from './video_wall/index'
import { ParamsSchema as WallParams } from './video_wall/schema'

/** The platform walkthrough (the Character.ai top half, kept as it is: Krish, 2026-11-20): the devices it was missing. */
const tall = { left: 0, top: 0, width: 1080, height: 1000 }
const ev = (obj: string, verb: string, toState: string, atFrame: number) => EngineEventSchema.parse({ id: `${obj}-${verb}-${atFrame}`, obj, verb, toState, atFrame })
const draw = (C: typeof Marquee, object: ReturnType<typeof EngineObjectSchema.parse>, events: ReturnType<typeof ev>[], frame: number, box = tall) =>
  renderToStaticMarkup(React.createElement(C, { ...overlayTestProps, object, events, frame, aspect: '9:16', box }))

describe('marquee: the event tape', () => {
  const object = EngineObjectSchema.parse({ obj: 't', device: 'marquee', meaning: 'the filing', fromFrame: 0, toFrame: 120,
    params: { items: ['Chapter 11', 'Court filing · Filed 12 Oct 2026'], mode: 'tape' } })
  const events = [ev('t', 'enter', 'visible', 10)]
  it('draws two tapes in the series colour, turned -6 and +5 degrees, sliding in from opposite sides', () => {
    const settled = draw(Marquee, object, events, 60)
    expect(settled).toContain('data-tape="display"')
    expect(settled).toContain('data-tape="filing"')
    expect(settled).toContain(`background:${overlayTestProps.tokens.channel}`)
    expect(settled).toContain('rotate(-6deg)')
    expect(settled).toContain('rotate(5deg)')
    expect(TAPE.display.from).toBe(-TAPE.filing.from)
  })
  it('bursts its chips once and has none left by 1.2 s', () => {
    expect((draw(Marquee, object, events, 16).match(/data-chip/g) ?? []).length).toBe(12)
    expect(draw(Marquee, object, events, 10 + TAPE.chipFrames)).not.toContain('data-chip')
  })
  it('needs exactly a display line and a filing line, and the old strip is unchanged', () => {
    expect(() => MarqueeParams.parse({ items: ['one'], mode: 'tape' })).toThrow()
    expect(MarqueeParams.parse({ items: ['one'] }).mode).toBe('strip')
  })
})

describe('video_wall: the tiled UI wall from his grabs', () => {
  const clips = [0, 1, 2].map(i => ({ id: `g${i}`, src: `grab-${i}.png`, source: 'CHARACTER.AI HOME PAGE · SCREEN GRABS', kind: 'image' }))
  const object = EngineObjectSchema.parse({ obj: 'w', device: 'video_wall', meaning: 'his grabs', fromFrame: 0, toFrame: 200, params: { clips, mode: 'tiles' } })
  const events = [ev('w', 'enter', 'visible', 0)]
  it('fills the box with his grabs under an ink scrim, with the source line, and drifts so it is never still', () => {
    const a = draw(VideoWall, object, events, 20), b = draw(VideoWall, object, events, 21)
    expect((a.match(/data-tile=/g) ?? []).length).toBeGreaterThanOrEqual(TILES.columns['9:16'] * 5)
    expect(a).toContain('data-scrim')
    expect(a).toContain('CHARACTER.AI HOME PAGE · SCREEN GRABS')
    expect(a).not.toBe(b)
  })
  it('takes only screen grabs (images)', () => {
    expect(() => WallParams.parse({ mode: 'tiles', clips: [{ id: 'v', src: 'v.mp4', source: 's', kind: 'video' }] })).toThrow()
  })
})

describe('photo_plate: loops on a region of the recording', () => {
  const object = EngineObjectSchema.parse({ obj: 'r', device: 'photo_plate', meaning: 'his recording', fromFrame: 0, toFrame: 200,
    params: { image: { src: 'rec.png', pixelWidth: 960, pixelHeight: 420 }, markStyle: 'loop', markColour: 'channel', keepMarks: true, frame: true,
      regions: { a: { x: 0.1, y: 0.24, w: 0.135, h: 0.3 }, b: { x: 0.77, y: 0.24, w: 0.135, h: 0.3 } } } })
  const events = [ev('r', 'enter', 'visible', 0), ev('r', 'mark', 'a', 20), ev('r', 'mark', 'b', 50)]
  it('draws each loop on the word that names it in 8 frames, its echo 3 frames later, and keeps both', () => {
    expect(photoPlateState(object, events, 20).loops[0]!.drawn).toBe(0)
    expect(photoPlateState(object, events, 20 + LOOP.drawFrames).loops[0]!.drawn).toBeCloseTo(1)
    expect(photoPlateState(object, events, 20 + LOOP.drawFrames).loops[0]!.echo).toBeLessThan(1)
    expect(photoPlateState(object, events, 80).loops.map(l => l.name)).toEqual(['a', 'b'])
    const markup = draw(PhotoPlate, object, events, 80, { left: 60, top: 280, width: 800, height: 324 })
    expect(markup).toContain(`stroke="${overlayTestProps.tokens.channel}"`)
    expect(markup).toContain('border-radius:22px')
    expect(markup).not.toContain('data-mark=""') // the old mint rectangle is not drawn under a loop
  })
  it('a scribble may wear the series colour', () => {
    expect(ScribbleParams.parse({ shape: 'tick', cx: 1, cy: 1, size: 10, colour: 'channel', seed: 's' }).colour).toBe('channel')
  })
})
