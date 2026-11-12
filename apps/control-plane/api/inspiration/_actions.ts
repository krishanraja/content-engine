// His ticks on Inspiration cards, as this engine reads and answers them (docs/PUBLISH_BOARDS.md, "His instruction:
// a ticked inspiration card").
//
// Ruling (Krish, 2026-11-12): an inspiration card he ticks is an instruction that jumps the queue: Content means make
// it into a piece now, Production means use the style within a week. The tick is Control Centre's, one row of
// inspiration_actions (control-center migration 20261128093000), set only by his press there. This engine never
// creates, drops or closes a tick. It does two things with one:
//
//   make_piece  the inspiration-piece job (.github/workflows/inspiration-piece.yml) reads the action, its card, the
//               card's reading and his words (GET /api/inspiration/actions?id=), writes one idea onto the week's ideas
//               board through the normal idea path, and reports its own state here (POST): running, then drafted with
//               the idea's id, or failed with the reason in words. Only his Approve puts the idea on a publish board
//               (the ideas gate); nothing here writes scheduled_for.
//   copy_style  the open ticks come first among the cards ve init offers a cut (GET /api/inspiration/candidates), so
//               the next cut names the card in brand.references and ve verdict records the use (card_uses), which
//               closes the tick in Control Centre.
//
// Pure where it can be, so the route and its tests agree.

export const ACTION_COLS = 'id,item_id,watch_request_id,kind,words,due_at,state,piece_id,job_state,job_error,job_run_url,job_at,created_at'
export const LIVE = ['open', 'drafted', 'in_use'] as const
export const JOB_STATES = ['running', 'drafted', 'failed'] as const
export type JobReport = (typeof JOB_STATES)[number]
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RUN_URL = /^https:\/\/github\.com\/krishanraja\/content-engine\/actions\/runs\/\d+(?:\/attempts\/\d+)?$/
/** The longest reading a job takes in one read; the rest stays in the engine. */
export const READING_MAX = 20000

export interface JobInput { id: string; job_state: JobReport; piece_id: string | null; error: string | null; run_url: string | null }

/** The job's report on its own action, checked: its state, the idea when drafted, the reason in words when failed. */
export function parseJobReport(body: unknown): { report: JobInput | null; problems: string[] } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const problems: string[] = []
  const id = typeof b.id === 'string' && UUID.test(b.id) ? b.id.toLowerCase() : null
  if (!id) problems.push('id is the inspiration action id (a uuid)')
  const state = typeof b.job_state === 'string' && (JOB_STATES as readonly string[]).includes(b.job_state) ? b.job_state as JobReport : null
  if (!state) problems.push(`job_state is one of ${JOB_STATES.join(', ')}`)
  const piece = typeof b.piece_id === 'string' && UUID.test(b.piece_id) ? b.piece_id.toLowerCase() : null
  if (state === 'drafted' && !piece) problems.push('a drafted job names the idea it wrote (piece_id)')
  if (b.piece_id !== undefined && b.piece_id !== null && !piece) problems.push('piece_id is a content_ideas id (a uuid)')
  const error = typeof b.error === 'string' && b.error.trim() ? b.error.trim().replace(/\s+/g, ' ').slice(0, 300) : null
  if (state === 'failed' && !error) problems.push('a failed job says why, in words (error)')
  const run = typeof b.run_url === 'string' && b.run_url ? b.run_url : null
  if (run && !RUN_URL.test(run)) problems.push('run_url is this repository\'s Actions run')
  return problems.length ? { report: null, problems } : { report: { id: id!, job_state: state!, piece_id: piece, error, run_url: run }, problems }
}

/** What the job may write onto an action, or why not: it is a make_piece tick, still live, and a drafted one names its
 *  idea once (a second drafted with another idea is refused). It never moves state past drafted, and never drops. */
export function jobPatch(action: Record<string, any>, r: JobInput, now: string): { patch: Record<string, unknown> } | { refused: string } {
  if (action.kind !== 'make_piece') return { refused: 'not_a_piece_tick' }
  if (!(LIVE as readonly string[]).includes(action.state)) return { refused: `tick_${action.state}` }
  if (action.state !== 'open' && r.job_state !== 'drafted') return { refused: 'already_drafted' }
  if (action.piece_id && r.piece_id && String(action.piece_id).toLowerCase() !== r.piece_id) return { refused: 'drafted_another_idea' }
  const base = { job_state: r.job_state, job_at: now, updated_at: now, ...(r.run_url ? { job_run_url: r.run_url } : {}) }
  if (r.job_state === 'failed') return { patch: { ...base, job_error: r.error } }
  if (r.job_state === 'running') return { patch: { ...base, job_error: null } }
  return { patch: { ...base, job_error: null, piece_id: r.piece_id, ...(action.state === 'open' ? { state: 'drafted' } : {}) } }
}

/** A card's own words, his first: why it's here and what he typed he likes; a tapped guess is never his words. */
export function cardWords(card: Record<string, any> | null): string[] {
  if (!card) return []
  return [card.why_here, card.why_like_source === 'typed' ? card.why_like : null, card.note_for_claude]
    .filter((w): w is string => typeof w === 'string' && w.trim().length > 0).map(w => w.trim())
}

/** The brief the job reads: the tick, his words, the card, its reading and the link it came from. */
export function brief(action: Record<string, any>, card: Record<string, any> | null, request: Record<string, any> | null, reading: Record<string, any> | null) {
  return {
    action: { id: action.id, kind: action.kind, state: action.state, due_at: action.due_at, job_state: action.job_state ?? null, piece_id: action.piece_id ?? null },
    his_words: [action.words, ...cardWords(card)].filter((w): w is string => typeof w === 'string' && w.trim().length > 0),
    card: card ? {
      id: card.id, name: card.name ?? null, lane: card.lane ?? null, kind: card.kind ?? null, drive_file_id: card.drive_file_id ?? null,
      drive_url: card.drive_file_id ? `https://drive.google.com/file/d/${encodeURIComponent(card.drive_file_id)}/view` : null,
      read_as: card.read_as ?? null, link: card.facets?.link ?? null, transcript: typeof card.transcript === 'string' ? card.transcript.slice(0, READING_MAX) : null,
    } : null,
    request: request ? { id: request.id, url: request.url ?? null, platform: request.platform ?? null, status: request.status ?? null } : null,
    reading: reading && typeof reading.read_md === 'string' ? {
      source_url: reading.source_url ?? null, platform: reading.platform ?? null, read_md: reading.read_md.slice(0, READING_MAX),
      cut: reading.read_md.length > READING_MAX,
    } : null,
    // Whether it can be made now: a card or a reading to read. Without either the link is still being fetched.
    ready: Boolean(card || (reading && typeof reading.read_md === 'string')),
  }
}
