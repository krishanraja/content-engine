import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { claim, parseClaim, waiting } from './_watch.js'
import { watchStore } from './_watchStore.js'

// POST /api/watch/claim { machine, limit? }, on the engine key.
//
// A home computer running content-watcher claims up to `limit` (1..10, default 3) pasted links: queued ones, and
// ones claimed more than 30 minutes ago by a machine that went quiet. Each claim raises `attempts`; a stale claim on
// its third attempt fails as `timeout` instead. Answers { ok, requests: [{ id, url, url_key, platform, lane, note,
// attempts }] }. Logs nothing about the links.
//
// GET /api/watch/claim?machine=NAME, on the engine key: { ok, waiting }, how many this machine could claim now,
// claiming none. The cloud backup looks first and sets itself up only when a link has waited out the home computers.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return
  if (req.method === 'GET') {
    const machine = typeof req.query.machine === 'string' ? req.query.machine : ''
    const peek = parseClaim({ machine })
    if ('error' in peek) return res.status(400).json({ ok: false, error: peek.error })
    try {
      return res.status(200).json({ ok: true, waiting: await waiting(watchStore, peek.value.machine) })
    } catch {
      return res.status(503).json({ ok: false, error: 'watch_store_unavailable' })
    }
  }
  const parsed = parseClaim(req.body)
  if ('error' in parsed) return res.status(400).json({ ok: false, error: parsed.error })
  try {
    const result = await claim(watchStore, parsed.value.machine, parsed.value.limit)
    return res.status(200).json({ ok: true, ...result })
  } catch {
    return res.status(503).json({ ok: false, error: 'watch_store_unavailable' })
  }
}
