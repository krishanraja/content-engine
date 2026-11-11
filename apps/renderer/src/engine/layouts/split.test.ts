import { MarkTile } from '../chrome/MarkTile'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { OffthreadVideo } from 'remotion'
import { describe, expect, it, vi } from 'vitest'
import fixture from '../../../../../fixtures/ve/engine-core/props.json'
import { slotsFor, splitCameraBox, splitPlatePosition } from './index'
import { FWP_SPLIT_SEAM_Y, FWP_SPLIT_CAPTION_ZONE, FWP_POSTER_POSITIONS } from '../mocks/face-with-proof'
import { EngineRenderPropsSchema } from '../props'
import { FormatMaster } from '../FormatMaster'
import { BrandFrame, SplitCaptionTrack } from '../BrandFrame'
import { CaptionTrack } from '../chrome/CaptionTrack'
import { StageHeader } from '../chrome/StageHeader'
import { boxFor } from '../geometry'

vi.mock('../clock', async (importOriginal) => ({ ...await importOriginal<typeof import('../clock')>(), useEngineFrame: () => 75 }))
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}
function propsForSplit() {
  const props = EngineRenderPropsSchema.parse(fixture)
  props.aspect = '9:16'
  props.beats[1]!.layout = 'SPLIT'
  props.beats[1]!.role = 'anchor'
  props.objects = [{ obj: 'proof', device: 'stamp', meaning: 'proof', variants: {}, params: { main: 'Proof' }, fromFrame: 0, toFrame: 120 }]
  props.beats[1]!.uses = ['proof']
  props.captions = [{ fromFrame: 0, toFrame: 120, words: [{ text: 'Proof', atFrame: 0 }], swipeIndex: null }]
  return props
}
it('accepts SPLIT and refuses unknown engine layouts', () => {
  const props = propsForSplit()
  expect(EngineRenderPropsSchema.safeParse(props).success).toBe(true)
  expect(EngineRenderPropsSchema.safeParse({ ...props, beats: [{ ...props.beats[1], layout: 'unknown' }] }).success).toBe(false)
})
describe('frozen SPLIT geometry', () => {
  it('shares the stage for every device and refuses wide even without devices', () => {
    const box = { left: 60, top: 300, width: 960, height: FWP_SPLIT_SEAM_Y - 360 }
    expect(slotsFor('SPLIT', '9:16', 3)).toEqual([box, box, box])
    expect(slotsFor('SPLIT', '9:16', 0)).toEqual([])
    expect(() => slotsFor('SPLIT', '16:9', 0)).toThrow('no wide lock')
    expect(splitCameraBox('9:16')).toEqual({ left: 0, top: FWP_SPLIT_SEAM_Y, width: 1080, height: 1920 - FWP_SPLIT_SEAM_Y })
    expect(() => splitCameraBox('16:9')).toThrow('no wide lock')
  })
  it('uses CSS crops and falls back for editorial crop names', () => {
    expect(splitPlatePosition('50% 88%')).toBe('50% 88%')
    expect(splitPlatePosition('center top')).toBe('center top')
    expect(splitPlatePosition('face-close')).toBe(FWP_POSTER_POSITIONS.proof)
    expect(splitPlatePosition()).toBe(FWP_POSTER_POSITIONS.proof)
  })
  it('crops camera below the full-width stage with no scale, leaving chrome outside', () => {
    const props = propsForSplit()
    props.beats[1]!.plate = { source: 'take', crop: '50% 92%' }
    props.segments = [{ src: 'take.mp4', trimBeforeFrames: 5, fromFrame: 0, durationFrames: 120 }]
    const nodes = elements(FormatMaster(props))
    const video = nodes.find((n) => n.type === OffthreadVideo)!
    expect(video.props.style).toMatchObject({ objectFit: 'cover', objectPosition: '50% 92%' })
    const camera = nodes.find((n) => elements(n.props.children as ReactNode).includes(video) && (n.props.style as Record<string, unknown>)?.top === FWP_SPLIT_SEAM_Y)!
    expect(camera.props.style).toMatchObject(splitCameraBox('9:16'))
    expect(nodes.filter((n) => (n.props.style as Record<string, unknown>)?.transform)).toHaveLength(0)
    const device = nodes.find((n) => n.props.object && n.props.box)!
    expect(device.props.box).toEqual({ left: 60, top: 300, width: 960, height: FWP_SPLIT_SEAM_Y - 360 })
    const stage = nodes.find((n) => (n.props.style as Record<string, unknown>)?.backgroundColor === props.tokens.cream)!
    expect(stage.props.style).toMatchObject({ height: FWP_SPLIT_SEAM_Y, overflow: 'hidden' })
    // No mark tile, pill or header on the vertical cut (Ruling, Krish, 2026-11-11).
    const chrome = elements(BrandFrame({ props, beat: props.beats[1]!, frame: 75 }))
    expect(chrome.some((n) => n.type === StageHeader)).toBe(false)
    expect(chrome.some((n) => n.type === MarkTile)).toBe(false)
  })
  it('preserves explicit placement and strips it from device params', () => {
    const props = propsForSplit()
    const id = props.beats[1]!.uses[0]!
    const object = props.objects.find((object) => object.obj === id)!
    const place = { left: 80, top: 320, width: 800, height: 300, scale: 0.9 }
    object.params = { ...object.params, place }
    const nodes = elements(FormatMaster(props))
    const wrapper = nodes.find((n) => (n.props.style as Record<string, unknown>)?.transform === 'scale(0.9)')!
    expect(wrapper.props.style).toMatchObject({ left: 80, top: 320, width: 800, height: 300, transformOrigin: 'top left' })
    const device = elements(wrapper.props.children as ReactNode).find((n) => n.props.object)!
    expect(device.props.box).toEqual({ left: 0, top: 0, width: 800, height: 300 })
    expect((device.props.object as typeof object).params).not.toHaveProperty('place')
  })
  it('places one and two caption lines inside the frozen zone and preserves normal captions', () => {
    const props = propsForSplit()
    for (const text of ['Proof', 'One two three four five six seven']) {
      props.captions[0]!.words = text.split(' ').map((text) => ({ text, atFrame: 0 }))
      const caption = SplitCaptionTrack({ props, frame: 75 })!
      const style = caption.props.style
      expect(style.left).toBe(FWP_SPLIT_CAPTION_ZONE.left)
      expect(style.top).toBe(FWP_SPLIT_CAPTION_ZONE.top)
      expect(style.width).toBe(FWP_SPLIT_CAPTION_ZONE.width)
      expect(Number(style.height)).toBeLessThanOrEqual(FWP_SPLIT_CAPTION_ZONE.height)
      // On the seam, and inside every channel's safe column (Krish, 2026-11-11).
      expect(Number(style.top)).toBeLessThanOrEqual(FWP_SPLIT_SEAM_Y)
      expect(Number(style.top) + Number(style.height)).toBeGreaterThanOrEqual(FWP_SPLIT_SEAM_Y)
      expect(Number(style.left) + FWP_SPLIT_CAPTION_ZONE.width).toBeLessThanOrEqual(860)
    }
    props.beats[1]!.layout = 'P1'
    expect(CaptionTrack({ props, frame: 75 })!.props.style.top).toBe(boxFor('caption', '9:16').top)
    expect(elements(BrandFrame({ props, beat: props.beats[1]!, frame: 75 })).some((n) => n.type === CaptionTrack)).toBe(true)
  })
})
