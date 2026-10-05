import { describe, expect, it } from 'vitest'
import { TreatmentRegistryV1Schema, type BrandThemeV1 } from '@mindmake/contracts'
import { thumbnailInputProps } from '@mindmake/core'
import studioConfig from '../config/studio.json'
import { ThumbnailPropsSchema } from '../apps/renderer/src/thumbnail/props'
import { houseThumbnailModel } from '../apps/renderer/src/thumbnail/MakeyourmindupThumbnail'

// The Short's thumbnail in the makeyourmindup house style (the mock Krish
// approved on 2026-09-28, frame 5). No photo of Krish in it, ever.
function fixture() {
  const registry = TreatmentRegistryV1Schema.parse(studioConfig)
  const theme = registry.brand_themes.find((candidate) => candidate.theme_id === 'makeyourmindup-video-v1')! as BrandThemeV1
  const lockup = theme.publication!
  const marks = (channel: 'follow_the_money' | 'mind_the_gap' | 'under_the_hood') => ({
    mark: { ...lockup.mark, assetFile: `brand-publication-mark-${lockup.mark.sha256.slice(0, 16)}.png` },
    channelLabel: channel.replaceAll('_', '.'),
    channelColor: lockup.channel_colors[channel],
    channelCopy: lockup.house_style!.channels[channel],
  })
  return { theme, marks }
}

const COPY = { headline: 'Who picks your AI?', dek: 'There\'s a guy behind the counter, and he\'s picking for you.' }

describe('the house style thumbnail', () => {
  it('builds the mock\'s cover: the section colour, its day and pill, the mark, and a call sticker', () => {
    const { theme, marks } = fixture()
    const props = thumbnailInputProps(theme, marks('mind_the_gap'), 'mind_the_gap', COPY, { hasCall: true })
    expect(props).toMatchObject({ series: 'mind_the_gap', channelLabel: 'mind.the.gap', day: 'Fridays', headline: 'Who picks your AI?', sticker: 'Our call, dated', tokens: { section: '#FF6A4D', ink: '#0C1512', cream: '#F4EFE4' }, mark: { pixelWidth: 831, pixelHeight: 740 } })
    // "Who / picks / your AI?" at the mock's 250 px, all inside the middle
    // 1080 x 1440 that Instagram's grid shows.
    const model = houseThumbnailModel(props)
    expect(model).toMatchObject({ headlineSize: 250, headlineLines: 3, dekSize: 60, dekLines: 2 })
    expect(model.extent.top).toBeGreaterThanOrEqual(model.visible.top)
    expect(model.extent.bottom).toBeLessThanOrEqual(model.visible.bottom)
  })

  it('carries the channel\'s own sticker when the piece has no call', () => {
    const { theme, marks } = fixture()
    expect(thumbnailInputProps(theme, marks('mind_the_gap'), 'mind_the_gap', COPY, { hasCall: false }).sticker).toBe('The headliner')
    expect(thumbnailInputProps(theme, marks('follow_the_money'), 'follow_the_money', COPY, { hasCall: false })).toMatchObject({ day: 'Mondays', sticker: 'Bring a calculator', channelLabel: 'follow.the.money', tokens: { section: '#FFD84D' } })
    expect(thumbnailInputProps(theme, marks('under_the_hood'), 'under_the_hood', COPY, { hasCall: false })).toMatchObject({ day: 'Wednesdays', sticker: 'Screwdriver included', tokens: { section: '#B7A6FF' } })
  })

  it('shrinks a long headline to stay inside the grid crop', () => {
    const { theme, marks } = fixture()
    const props = thumbnailInputProps(theme, marks('mind_the_gap'), 'mind_the_gap', { headline: 'Every AI deal has a bill, and somebody pays it in the end', dek: COPY.dek }, { hasCall: true })
    const model = houseThumbnailModel(props)
    expect(model.headlineSize).toBeLessThan(250)
    expect(model.extent.bottom).toBeLessThanOrEqual(model.visible.bottom)
  })

  it('has no field for a photograph, and is drawn only in the house style and only for a live subchannel', () => {
    const { theme, marks } = fixture()
    const props = thumbnailInputProps(theme, marks('mind_the_gap'), 'mind_the_gap', COPY, { hasCall: true })
    expect(ThumbnailPropsSchema.safeParse({ ...props, presenter: 'krish.webp' }).success).toBe(false)
    expect(ThumbnailPropsSchema.safeParse({ ...props, sourceFile: 'camera.mp4' }).success).toBe(false)
    expect(Object.keys(ThumbnailPropsSchema.shape)).toEqual(['reviewMode', 'series', 'channelLabel', 'day', 'headline', 'dek', 'sticker', 'mark', 'tokens'])
    const plain = { ...theme, publication: { ...theme.publication!, house_style: undefined } } as BrandThemeV1
    expect(() => thumbnailInputProps(plain, marks('mind_the_gap'), 'mind_the_gap', COPY, { hasCall: true })).toThrow(/no makeyourmindup house style/)
    expect(() => thumbnailInputProps(theme, marks('mind_the_gap'), 'built_with_ai', COPY, { hasCall: true })).toThrow(/for the live subchannels/)
  })
})

describe('house type metrics', () => {
  it('measures the kit fonts as the mock sets them', async () => {
    const { textWidth, wrapWords } = await import('../apps/renderer/src/house/metrics')
    // Anton: "WHO PICKS" at 178 px spans about 720 px on the mock's cover.
    expect(textWidth('anton', 'WHO PICKS', 178)).toBeCloseTo(718.8, 0)
    // The call card breaks the statement after "two of", as the mock does.
    expect(wrapWords('archivo700', 'By 30 September 2027, at least two of OpenAI, Anthropic and Google', 40, 828, -0.01)[0]!.join(' ')).toBe('By 30 September 2027, at least two of')
    // The caption breaks after "behind", as in frame 1.
    expect(wrapWords('archivoHeavy', 'There\'s a guy behind the counter, and he picks for you.', 68, 816, -0.015).map((line) => line.join(' '))).toEqual(['There\'s a guy behind', 'the counter, and he', 'picks for you.'])
    expect(textWidth('mono', 'THE HEADLINER', 34, 0.14)).toBeCloseTo(13 * 0.74 * 34, 5)
  })
})
