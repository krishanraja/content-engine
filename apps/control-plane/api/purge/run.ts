import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { exportBeforeDelete } from './_archive.js'
import { isoWeekLabel, queueWindowStart } from '../_weeks.js'
import { withContentRun } from '../_runs.js'
import { recordObservations, type ObservationInput, type ObservationOrigin } from '../_observations.js'

// The Monday purge (Content Engine v2, spec §4). Mon 14:00 UTC, after send.
//
// R10: hard delete, no cold archive. Every time-sensitive item meets one of
// three fates and this cron enforces the first:
//   1. EXPIRES  — news-horizon rows past expires_at with no shift and no
//                 library stamp are DELETED. The 200-card pile is structurally
//                 impossible because nothing news-shaped survives its week.
//   2. FEEDS A SHIFT — rows with shift_id are kept (their evidence already
//                 lives in the dossier; the row keeps the Feed history light).
//   3. GRADUATES — rows with library_at are kept forever.
// Also ages out the weekly surfaces so the Content tab stays a week's worth of
// work rather than a growing pile: every brief past its week is archived
// (whatever state it reached), and every decision card past its week is swept
// to 'archived'. Both used to be filtered so narrowly that they never fired -
// see the notes at each. Purge stats go to audit_log so it is observable.
//
//   GET (CRON_SECRET) — Mon 14:00 UTC   ·   POST — manual
//
// ── The observation record, wired in 2026-09-22 ──────────────────────────
//
// R10 is a rule about the DESK, and it is a good one. It became a rule about
// the whole system only because the desk was the only copy. The JSON export
// below has faithfully copied every purged row to a private bucket since it
// was added, and in all that time nothing has ever read one: a bucket of
// timestamped JSON blobs is a restore path, not a queryable record, and no
// trend question can be asked of it.
//
// So before the delete, every doomed row is now also written to
// trend_observations as a dated, queryable, permanently kept observation
// marked purged_unused. "This story reached us on the 4th, nobody wrote about
// it, and it came back on the 19th" is the shape of the question this makes
// answerable, and it was unanswerable by construction until now.
//
// The export's rule extends to it: if the observation write fails, NOTHING is
// deleted. A week of un-purged rows is untidy. A week of rows deleted without
// a record is the failure both of these exist to prevent, and the two are not
// close in cost.

// Where a content_ideas row originally came from, in the observation record's
// vocabulary. Unknown source types fall back to 'purge' rather than being
// guessed at: an honest "arrived via the purge, provenance unrecorded" beats a
// wrong provenance that a trend query would silently count.
const ORIGIN_BY_SOURCE_TYPE: Record<string, ObservationOrigin> = {
  pool_headline: 'pool_headline',
  inspiration_sweep: 'newsletter',
  newsletter: 'newsletter',
  lens_radar: 'exa_lens',
  creator_post: 'creator',
  creator: 'creator',
  build_signal: 'build_signal',
  zara_signal: 'zara',
  investigation: 'investigation',
}

/** A doomed content_ideas row as a permanent observation. The whole row goes
 *  into raw, so a column this mapping does not know about is still kept. */
function toObservation(row: Record<string, unknown>): ObservationInput {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const sourceType = str(row.source_type) || ''
  // When we saw it, preferring the source's own capture stamp over the row's
  // creation time, and never today: a row purged in September that arrived in
  // July belongs on the July day or the volume series is nonsense.
  const capturedAt = str(row.source_captured_at) || str(row.created_at)
  return {
    observedOn: capturedAt ? capturedAt.slice(0, 10) : undefined,
    origin: ORIGIN_BY_SOURCE_TYPE[sourceType] ?? 'purge',
    collector: 'purge/run',
    title: str(row.idea) || str(row.title_norm) || 'untitled',
    snippet: str(row.thesis) || str(row.source_snippet),
    url: str(row.source_url),
    publishedAt: str(row.source_captured_at),
    storyKey: str(row.story_key),
    surfaced: false,
    dropReason: 'purged_unused',
    raw: { content_idea: row },
  }
}

async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (guardCronRoute(req, res)) return

  try {
    const nowIso = new Date().toISOString()
    // Needed before the expiry sweep so the export can be keyed by week; the
    // archive filename is the only handle a restore has.
    const week = isoWeekLabel()

    // Fate 1: expire. Count first so the audit row is honest even though the
    // rows are gone afterwards.
    // Safety floor: a row Krish has started working (drafting or beyond) is
    // never hard-deleted by expiry, even if its expires_at was set while it
    // was still a seed (temporal-class expiry, 2026-07-27).
    const expiredQuery = () => supabase
      .from('content_ideas')
      .select('id', { count: 'exact', head: true })
      .not('expires_at', 'is', null)
      .lte('expires_at', nowIso)
      .is('shift_id', null)
      .is('library_at', null)
      .not('state', 'in', '("drafting","review","approved","published")')
    const { count: toExpire } = await expiredQuery()

    let expired = 0
    let archived_to: string | null = null
    let observations_recorded = 0
    if (toExpire) {
      // Export before deleting. This is the only hard delete in the engine and
      // it runs unattended every Monday, so "we purged the wrong thing" has
      // until now been unrecoverable. The rows go to a private bucket keyed by
      // week; POST /api/purge/restore?week= puts them back.
      //
      // Best effort with one exception: if the export FAILS we do not delete.
      // A week of un-purged rows is a tidiness problem. A week of deleted rows
      // with no copy is the thing this exists to prevent.
      const { data: doomed } = await supabase
        .from('content_ideas')
        .select('*')
        .not('expires_at', 'is', null)
        .lte('expires_at', nowIso)
        .is('shift_id', null)
        .is('library_at', null)
        .not('state', 'in', '("drafting","review","approved","published")')
      const exported = await exportBeforeDelete(week, doomed || [])
      if (!exported.ok) {
        return res.status(200).json({
          ok: false,
          week,
          error: 'purge_export_failed',
          reason: exported.reason,
          expired: 0,
          note: 'nothing was deleted: the engine will not hard-delete rows it could not copy first',
        })
      }
      archived_to = exported.key

      // The queryable half of the copy. Same refusal as the export above: a
      // row that could not be recorded is not deleted.
      const archive = await recordObservations((doomed || []).map(toObservation))
      if (!archive.ok) {
        return res.status(200).json({
          ok: false,
          week,
          error: 'purge_observation_failed',
          reason: archive.reason,
          expired: 0,
          archived_to,
          note: 'nothing was deleted: the engine will not hard-delete rows it could not record first',
        })
      }
      observations_recorded = archive.written

      const { error: delErr, count } = await supabase
        .from('content_ideas')
        .delete({ count: 'exact' })
        .not('expires_at', 'is', null)
        .lte('expires_at', nowIso)
        .is('shift_id', null)
        .is('library_at', null)
        .not('state', 'in', '("drafting","review","approved","published")')
      if (delErr) throw new Error(delErr.message)
      expired = count ?? 0
    }

    // Archive every brief whose week has passed, not just the ones that shipped.
    //
    // This used to filter .in('status', ['pushed','sent']), which reads as
    // "archive what we sent" but behaves as "archive nothing": across the
    // eight runs to 2026-08-24 the audit rows all say briefs_archived: [], and
    // no brief in the table has ever had a pushed_at or sent_at. So a brief
    // that was assembled and then not pushed - which is all seven of them -
    // stayed 'ready'/'in_review'/'approved' forever, and useContentV2's hero
    // read (which accepts exactly those statuses) kept serving it.
    //
    // A weekly brief is news-shaped: R10 says nothing news-shaped survives its
    // week. Past its week it is archived whatever state it reached. 'approved'
    // is included deliberately - 2026-W30 has sat approved-but-never-pushed
    // since 24 July, and exempting it is what made it immortal. Archiving is
    // not deletion: the row, its body and its versions all stay readable.
    //
    // The boundary is the start of the deck's read window, not the current
    // week. Archiving at `< week` would bury Friday's brief on Monday and
    // leave the tab with no brief at all until the next Friday; this way the
    // brief stays readable until its successor arrives.
    const windowStart = queueWindowStart()
    const { data: archived } = await supabase
      .from('weekly_briefs')
      .update({ status: 'archived', purge_ran_at: nowIso })
      .lt('week', windowStart)
      .in('status', ['ready', 'in_review', 'approved', 'pushed', 'sent'])
      .select('week')

    // Sweep EVERY stale pending decision, not just purge_preview.
    //
    // The old sweep was .eq('kind','purge_preview'), so brief_review,
    // shift_proposal, shift_fading, graduation and investigation cards had no
    // ageing path at all - the only thing that ever cleared one was Krish
    // tapping it. On 2026-08-25 that was 74 pending rows going back to 10 July,
    // against a spec that calls for 5-10 a week.
    //
    // The rule is "sweep only what has already scrolled out of view": the
    // boundary is the start of the deck's read window, so a card is assembled
    // Friday, stays reviewable for the rest of that week and all of the next,
    // and is swept on the Monday after it stops being visible. Nothing is ever
    // cleared out from under Krish while it is still on screen.
    //
    // 'archived', not 'dismissed': nothing was judged here, so nothing should
    // teach, and nothing should later read as a rejection. 'dismissed' means
    // Krish ruled on it; this means the week passed and he never saw it. The
    // rows keep their full payload and their ref, so the archive stays useful
    // for comparing what the engine produced against what he chose.
    //
    // purge_preview keeps the tighter `< week` boundary below: a card that says
    // "expiring Monday" is misinformation the moment that Monday has passed.
    const { data: sweptRows } = await supabase.from('content_decisions')
      .update({
        status: 'archived',
        resolved_at: nowIso,
        resolution: { action: 'expired_unreviewed', at: nowIso, swept_by: 'purge/run' },
      })
      .eq('status', 'pending')
      .neq('kind', 'purge_preview')
      .lt('week', windowStart)
      .select('kind')

    const { data: sweptPreviews } = await supabase.from('content_decisions')
      .update({ status: 'done', resolved_at: nowIso, resolution: { action: 'purge_ran', at: nowIso } })
      .eq('status', 'pending')
      .eq('kind', 'purge_preview')
      .lt('week', week)
      .select('kind')

    const swept = [...(sweptRows || []), ...(sweptPreviews || [])].reduce<Record<string, number>>((acc, r: any) => {
      acc[r.kind] = (acc[r.kind] || 0) + 1
      return acc
    }, {})

    await supabase.from('audit_log').insert({
      event_type: 'content_purge',
      actor: 'content-engine-v2',
      details: {
        week, expired, archived_to, observations_recorded,
        briefs_archived: (archived || []).map(a => a.week),
        decisions_swept: (sweptRows || []).length + (sweptPreviews || []).length,
        swept_by_kind: swept,
      },
    })

    return res.json({
      ok: true, week, expired, archived_to, observations_recorded,
      briefs_archived: (archived || []).length,
      decisions_swept: (sweptRows || []).length + (sweptPreviews || []).length,
      swept_by_kind: swept,
    })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}

// Every run lands in content_engine_runs so the Content tab can say when this
// job last succeeded. See api/_runs.ts.
export default withContentRun('purge', handler)
