import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { fetchPoolDays, poolConfigured } from '../_pool.js'
import { onTeardownBeat } from '../_beat.js'
import { purgeBoundary } from '../_weeks.js'
import { withContentRun } from '../_runs.js'
import { recordObservations, type ObservationInput } from '../_observations.js'

// Daily Feed ingest (Content Engine v2, spec §4).
//
// Pulls the last two days of the CTRL corroborated headlines pool into
// content_ideas as ambient Feed rows: horizon='news', source_type='pool_headline',
// expires_at = the coming Monday 14:00 UTC purge boundary. The Feed carries zero
// obligations; these rows exist so the weekly shift detection and brief assembly
// have a lived, dated corpus, and so the Feed room can show what was read.
//
//   GET (CRON_SECRET)  — daily 11:30 UTC (after the pool's 10:30 prewarm)
//   POST               — on-demand backstop
//
// Newsletters keep arriving via the n8n Inspiration Sweep; Zara via her sweep.
//
// ── The beat gate, wired in 2026-09-09 ───────────────────────────────────
//
// This route inserted every story the pool handed it. The gate in api/_beat.ts
// existed the whole time, written from Krish's own definition of the beat, and
// three other routes called it; this one, the one that actually fills the
// corpus, did not. So the pile the shift detector clusters and the brief
// assembles from was ungated, and the detector's own classifier was discarding
// 60 percent of what it found: exactly its DISCARD_ALARM threshold, whose
// message reads "the corpus is wrong, not the ontology. Change the sources, not
// the lenses." This is that change.
//
// Off-beat stories are not inserted rather than inserted-and-marked. The pool
// is a rolling feed with a Monday expiry, not a record anybody audits, and a
// corpus that keeps its own noise makes every downstream reader responsible for
// remembering to filter it. The count comes back in the response and lands in
// content_engine_runs, so the discard is still visible.
//
// ── The observation record, wired in 2026-09-22 ──────────────────────────
//
// "The count is still visible" was true and was not enough. content_engine_runs
// keeps `off_beat: 41` and nothing about WHICH 41, so the gate has never been
// auditable: whether it is rejecting noise or rejecting the next shift a week
// early is not a question a number can answer. And the stories it admitted
// fared no better, because the Monday purge deletes whatever did not become a
// shift.
//
// Every story the pool hands us now lands in trend_observations first, with
// what we decided about it on the same row: surfaced, or dropped and why. That
// table is append only and nothing ever deletes from it. The desk still clears
// every Monday; the record of what arrived does not. See api/_observations.ts.
//
// The write is best effort and deliberately does not gate the ingest. A feed
// that stops because its archive is unavailable would be a worse failure than
// the one this fixes.

const LOOKBACK_DAYS = 2

async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (guardCronRoute(req, res)) return

  // An unconfigured pool is a failure, not a quiet success. This used to
  // return 200 with a `skipped` note nobody read, so the feed could stop for
  // weeks while every cron dashboard stayed green.
  if (!poolConfigured()) {
    return res.status(500).json({ ok: false, error: 'pool not configured (CTRL_SUPABASE_URL / CTRL_SUPABASE_SERVICE_KEY unset)' })
  }

  try {
    const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10)
    const { days, stories } = await fetchPoolDays(since)
    if (!stories.length) return res.json({ ok: true, days, fetched: 0, inserted: 0, off_beat: 0 })

    // Dedupe by URL (primary) and normalized headline (fallback) against the
    // last 14 days of pool-sourced rows.
    const sinceISO = new Date(Date.now() - 14 * 86_400_000).toISOString()
    const { data: existing, error: exErr } = await supabase
      .from('content_ideas')
      .select('source_url, title_norm')
      .eq('source_type', 'pool_headline')
      .gte('created_at', sinceISO)
      .limit(3000)
    if (exErr) throw new Error(exErr.message)
    const seenUrls = new Set((existing || []).map(r => r.source_url).filter(Boolean))
    const seenTitles = new Set((existing || []).map(r => r.title_norm).filter(Boolean))

    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 160)
    const expiresAt = purgeBoundary(new Date()).toISOString()

    const rows: Record<string, unknown>[] = []
    const observed: ObservationInput[] = []
    // Every story the pool handed us, with the verdict on the same row. The
    // pool's own day is the observation day rather than today, so a re-run and
    // the two-day lookback converge instead of writing the same story twice.
    const observe = (
      s: typeof stories[number],
      surfaced: boolean,
      dropReason?: 'off_beat' | 'duplicate',
    ) => {
      observed.push({
        observedOn: s.day,
        origin: 'pool_headline',
        collector: 'feed/ingest',
        title: s.headline,
        snippet: s.say,
        url: s.url,
        sourceHost: s.source,
        category: s.category,
        sourceCount: s.sourceCount,
        sourceUrls: s.sourceUrls,
        surfaced,
        dropReason: dropReason ?? null,
        raw: { pool: { day: s.day, category: s.category, source: s.source, source_count: s.sourceCount, source_urls: s.sourceUrls } },
      })
    }

    let offBeat = 0
    for (const s of stories) {
      const titleNorm = norm(s.headline)
      if ((s.url && seenUrls.has(s.url)) || seenTitles.has(titleNorm)) { observe(s, false, 'duplicate'); continue }
      // `say` is the pool's one-line reading of the story, which is the number
      // sentence the gate's middle tier is built to be rescued by.
      if (!onTeardownBeat(s.headline, s.say)) { offBeat++; observe(s, false, 'off_beat'); continue }
      if (s.url) seenUrls.add(s.url)
      seenTitles.add(titleNorm)
      observe(s, true)
      rows.push({
        idea: s.headline,
        thesis: s.say,
        source_type: 'pool_headline',
        source_ref: `pool:${s.day}`,
        source_url: s.url,
        source_snippet: s.say,
        source_captured_at: `${s.day}T12:00:00Z`,
        state: 'seeded',
        origin: 'agent',
        horizon: 'news',
        expires_at: expiresAt,
        title_norm: titleNorm,
        meta: { pool: { day: s.day, category: s.category, source: s.source, source_count: s.sourceCount, source_urls: s.sourceUrls } },
      })
    }

    let inserted = 0
    if (rows.length) {
      const { error: insErr, count } = await supabase
        .from('content_ideas')
        .insert(rows, { count: 'exact' })
      if (insErr) throw new Error(insErr.message)
      inserted = count ?? rows.length
    }

    // After the desk write, never before it: the archive is the thing that can
    // be caught up later, the feed is not. `recorded` lands in the run ledger,
    // so an archive that silently stops writing is visible as a zero next to a
    // non-zero `fetched` rather than as nothing at all.
    const archive = await recordObservations(observed)

    return res.json({
      ok: true, days, fetched: stories.length, inserted, off_beat: offBeat,
      observed: archive.attempted, recorded: archive.written,
      ...(archive.ok ? {} : { observation_error: archive.reason }),
    })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}

// Every run lands in content_engine_runs so the Content tab can say when this
// job last succeeded. See api/_runs.ts.
export default withContentRun('feed_ingest', handler)
