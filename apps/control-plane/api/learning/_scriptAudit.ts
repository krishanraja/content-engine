import type { MakingCut, MakingScriptAudit } from '../_making.js'
import { evidenceIds, type Proposal } from './_patterns.js'

// The rolling ledger of the three-way script audit (scripts/voice/script_audit.py, recorded on each piece as
// making.script_audit.<cut>). Krish, 2026-11-18: "I think a really important post-audit is comparing a script that you
// put into the dashboard versus the script that went into Teleprompter after my edits versus the actual words I said in
// the video. The whole system would learn so much from doing that after every video was produced." And the same day,
// of a word a draft gave him: "It's also the vocabulary she uses, as opposed to even your latest hospital care script,
// which used words like "dearest," which I would never say in a million years."
//
// a is the engine's draft he was shown, b the words his Approve sent to Teleprompter, c what he said on the take.
// a to b is what he edits before recording (his edit rate), b to c what he changes saying it (his ad-lib rate), a to c
// the whole gap. Only texts bound to their source count: one given by hand is reported on the piece and left out here.
// A swap seen in HABIT_PIECES pieces or more is a habit; fewer is a one-off. Habits go to his list as proposals
// (spoken:swap:<word>), never as rules: a rule goes live only with his yes (AGENTS.md).

export const HABIT_PIECES = 2
/** Swaps counted for the vocabulary: his edits and his saying it. a to c would count each of them twice. */
export const SWAP_PAIRS = ['a_b', 'b_c'] as const

export interface AuditRow { piece_id: string; cuts: Partial<Record<MakingCut, MakingScriptAudit>> }
export interface Rate { cuts: number; words: number; changes: number; per_100_words: number | null }
export interface LedgerSwap {
  from: string
  /** What he put instead, most often first. */
  to: Array<{ to: string; n: number }>
  n: number
  pieces: string[]
  by_pair: Partial<Record<(typeof SWAP_PAIRS)[number], number>>
}
export interface AuditLedger {
  pieces: number
  cuts: number
  edit_rate: Rate
  adlib_rate: Rate
  whole_gap: Rate
  swaps: LedgerSwap[]
  habits: LedgerSwap[]
  missing: Array<{ piece_id: string; cut: string; text: string; why: string }>
}

const BY_HAND = 'by_hand'
const clean = (s: string) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim()
function bound(a: MakingScriptAudit, pair: string): boolean {
  const [x, y] = pair.split('_') as Array<'a' | 'b' | 'c'>
  const tx = a.texts?.[x], ty = a.texts?.[y]
  return Boolean(tx && ty && !tx.missing && !ty.missing && tx.source !== BY_HAND && ty.source !== BY_HAND)
}

/** The ledger across every audited cut. Pure. */
export function auditLedger(rows: AuditRow[]): AuditLedger {
  const rate = (): Rate => ({ cuts: 0, words: 0, changes: 0, per_100_words: null })
  const rates = { a_b: rate(), b_c: rate(), a_c: rate() }
  const swaps = new Map<string, { to: Map<string, number>; n: number; pieces: Set<string>; by_pair: Record<string, number> }>()
  const missing: AuditLedger['missing'] = []
  let cuts = 0
  const pieces = new Set<string>()
  for (const row of rows) {
    for (const [cut, a] of Object.entries(row.cuts || {})) {
      if (!a || typeof a !== 'object' || !a.texts || !a.pairs) continue
      cuts += 1
      pieces.add(row.piece_id)
      for (const k of ['a', 'b', 'c'] as const) {
        const why = a.texts[k]?.missing
        if (why) missing.push({ piece_id: row.piece_id, cut, text: k, why })
      }
      for (const [pair, r] of Object.entries(rates)) {
        const p = a.pairs[pair as keyof typeof a.pairs]
        if (!p || !bound(a, pair)) continue
        r.cuts += 1
        r.words += p.words_from
        r.changes += p.changes
      }
      for (const pair of SWAP_PAIRS) {
        const p = a.pairs[pair]
        if (!p || !bound(a, pair)) continue
        for (const s of p.swaps || []) {
          const from = clean(s.from), to = clean(s.to)
          if (!from || !to || from === to) continue
          const e = swaps.get(from) ?? { to: new Map(), n: 0, pieces: new Set<string>(), by_pair: {} }
          e.to.set(to, (e.to.get(to) ?? 0) + 1)
          e.n += 1
          e.pieces.add(row.piece_id)
          e.by_pair[pair] = (e.by_pair[pair] ?? 0) + 1
          swaps.set(from, e)
        }
      }
    }
  }
  for (const r of Object.values(rates)) r.per_100_words = r.words ? Math.round((1000 * r.changes) / r.words) / 10 : null
  const list: LedgerSwap[] = [...swaps].map(([from, e]) => ({
    from, n: e.n, pieces: [...e.pieces].sort(), by_pair: e.by_pair,
    to: [...e.to].map(([to, n]) => ({ to, n })).sort((x, y) => y.n - x.n || x.to.localeCompare(y.to)),
  })).sort((x, y) => y.pieces.length - x.pieces.length || y.n - x.n || x.from.localeCompare(y.from))
  return {
    pieces: pieces.size, cuts, edit_rate: rates.a_b, adlib_rate: rates.b_c, whole_gap: rates.a_c,
    swaps: list.slice(0, 200), habits: list.filter(s => s.pieces.length >= HABIT_PIECES), missing: missing.slice(0, 200),
  }
}

/** The swaps he makes in HABIT_PIECES pieces or more, as taste proposals for his list. Pure. */
export function swapProposals(rows: AuditRow[]): Proposal[] {
  return auditLedger(rows).habits.map(h => {
    const said = h.to.slice(0, 3).map(t => `"${t.to}"${t.n > 1 ? ` (${t.n} times)` : ''}`).join(', ')
    const where = [h.by_pair.a_b ? `${h.by_pair.a_b} in his edits before recording` : '', h.by_pair.b_c ? `${h.by_pair.b_c} saying it on camera` : '']
      .filter(Boolean).join(' and ')
    const assertion = `He changes "${h.from}" in ${h.pieces.length} pieces (${where}): to ${said}. `
      + `Proposed: scripts he will say write ${h.to[0] ? `"${h.to[0].to}"` : 'his word'} where a draft would write "${h.from}". It stays a proposal until he approves it.`
    return {
      proposal_class: 'taste',
      assertion: assertion.slice(0, 1600),
      scope: { level: 'global', key: `spoken:swap:${h.from.slice(0, 60)}`, venture: 'publication', lane: 'voice' },
      evidence_count: h.pieces.length,
      evidence_ids: evidenceIds(h.pieces),
      counterexamples: [
        'only texts bound to their source are counted: a draft or approval given by hand is left out',
        'a word he says differently may be a transcriber mishearing; only swaps both aligners heard are counted on the take',
      ],
      regression_cases: [
        `Once approved, the next drafts should not need "${h.from}" changed; the script audit counts it again on every take.`,
        'Approving it changes no draft by itself: spoken_rules.py hands it to the Scripts step, and it is reviewed into ai-harness krish-voice.',
      ],
      proposed_change: { kind: 'spoken_register', change: 'swap_word', from: h.from, to: h.to[0]?.to ?? null,
        target: 'ai-harness skills/krish-voice/references/voice-profile.md#spoken-script' },
    }
  })
}

/** Rows as the compiler and the ledger route read them from content_ideas.meta.making.script_audit. */
export function auditRows(data: Array<{ id: string; script_audit: unknown }>): AuditRow[] {
  return data.filter(r => r.script_audit && typeof r.script_audit === 'object' && !Array.isArray(r.script_audit))
    .map(r => ({ piece_id: r.id, cuts: r.script_audit as AuditRow['cuts'] }))
}
