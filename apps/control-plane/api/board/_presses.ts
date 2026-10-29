import type { SupabaseClient } from '@supabase/supabase-js'
import { DECISION_ID, canonical, digest } from './_contracts.js'
import type { SendApprovedInput, SendResult } from '../_teleprompter.js'

// What Krish's presses on the publish board do beyond saving the board document (docs/PUBLISH_BOARDS.md, "His
// presses"). Each runs on the server, after his document is saved, so a session never stands in for his press:
//
//   - Approve scripts (picks/<day>-scripts, approved: true): before the save, the hash of each cut's words is worked
//     out here from the words he saw (texts), so his approval binds exactly those; after it, the server sends them to
//     Teleprompter itself (sendApprovedScripts, apps/control-plane/api/_teleprompter.ts) and writes the answer (sent,
//     no_key, refused or error) into the same document as `send`, so a session can finish a no_key send. Krish,
//     2026-10-28: "Once I approve, the two scripts will go to teleprompter", and "Server sends directly".
//   - Reject asset (picks/<day>-reject-<asset>) and Reject on an idea with a typed reason (queue/<pick>, use
//     not_for_us): one row in the rejection inbox (taste_rejection_inbox), his reason as he typed it, where and when,
//     the piece, the formats and the asset's Drive id and moment when the board knows them. Masters are never copied
//     anywhere: a Drive id is a pointer. A Reject on an idea with no reason files nothing.
//
// The inbox row's client_report_id is the hash of the week, the document and his words, so a press saved again files
// nothing twice, and new words file once more.

export type Sender = (input: SendApprovedInput) => Promise<SendResult>
export interface PressDeps { send?: Sender; now?: () => string }
type Body = Record<string, unknown>
type Saved = { ok: boolean; revision?: number; body?: Body; [key: string]: unknown }
export class PressError extends Error { constructor(public status: number, message: string) { super(message) } }

const isObj = (v: unknown): v is Body => !!v && typeof v === 'object' && !Array.isArray(v)
const REPOSITORY = 'krishanraja/content-engine'
const EMITTER = 'content-engine/publish-board'

/** His Approve scripts body with the hash of each cut's words worked out here (scripts), or refused when the hashes it
 *  brought are not the hashes of its words. Any other body is returned as it came. */
export async function preparePress(collection: string, id: string, body: Body): Promise<Body> {
  if (collection !== 'picks' || body.kind !== 'approve_scripts' || body.approved !== true || !isObj(body.texts)) return body
  const { scriptHash } = await import('../_teleprompter.js')
  const scripts: Record<string, string> = {}
  for (const [cut, text] of Object.entries(body.texts)) scripts[cut] = scriptHash(String(text))
  if (isObj(body.scripts) && Object.entries(body.scripts).some(([cut, sha]) => scripts[cut] !== sha)) throw new PressError(400, 'approval_hash_mismatch')
  if (!DECISION_ID.test(id)) throw new PressError(400, 'invalid_document_write')
  return { ...body, scripts }
}

/** The Teleprompter send his approval asks for: each cut's words as Teleprompter shows them (spokenText), the words he
 *  approved given as their source, and his document as the approval, checked again by sendApprovedScripts. */
async function sendInput(id: string, body: Body, who: string, at: string): Promise<SendApprovedInput> {
  const { scriptHash, spokenText } = await import('../_teleprompter.js')
  const texts = body.texts as Record<string, string>, titles = body.titles as Record<string, string>
  const ids = isObj(body.script_ids) ? body.script_ids as Record<string, string> : {}
  const scripts = Object.keys(texts).map(cut => {
    const text = spokenText(texts[cut])
    return { cut: cut as 'long' | 'short' | 'feature', title: titles[cut], text, sha256: scriptHash(text), source: texts[cut], ...(ids[cut] ? { script_id: ids[cut] } : {}) }
  })
  return {
    piece_id: String(body.piece_id), day: body.day as 'mon' | 'wed' | 'fri', folder_title: String(body.folder_title),
    ...(typeof body.folder_id === 'string' ? { folder_id: body.folder_id } : {}),
    scripts, approval: { id, updated_by: who, updated_at: at, body },
  }
}

function inboxRow(week: string, collection: string, id: string, revision: number | undefined, body: Body, now: string) {
  const reason = String(body.reason || '').trim()
  if (!reason) return null
  const idea = collection === 'queue'
  const day = idea ? String(body.day || id.split('-')[0]) : String(body.day)
  const drive = !idea && typeof body.drive_id === 'string' ? body.drive_id : null
  const atMs = drive && Number.isSafeInteger(body.at_ms) ? Number(body.at_ms) : null
  const ideaId = typeof body.idea_id === 'string' && body.idea_id ? body.idea_id : null
  const label = idea ? String(body.so_what || body.story || '').trim() : String(body.label || '').trim()
  return {
    kind: 'rejected',
    said: reason,
    said_where: `publish board, ${week} ${day}`,
    said_at: now,
    piece: (idea ? ideaId : String(body.piece_id || '')) || null,
    formats: !idea && Array.isArray(body.formats) ? body.formats.map(String).slice(0, 16) : [],
    // The board's words about what was on screen: context, never his words.
    note: (label ? `${idea ? 'Idea rejected on the Ideas tab' : 'Asset rejected on the Publish step'}: ${label}` : null)?.slice(0, 2000) || null,
    master_drive_id: drive,
    at_ms: atMs,
    whole_cut: !!drive && atMs === null,
    session_ref: `publish-board:${week}:${collection}/${id}${revision ? `@${revision}` : ''}`,
    repository: REPOSITORY,
    surface: 'publish_board',
    emitter_id: EMITTER,
    client_report_id: `board-${digest(canonical({ week, collection, id, reason })).slice(0, 40)}`,
    // An idea is a subject, never a craft (Ruling, Krish, 2026-10-28: the floor holds form and process only), so it is
    // marked here for the engine that files it; an asset is his rejection of how it was made.
    meta: idea
      ? { board: { week, collection, doc_id: id, revision }, rule_kind: 'subject', subject_ref: `idea:${ideaId || id}` }
      : { board: { week, collection, doc_id: id, revision }, asset: body.asset, label: body.label },
  }
}

/** The side effects of a saved press, and the answer to send back: the saved document (with send, for Approve
 *  scripts) and, for a rejection, whether its inbox row was filed. Null when the press has none. */
export async function afterPress(db: SupabaseClient, ctx: { week: string; collection: string; id: string; body: Body; who: string; saved: Saved }, deps: PressDeps = {}): Promise<Saved | null> {
  const { week, collection, id, body, who, saved } = ctx
  if (!saved.ok) return null
  const now = (deps.now ?? (() => new Date().toISOString()))()
  const rejection = (collection === 'picks' && body.kind === 'reject_asset') || (collection === 'queue' && body.use === 'not_for_us')
  if (rejection) {
    const row = inboxRow(week, collection, id, saved.revision, body, now)
    if (!row) return null
    try {
      const filed = await db.from('taste_rejection_inbox').upsert(row, { onConflict: 'emitter_id,client_report_id', ignoreDuplicates: true })
      return { ...saved, inbox: filed.error ? 'failed' : 'filed' }
    } catch {
      return { ...saved, inbox: 'failed' }
    }
  }
  if (collection === 'picks' && body.kind === 'approve_scripts' && body.approved === true) {
    let result: SendResult
    try {
      const send = deps.send ?? (async (input: SendApprovedInput) => (await import('../_teleprompter.js')).sendApprovedScripts(input))
      result = await send(await sendInput(id, body, who, now))
    } catch (error) {
      result = { status: 'error', error: String((error as Error)?.message || error).slice(0, 300) }
    }
    const answer = { status: result.status, at: now, by: 'content-engine server',
      ...(result.folder_id ? { folder_id: result.folder_id } : {}), ...(result.scripts ? { scripts: result.scripts } : {}), ...(result.error ? { error: result.error } : {}) }
    // His approval and what the send did, in one document: a session finishing a no_key send reads both together.
    const again = await db.rpc('board_save', { p_week: week, p_collection: collection, p_id: id, p_body: { ...body, send: answer }, p_revision: saved.revision, p_actor: who })
    if (!again.error && again.data?.ok) return { ...again.data, send: answer }
    return { ...saved, send: answer, send_recorded: false }
  }
  return null
}
