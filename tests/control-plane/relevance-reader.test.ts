import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import beat from '../../config/beat.json' with { type: 'json' }

// The North Star reader (Krish, 2026-11-26: "I approve the lines"). The reader
// narrows to people who make the calls or make the work in the creative, arts,
// music, entertainment, media and sports industries, and the relevance filter,
// the reader and buyer judges and the humour check read that one wording from
// config/beat.json's reader row. These tests hold three things: the approved
// line is in the config verbatim, the old "ANYTHING about AI" keep rule and
// the thirty-day buyer are gone from every prompt, and the buyer test is still
// recorded and not enforced.

const APPROVED = 'By December 2027, makeyourmindup is the publication the creative, arts, music, entertainment, media and sports industries pay to read on what AI is doing to how their work makes money. 50,000 people who make the calls or make the work read it, and the publication is worth owning on its own.'

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: { rpc: async () => ({ error: null }) },
}))

let sent: any[] = []
beforeEach(() => {
  sent = []
  vi.stubGlobal('fetch', async (_url: string, init: any) => {
    sent.push(JSON.parse(init.body))
    return { ok: true, status: 200, json: async () => ({ content: [{ text: '[]' }], usage: {} }) }
  })
})
afterEach(() => { vi.unstubAllGlobals() })

async function systemPrompt(): Promise<string> {
  const { classifyRelevance } = await import('../../apps/control-plane/api/_relevance.js')
  await classifyRelevance([{ id: '1', title: 'x' }], { apiKey: 'k' })
  return sent[0].system
}

describe('the reader row', () => {
  it('holds the approved North Star line verbatim, with his words and the date', () => {
    expect(beat.reader.lines).toEqual([APPROVED])
    expect(beat.reader.from).toBe('2026-11-26')
    expect(beat.reader.his_words.some(w => w.at === '2026-11-26' && w.said === 'I approve the lines')).toBe(true)
  })

  it('keeps the buyer test recorded and not enforced', () => {
    expect(beat.reader.buyer_test.enforced).toBe(false)
  })

  it('writes the reader without an em dash or an exclamation mark', () => {
    const text = JSON.stringify(beat.reader)
    expect(text).not.toMatch(/—/)
    expect(text).not.toContain('!')
  })

  it('carries the economics keywords and a figure pattern that compiles', async () => {
    expect(beat.economics_keywords.keywords).toEqual(expect.arrayContaining(['paid', 'royalt*', 'licens*', 'deal', 'revenue*']))
    const { ECONOMICS_BEAT, ECONOMICS_FIGURE } = await import('../../apps/control-plane/api/_beat.js')
    expect(ECONOMICS_BEAT.test('the label paid its artists royalties')).toBe(true)
    expect(ECONOMICS_FIGURE.test('a £40m licensing deal')).toBe(true)
    expect(ECONOMICS_FIGURE.test('a UK number two')).toBe(false)
  })
})

describe('the relevance filter reads the new reader', () => {
  it('no longer keeps anything about AI, or adtech on its own terms', async () => {
    const system = await systemPrompt()
    expect(system).not.toContain('ANYTHING about AI')
    expect(system).not.toContain('IN-BOUNDS')
    expect(system).not.toContain('commercial leader')
    expect(system).not.toContain('thirty days')
  })

  it('carries the keep line, the media line, the intro and the buyer test from config', async () => {
    const system = await systemPrompt()
    expect(system).toContain(beat.reader.intro)
    expect(system).toContain(beat.reader.keep_line)
    expect(system).toContain(beat.reader.media_line)
    expect(system).toContain(beat.reader.buyer_test.line)
    expect(system).toContain(beat.reader.buyer_test.unsure_line)
    expect(system).toContain('people who make the calls or make the work in the creative, arts, music, entertainment, media and sports industries')
  })
})

describe('the reader and buyer judges read the new reader', () => {
  it('panel-v3, with the same judge keys', async () => {
    const { ROSTER_VERSION, IDEA_JUDGES } = await import('../../apps/control-plane/api/_judges/roster.js')
    expect(ROSTER_VERSION).toBe('panel-v3')
    const keys = IDEA_JUDGES.map(j => j.key)
    expect(keys).toEqual(expect.arrayContaining(['reader', 'buyer']))
  })

  it('the rubrics come from the reader row and the retired reader is gone', async () => {
    const { IDEA_JUDGES } = await import('../../apps/control-plane/api/_judges/roster.js')
    const reader = IDEA_JUDGES.find(j => j.key === 'reader')!
    const buyer = IDEA_JUDGES.find(j => j.key === 'buyer')!
    expect(reader.rubric).toBe(beat.reader.judges.reader.rubric)
    expect(buyer.rubric).toBe(beat.reader.judges.buyer.rubric)
    for (const j of [reader, buyer]) {
      const all = `${j.question} ${j.rubric} ${j.evidence}`
      expect(all).not.toContain('thirty')
      expect(all).not.toContain('five to fifty million')
      expect(all).not.toContain('commercial leader')
      expect(all).toContain('creative, arts, music, entertainment, media')
    }
  })
})
