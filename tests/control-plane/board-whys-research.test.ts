import { describe, expect, it } from 'vitest'
import { researchPromptFor, seriesKey, whysResearchPrompt } from '../../apps/control-plane/api/board/_researchPrompt'
import { researchPrompt, storyPrompt, type PieceBrief } from '../../apps/control-plane/api/board/_prompts'
import { MAX_TOKENS, fileMaterial, runResearch } from '../../apps/control-plane/api/board/_research'
import { whysFromResearch, whysView } from '../../apps/control-plane/api/board/_whys'
import { corpusLines } from '../../apps/control-plane/api/board/_corpus'
import { parseWhyLadder } from '../../packages/contracts/src/whys'

// The 5 Whys wired into research (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys; get rid of everything
// that suggests predictions, calls, dated, odds or scores). One research prompt asks Perplexity for one sourced answer
// per Why and a fenced why-ladder block; Paste research and Research it now read the block, check it rung by rung and
// keep it on the piece as meta.whys; a failing rung is shown, never dropped; research with no ladder is filed as before.

const PIECE = '8287846b-6618-4a19-9fb8-23ad4eca2718'
const brief = (series: string): PieceBrief => ({ week: '2026-11-30', day: 'mon', dayName: 'Monday', date: '2026-11-30', series, pieceId: PIECE,
  idea: 'Session musicians are paid less as AI stems flood the libraries.', story: 'The libraries priced stems by the track.', brief: 'Follow the royalties.',
  materials: ['Perplexity answer: stems'], lock: null })
const context = { item: { title: 'The stems price war', date: '2026-11-30', line: 'Research', piece_id: PIECE,
  read: { so_what: 'Who pays for the cheap stems.', story: null, why_now: null, fact: null, text: null, sources: [{ label: 'Billboard', href: 'https://billboard.com/x' }], research: [], said: null } },
  series: 'follow.the.money', dayLabel: 'Mon 30 Nov', lock: '# Lock\n\npiece_id: x\n\nThe arc.\n\nSigned by Krish: "yes", 2026-11-29', materials: [], saved: [{ at: '2026-11-29T10:00:00Z', text: 'Who owns the masters?' }] }

const ev = (domain: string) => ({ url: `https://${domain}/a`, domain, date: '2026-11-01', quote: 'Their own words.', tier: 'primary' })
const LADDER = {
  schema: 'why-ladder/1', question: 'Why are session musicians paid less?', series: 'follow_the_money',
  rungs: [
    { n: 1, question: 'Why did the price of a stem fall?', answer: 'Because libraries now license AI stems by the thousand.', evidence: [ev('sec.gov'), ev('billboard.com')], strength: 'documented', counter: { text: 'Demand fell too.' }, stop: null },
    { n: 2, question: 'Why do libraries license by the thousand?', answer: 'Because the label owns the catalogue the model learned from.', evidence: [ev('musicbusinessworldwide.com')], strength: 'inferred', counter: { none_found_scope: 'MBW, Billboard, SEC, 2025 to 2026' }, stop: null },
    { n: 3, question: 'Why does the label own it?', answer: 'No source explains the 2019 transfer yet.', evidence: [], strength: 'open', counter: {}, stop: 'evidence_exhausted' },
  ],
  landing: { shows: 'The price follows who owns the masters.', open_question: 'Who owns the work your tools learned from?' },
}
const research = (ladder: unknown) => `piece_id: ${PIECE}\n\n\`\`\`why-ladder\n${JSON.stringify(ladder, null, 1)}\n\`\`\`\n\n## Why 1\n\nThe narrative.`

/** A content_ideas row behind the two guarded writes research filing makes (the working set, then meta.whys). */
function fakeDb(meta: Record<string, unknown> = {}) {
  const row = { id: PIECE, meta: { ...meta }, updated_at: '2026-11-30T00:00:00Z' }
  const writes: Array<Record<string, unknown>> = []
  const db = {
    row, writes,
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...row }, error: null }), single: async () => ({ data: { ...row }, error: null }) }) }),
      update: (patch: { meta: Record<string, unknown>; updated_at: string }) => ({ eq: () => ({ eq: () => ({ select: async () => {
        writes.push(patch.meta); row.meta = patch.meta; row.updated_at = patch.updated_at
        return { data: [{ id: PIECE }], error: null }
      } }) }) }),
    }),
  }
  return db
}

describe('one research prompt: the 5 Whys', () => {
  it('asks for one sourced answer per Why, a fenced why-ladder block right after the piece_id line, then the Markdown', () => {
    const p = researchPromptFor(context as never)
    for (const words of ['the 5 Whys', 'at least two primary sources on different domains', 'verbatim quote', 'its date',
      'counter-evidence', '"none found" with the scope you searched', 'a branch', 'AND', 'OR', 'never pad to five', 'evidence_exhausted',
      'out_of_scope', 'An open Why ends the ladder', 'what this shows', 'open question', '```why-ladder', '"schema": "why-ladder/1"'])
      expect(p, words).toContain(words)
    expect(p.indexOf(`piece_id: ${PIECE}`)).toBeLessThan(p.indexOf('```why-ladder'))
    expect(p.indexOf('```why-ladder')).toBeLessThan(p.indexOf('Then the narrative in Markdown'))
    expect(p).toMatch(/You have no other context/)
    expect(p).toContain('The arc.')
    expect(p).toContain('Who owns the masters?')
    expect(p).not.toMatch(/\u2014|\u2013/)
  })

  it('never asks for a forecast, odds, confidence or a lesson: the landing hands the viewer a question', () => {
    const p = researchPromptFor(context as never)
    expect(p).toContain('Never a verdict, a forecast, odds, how sure anyone is, or a lesson for leaders.')
    expect(p).not.toMatch(/what would change the story|five findings|predict|how sure we are|confidence/i)
  })

  it('biases Why 1 by series', () => {
    expect(researchPrompt(brief('follow.the.money'))).toContain('Where Why 1 starts, for follow.the.money: who pays, and why the price moved')
    expect(researchPrompt(brief('under.the.hood'))).toContain('Where Why 1 starts, for under.the.hood: how it is built, and what broke')
    expect(researchPrompt(brief('mind.the.gap'))).toContain('Where Why 1 starts, for mind.the.gap: where the claim and the reality part')
    expect(researchPrompt(brief('something.else'))).not.toContain('Where Why 1 starts')
    expect([seriesKey('follow_the_money'), seriesKey('money_of_ai'), seriesKey('built_with_ai'), seriesKey(null)]).toEqual(['follow_the_money', 'follow_the_money', 'under_the_hood', null])
  })

  it('the day card\'s brief (Copy Perplexity prompt, Research it now) is the same prompt, built from what the card knows', () => {
    const p = researchPrompt(brief('follow.the.money'))
    expect(p).toBe(whysResearchPrompt({ pieceId: PIECE, title: brief('x').idea, when: 'Monday 2026-11-30', series: 'follow.the.money',
      story: ['The story so far: The libraries priced stems by the track.', 'Krish\'s own words on it: "Follow the royalties."'], lock: null, sources: [],
      onFile: ['- Perplexity answer: stems'], notes: [] }))
    expect(p).toMatch(/primary sources/)
    expect(p).toContain(`piece_id: ${PIECE}`)
  })

  it('the example shape in the prompt is itself a ladder the contract reads', () => {
    const p = researchPromptFor(context as never)
    const shape = p.slice(p.indexOf('{"schema"'), p.indexOf('\n', p.indexOf('{"schema"')))
    const read = parseWhyLadder(`\`\`\`why-ladder\n${shape}\n\`\`\``)
    expect(read.problems).toEqual([])
    expect(read.ladder?.rungs[0]?.evidence.length).toBe(2)
    // The example carries no link of its own: a view with no sources carries none (board-media.test.ts).
    expect(shape).not.toMatch(/https?:/)
  })

  it('Research it now asks sonar-pro for the ladder with room for it', async () => {
    let sent: Record<string, any> = {}
    const fetcher = async (_u: string, init: { body: string }) => { sent = JSON.parse(init.body); return { ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) } }
    await runResearch('Research.', { PERPLEXITY_API_KEY: 'k' }, fetcher, async () => {})
    expect(sent.max_tokens).toBe(MAX_TOKENS)
    expect(MAX_TOKENS).toBeGreaterThan(4000)
    expect(sent.messages[0].content).toMatch(/why-ladder JSON block/)
  })
})

describe('Paste research and Research it now keep the ladder on the piece (meta.whys)', () => {
  it('files the Markdown, reads the ladder, and keeps a failing rung as a problem', async () => {
    const db = fakeDb({ look: { production: 'x' } })
    const filed = await fileMaterial(db as never, PIECE, { kind: 'research', title: 'Perplexity answer', content: research(LADDER), by: 'Krish' })
    expect(filed.whys).toEqual({ rungs: 3, problems: ['Why 2 needs a second source'], saved: true })
    const meta = db.row.meta as Record<string, any>
    expect(meta.materials[0]).toMatchObject({ kind: 'research', title: 'Perplexity answer' })
    expect(meta.look).toEqual({ production: 'x' })
    expect(meta.whys.ladder.rungs.length).toBe(3)
    expect(meta.whys.problems).toEqual([{ rung: 2, problem: 'Why 2 needs a second source' }])
    expect(meta.whys.material_id).toBe(filed.id)
    expect(typeof meta.whys.checked_at).toBe('string')
  })

  it('research with no ladder is filed exactly as before and leaves an earlier ladder alone', async () => {
    const earlier = whysFromResearch(research(LADDER), '2026-11-29T00:00:00Z')
    const db = fakeDb({ whys: earlier })
    const filed = await fileMaterial(db as never, PIECE, { kind: 'research', title: 'Plain notes', content: '# Notes\n\nNo ladder.', by: 'Krish' })
    expect(filed.whys).toBeUndefined()
    expect(db.writes.length).toBe(1)
    expect((db.row.meta as Record<string, any>).whys).toEqual(earlier)
  })

  it('a storyboard dropped through the same press is never read as research', async () => {
    const db = fakeDb()
    const filed = await fileMaterial(db as never, PIECE, { kind: 'file', title: 'Storyboard: x', content: research(LADDER), by: 'Krish' })
    expect(filed.whys).toBeUndefined()
    expect((db.row.meta as Record<string, any>).whys).toBeUndefined()
  })

  it('a block that will not read is kept as a problem, so the board says why', () => {
    const w = whysFromResearch('```why-ladder\n{"schema": "why-ladder/1", "rungs": [\n```', '2026-11-30T00:00:00Z')
    expect(w?.ladder).toBeNull()
    expect(w?.problems[0]?.problem).toMatch(/not valid JSON/)
    expect(whysView({ whys: w })).toMatchObject({ question: '', rungs: [], landing: null })
    expect(whysView({ whys: w })!.problems[0]).toMatch(/not valid JSON/)
  })

  it('the read sheet shows each rung ok or what it still needs, and nothing for a piece without one', () => {
    const view = whysView({ whys: whysFromResearch(research(LADDER), '2026-11-30T00:00:00Z') })
    expect(view?.rungs.map(r => [r.n, r.strength, r.status, r.problems])).toEqual([
      [1, 'documented', 'ok', []], [2, 'inferred', 'needs_work', ['Why 2 needs a second source']], [3, 'open', 'ok', []]])
    expect(view?.landing?.open_question).toBe('Who owns the work your tools learned from?')
    expect(whysView({})).toBeNull()
    expect(whysView(null)).toBeNull()
    expect(whysView({ whys: 'nonsense' })).toBeNull()
  })
})

describe('the narrative lock climbs the Whys', () => {
  it('the story prompt asks for "## The Whys", one Why per beat, each citing its evidence', () => {
    const p = storyPrompt(brief('follow.the.money'))
    expect(p).toContain('"## The Whys": one Why per beat')
    expect(p).toContain('[evidence:')
    expect(p).toContain('making.py refuses a lock whose Whys are missing or unsourced')
    expect(p).not.toMatch(/one thing a leader would do on Monday/)
    expect(p).toContain('land on what this shows and the open question it hands the viewer')
  })

  it('the corpus lines build the arc on the ladder and cite corpus ids per Why', () => {
    const text = corpusLines([{ id: 'r1', title: 'Perplexity answer', kind: 'research' }])
    expect(text).toContain('why-ladder')
    expect(text).toContain('"## The Whys"')
    expect(text).toContain('never pad to five')
    expect(text).not.toMatch(/one thing a reader does next/)
  })
})
