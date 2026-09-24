import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { fetchPoolDays, poolConfigured } from '../_pool.js'
import { onTeardownBeat } from '../_beat.js'
import { purgeBoundary } from '../_weeks.js'
import { withContentRun } from '../_runs.js'
import { recordObservations, type ObservationInput } from '../_observations.js'
import { classifyRelevance, type RelevanceVerdict } from '../_relevance.js'

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
      dropReason?: 'off_beat' | 'duplicate' | 'off_vertical' | 'too_technical',
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

    // Pass 1: the free filters. Dedupe, then the regex beat gate.
    const candidates: { s: typeof stories[number]; titleNorm: string }[] = []
    let offBeat = 0
    for (const s of stories) {
      const titleNorm = norm(s.headline)
      if ((s.url && seenUrls.has(s.url)) || seenTitles.has(titleNorm)) { observe(s, false, 'duplicate'); continue }
      // `say` is the pool's one-line reading of the story, which is the number
      // sentence the gate's middle tier is built to be rescued by.
      if (!onTeardownBeat(s.headline, s.say)) { offBeat++; observe(s, false, 'off_beat'); continue }
      if (s.url) seenUrls.add(s.url)
      seenTitles.add(titleNorm)
      candidates.push({ s, titleNorm })
    }

    // Pass 2: the model. This lane had none — it was the only path into
    // content_ideas with nothing but a regex between the source and the table,
    // and that regex ends on `return !OFF_BEAT.test(headline)`, so a story it
    // had no word for was admitted rather than judged. That is how a Bloomberg
    // bond-yields video interview reached Krish's triage queue while `finance`
    // had been a muted vertical in this very classifier since 2026-06-17.
    //
    // Fail-open, on purpose and at three levels: no key, a thrown call, or a
    // chunk error inside classifyRelevance all end with the story kept. The
    // Feed is the corpus the synthesis engine reads across, and a quiet empty
    // day would cost more than a dull row. Every one of those cases is counted
    // and returned, so an unjudged run reads as unjudged instead of as clean.
    const verdicts = new Map<string, RelevanceVerdict>()
    let classified = 0
    let classifierNote: string | null = null
    if (candidates.length) {
      if (!process.env.ANTHROPIC_API_KEY) {
        classifierNote = 'ANTHROPIC_API_KEY not configured: every story kept unjudged'
      } else {
        try {
          const vs = await classifyRelevance(
            candidates.map((c, i) => ({ id: String(i), title: c.s.headline, text: c.s.say })),
            { apiKey: process.env.ANTHROPIC_API_KEY, surface: 'content', agent: 'feed-ingest' },
          )
          for (const v of vs) verdicts.set(v.id, v)
          classified = vs.length
        } catch (e: any) {
          classifierNote = `classifier failed, every story kept: ${String(e?.message || e).slice(0, 160)}`
        }
      }
    }

    // Matches the ingest gate in content-ideas.ts rather than inventing a
    // second threshold for the same judgment.
    const DROP_CONFIDENCE = 0.85
    const refused: Record<string, number> = {}
    let dullButKept = 0
    for (const [i, c] of candidates.entries()) {
      const v = verdicts.get(String(i))
      if (v && (v.verdict === 'off_vertical' || v.verdict === 'too_technical') && v.confidence >= DROP_CONFIDENCE) {
        refused[v.verdict] = (refused[v.verdict] || 0) + 1
        observe(c.s, false, v.verdict)
        continue
      }
      // Recorded, never enforced. See the Verdict doc comment in _relevance.ts:
      // an item that is dull alone is often a thread in a synthesis, so this
      // number gets watched before it is allowed to delete anything.
      if (v?.verdict === 'not_interesting') dullButKept++
      observe(c.s, true)
      rows.push({
        idea: c.s.headline,
        thesis: c.s.say,
        source_type: 'pool_headline',
        source_ref: `pool:${c.s.day}`,
        source_url: c.s.url,
        source_snippet: c.s.say,
        source_captured_at: `${c.s.day}T12:00:00Z`,
        state: 'seeded',
        origin: 'agent',
        horizon: 'news',
        expires_at: expiresAt,
        title_norm: c.titleNorm,
        meta: {
          pool: { day: c.s.day, category: c.s.category, source: c.s.source, source_count: c.s.sourceCount, source_urls: c.s.sourceUrls, truncated: c.s.truncated },
          ...(v ? { relevance: { verdict: v.verdict, confidence: v.confidence, rationale: v.rationale } } : {}),
        },
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
      classified, refused, dull_but_kept: dullButKept,
      ...(classifierNote ? { classifier_note: classifierNote } : {}),
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
