import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import edition from '../../../../config/weekly-edition.json' with { type: 'json' }
import { EDITION_DOC, EDITION_KIND } from './_contracts.js'
import { approvedWhen } from './_gate.js'

// The weekly edition on the Saturday card, and his one press, Approve for send (contract 1.35.0).
//
// Krish, 2026-11-25 (growth-makeyourmindup docs/plans/2026-11-25-weekly-edition/DESIGN.md, approved with every
// recommendation): one email a week, "makeyourmindup weekly", every Saturday at 08:00 New York. The Friday run
// (.github/workflows/weekly-edition.yml) drafts it and files the package in the library like a post:
// 3 Posts/<Saturday> Sat edition - makeyourmindup weekly/0 Publish/edition.draft.json (content-engine-edition/1), with
// its preview beside it. This reads that draft the way the piece manifest is read (_manifest.ts): the library's newest
// ready copy, its bytes checked against the sha256 the library recorded, and puts it on the week's Saturday with one
// press, Approve for send (picks/sat-edition, kind approve_send), bound to the draft's sha256. A press bound to another
// sha256 is refused (409 edition_changed), and a draft that changes after his press needs his press again.
//
// Why not the off-day manifest's Approve for publish (the first choice): that press is picks/<day>-publish, one a day,
// and Saturday's own post may need it; it binds a piece's record in content_ideas (checkPublishBind reads the piece, its
// making record names the folder) and a file list in Growth's content-engine-piece-manifest/1 shape; and an off-day item
// reaches its day only through his Approve on its option, which would make two presses. The edition is no piece, its
// package is a text growth's Substack step builds from, and it has one press. So it is its own item on the day, and
// its press is the manifest's pattern: the library read, the sha256 bind, waiting, approved or changed, and the 409.
//
// Growth's Substack step reads the item from the week's view, or from GET /api/board/<Monday>/edition on its own key,
// and the draft's exact bytes from GET /api/board/<Monday>/edition/draft, and acts only when the item says approved for
// exactly the sha256 of the bytes it built from. Nothing here sends, schedules or publishes.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const SHA = /^[a-f0-9]{64}$/
const LIBRARY = 'makeyourmindup'
const BUCKET = 'content-library'
const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export const EDITION_SCHEMA: string = edition.package_schema
export const EDITION_NAME: string = edition.name
export const EDITION_DAY = edition.board.day as 'sat'
export const EDITION_ITEM_KIND: string = edition.board.item_kind
export const EDITION_ITEM_LABEL: string = edition.board.item_label
export const EDITION_MAX_BYTES: number = edition.library.max_bytes
/** The edition's path on the board, as the week model draws it: Drafted, Approved for send, Scheduled, Sent. Growth's
 *  Substack step does the last two; the board shows them once growth reports them (a follow-up). */
export const EDITION_PATH = [
  { key: 'drafted', label: 'Drafted' },
  { key: 'approved', label: 'Approved for send' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'sent', label: 'Sent' },
] as const

export const sha256 = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex')

/** The Saturday the week's edition sends on. */
export function editionDate(week: string): string {
  const d = new Date(`${week}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + DAYS.indexOf(EDITION_DAY))
  return d.toISOString().slice(0, 10)
}

/** Where the week's edition is in the library (the contract, section 3). */
export function editionPaths(date: string): { folder: string; draft: string; preview: string } {
  const folder = edition.library.folder.replace('{edition_date}', date).replace('{name}', edition.name)
  return { folder, draft: `3 Posts/${folder}/${edition.library.draft}`, preview: `3 Posts/${folder}/${edition.library.preview}` }
}

/** A draft as the board reads it. */
export interface EditionDraft {
  edition_date: string
  sha256: string
  subject: string
  preview_text: string
  checks: { voice: string; kill_list: string; sources: string; words: number }
  contents: string[]
  pieces: Array<{ day: string; label: string; title: string }>
  news: { items: number; topics: string[] }
  sources: Array<{ label: string; href: string }>
}
/** What readEdition found: the draft, its exact bytes, and the preview filed beside it (or null). */
export interface EditionRead { draft: EditionDraft; bytes: Uint8Array; preview: { object_key: string; sha256: string } | null }

/** A draft's bytes as the board shows them, or null when they are not the week's edition in the contract's shape with
 *  every check passed. */
export function parseEdition(bytes: Uint8Array, date: string): EditionDraft | null {
  let d: unknown
  try { d = JSON.parse(Buffer.from(bytes).toString('utf8')) } catch { return null }
  if (!isObj(d) || d.schema !== EDITION_SCHEMA || d.name !== EDITION_NAME || d.edition_date !== date) return null
  const checks = isObj(d.checks) ? d.checks : null
  if (!checks || checks.voice !== 'pass' || checks.kill_list !== 'pass' || checks.sources !== 'pass' || typeof checks.words !== 'number') return null
  if (typeof d.subject !== 'string' || typeof d.preview_text !== 'string' || !Array.isArray(d.sections)) return null
  const sections = d.sections.filter(isObj)
  const text = (v: unknown) => (typeof v === 'string' ? v : '')
  const pieces = sections.filter(s => s.kind === 'piece').map(s => ({ day: text(s.day), label: text(s.label), title: text(s.title) }))
  if (!pieces.length) return null
  const contents = sections.find(s => s.kind === 'contents')
  const groups = (sections.find(s => s.kind === 'news')?.groups as unknown[] | undefined ?? []).filter(isObj)
  const items = groups.flatMap(g => (Array.isArray(g.items) ? g.items : []).filter(isObj))
  return {
    edition_date: date, sha256: sha256(bytes), subject: d.subject, preview_text: d.preview_text,
    checks: { voice: 'pass', kill_list: 'pass', sources: 'pass', words: checks.words },
    contents: (Array.isArray(contents?.lines) ? contents!.lines : []).filter((l): l is string => typeof l === 'string'),
    pieces, news: { items: items.length, topics: groups.map(g => text(g.topic)).filter(Boolean) },
    sources: items.filter(i => typeof i.source_url === 'string' && /^https:\/\//.test(i.source_url))
      .map(i => ({ label: text(i.source_name) || 'Source', href: String(i.source_url) })),
  }
}

/** The newest ready library copy at a path whose bytes match the sha256 the library recorded, or null. */
async function newest(db: SupabaseClient, path: string): Promise<{ object_key: string; sha256: string; bytes: Uint8Array } | null> {
  const rows = await db.from('content_library_files').select('path, object_key, sha256, ready_at').eq('library', LIBRARY).eq('state', 'ready')
    .eq('path', path).order('ready_at', { ascending: false }).limit(1)
  if (rows.error || !Array.isArray(rows.data)) throw new Error('library_unavailable')
  const row = (rows.data as Body[]).find(r => r.path === path)
  if (!row || typeof row.object_key !== 'string' || typeof row.sha256 !== 'string' || !SHA.test(row.sha256)) return null
  const file = await db.storage.from(BUCKET).download(row.object_key)
  if (file.error || !file.data) throw new Error('library_unavailable')
  const bytes = new Uint8Array(await file.data.arrayBuffer())
  if (bytes.length > EDITION_MAX_BYTES || sha256(bytes) !== row.sha256) return null
  return { object_key: row.object_key, sha256: row.sha256, bytes }
}

/** The week's edition from the library: null when none is filed, or what is filed is not the week's edition in the
 *  contract's shape. Throws when the library cannot be read, so a caller never reads "no edition" from an outage. */
export async function readEdition(db: SupabaseClient, week: string): Promise<EditionRead | null> {
  const date = editionDate(week)
  const paths = editionPaths(date)
  const found = await newest(db, paths.draft)
  if (!found) return null
  const draft = parseEdition(found.bytes, date)
  if (!draft) return null
  const preview = await newest(db, paths.preview).catch(() => null)
  return { draft, bytes: found.bytes, preview: preview ? { object_key: preview.object_key, sha256: preview.sha256 } : null }
}

/** His Approve for send, as the view carries it. */
export interface EditionPress {
  kind: 'press'; label: string; collection: 'picks'; id: string; revision: number
  body: { kind: string; day: string; edition_date: string; approved: true; edition_sha256: string }
  stamp: string[]; done: string
}
/** The Saturday's `edition` in the view (contract 1.35.0). */
export interface ViewEdition {
  kind: string
  edition_date: string
  name: string
  subject: string
  preview_text: string
  /** The draft's sha256: what his Approve for send binds, and what growth's Substack step builds from. */
  sha256: string
  checks: EditionDraft['checks']
  contents: string[]
  pieces: EditionDraft['pieces']
  news: EditionDraft['news']
  sources: EditionDraft['sources']
  /** The draft's and the preview's bytes, as same-site paths (GET /api/board/<Monday>/edition/<draft|preview>). */
  files: { draft: string; preview: string | null }
  /** Where they are in the library. */
  library: { draft: string; preview: string }
  /** waiting: no press of his binds it; approved: his press binds exactly this draft; changed: his press binds another. */
  state: 'waiting' | 'approved' | 'changed'
  approved_at: string | null
  /** The sha256 his latest Approve for send binds, or null when he has given none. */
  approved_sha256: string | null
  /** His Approve for send, bound to this draft's sha256; null once his press binds it. */
  press: EditionPress | null
  /** Why it waits, in his words, or null. */
  why: string | null
}

type PickDoc = { doc_id: string; body: Body; updated_by: string; revision?: number }

/** His Approve for send as the picks document stands now (his login only), or null. */
function hisPress(picks: PickDoc[]) {
  const doc = picks.find(p => p.doc_id === EDITION_DOC && p.updated_by === 'Krish' && isObj(p.body) && p.body.kind === EDITION_KIND)
  return doc ? { body: doc.body, revision: Number.isInteger(doc.revision) ? Number(doc.revision) : 0 } : null
}

/** The Saturday's edition with its press: waiting, approved (his press binds exactly this draft) or changed (his press
 *  binds another draft, so it needs his press again). Pure. */
export function editionView(found: EditionRead | null | undefined, picks: PickDoc[], week: string): ViewEdition | null {
  if (!found) return null
  const e = found.draft
  const his = hisPress(picks)
  const yes = his?.body.approved === true
  const bound = yes && his!.body.edition_sha256 === e.sha256 && his!.body.edition_date === e.edition_date
  const state: ViewEdition['state'] = bound ? 'approved' : yes ? 'changed' : 'waiting'
  const press: EditionPress | null = bound ? null : {
    kind: 'press', label: state === 'changed' ? edition.board.label_changed : edition.board.label, collection: 'picks', id: EDITION_DOC,
    revision: his?.revision ?? picks.find(p => p.doc_id === EDITION_DOC)?.revision ?? 0,
    body: { kind: EDITION_KIND, day: EDITION_DAY, edition_date: e.edition_date, approved: true, edition_sha256: e.sha256 },
    stamp: ['at'],
    done: `Approved for send: exactly this edition ("${e.subject}"). Growth's Substack step schedules it for 08:00 New York on Saturday; nothing else is sent.`,
  }
  const why = state === 'changed'
    ? 'The edition changed after you approved it, so your approval does not cover it. Read the new one and approve again; nothing is sent until you do.'
    : null
  const paths = editionPaths(e.edition_date)
  const at = bound && typeof his!.body.at === 'string' ? his!.body.at : null
  return {
    kind: EDITION_ITEM_KIND, edition_date: e.edition_date, name: EDITION_NAME, subject: e.subject, preview_text: e.preview_text, sha256: e.sha256,
    checks: e.checks, contents: e.contents, pieces: e.pieces, news: e.news, sources: e.sources,
    files: { draft: `/api/board/${week}/edition/draft`, preview: found.preview ? `/api/board/${week}/edition/preview` : null },
    library: { draft: paths.draft, preview: paths.preview },
    state, approved_at: at, approved_sha256: yes && typeof his!.body.edition_sha256 === 'string' ? his!.body.edition_sha256 : null, press, why,
  }
}

/** "Approved for send by you, Sat 14 Nov, 07:12", or null. */
export function editionApprovedLabel(v: ViewEdition): string | null {
  return v.state === 'approved' && v.approved_at ? `Approved for send by you, ${approvedWhen(v.approved_at)}` : null
}

export class EditionBindError extends Error { constructor(public status: number, message: string) { super(message) } }

/** His Approve for send binds the week's edition as it stands now: a press for another Saturday, or for a week with no
 *  edition filed, is refused (409 edition_not_found), and one bound to another sha256 too (409 edition_changed: the
 *  draft changed under his page). Taking it back (approved false) is not this check's. */
export async function checkEditionBind(db: SupabaseClient, week: string, body: Body): Promise<void> {
  if (body.kind !== EDITION_KIND || body.approved !== true) return
  if (body.edition_date !== editionDate(week)) throw new EditionBindError(409, 'edition_not_found')
  let found: EditionRead | null
  try { found = await readEdition(db, week) } catch { throw new EditionBindError(503, 'board_store_unavailable') }
  if (!found) throw new EditionBindError(409, 'edition_not_found')
  if (found.draft.sha256 !== body.edition_sha256) throw new EditionBindError(409, 'edition_changed')
}

/** The preview's bytes, read from the library and checked against the sha256 it recorded, or null. */
export async function readPreview(db: SupabaseClient, found: EditionRead): Promise<Uint8Array | null> {
  if (!found.preview) return null
  const file = await db.storage.from(BUCKET).download(found.preview.object_key)
  if (file.error || !file.data) return null
  const bytes = new Uint8Array(await file.data.arrayBuffer())
  return bytes.length <= EDITION_MAX_BYTES && sha256(bytes) === found.preview.sha256 ? bytes : null
}

/** The preview's content security policy: its own inline style and https pictures, nothing that runs. */
export const PREVIEW_POLICY = "default-src 'none'; img-src https: data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'self'"

// The week's daily hub items, for the edition's news (config/weekly-edition.json, news.from_hub; 26 Nov 2026: the
// edition reads the hub's rows and runs no gathering of its own). The hub pipeline writes one snapshot a day to
// hub_snapshots (edition_date, payload: the same JSON GET /api/hub/today serves). This reads the rows from the Friday
// before the week to its Friday, the eight daily editions the news window (the seven days to Friday 12:00 New York)
// can draw on, and cuts each item to what the edition reads. A row that is not a good snapshot is said as missing,
// never read; an item missing a field the edition needs is counted as skipped. Read only.
export interface HubItem {
  id: string; subsector: string; date: string; source: string; url: string
  headline: string; dek: string; why: string | null; coverage: number
}
export interface HubWeek { from: string; to: string; days: { edition_date: string; items: HubItem[]; skipped: number }[]; missing: string[] }
export class HubUnavailable extends Error { constructor() { super('hub_unavailable') } }

const HUB_TEXT = ['id', 'subsector', 'date', 'source', 'url', 'headline', 'dek'] as const
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function hubItem(v: unknown): HubItem | null {
  if (!isObj(v)) return null
  if (HUB_TEXT.some(k => typeof v[k] !== 'string' || !(v[k] as string).trim())) return null
  if (!String(v.url).startsWith('https://')) return null
  const coverage = Number.isInteger(v.coverage) && (v.coverage as number) >= 1 ? v.coverage as number : 1
  return { id: v.id as string, subsector: v.subsector as string, date: v.date as string, source: v.source as string,
    url: v.url as string, headline: v.headline as string, dek: v.dek as string,
    why: typeof v.why === 'string' && v.why.trim() ? v.why : null, coverage }
}

export async function readHubWeek(db: SupabaseClient, week: string): Promise<HubWeek> {
  const day = (n: number) => new Date(Date.parse(`${week}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
  const from = day(-3), to = day(4)
  const { data, error } = await db.from('hub_snapshots').select('edition_date,payload')
    .gte('edition_date', from).lte('edition_date', to).order('edition_date', { ascending: true })
  if (error || !Array.isArray(data)) throw new HubUnavailable()
  const days: HubWeek['days'] = []
  for (const row of data as Body[]) {
    const date = String(row.edition_date ?? '').slice(0, 10)
    const p = row.payload
    if (!ISO_DAY.test(date) || !isObj(p) || p.ok !== true || p.version !== 1 || p.edition_date !== date || !Array.isArray(p.items)) continue
    const items = (p.items as unknown[]).map(hubItem)
    days.push({ edition_date: date, items: items.filter((i): i is HubItem => i !== null), skipped: items.filter(i => i === null).length })
  }
  const read = new Set(days.map(d => d.edition_date))
  const missing = Array.from({ length: 8 }, (_, i) => day(i - 3)).filter(d => !read.has(d))
  return { from, to, days, missing }
}
