import { createHash } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { driveFileUrl } from './_drivePosts.js'

// Approve for publish, bound to the piece's manifest (contract 1.8.0; docs/GROWTH-HANDOFF.md, "The piece manifest").
// Growth posts only what Krish approved: a piece's `0 Publish/manifest.draft.json` (scripts/post-pack/piece_manifest.py
// draft) lists the exact files, in order, with their Drive ids and sha256, and each channel's words. His Approve for
// publish press (picks/<day>-publish, kind approve_publish) carries that draft's sha256, and `piece_manifest.py seal`
// seals only a draft his press binds. The archive board had the press; the live board's view carries it from 1.8.0, so a
// manifest can be sealed again, and he approves exactly the files he can see (Ruling, Krish, 2026-11-12: "I should
// always be able to link the assets in Google Drive as well as see them if I am to approve them").
//
// A draft is read from the library (the session sends it with the post's pack), by the post's own folder on the
// piece's making record (pack.folder): the newest ready copy, its bytes checked against the sha256 the library
// recorded. A draft that changes after his press needs a fresh press: the view says so plainly, and the board's route
// refuses a press bound to anything but the draft as it stands now (409 manifest_changed).

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const SHA = /^[a-f0-9]{64}$/
const LIBRARY = 'makeyourmindup'
const BUCKET = 'content-library'
const MAX_BYTES = 262_144

export interface ManifestAsset { name: string; drive_id: string; sha256: string; order: number; url: string }
/** A piece's draft manifest as the board reads it. */
export interface Draft { piece_id: string; sha256: string; qa: string; assets: ManifestAsset[]; channels: string[] }
/** The view's `manifest` on a series day (1.8.0). */
export interface ViewManifest {
  sha256: string
  qa: string
  assets: ManifestAsset[]
  channels: string[]
  /** waiting: no press of his binds it; approved: his press binds exactly this draft; changed: his press binds another. */
  state: 'waiting' | 'approved' | 'changed'
  approved_at: string | null
  /** His Approve for publish, bound to this draft's sha256; null once his press binds it. */
  press: ManifestPress | null
  /** Why it waits, in his words, or null. */
  why: string | null
}
export interface ManifestPress {
  kind: 'press'; label: string; collection: 'picks'; id: string; revision: number
  body: { kind: 'approve_publish'; day: string; piece_id: string; approved: true; manifest_sha256: string }
  stamp: string[]; done: string
}

export const sha256 = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex')

/** Where a piece's draft is in the library: its post's own folder, from the making record (pack.folder). */
export function draftPath(piece: Body): string | null {
  const meta = isObj(piece.meta) ? piece.meta : {}
  const making = isObj(meta.making) ? meta.making : {}
  const pack = isObj(making.pack) && typeof making.pack.folder === 'string' ? making.pack.folder.trim() : ''
  return pack ? `3 Posts/${pack}/0 Publish/manifest.draft.json` : null
}

/** A draft's bytes read as the board shows it, or null when it is not a draft of this piece in Growth's shape. */
export function parseDraft(bytes: Uint8Array, pieceId: string): Draft | null {
  let d: unknown
  try { d = JSON.parse(Buffer.from(bytes).toString('utf8')) } catch { return null }
  if (!isObj(d) || d.schema !== 'content-engine-piece-manifest/1' || 'approval_sha256' in d) return null
  if (String(d.piece_id).toLowerCase() !== pieceId.toLowerCase()) return null
  const assets = (Array.isArray(d.assets) ? d.assets : []).filter(isObj)
    .filter(a => typeof a.name === 'string' && typeof a.drive_id === 'string' && /^[A-Za-z0-9_-]{10,100}$/.test(a.drive_id) && typeof a.sha256 === 'string' && SHA.test(a.sha256))
    .map(a => ({ name: String(a.name), drive_id: String(a.drive_id), sha256: String(a.sha256), order: Number(a.order) || 0, url: driveFileUrl(String(a.drive_id)) }))
    .sort((a, b) => a.order - b.order)
  const qa = isObj(d.qa) && typeof d.qa.state === 'string' ? d.qa.state : 'unknown'
  return { piece_id: pieceId.toLowerCase(), sha256: sha256(bytes), qa, assets, channels: isObj(d.channels) ? Object.keys(d.channels) : [] }
}

/** The week's drafts, by piece id: the newest ready library copy of each piece's draft, its bytes matching the hash the
 *  library recorded. A piece with none, or a store that cannot be read, is left out (no manifest, no press). */
export async function readDrafts(db: SupabaseClient, pieces: Body[]): Promise<Map<string, Draft>> {
  const out = new Map<string, Draft>()
  const want = pieces.map(p => ({ id: String(p.id).toLowerCase(), path: draftPath(p) })).filter((x): x is { id: string; path: string } => Boolean(x.path))
  if (!want.length) return out
  const rows = await db.from('content_library_files').select('path, object_key, sha256, ready_at').eq('library', LIBRARY).eq('state', 'ready')
    .in('path', want.map(w => w.path)).order('ready_at', { ascending: false })
  if (rows.error || !Array.isArray(rows.data)) return out
  for (const w of want) {
    const row = (rows.data as Body[]).find(r => r.path === w.path)
    if (!row || typeof row.object_key !== 'string' || typeof row.sha256 !== 'string') continue
    const file = await db.storage.from(BUCKET).download(row.object_key)
    if (file.error || !file.data) continue
    const bytes = new Uint8Array(await file.data.arrayBuffer())
    if (bytes.length > MAX_BYTES || sha256(bytes) !== row.sha256) continue
    const draft = parseDraft(bytes, w.id)
    if (draft) out.set(w.id, draft)
  }
  return out
}

/** His Approve for publish on a day, as the picks document stands now (his login only), or null. */
function hisPress(picks: Array<{ doc_id: string; body: Body; updated_by: string; revision?: number }>, day: string) {
  const doc = picks.find(p => p.doc_id === `${day}-publish` && p.updated_by === 'Krish' && isObj(p.body) && p.body.kind === 'approve_publish')
  return doc ? { body: doc.body, revision: Number.isInteger(doc.revision) ? Number(doc.revision) : 0 } : null
}

/** The day's manifest with its press: waiting, approved (his press binds exactly this draft) or changed (his press binds
 *  another draft, so it needs his press again). Pure. */
export function dayManifest(draft: Draft | undefined, picks: Array<{ doc_id: string; body: Body; updated_by: string; revision?: number }>, day: string): ViewManifest | null {
  if (!draft) return null
  const his = hisPress(picks, day)
  const yes = his?.body.approved === true
  const bound = yes && his!.body.manifest_sha256 === draft.sha256 && String(his!.body.piece_id).toLowerCase() === draft.piece_id
  const state: ViewManifest['state'] = bound ? 'approved' : yes ? 'changed' : 'waiting'
  const id = `${day}-publish`
  const press: ManifestPress | null = bound ? null : {
    kind: 'press', label: state === 'changed' ? 'Approve the new files for publish' : 'Approve for publish', collection: 'picks', id,
    revision: his?.revision ?? picks.find(p => p.doc_id === id)?.revision ?? 0,
    body: { kind: 'approve_publish', day, piece_id: draft.piece_id, approved: true, manifest_sha256: draft.sha256 },
    stamp: ['at'], done: `Approved for publish: exactly these ${draft.assets.length} files and their words. Growth posts them; nothing else.`,
  }
  const why = state === 'changed'
    ? 'The files or words changed after you approved them, so your approval does not cover them. Look at them and approve again; nothing is posted until you do.'
    : draft.qa !== 'passed' ? `QA is ${draft.qa}: Growth holds every post until QA has passed, even after your Approve.` : null
  return { sha256: draft.sha256, qa: draft.qa, assets: draft.assets, channels: draft.channels, state,
    approved_at: bound && typeof his!.body.at === 'string' ? his!.body.at : null, press, why }
}

export class ManifestBindError extends Error { constructor(public status: number, message: string) { super(message) } }

/** His Approve for publish binds the draft as it stands now: a press bound to another hash is refused (the draft changed
 *  under his page), and so is one for a piece with no draft. A press with no hash (an older piece, no manifest) is not
 *  this check's. */
export async function checkPublishBind(db: SupabaseClient, body: Body): Promise<void> {
  if (body.kind !== 'approve_publish' || body.approved !== true || typeof body.manifest_sha256 !== 'string') return
  const pieceId = String(body.piece_id || '').toLowerCase()
  const row = await db.from('content_ideas').select('id, meta').eq('id', pieceId).maybeSingle()
  if (row.error) throw new ManifestBindError(503, 'board_store_unavailable')
  if (!row.data) throw new ManifestBindError(404, 'piece_not_found')
  const draft = (await readDrafts(db, [row.data as Body])).get(pieceId)
  if (!draft) throw new ManifestBindError(409, 'manifest_not_found')
  if (draft.sha256 !== body.manifest_sha256) throw new ManifestBindError(409, 'manifest_changed')
}
