import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from './_auth.js'
import { operatorAttribution } from './_editEvents.js'
import { supabase } from './_supabase.js'

// The work board: what is waiting on Krish, what is in progress, what is done.
//
// Krish, 2026-10-03: "I need the boards to not be Claude pages, but accessible
// by Codex too and workable using Codex too". The board lives in three tables
// (supabase/migrations/20261003130000_work_board.sql). Control Center shows it
// at #/board with Krish's cookie; any agent session, Claude Code or Codex,
// reads and writes it here with the engine key (scripts/engine.py).
//
//   GET                                   the board: state, items, recent replies
//   POST { action: 'upsert_items', items } add or change items (an agent, or Krish)
//   POST { action: 'set_state', headline?, signals? }
//   POST { action: 'reply', item_id, text } Krish only: his words, from his cookie
//   POST { action: 'mark_seen', ids }      a session has read and acted on replies
//
// A reply is Krish's words. The engine key cannot write one, so nothing an
// agent does can read as something he said (AGENTS.md, "Krish decides").
// For the same reason an agent cannot reopen an item Krish closed himself:
// that write is refused with 409 krish_closed_it. Who closed an item is kept
// in closed_by, never read from the last writer, so an agent's later edit to
// a closed item does not lift the rule.
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

export const LANES = ['on_you', 'in_progress', 'done', 'archived'] as const
type Lane = typeof LANES[number]
const CLOSED_LANES = new Set<string>(['done', 'archived'])
const ID = /^[a-z0-9][a-z0-9-]{1,79}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const SIGNAL_STATES = new Set(['', 'ok', 'warn', 'bad'])
const MAX_ITEMS = 50
const DONE_SHOWN = 30

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
  prompt?: string | null
  /** The piece this item is about; it then closes when the piece moves on (_boardClose.ts). */
  idea_id?: string | null
  /** The making step that closes it, 'published', or 'week_planned'. */
  closes_on?: string | null
  /** Why only Krish can do it (ONLY_YOU). Control Center's list holds an item waiting on him without one. */
  only_you?: string | null
  /** Set by his Bump: off his list until this time (ISO, with a zone). */
  bumped_until?: string | null
}

/** Control Center's own jobs write with the access-code cookie, the same
 *  credential as Krish's browser. A cookie call may name one of these to be
 *  recorded as that job instead of as Krish. It can only lower the
 *  attribution, never raise it, and a labelled call cannot write a reply. */
export const COOKIE_AUTOMATIONS = new Set(['control_center_slate', 'control_center'])
// The making steps and 'published' close through _boardClose.ts; 'week_planned'
// is the week's planning item, which Control Center's slate closes once every
// day has a piece.
const CLOSE_STEPS = new Set(['workroom', 'draft', 'visual_gate', 'scripts', 'pack', 'record', 'video', 'publish', 'published', 'week_planned'])
/** Why only Krish can do an item: the walls only he passes, his face and voice, his login, his call. */
export const ONLY_YOU = new Set(['send', 'post', 'spend', 'delete', 'permission', 'credential', 'face', 'login', 'judgment'])
const WEEK_ITEM = /^week-\d{4}-\d{2}-\d{2}$/
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
  constructor(code: string, readonly detail: string, readonly item?: string) { super(code) }
}

const KEEP_IN_PROGRESS = 'Until it has one, keep the item in in_progress.'

/** Why an item waiting on Krish is not ready for his list, in the order a
 *  writer fixes it. Each detail names the values allowed. */
export const ON_YOU_NEEDS = {
  only_you: `An item waiting on Krish says why only he can do it: "only_you" is one of ${[...ONLY_YOU].join(', ')}. ${KEEP_IN_PROGRESS}`,
  link: `An item waiting on Krish links to the prepared thing he acts on (the script, the draft, the page): "link" starts with https://, with a short "link_label". A typed answer is not a link. ${KEEP_IN_PROGRESS}`,
  closes_on: `An item waiting on Krish says how it closes itself: "closes_on" is a making step (workroom, draft, visual_gate, scripts, pack, record, video, publish), published, or week_planned for the week's planning item alone (id week-<its Monday>). ${KEEP_IN_PROGRESS}`,
  idea_id: `An item waiting on Krish that closes on a piece's step names the piece: "idea_id" is the piece's uuid. Only closes_on week_planned needs none. ${KEEP_IN_PROGRESS}`,
} as const

/** The first field an item waiting on Krish lacks once the write is merged
 *  with the row already there, or null when it is ready or not on him. */
export function onYouLacks(row: Json, before?: Partial<BoardItemRow>): keyof typeof ON_YOU_NEEDS | null {
  const merged: Json = { ...(before || {}), ...row }
  if (merged.lane !== 'on_you') return null
  if (!merged.only_you) return 'only_you'
  if (typeof merged.link !== 'string' || !/^https:\/\//.test(merged.link)) return 'link'
  // week_planned closes only the week's own item (Control Center's slate);
  // on any other item it would never fire.
  if (!merged.closes_on || (merged.closes_on === 'week_planned' && !WEEK_ITEM.test(String(merged.id)))) return 'closes_on'
  if (merged.closes_on !== 'week_planned' && !merged.idea_id) return 'idea_id'
  return null
}

/** Checks one item and returns the columns to write. Throws a short code.
 *  `before` is the row already there: the write is merged with it to check
 *  an item waiting on Krish (onYouLacks). */
export function cleanItem(raw: unknown, isNew: boolean, before?: Partial<BoardItemRow>): Json & { id: string } {
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
  const prompt = optionalText(r.prompt, 120, 'prompt'); if (prompt !== undefined) row.prompt = prompt
  if (r.idea_id !== undefined) {
    if (r.idea_id !== null && !(typeof r.idea_id === 'string' && UUID.test(r.idea_id))) throw new Error('idea_id_invalid')
    row.idea_id = r.idea_id
  }
  if (r.closes_on !== undefined) {
    if (r.closes_on !== null && !CLOSE_STEPS.has(String(r.closes_on))) throw new Error('closes_on_invalid')
    row.closes_on = r.closes_on
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
  const lacks = onYouLacks(row, isNew ? undefined : before)
  if (lacks) throw new BoardRefusal(`on_you_needs_${lacks}`, ON_YOU_NEEDS[lacks], id)
  return row
}

/** What the route reads of an item before writing it. */
export interface BoardBefore { id: string; lane: string; closed_by: string | null }
/** The columns an item waiting on Krish is checked on. */
export interface BoardItemRow extends BoardBefore { only_you: string | null; link: string | null; closes_on: string | null; idea_id: string | null }

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

async function read(res: VercelResponse) {
  const [state, items, done, replies] = await Promise.all([
    supabase.from('work_board_state').select('headline,signals,updated_by,updated_at').eq('id', 'board').maybeSingle(),
    supabase.from('work_board_items').select('*').in('lane', ['on_you', 'in_progress']).order('rank', { ascending: true }).limit(200),
    supabase.from('work_board_items').select('*').eq('lane', 'done').order('updated_at', { ascending: false }).limit(DONE_SHOWN),
    supabase.from('work_board_replies').select('*').order('at', { ascending: false }).limit(100),
  ])
  const failed = [state, items, done, replies].find(r => r.error)
  if (failed) return res.status(500).json({ ok: false, error: 'board_read_failed' })
  const list = (replies.data || []) as Array<{ seen_at: string | null }>
  return res.status(200).json({
    ok: true,
    state: state.data || { headline: '', signals: [], updated_by: null, updated_at: null },
    items: [...(items.data || []), ...(done.data || [])],
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

  try {
    if (body.action === 'upsert_items') {
      if (!Array.isArray(body.items) || body.items.length === 0) return res.status(400).json({ ok: false, error: 'items_required' })
      if (body.items.length > MAX_ITEMS) return res.status(400).json({ ok: false, error: 'too_many_items' })
      const ids = body.items.map(i => String(record(i).id || ''))
      if (new Set(ids).size !== ids.length) return res.status(400).json({ ok: false, error: 'duplicate_item_ids' })
      const found = await supabase.from('work_board_items').select('id,lane,closed_by,only_you,link,closes_on,idea_id').in('id', ids)
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
      const rows = body.items.map(i => {
        const id = String(record(i).id)
        return cleanItem(i, !existing.has(id), existing.get(id))
      })
      // Who decided: Krish for his cookie or a relayed decision, else the writer.
      const closer = operator ? operator.actor : who
      for (const row of rows) {
        const closedBy = closedByAfter(existing.get(row.id), row.lane, closer)
        if (closedBy !== undefined) row.closed_by = closedBy
        const stamp = { updated_by: who, updated_at: now }
        const write = existing.has(row.id)
          ? await supabase.from('work_board_items').update({ ...row, ...stamp }).eq('id', row.id)
          : await supabase.from('work_board_items').insert({ ...row, ...stamp })
        if (write.error) return res.status(500).json({ ok: false, error: 'board_write_failed', item: row.id })
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

    if (body.action === 'reply') {
      if (operator || automation) return res.status(403).json({ ok: false, error: 'a_reply_is_krish_words', detail: 'Only Krish writes a reply, from Control Center.' })
      const itemId = typeof body.item_id === 'string' ? body.item_id : ''
      if (!ID.test(itemId)) return res.status(400).json({ ok: false, error: 'item_id_invalid' })
      const replyText = text(body.text, 2000, 'text', true)!
      const item = await supabase.from('work_board_items').select('id').eq('id', itemId).maybeSingle()
      if (item.error) return res.status(500).json({ ok: false, error: 'board_read_failed' })
      if (!item.data) return res.status(404).json({ ok: false, error: 'item_not_found' })
      const write = await supabase.from('work_board_replies').insert({ item_id: itemId, text: replyText, by: 'Krish', at: now }).select('*').single()
      if (write.error) return res.status(500).json({ ok: false, error: 'board_write_failed' })
      return res.status(200).json({ ok: true, reply: write.data })
    }

    if (body.action === 'mark_seen') {
      const ids = Array.isArray(body.ids) ? body.ids.map(String) : []
      if (!ids.length || ids.length > 100 || !ids.every(id => UUID.test(id))) return res.status(400).json({ ok: false, error: 'ids_invalid' })
      const write = await supabase.from('work_board_replies').update({ seen_at: now, seen_by: who }).in('id', ids).is('seen_at', null)
      if (write.error) return res.status(500).json({ ok: false, error: 'board_write_failed' })
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ ok: false, error: 'unknown_action', actions: ['upsert_items', 'set_state', 'reply', 'mark_seen'] })
  } catch (e) {
    if (e instanceof BoardRefusal) return res.status(400).json({ ok: false, error: e.message, item: e.item, detail: e.detail })
    return res.status(400).json({ ok: false, error: (e as Error).message })
  }
}
