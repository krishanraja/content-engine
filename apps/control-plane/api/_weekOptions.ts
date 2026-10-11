// The week's options, as the Sunday session writes them onto the pieces.
//
// Krish, 2026-10-11: "Every Sunday we're going to decide which of the three
// pieces are going to go out on Monday, Wednesday, and Friday", and the one
// question: "What are we writing about this week? Here are your ideas and
// options." A session researches the options for each publishing day and
// records them on the rows as meta.week_option; Control Center's week page
// (control-center src/lib/weekPlan.ts, reading the live rows) shows them, best
// first, until he picks. Nothing here picks or schedules: a pick is his press.

export interface WeekOptionInput { id: string; rank: number; pitch: string; why_now: string; recommended?: boolean }
export interface WeekOptionMeta { week_start: string; series: string; rank: number; pitch: string; why_now: string; recommended: boolean; by: string; at: string }

const YMD = /^\d{4}-\d{2}-\d{2}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_OPTIONS = 4

/** True when the date is a Monday (a week starts on Monday). */
export function isMonday(ymd: string): boolean {
  return YMD.test(ymd) && new Date(`${ymd}T12:00:00Z`).getUTCDay() === 1
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
    seen.add(id)
    options.push({ id, rank, pitch, why_now: why, recommended: r.recommended === true })
  }
  if (options.length > MAX_OPTIONS) problems.push(`at most ${MAX_OPTIONS} options a day`)
  if (options.filter(o => o.recommended).length > 1) problems.push('recommend one option at most')
  return { week_start, series, options, problems }
}
