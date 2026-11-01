// His verdicts on past off-day options, for Sunday's gather (GET /api/week/options?include=sources, `offday_verdicts`).
// Ruling, Krish, 2026-11-01, locking the off-day mock: "I need Ideas and a suggested creative direction to approve or
// improve or flat out reject for a reason, and the machine can learn over time". Each press is queue/off-<day>-<option>
// on that week's board (api/board/_contracts.ts offdayVerdicts); this reads the last OFFDAY_WEEKS weeks and lists every
// side he judged, his words verbatim, newest first. The plan-week skill (references/offdays.md) makes the next options
// from them and quotes them in each option's learned_from. Read-only, no model; a failed read is said in `empty` and
// Sunday carries on.

export const OFFDAY_WEEKS = 8

export interface OffdayVerdict {
  week: string
  option: string
  day: string | null
  format: string | null
  /** The hook he saw when he approved the idea, when the press kept it. */
  hook: string | null
  side: 'idea' | 'direction' | 'mock'
  verdict: 'approve' | 'improve' | 'reject' | 'next_week'
  /** His words, verbatim, or null for a bare press. */
  words: string | null
  at: string | null
}

type Row = { week?: unknown; doc_id?: unknown; body?: unknown }
const isObj = (v: unknown): v is Record<string, any> => !!v && typeof v === 'object' && !Array.isArray(v)
const VERDICTS = new Set(['approve', 'improve', 'reject', 'next_week'])

export function buildOffdayVerdicts(rows: Row[]): { verdicts: OffdayVerdict[]; counts: Record<string, number> } {
  const out: OffdayVerdict[] = []
  for (const r of rows) {
    const b = isObj(r.body) ? r.body : null
    if (!b || !String(r.doc_id || '').startsWith('off-')) continue
    const hook = isObj(b.idea) && isObj(b.idea.shown) && typeof b.idea.shown.hook === 'string' ? b.idea.shown.hook : null
    for (const side of ['idea', 'direction', 'mock'] as const) {
      const v = b[side]
      if (!isObj(v) || !VERDICTS.has(v.verdict)) continue
      out.push({ week: String(r.week || ''), option: String(r.doc_id), day: typeof b.day === 'string' ? b.day : null,
        format: typeof b.format === 'string' ? b.format : null, hook, side, verdict: v.verdict,
        words: typeof v.words === 'string' && v.words.trim() ? v.words.trim() : null, at: typeof v.at === 'string' ? v.at : null })
    }
  }
  out.sort((a, b) => String(b.at || '').localeCompare(String(a.at || '')) || a.option.localeCompare(b.option))
  const counts: Record<string, number> = { approve: 0, improve: 0, reject: 0, next_week: 0 }
  for (const v of out) counts[v.verdict]++
  return { verdicts: out, counts }
}

export function offdayWeeksBefore(week: string, n = OFFDAY_WEEKS): string[] {
  const t = Date.parse(`${week}T00:00:00Z`)
  return Array.from({ length: n }, (_, i) => new Date(t - (i + 1) * 7 * 86_400_000).toISOString().slice(0, 10))
}
