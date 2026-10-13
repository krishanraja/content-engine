import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from './_auth.js'
import { AGENT_CLIENTS, operatorAttribution } from './_editEvents.js'
import { pieceVerdict, type PieceState } from './_making.js'
import { supabase } from './_supabase.js'

// The work board: what is waiting on Krish, what is in progress, what is done.
//
// Krish, 2026-10-03: "I need the boards to not be Claude pages, but accessible
// by Codex too and workable using Codex too". The board lives in three tables
// (supabase/migrations/20261003130000_work_board.sql). Control Center shows it
// at #/board with Krish's cookie; any agent session, Claude Code or Codex,
// reads and writes it here with the engine key (scripts/engine.py).
//
//   GET                                   the board: state, items (each open one with his said notes), and the replies he wrote before they were retired
//   POST { action: 'upsert_items', items } add or change items (an agent, or Krish)
//   POST { action: 'set_state', headline?, signals? }
//   POST { action: 'mark_seen', ids }      a session has read and acted on an old reply
//
// Replies are retired: Control Center has no reply box, and step 3's voice
// input, one place where he speaks to the system, replaces it. So the reply
// action is refused for everyone (410 replies_retired), and so is an item
// that asks him for one (400 prompt_retired; a null prompt clears an old
// one). A question only his words answer is asked in a session's reply to
// him. The replies he wrote before stay readable, and mark_seen still counts
// them off.
//
// His words about an item reach it through that door (step 3, PR 6). Control
// Center's filer keeps a note he says about a board item in said_parts, with
// about 'board:<item id>'. GET returns them on each open item as said:
// [{ part_id, excerpt, at }], newest first, at most SAID_SHOWN, only notes
// that are filed or settled (a purged one is gone). A session reads them
// before it works the item, and never answers them. Nothing here writes
// said_parts. If they cannot be read, the board still loads, every open item
// has said: [], and said_read says 'failed'.
//
// Nothing an agent does may read as something Krish said (AGENTS.md, "Krish
// decides"), so an agent cannot reopen an item Krish closed himself: that
// write is refused with 409 krish_closed_it. Who closed an item is kept in
// closed_by, never read from the last writer, so an agent's later edit to a
// closed item does not lift the rule.
//
// An item waiting on him (lane on_you) is ready for his one list, or it is
// not written: it says why only he can do it (only_you), links to the
// prepared thing he acts on (an https link) and says how it closes itself
// (closes_on, with the piece's idea_id unless it is the week's planning
// item). The write is merged with the row already there before it is
// checked, so a partial edit of an item on him is held to the same rule, and
// a refusal names the missing field (400 on_you_needs_*). Krish, 2026-10-11:
// "you are just capping the garbage. Surely we need to not have garbage."
// The database holds the same rule (work_board_items_on_you_is_ready).
//
// Every item says how it ends (closes_on), so one done-check sweep can end
// it (step 4; Control Center's api/_doneChecks.ts). Krish, 2026-10-11: "I am
// happy to Clear(complete)/Bump/Purge things off my lists as I go but the
// rest should be automatically done." The kinds are CLOSE_KINDS: a piece's
// making step or published, the week's two items, a share image, a job, a
// post or a take a machine could not place, work a session holds (session),
// and his_word, which nothing can see, so only his Clear ends it. What a kind
// needs beyond itself is in close_ref (closeRefOk, the same rule as the
// database's board_close_ref_ok). The sweep writes as client done_check: it
// may only close an open item, with its proof in closed_proof, and is
// recorded as "check: <kind>". A session relaying Krish's close carries his
// exact words (said), which are kept on the row. An item whose step the
// engine can already see done is refused (409 already_done): nothing waits.
//
// Only the check, Krish, or a session on its own work closes an item. An
// agent that is not relaying him may move an open item to done or archived
// only when it closes_on session (409 check_closes_it), and may not reopen an
// item a check closed (409 check_closed_it) unless it relays his words. No
// agent turns a check's open item into session work, which would let it
// close the item next (409 kind_is_the_checks). Every
// open item says how it ends (400 open_needs_closes_on). The database holds
// the same rules (20261023090000_one_closer.sql: the open-item CHECK and the
// only_a_check_or_krish_closes trigger), and nothing else in the engine
// writes a close (scripts/check-one-close.ts).

export const LANES = ['on_you', 'in_progress', 'done', 'archived'] as const
type Lane = typeof LANES[number]
const CLOSED_LANES = new Set<string>(['done', 'archived'])
const ID = /^[a-z0-9][a-z0-9-]{1,79}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SIGNAL_STATES = new Set(['', 'ok', 'warn', 'bad'])
const MAX_ITEMS = 50
const DONE_SHOWN = 30
/** His said notes shown on one open item, newest first. */
export const SAID_SHOWN = 10

type Json = Record<string, unknown>

export interface BoardItemInput {
  id: string
  lane?: Lane
  rank?: number
  area?: string
  title?: string
  detail?: string
  link?: string | null
  link_label?: string | null
  /** Retired with replies: only null, which clears an old one. */
  prompt?: null
  /** The piece this item is about; the done-check sweep reads its steps. */
  idea_id?: string | null
  /** How it ends: one of CLOSE_KINDS. */
  closes_on?: string | null
  /** What its kind needs beyond itself (closeRefOk), at most 1 KB. */
  close_ref?: Record<string, unknown> | null
  /** The words a check closed it with; only the done_check client sends it. */
  closed_proof?: string | null
  /** Why only Krish can do it (ONLY_YOU). The route refuses an item on him (lane on_you) without one (on_you_needs_only_you). */
  only_you?: string | null
  /** Set by his Bump: off his list until this time (ISO, with a zone). */
  bumped_until?: string | null
}

/** Control Center's own jobs write with the access-code cookie, the same
 *  credential as Krish's browser. A cookie call may name one of these to be
 *  recorded as that job instead of as Krish. It can only lower the
 *  attribution, never raise it. */
// visibility_score: Control Center's visibility scorer, which puts a podcast or
// stage judged worth taking on Krish (api/_visibilityTake.ts there). Unnamed, its
// writes would be recorded as his own.
export const COOKIE_AUTOMATIONS = new Set(['control_center_slate', 'control_center', 'done_check', 'visibility_score'])
/** The done-check sweep's client. It may only close an open item, with a proof. */
export const DONE_CHECK = 'done_check'
/** A piece's making steps and 'published': the item names the piece (idea_id). */
export const PIECE_KINDS = ['workroom', 'draft', 'visual_gate', 'scripts', 'pack', 'record', 'video', 'publish', 'published'] as const
/** Every way an item ends. The list in the newest migration's
 *  work_board_items_closes_on_check is the same. */
export const CLOSE_KINDS = new Set<string>([...PIECE_KINDS, 'week_planned', 'week_published', 'share_image_changed', 'job_ok', 'post_matched', 'take_placed', 'target_decided', 'session', 'his_word'])
/** Kinds that are never on Krish: work a session holds, and the questions a machine holds for one. */
export const NOT_ON_HIM = new Set(['session', 'post_matched', 'take_placed'])
/** Kinds whose close_ref must be whole on any open item (the rest are checked on him). */
const REF_KINDS = new Set(['week_published', 'share_image_changed', 'job_ok', 'post_matched', 'take_placed', 'target_decided'])
const PIECE_KIND_SET = new Set<string>(PIECE_KINDS)
/** Why only Krish can do an item: the walls only he passes, his face and voice, his login, his call. */
export const ONLY_YOU = new Set(['send', 'post', 'spend', 'delete', 'permission', 'credential', 'face', 'login', 'judgment'])
const WEEK_ITEM = /^week-\d{4}-\d{2}-\d{2}$/
const WEEK_BOARD = /^week-publish-board-\d{4}-\d{2}-\d{2}$/
const TAKE_ITEM = /^take-[0-9a-f]{12}$/
const OPEN_LANES = new Set<string>(['on_you', 'in_progress'])
const MAX_CLOSE_REF = 1024
const MAX_PROOF = 300
const HIS_WORDS = (said: string) => `His words: "${said}"`
/** His exact words, as a relayed close carries them: long enough to be his, short enough that the proof fits 300 characters. */
export const SAID_MIN = 12
export const SAID_MAX = MAX_PROOF - HIS_WORDS('').length
const ISO_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,6})?)?(Z|[+-]\d{2}:\d{2})$/

function record(value: unknown): Json {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Json : {}
}

function text(value: unknown, max: number, field: string, required = false): string | undefined {
  if (value === undefined) {
    if (required) throw new Error(`${field}_required`)
    return undefined
  }
  if (typeof value !== 'string') throw new Error(`${field}_must_be_text`)
  const trimmed = value.trim()
  if (required && !trimmed) throw new Error(`${field}_required`)
  if (trimmed.length > max) throw new Error(`${field}_too_long`)
  return trimmed
}

function optionalText(value: unknown, max: number, field: string): string | null | undefined {
  if (value === null) return null
  const t = text(value, max, field)
  return t === '' ? null : t
}

/** A write refused for a reason a writer can act on: a short code and, in
 *  `detail`, what to send instead. */
export class BoardRefusal extends Error {
  constructor(code: string, readonly detail: string, readonly item?: string, readonly status = 400) { super(code) }
}

/** What each kind needs beyond itself, in the words a refusal uses. */
export const CLOSE_REF_NEEDS: Record<string, string> = {
  piece: '"idea_id", the piece\'s uuid',
  week_planned: 'the id week-<its Monday>',
  week_published: 'the id week-publish-board-<its Monday>',
  share_image_changed: 'close_ref {"url": the post\'s https address, "was": the file id of the share image it shows now}',
  job_ok: 'close_ref {"job": the job\'s name, "after": the time a clean run must be newer than, "probe": "dry" when a dry read can prove it}',
  post_matched: 'close_ref {"url": the post\'s https address}',
  take_placed: 'the id take-<the first 12 of its sha256>',
  target_decided: 'close_ref {"target_id": the visibility target\'s uuid}',
}

/** True when an item carries what its kind needs. The same rule as the
 *  database's board_close_ref_ok (20261022090000_board_close_columns.sql). */
export function closeRefOk(kind: unknown, ref: unknown, ideaId: unknown, id: unknown): boolean {
  const k = String(kind ?? '')
  const r = record(ref)
  const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v))
  if (PIECE_KIND_SET.has(k)) return Boolean(ideaId)
  if (k === 'week_planned') return WEEK_ITEM.test(String(id))
  if (k === 'week_published') return WEEK_BOARD.test(String(id))
  if (k === 'share_image_changed') return /^https:\/\//.test(str(r.url)) && str(r.was) !== ''
  if (k === 'job_ok') return str(r.job) !== '' && str(r.after) !== ''
  if (k === 'post_matched') return /^https:\/\//.test(str(r.url))
  if (k === 'take_placed') return TAKE_ITEM.test(String(id))
  if (k === 'target_decided') return UUID.test(str(r.target_id))
  return k === 'session' || k === 'his_word'
}

/** What a kind needs, for a refusal's detail. */
function needsOf(kind: string): string {
  return CLOSE_REF_NEEDS[PIECE_KIND_SET.has(kind) ? 'piece' : kind] || 'nothing more'
}

/** Who is writing: Krish (his cookie), a Control Center job (a cookie
 *  automation), or an agent (the engine key), relaying him or not. */
export interface WriteContext {
  writer: string
  /** True for his cookie with no automation named. */
  krish: boolean
  /** An agent relaying a decision he made in words (decided_by: 'Krish'). */
  relayed: boolean
  /** His exact words, when a relayed write carries them. */
  said: string | null
  agent: boolean
}
const KRISH: WriteContext = { writer: 'Krish', krish: true, relayed: false, said: null, agent: false }

const KEEP_IN_PROGRESS = 'Until it has one, keep the item in in_progress.'
/** Why nothing may ask Krish to reply on the board any more. */
export const REPLIES_RETIRED = 'Replies are retired: Control Center has no reply box, and nothing can show a prompt to Krish or take his answer. '
  + 'Ask a question only his words answer in your reply to him.'

/** Why an item waiting on Krish is not ready for his list, in the order a
 *  writer fixes it. Each detail names the values allowed. */
export const ON_YOU_NEEDS = {
  only_you: `An item waiting on Krish says why only he can do it: "only_you" is one of ${[...ONLY_YOU].join(', ')}. ${KEEP_IN_PROGRESS}`,
  link: `An item waiting on Krish links to the prepared thing he acts on (the script, the draft, the page): "link" starts with https://, with a short "link_label". A typed answer is not a link. ${KEEP_IN_PROGRESS}`,
  closes_on: 'An item waiting on Krish says how it closes itself: "closes_on" is a making step (workroom, draft, visual_gate, scripts, pack, record, video, publish) or published, with the piece\'s "idea_id"; '
    + 'week_planned on the week\'s planning item alone (id week-<its Monday>); week_published on the week\'s publish board alone (id week-publish-board-<its Monday>); '
    + 'share_image_changed with close_ref {url, was}; job_ok with close_ref {job, after}; target_decided with close_ref {target_id} (a podcast or stage he decides on); or his_word, which only Krish puts on his list. '
    + `Never session, post_matched or take_placed: those are held for a session. ${KEEP_IN_PROGRESS}`,
  idea_id: `An item waiting on Krish that closes on a piece's step names the piece: "idea_id" is the piece's uuid. Only the kinds that are not a piece's step need none. ${KEEP_IN_PROGRESS}`,
  close_ref: `An item waiting on Krish carries what its check needs: share_image_changed needs ${CLOSE_REF_NEEDS.share_image_changed}; job_ok needs ${CLOSE_REF_NEEDS.job_ok}; target_decided needs ${CLOSE_REF_NEEDS.target_decided}. ${KEEP_IN_PROGRESS}`,
} as const

/** The first field an item waiting on Krish lacks once the write is merged
 *  with the row already there, or null when it is ready or not on him. */
export function onYouLacks(row: Json, before?: Partial<BoardItemRow>): keyof typeof ON_YOU_NEEDS | null {
  const merged: Json = { ...(before || {}), ...row }
  if (merged.lane !== 'on_you') return null
  if (!merged.only_you) return 'only_you'
  if (typeof merged.link !== 'string' || !/^https:\/\//.test(merged.link)) return 'link'
  const kind = String(merged.closes_on ?? '')
  if (!CLOSE_KINDS.has(kind) || NOT_ON_HIM.has(kind)) return 'closes_on'
  // The week's kinds close only the week's own items; on any other item they would never fire.
  if ((kind === 'week_planned' || kind === 'week_published') && !closeRefOk(kind, merged.close_ref, merged.idea_id, merged.id)) return 'closes_on'
  if (PIECE_KIND_SET.has(kind) && !merged.idea_id) return 'idea_id'
  if (!closeRefOk(kind, merged.close_ref, merged.idea_id, merged.id)) return 'close_ref'
  return null
}

/** Checks one item and returns the columns to write. Throws a short code.
 *  `before` is the row already there: the write is merged with it to check
 *  an item waiting on Krish (onYouLacks). */
export function cleanItem(raw: unknown, isNew: boolean, before?: Partial<BoardItemRow>, ctx: WriteContext = KRISH): Json & { id: string } {
  const r = record(raw)
  const id = typeof r.id === 'string' ? r.id : ''
  if (!ID.test(id)) throw new Error('item_id_invalid')
  const row: Json & { id: string } = { id }
  // lane_if_new is the lane for an item only when it does not exist yet: a
  // tool asking a question it may have asked before (the recordings lane,
  // making.py) never reopens one Krish or a session has closed.
  if (r.lane_if_new !== undefined && !(LANES as readonly string[]).includes(String(r.lane_if_new))) throw new Error('lane_invalid')
  if (r.lane !== undefined) {
    if (!(LANES as readonly string[]).includes(String(r.lane))) throw new Error('lane_invalid')
    row.lane = r.lane
  } else if (isNew && r.lane_if_new !== undefined) row.lane = r.lane_if_new
  else if (isNew) throw new Error('lane_required')
  if (r.rank !== undefined) {
    if (!Number.isInteger(r.rank) || (r.rank as number) < 0 || (r.rank as number) > 999) throw new Error('rank_invalid')
    row.rank = r.rank
  }
  const area = text(r.area, 80, 'area'); if (area !== undefined) row.area = area
  const title = text(r.title, 200, 'title', isNew); if (title !== undefined) row.title = title
  const detail = text(r.detail, 2000, 'detail'); if (detail !== undefined) row.detail = detail
  const link = optionalText(r.link, 500, 'link')
  if (link !== undefined) {
    if (link !== null && !/^https:\/\//.test(link)) throw new Error('link_must_be_https')
    row.link = link
  }
  const linkLabel = optionalText(r.link_label, 60, 'link_label'); if (linkLabel !== undefined) row.link_label = linkLabel
  // A prompt asked him to reply; replies are retired. Null clears an old one
  // (Control Center's slate sends it).
  const prompt = optionalText(r.prompt, 120, 'prompt')
  if (prompt) throw new BoardRefusal('prompt_retired', REPLIES_RETIRED, id)
  if (prompt !== undefined) row.prompt = prompt
  if (r.idea_id !== undefined) {
    if (r.idea_id !== null && !(typeof r.idea_id === 'string' && UUID.test(r.idea_id))) throw new Error('idea_id_invalid')
    row.idea_id = r.idea_id
  }
  if (r.closes_on !== undefined) {
    if (r.closes_on !== null && !CLOSE_KINDS.has(String(r.closes_on))) throw new Error('closes_on_invalid')
    row.closes_on = r.closes_on
  }
  if (r.close_ref !== undefined) {
    if (r.close_ref !== null && (typeof r.close_ref !== 'object' || Array.isArray(r.close_ref))) throw new Error('close_ref_must_be_an_object')
    const ref = r.close_ref === null ? {} : r.close_ref as Json
    if (JSON.stringify(ref).length > MAX_CLOSE_REF) throw new Error('close_ref_too_long')
    row.close_ref = ref
  }
  if (r.closed_proof !== undefined) {
    // Only the sweep writes a proof; a relayed close's is his words, set by the route.
    if (ctx.writer !== DONE_CHECK) {
      throw new BoardRefusal('closed_proof_is_the_checks', 'Only the done-check sweep writes closed_proof. To relay a close Krish made, send decided_by "Krish" and his exact words in "said".', id)
    }
    const proof = text(r.closed_proof, MAX_PROOF, 'closed_proof')
    if (proof) row.closed_proof = proof
  }
  if (r.only_you !== undefined) {
    if (r.only_you !== null && !ONLY_YOU.has(String(r.only_you))) throw new Error('only_you_invalid')
    row.only_you = r.only_you
  }
  if (r.bumped_until !== undefined) {
    if (r.bumped_until === null) row.bumped_until = null
    else {
      const at = typeof r.bumped_until === 'string' && ISO_TIME.test(r.bumped_until) ? Date.parse(r.bumped_until) : NaN
      if (!Number.isFinite(at)) throw new Error('bumped_until_invalid')
      row.bumped_until = new Date(at).toISOString()
    }
  }
  const merged: Json = { ...(isNew ? {} : before || {}), ...row }
  const lacks = onYouLacks(row, isNew ? undefined : before)
  if (lacks) throw new BoardRefusal(`on_you_needs_${lacks}`, ON_YOU_NEEDS[lacks], id)
  // Nothing can see a his_word item finished, so only he puts one on his
  // list: his cookie, his words relayed, or Control Center moving one there.
  const putsHisWordOnHim = merged.lane === 'on_you' && merged.closes_on === 'his_word'
    && (row.lane === 'on_you' || row.closes_on === 'his_word')
  if (putsHisWordOnHim && !(ctx.krish || (ctx.relayed && ctx.said) || ctx.writer === 'control_center')) {
    throw new BoardRefusal('his_word_is_his', 'Only Krish puts an item on his list that nothing can see. Give it a check kind, or hold it in progress.', id, 409)
  }
  // A check's kind carries what the check needs on every open item, or it could never close.
  const kind = String(merged.closes_on ?? '')
  if (OPEN_LANES.has(String(merged.lane)) && REF_KINDS.has(kind) && !closeRefOk(kind, merged.close_ref, merged.idea_id, id)) {
    throw new BoardRefusal('close_ref_invalid', `closes_on ${kind} needs ${needsOf(kind)}.`, id)
  }
  return row
}

/** What the route reads of an item before writing it. */
export interface BoardBefore { id: string; lane: string; closed_by: string | null }
/** The columns an item waiting on Krish is checked on. */
export interface BoardItemRow extends BoardBefore { only_you: string | null; link: string | null; closes_on: string | null; idea_id: string | null; close_ref?: Json | null }

/** True when a write would move an item Krish closed back to an open lane. */
export function reopensKrishsClose(before: BoardBefore | undefined, lane: unknown): boolean {
  return Boolean(before) && before!.closed_by === 'Krish' && CLOSED_LANES.has(before!.lane) && lane !== undefined && !CLOSED_LANES.has(String(lane))
}

/** closed_by after a write: set by the write that closes an item, kept by
 *  later edits and by done to archived (unless Krish makes that move, which
 *  makes the close his), cleared when the item opens again. Undefined leaves
 *  the column alone. */
export function closedByAfter(before: BoardBefore | undefined, lane: unknown, closer: string): string | null | undefined {
  if (lane === undefined) return undefined
  if (!CLOSED_LANES.has(String(lane))) return before && CLOSED_LANES.has(before.lane) ? null : undefined
  if (!before || !CLOSED_LANES.has(before.lane) || closer === 'Krish') return closer
  return undefined
}

export function cleanSignals(raw: unknown): Array<{ label: string; state: string; text: string }> {
  if (!Array.isArray(raw)) throw new Error('signals_must_be_a_list')
  if (raw.length > 8) throw new Error('signals_too_many')
  return raw.map(s => {
    const r = record(s)
    const state = typeof r.state === 'string' ? r.state : ''
    if (!SIGNAL_STATES.has(state)) throw new Error('signal_state_invalid')
    return { label: text(r.label, 40, 'signal_label', true)!, state, text: text(r.text, 120, 'signal_text') ?? '' }
  })
}

/** How long a check's let-go (archived) stays readable on the Board, where his Undo is. */
const LET_GO_SHOWN_DAYS = 7

/** A write the database refused, readable: its Postgres code and, for a CHECK, the constraint's name. */
export function writeFailed(item: string, error: { code?: string; message?: string }) {
  const constraint = /constraint "([^"]+)"/.exec(String(error.message || ''))?.[1] ?? null
  return { ok: false, error: 'board_write_failed', item, code: error.code ?? null, constraint }
}

const DONE_CHECK_FIELDS = new Set(['id', 'lane', 'closed_proof'])
/** Why the sweep may not make this write, or null. It only closes an open
 *  item that a check can see, with its proof: never a his_word item (only
 *  his Clear ends one) and never one that does not say how it ends. */
export function doneCheckRefusal(item: Json, before: (BoardBefore & { closes_on?: string | null }) | undefined): BoardRefusal | null {
  const id = String(item.id ?? '')
  const only = (detail: string) => new BoardRefusal('done_check_only_closes', detail, id, 409)
  if (!before || !OPEN_LANES.has(before.lane)) return only('The done-check sweep only closes an item that is open; this one is not.')
  if (!before.closes_on || before.closes_on === 'his_word') {
    return only(before.closes_on
      ? 'Nothing can see this item done (his_word), so only his Clear ends it. The done-check sweep never closes it.'
      : 'This item does not say how it ends, so no check can close it. A session gives it a kind first.')
  }
  if (!CLOSED_LANES.has(String(item.lane))) return only('The done-check sweep only moves an open item to done or archived. It never reopens or moves one between open lanes.')
  const extra = Object.keys(item).filter(k => !DONE_CHECK_FIELDS.has(k))
  if (extra.length) return only(`The done-check sweep sends only id, lane and closed_proof, not ${extra.join(', ')}.`)
  if (typeof item.closed_proof !== 'string' || !item.closed_proof.trim()) return new BoardRefusal('done_check_needs_proof', 'A check closes an item only with its proof, in closed_proof (at most 300 characters).', id)
  return null
}

/** The first item whose piece step the engine already sees done, so the
 *  write would put up something nothing waits on; or null. Only writes
 *  that are not Krish's (his Undo reopens a close on purpose), on an open
 *  item that closes on a piece's step. A piece that cannot be read refuses
 *  nothing. */
async function alreadyDone(rows: Array<Json & { id: string }>, existing: Map<string, BoardItemRow>, closer: string): Promise<string | null> {
  if (closer === 'Krish') return null
  const asked = rows.map(row => {
    const before = existing.get(row.id)
    const merged = { ...(before || {}), ...row } as Json
    const touches = !before || 'lane' in row || 'closes_on' in row || 'idea_id' in row
    const kind = String(merged.closes_on ?? '')
    const piece = typeof merged.idea_id === 'string' ? merged.idea_id : null
    if (!touches || !OPEN_LANES.has(String(merged.lane)) || !PIECE_KIND_SET.has(kind) || !piece) return null
    return { id: row.id, kind, piece }
  }).filter((x): x is NonNullable<typeof x> => Boolean(x))
  if (!asked.length) return null
  const read = await supabase.from('content_ideas').select('id,state,buried_at,meta').in('id', [...new Set(asked.map(a => a.piece))])
  if (read.error) return null
  const pieces = new Map(((read.data || []) as PieceState[]).map(p => [p.id, p]))
  for (const a of asked) {
    const piece = pieces.get(a.piece)
    if (piece && pieceVerdict(piece, a.kind) === 'done') return a.id
  }
  return null
}

/** Why this writer may not move this open item to done or archived, or null.
 *  The check closes what it can see, Krish closes anything, and a session
 *  closes only its own work (closes_on session). Cookie jobs other than the
 *  sweep close nothing. */
export function closeRefusal(row: Json & { id: string }, before: BoardItemRow | undefined, who: string, closer: string): BoardRefusal | null {
  if (!before || !OPEN_LANES.has(before.lane) || row.lane === undefined || !CLOSED_LANES.has(String(row.lane))) return null
  if (closer === 'Krish' || who === DONE_CHECK) return null
  if (before.closes_on === 'session' && AGENT_CLIENTS.has(closer)) return null
  const kind = before.closes_on || 'none'
  return new BoardRefusal('check_closes_it', `This item closes on ${kind}, so the done-check sweep closes it when it can see it done, or Krish clears it. `
    + 'Record the fact (making.py, the job, the post) and leave the item. A session closes only its own work (closes_on session); '
    + 'to relay a close Krish made, send decided_by "Krish" and his exact words in "said".', row.id, 409)
}

/** Why an agent may not make a check's open item its own work, or null.
 *  A session closes only closes_on session, so moving an open item from a
 *  check's kind to session and then closing it would make it a second
 *  closer. Only Krish (his cookie) or Control Center does that. A relayed
 *  close of his is relayed as the close itself: the database cannot tell a
 *  relay from a session (only_a_check_or_krish_closes). An item that said
 *  nothing (no kind) may still be given session. */
export function kindRefusal(row: Json & { id: string }, before: BoardItemRow | undefined, ctx: WriteContext): BoardRefusal | null {
  if (!ctx.agent || !before || !OPEN_LANES.has(before.lane) || !('closes_on' in row)) return null
  if (row.closes_on !== 'session' || !before.closes_on || before.closes_on === 'session') return null
  return new BoardRefusal('kind_is_the_checks', `This item closes on ${before.closes_on}, so the done-check sweep closes it when it can see it done, or Krish clears it. `
    + 'A session may not make it session work. Record the fact and leave the item; to relay a close Krish made, relay the close itself: '
    + 'send lane done with decided_by "Krish" and his exact words in "said".', row.id, 409)
}

/** Why this writer may not reopen an item a check closed, or null. Only
 *  Krish reopens a check's close: his Undo, or his words relayed. */
export function reopenRefusal(row: Json & { id: string }, before: BoardItemRow | undefined, ctx: WriteContext): BoardRefusal | null {
  if (!before || !CLOSED_LANES.has(before.lane) || !String(before.closed_by || '').startsWith('check: ')) return null
  if (row.lane === undefined || CLOSED_LANES.has(String(row.lane))) return null
  if (ctx.krish || (ctx.relayed && ctx.said)) return null
  return new BoardRefusal('check_closed_it', 'A check closed this item with its proof. Only Krish reopens it: his Undo on the Board, or his exact words relayed with decided_by "Krish" and "said".', row.id, 409)
}

export interface SaidNote { part_id: string; excerpt: string; at: string }
interface SaidRow { id: string; about: string; excerpt: string; created_at: string }

/** His said notes per item, newest first, at most SAID_SHOWN each, from rows
 *  read newest first. Only notes about 'board:<an id given>' count. */
export function groupSaid(rows: SaidRow[], ids: string[]): Map<string, SaidNote[]> {
  const wanted = new Set(ids)
  const out = new Map<string, SaidNote[]>()
  for (const r of rows) {
    const id = String(r.about || '').replace(/^board:/, '')
    if (!String(r.about || '').startsWith('board:') || !wanted.has(id)) continue
    const list = out.get(id) || []
    if (list.length >= SAID_SHOWN) continue
    list.push({ part_id: r.id, excerpt: r.excerpt, at: r.created_at })
    out.set(id, list)
  }
  return out
}

/** Read his said notes about the open items: kind note, filed or settled.
 *  One read per item, so a long thread on one item never crowds out another. */
async function saidNotes(ids: string[]): Promise<{ notes: Map<string, SaidNote[]>; failed: boolean }> {
  const reads = await Promise.all(ids.map(id => supabase
    .from('said_parts')
    .select('id,about,excerpt,created_at')
    .eq('about', `board:${id}`)
    .eq('kind', 'note')
    .in('status', ['filed', 'settled'])
    .order('created_at', { ascending: false })
    .limit(SAID_SHOWN)))
  if (reads.some(r => r.error)) return { notes: new Map(), failed: true }
  return { notes: groupSaid(reads.flatMap(r => (r.data || []) as SaidRow[]), ids), failed: false }
}

async function read(res: VercelResponse) {
  const since = new Date(Date.now() - LET_GO_SHOWN_DAYS * 86_400_000).toISOString()
  const [state, items, done, letGo, replies] = await Promise.all([
    supabase.from('work_board_state').select('headline,signals,updated_by,updated_at').eq('id', 'board').maybeSingle(),
    supabase.from('work_board_items').select('*').in('lane', ['on_you', 'in_progress']).order('rank', { ascending: true }).limit(200),
    supabase.from('work_board_items').select('*').eq('lane', 'done').order('updated_at', { ascending: false }).limit(DONE_SHOWN),
    // An item a check let go (moot) is archived; it stays readable for a week so he can Undo it.
    supabase.from('work_board_items').select('*').eq('lane', 'archived').like('closed_by', 'check: %').gte('updated_at', since).order('updated_at', { ascending: false }).limit(DONE_SHOWN),
    supabase.from('work_board_replies').select('*').order('at', { ascending: false }).limit(100),
  ])
  const failed = [state, items, done, letGo, replies].find(r => r.error)
  if (failed) return res.status(500).json({ ok: false, error: 'board_read_failed' })
  const list = (replies.data || []) as Array<{ seen_at: string | null }>
  const open = (items.data || []) as Array<Json & { id: string }>
  const said = await saidNotes(open.map(i => i.id))
  return res.status(200).json({
    ok: true,
    state: state.data || { headline: '', signals: [], updated_by: null, updated_at: null },
    items: [...open.map(i => ({ ...i, said: said.notes.get(i.id) || [] })), ...(done.data || []), ...(letGo.data || [])],
    ...(said.failed ? { said_read: 'failed' } : {}),
    replies: list,
    unseen_replies: list.filter(r => !r.seen_at).length,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'GET') return read(res)

  const body = record(req.body)
  // Null for Krish in a browser; an agent session otherwise.
  const operator = operatorAttribution(req.headers.authorization, body)
  const automation = !operator && typeof body.client === 'string' && COOKIE_AUTOMATIONS.has(body.client) ? body.client : null
  const who = operator ? operator.client : automation ?? 'Krish'
  const now = new Date().toISOString()
  const said = typeof body.said === 'string' ? body.said.trim() : ''
  const ctx: WriteContext = {
    writer: who,
    krish: !operator && !automation,
    relayed: Boolean(operator && !operator.observation),
    said: said.length >= SAID_MIN && said.length <= SAID_MAX ? said : null,
    agent: Boolean(operator),
  }

  try {
    if (body.action === 'upsert_items') {
      if (!Array.isArray(body.items) || body.items.length === 0) return res.status(400).json({ ok: false, error: 'items_required' })
      if (body.items.length > MAX_ITEMS) return res.status(400).json({ ok: false, error: 'too_many_items' })
      const ids = body.items.map(i => String(record(i).id || ''))
      if (new Set(ids).size !== ids.length) return res.status(400).json({ ok: false, error: 'duplicate_item_ids' })
      const found = await supabase.from('work_board_items').select('id,lane,closed_by,only_you,link,closes_on,idea_id,close_ref').in('id', ids)
      if (found.error) return res.status(500).json({ ok: false, error: 'board_read_failed' })
      const existing = new Map(((found.data || []) as BoardItemRow[]).map(r => [r.id, r]))
      // An item Krish closed himself (Clear or Purge, or a close an agent
      // relayed from his words) stays closed: an agent cannot move it back to
      // on_you or in_progress. His own Undo comes from his cookie, never the
      // engine key, so it is not refused. An edit in place, or done to
      // archived, keeps it closed and is allowed. This is said first: no
      // field an agent could add would let the write through.
      if (operator) {
        const reopened = body.items.map(record).find(i => reopensKrishsClose(existing.get(String(i.id)), (LANES as readonly unknown[]).includes(i.lane) ? i.lane : undefined))
        if (reopened) {
          return res.status(409).json({ ok: false, error: 'krish_closed_it', item: String(reopened.id), detail: 'Krish closed this item himself, so an agent cannot reopen it. If something new needs him, write a new item.' })
        }
      }
      // Check every item before writing any, so a bad one changes nothing.
      // Each write is checked merged with the row already there, so an item
      // left on Krish by a partial edit is ready for his list too.
      // The sweep only closes: an open item, to done or archived, with its proof.
      if (who === DONE_CHECK) {
        // One item a call, so a close another writer wins first leaves nothing half written.
        if (body.items.length !== 1) return res.status(400).json({ ok: false, error: 'done_check_one_item', detail: 'The done-check sweep sends one item a call.' })
        const refused = body.items.map(record).map(i => doneCheckRefusal(i, existing.get(String(i.id)))).find(Boolean)
        if (refused) return res.status(refused.status).json({ ok: false, error: refused.message, item: refused.item, detail: refused.detail })
      }
      const rows = body.items.map(i => {
        const id = String(record(i).id)
        return cleanItem(i, !existing.has(id), existing.get(id), ctx)
      })
      // Who decided: Krish for his cookie or a relayed decision, else the writer.
      const closer = operator ? operator.actor : who
      for (const row of rows) {
        const before = existing.get(row.id)
        const lane = row.lane ?? before?.lane
        // Every open item says how it ends, new or edited, whoever writes it.
        if (OPEN_LANES.has(String(lane)) && !('closes_on' in row ? row.closes_on : before?.closes_on)) {
          throw new BoardRefusal('open_needs_closes_on', 'Say how it ends: a check kind, or session if you will close it yourself.', row.id)
        }
        const closedBy = closedByAfter(before, row.lane, closer)
        // A close or reopen relayed from Krish carries his exact words, kept on the row.
        if (ctx.relayed && closedBy !== undefined && !ctx.said) {
          throw new BoardRefusal('relayed_close_needs_his_words', `A close or reopen relayed from Krish carries his exact words in "said" (${SAID_MIN} to ${SAID_MAX} characters). They are kept on the item (closed_proof); on a close he sees them there and can Undo it.`, row.id)
        }
        // Only the check, Krish, or a session on its own work closes an item; only Krish reopens a
        // check's close; and no agent makes a check's item session work to close it itself.
        const refused = closeRefusal(row, before, who, closer) ?? reopenRefusal(row, before, ctx) ?? kindRefusal(row, before, ctx)
        if (refused) throw refused
      }
      // A piece's step the engine can already see done: nothing waits on anyone.
      const done = await alreadyDone(rows, existing, closer)
      if (done) throw new BoardRefusal('already_done', 'That step is already done, so nothing waits on Krish. Do not write the item.', done, 409)
      for (const row of rows) {
        const before = existing.get(row.id)
        const closedBy = closedByAfter(before, row.lane, closer)
        if (who === DONE_CHECK) {
          row.closed_by = `check: ${before?.closes_on || 'none'}`.slice(0, 40)
        } else if (closedBy !== undefined) {
          row.closed_by = closedBy
          // Who closed or reopened it and why travel together: his relayed
          // words (a relayed reopen keeps them too, on the open item), or nothing.
          row.closed_proof = (closedBy === 'Krish' || closedBy === null) && ctx.relayed && ctx.said ? HIS_WORDS(ctx.said) : null
        }
        const stamp = { updated_by: who, updated_at: now }
        if (who === DONE_CHECK) {
          // Two runs at once: only the first finds it open.
          const write = await supabase.from('work_board_items').update({ ...row, ...stamp }).eq('id', row.id).in('lane', ['on_you', 'in_progress']).select('id')
          if (write.error) return res.status(500).json(writeFailed(row.id, write.error))
          if (!write.data?.length) return res.status(409).json({ ok: false, error: 'done_check_only_closes', item: row.id, detail: 'It was closed by another writer first; nothing was written.' })
          continue
        }
        const write = before
          ? await supabase.from('work_board_items').update({ ...row, ...stamp }).eq('id', row.id)
          : await supabase.from('work_board_items').insert({ ...row, ...stamp })
        if (write.error) return res.status(500).json(writeFailed(row.id, write.error))
      }
      return res.status(200).json({ ok: true, written: rows.map(r => r.id) })
    }

    if (body.action === 'set_state') {
      const patch: Json = { updated_by: who, updated_at: now }
      const headline = text(body.headline, 400, 'headline'); if (headline !== undefined) patch.headline = headline
      if (body.signals !== undefined) patch.signals = cleanSignals(body.signals)
      const write = await supabase.from('work_board_state').update(patch).eq('id', 'board')
      if (write.error) return res.status(500).json({ ok: false, error: 'board_write_failed' })
      return res.status(200).json({ ok: true })
    }

    if (body.action === 'reply') return res.status(410).json({ ok: false, error: 'replies_retired', detail: REPLIES_RETIRED })

    if (body.action === 'mark_seen') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : []
      if (!ids.length || ids.length > 100 || !ids.every(id => UUID.test(id))) return res.status(400).json({ ok: false, error: 'ids_invalid' })
      const write = await supabase.from('work_board_replies').update({ seen_at: now, seen_by: who }).in('id', ids).is('seen_at', null)
      if (write.error) return res.status(500).json({ ok: false, error: 'board_write_failed' })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ ok: false, error: 'unknown_action', actions: ['upsert_items', 'set_state', 'mark_seen'] })
  } catch (e) {
    if (e instanceof BoardRefusal) return res.status(e.status).json({ ok: false, error: e.message, item: e.item, detail: e.detail })
    return res.status(400).json({ ok: false, error: (e as Error).message })
  }
}
