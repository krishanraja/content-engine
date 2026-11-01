import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_supabase.js'
import { guardEngine, operatorBearerAllowed } from '../_auth.js'
import { isMonday, keepThroughWeek, mergeCovers, parseOptions, type WeekOptionMeta } from '../_weekOptions.js'
import { buildSources, windows } from '../_weekSources.js'
import { buildInspiration, RECENT_DAYS } from '../_inspirationSources.js'
import { CUE_COLS, cuesFrom } from '../_feedbackCues.js'
import { TASTE_VENTURE } from '../_taste.js'
import { buildOffdayVerdicts, offdayWeeksBefore } from './_offdayVerdicts.js'

// GET  /api/week/options?week_start=YYYY-MM-DD
//        what the Sunday session needs to plan the week: each publishing
//        series' mandate, the options already written for that week, what is
//        in flight or scheduled, the judges' best ready pieces, and the ideas
//        Krish dropped in during the last fortnight. `scheduled` is every
//        piece of the series scheduled inside that week (Monday to Sunday)
//        in any picked state, published included: the publish watcher marks
//        a piece published once its Substack post is live, and the day still
//        holds it while Krish posts the rest (the week's publish board reads
//        each day's piece from here; Control Center's weekPlan counts the
//        same states as picked).
// GET  /api/week/options?week_start=YYYY-MM-DD&include=sources
//        adds `sources`: Sunday's idea pool from every source (his, his inspo
//        folder, the engine's research), each idea ranked his first, then near
//        something he liked, then its ladder score, with the evidence of his
//        taste beside it (_weekSources.ts), and `sources.inspiration`: what his
//        Inspiration House holds (cards he routed, answered or has not seen,
//        content-watcher readings, creator moves, taste claims) with the ids the
//        Ideas tab must cover (_inspirationSources.ts), and `sources.cues`: his
//        feedback cues (future pieces owed, wider pieces by theme, topics
//        tracked, briefs waiting, not for us) that the Inspiration House files
//        from his words (_feedbackCues.ts); a missing table is said in `empty`,
//        never a failure. Evidence only: no model, no write, and the judges
//        never read it.
// POST /api/week/options  { week_start, series, options: [{ id, rank, pitch, why_now, recommended, covers? }] }
//        writes meta.week_option on each option's row (and its series, when
//        the row has none), keeps each option alive through its week (a seed's
//        own expiry can fall before the purge that would delete it), and
//        clears week_option from rows this day no longer offers. An option's
//        covers (the must_cover ids its board idea answers) are added to the
//        row's meta.covers under its week_start and never cleared, so the
//        Inspiration card a piece picked that week became is known for good
//        (inspiration_card_pieces).
//
// Krish, 2026-10-11: planning is one Sunday decision for the week. The week
// page in Control Center reads these options live from the rows. Nothing here
// picks, schedules, sends or spends; the pick is his press.

const LIVE_STATES = ['seeded', 'researching', 'drafting', 'review', 'approved']
/** A pick holds its day in these states (Control Center's weekPlan, PICKED_STATES). */
export const PICKED_STATES = ['drafting', 'review', 'approved', 'published']

/** The Sunday that ends the week starting on that Monday, YYYY-MM-DD. */
export function weekEnd(monday: string): string {
  const d = new Date(`${monday}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 6)
  return d.toISOString().slice(0, 10)
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    const week = String(req.query.week_start || '')
    if (!isMonday(week)) return res.status(400).json({ ok: false, error: 'week_start must be a Monday, YYYY-MM-DD' })
    const [formats, rows, dropped, held] = await Promise.all([
      supabase.from('venture_formats').select('slug,label,cadence_label,mandate').eq('venture_slug', 'publication').eq('kind', 'subchannel').eq('active', true),
      supabase.from('content_ideas').select('id,idea,thesis,state,lane_slot,scheduled_for,meta,created_at,updated_at').in('state', LIVE_STATES).is('buried_at', null).is('library_at', null).limit(1500),
      supabase.from('content_ideas').select('id,idea,state,lane_slot,source_url,created_at').eq('source_type', 'manual').gte('created_at', new Date(Date.now() - 14 * 86_400_000).toISOString()).limit(50),
      supabase.from('content_ideas').select('id,idea,state,lane_slot,scheduled_for').in('state', PICKED_STATES).is('buried_at', null).gte('scheduled_for', week).lte('scheduled_for', weekEnd(week)).limit(100),
    ])
    if (formats.error || rows.error || held.error) return res.status(500).json({ ok: false, error: (formats.error || rows.error || held.error)!.message })
    const all = (rows.data || []) as Array<Record<string, any>>
    const scheduledRows = (held.data || []) as Array<Record<string, any>>
    // The title of record (content_ideas.title, 20261120090000_content_ideas_title.sql); none until that migration runs.
    const titled = scheduledRows.length ? await supabase.from('content_ideas').select('id,title').in('id', scheduledRows.map(r => r.id)) : null
    const titleOf = new Map(((titled && !titled.error && titled.data) || []).map((r: Record<string, any>) => [r.id, r.title || null]))
    const series = ((formats.data || []) as Array<Record<string, any>>).map(f => {
      const mine = all.filter(r => r.lane_slot === f.slug)
      const score = (r: Record<string, any>) => Number(r.meta?.ladder?.final?.score ?? r.meta?.ladder?.score ?? -1)
      return {
        slug: f.slug, label: f.label, cadence: f.cadence_label, mandate: f.mandate,
        options: all.filter(r => r.meta?.week_option?.week_start === week && r.meta?.week_option?.series === f.slug)
          .map(r => ({ id: r.id, idea: r.idea, state: r.state, ...r.meta.week_option })).sort((a, b) => a.rank - b.rank),
        in_flight: mine.filter(r => ['drafting', 'review', 'approved'].includes(r.state)).map(r => ({ id: r.id, idea: r.idea, state: r.state, scheduled_for: r.scheduled_for })),
        scheduled: scheduledRows.filter(r => r.lane_slot === f.slug)
          .map(r => ({ id: r.id, idea: r.idea, title: titleOf.get(r.id) ?? null, state: r.state, scheduled_for: r.scheduled_for }))
          .sort((a, b) => String(a.scheduled_for).localeCompare(String(b.scheduled_for)) || String(a.id).localeCompare(String(b.id))),
        judged_best: mine.filter(r => (r.state === 'seeded' || r.state === 'researching') && score(r) >= 0)
          .sort((a, b) => score(b) - score(a)).slice(0, 8)
          .map(r => ({ id: r.id, idea: r.idea, thesis: r.thesis, state: r.state, score: score(r), band: r.meta?.ladder?.final?.band ?? null })),
      }
    })
    const out: Record<string, unknown> = { ok: true, week_start: week, series, dropped_by_krish: dropped.data || [] }
    if (String(req.query.include || '').split(',').includes('sources')) {
      try {
        out.sources = await readSources(week, series.map(s => String(s.slug)))
      } catch (e) {
        return res.status(500).json({ ok: false, error: `sources: ${(e as Error).message}` })
      }
    }
    return res.status(200).json(out)
  }

  const { week_start, series, options, problems } = parseOptions(req.body)
  if (problems.length) return res.status(400).json({ ok: false, error: 'bad_options', problems })
  const fmt = await supabase.from('venture_formats').select('slug,kind,active').eq('slug', series).maybeSingle()
  if (fmt.error) return res.status(500).json({ ok: false, error: fmt.error.message })
  const f = fmt.data as { kind?: string; active?: boolean } | null
  if (!f || f.kind !== 'subchannel' || f.active === false) return res.status(400).json({ ok: false, error: 'series_not_live', problems: [`"${series}" is not a series that publishes`] })

  const by = operatorBearerAllowed(req) ? 'Claude Code' : 'Krish'
  const at = new Date().toISOString()
  const ids = options.map(o => o.id)
  const [chosen, previous] = await Promise.all([
    ids.length ? supabase.from('content_ideas').select('id,state,lane_slot,meta,expires_at,updated_at').in('id', ids) : Promise.resolve({ data: [], error: null }),
    supabase.from('content_ideas').select('id,meta').eq('meta->week_option->>week_start', week_start).eq('meta->week_option->>series', series),
  ])
  if (chosen.error || previous.error) return res.status(500).json({ ok: false, error: (chosen.error || previous.error)!.message })
  const found = new Map(((chosen.data || []) as Array<Record<string, any>>).map(r => [r.id, r]))
  const missing = ids.filter(id => !found.has(id))
  if (missing.length) return res.status(404).json({ ok: false, error: 'piece_not_found', problems: missing.map(id => `no piece ${id}`) })
  const dead = [...found.values()].filter(r => !LIVE_STATES.includes(r.state))
  if (dead.length) return res.status(409).json({ ok: false, error: 'not_offerable', problems: dead.map(r => `${r.id} is ${r.state}`) })

  const written: string[] = []
  for (const o of options) {
    const row = found.get(o.id)!
    const meta = row.meta && typeof row.meta === 'object' ? row.meta : {}
    const option: WeekOptionMeta = { week_start, series, rank: o.rank, pitch: o.pitch, why_now: o.why_now, recommended: Boolean(o.recommended), by, at }
    const covers = mergeCovers(meta.covers, week_start, o.covers)
    const patch: Record<string, unknown> = { meta: { ...meta, week_option: option, ...(covers ? { covers } : {}) }, updated_at: at }
    // A row with no series takes the day's (the judges' ladder fills an empty slot the same way); a stored series is never overwritten.
    if (!row.lane_slot) patch.lane_slot = series
    const keep = keepThroughWeek(row.expires_at, week_start)
    if (keep) patch.expires_at = keep
    const up = await supabase.from('content_ideas').update(patch).eq('id', o.id).eq('updated_at', row.updated_at).select('id')
    if (up.error) return res.status(500).json({ ok: false, error: up.error.message, written })
    if (!up.data?.length) return res.status(409).json({ ok: false, error: 'changed_retry', problems: [`${o.id} changed while this was saving; send it again`], written })
    written.push(o.id)
  }
  const cleared: string[] = []
  for (const r of (previous.data || []) as Array<Record<string, any>>) {
    if (ids.includes(r.id)) continue
    const { week_option: _gone, ...rest } = r.meta || {}
    const up = await supabase.from('content_ideas').update({ meta: rest, updated_at: at }).eq('id', r.id)
    if (!up.error) cleared.push(r.id)
  }
  return res.status(200).json({ ok: true, week_start, series, written, cleared })
}

const SOURCE_COLS = 'id,idea,thesis,state,lane_slot,source_type,source_url,source_ref,origin,created_at,scheduled_for,published_at,buried_at,library_at,queued_at,embedding,meta'
const TASTE_COLS = 'id,idea,state,scheduled_for,embedding,meta'

/** The reads behind `sources`: candidates from the last fifteen days, the rows that may carry his marks, and the
 *  open board items holding his relayed words. Read-only. */
async function readSources(week: string, slugs: string[]) {
  const win = windows(week)
  const since90 = new Date(Date.parse(`${week}T00:00:00Z`) - 90 * 86_400_000).toISOString().slice(0, 10)
  const [rows, marked, picked, chosen, relayed] = await Promise.all([
    supabase.from('content_ideas').select(SOURCE_COLS).gte('created_at', win.pool_since).order('created_at', { ascending: false }).limit(600),
    supabase.from('content_ideas').select(TASTE_COLS).not('meta->queue', 'is', null).limit(500),
    supabase.from('content_ideas').select(TASTE_COLS).not('scheduled_for', 'is', null).gte('scheduled_for', since90).limit(200),
    supabase.from('content_ideas').select(TASTE_COLS).eq('meta->week_option->>by', 'Krish').limit(200),
    supabase.from('work_board_items').select('id,title,detail,created_at,lane,closed_by')
      .or('id.like.krish-ideas-%,id.like.said-%').is('closed_by', null).not('lane', 'in', '(done,archived)').limit(50),
  ])
  const failed = rows.error || marked.error || picked.error || chosen.error || relayed.error
  if (failed) throw new Error(failed.message)
  const tasteRows = [...(marked.data || []), ...(picked.data || []), ...(chosen.data || [])] as Array<Record<string, any>>
  const sources = buildSources({ weekStart: week, series: slugs, rows: (rows.data || []) as Array<Record<string, any>>, tasteRows, relayed: (relayed.data || []) as Array<Record<string, any>> })
  // A said idea is a manual content idea and an inspiration card at once (20261118093200_inspiration_said_cards.sql);
  // the idea already read here is the one Sunday counts, so its card is not counted again.
  const listed = ((rows.data || []) as Array<Record<string, any>>).map(r => String(r.id))
  const [inspiration, cues, offday] = await Promise.all([readInspiration(week, listed), readCues(), readOffdayVerdicts(week)])
  const empty = [...sources.empty, ...(cues.empty ? [cues.empty] : []), ...(offday.empty ? [offday.empty] : [])]
  return { ...sources, empty, inspiration, cues: cues.cues, offday_verdicts: offday.block }
}

/** His verdicts on the last weeks' off-day options (_offdayVerdicts.ts): what Sunday learns from. Never fails the
 *  gather: a failed read is said in `empty`. */
async function readOffdayVerdicts(week: string) {
  try {
    const res = await supabase.from('board_documents').select('week,doc_id,body').eq('collection', 'queue').like('doc_id', 'off-%')
      .in('week', offdayWeeksBefore(week)).limit(2000)
    if (res.error) throw new Error(res.error.message)
    return { block: buildOffdayVerdicts((res.data || []) as Array<Record<string, unknown>>), empty: null }
  } catch (e) {
    return { block: buildOffdayVerdicts([]), empty: `his off-day verdicts could not be read (${String((e as Error).message || 'unknown error').slice(0, 160)}); Sunday's off-day options are made without them` }
  }
}

/** His open feedback cues (_feedbackCues.ts), Make Your Mind Up's only (TASTE_VENTURE): a cue another venture's
 *  session filed is that venture's. Never fails the gather: a table not applied yet, or a failed read, is said in
 *  `empty` and Sunday carries on. */
async function readCues() {
  try {
    const res = await supabase.from('feedback_cues').select(CUE_COLS).eq('venture', TASTE_VENTURE).eq('status', 'open').order('said_at', { ascending: true }).limit(1000)
    return cuesFrom({ data: (res.data || null) as Array<Record<string, any>> | null, error: res.error })
  } catch (e) {
    return cuesFrom({ data: null, error: { message: (e as Error).message } })
  }
}

const INSPO_COLS = 'id,name,folder,lane,kind,facets,why_here,route,routes,why_like,why_like_source,would_do,note_for_claude,answered_at,answered_by,dismissed_at,created_at,piece_id,auto_tags,confirmed_tags,transcript'

/** Inspiration House and content-watcher (_inspirationSources.ts). A table that cannot be read fails the gather
 *  loudly: Sunday must never look complete while his routed cards are missing (Krish, 2026-10-24). */
async function readInspiration(week: string, listed: string[] = []) {
  const recentSince = new Date(Date.parse(`${week}T00:00:00Z`) - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10)
  const [items, routed, asked, recent, reads, moves, claims] = await Promise.all([
    supabase.from('inspiration_items').select(INSPO_COLS).order('created_at', { ascending: false }).limit(500),
    // Every card he routed to Make a piece, however old: the newest 500 above could leave one out of must_cover.
    supabase.from('inspiration_items').select(INSPO_COLS).or('route.eq.make_piece,routes.cs.{make_piece}').is('piece_id', null).limit(1000),
    // Every card he typed words on, dismissed or routed included (asks, Krish 2026-10-31); buildAsks keeps the ASK_DAYS window.
    supabase.from('inspiration_items').select(INSPO_COLS).or('why_here.not.is.null,why_like_source.eq.typed,would_do.not.is.null')
      .order('created_at', { ascending: false }).limit(1000),
    // Pieces scheduled in the RECENT_DAYS before the week, for the no-repeat check (board_feed.py cover).
    supabase.from('content_ideas').select('id,idea,state,lane_slot,scheduled_for,meta').in('state', PICKED_STATES).is('buried_at', null)
      .gte('scheduled_for', recentSince).lt('scheduled_for', week).limit(200),
    supabase.from('content_reads').select('id,sha256,source_url,platform,shape,read_md,created_at').order('created_at', { ascending: false }).limit(60),
    supabase.from('creator_moves').select('id,creator_slug,post_url,why_it_works,krish_angle,content_idea_id,created_at').order('created_at', { ascending: false }).limit(20),
    // The ledger's claims and the answers they quote are Make Your Mind Up's only (TASTE_VENTURE).
    supabase.from('taste_claims').select('id,layer,kind,status,statement,krish,krish_source_id,support_n').eq('venture', TASTE_VENTURE)
      .in('status', ['candidate', 'proposed']).order('updated_at', { ascending: false }).limit(100),
  ])
  const failed = items.error || routed.error || asked.error || recent.error || reads.error || moves.error || claims.error
  if (failed) throw new Error(`inspiration: ${failed.message}`)
  // A claim keeps its quote while the answer it quotes is withdrawn; it is his words only while that answer stands.
  const quoted = [...new Set((claims.data || []).map((c: Record<string, any>) => c.krish_source_id).filter(Boolean))] as string[]
  const standing = quoted.length
    ? await supabase.from('taste_evidence').select('id').eq('venture', TASTE_VENTURE).in('id', quoted).is('withdrawn_at', null)
    : { data: [], error: null }
  if (standing.error) throw new Error(`inspiration: ${standing.error.message}`)
  const seen = new Set((items.data || []).map((r: Record<string, any>) => r.id))
  const all = [...(items.data || [])] as Array<Record<string, any>>
  for (const r of [...(routed.data || []), ...(asked.data || [])] as Array<Record<string, any>>) if (!seen.has(r.id)) { seen.add(r.id); all.push(r) }
  return buildInspiration({ weekStart: week, items: all as Array<Record<string, any>>,
    reads: (reads.data || []) as Array<Record<string, any>>, moves: (moves.data || []) as Array<Record<string, any>>,
    claims: (claims.data || []) as Array<Record<string, any>>, listedIdeas: listed, recentPieces: (recent.data || []) as Array<Record<string, any>>,
    quotesStanding: (standing.data || []).map((r: Record<string, any>) => String(r.id)) })
}
