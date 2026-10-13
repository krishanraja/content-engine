import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { loadStandingNotes } from '../_briefNotes.js'

// GET /api/briefs/notes: Krish's standing brief preferences, read only.
//
//   GET            -> { ok, notes }
//   POST, DELETE   -> 410 notes_moved: a note is said through Control Center's
//                     one door (Remember this) and removed there with Purge.
//
// The assembler and the revise engine fold these notes into every prompt.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST', 'DELETE'])) return
  try {
    if (req.method === 'GET') {
      return res.json({ ok: true, notes: await loadStandingNotes() })
    }
    if (req.method === 'POST' || req.method === 'DELETE') {
      return res.status(410).json({ ok: false, error: 'notes_moved', detail: 'Say it in Control Center: Remember this files a note, and Purge removes it.' })
    }
    return res.status(405).json({ ok: false, error: 'GET only' })
  } catch (e: unknown) {
    return res.status(500).json({ ok: false, error: String((e as Error)?.message || e) })
  }
}
