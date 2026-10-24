import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { parseReport, report } from './_watch.js'
import { watchStore } from './_watchStore.js'

// POST /api/watch/report { id, machine, status, status_class?, shape?, media?, reads? }, on the engine key.
//
// The machine holding a claim moves its request on:
//   filed  - the post's media is in the Drive folder; `media` lists each file (name, sha256, mime, bytes, folder).
//   read   - `reads` holds one content_reads row per file; each is upserted by sha256 (an older engine revision never
//            replaces a newer one) and the request's read_id points at the first file's reading.
//   failed - `status_class` says why, as a class. Below 3 attempts the request is queued again; at 3 it stays failed
//            until Krish pastes the link again.
// Only the machine named in claimed_by may report, and only while the request is claimed or filed.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['POST'])) return
  const parsed = parseReport(req.body)
  if ('error' in parsed) return res.status(400).json({ ok: false, error: parsed.error })
  try {
    const outcome = await report(watchStore, parsed.value)
    if ('code' in outcome) return res.status(outcome.code).json({ ok: false, error: outcome.error })
    return res.status(200).json(outcome)
  } catch {
    return res.status(503).json({ ok: false, error: 'watch_store_unavailable' })
  }
}
