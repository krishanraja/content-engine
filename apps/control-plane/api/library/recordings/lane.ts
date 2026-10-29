import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../../_auth.js'
import { guardVideoStudioRunner } from '../../_videoStudioAuth.js'
import { VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, sendVideoStudioError } from '../../video-studio/_contracts.js'
import { enforceVideoStudioRateLimit } from '../../video-studio/_data.js'
import { configuredLibraryStore } from '../_library.js'
import { overnightReadiness, parseLaneReport, readLaneReports, writeLaneReport } from '../_lanes.js'
import { RECORDINGS_SENDER } from '../_recordings.js'

// POST /api/library/recordings/lane, on the runner bearer.
//
//   { machine, problems: [code, ...], watch?, windows?, preflight?, overnight? }
//
// What a home computer's recordings upload found on this pass; an empty list
// says it is healthy. preflight is the last Saturday overnight preflight that
// machine ran (scripts/overnight/preflight.ps1), sent again with every pass.
// The Inbox job reads these and fails, naming the machine, while a fresh
// report holds a problem (api/library/_lanes.ts says why). overnight is that
// machine's overnight run (scripts/overnight/overnight.py): codes and times only.
//
// GET /api/library/recordings/lane, on the engine key: every machine's last
// report, with its content watcher's health, so a session reads what a home
// computer found without asking Krish to open a log (Krish, 2026-10-28: "i
// should never really need to copy and paste log files to you like this").

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    if (guardEngine(req, res, ['GET'])) return
    const store = await configuredLibraryStore()
    if (!store.config) return res.status(503).json({ ok: false, error: store.error || 'library_store_unavailable' })
    const { reports, error } = await readLaneReports(store.config.bucket)
    if (error) return res.status(503).json({ ok: false, error: 'library_store_unavailable' })
    // overnight: whether a primary and a standby computer both passed their last preflight (plan Wave 2, W2.6).
    return res.status(200).json({ ok: true, reports, overnight: overnightReadiness(reports, Date.now()) })
  }
  if (guardVideoStudioRunner(req, res, ['POST'])) return
  const report = parseLaneReport(req.body, new Date().toISOString())
  if (!report) return sendVideoStudioError(res, 400, 'invalid_lane_report')
  if (await enforceVideoStudioRateLimit(res, 'library:recordings', RECORDINGS_SENDER, 120, 60)) return
  const store = await configuredLibraryStore()
  if (!store.config) return sendVideoStudioError(res, 503, store.error || 'library_store_unavailable')
  if (!(await writeLaneReport(store.config.bucket, report))) return sendVideoStudioError(res, 503, 'library_store_unavailable')
  return res.status(200).json({ ok: true, schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, problems: report.problems.length })
}
