import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardVideoStudioRunner } from '../../_videoStudioAuth.js'
import { VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, sendVideoStudioError } from '../../video-studio/_contracts.js'
import { enforceVideoStudioRateLimit } from '../../video-studio/_data.js'
import { configuredLibraryStore } from '../_library.js'
import { parseLaneReport, writeLaneReport } from '../_lanes.js'
import { RECORDINGS_SENDER } from '../_recordings.js'

// POST /api/library/recordings/lane, on the runner bearer.
//
//   { machine, problems: [code, ...] }
//
// What a home computer's recordings upload found on this pass; an empty list
// says it is healthy. The Inbox job reads these and fails, naming the machine,
// while a fresh report holds a problem (api/library/_lanes.ts says why).

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardVideoStudioRunner(req, res, ['POST'])) return
  const report = parseLaneReport(req.body, new Date().toISOString())
  if (!report) return sendVideoStudioError(res, 400, 'invalid_lane_report')
  if (await enforceVideoStudioRateLimit(res, 'library:recordings', RECORDINGS_SENDER, 120, 60)) return
  const store = await configuredLibraryStore()
  if (!store.config) return sendVideoStudioError(res, 503, store.error || 'library_store_unavailable')
  if (!(await writeLaneReport(store.config.bucket, report))) return sendVideoStudioError(res, 503, 'library_store_unavailable')
  return res.status(200).json({ ok: true, schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, problems: report.problems.length })
}
