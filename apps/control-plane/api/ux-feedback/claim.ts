import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { claimOne, parseMachine, waiting } from './_feedback.js'
import { feedbackStore } from './_feedbackStore.js'

// POST /api/ux-feedback/claim { machine }, on the engine key.
//
// A home computer running content-watcher claims the oldest feedback video Krish added in Control Center (queued, or
// claimed over an hour ago by a machine that went quiet; a failed try waits 10 minutes times its tries first). It
// gets where the recording sits in his Drive, so it reads the copy his Drive has synced to it, checked by size and
// MD5: { ok, recording: { id, name, note, mime, bytes, md5, drive_file_id, drive_path, venture, venture_label,
// attempts } | null, expired }. No download link and no Drive key reach the machine. A cloud machine is refused:
// it has no synced Drive. Logs nothing about the recording.
//
// GET /api/ux-feedback/claim, on the engine key: { ok, waiting }, how many could be claimed now, claiming none.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return
  try {
    if (req.method === 'GET') return res.status(200).json({ ok: true, waiting: await waiting(feedbackStore) })
    const parsed = parseMachine(req.body)
    if ('error' in parsed) return res.status(400).json({ ok: false, error: parsed.error })
    const outcome = await claimOne(feedbackStore, parsed.value.machine)
    if ('error' in outcome) return res.status(outcome.code).json({ ok: false, error: outcome.error })
    return res.status(200).json(outcome)
  } catch {
    return res.status(503).json({ ok: false, error: 'feedback_store_unavailable' })
  }
}
