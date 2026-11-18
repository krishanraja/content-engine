import { describe, expect, it } from 'vitest'
import { mergeMaking, parseMakingPatch, type MakingScriptAudit } from '../../apps/control-plane/api/_making.js'
import { auditLedger, auditRows, HABIT_PIECES, swapProposals } from '../../apps/control-plane/api/learning/_scriptAudit.js'

// The three-way script audit (scripts/voice/script_audit.py): the engine's draft (a), the words his Approve sent (b)
// and what he said (c). Krish, 2026-11-18: "comparing a script that you put into the dashboard versus the script that
// went into Teleprompter after my edits versus the actual words I said in the video".

const NOW = '2026-11-18T12:00:00.000Z'
const SHA = (c: string) => c.repeat(64)
const P1 = '00000000-0000-4000-8000-000000000001'
const P2 = '00000000-0000-4000-8000-000000000002'
const P3 = '00000000-0000-4000-8000-000000000003'

function pair(words: number, changes: number, swaps: Array<[string, string]>) {
  return { words_from: words, words_to: words, kept: words - changes, swapped: swaps.length, cut: 0, added: changes - swaps.length,
    contracted: 0, expanded: 0, changes, changes_per_100_words: Math.round((1000 * changes) / words) / 10, swaps: swaps.map(([from, to]) => ({ from, to })) }
}
function auditOf(o: { a?: string; b?: string; c?: string; ab?: ReturnType<typeof pair>; bc?: ReturnType<typeof pair>; ac?: ReturnType<typeof pair> }): MakingScriptAudit {
  const text = (source: string | undefined, c: string) => (source === undefined ? { missing: 'not found' } : { sha256: SHA(c), source })
  return {
    texts: { a: text(o.a, 'a'), b: text(o.b, 'b'), c: text(o.c, 'c') },
    pairs: { ...(o.ab ? { a_b: o.ab } : {}), ...(o.bc ? { b_c: o.bc } : {}), ...(o.ac ? { a_c: o.ac } : {}) },
    at: NOW,
  }
}

describe('the making record keeps the audit, cut by cut, never the words', () => {
  it('takes hashes, sources, counts and swaps, and merges the short without dropping the long', () => {
    const long = auditOf({ a: 'material', b: 'approval', c: 'take', ab: pair(800, 90, [['sacked', 'just got rid of']]), bc: pair(850, 250, []), ac: pair(800, 300, []) })
    const { patch, problems } = parseMakingPatch({ script_audit: { long } }, NOW)
    expect(problems).toEqual([])
    const short = auditOf({ b: 'approval', c: 'take', bc: pair(200, 70, [['dearer', 'higher']]) })
    const second = parseMakingPatch({ script_audit: { short } }, NOW)
    expect(second.problems).toEqual([])
    const merged = mergeMaking(mergeMaking(null, patch, 'Claude Code', NOW), second.patch, 'Claude Code', NOW)
    expect(Object.keys(merged.script_audit || {}).sort()).toEqual(['long', 'short'])
    expect(merged.script_audit?.short?.texts.a).toEqual({ missing: 'not found' })
    expect(merged.script_audit?.long?.pairs.a_b?.swaps).toEqual([{ from: 'sacked', to: 'just got rid of' }])
  })
  it('refuses a pair over a missing text, a text with no hash or source, an unknown cut and a long swap', () => {
    const bad = (v: unknown) => parseMakingPatch({ script_audit: v }, NOW).problems
    expect(bad({ long: auditOf({ b: 'approval', ab: pair(10, 1, []) }) }).join()).toMatch(/missing/)
    expect(bad({ long: { ...auditOf({ a: 'material', b: 'approval', c: 'take' }), texts: { a: { source: 'material' }, b: { missing: 'x' }, c: { missing: 'y' } } } }).join()).toMatch(/sha256 and source/)
    expect(bad({ middle: auditOf({}) }).join()).toMatch(/unknown cut/)
    expect(bad({ long: auditOf({ a: 'material', b: 'approval', ab: pair(10, 1, [['x'.repeat(81), 'y']]) }) }).join()).toMatch(/80 characters/)
    expect(bad({}).join()).toMatch(/needs a cut/)
  })
})

describe('the ledger across pieces', () => {
  const rows = auditRows([
    { id: P1, script_audit: { long: auditOf({ a: 'material', b: 'approval', c: 'take', ab: pair(800, 80, [['sacked', 'fired'], ['small', 'little']]), bc: pair(850, 170, [['dearer', 'higher']]), ac: pair(800, 240, []) }) } },
    { id: P2, script_audit: { short: auditOf({ a: 'material', b: 'approval', c: 'take', ab: pair(200, 10, [['Sacked', 'got rid of']]), bc: pair(210, 42, [['small', 'tiny']]), ac: pair(200, 50, []) }) } },
    // By hand: shown on the piece, never counted here.
    { id: P3, script_audit: { long: auditOf({ a: 'by_hand', b: 'approval', c: 'take', ab: pair(500, 400, [['sacked', 'axed']]), bc: pair(500, 50, [['dearer', 'pricier']]) }) } },
    { id: 'not-audited', script_audit: null },
  ])
  const led = auditLedger(rows)
  it('gives his edit rate, his ad-lib rate and the whole gap from bound texts only', () => {
    expect([led.pieces, led.cuts]).toEqual([3, 3])
    expect(led.edit_rate).toEqual({ cuts: 2, words: 1000, changes: 90, per_100_words: 9 })
    expect(led.adlib_rate).toEqual({ cuts: 3, words: 1560, changes: 262, per_100_words: 16.8 })
    expect(led.whole_gap.cuts).toBe(2)
  })
  it('lists the words he swaps out with what he said instead, and a habit only from two pieces', () => {
    const sacked = led.swaps.find(s => s.from === 'sacked')!
    expect(sacked.to).toEqual([{ to: 'fired', n: 1 }, { to: 'got rid of', n: 1 }])
    expect(sacked.pieces).toEqual([P1, P2])
    expect(sacked.by_pair).toEqual({ a_b: 2 })
    expect(led.habits.map(h => h.from).sort()).toEqual(['dearer', 'sacked', 'small'])
    expect(led.swaps.find(s => s.from === 'dearer')?.pieces).toEqual([P1, P3])
    expect(led.habits.every(h => h.pieces.length >= HABIT_PIECES)).toBe(true)
    expect(led.swaps.find(s => s.from === 'dearer')?.to).toEqual([{ to: 'higher', n: 1 }, { to: 'pricier', n: 1 }])
  })
  it('counts a by-hand pair out of the rates and the swaps but keeps its take side', () => {
    expect(led.swaps.some(s => s.to.some(t => t.to === 'axed'))).toBe(false)
  })
  it('names every text that could not be found', () => {
    const missing = auditLedger(auditRows([{ id: P1, script_audit: { short: auditOf({ b: 'approval', c: 'take', bc: pair(100, 10, []) }) } }])).missing
    expect(missing).toEqual([{ piece_id: P1, cut: 'short', text: 'a', why: 'not found' }])
  })
})

describe('habits go to his list as proposals, never rules', () => {
  it('proposes each swap seen in two pieces, keyed spoken:swap, so spoken_rules hands a kept one to the Scripts step', () => {
    const rows = auditRows([
      { id: P1, script_audit: { long: auditOf({ a: 'material', b: 'approval', ab: pair(100, 5, [['sacked', 'fired'], ['dearer', 'higher']]) }) } },
      { id: P2, script_audit: { long: auditOf({ a: 'material', b: 'approval', ab: pair(100, 5, [['sacked', 'fired']]) }) } },
    ])
    const proposals = swapProposals(rows)
    expect(proposals.map(p => p.scope.key)).toEqual(['spoken:swap:sacked'])
    const p = proposals[0]!
    expect(p.proposal_class).toBe('taste')
    expect(p.assertion).toMatch(/"sacked" in 2 pieces/)
    expect(p.assertion).toMatch(/stays a proposal until he approves it/)
    expect(p.evidence_ids).toEqual([P1, P2])
    expect(p.proposed_change).toMatchObject({ change: 'swap_word', from: 'sacked', to: 'fired' })
  })
})
