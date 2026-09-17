import { surfacingReason } from '../_arcScore.js'

/**
 * The rows one weekly surfacing writes, winners and losers alike.
 *
 * Extracted so the shape can be tested without a database, which is how every
 * other pure half in this tree is guarded. It had no test of any kind, and the
 * bug it shipped was entirely a shape bug.
 *
 * EVERY ROW IN ONE UPSERT MUST CARRY THE SAME KEYS. PostgREST unions the keys
 * across a bulk upsert and sends an explicit NULL for any key a given row
 * omits. An omitted column would have taken its DEFAULT; an explicit NULL
 * defeats it. The blocked and skipped rows here omitted `components` and
 * `reserved_slot`, both `not null default …`, so every weekly run died on
 * `arc_cards write failed: null value in column "components" of relation
 * "arc_cards" violates not-null constraint`.
 *
 * `components` is the column the error named, but `reserved_slot` was omitted
 * too — fixing only the column in the message would have moved the failure to
 * the next run, a week later.
 */
/** Only what a row needs off the arc. The caller's Row is wider. */
export interface CardArc { id: string; arc_state?: string | null; theme_id?: string | null }

/** The six card fields the composer fills, plus the format it chose. */
export interface ComposedFields {
  headline: string; what_changed: string; why_now: string
  the_opening: string; where_this_goes: string; reader_decision: string; format: string
}

export interface ScoredArc {
  row: CardArc; card: ComposedFields; score: number
  components: unknown; blocked: boolean; blocks: string[]
}

export function arcCardRows({ scored, preBlocked, skipped, surfacedIds, reservedIds, week }: {
  scored: ScoredArc[]
  preBlocked: Array<{ row: CardArc; blocks: string[] }>
  skipped: Array<{ row: CardArc; reason: string }>
  surfacedIds: Set<string>
  reservedIds: Set<string>
  week: string
}): Record<string, unknown>[] {
  // The card fields are genuinely absent for an arc that was never composed,
  // and they are nullable with no default, so NULL is the right value and
  // saying it explicitly costs nothing. The defaulted columns are spelled out.
  const UNCOMPOSED = {
    headline: null, what_changed: null, why_now: null, the_opening: null,
    where_this_goes: null, reader_decision: null, format: null,
    components: [], reserved_slot: false,
  }
  const rows: Record<string, unknown>[] = []
  for (const s of scored) {
    const on = surfacedIds.has(s.row.id)
    rows.push({
      shift_id: s.row.id, week,
      headline: s.card.headline, what_changed: s.card.what_changed, why_now: s.card.why_now,
      the_opening: s.card.the_opening, where_this_goes: s.card.where_this_goes,
      reader_decision: s.card.reader_decision, format: s.card.format,
      score: s.blocked ? 0 : s.score, components: s.components,
      blocked: s.blocked, blocks: s.blocks,
      surfaced: on, reserved_slot: reservedIds.has(s.row.id),
      surface_reason: s.blocked
        ? s.blocks.join('; ')
        : on
          ? surfacingReason(s.row.arc_state || 'building', Boolean(s.row.theme_id))
          : `scored ${s.score.toFixed(2)}, below the cut for this week`,
    })
  }
  for (const p of preBlocked) {
    rows.push({
      ...UNCOMPOSED,
      shift_id: p.row.id, week, blocked: true, blocks: p.blocks, score: 0,
      surfaced: false, surface_reason: p.blocks.join('; '),
    })
  }
  for (const sk of skipped) {
    rows.push({
      ...UNCOMPOSED,
      shift_id: sk.row.id, week, blocked: true, blocks: [sk.reason], score: 0,
      surfaced: false, surface_reason: sk.reason,
    })
  }
  return rows
}
