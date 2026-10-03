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

export const LANES = ['on_you', 'in_progress', 'done', 'archived'] as const
type Lane = typeof LANES[number]
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
}

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

/** Checks one item and returns the columns to write. Throws a short code. */
export function cleanItem(raw: unknown, isNew: boolean): Json & { id: string } {
  const r = record(raw)
  const id = typeof r.id === 'string' ? r.id : ''
  if (!ID.test(id)) throw new Error('item_id_invalid')
  const row: Json & { id: string } = { id }
  if (r.lane !== undefined) {
    if (!(LANES as readonly string[]).includes(String(r.lane))) throw new Error('lane_invalid')
    row.lane = r.lane
  } else if (isNew) throw new Error('lane_required')
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
  return row
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
  const who = operator ? operator.client : 'Krish'
  const now = new Date().toISOString()

  try {
    if (body.action === 'upsert_items') {
      if (!Array.isArray(body.items) || body.items.length === 0) return res.status(400).json({ ok: false, error: 'items_required' })
      if (body.items.length > MAX_ITEMS) return res.status(400).json({ ok: false, error: 'too_many_items' })
      const ids = body.items.map(i => String(record(i).id || ''))
      if (new Set(ids).size !== ids.length) return res.status(400).json({ ok: false, error: 'duplicate_item_ids' })
      const found = await supabase.from('work_board_items').select('id').in('id', ids)
      if (found.error) return res.status(500).json({ ok: false, error: 'board_read_failed' })
      const existing = new Set(((found.data || []) as Array<{ id: string }>).map(r => r.id))
      // Check every item before writing any, so a bad one changes nothing.
      const rows = body.items.map(i => cleanItem(i, !existing.has(String(record(i).id))))
      for (const row of rows) {
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
      if (operator) return res.status(403).json({ ok: false, error: 'a_reply_is_krish_words', detail: 'Only Krish writes a reply, from Control Center.' })
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
    return res.status(400).json({ ok: false, error: (e as Error).message })
  }
}
