import { describe, expect, it } from 'vitest'
import {
  buildProductionBrief,
  contentRevisionHash,
  createProductionApproval,
  productionLanding,
} from '../../apps/control-plane/api/_productionBrief.ts'
import { ProductionBriefV1Schema } from '../../packages/contracts/src/editorial-v1.ts'
import { renderLandingFromBriefV2 } from '../../packages/core/src/render-landing.ts'
import type { WhyLadder, WhyRung } from '../../packages/contracts/src/whys.ts'

// The landing card's words come from the production brief, bound from the piece's checked why-ladder (meta.whys) when
// the brief is built (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys). The body never holds a ladder: it
// is the piece, and the ARTICLE_FORMAT check refuses a backtick in it. The landing is part of the approved revision, so
// a landing changed after approval retires the approval; a piece with no standing ladder keeps the hash it always had.

const ev = (domain: string) => ({ url: `https://${domain}/report`, domain, date: '2026-11-02', quote: 'A verbatim line from the source.', tier: 'primary' })
const rung = (n: number, over: Partial<WhyRung> = {}): WhyRung => ({
  n, question: `Why does step ${n} happen?`, answer: `Because of cause ${n}, which the filings show plainly.`,
  evidence: [ev('sec.gov'), ev('reuters.com')], strength: 'documented', counter: { text: 'The company says demand did it.' }, stop: null, ...over,
})
const LANDING = { shows: 'The price follows who owns the masters, not what the AI costs to run.', open_question: 'Which part of your own work is priced by who owns it?' }
const ladder = (over: Partial<WhyLadder> = {}): WhyLadder => ({
  schema: 'why-ladder/1', question: 'Why did the price of music stems double this year?', series: 'follow_the_money',
  rungs: [1, 2, 3, 4, 5].map(n => rung(n)), landing: LANDING, ...over,
})

const base = {
  id: '11111111-1111-4111-8111-111111111111',
  idea: 'Why did the price of music stems double?',
  thesis: 'The price of stems follows who owns the masters, not what the AI costs to run.',
  body: 'The label moved first. The rest followed, one by one, as the cost fell and the owners set the price.',
  lane: 'publication',
  lane_slot: 'follow_the_money',
  source_url: 'https://example.com/evidence',
}
const meta = (whys: unknown) => ({ whys })
const approvedAt = '2026-11-24T12:00:00.000Z'
const build = (row: typeof base & { meta?: unknown }) => buildProductionBrief({
  row: row as never, approval: createProductionApproval(row, approvedAt), productionKinds: ['video'], sourceMode: 'solo', editorialFormat: 'money_trace',
})

describe('the production brief carries the landing of the piece\'s checked why-ladder', () => {
  it('binds the landing from meta.whys.ladder, and the Studio reads it from the brief', () => {
    const row = { ...base, meta: meta({ ladder: ladder(), problems: [], checked_at: approvedAt, material_id: 'mat_1' }) }
    const brief = build(row)
    expect(brief.content.landing).toEqual(LANDING)
    // The body stays the piece: no ladder block, nothing for the old reader to find.
    expect(brief.content.approved_text).not.toMatch(/why-ladder/)
    // The Studio's contract takes the brief, and its landing reader returns the bound landing for any beat.
    const parsed = ProductionBriefV1Schema.parse(brief)
    expect(renderLandingFromBriefV2(parsed, 'beat-landing')).toEqual({ beat_id: 'beat-landing', ...LANDING })
  })

  it('carries no landing when the ladder falls short, is missing or is not there at all', () => {
    const thin = ladder({ rungs: [rung(1), rung(2), rung(3, { evidence: [ev('sec.gov')] }), rung(4), rung(5)] })
    for (const whys of [{ ladder: thin, problems: [] }, { ladder: null, problems: [{ rung: null, problem: 'The why-ladder block is not valid JSON (x)', source: 'parse' }] }, undefined, 'junk']) {
      const brief = build({ ...base, meta: meta(whys) })
      expect('landing' in brief.content).toBe(false)
      expect(() => renderLandingFromBriefV2(ProductionBriefV1Schema.parse(brief), 'beat-landing')).toThrow(/carries no landing from a checked why-ladder/)
    }
    expect('landing' in build(base).content).toBe(false)
  })

  it('leaves the hash of a piece without a standing ladder exactly as it was', () => {
    const plain = contentRevisionHash(base)
    expect(contentRevisionHash({ ...base, meta: {} })).toBe(plain)
    expect(contentRevisionHash({ ...base, meta: meta({ ladder: ladder({ rungs: [rung(1, { evidence: [] })] }), problems: [] }) })).toBe(plain)
    // A standing ladder joins the approved revision.
    expect(contentRevisionHash({ ...base, meta: meta({ ladder: ladder(), problems: [] }) })).not.toBe(plain)
  })

  it('retires the approval when the landing changes after it', () => {
    const row = { ...base, meta: meta({ ladder: ladder(), problems: [] }) }
    const approval = createProductionApproval(row, approvedAt)
    const changed = { ...row, meta: meta({ ladder: ladder({ landing: { ...LANDING, open_question: 'Who prices your own work?' } }), problems: [] }) }
    expect(contentRevisionHash(changed)).not.toBe(approval.content_revision_hash)
    expect(() => buildProductionBrief({ row: changed as never, approval, productionKinds: ['video'], sourceMode: 'solo', editorialFormat: 'money_trace' })).toThrow(/approved_revision_changed/)
    // Other meta (timestamps, workflow state) still never moves the hash.
    expect(contentRevisionHash({ ...row, meta: { ...row.meta, production_approval: approval } })).toBe(approval.content_revision_hash)
  })

  it('reads stored meta defensively', () => {
    expect(productionLanding(null)).toBeNull()
    expect(productionLanding({ whys: { ladder: { landing: LANDING } } })).toBeNull()
    expect(productionLanding({ whys: { ladder: ladder({ landing: { shows: 'x'.repeat(601), open_question: 'Why?' } }) } })).toBeNull()
    expect(productionLanding({ whys: { ladder: ladder() } })).toEqual(LANDING)
  })
})
