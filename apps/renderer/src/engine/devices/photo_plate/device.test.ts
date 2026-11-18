import { createElement, isValidElement, type ComponentProps, type ReactElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Img, OffthreadVideo, Sequence } from 'remotion'
import { describe, expect, it, vi } from 'vitest'
import { EngineEventSchema, EngineObjectSchema } from '../../props'
import type { DeviceProps } from '../types'
import fixture from './fixture.json'
import { Device } from './index'
import { ParamsSchema } from './schema'
import { coverCrop, photoPlateCrop, photoPlateState } from './state'

// Static markup tests device geometry without Remotion's composition runtime.
vi.mock(import('remotion'), async importOriginal => ({
  ...await importOriginal(),
  Img: ({ src, alt, style }: ComponentProps<typeof Img>) => createElement('img', { src, alt, style }),
}))

const object = EngineObjectSchema.parse(fixture.objects[0])
const events = fixture.events.map(event => EngineEventSchema.parse(event))
const image = fixture.objects[0]!.params.image
const video = { src: 'test-clip.mp4', pixelWidth: 1920, pixelHeight: 1080 }
const boxes = {
  '9:16': { left: 0, top: 0, width: 1080, height: 1920 },
  '16:9': { left: 0, top: 0, width: 1920, height: 1080 },
}
const tokens = { ink: 'black', inkDeep: 'navy', inkSoft: 'gray', cream: 'ivory', mint: 'green', channel: 'coral' }
const at = (frame: number) => photoPlateState(object, events, frame)
const props = (frame: number, aspect: DeviceProps['aspect'] = '9:16'): DeviceProps =>
  ({ object, events, tokens, frame, aspect, box: boxes[aspect] })
const still = (frame: number, aspect: DeviceProps['aspect']) => renderToStaticMarkup(createElement(Device, props(frame, aspect)))

function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  return isValidElement<Record<string, unknown>>(node)
    ? [node, ...elements(node.props.children as ReactNode)] : []
}

describe('photo_plate', () => {
  it('accepts exactly one medium and enforces the picture bounds and provenance', () => {
    expect(ParamsSchema.parse({ image })).toMatchObject({ focus: { x: 0.5, y: 0.5 }, push: 0.05, scrim: 0 })
    expect(ParamsSchema.parse({ video })).toMatchObject({ video: { trimBeforeFrames: 0 } })
    expect(ParamsSchema.parse({ image, generated: true }).source).toBeUndefined()
    for (const invalid of [
      {}, { image, video }, { image: { ...image, pixelWidth: 0 } },
      { video: { ...video, trimBeforeFrames: -1 } }, { image, generated: true, source: 'IIHS' },
      { image, push: 0.13 }, { image, scrim: 0.61 }, { image, focus: { x: -0.1, y: 0.5 } },
      { image, regions: { bad: { x: 0.8, y: 0, w: 0.3, h: 1 } } },
    ]) expect(ParamsSchema.safeParse(invalid).success).toBe(false)
  })

  it.each([image, video])('covers both boxes at the original aspect for $src', media => {
    for (const box of Object.values(boxes)) {
      for (const focus of [{ x: 0.5, y: 0.5 }, { x: 0, y: 1 }, { x: 0.8, y: 0.2 }]) {
        const base = coverCrop(media, box, focus)
        for (const push of [0, 0.05, 0.12]) {
          const crop = coverCrop(media, box, focus, push)
          expect(Math.abs(crop.width / crop.height - media.pixelWidth / media.pixelHeight)).toBeLessThan(1e-6)
          expect(crop.left).toBeLessThanOrEqual(0)
          expect(crop.top).toBeLessThanOrEqual(0)
          expect(crop.left + crop.width).toBeGreaterThanOrEqual(box.width - 1e-6)
          expect(crop.top + crop.height).toBeGreaterThanOrEqual(box.height - 1e-6)
          expect(crop.left + focus.x * crop.width).toBeCloseTo(base.left + focus.x * base.width, 6)
          expect(crop.top + focus.y * crop.height).toBeCloseTo(base.top + focus.y * base.height, 6)
        }
      }
    }
    const centred = coverCrop(media, boxes['9:16'])
    expect(centred.left + centred.width / 2).toBeCloseTo(540, 6)
    expect(centred.top + centred.height / 2).toBeCloseTo(960, 6)
  })

  it('wipes on cue, pushes linearly from enter to exit, and holds the crop on exit', () => {
    expect(at(9).visible).toBe(false)
    expect(at(10)).toMatchObject({ visible: true, reveal: 0, push: 0 })
    expect(at(17).reveal).toBeGreaterThan(0)
    expect(at(23).reveal).toBeLessThan(1)
    expect(at(24).reveal).toBe(1)
    expect(at(50).push).toBeCloseTo(0.025)
    expect(at(90)).toMatchObject({ reveal: 1, push: 0.05 })
    expect(at(100).reveal).toBeGreaterThan(0)
    expect(at(100).reveal).toBeLessThan(1)
    expect(at(100).push).toBe(at(90).push)
    expect(at(101).visible).toBe(false)
    expect(photoPlateState(object, [...events].reverse(), 50)).toEqual(at(50))
  })

  it('cuts in and out at the event frames and starts a frame-zero hook at its base crop', () => {
    const cuts = events.map(event => event.verb === 'enter' ? { ...event, toState: 'visible' }
      : event.verb === 'exit' ? { ...event, toState: 'gone' } : event)
    expect(photoPlateState(object, cuts, 10)).toMatchObject({ visible: true, reveal: 1, push: 0 })
    expect(photoPlateState(object, cuts, 89).visible).toBe(true)
    expect(photoPlateState(object, cuts, 90).visible).toBe(false)
    const opening = { ...events[0]!, atFrame: 0 }
    expect(photoPlateState(object, [opening], 0)).toMatchObject({ visible: true, reveal: 1, push: 0, playbackFrom: 0 })
    expect(photoPlateState(object, [opening], 60).push).toBeCloseTo(0.025)
    expect(photoPlateState(object, [opening], 120).visible).toBe(false)
  })

  it('starts the ring only on mark, clears it on none, and refuses unknown regions', () => {
    expect(at(29).region).toBeUndefined()
    expect(at(30)).toMatchObject({ drawn: 0, region: fixture.objects[0]!.params.regions.contact })
    expect(at(35).drawn).toBeGreaterThan(0)
    expect(at(40).drawn).toBeLessThan(1)
    expect(at(41).drawn).toBe(1)
    expect(at(75)).toMatchObject({ region: undefined, drawn: 0 })
    const invalid = { ...events[1]!, toState: 'constructor', atFrame: 50 }
    expect(() => photoPlateState(object, [...events, invalid], 50)).toThrow('needs a named region')
    expect(() => photoPlateState(object, [...events, { ...invalid, verb: 'move', toState: 'none' }], 50))
      .toThrow('move needs a named region')
  })

  it('keeps the crop inside the still at its original aspect and below the zoom cap on every frame', () => {
    const box = boxes['9:16']
    const cover = coverCrop(image, box)
    const enter = events[0]!
    for (const target of [
      { x: 0, y: 0, w: 0.12, h: 0.15 },
      { x: 0.88, y: 0, w: 0.12, h: 0.15 },
      { x: 0, y: 0.85, w: 0.12, h: 0.15 },
      { x: 0.88, y: 0.85, w: 0.12, h: 0.15 },
      { x: 0.16, y: 0.2, w: 0.36, h: 0.55 },
      { x: 0.62, y: 0.5, w: 0.001, h: 0.001 },
      { x: 0, y: 0, w: 1, h: 1 },
    ]) {
      const plate = { ...object, params: { image, focus: { x: 1, y: 1 }, push: 0.12, regions: { target } } }
      const cues = [enter, { ...enter, id: 'move', verb: 'move' as const, toState: 'target', atFrame: 45 }]
      for (let frame = enter.atFrame; frame < plate.toFrame; frame++) {
        const crop = photoPlateCrop(box, photoPlateState(plate, cues, frame))
        expect(crop.left).toBeLessThanOrEqual(0)
        expect(crop.top).toBeLessThanOrEqual(0)
        expect(crop.left + crop.width).toBeGreaterThanOrEqual(box.width - 1e-6)
        expect(crop.top + crop.height).toBeGreaterThanOrEqual(box.height - 1e-6)
        expect(crop.width / crop.height).toBeCloseTo(image.pixelWidth / image.pixelHeight, 6)
        expect(crop.width / cover.width).toBeLessThanOrEqual(1.6 + 1e-6)
      }
    }
  })

  it('lands on the region in 12 frames, keeps pushing, and clamps a corner aim at the edge', () => {
    const box = boxes['9:16']
    const crop = (frame: number) => photoPlateCrop(box, at(frame))
    const target = fixture.objects[0]!.params.regions.contact
    const settled = crop(58)
    expect(settled.left + (target.x + target.w / 2) * settled.width).toBeCloseTo(box.width / 2, 6)
    expect(settled.top + (target.y + target.h / 2) * settled.height).toBeCloseTo(box.height / 2, 6)
    expect(settled.width * target.w).toBeGreaterThanOrEqual(box.width * 0.55)
    expect(crop(57).width).toBeLessThan(settled.width)
    expect(crop(60).width).toBeGreaterThan(settled.width)
    expect(crop(75)).toMatchObject({ left: 0, top: 0, width: 1.6 * coverCrop(image, box).width })
  })

  it('begins each move at the current crop, including a move that interrupts the prior one', () => {
    const box = boxes['9:16']
    const crop = (frame: number, timeline = events, plate = object) =>
      photoPlateCrop(box, photoPlateState(plate, timeline, frame))
    const firstOnly = events.filter(event => event.id !== 'aim-corner')
    const second = events.find(event => event.id === 'aim-corner')!
    const interrupted = { ...second, atFrame: 51 }
    expect(crop(46)).toEqual(crop(46, firstOnly.filter(event => event.verb !== 'move')))
    expect(crop(63)).toEqual(crop(63, firstOnly))
    expect(crop(51, [...firstOnly, interrupted])).toEqual(crop(51, firstOnly))
    expect(crop(52, [...firstOnly, interrupted])).not.toEqual(crop(52, firstOnly))
    const fixed = { ...object, params: { ...object.params, push: 0 } }
    expect(crop(63, events, fixed)).toEqual(crop(58, firstOnly, fixed))
  })

  it.each(['9:16', '16:9'] as const)('draws deterministic %s stills with a fixed chip and a ring locked to the crop', aspect => {
    const shot = still(41, aspect)
    expect(shot).toBe(still(41, aspect))
    expect(shot).toContain('test-photo.jpg')
    expect(shot).toContain('IIHS · small overlap test')
    expect(shot).toContain('font-size:28px')
    expect(shot).toContain('data-scrim="" style="position:absolute;inset:0;background-color:black;opacity:0.25"')
    expect(shot).toContain('stroke="green"')
    expect(still(17, aspect)).toMatch(/clip-path:inset\([\d.]+% 0 0 0\)/)
    expect(still(75, aspect)).not.toContain('data-mark')
    expect(still(101, aspect)).toBe('')
    const { x, y, w, h } = fixture.objects[0]!.params.regions.contact
    for (const frame of [41, 51, 63, 69, 74]) {
      const nodes = elements(Device(props(frame, aspect)))
      const crop = nodes.find(node => node.type === Img)!.props.style as ReturnType<typeof coverCrop>
      const ring = nodes.find(node => node.type === 'rect')!.props
      expect(ring).toMatchObject({ x: crop.left + x * crop.width, y: crop.top + y * crop.height,
        width: w * crop.width, height: h * crop.height })
    }
    const chip = /data-provenance="" style="([^"]+)"/
    expect(shot.match(chip)?.[1]).toBe(still(74, aspect).match(chip)?.[1])
  })

  it('plays muted video from the entrance with the authored source trim', () => {
    const moving = { ...object, params: { video: { ...video, trimBeforeFrames: 14 }, source: 'Test footage · 2026' } }
    const nodes = elements(Device({ ...props(24), object: moving }))
    expect(nodes.find(node => node.type === Sequence)?.props.from).toBe(10)
    expect(nodes.find(node => node.type === OffthreadVideo)?.props).toMatchObject({
      muted: true, src: video.src, trimBefore: 14,
    })
    expect(nodes.find(node => node.props['data-provenance'] === '')?.props.children).toBe('Test footage · 2026')
    const generated = { ...object, params: { image, generated: true } }
    expect(renderToStaticMarkup(createElement(Device, { ...props(24), object: generated }))).not.toContain('data-provenance')
  })
})
