// The week's options, as the Sunday session writes them onto the pieces.
//
// Krish, 2026-10-11: "Every Sunday we're going to decide which of the three
// pieces are going to go out on Monday, Wednesday, and Friday", and the one
// question: "What are we writing about this week? Here are your ideas and
// options." A session researches the options for each publishing day and
// records them on the rows as meta.week_option; Control Center's week page
// (control-center src/lib/weekPlan.ts, reading the live rows) shows them, best
// first, until he picks. Nothing here picks or schedules: a pick is his press.

/** covers: the Sunday gather's must_cover ids this option answers (Inspiration cards he routed, his words), as on the
 *  board idea it came from. Kept on the piece as meta.covers (by week_start), so the card a picked piece answers is known for good
 *  (inspiration_card_pieces, migration 20261114090000; krishanraja/inspirationhouse docs/TWO_WAY.md, step 3). */
export interface WeekOptionInput { id: string; rank: number; pitch: string; why_now: string; recommended?: boolean; covers?: string[] }
export interface WeekOptionMeta { week_start: string; series: string; rank: number; pitch: string; why_now: string; recommended: boolean; by: string; at: string }

const YMD = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_OPTIONS = 4
const COVER_ID = /^[A-Za-z0-9_-]{1,80}$/
export const MAX_COVERS = 20

/** True when the date is a Monday (a week starts on Monday). */
export function isMonday(ymd: string): boolean {
  return YMD.test(ymd) && new Date(`${ymd}T12:00:00Z`).getUTCDay() === 1
}

/**
 * When an offered row should expire at the earliest: the Monday after its
 * week, at the hour the weekly purge runs (api/purge/run.ts, Mon 14:00 UTC).
 * A seed's own expiry is often days away, so without this the purge could
 * delete an option before Krish had the week to pick it. Returns the new
 * expiry, or null when the row's own is already later or it never expires.
 */
export function keepThroughWeek(expiresAt: string | null | undefined, weekStart: string): string | null {
  if (!expiresAt || !isMonday(weekStart)) return null
  const floor = new Date(`${weekStart}T14:00:00Z`)
  floor.setUTCDate(floor.getUTCDate() + 7)
  const own = Date.parse(expiresAt)
  return Number.isFinite(own) && own >= floor.getTime() ? null : floor.toISOString()
}

export function parseOptions(body: unknown): { week_start: string; series: string; options: WeekOptionInput[]; problems: string[] } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const problems: string[] = []
  const week_start = typeof b.week_start === 'string' ? b.week_start : ''
  const series = typeof b.series === 'string' ? b.series.trim() : ''
  if (!isMonday(week_start)) problems.push('week_start must be the Monday the week starts on, YYYY-MM-DD')
  if (!series) problems.push('series is required')
  const raw = Array.isArray(b.options) ? b.options : null
  if (!raw) problems.push('options must be a list of {id, rank, pitch, why_now, recommended}')
  const options: WeekOptionInput[] = []
  const seen = new Set<string>()
  for (const o of (raw || []).slice(0, MAX_OPTIONS + 1)) {
    const r = (o && typeof o === 'object' ? o : {}) as Record<string, unknown>
    const id = typeof r.id === 'string' ? r.id : ''
    const pitch = typeof r.pitch === 'string' ? r.pitch.trim() : ''
    const why = typeof r.why_now === 'string' ? r.why_now.trim() : ''
    const rank = Number(r.rank)
    if (!UUID.test(id)) { problems.push(`option id "${id}" is not a piece id`); continue }
    if (seen.has(id)) { problems.push(`option ${id} is listed twice`); continue }
    if (!pitch || pitch.length > 700) { problems.push(`option ${id} needs a pitch of up to 700 characters`); continue }
    if (!why || why.length > 400) { problems.push(`option ${id} needs a why_now of up to 400 characters, with the date`); continue }
    if (!Number.isInteger(rank) || rank < 1 || rank > 9) { problems.push(`option ${id} needs a rank from 1`); continue }
    let covers: string[] | undefined
    if (r.covers !== undefined) {
      if (!Array.isArray(r.covers) || r.covers.length > MAX_COVERS || !r.covers.every(c => typeof c === 'string' && COVER_ID.test(c))) {
        problems.push(`option ${id} covers must be a list of up to ${MAX_COVERS} must_cover ids`); continue
      }
      covers = [...new Set(r.covers as string[])]
    }
    seen.add(id)
    options.push({ id, rank, pitch, why_now: why, recommended: r.recommended === true, ...(covers ? { covers } : {}) })
  }
  if (options.length > MAX_OPTIONS) problems.push(`at most ${MAX_OPTIONS} options a day`)
  if (options.filter(o => o.recommended).length > 1) problems.push('recommend one option at most')
  return { week_start, series, options, problems }
}

/** The ids a piece answers after this write, by the week whose option said so: what it held for each week, and this
 *  option's for its week, once each, in order. Never shrinks: an option offered again without covers keeps what the
 *  piece already answers. Keyed by week, so a card counts as becoming this piece only in the week it was covered and
 *  the piece was scheduled (inspiration_card_pieces). */
export function mergeCovers(held: unknown, weekStart: string, more: string[] | undefined): Record<string, string[]> | null {
  const before: Record<string, string[]> = {}
  if (held && typeof held === 'object' && !Array.isArray(held)) {
    for (const [week, ids] of Object.entries(held as Record<string, unknown>)) {
      if (isMonday(week) && Array.isArray(ids)) before[week] = ids.filter((c): c is string => typeof c === 'string')
    }
  }
  if (more?.length) before[weekStart] = [...new Set([...(before[weekStart] ?? []), ...more])]
  return Object.keys(before).length ? before : null
}
