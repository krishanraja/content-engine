import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { heldReads, parseCheck, parseReadOnly, writeReads } from './_watch.js'
import { watchStore } from './_watchStore.js'

// POST /api/watch/read { machine, reads: [row, ...] }, on the engine key.
//
// Readings of files Krish dropped into his inspiration folders by hand, which have no request. Each row is upserted
// into content_reads by sha256, the same as a reported read: one reading per piece of media, whatever brought it in.
// A separate route rather than part of report because a drop has no request id (content-watcher docs/DECISIONS.md).
//
// POST /api/watch/read { machine, check: [sha256, ...], engine_rev } writes nothing and answers { held: { sha: rev } }:
// the media a machine need not read, because a reading of the same or a newer revision, or one made from a link, is
// already here (heldReads). content-watcher asks it before reading a dropped file.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['POST'])) return
  if (req.body && typeof req.body === 'object' && 'check' in req.body) {
    const check = parseCheck(req.body)
    if ('error' in check) return res.status(400).json({ ok: false, error: check.error })
    try {
      return res.status(200).json({ ok: true, held: await heldReads(watchStore, check.value.shas, check.value.engine_rev) })
    } catch {
      return res.status(503).json({ ok: false, error: 'watch_store_unavailable' })
    }
  }
  const parsed = parseReadOnly(req.body)
  if ('error' in parsed) return res.status(400).json({ ok: false, error: parsed.error })
  try {
    const result = await writeReads(watchStore, parsed.value.reads)
    return res.status(200).json({ ok: true, written: result.written, kept_newer: result.kept_newer })
  } catch {
    return res.status(503).json({ ok: false, error: 'watch_store_unavailable' })
  }
}
