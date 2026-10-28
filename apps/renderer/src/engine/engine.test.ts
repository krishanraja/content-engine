import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { Audio, OffthreadVideo, Sequence } from 'remotion'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fixture from '../../../../fixtures/ve/engine-core/props.json'
import { FormatMaster } from './FormatMaster'
import { BrandFrame } from './BrandFrame'
import { EngineAudio } from './audio'
import { useEngineFrame } from './clock'
import { DEVICES } from './devices/registry'
import { chromeZone } from './geometry'
import { CallCard } from './chrome/CallCard'
import { EndingBand } from './chrome/EndingBand'
import { CaptionTrack } from './chrome/CaptionTrack'
import { slotsFor } from './layouts'
import { EngineRenderPropsSchema, type EngineBeat, type EngineRenderProps } from './props'

vi.mock('./clock', () => ({ useEngineFrame: vi.fn(() => 75) }))
vi.mock('./devices/registry', () => ({ DEVICES: { 'fixture-device': () => null } }))

// Inspect element descriptions only: no React renderer or media decoding.
function elements(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}

const layouts: Exclude<EngineBeat['layout'], 'STAGE'>[] = ['P1', 'P3', 'P6', 'F1', 'F3']
const aspects: EngineRenderProps['aspect'][] = ['9:16', '16:9']

describe('ve layouts', () => {
  for (const aspect of aspects) {
    for (const layout of layouts) {
      it(`${layout} stays inside ${aspect} content safe bounds`, () => {
        // Tall: key content in X 120-888 above Y 840; below Y 840 only X 120-780 (the platform action rail), and
        // graphics end by Y 1150 so the caption block (top 1180) is never covered. Wide: title-safe.
        const slots = slotsFor(layout, aspect)
        expect(slots).toHaveLength({ P1: 2, P3: 3, P6: 2, F1: 3, F3: 2 }[layout])
        for (const box of slots) {
          expect(box.width).toBeGreaterThan(0)
          expect(box.height).toBeGreaterThan(0)
          const zone = chromeZone(aspect)
          expect(box.left >= zone.left + zone.width || box.left + box.width <= zone.left
            || box.top >= zone.top + zone.height || box.top + box.height <= zone.top).toBe(true)
          const right = box.left + box.width
          const bottom = box.top + box.height
          if (aspect === '9:16') {
            expect(box.left).toBeGreaterThanOrEqual(120)
            expect(box.top).toBeGreaterThanOrEqual(288)
            if (bottom <= 840) expect(right).toBeLessThanOrEqual(888)
            else { expect(right).toBeLessThanOrEqual(780); expect(bottom).toBeLessThanOrEqual(1150) }
          } else {
            expect(box.left).toBeGreaterThanOrEqual(96)
            expect(box.top).toBeGreaterThanOrEqual(54)
            expect(right).toBeLessThanOrEqual(1824)
            expect(bottom).toBeLessThanOrEqual(780) // above the wide caption band
          }
        }
      })
    }

    it(`P3 has a 60/40 split and P6 has a 40-45% card in ${aspect}`, () => {
      const [graphic, plate] = slotsFor('P3', aspect)
      if (!graphic || !plate) throw new Error('missing P3 slots')
      const graphicSize = aspect === '9:16' ? graphic.height : graphic.width
      const plateSize = aspect === '9:16' ? plate.height : plate.width
      expect(graphicSize / plateSize).toBeCloseTo(1.5)
      if (aspect === '9:16') expect(graphic.top + graphic.height).toBeLessThan(plate.top)
      else expect(graphic.left + graphic.width).toBeLessThan(plate.left)
      const card = slotsFor('P6', aspect)[1]!
      const fraction = card.width / (aspect === '9:16' ? 1080 : 1920)
      expect(fraction).toBeGreaterThanOrEqual(0.4)
      expect(fraction).toBeLessThanOrEqual(0.45)
    })
  }

  it('returns independent slot boxes', () => {
    slotsFor('P1', '9:16')[0]!.left = 0
    expect(slotsFor('P1', '9:16')[0]!.left).toBe(120)
  })
})

describe('ve composition', () => {
  beforeEach(() => vi.clearAllMocks())

  it('parses the minimal two-beat voiceover fixture', () => {
    const props = EngineRenderPropsSchema.parse(fixture)
    expect(props.beats).toHaveLength(2)
    expect(props.segments).toEqual([])
    expect(props.beats.at(-1)?.toFrame).toBe(props.durationFrames)
  })

  it.each(['missing-device', 'toString'])('throws on unknown device %s', (device) => {
    const props = EngineRenderPropsSchema.parse(fixture)
    props.objects = [{ obj: 'proof', device, meaning: 'Test proof', variants: {}, params: {}, fromFrame: 0, toFrame: 120 }]
    // The mocked clock reads frame 75, inside the second beat: the beat being drawn is the one that must refuse.
    props.beats[1]!.uses = ['proof']
    expect(() => FormatMaster(props)).toThrow(`ve: no device ${device}`)
  })

  it('uses one global clock, preserves slot order, and overlays brand after devices', () => {
    const props = EngineRenderPropsSchema.parse(fixture)
    props.objects = ['first', 'second'].map((obj) => ({ obj, device: 'fixture-device', meaning: obj, variants: {}, params: {}, fromFrame: 0, toFrame: 120 }))
    props.beats[1]!.layout = 'P6'
    props.beats[1]!.uses = ['second', 'first']
    const tree = FormatMaster(props)
    const nodes = elements(tree)
    expect(useEngineFrame).toHaveBeenCalledTimes(1)
    expect(tree.props.style.backgroundColor).toBe(props.tokens.ink)
    const devices = nodes.filter((node) => node.type === DEVICES['fixture-device'])
    expect(devices.map((node) => node.props.object)).toEqual([props.objects[1], props.objects[0]])
    expect(devices.map((node) => node.props.box)).toEqual(slotsFor('P6', props.aspect))
    expect(devices.map((node) => node.props.frame)).toEqual([75, 75])
    // Only the beat active at this frame is mounted, with no time offset, so media nested in a device share the
    // global clock (a beat-offset Sequence once pushed the evidence recording past the end of the cut).
    const brands = nodes.filter((node) => node.type === BrandFrame)
    expect(brands).toHaveLength(1)
    expect((brands[0]!.props.beat as EngineBeat).id).toBe(props.beats[1]!.id)
    expect(brands[0]!.props.frame).toBe(75)
    expect(nodes.indexOf(brands[0]!)).toBeGreaterThan(nodes.indexOf(devices[1]!))
    expect(nodes.at(-1)?.type).toBe(EngineAudio)
    expect(nodes.some((node) => (node.props.style as { clipPath?: string } | undefined)?.clipPath?.endsWith('round 40px)'))).toBe(true)
    expect(nodes.filter((node) => node.type === Sequence)).toHaveLength(0)
  })

  it('preserves picture source offsets, placement and crop while muting source audio', () => {
    const props = EngineRenderPropsSchema.parse(fixture)
    props.segments = [{ src: 'take.mp4', trimBeforeFrames: 90, fromFrame: 30, durationFrames: 45, crop: { x: -20, y: 15, scale: 1.2 } }]
    const nodes = elements(FormatMaster(props))
    const segment = nodes.find((node) => node.type === Sequence)!
    expect(segment.props.from).toBe(30)
    expect(segment.props.durationInFrames).toBe(45)
    const video = nodes.find((node) => node.type === OffthreadVideo)!
    expect(video.props).toMatchObject({ src: 'take.mp4', trimBefore: 90, muted: true })
    expect(video.props.style).toMatchObject({ objectFit: 'cover', transform: 'translate(-20px, 15px) scale(1.2)' })
  })

  it('places the trimmed stem at zero and converts SFX dB to linear volume', () => {
    const audio = { stem: { src: 'stem.wav', trimBeforeFrames: 12 }, sfx: [{ src: 'hit.wav', atFrame: 48, gainDb: -6 }] }
    const nodes = elements(EngineAudio({ audio }))
    const tracks = nodes.filter((node) => node.type === Audio)
    expect(tracks[0]!.props).toMatchObject({ src: 'stem.wav', trimBefore: 12 })
    expect(nodes.find((node) => node.type === Sequence)?.props.from).toBe(48)
    expect(tracks[1]!.props.src).toBe('hit.wav')
    expect(tracks[1]!.props.volume).toBeCloseTo(10 ** (-6 / 20))
  })
})

describe('BrandFrame call and ending routing', () => {
  it.each(['9:16', '16:9'] as const)('routes cards and suppresses captions in %s', (aspect) => {
    const props = EngineRenderPropsSchema.parse(fixture)
    props.aspect = aspect
    const beat = { ...props.beats[0]!, role: 'call' as const, fromFrame: 0, toFrame: 120 }
    props.beats = [beat]
    props.call = { statement: 'A checked call.', due: '2026-12-31', confidencePercent: 90 }
    props.ending = { fromFrame: 90, url: 'makeyourmindup.ai', ticker: true }
    for (const [frame, card] of [[30, CallCard], [90, EndingBand], [100, EndingBand]] as const) {
      const nodes = elements(BrandFrame({ props, beat, frame }))
      expect(nodes.filter((node) => node.type === card)).toHaveLength(1)
      expect(nodes.filter((node) => node.type === CaptionTrack)).toHaveLength(0)
      expect(CaptionTrack({ props, frame })).toBeNull()
    }
    const normal = { ...beat, role: 'anchor' as const }
    expect(elements(BrandFrame({ props, beat: normal, frame: 89 })).some((node) => node.type === CaptionTrack)).toBe(true)
    expect(elements(BrandFrame({ props, beat: normal, frame: 90 })).some((node) => node.type === EndingBand)).toBe(true)
    delete props.call
    expect(() => BrandFrame({ props, beat, frame: 30 })).toThrow('ve: call beat without props.call')
  })
})


describe('STAGE render props', () => {
  it('accepts STAGE, both approved formats and optional keyFrame', () => {
    for (const format of ['two-passports', 'hand-held-screen']) {
      const props = structuredClone(fixture)
      props.format = format
      props.beats[0]!.layout = 'STAGE'
      expect(EngineRenderPropsSchema.safeParse(props).success).toBe(true)
      expect(EngineRenderPropsSchema.safeParse({ ...props, beats: [{ ...props.beats[0], keyFrame: 24 }] }).success).toBe(true)
      for (const keyFrame of [-1, 1.5]) {
        expect(EngineRenderPropsSchema.safeParse({ ...props, beats: [{ ...props.beats[0], keyFrame }] }).success).toBe(false)
      }
      expect(EngineRenderPropsSchema.safeParse({ ...props, beats: [{ ...props.beats[0], unknown: true }] }).success).toBe(false)
    }
    expect(EngineRenderPropsSchema.safeParse({ ...fixture, format: 'unknown' }).success).toBe(false)
  })

  it('gives three devices full-canvas boxes and clips', () => {
    const props = EngineRenderPropsSchema.parse(fixture)
    props.objects = ['a', 'b', 'c'].map((obj) => ({ obj, device: 'fixture-device', meaning: obj, variants: {}, params: {}, fromFrame: 0, toFrame: 120 }))
    props.beats[1]!.layout = 'STAGE'
    props.beats[1]!.uses = ['a', 'b', 'c']
    const nodes = elements(FormatMaster(props))
    const devices = nodes.filter((node) => node.type === DEVICES['fixture-device'])
    expect(devices.map((node) => node.props.box)).toEqual(slotsFor('STAGE', props.aspect, 3))
    const clips = nodes.filter((node) => (node.props.style as { clipPath?: string } | undefined)?.clipPath)
    expect(clips).toHaveLength(3)
    for (const clip of clips) expect(clip.props.style).toEqual({ clipPath: 'inset(0px 0px 0px 0px)' })
  })
})
