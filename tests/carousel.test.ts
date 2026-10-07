import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CarouselStoryV1Schema, CarouselVisualDirectionMethodV1Schema, EditorialFormatV1Schema, TreatmentRegistryV1Schema, normalizeEditorialFormatV1, type BrandThemeV1 } from '@mindmake/contracts'
import { carouselApprovalBinds, carouselEditorialPreferenceIssues, carouselHouse, carouselProductionIssues, carouselSlideInputProps, carouselStoryContentHash, hashValue, renderCarousel, theForkIssues } from '@mindmake/core'
import studioConfig from '../config/studio.json'
import { CarouselRenderPropsSchema } from '../apps/renderer/src/carousel/props'
import { houseCardModel } from '../apps/renderer/src/carousel/HouseCarouselCard'

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

  it('rejects a carousel approval without a confirmation reference', async () => {
    const input = await fixture()
    const contentHash = carouselStoryContentHash(CarouselStoryV1Schema.parse(input))
    input.approvals = [{ gate: 'story', decision: 'approved', approved_by: 'Krish', approved_at: '2026-09-07T00:00:00.000Z', artifact_hash: contentHash }]
    expect(() => CarouselStoryV1Schema.parse(input)).toThrow(/confirmation_ref/)
  })

  it('counts an approval only when its confirmation binds the same gate and story hash', async () => {
    const input = await fixture()
    const contentHash = carouselStoryContentHash(CarouselStoryV1Schema.parse(input))
    const approval = (gate: 'story' | 'visual_direction' | 'final', artifactHash: string, confirmationRef: string) => ({
      gate, decision: 'approved' as const, approved_by: 'Krish' as const, approved_at: '2026-09-07T00:00:00.000Z', artifact_hash: artifactHash, confirmation_ref: confirmationRef,
    })
    input.approvals = [
      approval('story', contentHash, `studio-user-confirmation:claude-code:story:${contentHash}:Krish approved the story`),
      approval('visual_direction', contentHash, `codex-user-confirmation:visual_direction:${contentHash}:Krish approved the visual direction`),
    ]
    const story = CarouselStoryV1Schema.parse(input)
    expect(carouselProductionIssues(story)).toEqual([])
    expect(carouselApprovalBinds(story.approvals[0]!, 'story', contentHash)).toBe(true)
    expect(carouselApprovalBinds(story.approvals[0]!, 'visual_direction', contentHash)).toBe(false)
    expect(carouselApprovalBinds(story.approvals[1]!, 'final', contentHash)).toBe(false)

    const staleHash = 'a'.repeat(64)
    input.approvals = [
      approval('story', staleHash, `studio-user-confirmation:claude-code:story:${staleHash}:Krish approved an earlier story`),
      approval('visual_direction', contentHash, `studio-user-confirmation:claude-code:visual_direction:${contentHash}:Krish approved the visual direction`),
    ]
    expect(carouselProductionIssues(CarouselStoryV1Schema.parse(input))).toEqual(['story approval for the exact story is missing'])

    input.approvals = [approval('story', contentHash, `studio-user-confirmation:claude-code:final:${contentHash}:receipt bound to another gate`)]
    expect(() => CarouselStoryV1Schema.parse(input)).toThrow(/same gate and artifact hash/)
  })

  it('binds source formats to the canonical publication series', async () => {
    const input = await fixture()
    input.series = 'money_of_ai'
    expect(() => CarouselStoryV1Schema.parse(input)).toThrow(/source format does not belong/)
  })

  it('keeps the retired Teardown label at the import boundary', async () => {
    expect(normalizeEditorialFormatV1('teardown')).toBe('artifact')
    expect(EditorialFormatV1Schema.safeParse('teardown').success).toBe(false)
    const input = await fixture()
    input.source_format = 'teardown'
    expect(() => CarouselStoryV1Schema.parse(input)).toThrow()
  })

  it('uses format-aware editorial preferences for Built carousels', async () => {
    const preference = { schema_version: 1 as const, rule_id: 'pref-built-concrete-story-v1', assertion: 'Make the build concrete.', scope: { level: 'series' as const, key: 'built_with_ai' }, evidence_feedback_ids: ['feedback-cross-series-format-expansion-20260908-01'], counterexamples: [], regression_cases: [], status: 'active' as const, approved_by: 'Krish' as const, approved_at: '2026-09-08T12:00:00.000Z' }
    const build = CarouselStoryV1Schema.parse(await fixture())
    expect(carouselEditorialPreferenceIssues(build, [preference])).toContain('build_itself expects a concrete build or artifact in the first three slides')
    const human = CarouselStoryV1Schema.parse({ ...(await fixture()), source_format: 'third_why' })
    expect(carouselEditorialPreferenceIssues(human, [preference])).not.toContain('third_why expects a concrete build or artifact in the first three slides')
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
    expect(renderer.match(/wordmarks!?\.series/g)).toHaveLength(1)
    expect(renderer.match(/wordmarks!?\.mindmake/g)).toHaveLength(1)
    // A live subchannel (Krish, 2026-09-26): the publication's mark and the
    // channel's name as type in the signpost, its logo as the signature.
    expect(renderer.match(/publication\.mark/g)).toHaveLength(1)
    expect(renderer.match(/publication\.logo/g)).toHaveLength(1)
    expect(renderer).toContain('{publication.channel.label}</span>')
    expect(renderer).toContain('data-brand-slot="series-channel-signpost"')
    expect(renderer).toContain('data-brand-slot="mindmake-publisher-signature"')
  })

  it('left-aligns cropped wordmarks and reserves a footer clear zone', async () => {
    const renderer = await readFile(resolve('apps/renderer/src/carousel/MindmakeCarouselSlide.tsx'), 'utf8')
    expect(renderer).toContain('const BRAND_PLATE_LEFT = CONTENT_LEFT - BRAND_PLATE_PADDING_X')
    expect(renderer.match(/left: BRAND_PLATE_LEFT/g)).toHaveLength(2)
    expect(renderer).toContain("data-crop={lettersOnly ? 'letter-region' : 'alpha-crop'}")
    expect(renderer).toContain('const FOOTER_CLEARANCE = 128')
    expect(renderer.match(/bottom: FOOTER_CLEARANCE/g)).toHaveLength(7)
  })

  it('locks visual production to completed content with three collaboration speeds', async () => {
    const input = JSON.parse(await readFile(resolve('config/carousel-visual-direction.json'), 'utf8')) as Record<string, unknown>
    const method = CarouselVisualDirectionMethodV1Schema.parse(input)
    expect(method.boundary.input).toBe('completed_content_idea')
    expect(method.boundary.topic_ideation_allowed).toBe(false)
    expect(method.boundary.recording_ideation_allowed).toBe(false)
    expect(method.branding.mindmake_wordmark).toBe('bottom_left_publisher_signature')
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

  it('The Fork is mind.the.gap\'s format and ends on our call, dated and with how sure we are', async () => {
    const input = await fixture()
    const slides = input.slides as Array<Record<string, unknown>>
    const fork = { ...input, series: 'mind_the_gap', source_format: 'The Fork' }
    // Only mind.the.gap owns it.
    expect(() => CarouselStoryV1Schema.parse({ ...input, source_format: 'the_fork' })).toThrow(/source format/)
    const noCall = CarouselStoryV1Schema.parse({ ...fork, source_format: 'the_fork' })
    expect(theForkIssues(noCall)).toEqual(['The Fork ends on our call: the last slide needs the prediction\'s date and how sure we are'])
    expect(carouselProductionIssues(noCall)[0]).toMatch(/The Fork ends on our call/)
    const last = { ...slides.at(-1)!, headline: 'Our call: by 30 September 2027', body: 'How sure we are: 75%' }
    const withCall = CarouselStoryV1Schema.parse({ ...fork, source_format: 'the_fork', slides: [...slides.slice(0, -1), last] })
    expect(theForkIssues(withCall)).toEqual([])
    expect(normalizeEditorialFormatV1('The Fork')).toBe('the_fork')
    expect(EditorialFormatV1Schema.options).toContain('the_fork')
  })

  it('reads the date and how sure we are from the call card\'s mono line too', async () => {
    const input = await fixture()
    const slides = input.slides as Array<Record<string, unknown>>
    const last = { ...slides.at(-1)!, headline: 'Our call.', body: 'By 30 September 2027, the switching is automatic by default.', data_label: 'Due 2027-09-30 · 75% sure' }
    const fork = CarouselStoryV1Schema.parse({ ...input, series: 'mind_the_gap', source_format: 'the_fork', slides: [...slides.slice(0, -1), last] })
    expect(theForkIssues(fork)).toEqual([])
  })
})

// The makeyourmindup house style (Krish approved the mock on 2026-09-28):
// a cover on the section's colour, middle cards and a last card on ink.
const W = { assetFile: 'brand.png', assetDataUrl: 'data:image/png;base64,AA==', alphaCropDataUrl: 'data:a', letterCropDataUrl: 'data:l', pixelWidth: 10, pixelHeight: 5, alphaCrop: { x: 0, y: 0, width: 10, height: 5 }, letterRegion: { x: 0, y: 0, width: 10, height: 5 } }

function themes() {
  const registry = TreatmentRegistryV1Schema.parse(studioConfig)
  return {
    retired: registry.brand_themes.find((theme) => theme.theme_id === registry.default_brand_theme)!,
    house: registry.brand_themes.find((theme) => theme.theme_id === 'makeyourmindup-video-v1')! as BrandThemeV1,
  }
}

async function forkStory(sourceFormat: 'the_fork' | 'build_itself' = 'the_fork') {
  const input = await fixture()
  const slides = input.slides as Array<Record<string, unknown>>
  const last = { ...slides.at(-1)!, headline: 'Our call.', body: 'By 30 September 2027, at least two of OpenAI, Anthropic and Google will pick the brain by default.', data_label: 'Due 2027-09-30 · 75% sure' }
  const series = sourceFormat === 'the_fork' ? 'mind_the_gap' : 'under_the_hood'
  return CarouselStoryV1Schema.parse({ ...input, series, source_format: sourceFormat, slides: [{ ...slides[0]!, headline: 'Who picks your AI?', body: 'There\'s a guy behind the counter, and he\'s picking for you.' }, ...slides.slice(1, -1), last] })
}

function houseCards(story: Awaited<ReturnType<typeof forkStory>>) {
  const { house } = themes()
  const lockup = house.publication!
  const channel = story.series as 'mind_the_gap' | 'under_the_hood'
  const marks = { lockup, channelColor: lockup.channel_colors[channel], channelCopy: lockup.house_style!.channels[channel] }
  const brandMarks = { publication: { mark: W, logo: W, channel: { label: channel === 'mind_the_gap' ? 'mind.the.gap' : 'under.the.hood', color: marks.channelColor, weight: 600 }, ...carouselHouse(story, marks) } }
  return story.slides.map((slide) => CarouselRenderPropsSchema.parse(carouselSlideInputProps(story, slide, house, brandMarks, [], false)))
}

describe('carousel cards in the makeyourmindup house style', () => {
  it('builds the retired series\' card props exactly as before', async () => {
    const { retired } = themes()
    const story = CarouselStoryV1Schema.parse(await fixture())
    const props = story.slides.map((slide) => carouselSlideInputProps(story, slide, retired, { wordmarks: { mindmake: W, series: W } }, [], true))
    // The hash of the same props built by the inline code at 518b5fe.
    expect(hashValue(props)).toBe('aeb702f5a7c550363bbd7a9d403df4933e8a9201ad2f3e3cc140dff711563cce')
    expect(props.every((card) => !('call' in card.slide))).toBe(true)
  })

  it('sets the cover as the mock: the section block, its day and pill, the call sticker and the question', async () => {
    const cards = houseCards(await forkStory())
    const cover = cards[0]!
    expect(cover.branding.publication?.house).toEqual({ tokens: { ink: '#0C1512', inkDeep: '#070D0B', inkSoft: '#16221D', cream: '#F4EFE4', mint: '#7EF0C0', section: '#FF6A4D' }, day: 'Fridays', coverSticker: 'Swipe for the call', questionKicker: 'The question', question: 'What is the pattern, and what does it mean is coming?', callFootnote: 'On the day, we mark it right, wrong or too close to call. The wrong ones go up as big as the right ones.', site: 'makeyourmindup.ai' })
    expect(cover.branding.typography).toEqual({ structure: 'Archivo', claim: 'Anton', body: 'Archivo', data: 'IBM Plex Mono' })
    // "Who picks your AI?" at the mock's 178 px, on two lines.
    expect(houseCardModel(cover)).toMatchObject({ kind: 'cover', counter: null, headlineSize: 178, headlineLines: 2, swipeIndex: -1, sticker: 'Swipe for the call', question: 'What is the pattern, and what does it mean is coming?' })
  })

  it('numbers the middle and last cards, swipes one word on an accent and ends on the call', async () => {
    const story = await forkStory()
    const cards = houseCards(story)
    const count = cards.length
    const middle = cards.slice(1, -1)
    for (const card of middle) {
      const model = houseCardModel(card)!
      expect(model.kind).toBe('middle')
      expect(model.counter).toBe(`${card.slide.position} / ${count}`)
      expect(model.headlineSize).toBeLessThanOrEqual(160)
      expect(model.swipeIndex === -1).toBe(card.slide.accent === 'none')
    }
    const last = cards.at(-1)!
    expect(last.slide.call).toBe(true)
    expect(houseCardModel(last)).toMatchObject({ kind: 'last', counter: `${count} / ${count}`, headlineSize: 160, swipeIndex: 2, footnote: 'On the day, we mark it right, wrong or too close to call. The wrong ones go up as big as the right ones.' })
    // A long headline shrinks to fit rather than running off the card.
    const long = { ...middle[0]!, slide: { ...middle[0]!.slide, headline: 'A green tick can outlive the thing it checked, and nobody notices until it breaks.' } }
    const fitted = houseCardModel(long)!
    expect(fitted.headlineSize).toBeLessThan(160)
    expect(fitted.headlineLines * fitted.headlineSize * 0.88).toBeLessThanOrEqual(1200 - 300)
  })

  it('gives a story without a call its channel sticker, and no call card', async () => {
    const cards = houseCards(await forkStory('build_itself'))
    expect(houseCardModel(cards[0]!)).toMatchObject({ sticker: 'Screwdriver included', question: 'What actually goes together in a shipped thing, and why did this one work?' })
    expect(cards[0]!.branding.publication?.house?.day).toBe('Wednesdays')
    expect(cards.at(-1)!.slide.call).toBeUndefined()
    expect(houseCardModel(cards.at(-1)!)!.footnote).toBeNull()
  })

  it('refuses a house style theme while it is a candidate', async () => {
    const { house } = themes()
    expect(house.status).toBe('candidate')
    // A story may pin the house style theme by its control-center contract.
    const story = await forkStory()
    const pinned = { ...(await fixture()), series: 'mind_the_gap', source_format: 'the_fork', slides: story.slides, brand_theme: { theme_id: house.theme_id, theme_hash: hashValue(house), design_repository: 'krishanraja/control-center', design_commit: 'c'.repeat(40), design_contract_path: 'src/assets/brand/makeyourmindup/README.md' } }
    expect(CarouselStoryV1Schema.safeParse(pinned).success).toBe(true)
    expect(CarouselStoryV1Schema.safeParse({ ...pinned, brand_theme: { ...pinned.brand_theme, design_contract_path: 'project-documentation/03_DESIGN_CONTRACT.md' } }).success).toBe(false)
    // The renderer refuses it before drawing anything, even for review.
    await expect(renderCarousel(resolve('.'), resolve('config/studio.json'), pinned, resolve('.never-written'), true)).rejects.toThrow('active brand theme makeyourmindup-video-v1 is unavailable')
  })
})

