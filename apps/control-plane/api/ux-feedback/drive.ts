import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { parseDrive, planDrive } from './_feedback.js'
import { DriveRefused, feedbackStore, googleFeedbackDrive } from './_feedbackStore.js'

// POST /api/ux-feedback/drive { id, machine, files: [{ name, mime, bytes }] }, on the engine key.
//
// The machine holding a recording's claim asks for Drive upload sessions for its stills (image/jpeg) and its feedback
// file (text/markdown). The first ask makes the recording's own folder, "<day> <name>", inside "UX Feedback" (or
// UX_FEEDBACK_DRIVE_FOLDER_ID); later asks reuse it. Answers { ok, folder_id, folder_url, uploads: [{ name,
// upload_url }] }; the machine PUTs each file's bytes to its upload_url with no key, and Google answers the file's id.
// Add only: nothing here deletes, moves or overwrites.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['POST'])) return
  const parsed = parseDrive(req.body)
  if ('error' in parsed) return res.status(400).json({ ok: false, error: parsed.error })
  const drive = await googleFeedbackDrive()
  if (!drive) return res.status(503).json({ ok: false, error: 'drive_not_configured' })
  try {
    const outcome = await planDrive(feedbackStore, drive, parsed.value)
    if ('error' in outcome) return res.status(outcome.code).json({ ok: false, error: outcome.error })
    return res.status(200).json(outcome)
  } catch (e) {
    if (e instanceof DriveRefused) return res.status(502).json({ ok: false, error: e.message })
    return res.status(503).json({ ok: false, error: 'feedback_store_unavailable' })
  }
}
