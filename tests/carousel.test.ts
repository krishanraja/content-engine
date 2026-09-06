import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CarouselStoryV1Schema } from '@mindmake/contracts'
import { carouselProductionIssues, carouselStoryContentHash } from '@mindmake/core'

const fixturePath = resolve('examples/carousels/built-editorial-gates.review.json')

async function fixture(): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(fixturePath, 'utf8')) as Record<string, unknown>
}

describe('carousel engine', () => {
  it('accepts the governed review fixture and reports exact missing production gates', async () => {
    const story = CarouselStoryV1Schema.parse(await fixture())
    expect(story.slides.map((slide) => slide.position)).toEqual([1, 2, 3, 4, 5, 6])
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
})
