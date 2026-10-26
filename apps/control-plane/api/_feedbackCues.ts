// Krish's feedback cues, for Sunday's gather (GET /api/week/options?include=sources, `cues`).
//
// Krish, 2026-10-26: "create some form of feedback loop with the [inspiration] house repository where all the feedback
// I've given you goes into a really clear set of cues that you can draw from in the future? ... some stuff is really
// valuable. For the future some stuff is really valuable but as a pattern within a different piece some stuff is
// really valuable to track over time, etc."
//
// The Inspiration House (krishanraja/inspirationhouse, src/collect/feedbackCues.ts) files every piece of his words on
// an idea (the queue's verdicts) or a saved post (his typed card answers) into feedback_cues (migration
// 20261111090000) on its daily run, each with what it is for. This reads the open ones and groups them the way Sunday
// uses them:
//
//   future_pieces  ideas he wants made later as their own piece: owed a place when they fit a day
//   wider_pieces   material kept as context for a bigger piece, grouped by the theme he named (unnamed last): the
//                  gathered context for that piece when it is proposed
//   tracked        topics or patterns he wants watched across weeks
//   briefs         his angle on how a piece should be told: carried into the pitch when that idea is offered
//   not_for_us     subjects he dropped: never offered again
//
// `said` is his words verbatim. `use_origin` says who named the use: his words ('krish'), a rule on his verdict or
// route ('rule'), or a model's guess ('model_guess', never quoted as his reading). Read-only, no model, and the judges
// never read it (scripts/check-judges.ts). A table not there yet, or a read that fails, is said in `empty` and the
// Sunday run carries on: the cues are help, never a gate.

type Row = Record<string, any>

export const CUE_USES = ['future_piece', 'wider_piece_context', 'track_over_time', 'brief', 'not_for_us'] as const
export const CUE_COLS = 'id,source,source_ref,subject_ref,subject,said,said_at,use,theme,use_origin,status'

export interface CueItem {
  id: string
  /** The content_ideas or inspiration_items id the words are about. */
  subject_ref: string
  subject: string
  /** His words, verbatim. */
  said: string
  said_at: string | null
  source: string
  use_origin: string
}

export interface CuesBlock {
  future_pieces: CueItem[]
  wider_pieces: Array<{ theme: string | null; context: CueItem[] }>
  tracked: CueItem[]
  briefs: CueItem[]
  not_for_us: CueItem[]
  counts: Record<string, number>
}

const item = (r: Row): CueItem => ({
  id: String(r.id), subject_ref: String(r.subject_ref || ''), subject: String(r.subject || ''), said: String(r.said || ''),
  said_at: r.said_at ? String(r.said_at) : null, source: String(r.source || ''), use_origin: String(r.use_origin || ''),
})

const oldestFirst = (a: Row, b: Row) => String(a.said_at || '').localeCompare(String(b.said_at || '')) || String(a.id).localeCompare(String(b.id))

/** The open cues, grouped for Sunday. Each group runs oldest first: what he asked for longest ago leads. */
export function buildCues(rows: Row[]): CuesBlock {
  const open = rows.filter(r => r && r.status === 'open' && String(r.said || '').trim() && (CUE_USES as readonly string[]).includes(r.use))
    .sort(oldestFirst)
  const of = (use: string) => open.filter(r => r.use === use).map(item)
  // One group per theme, matched without case; the first spelling he used names it. Named themes with the most
  // context first, then the cues kept for a bigger piece he has not named yet.
  const themes = new Map<string, { theme: string | null; context: CueItem[] }>()
  for (const r of open.filter(x => x.use === 'wider_piece_context')) {
    const theme = typeof r.theme === 'string' && r.theme.trim() ? r.theme.trim() : null
    const key = theme ? theme.toLowerCase() : ''
    if (!themes.has(key)) themes.set(key, { theme, context: [] })
    themes.get(key)!.context.push(item(r))
  }
  const wider = [...themes.values()].sort((a, b) =>
    Number(a.theme === null) - Number(b.theme === null) || b.context.length - a.context.length || String(a.theme).localeCompare(String(b.theme)))
  const block: CuesBlock = {
    future_pieces: of('future_piece'), wider_pieces: wider, tracked: of('track_over_time'), briefs: of('brief'),
    not_for_us: of('not_for_us'), counts: {},
  }
  block.counts = {
    future_pieces: block.future_pieces.length, wider_pieces: open.filter(r => r.use === 'wider_piece_context').length,
    wider_themes: wider.filter(w => w.theme !== null).length, tracked: block.tracked.length, briefs: block.briefs.length,
    not_for_us: block.not_for_us.length,
  }
  return block
}

/** Whether a read failed because the table is not there yet (its migration waits on Krish's yes). */
export function tableMissing(error: { message?: string; code?: string } | null): boolean {
  if (!error) return false
  return error.code === 'PGRST205' || error.code === '42P01'
    || (/feedback_cues/.test(String(error.message || '')) && /does not exist|could not find/i.test(String(error.message || '')))
}

/** The cues block and, when there is nothing to show, why: never a failure of the gather. */
export function cuesFrom(res: { data: Row[] | null; error: { message?: string; code?: string } | null }): { cues: CuesBlock; empty: { source: 'cues'; why: string } | null } {
  if (res.error) {
    const why = tableMissing(res.error)
      ? 'feedback_cues is not there yet: apply content-engine migration 20261111090000_feedback_cues.sql (Krish\'s yes), then the Inspiration House daily run files his cues'
      : `feedback_cues could not be read (${String(res.error.message || 'unknown error').slice(0, 160)}); his cues are missing from this gather`
    return { cues: buildCues([]), empty: { source: 'cues', why } }
  }
  const cues = buildCues(res.data || [])
  const total = Object.entries(cues.counts).filter(([k]) => k !== 'wider_themes').reduce((n, [, v]) => n + v, 0)
  return { cues, empty: total ? null : { source: 'cues', why: 'no open feedback cues: the Inspiration House has filed none yet, or every one is used or retired' } }
}
