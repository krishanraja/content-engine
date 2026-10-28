import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { parseDrive, planDrive } from './_feedback.js'
import { DriveRefused, feedbackStore, googleFeedbackDrive } from './_feedbackStore.js'

// POST /api/ux-feedback/drive { id, machine, files: [{ name, mime, bytes, place? }] }, on the engine key.
//
// The machine holding a recording's claim asks for Drive upload sessions for its stills (image/jpeg, into Stills) and
// its feedback file (text/markdown, into the recording's folder). The first ask finds or makes the recording's
// folders in Ventures > Bugs & Issues > <venture> > <day> <name>: Bugs & Issues by its id in the Drive map
// (system_config drive_destinations `bugs_and_issues`, krishanraja/hunter), his venture folder by its slug or label
// (made with the label when he has none), then the day's folder and Stills, each made once and kept on the row.
// Answers { ok, folder_id, folder_url, stills_folder_id, uploads: [{ name, upload_url }] }; the machine PUTs each
// file to its upload_url with no key, and Google answers the file's id. Add only: nothing is deleted, moved or
// overwritten, and nothing is made at the top of his Drive (503 no_drive_destination instead).

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['POST'])) return
  const parsed = parseDrive(req.body)
  if ('error' in parsed) return res.status(400).json({ ok: false, error: parsed.error })
  let why = ''
  const drive = await googleFeedbackDrive(reason => { why = reason })
  if (!drive) return res.status(503).json({ ok: false, error: 'drive_not_writable', reason: why.slice(0, 160) })
  try {
    const outcome = await planDrive(feedbackStore, drive, parsed.value)
    if ('error' in outcome) return res.status(outcome.code).json({ ok: false, error: outcome.error })
    return res.status(200).json(outcome)
  } catch (e) {
    if (e instanceof DriveRefused) return res.status(502).json({ ok: false, error: e.message })
    return res.status(503).json({ ok: false, error: 'feedback_store_unavailable' })
  }
}
