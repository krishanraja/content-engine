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
//
// The engine's read of a card (inspirationhouse tag-v4, krishanraja/inspirationhouse #54): facets.style holds the ids
// of this repository's own style vocabulary the card points to (captions, motion, transitions, camera, energy, script
// and production formats, series, teaches), and facets.style.grounded_in names which of his own fields on the card
// (why_here, why_like, would_do) the read was built on. A read grounded in his words is his steer, not a guess (Krish,
// 2026-11-17: "If I put actual feedback in the inspiration board as to why I like something, that is not really a guess
// is it?"); a bare read of the file is still a guess. facets.collection marks a file he filed in a subfolder of an Inspo
// folder (a reference set, such as his thumbnail study): offered first for a thumbnail, after loose cards otherwise.

export const ROLES = ['look', 'motion', 'captions', 'hook', 'pacing', 'layout', 'thumbnail'] as const
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

/** His own fields on a card a read can be grounded in. */
export const GROUND_FIELDS = ['why_here', 'why_like', 'would_do'] as const
const STYLE_LISTS = ['captions', 'motion', 'transitions', 'camera', 'script_formats', 'production_formats', 'teaches'] as const
const ID = /^[a-z0-9][a-z0-9_.:-]{0,79}$/i

const ids = (v: unknown, max = 12): string[] =>
  (Array.isArray(v) ? v : []).filter((x): x is string => typeof x === 'string' && ID.test(x)).slice(0, max)

/** Which of his own fields the engine's read was built on (facets.style.grounded_in, else facets.grounded_in), in a
 *  fixed order; empty for a bare read of the file or a card the engine has not read. */
export function groundedIn(row: Row): string[] {
  const f = row.facets || {}
  const raw = Array.isArray(f.style?.grounded_in) ? f.style.grounded_in : Array.isArray(f.grounded_in) ? f.grounded_in : []
  return GROUND_FIELDS.filter(g => raw.includes(g))
}

export interface StyleRead {
  origin: 'engine_read'
  /** True when the read was built on his own words on the card (grounded_in not empty): his steer, not a guess. */
  grounded: boolean
  grounded_in: string[]
  captions: string[]; motion: string[]; transitions: string[]; camera: string[]
  energy: string | null
  script_formats: string[]; production_formats: string[]
  series: string | null
  teaches: string[]
}

/** The engine's read of a card in this repository's style vocabulary (facets.style), or null when it has none. Ids are
 *  kept as the tagger wrote them (it checks them against config/caption-themes.json and config/style-references.json);
 *  anything that is not an id is dropped. */
export function styleRead(row: Row): StyleRead | null {
  const s = row.facets?.style
  if (!s || typeof s !== 'object' || Array.isArray(s) || s.origin !== 'engine_read') return null
  const g = groundedIn(row)
  const lists = Object.fromEntries(STYLE_LISTS.map(k => [k, ids(s[k])])) as Record<typeof STYLE_LISTS[number], string[]>
  const one = (v: unknown) => (typeof v === 'string' && ID.test(v) ? v : null)
  return { origin: 'engine_read', grounded: g.length > 0, grounded_in: g, ...lists, energy: one(s.energy), series: one(s.series) }
}

/** The reference set a card was filed in (facets.collection: {name, path}), or null for a loose card. */
export function collectionOf(row: Row): { name: string; path: string | null } | null {
  const c = row.facets?.collection
  if (!c || typeof c !== 'object' || typeof c.name !== 'string' || !c.name.trim()) return null
  return { name: c.name.trim().slice(0, 200), path: typeof c.path === 'string' ? c.path.slice(0, 400) : null }
}

/** How strongly a card teaches a role: 3 Krish said so, 2 the engine's read grounded in his words says so, 1 a bare
 *  engine guess says so, 0 nothing does. `thumbnail` may live only in the read (facets.style.teaches) until the
 *  teaches migration that allows it runs. */
export function teachStrength(row: Row, role: string): 0 | 1 | 2 | 3 {
  const read = styleRead(row)
  const inColumn = teaches(row).includes(role)
  if (inColumn && row.teaches_source === 'krish') return 3
  if (!inColumn && !read?.teaches.includes(role)) return 0
  return read?.grounded ? 2 : 1
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
    style: styleRead(row),
    grounded_in: groundedIn(row),
    collection: collectionOf(row),
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

/** One of his open ticks asking for a card's style to be used within a week (control-center inspiration_actions, kind
 *  copy_style; Ruling, Krish, 2026-11-12). */
export interface StyleTick { action_id: string; due_at: string; words: string | null }

/** The roles a ticked card is offered for: the ones it teaches, else the three every cut names (look, motion, captions;
 *  failure F26). */
export function tickRoles(row: Row): Role[] {
  const t = teaches(row).filter((x): x is Role => (ROLES as readonly string[]).includes(x))
  return t.length ? t : ['look', 'motion', 'captions']
}

/** The cards to offer for a role, best first: a card he ticked as a style to use within a week (the soonest due first;
 *  an instruction, not a suggestion), then a card that teaches the role (his word, then the engine's read grounded in
 *  his words, then a bare guess), then for a thumbnail a card from a reference set (his thumbnail study) and for any
 *  other role a loose card before a reference set's, then his kept or liked signal, then a card in the asked format,
 *  then one never used, then the newest. Cards that cannot hold a cut are left out. Deterministic: the same rows give
 *  the same order. */
export function rankCandidates(rows: Row[], uses: Map<string, CardUse[]>, opts: { role: Role; format?: string; limit: number },
  ticks: ReadonlyMap<string, StyleTick> = new Map()) {
  const format = (opts.format || '').toLowerCase()
  const scored = rows.filter(r => !refusal(r)).map(r => {
    const teach = teachStrength(r, opts.role)
    const inSet = collectionOf(r) ? 1 : 0
    const place = opts.role === 'thumbnail' ? inSet : 1 - inSet
    const used = (uses.get(String(r.id).toLowerCase()) || []).length
    const tick = ticks.get(String(r.id).toLowerCase())
    const told = tick && tickRoles(r).includes(opts.role) ? tick : null
    return { r, told, teach, place, kept: kept(r), fits: format && formatOf(r) === format ? 1 : 0, used, at: String(r.drive_created_at || '') }
  })
  scored.sort((a, b) => Number(!!b.told) - Number(!!a.told) || (a.told && b.told ? a.told.due_at.localeCompare(b.told.due_at) : 0)
    || b.teach - a.teach || b.place - a.place || b.kept - a.kept || b.fits - a.fits || (a.used === 0 ? 0 : 1) - (b.used === 0 ? 0 : 1)
    || b.at.localeCompare(a.at) || String(a.r.id).localeCompare(String(b.r.id)))
  return scored.slice(0, opts.limit).map(s => ({
    ...cardView(s.r, uses.get(String(s.r.id).toLowerCase()) || []),
    offered_for: opts.role,
    ...(s.told ? { instruction: { action_id: s.told.action_id, due_at: s.told.due_at, words: s.told.words } } : {}),
    why: [
      ...(s.told ? [`Krish ticked it: use this style in a made asset by ${s.told.due_at.slice(0, 10)}, an instruction, not a suggestion`] : []),
      s.teach === 3 ? `Krish says it teaches ${opts.role}`
        : s.teach === 2 ? `the engine read it from his own words (${groundedIn(s.r).join(', ')}): it teaches ${opts.role}`
          : s.teach === 1 ? `the engine guesses it teaches ${opts.role}` : `nothing says it teaches ${opts.role} yet`,
      ...(collectionOf(s.r) ? [`from his reference set "${collectionOf(s.r)!.name}"`] : []),
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

/** How many cards each read of the candidate window takes. */
export const READ_LIMIT = 500
/** A card he answered or typed words on. */
const WORDED = 'why_here.not.is.null,why_like.not.is.null,would_do.not.is.null,answered_at.not.is.null'

/** The production cards the candidates are ranked from, read by value as well as by age: the newest READ_LIMIT, then
 *  every card he answered or wrote on, every card with a teaches, every card the engine read (facets.style), and for a
 *  thumbnail his reference sets (facets.collection), merged once each. A bulk drop of images can fill the newest window,
 *  and must never push out a card with his words or a read on it. Before the teaches migration the teaches read is
 *  skipped, as the rest of this file does. */
export async function readCandidateWindow(db: any, role: Role): Promise<{ rows: Row[]; pending: boolean; error?: string }> {
  const live = (q: any) => q.eq('lane', 'production').is('dismissed_at', null)
  const newest = (q: any) => q.order('drive_created_at', { ascending: false }).limit(READ_LIMIT)
  const first = await readCards(db, q => newest(live(q)))
  if (first.error) return first
  const reads = [
    readCards(db, q => newest(live(q).or(WORDED))),
    readCards(db, q => newest(live(q).not('facets->style', 'is', null))),
    ...(first.pending ? [] : [readCards(db, q => newest(live(q).not('teaches_source', 'is', null)))]),
    ...(role === 'thumbnail' ? [readCards(db, q => newest(live(q).not('facets->collection', 'is', null)))] : []),
  ]
  const more = await Promise.all(reads)
  const failed = more.find(m => m.error)
  if (failed) return { rows: [], pending: first.pending, error: failed.error }
  const seen = new Set<string>()
  const rows: Row[] = []
  for (const r of [first, ...more].flatMap(m => m.rows)) {
    const id = String(r.id).toLowerCase()
    if (!seen.has(id)) { seen.add(id); rows.push(r) }
  }
  return { rows, pending: first.pending || more.some(m => m.pending) }
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
