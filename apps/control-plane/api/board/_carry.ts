import type { SupabaseClient } from '@supabase/supabase-js'
import { monday } from './_contracts.js'

// The cross-week carry (Krish, 2026-10-29: the Monday, Wednesday and Friday cadence restarts on 2 November, and four
// pieces moved to days in other weeks). A piece that moves keeps what was said and done on it: its day's ticks, its
// links, his saved edits, his decisions on the day's tab, and every comment thread anchored inside the day.
//
// POST /api/board/<to Monday>/carry, the engine operator's key only, body { from_week, from_day, to_day }. Each
// document is copied to the new week under the new day (its id, its day and its anchor moved from from_day to to_day),
// through board_save, as the writer it already had: a carried edit of his stays his, so every reader still reads it.
// Its body records where it came from (carried_from). The day's pick is not carried: the new week's pick comes from
// that week's options. Nothing is deleted from the old week; its board drops the day only after the new board reads
// back (week_board.py --carry builds the page). A document already in the new week with other words is left as it is
// and named in conflicts; the same words write nothing, so a carry may be sent again.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
export const CARRY_DAYS = ['mon', 'wed', 'fri'] as const
type Day = typeof CARRY_DAYS[number]
const PAGE = 1000

export interface CarryInput { from_week: string; from_day: Day; to_day: Day }

export function carryInput(body: unknown): { input?: CarryInput; problem?: string } {
  if (!isObj(body)) return { problem: 'the body is an object' }
  const extra = Object.keys(body).filter(k => !['from_week', 'from_day', 'to_day'].includes(k))
  if (extra.length) return { problem: `unknown fields: ${extra.join(', ')}` }
  if (!monday(String(body.from_week))) return { problem: 'from_week is the Monday the piece came from' }
  for (const k of ['from_day', 'to_day'] as const) {
    if (!(CARRY_DAYS as readonly unknown[]).includes(body[k])) return { problem: `${k} is one of ${CARRY_DAYS.join(', ')}` }
  }
  return { input: body as unknown as CarryInput }
}

/** An id or anchor of the day, moved to the new day: <day>-x, and the review boxes rv-<day>-x, rvs-<day>-x, rvp-<day>-x. */
export function moveRef(ref: string, from: Day, to: Day): string | null {
  const m = new RegExp(`^((?:rvs?|rvp)-)?${from}-(.+)$`).exec(ref)
  return m ? `${m[1] || ''}${to}-${m[2]}` : null
}

interface Doc { table: 'board_ticks' | 'board_documents'; collection: string; id: string; body: Body; by: string }

/** What of a week belongs to one day, moved to the new day. Pure. */
export function dayDocuments(ticks: Body[], docs: Body[], from: Day, to: Day, fromWeek: string): Doc[] {
  const out: Doc[] = []
  const stamp = (collection: string, id: string, body: Body) => ({ ...body, carried_from: { week: fromWeek, collection, id } })
  for (const t of ticks) {
    const id = moveRef(String(t.tick_id), from, to)
    if (!id || id.startsWith('rv') || !isObj(t.body)) continue
    out.push({ table: 'board_ticks', collection: 'ticks', id, body: stamp('ticks', String(t.tick_id), { ...t.body, day: to }), by: String(t.updated_by) })
  }
  for (const d of docs) {
    const c = String(d.collection), old = String(d.doc_id)
    if (!isObj(d.body)) continue
    if (c === 'links' && old === from) out.push({ table: 'board_documents', collection: c, id: to, body: stamp(c, old, d.body), by: String(d.updated_by) })
    if (c === 'edits' && d.body.day === from) {
      const id = moveRef(old, from, to)
      if (id) out.push({ table: 'board_documents', collection: c, id, body: stamp(c, old, { ...d.body, day: to }), by: String(d.updated_by) })
    }
    // His decisions on the day's tab (picks/<day>-scripts and the rest); never the day's pick itself.
    if (c === 'picks' && old !== from && 'kind' in d.body) {
      const id = moveRef(old, from, to)
      if (id) out.push({ table: 'board_documents', collection: c, id, body: stamp(c, old, { ...d.body, ...('day' in d.body ? { day: to } : {}) }), by: String(d.updated_by) })
    }
    if (c === 'comments') {
      const anchor = moveRef(String(d.body.anchor || ''), from, to)
      if (anchor) out.push({ table: 'board_documents', collection: c, id: old, body: stamp(c, old, { ...d.body, anchor }), by: String(d.updated_by) })
    }
  }
  // A reply follows its thread: a reply whose root moved moves too, under the same thread id.
  const roots = new Set(out.filter(d => d.collection === 'comments').map(d => d.id))
  for (const d of docs) {
    if (String(d.collection) !== 'comments' || !isObj(d.body) || roots.has(String(d.doc_id))) continue
    if (roots.has(String(d.body.thread_id))) {
      out.push({ table: 'board_documents', collection: 'comments', id: String(d.doc_id), body: stamp('comments', String(d.doc_id), d.body), by: String(d.updated_by) })
    }
  }
  return out
}

async function readAll(db: SupabaseClient, table: string, week: string): Promise<Body[] | null> {
  const all: Body[] = []
  for (let offset = 0; ; offset += PAGE) {
    const r = await db.from(table).select('*').eq('week', week).range(offset, offset + PAGE - 1)
    if (r.error) return null
    all.push(...(r.data as Body[]))
    if ((r.data || []).length < PAGE) return all
  }
}

export async function carryDay(db: SupabaseClient, toWeek: string, raw: unknown): Promise<{ status: number; body: Body }> {
  const { input, problem } = carryInput(raw)
  if (!input) return { status: 400, body: { ok: false, error: 'invalid_carry', problem } }
  if (input.from_week === toWeek && input.from_day === input.to_day) return { status: 400, body: { ok: false, error: 'invalid_carry', problem: 'that is the same day' } }
  const ticks = await readAll(db, 'board_ticks', input.from_week)
  const docs = await readAll(db, 'board_documents', input.from_week)
  if (!ticks || !docs) return { status: 503, body: { ok: false, error: 'board_store_unavailable' } }
  const moving = dayDocuments(ticks, docs, input.from_day, input.to_day, input.from_week)
  const carried: Record<string, number> = { ticks: 0, links: 0, edits: 0, picks: 0, comments: 0 }
  const same: string[] = [], conflicts: string[] = []
  for (const d of moving) {
    const held = d.table === 'board_ticks'
      ? await db.from('board_ticks').select('body, revision').eq('week', toWeek).eq('tick_id', d.id).maybeSingle()
      : await db.from('board_documents').select('body, revision').eq('week', toWeek).eq('collection', d.collection).eq('doc_id', d.id).maybeSingle()
    if (held.error) return { status: 503, body: { ok: false, error: 'board_store_unavailable', carried } }
    if (held.data && JSON.stringify(held.data.body) === JSON.stringify(d.body)) { same.push(`${d.collection}/${d.id}`); continue }
    if (held.data) { conflicts.push(`${d.collection}/${d.id}`); continue }
    const saved = await db.rpc('board_save', { p_week: toWeek, p_collection: d.collection, p_id: d.id, p_body: d.body, p_revision: 0, p_actor: d.by })
    if (saved.error) return { status: 503, body: { ok: false, error: 'board_store_unavailable', carried } }
    if (saved.data?.ok) carried[d.collection]++
    else conflicts.push(`${d.collection}/${d.id}`)
  }
  return { status: 200, body: { ok: true, from: `${input.from_week}/${input.from_day}`, to: `${toWeek}/${input.to_day}`, carried, already: same, conflicts } }
}
