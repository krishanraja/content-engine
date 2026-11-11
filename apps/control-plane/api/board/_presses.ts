import type { SupabaseClient } from '@supabase/supabase-js'
import { DECISION_ID, GATE_KINDS, canonical, digest, type GateKind } from './_contracts.js'
import type { SendApprovedInput, SendResult } from '../_teleprompter.js'
import type { Making, MakingGates } from '../_making.js'
import { dispatchOffdayRevise, type ReviseDispatch } from './_offdayRevise.js'
import { recordIncident, stageOfAsset, type Incident } from '../_incidents.js'
import { optionSha } from './_gate.js'
import { dayDate, type PostedDay } from './_posted.js'

const PIECE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// What Krish's presses on the publish board do beyond saving the board document (docs/PUBLISH_BOARDS.md, "His
// presses"). Each runs on the server, after his document is saved, so a session never stands in for his press:
//
//   - Approve scripts (picks/<day>-scripts, approved: true): before the save, the hash of each cut's words is worked
//     out here from the words he saw (texts), so his approval binds exactly those. After it, the server reads the
//     piece's making record and sends only words the scripts' check passed and two fresh readers read back (house rule
//     R7), the same gate as teleprompter_send.py plan; any other words, his own saved edits included, are held for a
//     session to check first. It sends them to Teleprompter itself (sendApprovedScripts,
//     apps/control-plane/api/_teleprompter.ts), records a send that read back on the piece's making record
//     (teleprompterPatch, merged as the making route merges it), and writes the answer (sent, held, no_key, refused or
//     error) into the same document as `send`, so a session can finish a send the server could not. Krish, 2026-10-28:
//     "Once I approve, the two scripts will go to teleprompter", and "Server sends directly". That second revision is
//     the server's: board_history names Krish for it, because the approval must stay his document for
//     teleprompter_send.py to count it, and send.by says who wrote the answer.
//   - Approve or Skip on an off-day piece he records (queue/off-<day>-<option>, kind recorded; Ruling, Krish,
//     2026-10-29: an idea he drops in can be a Tuesday, Thursday, Saturday or Sunday piece, one short cut, said to camera
//     or a voiceover over motion graphics). Before the save the hash of the exact words he saw is worked out here. After
//     it the server puts the piece on its day in its series (placeOffday: scheduled_for, in flight, meta.offday, and a
//     scripts' check of one short cut holding those words' hash and the read-back the board's build required), sends the
//     words to Teleprompter in the piece's folder with his press as the approval, records a send that read back, and
//     writes the answer into the same document as send. A Skip after an Approve takes the piece off its day unless it is
//     recorded; nothing in Teleprompter is touched.
//   - Scores (picks/score-<piece>, on a day tab or in the Archive): one piece_scores row, his narrative and production
//     marks out of 10, at publish or in hindsight, and his note; history kept, a save again files nothing twice.
//   - The production gates (picks/<day>-storyboard, -style, -proof, -cut; docs/PUBLISH_BOARDS.md, "The production gates
//     on a day's tab"): his press is written onto the piece's making record as meta.making.gates.<gate> (storyboard,
//     style, proof, final), bound to the sha256 of what the tab showed him, with the same guarded write Approve scripts
//     records its send with (recordGate). A style pick carries his verdict on every style shown (verdicts), which the
//     engine's verdict writer folds into config/style-references.json; the server never edits that file. His words on a
//     Reject of the proof, or on "None of these" styles, go to his taste ledger as krish_words (gateReport).
//   - Reject asset (picks/<day>-reject-<asset>): one row in the rejection inbox (taste_rejection_inbox), his reason as
//     he typed it, where and when, the piece, the formats and the asset's Drive id and moment when the board knows
//     them. Masters are never copied anywhere: a Drive id is a pointer.
//
//   - Approve on a publishing day's idea (picks/<day>; the ideas gate, docs/PUBLISH_BOARDS.md, "The ideas gate"; Krish,
//     2026-11-11: "If they're approved, they should move into the publish board"): before the save the hash of the words
//     he saw is worked out here (option_sha256), so his approval binds exactly those. The database records the approval
//     from the saved revision (idea_outcomes), and after the save the server puts that idea on its day (placePick). The
//     database refuses the placement unless that approval stands, whoever writes it.
//   - Reject and Improve for a future piece on a publishing day's idea (queue/<pick>, use not_for_us or improve): his
//     words go to his taste ledger once, as his own words (ideaReport), and the outcome is kept for the next ideas run.
//
// A Reject on an idea files no rejection inbox row: an idea is a subject, and the rejection floor holds rules of form
// and process only, while the inspirationhouse rejection job files every inbox row as one of those. The inspirationhouse
// cue run reads the press from the board itself (src/collect/feedbackCues.ts) as a not_for_us cue.
//
// The inbox row's client_report_id is the hash of the week, the document and his words, so a press saved again files
// nothing twice, and new words file once more.
//
// The failure loop (Krish, 2026-11-04: "how can your system autonomously understand the difference between a repeated
// failure, why it happened, what was being done when the failure occurred and how it was being done"): a Reject asset,
// a Reject of the proof, "None of these" styles and a second proof round each also write one engine_incidents row
// (pressIncidents, _incidents.ts) with his words and the piece's preflight receipt as it stood. Never blocking: a
// failed write is logged, and the press answers as it would have.

export type Sender = (input: SendApprovedInput) => Promise<SendResult>
export interface PressDeps { send?: Sender; now?: () => string; revise?: typeof import('./_offdayRevise.js').dispatchOffdayRevise }
type Body = Record<string, unknown>
type Saved = { ok: boolean; revision?: number; body?: Body; [key: string]: unknown }
export class PressError extends Error { constructor(public status: number, message: string) { super(message) } }

const isObj = (v: unknown): v is Body => !!v && typeof v === 'object' && !Array.isArray(v)
const REPOSITORY = 'krishanraja/content-engine'
const EMITTER = 'content-engine/publish-board'
const SERVER = 'content-engine server'
const SHA256 = /^[a-f0-9]{64}$/
const CUT_NAME: Record<string, string> = { long: '5-minute', short: '90-second', feature: '15-minute feature' }
// making.py READ_BACK_FOUND and READ_BACK_KRISH: the readers found nothing that loses them, or Krish read the words
// himself and signed them off in his own words.
const READ_BACK_FOUND = 'nothing lost'
const READ_BACK_KRISH = 'approved by Krish'
const THEN = 'so nothing was sent: a session checks them (making.py scripts), has two fresh readers read them back, then '
  + 'sends exactly these words (teleprompter_send.py plan)'

/** His Approve scripts body with the hash of each cut's words worked out here (scripts), or refused when the hashes it
 *  brought are not the hashes of its words. Any other body is returned as it came. */
export async function preparePress(collection: string, id: string, body: Body): Promise<Body> {
  // An answer on a publishing day's idea (his Approve, picks/<day>, or one of the other four, queue/<pick>): the hash of
  // the words he saw, worked out here from the two the press carries, so an approval binds exactly those words.
  const ideaPress = (collection === 'picks' && /^(mon|wed|fri)$/.test(id) && !('kind' in body))
    || (collection === 'queue' && 'use' in body && body.use !== 'offday' && !String(id).startsWith('off-'))
  if (ideaPress && (typeof body.so_what === 'string' || typeof body.story === 'string')) {
    const sha = optionSha({ so_what: body.so_what, story: body.story })
    if (body.option_sha256 !== undefined && body.option_sha256 !== sha) throw new PressError(400, 'approval_hash_mismatch')
    return { ...body, option_sha256: sha }
  }
  if (isRecordedOffday(collection, body) && body.approved === true) {
    // His Approve on an off-day piece he records: the hash of the exact words he saw, worked out here, so his approval
    // binds those words (the same as Approve scripts, for the one short cut).
    const { scriptHash } = await import('../_teleprompter.js')
    const sha = scriptHash(String(body.script))
    if (body.script_sha256 !== undefined && body.script_sha256 !== sha) throw new PressError(400, 'approval_hash_mismatch')
    return { ...body, script_sha256: sha, scripts: { short: sha } }
  }
  if (collection !== 'picks' || body.kind !== 'approve_scripts' || body.approved !== true || !isObj(body.texts)) return body
  const { scriptHash } = await import('../_teleprompter.js')
  const scripts: Record<string, string> = {}
  for (const [cut, text] of Object.entries(body.texts)) scripts[cut] = scriptHash(String(text))
  if (isObj(body.scripts) && Object.entries(body.scripts).some(([cut, sha]) => scripts[cut] !== sha)) throw new PressError(400, 'approval_hash_mismatch')
  if (!DECISION_ID.test(id)) throw new PressError(400, 'invalid_document_write')
  return { ...body, scripts }
}

/** Why these words may not go to Teleprompter yet, or null: the gate teleprompter_send.py plan holds a session to. The
 *  scripts' check passed on the piece's making record, each cut's words are the words it passed (the script file, or
 *  its spoken words), and two fresh readers read exactly those words back with nothing lost (making.py read_back_of). */
export async function heldBecause(making: unknown, texts: Record<string, string>): Promise<string | null> {
  const { scriptHash, spokenText } = await import('../_teleprompter.js')
  const check = isObj(making) && isObj(making.script_check) ? making.script_check : null
  if (!check || check.passed !== true) return `these words have not passed the scripts' check, ${THEN}`
  const hashes = isObj(check.hashes) ? check.hashes : {}, reads = isObj(check.read_back) ? check.read_back : {}
  for (const [cut, text] of Object.entries(texts)) {
    const name = `the ${CUT_NAME[cut] || cut} script`, sha = hashes[cut], read = reads[cut]
    if (typeof sha !== 'string' || !SHA256.test(sha)) return `${name} has no checked words on the piece's record, ${THEN}`
    if (scriptHash(text) !== sha && scriptHash(spokenText(text)) !== sha) return `${name} is not the words the scripts' check passed (were they changed since?), ${THEN}`
    const heard = isObj(read) && read.script_sha256 === sha && (read.found === READ_BACK_FOUND
      || (read.found === READ_BACK_KRISH && typeof read.krish_words === 'string' && read.krish_words.trim().toLowerCase().startsWith('krish')
        // His sign-off records his approval and never stands in for the readers, unless his words skipped them (F45).
        && ((Array.isArray(read.readers) && read.readers.length >= 2) || read.readers_skipped === true)))
    if (!heard) return `${name} has not been read back by two fresh readers, ${THEN}`
  }
  return null
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
    piece_id: String(body.piece_id), day: body.day as SendApprovedInput['day'], folder_title: String(body.folder_title),
    ...(typeof body.folder_id === 'string' ? { folder_id: body.folder_id } : {}),
    scripts, approval: { id, updated_by: who, updated_at: at, body },
  }
}

/** The piece's row as the making route reads it (content_ideas.meta.making), or null when it cannot be read. */
async function makingOf(db: SupabaseClient, pieceId: string): Promise<{ meta: Body; making: Making | null; updated_at: string } | null> {
  const read = await db.from('content_ideas').select('meta, updated_at').eq('id', pieceId).maybeSingle()
  if (read.error || !read.data) return null
  const meta = isObj(read.data.meta) ? read.data.meta : {}
  return { meta, making: isObj(meta.making) ? meta.making as unknown as Making : null, updated_at: String(read.data.updated_at) }
}

/** Records a send that read back on the piece's making record, merged as the making route merges a patch
 *  (api/content-ideas/[id]/making.ts: mergeMaking, guarded on the row's updated_at, read again once on a stale row),
 *  so teleprompter_send.py pending sees it and no session sends it twice. Why it was not recorded, or null. */
async function recordSend(db: SupabaseClient, input: SendApprovedInput, result: SendResult, now: string): Promise<string | null> {
  const { teleprompterPatch } = await import('../_teleprompter.js')
  const { mergeMaking } = await import('../_making.js')
  for (let tries = 0; tries < 2; tries++) {
    const row = await makingOf(db, input.piece_id)
    if (!row) return 'the piece\'s making record could not be read'
    const check = row.making?.script_check
    const patch = teleprompterPatch(input, result, { by: SERVER, now, fileHashes: isObj(check?.hashes) ? check!.hashes! : {} })
    if (!patch) return 'the piece\'s checked words changed while the scripts were sent'
    const written = await db.from('content_ideas').update({ meta: { ...row.meta, making: mergeMaking(row.making, patch, SERVER, now) }, updated_at: now })
      .eq('id', input.piece_id).eq('updated_at', row.updated_at).select('id')
    if (written.error) return 'the piece\'s making record could not be written'
    if (written.data?.length) return null
  }
  return 'the piece changed twice while the send was being recorded'
}

/** The gate object his press writes on the piece's making record (meta.making.gates), from his saved document. Only
 *  what the gate needs: who, when, the hash of what the tab showed, and the gate's own answer. */
export function gatePatch(kind: GateKind, body: Body, now: string): MakingGates {
  const base = { by: 'Krish' as const, at: now, sha256: String(body.sha256) }
  const said = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 2000) : undefined)
  if (kind === 'sign_storyboard') return { storyboard: base }
  if (kind === 'approve_cut') return { final: { ...base, ...(isObj(body.cuts) ? { cuts: body.cuts as Record<string, string> } : {}) } }
  if (kind === 'approve_proof') {
    const words = said(body.words)
    return { proof: { ...base, verdict: body.verdict === 'reject' ? 'reject' : 'approve', ...(words ? { words } : {}),
      ...(typeof body.cut === 'string' ? { cut: body.cut as 'long' | 'short' | 'feature' } : {}) } }
  }
  const reason = said(body.reason)
  const verdicts = (Array.isArray(body.verdicts) ? body.verdicts : []).filter(isObj).map(v => ({
    module: String(v.module), verdict: v.verdict as 'picked' | 'seen' | 'not_for_us', ...(typeof v.sha256 === 'string' ? { sha256: v.sha256 } : {}) }))
  return { style: { ...base, module: typeof body.module === 'string' ? body.module : null, ...(reason ? { reason } : {}), verdicts } }
}

/** Layout v4's Sign creative onto the piece's making record: gates.creative always (his picks, or his words sending the
 *  sheet back), and when he signed, gates.storyboard bound to the hash ve's storyboard gate reads and gates.style with
 *  his motion pick and the other styles the sheet showed as seen, so ve reads both where it always has. */
export function creativePatch(body: Body, now: string): MakingGates {
  const base = { by: 'Krish' as const, at: now }
  const words = typeof body.words === 'string' && body.words.trim() ? body.words.trim().slice(0, 2000) : undefined
  const picks = (isObj(body.picks) ? body.picks : {}) as Record<string, string>
  const out: MakingGates = { creative: { ...base, sha256: String(body.sha256), approved: body.approved === true, picks: { ...picks }, ...(words ? { words } : {}) } }
  if (body.approved === true) {
    if (typeof body.storyboard_sha256 === 'string') out.storyboard = { ...base, sha256: body.storyboard_sha256 }
    const shown = Array.isArray(body.shown) ? (body.shown as string[]) : [picks.motion]
    out.style = { ...base, sha256: String(body.sha256), module: picks.motion ?? null,
      verdicts: [...new Set([picks.motion, ...shown])].filter(Boolean).map(m => ({ module: m, verdict: m === picks.motion ? 'picked' as const : 'seen' as const })) }
  }
  return out
}

/** His words sending a creative sheet back, as one taste_reports row, verbatim with where and when; null otherwise. */
export function creativeReport(week: string, id: string, body: Body, now: string) {
  const words = typeof body.words === 'string' ? body.words.trim().slice(0, 2000) : ''
  if (body.approved !== false || !words) return null
  const piece = typeof body.piece_id === 'string' && PIECE_UUID.test(body.piece_id) ? body.piece_id : null
  return {
    kind: 'krish_words', body: words, said_where: `publish board, ${week} picks/${id}`, said_at: now,
    lane: 'production', polarity: 'dislikes', subject_ref: piece ? `piece:${piece}` : null,
    subject: `the pre-production sheet for the ${String(body.day)} piece of the week of ${week}`,
    session_ref: 'content.krishraja.com publish board', repository: REPOSITORY, surface: 'publish_board',
    emitter_id: 'content-engine-board',
    client_report_id: `creative-${digest(canonical({ week, id, words, sha: body.sha256 }))}`.slice(0, 96),
    reported_at: now, meta: { press: 'change_creative', week, day: body.day, gate: 'creative' },
  }
}

/** His press on a production gate onto the piece's making record, merged gate by gate (mergeMaking) and guarded on the
 *  row's updated_at, read again once on a stale row: the same write recordSend makes. Why it was not written, or null. */
export async function recordGate(db: SupabaseClient, pieceId: string, patch: MakingGates, now: string): Promise<string | null> {
  const { mergeMaking } = await import('../_making.js')
  for (let tries = 0; tries < 2; tries++) {
    const row = await makingOf(db, pieceId)
    if (!row) return 'the piece\'s making record could not be read'
    const written = await db.from('content_ideas').update({ meta: { ...row.meta, making: mergeMaking(row.making, { gates: patch }, SERVER, now) }, updated_at: now })
      .eq('id', pieceId).eq('updated_at', row.updated_at).select('id')
    if (written.error) return 'the piece\'s making record could not be written'
    if (written.data?.length) return null
  }
  return 'the piece changed twice while his press was being recorded'
}

/** The engine_incidents rows a press means (the failure loop): his Reject asset, his Reject of the proof, "None of
 *  these" styles with his words, and a proof press after a rejected proof (a second round). `prior` is the piece's
 *  gates before this press. Empty when the press is none of these. */
export function pressIncidents(week: string, id: string, body: Body, prior: MakingGates | null | undefined): Incident[] {
  const piece = typeof body.piece_id === 'string' && PIECE_UUID.test(body.piece_id) ? body.piece_id : null
  const words = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, 2000) : null)
  const sha = typeof body.sha256 === 'string' && SHA256.test(body.sha256) ? body.sha256 : null
  const base = { piece_id: piece, session_ref: `publish-board:${week}:picks/${id}`, maker: 'unknown' as const, meta: { week, day: body.day, doc: `picks/${id}` } }
  const out: Incident[] = []
  if (body.kind === 'reject_asset' && words(body.reason)) {
    const drive = typeof body.drive_id === 'string' ? body.drive_id : null
    out.push({ ...base, kind: 'krish_reject', stage: stageOfAsset(body.asset, body.label), his_words: words(body.reason),
      artifact_ref: drive ? `drive:${drive}` : typeof body.asset === 'string' ? `board-asset:${body.asset}`.slice(0, 500) : null,
      meta: { ...base.meta, press: 'reject_asset', asset: body.asset ?? null, label: body.label ?? null, formats: Array.isArray(body.formats) ? body.formats.slice(0, 16) : [] },
      client_ref: `press-${digest(canonical({ week, id, kind: body.kind, reason: words(body.reason) }))}`.slice(0, 120) })
  }
  if (body.kind === 'approve_proof') {
    const priorProof = prior && isObj(prior.proof) ? prior.proof : null
    if (body.verdict === 'reject' && words(body.words)) {
      out.push({ ...base, kind: 'krish_reject', stage: 'proof', maker: 've', his_words: words(body.words), artifact_sha256: sha,
        artifact_ref: typeof body.cut === 'string' ? `proof:${body.cut}` : 'proof', meta: { ...base.meta, press: 'reject_proof' },
        client_ref: `press-${digest(canonical({ week, id, kind: body.kind, verdict: 'reject', sha, words: words(body.words) }))}`.slice(0, 120) })
    }
    if (priorProof && priorProof.verdict === 'reject' && priorProof.sha256 !== sha) {
      out.push({ ...base, kind: 'second_round', stage: 'proof', maker: 've', artifact_sha256: sha, meta: { ...base.meta, press: 'proof_after_reject', prior_sha256: priorProof.sha256 },
        client_ref: `round-${digest(canonical({ week, id, prior: priorProof.sha256, sha }))}`.slice(0, 120) })
    }
  }
  if (body.kind === 'pick_style' && body.module === null && words(body.reason)) {
    out.push({ ...base, kind: 'krish_reject', stage: 'style', maker: 've', his_words: words(body.reason), artifact_sha256: sha,
      artifact_ref: 'styles', meta: { ...base.meta, press: 'none_of_these' },
      client_ref: `press-${digest(canonical({ week, id, kind: body.kind, sha, reason: words(body.reason) }))}`.slice(0, 120) })
  }
  return out
}

/** Files the incidents a press means, never blocking it: 'filed', 'failed' or null when there are none. */
async function fileIncidentsFor(db: SupabaseClient, incidents: Incident[], now: string): Promise<'filed' | 'failed' | null> {
  if (!incidents.length) return null
  let ok = true
  for (const incident of incidents) {
    const result = await recordIncident(db, incident, now).catch(() => 'failed' as const)
    ok = ok && result === 'filed'
  }
  return ok ? 'filed' : 'failed'
}

/** His words on a gate he turned down (a Reject of the proof, or "None of these" styles), as one taste_reports row:
 *  his typed words with where and when, never a sentence the engine wrote. Null when the press carries no such words. */
export function gateReport(week: string, id: string, body: Body, now: string) {
  const reject = body.kind === 'approve_proof' && body.verdict === 'reject'
  const none = body.kind === 'pick_style' && body.module === null
  const words = typeof (reject ? body.words : body.reason) === 'string' ? String(reject ? body.words : body.reason).trim().slice(0, 2000) : ''
  if (!(reject || none) || !words) return null
  const piece = typeof body.piece_id === 'string' && PIECE_UUID.test(body.piece_id) ? body.piece_id : null
  const what = reject ? 'moving proof' : 'motion styles shown'
  return {
    kind: 'krish_words', body: words, said_where: `publish board, ${week} picks/${id}`, said_at: now,
    lane: 'production', polarity: 'dislikes',
    subject_ref: piece ? `piece:${piece}` : null,
    subject: `the ${what} for the ${String(body.day)} piece of the week of ${week}`,
    session_ref: 'content.krishraja.com publish board', repository: REPOSITORY, surface: 'publish_board',
    emitter_id: 'content-engine-board',
    // The same words on the same thing shown file nothing twice; new words, or a new clip, file once more.
    client_report_id: `gate-${digest(canonical({ week, id, words, sha: body.sha256 }))}`.slice(0, 96),
    reported_at: now,
    meta: { press: reject ? 'reject_proof' : 'none_of_these', week, day: body.day, gate: GATE_KINDS[body.kind as GateKind] },
  }
}

/** The piece_scores row for his Scores press (supabase/migrations/20261118090000_piece_scores.sql). The board's
 *  access-cookie actor is Krish, so his press is scored_by krish; only his writes reach here (hisOnlyRefusal). */
/** His thoughts on a day's post (or an older Liked or Not it press), as one taste_reports row. His typed words are
 *  krish_words with where and when; a bare press is an observation saying what he pressed, never words put in his mouth. */
export function feelReport(week: string, id: string, body: Body, now: string) {
  const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 2000) : null
  const piece = typeof body.piece_id === 'string' && PIECE_UUID.test(body.piece_id) ? body.piece_id : null
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 300) : null
  const what = body.feel === 'liked' ? 'Liked' : body.feel === 'not_it' ? 'Not it' : null
  return {
    kind: note ? 'krish_words' : 'observation',
    body: note ?? `Krish pressed ${what} on the publish board for ${String(body.day)} of the week of ${week}${title ? `: ${title}` : ''}.`,
    said_where: note ? `publish board, ${week} picks/${id}` : null,
    said_at: note ? now : null,
    lane: 'production',
    polarity: body.feel === 'liked' ? 'likes' : body.feel === 'not_it' ? 'dislikes' : 'neutral',
    subject_ref: piece ? `piece:${piece}` : null,
    subject: piece ? (title || `the ${String(body.day)} post of the week of ${week}`) : null,
    session_ref: 'content.krishraja.com publish board',
    repository: 'krishanraja/content-engine',
    surface: 'publish_board',
    emitter_id: 'content-engine-board',
    // The same press saved again files nothing twice; a changed press is a new row.
    client_report_id: `feel-${digest(canonical({ week, id, feel: body.feel, note, piece }))}`.slice(0, 96),
    reported_at: now,
    meta: { press: what ? body.feel : 'note', week, day: body.day },
  }
}

/** His words on an off-day option, one taste_reports row per side he improved or rejected (Ruling, Krish,
 *  2026-11-01: "...approve or improve or flat out reject for a reason, and the machine can learn over time"). */
export function offdayReports(week: string, id: string, body: Body, now: string) {
  const out: Array<ReturnType<typeof offdayRow>> = []
  for (const side of ['idea', 'direction', 'mock']) {
    const v = body[side] as Record<string, unknown> | undefined
    if (!v || (v.verdict !== 'improve' && v.verdict !== 'reject')) continue
    const words = typeof v.words === 'string' ? v.words.trim().slice(0, 2000) : ''
    if (!words) continue
    out.push(offdayRow(week, id, body, side, v.verdict as string, words, v.sha256, now))
  }
  // His open words on the option, filed verbatim (line breaks kept); a note never starts a revision.
  const note = isObj(body.note) && typeof body.note.words === 'string' && body.note.words.trim() ? body.note.words.slice(0, 2000) : ''
  if (note) out.push(offdayRow(week, id, body, 'note', 'note', note, null, now))
  return out
}

function offdayRow(week: string, id: string, body: Body, side: string, verdict: string, words: string, sha: unknown, now: string) {
  const what = typeof body.format === 'string' ? body.format.slice(0, 200) : 'off-day post'
  return {
    kind: 'krish_words', body: words, said_where: `publish board, ${week} queue/${id} (${side})`, said_at: now,
    lane: 'production', polarity: verdict === 'reject' ? 'dislikes' : 'neutral',
    subject_ref: `offday:${week}:${id}`, subject: `the ${side === 'note' ? 'notes on' : side + ' of'} the ${String(body.day)} off-day option (${what})`,
    session_ref: 'content.krishraja.com publish board', repository: 'krishanraja/content-engine', surface: 'publish_board',
    emitter_id: 'content-engine-board',
    client_report_id: `offday-${digest(canonical({ week, id, side, verdict, words, sha }))}`.slice(0, 96),
    reported_at: now,
    meta: { press: verdict, verdict, side, week, day: body.day, option: id } as Record<string, unknown>,
  }
}

export function scoreRow(week: string, id: string, body: Body, now: string) {
  const note = typeof body.note === 'string' && body.note.trim() ? body.note : null
  return {
    piece_id: String(body.piece_id),
    narrative: Number(body.narrative),
    production: Number(body.production),
    basis: String(body.basis),
    scored_by: 'krish',
    note,
    scored_at: now,
    said_where: `publish board, ${week} picks/${id}`,
    // The same marks and note saved again file nothing twice; a changed score is a new row (history kept).
    client_report_id: digest(canonical({ week, collection: 'picks', id, narrative: body.narrative, production: body.production, basis: body.basis, note })),
  }
}
// The table is made by the Wave 2 migration batch, applied after Krish's yes. Until then a Scores press is kept as his
// board document and the answer says the score waits on the migration, so nothing is lost and nothing crashes.
const MISSING_TABLE = new Set(['42P01', 'PGRST205'])
// A column not made yet (content_ideas.title, 20261120090000_content_ideas_title.sql): Postgres and PostgREST codes.
const MISSING_COLUMN = new Set(['42703', 'PGRST204'])

/** One title of record (Krish, 2026-10-31: the board's titles did not match the article's): his long_title pick on the
 *  Titles press becomes content_ideas.title, the title the board and every reader show. Until the column's migration
 *  runs the press stays his board document and the answer says the title waits on it. */
export async function recordTitle(db: SupabaseClient, body: Body): Promise<'recorded' | 'waits_on_migration' | 'failed' | null> {
  const picks = isObj(body.picks) ? body.picks : {}
  const title = typeof picks.long_title === 'string' ? picks.long_title.trim() : ''
  const piece = typeof body.piece_id === 'string' ? body.piece_id : ''
  if (!title || !piece) return null
  try {
    const written = await db.from('content_ideas').update({ title }).eq('id', piece).select('id')
    const code = String((written.error as { code?: string } | null)?.code || '')
    if (written.error) return MISSING_COLUMN.has(code) ? 'waits_on_migration' : 'failed'
    return written.data?.length ? 'recorded' : 'failed'
  } catch {
    return 'failed'
  }
}

/** The rejection inbox row for a Reject asset press with his reason, or null when it has none. */
function inboxRow(week: string, id: string, revision: number | undefined, body: Body, now: string) {
  const reason = String(body.reason || '').trim()
  if (!reason) return null
  const drive = typeof body.drive_id === 'string' ? body.drive_id : null
  const atMs = drive && Number.isSafeInteger(body.at_ms) ? Number(body.at_ms) : null
  const label = String(body.label || '').trim()
  return {
    kind: 'rejected',
    said: reason,
    said_where: `publish board, ${week} ${String(body.day)}`,
    said_at: now,
    piece: String(body.piece_id || '') || null,
    formats: Array.isArray(body.formats) ? body.formats.map(String).slice(0, 16) : [],
    // The board's words about what was on screen: context, never his words.
    note: label ? `Asset rejected on the Publish step: ${label}`.slice(0, 2000) : null,
    master_drive_id: drive,
    at_ms: atMs,
    whole_cut: !!drive && atMs === null,
    session_ref: `publish-board:${week}:picks/${id}${revision ? `@${revision}` : ''}`,
    repository: REPOSITORY,
    surface: 'publish_board',
    emitter_id: EMITTER,
    client_report_id: `board-${digest(canonical({ week, collection: 'picks', id, reason })).slice(0, 40)}`,
    meta: { board: { week, collection: 'picks', doc_id: id, revision }, asset: body.asset, label: body.label },
  }
}

/** An off-day option he records (api/board/_contracts.ts recordedOffday): queue/off-<day>-<option>, kind recorded. */
function isRecordedOffday(collection: string, body: Body): boolean {
  return collection === 'queue' && body.use === 'offday' && body.kind === 'recorded'
}

const OFF_OFFSET: Record<string, number> = { tue: 1, thu: 3, sat: 5, sun: 6 }
/** The date an off day falls on in the board's week (its Monday), YYYY-MM-DD. */
export function offdayDate(week: string, day: string): string {
  const d = new Date(`${week}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + (OFF_OFFSET[day] ?? 0))
  return d.toISOString().slice(0, 10)
}
const UNPICKED = ['seeded', 'researching']

/** The piece's row with the off day on it, or why it cannot hold it. Approved: the piece goes on its day in its
 *  series, in flight (drafting), with the option he approved and its exact words (meta.offday) and a scripts' check of
 *  one short cut (one_cut) holding the hash of those words and the read-back the board's build required, so
 *  recording_match.py waits for his take. Skipped after an approval: the piece comes off the day and back to the state
 *  it was in, unless he has recorded it; nothing in Teleprompter is touched (nothing there is ever deleted). Guarded on
 *  the row's updated_at, read again once on a stale row. */
export async function placeOffday(db: SupabaseClient, ctx: { week: string; id: string; body: Body; who: string; now: string }): Promise<{ ok: true; making: Making | null; changed: boolean } | { ok: false; error: string }> {
  const { week, id, body, who, now } = ctx
  const { mergeMaking } = await import('../_making.js')
  const pieceId = String(body.piece_id), date = offdayDate(week, String(body.day)), sha = String(body.script_sha256 || '')
  for (let tries = 0; tries < 2; tries++) {
    const read = await db.from('content_ideas').select('id, state, scheduled_for, lane_slot, meta, buried_at, updated_at').eq('id', pieceId).maybeSingle()
    if (read.error) return { ok: false, error: 'the idea could not be read' }
    if (!read.data) return { ok: false, error: 'the idea is not in the engine' }
    const row = read.data as Record<string, any>
    const meta: Body = isObj(row.meta) ? row.meta : {}
    const prev = isObj(meta.making) ? meta.making as unknown as Making : null
    const was: Body = isObj(meta.offday) ? meta.offday : {}
    let update: Body
    if (body.approved === true) {
      if (row.buried_at || row.state === 'published') return { ok: false, error: 'the idea is already published or buried' }
      if (row.scheduled_for && row.scheduled_for !== date && !UNPICKED.includes(row.state) && was.doc !== `queue/${id}`)
        return { ok: false, error: `the idea is already on ${row.scheduled_for}` }
      const check = prev?.script_check
      const same = check?.one_cut === true && check.hashes?.short === sha
      const readers = Array.isArray(body.readers) ? (body.readers as unknown[]).map(String).filter(Boolean).slice(0, 6) : []
      const making = mergeMaking(prev, {
        script_check: {
          passed: true, problems: [], one_cut: true, cuts: ['short'], hashes: { short: sha },
          checked_at: same && check?.checked_at ? check.checked_at : now,
          changed_at: { short: same && check?.changed_at?.short ? check.changed_at.short : now },
          ...(readers.length >= 2 ? { read_back: { short: { script_sha256: sha, at: now, by: 'week_board.py', readers, found: 'nothing lost' as const } } } : {}),
        },
      }, SERVER, now)
      const offday = {
        week, day: body.day, date, doc: `queue/${id}`, option_id: body.option_id ?? null, style: body.style, series: body.series,
        title: body.title, folder_title: body.folder_title, script: body.script, script_sha256: sha,
        approved_by: who, approved_at: now, prior_state: was.doc === `queue/${id}` && was.prior_state ? was.prior_state : row.state,
      }
      update = { scheduled_for: date, lane_slot: body.series, state: UNPICKED.includes(row.state) ? 'drafting' : row.state,
        meta: { ...meta, offday, making }, updated_at: now }
    } else {
      if (was.doc !== `queue/${id}` || was.withdrawn_at) return { ok: true, making: prev, changed: false }
      if ((prev?.recordings || []).length) return { ok: false, error: 'it is already recorded, so it stays on its day' }
      update = { scheduled_for: null, state: typeof was.prior_state === 'string' ? was.prior_state : row.state,
        meta: { ...meta, offday: { ...was, withdrawn_at: now, withdrawn_by: who } }, updated_at: now }
    }
    const written = await db.from('content_ideas').update(update).eq('id', pieceId).eq('updated_at', row.updated_at).select('id')
    if (written.error) return { ok: false, error: 'the idea could not be written' }
    if (written.data?.length) return { ok: true, making: (update.meta as Body).making as Making ?? prev, changed: true }
  }
  return { ok: false, error: 'the idea changed twice while it was being put on its day' }
}

/** His press on an off-day option he records: the piece on its day (placeOffday), then, on an Approve, the exact words
 *  he saw sent to Teleprompter in the piece's folder as its one short script, his press as the approval, and what
 *  happened written into the same document as send. */
async function offdayRecorded(db: SupabaseClient, ctx: { week: string; id: string; body: Body; who: string; saved: Saved }, now: string, deps: PressDeps): Promise<Saved | null> {
  const { week, id, body, who, saved } = ctx
  let answer: Body
  type Placed = Awaited<ReturnType<typeof placeOffday>>
  const placed: Placed = await placeOffday(db, { week, id, body, who, now }).catch((): Placed => ({ ok: false, error: 'the idea could not be written' }))
  if (placed.ok === false) answer = { status: 'refused', at: now, by: SERVER, error: placed.error }
  else if (body.approved !== true) return placed.changed ? { ...saved, placed: 'withdrawn' } : null
  else {
    const { scriptHash, spokenText } = await import('../_teleprompter.js')
    const tp = placed.making?.teleprompter
    const text = spokenText(String(body.script))
    const input: SendApprovedInput = {
      piece_id: String(body.piece_id), day: body.day as SendApprovedInput['day'], folder_title: String(body.folder_title),
      ...(tp?.folder_id ? { folder_id: tp.folder_id } : {}),
      scripts: [{ cut: 'short', title: String(body.title), text, sha256: scriptHash(text), source: String(body.script),
        ...(tp?.cuts?.short?.script_id ? { script_id: tp.cuts.short.script_id } : {}) }],
      approval: { id, updated_by: who, updated_at: now, body },
    }
    let result: SendResult
    try {
      const send = deps.send ?? (async (i: SendApprovedInput) => (await import('../_teleprompter.js')).sendApprovedScripts(i))
      result = await send(input)
    } catch (error) {
      result = { status: 'error', error: String((error as Error)?.message || error).slice(0, 300) }
    }
    const unrecorded = result.status === 'sent' ? await recordSend(db, input, result, now).catch(() => 'the piece\'s making record could not be written') : null
    answer = { status: result.status, at: now, by: SERVER, date: offdayDate(week, String(body.day)),
      ...(result.folder_id ? { folder_id: result.folder_id } : {}), ...(result.scripts ? { scripts: result.scripts } : {}), ...(result.error ? { error: result.error } : {}),
      ...(result.status === 'sent' ? { recorded: !unrecorded, ...(unrecorded ? { record_error: unrecorded } : {}) } : {}) }
  }
  const again = await db.rpc('board_save', { p_week: week, p_collection: 'queue', p_id: id, p_body: { ...body, send: answer }, p_revision: saved.revision, p_actor: who })
  if (!again.error && again.data?.ok) return { ...again.data, send: answer }
  return { ...saved, send: answer, send_recorded: false }
}

const PICKABLE = ['seeded', 'researching', 'drafting']
const DAY_ONLY = ['review', 'approved']
/** His Approve on a publishing day's idea puts that idea on its day: in its series, in flight (drafting) when it was not
 *  yet, or only given the day when it is already written; the same write Control Centre's pick makes (contentPick.ts
 *  planPick). The database refuses it unless his approval for that idea and that date stands (content_ideas_board_gate),
 *  so this is the only way an idea crosses, and it crosses only on his press. Guarded on the row's updated_at, read again
 *  once on a stale row. A piece already on another day stays there and the answer says so: he decides, nothing moves it. */
export async function placePick(db: SupabaseClient, ctx: { week: string; day: string; body: Body; now: string }): Promise<{ status: 'placed' | 'already' | 'refused'; date: string; error?: string }> {
  const { week, day, body, now } = ctx
  const date = dayDate(week, day as PostedDay)
  const pieceId = String(body.idea_id || '').toLowerCase()
  if (!PIECE_UUID.test(pieceId)) return { status: 'refused', date, error: 'the idea has no record in the engine, so it cannot go on a day' }
  for (let tries = 0; tries < 2; tries++) {
    const read = await db.from('content_ideas').select('id, state, scheduled_for, lane_slot, buried_at, protected_at, updated_at').eq('id', pieceId).maybeSingle()
    if (read.error) return { status: 'refused', date, error: 'the idea could not be read' }
    if (!read.data) return { status: 'refused', date, error: 'the idea is not in the engine' }
    const row = read.data as Record<string, any>
    if (row.buried_at || row.state === 'dropped' || row.state === 'published') return { status: 'refused', date, error: 'the idea is buried, dropped or already published' }
    if (row.scheduled_for === date) return { status: 'already', date }
    if (row.scheduled_for && row.scheduled_for !== date) return { status: 'refused', date, error: `the idea is already on ${row.scheduled_for}; take it off that day first` }
    let update: Body
    if (PICKABLE.includes(row.state)) update = { state: 'drafting', lane_slot: body.series, scheduled_for: date, ...(row.protected_at ? {} : { protected_at: now }) }
    else if (DAY_ONLY.includes(row.state)) update = { scheduled_for: date }
    else return { status: 'refused', date, error: `the idea is ${row.state}, so it cannot go on a day` }
    const written = await db.from('content_ideas').update({ ...update, updated_at: now }).eq('id', pieceId).eq('updated_at', row.updated_at).select('id')
    if (written.error) {
      const msg = String(written.error.message || '')
      return { status: 'refused', date, error: /not_approved_by_krish/.test(msg) ? 'the database found no approval of yours for it on this day' : 'the idea could not be written' }
    }
    if (written.data?.length) return { status: 'placed', date }
  }
  return { status: 'refused', date, error: 'the idea changed twice while it was being put on its day' }
}

/** His words on a Reject or an Improve for a future piece on a publishing day's idea, for his taste ledger, as said. */
export function ideaReport(week: string, id: string, body: Body, now: string) {
  const use = String(body.use || '')
  const words = (use === 'not_for_us' ? body.reason : body.note)
  if ((use !== 'not_for_us' && use !== 'improve') || typeof words !== 'string' || !words.trim()) return null
  const said = words.trim().slice(0, 2000)
  const idea = typeof body.idea_id === 'string' && PIECE_UUID.test(body.idea_id) ? body.idea_id.toLowerCase() : null
  return {
    kind: 'krish_words', body: said, said_where: `publish board, ${week} queue/${id} (an idea on the ideas board)`, said_at: now,
    // Which story to tell is a strategy call (taste_reports lanes: strategy, production, visibility, voice).
    lane: 'strategy', polarity: use === 'not_for_us' ? 'dislikes' : 'neutral',
    subject_ref: idea ? `idea:${idea}` : null,
    subject: idea ? `the idea "${String(body.so_what || body.story || id).trim().replace(/\s+/g, ' ').slice(0, 160)}"` : null,
    session_ref: 'content.krishraja.com publish board', repository: 'krishanraja/content-engine', surface: 'publish_board',
    emitter_id: 'content-engine-board',
    client_report_id: `idea-${digest(canonical({ week, id, use, words: said }))}`.slice(0, 96),
    reported_at: now,
    meta: { press: use, outcome: use === 'not_for_us' ? 'rejected' : 'improved', week, day: String(id).slice(0, 3), idea_id: body.idea_id ?? null } as Record<string, unknown>,
  }
}

/** The side effects of a saved press, and the answer to send back: the saved document (with send, for Approve
 *  scripts) and, for a rejected asset, whether its inbox row was filed. Null when the press has none. */
export async function afterPress(db: SupabaseClient, ctx: { week: string; collection: string; id: string; body: Body; who: string; saved: Saved }, deps: PressDeps = {}): Promise<Saved | null> {
  const { week, collection, id, body, who, saved } = ctx
  if (!saved.ok) return null
  const now = (deps.now ?? (() => new Date().toISOString()))()
  if (collection === 'picks' && body.kind === 'reject_asset') {
    const row = inboxRow(week, id, saved.revision, body, now)
    if (!row) return null
    const incident = await fileIncidentsFor(db, pressIncidents(week, id, body, null), now)
    try {
      const filed = await db.from('taste_rejection_inbox').upsert(row, { onConflict: 'emitter_id,client_report_id', ignoreDuplicates: true })
      return { ...saved, inbox: filed.error ? 'failed' : 'filed', ...(incident ? { incident } : {}) }
    } catch {
      return { ...saved, inbox: 'failed', ...(incident ? { incident } : {}) }
    }
  }
  if (collection === 'picks' && /^(mon|wed|fri)$/.test(id) && !('kind' in body) && 'pick' in body) {
    // His Approve on a publishing day's idea: it goes on its day (the ideas gate). Only his own press places anything.
    if (who !== 'Krish') return null
    const placed = await placePick(db, { week, day: id, body, now }).catch(() => ({ status: 'refused' as const, date: dayDate(week, id as PostedDay), error: 'the idea could not be written' }))
    return { ...saved, placed }
  }
  if (collection === 'queue' && who === 'Krish' && (body.use === 'not_for_us' || body.use === 'improve')) {
    const report = ideaReport(week, id, body, now)
    if (!report) return null
    try {
      const filed = await db.from('taste_reports').upsert(report, { onConflict: 'emitter_id,client_report_id', ignoreDuplicates: true })
      const code = String((filed.error as { code?: string } | null)?.code || '')
      return { ...saved, taste: !filed.error ? 'filed' : MISSING_TABLE.has(code) ? 'waits_on_migration' : 'failed' }
    } catch {
      return { ...saved, taste: 'failed' }
    }
  }
  if (collection === 'picks' && body.kind === 'scores' && !(typeof body.piece_id === 'string' && PIECE_UUID.test(body.piece_id))) {
    // A post with no piece yet (layout v4, picks/score-<date>): kept on the board until it has one.
    return { ...saved, scores: 'on_board' }
  }
  if (collection === 'picks' && body.kind === 'sign_creative') {
    if (who !== 'Krish') return null
    const unrecorded = await recordGate(db, String(body.piece_id), creativePatch(body, now), now).catch(() => 'the piece\'s making record could not be written')
    const out: Saved = { ...saved, gate: unrecorded ? 'failed' : 'recorded', ...(unrecorded ? { gate_error: unrecorded } : {}) }
    const report = creativeReport(week, id, body, now)
    if (report) {
      try {
        const filed = await db.from('taste_reports').upsert(report, { onConflict: 'emitter_id,client_report_id', ignoreDuplicates: true })
        const code = String((filed.error as { code?: string } | null)?.code || '')
        out.taste = !filed.error ? 'filed' : MISSING_TABLE.has(code) ? 'waits_on_migration' : 'failed'
      } catch {
        out.taste = 'failed'
      }
    }
    return out
  }
  if (collection === 'picks' && body.kind === 'scores') {
    try {
      const filed = await db.from('piece_scores').upsert(scoreRow(week, id, body, now), { onConflict: 'client_report_id', ignoreDuplicates: true })
      const code = String((filed.error as { code?: string } | null)?.code || '')
      return { ...saved, scores: !filed.error ? 'filed' : MISSING_TABLE.has(code) ? 'waits_on_migration' : 'failed' }
    } catch {
      return { ...saved, scores: 'failed' }
    }
  }
  if (collection === 'picks' && body.kind === 'feel') {
    try {
      const filed = await db.from('taste_reports').upsert(feelReport(week, id, body, now), { onConflict: 'emitter_id,client_report_id', ignoreDuplicates: true })
      const code = String((filed.error as { code?: string } | null)?.code || '')
      return { ...saved, taste: !filed.error ? 'filed' : MISSING_TABLE.has(code) ? 'waits_on_migration' : 'failed' }
    } catch {
      return { ...saved, taste: 'failed' }
    }
  }
  if (collection === 'picks' && typeof body.kind === 'string' && Object.hasOwn(GATE_KINDS, body.kind)) {
    // Only his own press reaches here (hisOnlyRefusal); the gate is written as his, never as a session's.
    if (who !== 'Krish') return null
    const kind = body.kind as GateKind
    // The gates before this press, for the failure loop's second-round row; a failed read only loses that row.
    const prior = kind === 'approve_proof' ? await makingOf(db, String(body.piece_id)).catch(() => null) : null
    const unrecorded = await recordGate(db, String(body.piece_id), gatePatch(kind, body, now), now).catch(() => 'the piece\'s making record could not be written')
    const incident = await fileIncidentsFor(db, pressIncidents(week, id, body, prior?.making?.gates), now)
    const out: Saved = { ...saved, gate: unrecorded ? 'failed' : 'recorded', ...(unrecorded ? { gate_error: unrecorded } : {}), ...(incident ? { incident } : {}) }
    const report = gateReport(week, id, body, now)
    if (report) {
      try {
        const filed = await db.from('taste_reports').upsert(report, { onConflict: 'emitter_id,client_report_id', ignoreDuplicates: true })
        const code = String((filed.error as { code?: string } | null)?.code || '')
        out.taste = !filed.error ? 'filed' : MISSING_TABLE.has(code) ? 'waits_on_migration' : 'failed'
      } catch {
        out.taste = 'failed'
      }
    }
    return out
  }
  if (collection === 'picks' && body.kind === 'titles') {
    const title = await recordTitle(db, body)
    return title ? { ...saved, title } : null
  }
  // His verdicts on an off-day option (Ruling, Krish, 2026-11-01): each Improve or Reject goes to his taste ledger in
  // his own words, once (the same words on the same side file nothing twice), and an Improve on the idea or the
  // direction not filed before asks GitHub for a revised card. A mock is Growth's to remake from his words (readPieces
  // hands them over), so it starts no run. A run revises only sides whose hash is still current
  // (scripts/post-pack/offday_pending.py), so a repeated ask never revises a side twice.
  if (collection === 'queue' && body.use === 'offday' && (['idea', 'direction', 'mock'].some(k => k in body) || isObj(body.note))) {
    const rows = offdayReports(week, id, body, now)
    if (!rows.length) return null
    const taste: Record<string, string> = {}
    const revise: Record<string, ReviseDispatch | { sent: false; reason: 'already_asked' }> = {}
    for (const row of rows) {
      const side = String(row.meta.side)
      let fresh = false
      try {
        const filed = await db.from('taste_reports').upsert(row, { onConflict: 'emitter_id,client_report_id', ignoreDuplicates: true }).select('client_report_id')
        const code = String((filed.error as { code?: string } | null)?.code || '')
        taste[side] = !filed.error ? 'filed' : MISSING_TABLE.has(code) ? 'waits_on_migration' : 'failed'
        fresh = !filed.error && Array.isArray(filed.data) && filed.data.length > 0
      } catch {
        taste[side] = 'failed'
      }
      if (row.meta.verdict === 'improve' && side !== 'mock') {
        revise[side] = fresh || taste[side] !== 'filed'
          ? await (deps.revise ?? dispatchOffdayRevise)({ week, option: id })
          : { sent: false, reason: 'already_asked' }
      }
    }
    return { ...saved, taste, ...(Object.keys(revise).length ? { revise } : {}) } as Saved
  }
  // A note added to an off-day option he already pressed changes nothing it did (the handler keeps the press as saved).
  if (collection === 'queue' && body.use === 'offday' && body.note_only === true) return null
  if (isRecordedOffday(collection, body)) return offdayRecorded(db, { week, id, body, who, saved }, now, deps)
  if (collection === 'picks' && body.kind === 'approve_scripts' && body.approved === true) {
    let result: Omit<SendResult, 'status'> & { status: SendResult['status'] | 'held' }
    let unrecorded: string | null = null
    try {
      const input = await sendInput(id, body, who, now)
      const row = await makingOf(db, input.piece_id)
      const held = row ? await heldBecause(row.making, body.texts as Record<string, string>) : `the piece's making record could not be read, ${THEN}`
      if (held) {
        result = { status: 'held', error: held }
      } else {
        const send = deps.send ?? (async (i: SendApprovedInput) => (await import('../_teleprompter.js')).sendApprovedScripts(i))
        result = await send(input)
        if (result.status === 'sent') unrecorded = await recordSend(db, input, result as SendResult, now).catch(() => 'the piece\'s making record could not be written')
      }
    } catch (error) {
      result = { status: 'error', error: String((error as Error)?.message || error).slice(0, 300) }
    }
    const answer = { status: result.status, at: now, by: SERVER,
      ...(result.folder_id ? { folder_id: result.folder_id } : {}), ...(result.scripts ? { scripts: result.scripts } : {}), ...(result.error ? { error: result.error } : {}),
      // A send that read back is on the piece's making record, or says why not, so a session records it by hand.
      ...(result.status === 'sent' ? { recorded: !unrecorded, ...(unrecorded ? { record_error: unrecorded } : {}) } : {}) }
    // His approval and what the send did, in one document: a session finishing the send reads both together.
    const again = await db.rpc('board_save', { p_week: week, p_collection: collection, p_id: id, p_body: { ...body, send: answer }, p_revision: saved.revision, p_actor: who })
    if (!again.error && again.data?.ok) return { ...again.data, send: answer }
    return { ...saved, send: answer, send_recorded: false }
  }
  return null
}
