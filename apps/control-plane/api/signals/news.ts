import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { withContentRun } from '../_runs.js'
import { recordObservations, type ObservationInput } from '../_observations.js'
import { gdeltArticles, hnStories, signalsQueryFor, velocity } from '../_signals.js'

// Daily news velocity for the pieces in play.
//
// For each piece in review, approved or published in the last thirty days,
// read what GDELT saw about its subject in the last two days and what Hacker
// News said, and record every headline in trend_observations (origin gdelt or
// hn, collector signals/news, storyKey the piece's id, dropped as
// gathered_not_selected because this is a record of the world moving, never a
// feed item). Counting those rows by piece and day is the velocity behind the
// news-wall picture (docs/ENGINE_100X.md, "The pile-on, proven").
//
// When a subject doubles in a day (velocity() says spiking), the board's
// "News velocity" signal turns to warn and names it, so Krish sees a pile-on
// the day it happens. The write to the board is best effort.
//
//   GET (CRON_SECRET)  — daily 06:30 UTC   ·   POST — on demand
//
// GDELT allows one call every five seconds per IP, so this stays small: at
// most MAX_SUBJECTS pieces a run, about forty seconds of GDELT between them.

const MAX_SUBJECTS = 6
const LOOKBACK_DAYS = 30
const BOARD_SIGNAL = 'News velocity'

interface Subject { id: string; idea: string | null; lane_slot: string | null; state: string; meta: unknown }

async function noteOnBoard(spiking: Array<{ subject: string }>): Promise<boolean> {
  try {
    const { data } = await supabase.from('work_board_state').select('signals').eq('id', 'board').maybeSingle()
    const current = Array.isArray((data as any)?.signals) ? (data as any).signals as Array<{ label: string; state: string; text: string }> : []
    const kept = current.filter(s => s?.label !== BOARD_SIGNAL)
    const line = spiking.length
      ? { label: BOARD_SIGNAL, state: 'warn', text: `${spiking.map(s => s.subject).join('; ')}: doubled in a day` }
      : { label: BOARD_SIGNAL, state: 'ok', text: 'No subject doubled today' }
    const signals = [...kept, line].slice(-8)
    const { error } = await supabase
      .from('work_board_state')
      .update({ signals, updated_by: 'signals/news', updated_at: new Date().toISOString() })
      .eq('id', 'board')
    return !error
  } catch {
    return false
  }
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardCronRoute(req, res)) return
  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString()
    const { data, error } = await supabase
      .from('content_ideas')
      .select('id, idea, lane_slot, state, meta')
      .in('state', ['review', 'approved', 'published'])
      .gte('updated_at', since)
      .order('updated_at', { ascending: false })
      .limit(MAX_SUBJECTS)
    if (error) return res.status(500).json({ ok: false, error: error.message })
    const subjects = (data || []) as Subject[]
    if (!subjects.length) return res.status(200).json({ ok: true, skipped: 'no piece in review, approved or published in the last thirty days', subjects: 0 })

    const inputs: ObservationInput[] = []
    const report: Array<{ idea_id: string; subject: string; gdelt: number; hn: number; today: number; yesterday: number; outlets: number; spiking: boolean; note?: string }> = []
    for (const s of subjects) {
      const subject = signalsQueryFor(s)
      if (!subject) continue
      let note: string | undefined
      let articles: Awaited<ReturnType<typeof gdeltArticles>> = []
      let stories: Awaited<ReturnType<typeof hnStories>> = []
      try { articles = await gdeltArticles(subject, 2, 25) } catch (e: any) { note = `gdelt: ${String(e?.message || e)}` }
      try { stories = await hnStories(subject, 10) } catch (e: any) { note = `${note ? note + '; ' : ''}hn: ${String(e?.message || e)}` }
      for (const a of articles) {
        inputs.push({
          origin: 'gdelt', collector: 'signals/news', title: a.title, url: a.url, sourceHost: a.domain || null,
          publishedAt: a.seen || null, storyKey: s.id, surfaced: false, dropReason: 'gathered_not_selected',
          raw: { subject, idea_id: s.id },
        })
      }
      for (const h of stories) {
        inputs.push({
          origin: 'hn', collector: 'signals/news', title: h.title, url: h.url || h.discussion, sourceHost: 'news.ycombinator.com',
          publishedAt: h.created || null, score: h.points, storyKey: s.id, surfaced: false, dropReason: 'gathered_not_selected',
          raw: { subject, idea_id: s.id, discussion: h.discussion, comments: h.comments },
        })
      }
      const v = velocity(articles)
      report.push({ idea_id: s.id, subject, gdelt: articles.length, hn: stories.length, ...v, ...(note ? { note } : {}) })
    }

    const archive = await recordObservations(inputs)
    const spiking = report.filter(r => r.spiking)
    const board = await noteOnBoard(spiking)
    return res.status(200).json({
      ok: true,
      subjects: report.length,
      observed: archive.attempted,
      recorded: archive.written,
      spiking: spiking.length,
      board_noted: board ? 1 : 0,
      report,
      ...(archive.ok ? {} : { observation_error: archive.reason }),
    })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}

export default withContentRun('signals_news', handler)
