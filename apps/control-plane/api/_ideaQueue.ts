// The one idea queue (Krish, 2026-10-19: "mark ideas for a queue instead of selecting them for this week ... it
// needs to survive everything and be the first thing in chat ... that queue needs to be A/B triage in Control
// Centre"). A queued idea is a content_ideas row with queued_at set; meta.queue holds his triage. This file is the
// pure half: the four verdicts, the shape of a mark, and what a queued row looks like to a reader. api/idea-queue.ts
// is the guarded route. Nothing here decides for him: a verdict is recorded only as his own tap or words.

/** His four ways of triaging an idea (his words, 19 Oct) plus Drop. */
export const VERDICTS = ['story', 'angle', 'cute', 'curious', 'drop'] as const
export type Verdict = (typeof VERDICTS)[number]

export const VERDICT_LABEL: Record<Verdict, string> = {
  story: 'Story: I would run it',
  angle: 'Angle: I would run it from this angle',
  cute: 'Cute: I like it, I would not run it',
  curious: 'Curious, not convinced',
  drop: 'Drop',
}

export interface QueueMark {
  id: string | null          // the content_ideas row, when the idea already has one
  idea: string               // the idea's story line, plain English
  so_what: string            // what a business person finds out, first (story-a-business-person-gets)
  why_now: string | null
  fact: string | null
  source_url: string | null
  source_label: string | null
  series: string | null      // follow_the_money | mind_the_gap | under_the_hood, when the idea fits one
  from_week: string | null
  from_pick: string | null   // the board's pick id, e.g. mon-1
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const SERIES = ['follow_the_money', 'mind_the_gap', 'under_the_hood']

function str(v: unknown, max: number): string | null {
  return typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null
}

export function parseMark(body: any): { mark: QueueMark | null; problems: string[] } {
  const problems: string[] = []
  const id = str(body?.id, 64)
  if (id && !UUID.test(id)) problems.push('id must be a content_ideas uuid, or left out for a new idea')
  const idea = str(body?.idea, 2000)
  const so_what = str(body?.so_what, 1000)
  if (!id && !idea) problems.push('give the idea (its story line) when it has no row yet')
  if (!so_what && !id) problems.push('so_what is required: what a business person finds out, in one plain sentence')
  const series = str(body?.series, 40)
  if (series && !SERIES.includes(series)) problems.push(`series must be one of ${SERIES.join(', ')}`)
  if (problems.length) return { mark: null, problems }
  return {
    problems,
    mark: {
      id: id && UUID.test(id) ? id : null, idea: idea || '', so_what: so_what || '',
      why_now: str(body?.why_now, 600), fact: str(body?.fact, 800),
      source_url: str(body?.source_url, 600), source_label: str(body?.source_label, 200),
      series, from_week: str(body?.from_week, 10), from_pick: str(body?.from_pick, 20),
    },
  }
}

export interface TriageInput { verdict: Verdict; reason: string | null; angle: string | null; decided_by: 'Krish'; said: string | null }

/** A verdict counts only when it carries his own tap or words. The route refuses any other decided_by. */
export function parseTriage(body: any): { triage: TriageInput | null; problems: string[] } {
  const problems: string[] = []
  const verdict = body?.verdict
  if (!VERDICTS.includes(verdict)) problems.push(`verdict must be one of ${VERDICTS.join(', ')}`)
  if (body?.decided_by !== 'Krish') problems.push("decided_by must be 'Krish': a verdict is only ever his own tap or words")
  const reason = str(body?.reason, 600)
  const angle = str(body?.angle, 600)
  if (verdict === 'curious' && !reason) problems.push('curious needs his reason (for example "it is safer"): why he is not convinced')
  if (verdict === 'angle' && !angle) problems.push('angle needs the angle he would run it from')
  if (problems.length) return { triage: null, problems }
  return { problems, triage: { verdict, reason, angle, decided_by: 'Krish', said: str(body?.said, 600) } }
}

/** The meta.queue block written on the row. */
export function queueMeta(mark: QueueMark | null, prior: Record<string, any> | undefined, at: string, by: string): Record<string, any> {
  const base = prior || {}
  if (!mark) return base
  return {
    ...base,
    so_what: mark.so_what || base.so_what || null,
    why_now: mark.why_now ?? base.why_now ?? null,
    fact: mark.fact ?? base.fact ?? null,
    source_label: mark.source_label ?? base.source_label ?? null,
    from_week: mark.from_week ?? base.from_week ?? null,
    from_pick: mark.from_pick ?? base.from_pick ?? null,
    queued_at: base.queued_at || at,
    queued_by: base.queued_by || by,
  }
}

/** What the reader (a session, the board, Control Center) sees of one queued row. */
export function present(row: Record<string, any>) {
  const q = (row.meta && row.meta.queue) || {}
  return {
    id: row.id, idea: row.idea, series: row.lane_slot || null, state: row.state,
    queued_at: row.queued_at, source_url: row.source_url || null,
    so_what: q.so_what || null, why_now: q.why_now || null, fact: q.fact || null, source_label: q.source_label || null,
    from_week: q.from_week || null, from_pick: q.from_pick || null,
    triage: q.triage || null, triage_history: Array.isArray(q.triage_history) ? q.triage_history : [],
    needs_triage: !q.triage,
  }
}

/** Two ideas for the A/B page: the queue's untriaged first, the longest-waiting pair. */
export function nextPair(rows: Array<ReturnType<typeof present>>): [typeof rows[number], typeof rows[number]] | null {
  const open = rows.filter(r => r.needs_triage).sort((a, b) => String(a.queued_at).localeCompare(String(b.queued_at)))
  return open.length >= 2 ? [open[0], open[1]] : null
}
