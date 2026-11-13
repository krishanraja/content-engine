import type { SupabaseClient } from '@supabase/supabase-js'
import { MAX_SIGN_OFF_PRESSES, SIGN_OFF_ID, SIGN_OFF_WORDS_MAX, canonical, digest, validBody } from './_contracts.js'
import { ENGINE_REPO } from './_run.js'

// The three video sign-offs, one review card each on his Publish Board (view contract 1.11.0; docs/PUBLISH_BOARDS.md,
// "To review: the video sign-offs"). Ruling (Krish, 2026-11-12): the three video sign-offs are one review card each on
// his board, with samples, and only his presses write the configs. His words: "One review card each: each goes on your
// Publish Board as a card with samples to look at and listen to, plus Approve or Not this. About 10 minutes in total."
//
// - The cards and their samples are config/ve/sign-offs.json on main (scripts/velib/signoffs.py makes and records
//   them): each sample a file in his Drive with the sha256 of its bytes. Sound effects and golden frames take a press
//   per sample; Gate 2 takes one press for the card, bound to the canonical map of its four stills' sha256s.
// - His press is POST /api/board/<Monday>/sign-off with { card, item, verdict: approve | not_this, sha256, words? }:
//   his login only (403 his_press), on a sample that is on the card now and whose bytes his press names (409
//   sample_changed when the card changed under an open page). It is kept append only on picks/signoff-<card> of the
//   week he pressed on (board_documents through board_save as Krish, so board_history keeps every revision and the
//   week's change signal moves). His words are optional on both presses.
// - It writes no config itself. After the press the board starts .github/workflows/signoff-apply.yml (a
//   repository_dispatch, _run.ts), which reads every press (GET /api/board/sign-offs, the engine key), fetches each
//   approved sample by its Drive id (GET /api/board/sign-offs?file=<id>), checks its sha256 and writes
//   config/sfx-approved.json, config/ve/golden-frames.json and config/ve/design-lock.json in a pull request that merges
//   itself on green CI. The cards then read "Written to the engine" from those files on main.
// - The view (sign_offs, on every week) says what he already decided on each sample and whether the engine holds it.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const SHA = /^[a-f0-9]{64}$/
const DRIVE_ID = /^[A-Za-z0-9_-]{10,}$/
export const SIGN_OFF_OP = 'sign-off'
export const SIGN_OFF_CARDS = ['sfx', 'golden', 'gate2'] as const
export type SignOffCardId = typeof SIGN_OFF_CARDS[number]
export { SIGN_OFF_ID }
export const CARD_ITEM = '*'
export const GATE2_LOCK = 'face-with-proof@16:9'
export { MAX_SIGN_OFF_PRESSES, SIGN_OFF_WORDS_MAX }
export type SignOffSaid = 'approve' | 'not_this'

export interface SignOffSample {
  id: string; title: string; kind: 'audio' | 'image' | 'video'; mime?: string; sha256: string
  drive: { file_id: string; url: string }; [k: string]: unknown
}
export interface SignOffManifestCard {
  id: SignOffCardId; title: string; ask: string; why?: string; note?: string; writes?: string; presses: 'each' | 'card'
  want?: { min: number; max: number }; lock?: string; from?: unknown; items: SignOffSample[]
}
export interface SignOffManifest { schema: string; cards: SignOffManifestCard[] }
/** One press of his, as kept on picks/signoff-<card>. */
export interface SignOffPress { card: SignOffCardId; item: string; verdict: SignOffSaid; sha256: string; words: string | null; at: string; by: 'Krish'; week?: string }
/** The configs on main the cards read back, to say what the engine holds. */
export interface SignOffConfigs { sfx: Body | null; golden: Body | null; lock: Body | null }

/** A press on a sample, in the shape of the view's press actions: POST /api/board/<Monday>/sign-off with the body. */
export interface SignOffAction {
  kind: 'press'; label: string; op: typeof SIGN_OFF_OP; body: Body
  words?: { path: string; ask: string; required: boolean }; stamp: string[]; done: string
}
export interface SignOffAnswer { said: SignOffSaid; words: string | null; at: string }
export interface SignOffItemView {
  id: string; title: string; kind: 'audio' | 'image' | 'video'; mime: string | null
  /** Where the board plays or shows it: the engine serves the file from his Drive (GET /api/board/sign-offs?file=). */
  src: string
  drive: { file_id: string; url: string }
  sha256: string
  /** What it is, in a few plain lines (the slot it is for, the piece and time, the beat). */
  lines: string[]
  /** His latest press on these exact bytes, or null. */
  verdict: SignOffAnswer | null
  /** Whether the engine's config holds his answer on it (on main). */
  written: boolean
  presses: { approve: SignOffAction; not_this: SignOffAction } | null
}
export interface SignOffCardView {
  id: SignOffCardId; title: string; ask: string; why: string | null; note: string | null; writes: string | null
  presses_mode: 'each' | 'card'
  want: { min: number; max: number } | null
  counts: { approved: number; declined: number; waiting: number; total: number }
  state: 'waiting' | 'answered' | 'written'
  /** One line: where the card stands, in his words. */
  line: string
  items: SignOffItemView[]
  /** Gate 2: his one press for the card and his answer, the card's sha256 (the four stills'). */
  verdict: SignOffAnswer | null
  presses: { approve: SignOffAction; not_this: SignOffAction } | null
  sha256: string | null
}
export interface SignOffsView { waiting: number; cards: SignOffCardView[] }

// ---------------------------------------------------------------- reading

/** The canonical map a card-level press binds (velib/signoffs.card_sha256): each item's id to its sha256. */
export function cardSha256(card: Pick<SignOffManifestCard, 'items'>): string {
  return digest(canonical(Object.fromEntries((card.items || []).map(i => [i.id, i.sha256]))))
}

/** The manifest, checked to the shape the board relies on; null when it is not one. */
export function parseManifest(text: string | null): SignOffManifest | null {
  if (!text) return null
  let doc: unknown
  try { doc = JSON.parse(text) } catch { return null }
  if (!isObj(doc) || doc.schema !== 've-sign-offs/1' || !Array.isArray(doc.cards)) return null
  const cards: SignOffManifestCard[] = []
  for (const c of doc.cards) {
    if (!isObj(c) || !(SIGN_OFF_CARDS as readonly unknown[]).includes(c.id) || typeof c.title !== 'string' || typeof c.ask !== 'string') return null
    if (c.presses !== 'each' && c.presses !== 'card') return null
    const items = (Array.isArray(c.items) ? c.items : []).filter(isObj).filter(i => typeof i.id === 'string' && typeof i.title === 'string'
      && ['audio', 'image', 'video'].includes(String(i.kind)) && SHA.test(String(i.sha256)) && isObj(i.drive)
      && DRIVE_ID.test(String(i.drive.file_id)) && String(i.drive.url || '').startsWith('https://drive.google.com/')) as unknown as SignOffSample[]
    const want = isObj(c.want) && Number.isInteger(c.want.min) && Number.isInteger(c.want.max) ? { min: Number(c.want.min), max: Number(c.want.max) } : undefined
    cards.push({ id: c.id as SignOffCardId, title: c.title, ask: c.ask, why: typeof c.why === 'string' ? c.why : undefined,
      note: typeof c.note === 'string' ? c.note : undefined, writes: typeof c.writes === 'string' ? c.writes : undefined,
      presses: c.presses, want, lock: typeof c.lock === 'string' ? c.lock : undefined, from: c.from, items })
  }
  return { schema: String(doc.schema), cards }
}

/** Every press of his kept on the sign-off cards, oldest first (each week's picks/signoff-<card>, his login only). */
export function pressesOf(rows: Array<{ week?: string; doc_id: string; body: unknown; updated_by: string }>): SignOffPress[] {
  const out: SignOffPress[] = []
  for (const r of rows) {
    if (r.updated_by !== 'Krish' || !SIGN_OFF_ID.test(r.doc_id) || !isObj(r.body) || !Array.isArray(r.body.presses)) continue
    for (const p of r.body.presses) {
      if (!isObj(p) || !(SIGN_OFF_CARDS as readonly unknown[]).includes(p.card) || (p.verdict !== 'approve' && p.verdict !== 'not_this')
        || typeof p.item !== 'string' || !SHA.test(String(p.sha256)) || typeof p.at !== 'string' || !Number.isFinite(Date.parse(p.at))) continue
      out.push({ card: p.card as SignOffCardId, item: p.item, verdict: p.verdict, sha256: String(p.sha256),
        words: typeof p.words === 'string' && p.words.trim() ? p.words : null, at: p.at, by: 'Krish',
        ...(r.week ? { week: String(r.week).slice(0, 10) } : {}) })
    }
  }
  return out.sort((a, b) => a.at.localeCompare(b.at))
}

/** His latest press on each (card, item) whose bytes are the sample's now. */
function latest(presses: SignOffPress[], card: string, item: string, sha256: string): SignOffAnswer | null {
  const mine = presses.filter(p => p.card === card && p.item === item && p.sha256 === sha256)
  const last = mine[mine.length - 1]
  return last ? { said: last.verdict, words: last.words, at: last.at } : null
}

const rows = (doc: Body | null, key: string) => (doc && Array.isArray(doc[key]) ? (doc[key] as unknown[]).filter(isObj) : [])

/** Whether the engine's config on main holds his answer on a sample. */
function writtenOf(card: SignOffCardId, item: SignOffSample, said: SignOffSaid, configs: SignOffConfigs): boolean {
  if (card === 'sfx') return rows(configs.sfx, said === 'approve' ? 'approved' : 'declined').some(r => r.id === item.id && r.sha256 === item.sha256)
  if (card === 'golden') {
    if (said === 'approve') return rows(configs.golden, 'slots').some(s => s.status === 'named' && s.sign_off === item.id)
    return rows(configs.golden, 'declined').some(d => d.sign_off === item.id)
  }
  return false
}

function gate2Written(sha: string, said: SignOffSaid, lock: Body | null): boolean {
  const formats = lock && isObj(lock.formats) ? lock.formats : {}
  const drafts = lock && isObj(lock.drafts) ? lock.drafts : {}
  if (said === 'approve') {
    const f = formats[GATE2_LOCK]
    return isObj(f) && isObj(f.approved) && f.approved.sha256 === sha
  }
  const d = drafts[GATE2_LOCK]
  return isObj(d) && isObj(d.gate2) && d.gate2.sha256 === sha && d.gate2.verdict === 'not_this'
}

const DATE = (iso: string) => {
  const d = new Date(iso)
  return `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getUTCDay()]} ${d.getUTCDate()} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]}`
}

function linesOf(card: SignOffCardId, i: SignOffSample): string[] {
  const s = (k: string) => (typeof i[k] === 'string' && String(i[k]).trim() ? String(i[k]).trim() : null)
  if (card === 'sfx') {
    const secs = typeof i.seconds === 'number' ? `${(i.seconds as number).toFixed(1)} s` : null
    return [s('use'), [s('slot') ? `For: ${s('slot')}` : null, secs, s('provider')].filter(Boolean).join(' · ')].filter((x): x is string => Boolean(x))
  }
  if (card === 'golden') {
    const day = s('date') ? DATE(`${s('date')}T12:00:00Z`) : null
    return [[s('piece'), day].filter(Boolean).join(', '), [s('shape') ? `${s('shape')} cut` : null, s('at') ? `at ${s('at')}` : null].filter(Boolean).join(' ')]
      .filter(x => x)
  }
  return [s('at') ? `Beat: ${s('beat') || i.id}, at ${s('at')} of the cut` : `Beat: ${s('beat') || i.id}`]
}

function action(label: string, body: Body, done: string, ask: string | null): SignOffAction {
  return { kind: 'press', label, op: SIGN_OFF_OP, body, ...(ask ? { words: { path: 'words', ask, required: false } } : {}), stamp: [], done }
}

/** The two presses on one sample (each), or on a whole card (Gate 2). His words are optional on both on Gate 2, and on
 *  Not this elsewhere; Approve on a sound or a frame is one tap. */
export function signOffPresses(card: SignOffManifestCard, item: SignOffSample | null): { approve: SignOffAction; not_this: SignOffAction } {
  const whole = card.presses === 'card'
  const sha = whole ? cardSha256(card) : item!.sha256
  const body = (verdict: SignOffSaid) => ({ card: card.id, item: whole ? CARD_ITEM : item!.id, verdict, sha256: sha })
  const what = whole ? 'these four frames' : card.id === 'sfx' ? 'this sound' : 'this frame'
  const done = (verdict: SignOffSaid) => (verdict === 'approve'
    ? 'Approved. The engine takes it in, and this card says so when it has.'
    : 'Saved as your no. The engine records it, and nothing here is used.')
  return {
    approve: action('Approve', body('approve'), done('approve'), whole ? 'Anything to add? (optional)' : null),
    not_this: action('Not this', body('not_this'), done('not_this'), `What is not right about ${what}? (optional)`),
  }
}

/** The view's sign_offs: every card with its samples, his answer on each and whether the engine holds it. Null when the
 *  manifest cannot be read. */
export function signOffsView(manifest: SignOffManifest | null, presses: SignOffPress[], configs: SignOffConfigs): SignOffsView | null {
  if (!manifest) return null
  const cards: SignOffCardView[] = manifest.cards.map(card => {
    const whole = card.presses === 'card'
    const sha = whole && card.items.length ? cardSha256(card) : null
    const cardVerdict = whole && sha ? latest(presses, card.id, CARD_ITEM, sha) : null
    const items: SignOffItemView[] = card.items.map(i => {
      const verdict = whole ? null : latest(presses, card.id, i.id, i.sha256)
      return { id: i.id, title: i.title, kind: i.kind, mime: typeof i.mime === 'string' ? i.mime : null,
        src: `/api/board/sign-offs?file=${encodeURIComponent(i.drive.file_id)}`, drive: { file_id: i.drive.file_id, url: i.drive.url },
        sha256: i.sha256, lines: linesOf(card.id, i), verdict,
        written: whole ? Boolean(cardVerdict && sha && gate2Written(sha, cardVerdict.said, configs.lock)) : Boolean(verdict && writtenOf(card.id, i, verdict.said, configs)),
        presses: whole ? null : signOffPresses(card, i) }
    })
    const decided = whole ? (cardVerdict ? items.length : 0) : items.filter(i => i.verdict).length
    const approved = whole ? (cardVerdict?.said === 'approve' ? items.length : 0) : items.filter(i => i.verdict?.said === 'approve').length
    const declined = whole ? (cardVerdict?.said === 'not_this' ? items.length : 0) : items.filter(i => i.verdict?.said === 'not_this').length
    const written = whole ? items.every(i => i.written) && Boolean(cardVerdict) : items.filter(i => i.verdict).every(i => i.written)
    const waiting = items.length - decided
    const state: SignOffCardView['state'] = !items.length || waiting > 0 ? 'waiting' : written ? 'written' : 'answered'
    return { id: card.id, title: card.title, ask: card.ask, why: card.why ?? null, note: card.note ?? null, writes: card.writes ?? null,
      presses_mode: card.presses, want: card.want ?? null, counts: { approved, declined, waiting, total: items.length }, state,
      line: cardLine(card, { approved, declined, waiting, total: items.length }, state, cardVerdict),
      items, verdict: cardVerdict, presses: whole && items.length ? signOffPresses(card, null) : null, sha256: sha }
  })
  return { waiting: cards.filter(c => c.state === 'waiting').length, cards }
}

function cardLine(card: SignOffManifestCard, n: SignOffCardView['counts'], state: SignOffCardView['state'], verdict: SignOffAnswer | null): string {
  if (!n.total) return 'The samples are being made. This card fills in when they are in Drive.'
  if (card.presses === 'card') {
    if (!verdict) return `Waiting on you: one Approve or Not this for all ${n.total} frames.`
    const said = verdict.said === 'approve' ? 'Approved' : 'Not this'
    return `${said}, ${DATE(verdict.at)}. ${state === 'written' ? 'Written to the engine.' : 'The engine is writing it in.'}`
  }
  const parts = [`${n.approved} approved`, `${n.declined} not this`, ...(n.waiting ? [`${n.waiting} waiting on you`] : [])]
  const want = card.want && n.approved < card.want.min ? ` At least ${card.want.min} are wanted.` : card.want && n.approved > card.want.max ? ` The engine keeps ${card.want.max}.` : ''
  const tail = state === 'written' ? ' Written to the engine.' : state === 'answered' ? ' The engine is writing it in.' : ''
  return `${parts.join(', ')} of ${n.total}.${want}${tail}`
}

// ---------------------------------------------------------------- the sources (main, at the commit it points at now)

type Fetcher = (url: string, init?: { method?: string; headers?: Record<string, string> }) => Promise<{ status: number; text(): Promise<string> }>
const fetchText = async (f: Fetcher, url: string) => { try { const r = await f(url); return r.status === 200 ? await r.text() : null } catch { return null } }
const parse = (t: string | null): Body | null => { try { const v = t ? JSON.parse(t) : null; return isObj(v) ? v : null } catch { return null } }

/** The manifest and the three configs it writes, from main (raw at the given commit, else main by name). */
export async function readSignOffSources(fetcher: Fetcher, mainSha?: string | null): Promise<{ manifest: SignOffManifest | null; configs: SignOffConfigs }> {
  const RAW = `https://raw.githubusercontent.com/${ENGINE_REPO}/${mainSha || 'main'}`
  const [m, sfx, golden, lock] = await Promise.all([
    fetchText(fetcher, `${RAW}/config/ve/sign-offs.json`), fetchText(fetcher, `${RAW}/config/sfx-approved.json`),
    fetchText(fetcher, `${RAW}/config/ve/golden-frames.json`), fetchText(fetcher, `${RAW}/config/ve/design-lock.json`)])
  return { manifest: parseManifest(m), configs: { sfx: parse(sfx), golden: parse(golden), lock: parse(lock) } }
}

/** Every week's sign-off records (picks/signoff-<card>), for the cards on any week's view. */
export async function readSignOffPresses(db: SupabaseClient): Promise<SignOffPress[] | null> {
  const r = await db.from('board_documents').select('week,doc_id,body,updated_by').eq('collection', 'picks').like('doc_id', 'signoff-%').limit(200)
  return r.error ? null : pressesOf((r.data || []) as Array<{ week?: string; doc_id: string; body: unknown; updated_by: string }>)
}

/** Every Drive file the cards show: the only ids GET /api/board/sign-offs?file= serves. */
export function signOffFiles(manifest: SignOffManifest | null): Set<string> {
  return new Set((manifest?.cards || []).flatMap(c => c.items.map(i => i.drive.file_id)))
}

// ---------------------------------------------------------------- his press

export class SignOffError extends Error { constructor(public status: number, message: string) { super(message) } }
export interface SignOffPick { card: SignOffCardId; item: string; verdict: SignOffSaid; sha256: string; words: string | null }

/** His press, checked: a card, an item (or * for a card-level press), Approve or Not this, the sha256 it names. */
export function signOffPick(body: unknown): SignOffPick {
  if (!isObj(body)) throw new SignOffError(400, 'invalid_sign_off')
  if (!(SIGN_OFF_CARDS as readonly unknown[]).includes(body.card)) throw new SignOffError(400, 'invalid_card')
  if (typeof body.item !== 'string' || !(body.item === CARD_ITEM || /^[a-z0-9][a-z0-9_.-]{0,63}$/.test(body.item))) throw new SignOffError(400, 'invalid_item')
  if (body.verdict !== 'approve' && body.verdict !== 'not_this') throw new SignOffError(400, 'invalid_verdict')
  const sha256 = String(body.sha256 || '').toLowerCase()
  if (!SHA.test(sha256)) throw new SignOffError(400, 'invalid_sha256')
  const words = typeof body.words === 'string' && body.words.trim() ? body.words.trim().slice(0, SIGN_OFF_WORDS_MAX) : null
  return { card: body.card as SignOffCardId, item: body.item, verdict: body.verdict, sha256, words }
}

/** The press against the card as it stands now: the sample must be on it, and its bytes the ones he saw. */
export function checkAgainst(manifest: SignOffManifest | null, pick: SignOffPick): void {
  if (!manifest) throw new SignOffError(503, 'sign_offs_unavailable')
  const card = manifest.cards.find(c => c.id === pick.card)
  if (!card || !card.items.length) throw new SignOffError(404, 'card_not_found')
  if (card.presses === 'card') {
    if (pick.item !== CARD_ITEM) throw new SignOffError(400, 'invalid_item')
    if (pick.sha256 !== cardSha256(card)) throw new SignOffError(409, 'sample_changed')
    return
  }
  const item = card.items.find(i => i.id === pick.item)
  if (!item) throw new SignOffError(404, 'sample_not_found')
  if (item.sha256 !== pick.sha256) throw new SignOffError(409, 'sample_changed')
}

/** Appends his press to picks/signoff-<card> of the week he pressed on: never rewritten; the same answer twice in a row
 *  on the same bytes is kept once (already). */
export async function recordSignOff(db: SupabaseClient, week: string, pick: SignOffPick, now: string): Promise<{ press: SignOffPress; already: boolean }> {
  const docId = `signoff-${pick.card}`
  const press: SignOffPress = { card: pick.card, item: pick.item, verdict: pick.verdict, sha256: pick.sha256, words: pick.words, at: now, by: 'Krish' }
  // Across weeks: his latest answer on these bytes, wherever he gave it.
  const all = await readSignOffPresses(db)
  if (!all) throw new SignOffError(503, 'board_store_unavailable')
  const last = all.filter(p => p.card === pick.card && p.item === pick.item && p.sha256 === pick.sha256).pop()
  if (last && last.verdict === pick.verdict && last.words === pick.words) return { press: last, already: true }
  for (let tries = 0; tries < 2; tries++) {
    const read = await db.from('board_documents').select('body, revision, updated_by').eq('week', week).eq('collection', 'picks').eq('doc_id', docId).maybeSingle()
    if (read.error) throw new SignOffError(503, 'board_store_unavailable')
    const held: Body = isObj(read.data?.body) && read.data!.updated_by === 'Krish' ? read.data!.body as Body : {}
    const list = Array.isArray(held.presses) ? (held.presses as unknown[]) : []
    if (list.length >= MAX_SIGN_OFF_PRESSES) throw new SignOffError(409, 'too_many_presses')
    const body: Body = { kind: 'sign_off', card: pick.card, presses: [...list, press] }
    if (!validBody('picks', docId, body)) throw new SignOffError(400, 'invalid_sign_off')
    const saved = await db.rpc('board_save', { p_week: week, p_collection: 'picks', p_id: docId, p_body: body, p_revision: Number(read.data?.revision || 0), p_actor: 'Krish' })
    if (saved.error) throw new SignOffError(503, 'board_store_unavailable')
    if (saved.data?.ok) return { press, already: false }
    if (saved.data?.error !== 'revision_conflict') throw new SignOffError(409, String(saved.data?.error || 'board_save_refused'))
  }
  throw new SignOffError(409, 'revision_conflict')
}
