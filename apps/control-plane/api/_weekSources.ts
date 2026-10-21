// Sunday's idea pool from every source, and the evidence of Krish's taste (GET /api/week/options?include=sources).
//
// Krish, 2026-10-21: Sunday's Ideas tab is gathered from every source and ranked by what he picked and marked
// before; "the judges stay blind". So this file only sorts and explains what is already in the engine. It never
// scores, calls a model or writes, and the judge ladder never reads it (scripts/check-judges.ts holds the panel
// blind). Learning queue-consolidation-and-fresh-sunday-ideas.
//
// Three pools, by where an idea came from:
//   his     what Krish put in himself: a 'manual' row (his words through Control Center's one door, source_ref
//           said:<part>; the database refuses any other manual row), or a topic he asked the engine to research
//           from Control Center ('requested_research' whose record says requested_by 'Krish'). Since the Monday
//           before the week.
//   inspo   what the Drive scan of his Cold Ideas and Inspo folder wrote ('inspiration_sweep'), last 14 days.
//   engine  every other source, still seeded or researching, last 14 days, with its ladder score.
// Never offered: buried, absorbed, dropped or library rows, anything scheduled or published, and queued ideas
// (they are the Queue tab, and "From your queue" on each day).
//
// The taste evidence is his own marks only: Story and Angle verdicts on the queue, his picks (scheduled pieces and
// week options he chose himself), A/B wins, and his Drops. A candidate within LIKED_COSINE of something he liked
// says so in `why_here`; one that close to a Drop carries `near_drop`.

import { cosine, parseVec } from './_vectors.js'

export const LIKED_COSINE = 0.75
export const POOL_DAYS = 14
export type SourceKind = 'his' | 'inspo' | 'engine'
export type HisVia = 'said' | 'research'

const DAY = 86_400_000
const OFFERABLE = ['seeded', 'researching', 'drafting', 'review']
const ENGINE_STATES = ['seeded', 'researching']

export type Row = Record<string, any>

export interface Candidate {
  id: string
  idea: string
  thesis: string | null
  lane_slot: string | null
  source_type: string | null
  source_kind: SourceKind
  his_via: HisVia | null
  source_url: string | null
  created_at: string
  score: number | null
  why_here: string | null
  near: { id: string; kind: TasteKind; similarity: number } | null
  near_drop: { id: string; idea: string; similarity: number } | null
}

export type TasteKind = 'story' | 'angle' | 'pick' | 'ab_win' | 'drop'
export interface TasteItem { id: string; idea: string; kind: TasteKind; angle: string | null; reason: string | null; at: string | null; vec: number[] | null }

/** The two windows, from the Monday of the week being planned. */
export function windows(weekStart: string) {
  const monday = Date.parse(`${weekStart}T00:00:00Z`)
  return {
    his_since: new Date(monday - 7 * DAY).toISOString(),
    // Fourteen days back from the Sunday the week is planned on.
    pool_since: new Date(monday - (POOL_DAYS + 1) * DAY).toISOString(),
  }
}

/** Where an idea came from, or null when the record cannot say. `his` only when the record shows Krish put it there. */
export function sourceKind(row: Row): { kind: SourceKind; via: HisVia | null } {
  const type = String(row.source_type || '')
  if (type === 'manual') return { kind: 'his', via: 'said' }
  if (type === 'requested_research' && row.meta?.requested_by === 'Krish') return { kind: 'his', via: 'research' }
  if (type === 'inspiration_sweep') return { kind: 'inspo', via: null }
  return { kind: 'engine', via: null }
}

const ladderScore = (r: Row): number | null => {
  const s = r.meta?.ladder?.final?.score ?? r.meta?.ladder?.score
  return typeof s === 'number' && Number.isFinite(s) ? s : null
}

/** Why a row is never offered, or null when it may be. */
export function excluded(row: Row): string | null {
  if (row.buried_at) return 'buried'
  if (row.library_at) return 'library'
  if (row.queued_at) return 'queued'
  if (row.scheduled_for) return 'scheduled'
  if (row.published_at || row.state === 'published') return 'published'
  if (!OFFERABLE.includes(String(row.state))) return String(row.state || 'no state')
  return null
}

/** His marks, as evidence. Each comes from his own tap or words (meta.queue.triage decided_by Krish, a week option
 *  he wrote himself, a piece scheduled for a day, an A/B win he tapped). Never inferred. */
export function tasteOf(rows: Row[]): TasteItem[] {
  const out: TasteItem[] = []
  const seen = new Set<string>()
  const add = (r: Row, kind: TasteKind, extra: Partial<TasteItem> = {}) => {
    const key = `${kind}:${r.id}`
    if (seen.has(key)) return
    seen.add(key)
    out.push({ id: String(r.id), idea: String(r.idea || ''), kind, angle: null, reason: null, at: null, vec: parseVec(r), ...extra })
  }
  for (const r of rows) {
    const q = r.meta?.queue || {}
    const t = q.triage
    if (t && t.decided_by === 'Krish' && ['story', 'angle', 'drop'].includes(t.verdict)) {
      add(r, t.verdict, { angle: t.angle || null, reason: t.reason || null, at: t.at || null })
    }
    if (Array.isArray(q.beat) && q.beat.length) add(r, 'ab_win', { at: q.beat[q.beat.length - 1]?.at || null })
    const option = r.meta?.week_option
    if (r.scheduled_for && r.state !== 'dropped') add(r, 'pick', { at: String(r.scheduled_for) })
    else if (option && option.by === 'Krish' && option.rank === 1) add(r, 'pick', { at: option.at || null })
  }
  return out
}

function describe(t: TasteItem): string {
  const idea = t.idea.length > 90 ? `${t.idea.slice(0, 87)}...` : t.idea
  if (t.kind === 'story') return `close to your Story mark on "${idea}"`
  if (t.kind === 'angle') return `close to your Angle mark on "${idea}"${t.angle ? ` (your angle: ${t.angle})` : ''}`
  if (t.kind === 'ab_win') return `close to "${idea}", which won your A/B`
  return `close to "${idea}", which you picked${t.at ? ` for ${String(t.at).slice(0, 10)}` : ''}`
}

/** The nearest thing he liked, and the nearest thing he dropped, each at LIKED_COSINE or closer. */
export function nearest(vec: number[] | null, taste: TasteItem[], selfId?: string) {
  let liked: { item: TasteItem; similarity: number } | null = null
  let dropped: { item: TasteItem; similarity: number } | null = null
  if (!vec) return { liked, dropped }
  for (const t of taste) {
    if (!t.vec || t.id === selfId) continue
    const s = cosine(vec, t.vec)
    if (s < LIKED_COSINE) continue
    if (t.kind === 'drop') { if (!dropped || s > dropped.similarity) dropped = { item: t, similarity: s } }
    else if (!liked || s > liked.similarity) liked = { item: t, similarity: s }
  }
  return { liked, dropped }
}

const round = (n: number) => Math.round(n * 1000) / 1000

/** One candidate, with the evidence beside it. */
export function candidate(row: Row, taste: TasteItem[]): Candidate {
  const { kind, via } = sourceKind(row)
  const { liked, dropped } = nearest(parseVec(row), taste, String(row.id))
  return {
    id: String(row.id), idea: String(row.idea || ''), thesis: row.thesis || null, lane_slot: row.lane_slot || null,
    source_type: row.source_type || null, source_kind: kind, his_via: via, source_url: row.source_url || null,
    created_at: String(row.created_at || ''), score: ladderScore(row),
    why_here: liked ? describe(liked.item) : null,
    near: liked ? { id: liked.item.id, kind: liked.item.kind, similarity: round(liked.similarity) } : null,
    near_drop: dropped ? { id: dropped.item.id, idea: dropped.item.idea, similarity: round(dropped.similarity) } : null,
  }
}

/** His ideas first, then candidates near something he liked (closest first), then the ladder score, then newest. */
export function rank(a: Candidate, b: Candidate): number {
  const tier = (c: Candidate) => (c.source_kind === 'his' ? 0 : c.near ? 1 : 2)
  return tier(a) - tier(b)
    || (b.near?.similarity ?? 0) - (a.near?.similarity ?? 0)
    || (b.score ?? -1) - (a.score ?? -1)
    || b.created_at.localeCompare(a.created_at)
}

/** Whether a row belongs in its pool's window and state. */
export function inWindow(row: Row, kind: SourceKind, win: ReturnType<typeof windows>): boolean {
  const at = String(row.created_at || '')
  if (kind === 'his') return at >= win.his_since
  if (kind === 'engine' && !ENGINE_STATES.includes(String(row.state))) return false
  return at >= win.pool_since
}

export interface Relayed { id: string; title: string; detail: string | null; created_at: string | null }

/**
 * The sources block. rows: candidate content_ideas rows (any source, the route reads the last 15 days);
 * tasteRows: rows that may carry his marks; relayed: open board items holding his words relayed by a session
 * (`krish-ideas-*`) or filed by Control Center (`said-*`), which have no idea row yet.
 */
export function buildSources(input: { weekStart: string; series: string[]; rows: Row[]; tasteRows: Row[]; relayed?: Row[] }) {
  const win = windows(input.weekStart)
  const taste = tasteOf(input.tasteRows)
  const skipped: Record<string, number> = {}
  const pool: Candidate[] = []
  for (const row of input.rows) {
    const why = excluded(row)
    if (why) { skipped[why] = (skipped[why] || 0) + 1; continue }
    const { kind } = sourceKind(row)
    if (!inWindow(row, kind, win)) continue
    pool.push(candidate(row, taste))
  }
  pool.sort(rank)
  const counts = { his: 0, inspo: 0, engine: 0 }
  for (const c of pool) counts[c.source_kind]++
  const relayed: Relayed[] = (input.relayed || []).map(r => ({
    id: String(r.id), title: String(r.title || ''), detail: r.detail ? String(r.detail) : null, created_at: r.created_at || null,
  }))
  const empty: Array<{ source: SourceKind; why: string }> = []
  if (!counts.his) empty.push({ source: 'his', why: relayed.length
    ? `no idea rows from Krish since ${win.his_since.slice(0, 10)}; ${relayed.length} relayed board item(s) hold his words (his_relayed)`
    : `nothing from Krish since ${win.his_since.slice(0, 10)}: no idea through Control Center's one door, no topic he asked to research, no relayed board item` })
  if (!counts.inspo) empty.push({ source: 'inspo', why: `the Drive scan wrote nothing new since ${win.pool_since.slice(0, 10)}; read the Cold Ideas and Inspo folder through the Drive connector` })
  if (!counts.engine) empty.push({ source: 'engine', why: `no seeded or researching engine idea since ${win.pool_since.slice(0, 10)}` })
  const strip = (t: TasteItem) => ({ id: t.id, idea: t.idea, angle: t.angle, reason: t.reason, at: t.at })
  return {
    week_start: input.weekStart,
    windows: win,
    counts,
    empty,
    skipped,
    series: input.series.map(slug => ({ slug, pool: pool.filter(c => c.lane_slot === slug) })),
    unassigned: pool.filter(c => !c.lane_slot || !input.series.includes(c.lane_slot)),
    his_relayed: relayed,
    taste: {
      liked: taste.filter(t => t.kind === 'story' || t.kind === 'angle').map(t => ({ ...strip(t), verdict: t.kind })),
      picks: taste.filter(t => t.kind === 'pick').map(strip),
      ab_wins: taste.filter(t => t.kind === 'ab_win').map(strip),
      drops: taste.filter(t => t.kind === 'drop').map(strip),
    },
  }
}
