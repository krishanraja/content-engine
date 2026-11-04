// The inspiration board as ve reads it: a card by its id, the cards to offer for a role, and every cut a card shaped.
//
// Krish, 2026-11-03: "I'm also still a bit disappointed with how poorly the inspiration board is used right now."
// A spec names each card by its inspiration_items.id (brand.references[].id; the file stem stays as `card`, its
// label). GET /api/inspiration/cards says whether each named card can hold a cut; GET /api/inspiration/candidates
// offers the cards for a role; POST /api/inspiration/uses records which cut a card shaped and the Critic's score
// against it (card_uses, supabase/migrations/20261122090000_inspiration_teaches_and_card_uses.sql).
//
// Pure functions here; the routes beside this file read and write. Nothing here picks for Krish: a candidate is an
// offer the session confirms, and a card's `teaches` is his word only when teaches_source is 'krish'.

export const ROLES = ['look', 'motion', 'captions', 'hook', 'pacing', 'layout'] as const
export type Role = typeof ROLES[number]
export const CARD_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const MAX_IDS = 20
export const MAX_USES = 40
/** The kinds a cut can be held to: a clip or a still. A feed, a corpus, an idea or a document teaches no cut. */
export const CUT_KINDS = new Set(['video', 'image'])

/** The columns every reader needs, before and after the teaches migration. */
export const BASE_COLS = 'id,name,drive_file_id,lane,kind,dismissed_at,why_here,why_like,why_like_source,would_do,route,routes,picked_likes,answered_at,facets,drive_created_at'
export const CARD_COLS = `${BASE_COLS},teaches,teaches_source`

type Row = Record<string, any>

export interface CardUse { piece_id: string | null; spec_path: string; cut: string; role: string; critic_score: number | null; published: boolean; krish_verdict: string | null; created_at?: string }

/** The board's own name for a card: its file stem (instagram_DePHDr_jRed.mp4 is instagram_DePHDr_jRed). */
export function label(name: unknown): string {
  const s = typeof name === 'string' ? name.trim() : ''
  return s.replace(/\.[A-Za-z0-9]{1,5}$/, '')
}

/** Why a card cannot hold a cut, or null when it can. */
export function refusal(row: Row): 'not_production_lane' | 'dismissed' | 'not_a_clip' | null {
  if (row.dismissed_at) return 'dismissed'
  if (row.lane !== 'production') return 'not_production_lane'
  if (row.kind && !CUT_KINDS.has(row.kind)) return 'not_a_clip'
  return null
}

/** His kept or liked signal, strongest first: 2 he sent it to study its style, 1 he said or tapped why he likes it. */
export function kept(row: Row): number {
  const routes: string[] = Array.isArray(row.routes) ? row.routes : []
  if (!row.answered_at) return 0
  if (row.route === 'study_style' || routes.includes('study_style')) return 2
  if (row.why_like || (Array.isArray(row.picked_likes) && row.picked_likes.length)) return 1
  return 0
}

export function teaches(row: Row): string[] {
  return Array.isArray(row.teaches) ? row.teaches.filter((t: unknown) => typeof t === 'string') : []
}

export function cardView(row: Row, uses: CardUse[]) {
  return {
    id: String(row.id),
    label: label(row.name),
    name: row.name ?? null,
    drive_id: row.drive_file_id ?? null,
    lane: row.lane ?? null,
    kind: row.kind ?? null,
    dismissed: Boolean(row.dismissed_at),
    problem: refusal(row),
    answers: {
      why_here: row.why_here ?? null,
      why_like: row.why_like ?? null,
      why_like_source: row.why_like_source ?? null,
      would_do: row.would_do ?? null,
      routes: Array.isArray(row.routes) && row.routes.length ? row.routes : row.route ? [row.route] : [],
      answered_at: row.answered_at ?? null,
    },
    kept: kept(row),
    teaches: teaches(row),
    teaches_source: row.teaches_source ?? null,
    uses: uses.map(u => ({ piece_id: u.piece_id, spec_path: u.spec_path, cut: u.cut, role: u.role, critic_score: u.critic_score, published: u.published, krish_verdict: u.krish_verdict })),
  }
}

/** The ids asked for, lower case, in order, without repeats; `bad` names any that are not a card id. */
export function parseIds(raw: unknown): { ids: string[]; bad: string[] } {
  const text = Array.isArray(raw) ? raw.join(',') : typeof raw === 'string' ? raw : ''
  const all = text.split(',').map(s => s.trim()).filter(Boolean)
  const ids: string[] = []
  const bad: string[] = []
  for (const id of all) {
    if (!CARD_ID.test(id)) bad.push(id.slice(0, 60))
    else if (!ids.includes(id.toLowerCase())) ids.push(id.toLowerCase())
  }
  return { ids, bad }
}

export function usesByCard(rows: Row[]): Map<string, CardUse[]> {
  const out = new Map<string, CardUse[]>()
  for (const r of rows) {
    const key = String(r.card_id).toLowerCase()
    out.set(key, [...(out.get(key) || []), r as CardUse])
  }
  return out
}

function formatOf(row: Row): string {
  const f = row.facets || {}
  return String(f.format ?? f.media ?? '').toLowerCase()
}

/** The cards to offer for a role, best first: a card that teaches the role (his word before the engine's guess), then
 *  his kept or liked signal, then a card in the asked format, then one never used, then the newest. Cards that cannot
 *  hold a cut are left out. Deterministic: the same rows give the same order. */
export function rankCandidates(rows: Row[], uses: Map<string, CardUse[]>, opts: { role: Role; format?: string; limit: number }) {
  const format = (opts.format || '').toLowerCase()
  const scored = rows.filter(r => !refusal(r)).map(r => {
    const t = teaches(r)
    const teach = t.includes(opts.role) ? (r.teaches_source === 'krish' ? 2 : 1) : 0
    const used = (uses.get(String(r.id).toLowerCase()) || []).length
    return { r, teach, kept: kept(r), fits: format && formatOf(r) === format ? 1 : 0, used, at: String(r.drive_created_at || '') }
  })
  scored.sort((a, b) => b.teach - a.teach || b.kept - a.kept || b.fits - a.fits || (a.used === 0 ? 0 : 1) - (b.used === 0 ? 0 : 1)
    || b.at.localeCompare(a.at) || String(a.r.id).localeCompare(String(b.r.id)))
  return scored.slice(0, opts.limit).map(s => ({
    ...cardView(s.r, uses.get(String(s.r.id).toLowerCase()) || []),
    offered_for: opts.role,
    why: [
      s.teach === 2 ? `Krish says it teaches ${opts.role}` : s.teach === 1 ? `the engine guesses it teaches ${opts.role}` : `nothing says it teaches ${opts.role} yet`,
      s.kept === 2 ? 'he sent it to study its style' : s.kept === 1 ? 'he said why he likes it' : 'he has not said he likes it',
      s.used ? `used ${s.used} time(s)` : 'never used',
    ],
  }))
}

export interface UseInput { card_id: string; piece_id: string | null; spec_path: string; cut: string; role: Role; critic_score: number | null }

/** POST /api/inspiration/uses: {uses: [{card_id, piece_id?, spec_path, cut, role, critic_score?}]}. */
export function parseUses(body: unknown): { uses: UseInput[]; problems: string[] } {
  const problems: string[] = []
  const list = body && typeof body === 'object' && !Array.isArray(body) ? (body as Row).uses : undefined
  if (!Array.isArray(list) || !list.length) return { uses: [], problems: ['uses is a list of {card_id, piece_id, spec_path, cut, role, critic_score}'] }
  if (list.length > MAX_USES) return { uses: [], problems: [`at most ${MAX_USES} uses in one write`] }
  const uses: UseInput[] = []
  list.forEach((u: unknown, i: number) => {
    const at = `uses[${i}]`
    if (!u || typeof u !== 'object') { problems.push(`${at} must be an object`); return }
    const v = u as Row
    if (typeof v.card_id !== 'string' || !CARD_ID.test(v.card_id)) problems.push(`${at}.card_id is the card's inspiration_items.id (a uuid)`)
    if (v.piece_id != null && (typeof v.piece_id !== 'string' || !CARD_ID.test(v.piece_id))) problems.push(`${at}.piece_id is the piece's content_ideas.id (a uuid) or null`)
    if (typeof v.spec_path !== 'string' || !v.spec_path.trim() || v.spec_path.length > 300) problems.push(`${at}.spec_path is the spec's repository path`)
    if (v.cut !== undefined && (typeof v.cut !== 'string' || v.cut.length > 40)) problems.push(`${at}.cut is the cut's id`)
    if (!ROLES.includes(v.role)) problems.push(`${at}.role is one of ${ROLES.join(', ')}`)
    const score = v.critic_score
    if (score != null && (typeof score !== 'number' || !Number.isFinite(score) || score < 0 || score > 10)) problems.push(`${at}.critic_score is 0 to 10, or null`)
    if (problems.some(p => p.startsWith(at))) return
    uses.push({ card_id: v.card_id.toLowerCase(), piece_id: v.piece_id ? String(v.piece_id).toLowerCase() : null, spec_path: v.spec_path.trim(), cut: typeof v.cut === 'string' ? v.cut : '', role: v.role, critic_score: score ?? null })
  })
  return { uses, problems }
}

/** Whether a read failed only because the teaches migration has not run yet. */
export function migrationPending(error: { message?: string } | null | undefined): boolean {
  return Boolean(error && /teaches|card_uses/.test(String(error.message || '')))
}

/** Read cards with the teaches columns, or without them before the migration runs. */
export async function readCards(db: any, build: (q: any) => any): Promise<{ rows: Row[]; pending: boolean; error?: string }> {
  const first = await build(db.from('inspiration_items').select(CARD_COLS))
  if (!first.error) return { rows: first.data || [], pending: false }
  if (!migrationPending(first.error)) return { rows: [], pending: false, error: first.error.message }
  const second = await build(db.from('inspiration_items').select(BASE_COLS))
  if (second.error) return { rows: [], pending: true, error: second.error.message }
  return { rows: second.data || [], pending: true }
}

/** The uses of these cards; none (and said) before the migration runs. */
export async function readUses(db: any, ids: string[]): Promise<{ uses: Map<string, CardUse[]>; pending: boolean; error?: string }> {
  if (!ids.length) return { uses: new Map(), pending: false }
  const read = await db.from('card_uses').select('card_id,piece_id,spec_path,cut,role,critic_score,published,krish_verdict,created_at').in('card_id', ids)
  if (read.error) return migrationPending(read.error) || /relation|does not exist/.test(String(read.error.message)) ? { uses: new Map(), pending: true } : { uses: new Map(), pending: false, error: read.error.message }
  return { uses: usesByCard(read.data || []), pending: false }
}

/** The making record got a posted channel: every use of a card on this piece is now published. A failure changes
 *  nothing the making write did; it is said in the answer. */
export async function markPublished(db: any, pieceId: string, now: string): Promise<string | null> {
  try {
    const out = await db.from('card_uses').update({ published: true, updated_at: now }).eq('piece_id', pieceId).eq('published', false)
    return out?.error ? String(out.error.message || 'card_uses not written') : null
  } catch (e) {
    return (e as Error).message
  }
}
