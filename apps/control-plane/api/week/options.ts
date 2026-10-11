import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_supabase.js'
import { guardEngine, operatorBearerAllowed } from '../_auth.js'
import { isMonday, parseOptions, type WeekOptionMeta } from '../_weekOptions.js'

// GET  /api/week/options?week_start=YYYY-MM-DD
//        what the Sunday session needs to plan the week: each publishing
//        series' mandate, the options already written for that week, what is
//        in flight or scheduled, the judges' best ready pieces, and the ideas
//        Krish dropped in during the last fortnight.
// POST /api/week/options  { week_start, series, options: [{ id, rank, pitch, why_now, recommended }] }
//        writes meta.week_option on each option's row (and its series, when
//        the row has none), and clears it from rows this day no longer offers.
//
// Krish, 2026-10-11: planning is one Sunday decision for the week. The week
// page in Control Center reads these options live from the rows. Nothing here
// picks, schedules, sends or spends; the pick is his press.

const LIVE_STATES = ['seeded', 'researching', 'drafting', 'review', 'approved']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    const week = String(req.query.week_start || '')
    if (!isMonday(week)) return res.status(400).json({ ok: false, error: 'week_start must be a Monday, YYYY-MM-DD' })
    const [formats, rows, dropped] = await Promise.all([
      supabase.from('venture_formats').select('slug,label,cadence_label,mandate').eq('venture_slug', 'publication').eq('kind', 'subchannel').eq('active', true),
      supabase.from('content_ideas').select('id,idea,thesis,state,lane_slot,scheduled_for,meta,created_at,updated_at').in('state', LIVE_STATES).is('buried_at', null).is('library_at', null).limit(1500),
      supabase.from('content_ideas').select('id,idea,state,lane_slot,source_url,created_at').eq('source_type', 'manual').gte('created_at', new Date(Date.now() - 14 * 86_400_000).toISOString()).limit(50),
    ])
    if (formats.error || rows.error) return res.status(500).json({ ok: false, error: (formats.error || rows.error)!.message })
    const all = (rows.data || []) as Array<Record<string, any>>
    const series = ((formats.data || []) as Array<Record<string, any>>).map(f => {
      const mine = all.filter(r => r.lane_slot === f.slug)
      const score = (r: Record<string, any>) => Number(r.meta?.ladder?.final?.score ?? r.meta?.ladder?.score ?? -1)
      return {
        slug: f.slug, label: f.label, cadence: f.cadence_label, mandate: f.mandate,
        options: all.filter(r => r.meta?.week_option?.week_start === week && r.meta?.week_option?.series === f.slug)
          .map(r => ({ id: r.id, idea: r.idea, state: r.state, ...r.meta.week_option })).sort((a, b) => a.rank - b.rank),
        in_flight: mine.filter(r => ['drafting', 'review', 'approved'].includes(r.state)).map(r => ({ id: r.id, idea: r.idea, state: r.state, scheduled_for: r.scheduled_for })),
        judged_best: mine.filter(r => (r.state === 'seeded' || r.state === 'researching') && score(r) >= 0)
          .sort((a, b) => score(b) - score(a)).slice(0, 8)
          .map(r => ({ id: r.id, idea: r.idea, thesis: r.thesis, state: r.state, score: score(r), band: r.meta?.ladder?.final?.band ?? null })),
      }
    })
    return res.status(200).json({ ok: true, week_start: week, series, dropped_by_krish: dropped.data || [] })
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
    ids.length ? supabase.from('content_ideas').select('id,state,lane_slot,meta,updated_at').in('id', ids) : Promise.resolve({ data: [], error: null }),
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
    const patch: Record<string, unknown> = { meta: { ...meta, week_option: option }, updated_at: at }
    // A row with no series takes the day's (the judges' ladder fills an empty slot the same way); a stored series is never overwritten.
    if (!row.lane_slot) patch.lane_slot = series
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
