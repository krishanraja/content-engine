import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CarouselStoryV1Schema, CarouselVisualDirectionMethodV1Schema } from '@mindmake/contracts'
import { carouselProductionIssues, carouselStoryContentHash } from '@mindmake/core'

const fixturePath = resolve('examples/carousels/built-editorial-gates.review.json')

async function fixture(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(fixturePath, 'utf8')) as Record<string, unknown>
}

describe('carousel engine', () => {
  it('accepts the governed review fixture and reports exact missing production gates', async () => {
    const story = CarouselStoryV1Schema.parse(await fixture())
    expect(story.slides.map((slide) => slide.position)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(new Set(story.slides.map((slide) => slide.scene)).size).toBe(story.slides.length)
    expect(carouselProductionIssues(story)).toEqual([
      'story approval for the exact story is missing',
      'visual_direction approval for the exact story is missing',
    ])
    expect(carouselStoryContentHash(story)).toMatch(/^[a-f0-9]{64}$/)
  })

  it('binds source formats to the canonical publication series', async () => {
    const input = await fixture()
    input.series = 'money_of_ai'
    expect(() => CarouselStoryV1Schema.parse(input)).toThrow(/source format does not belong/)
  })

  it('blocks unapproved screenshots from acting as evidence', async () => {
    const input = await fixture()
    input.assets = [{
      asset_id: 'headline',
      source_path: 'headline.png',
      sha256: 'a'.repeat(64),
      media_kind: 'screenshot',
      truth_role: 'evidence',
      generated: false,
      rights: 'quotation_exception',
      source_url: 'https://example.com/source',
      attribution: 'Example source',
    }]
    expect(() => CarouselStoryV1Schema.parse(input)).toThrow(/exact approval/)
  })

  it('never permits generated media to become evidence', async () => {
    const input = await fixture()
    input.assets = [{
      asset_id: 'synthetic',
      source_path: 'synthetic.png',
      sha256: 'b'.repeat(64),
      media_kind: 'image',
      truth_role: 'evidence',
      generated: true,
      rights: 'generated',
      illustration_label: 'Illustration',
      approval: { decision: 'approved', approved_by: 'Krish', approved_at: '2026-09-07T00:00:00.000Z', artifact_hash: 'b'.repeat(64) },
    }]
    expect(() => CarouselStoryV1Schema.parse(input)).toThrow(/generated media cannot be evidence/)
  })

  it('rejects an approval copied from a different screenshot', async () => {
    const input = await fixture()
    input.assets = [{
      asset_id: 'headline',
      source_path: 'headline.png',
      sha256: 'a'.repeat(64),
      media_kind: 'screenshot',
      truth_role: 'evidence',
      generated: false,
      rights: 'quotation_exception',
      source_url: 'https://example.com/source',
      attribution: 'Example source',
      approval: { decision: 'approved', approved_by: 'Krish', approved_at: '2026-09-07T00:00:00.000Z', artifact_hash: 'c'.repeat(64) },
    }]
    expect(() => CarouselStoryV1Schema.parse(input)).toThrow(/exact asset hash/)
  })

  it('requires a cover, a resolution and contiguous ordering', async () => {
    const input = await fixture()
    const slides = input.slides as Array<Record<string, unknown>>
    slides[0]!.role = 'scene'
    slides[1]!.position = 4
    expect(() => CarouselStoryV1Schema.parse(input)).toThrow(/slide positions|cover and end/)
  })

  it('requires a different narrative scene for every card', async () => {
    const input = await fixture()
    const slides = input.slides as Array<Record<string, unknown>>
    slides[1]!.scene = slides[0]!.scene
    expect(() => CarouselStoryV1Schema.parse(input)).toThrow(/unique narrative scene/)
  })

  it('puts one official series signpost and one Mindmake publisher signature on every card', async () => {
    const renderer = await readFile(resolve('apps/renderer/src/carousel/MindmakeCarouselSlide.tsx'), 'utf8')
    expect(renderer).not.toContain('props.seriesName')
    expect(renderer.match(/wordmarks\.series/g)).toHaveLength(1)
    expect(renderer.match(/wordmarks\.mindmake/g)).toHaveLength(1)
    expect(renderer).toContain('data-brand-slot="series-channel-signpost"')
    expect(renderer).toContain('data-brand-slot="mindmake-publisher-signature"')
  })

  it('locks visual production to completed content with three collaboration speeds', async () => {
    const input = JSON.parse(await readFile(resolve('config/carousel-visual-direction.json'), 'utf8')) as Record<string, unknown>
    const method = CarouselVisualDirectionMethodV1Schema.parse(input)
    expect(method.boundary.input).toBe('completed_content_idea')
    expect(method.boundary.topic_ideation_allowed).toBe(false)
    expect(method.boundary.recording_ideation_allowed).toBe(false)
    expect(method.modes.fast.decision_points).toHaveLength(2)
    expect(method.modes.standard.decision_points).toHaveLength(4)
    expect(method.modes.exploratory.decision_points).toHaveLength(5)
    expect(method.casting_lanes).toContain('surreal_wildcard')
  })

  it('rejects a method that lets the visual engine invent topics', async () => {
    const input = JSON.parse(await readFile(resolve('config/carousel-visual-direction.json'), 'utf8')) as Record<string, any>
    input.boundary.topic_ideation_allowed = true
    expect(() => CarouselVisualDirectionMethodV1Schema.parse(input)).toThrow()
  })

  it('rejects the prior AI-copy failure signatures from the review fixture', async () => {
    const input = JSON.stringify(await fixture())
    for (const phrase of ['allowed to say no', 'does not become good because', 'asks two different questions', 'comes after the thinking', 'burns more time', 'last step, not the first']) {
      expect(input.toLowerCase()).not.toContain(phrase)
    }
    expect(input).not.toContain('\u2014')
  })
})
