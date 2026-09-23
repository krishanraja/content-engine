import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { weekLabelBack } from '../_weeks.js'
import { withContentRun } from '../_runs.js'

// Snapshot the week's trend series.
//
// trend_observations is raw and grows forever, which is the point of it. This
// turns it into the thing a brief or a dashboard reads: how much was written,
// about what, by whom, this week, and how that compares with last week.
//
// The counting happens in Postgres (snapshot_trend_weekly_metrics), not here.
// A year of gathers is hundreds of thousands of rows and a route that pages
// through them to count them gets slower every week until someone quietly adds
// a limit and the series starts lying without telling anyone.
//
// Two weeks are snapshotted, not one: the week just ended and the one before
// it. Observations arrive late, most obviously from the Monday purge, which
// writes a July-captured row in September and backdates it to July where it
// belongs. Re-snapshotting the previous week catches those, and because the
// metrics table is append only the re-run lands BESIDE the first snapshot
// rather than over it. Both readings stay, and the current view takes the
// newest, so a number that moved can be traced to late arrivals rather than
// leaving everyone to wonder whether the method changed.
//
//   GET (CRON_SECRET) — Sat 06:00 UTC   ·   POST — manual, optional ?week=
//
// Saturday, after Friday's shift detection and brief assembly, so the week's
// editorial work is already reflected in what the series counts.

const METHOD = 'v1'

async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (guardCronRoute(req, res)) return

  try {
    const requested = typeof req.query?.week === 'string' ? req.query.week : null
    if (requested && !/^\d{4}-W\d{2}$/.test(requested)) {
      return res.status(400).json({ ok: false, error: 'week must look like 2026-W38' })
    }

    // Running on Saturday, isoWeekLabel() is the current (nearly finished)
    // week. Its predecessor is the one most likely to have gained late rows.
    const weeks = requested ? [requested] : [weekLabelBack(0), weekLabelBack(1)]

    const snapshots: Record<string, number> = {}
    for (const week of weeks) {
      const { data, error } = await supabase
        .rpc('snapshot_trend_weekly_metrics', { p_week: week, p_method: METHOD })
      if (error) throw new Error(`${week}: ${error.message}`)
      snapshots[week] = typeof data === 'number' ? data : 0
    }

    const written = Object.values(snapshots).reduce((a, b) => a + b, 0)
    // A snapshot of nothing is worth saying out loud. Zero rows for the current
    // week means either no observation reached the record all week, which is a
    // dead collector, or the week label and the observation days disagree,
    // which is a bug. Neither should read as a healthy run.
    const currentWeek = requested ?? weekLabelBack(0)
    if ((snapshots[currentWeek] ?? 0) === 0) {
      return res.json({
        ok: true,
        skipped: 'no observations in the current week',
        weeks: snapshots,
        written,
      })
    }

    return res.json({ ok: true, method: METHOD, weeks: snapshots, written })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}

export default withContentRun('trend_metrics', handler)
