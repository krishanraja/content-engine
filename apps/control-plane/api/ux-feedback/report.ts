import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { parseReport, report } from './_feedback.js'
import { feedbackStore, krishMailer } from './_feedbackStore.js'

// POST /api/ux-feedback/report { id, machine, status, status_class?, feedback_file_id?, summary? }, on the engine key.
//
//   done   - the stills and the feedback file are in the recording's Drive folder; `summary` holds the counts and the
//            UX signals heard. The engine sends Krish one email: a Claude Code prompt with the feedback file's and
//            the folder's links (a Gmail draft when gmail.send is not delegated; `emailed_via` says which).
//            Krish, 2026-10-28, asked for this email by name, so it is the one exception to the pull-only rule in
//            _alert.ts notifyOps: the OS does not contact him unprompted, and this is a reply to his own upload.
//   failed - `status_class` says why. Below 3 attempts the recording is queued again; at 3 it stays failed.
// Only the machine named in claimed_by may report, and only while the recording is claimed.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['POST'])) return
  const parsed = parseReport(req.body)
  if ('error' in parsed) return res.status(400).json({ ok: false, error: parsed.error })
  try {
    const outcome = await report(feedbackStore, krishMailer, parsed.value)
    if ('error' in outcome) return res.status(outcome.code).json({ ok: false, error: outcome.error })
    return res.status(200).json(outcome)
  } catch {
    return res.status(503).json({ ok: false, error: 'feedback_store_unavailable' })
  }
}
