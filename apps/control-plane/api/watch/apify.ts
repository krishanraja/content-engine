import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { runActor } from '../_apify.js'
import { MAX_ITEMS, WATCH_ACTORS, checkPaidRun, parsePaidRun } from './_paid.js'
import { watchStore } from './_watchStore.js'

// POST /api/watch/apify { id, machine, actor, input }, on the engine key.
//
// The cloud backup's paid step: the engine runs one of content-watcher's Apify actors with its own key and answers
// { ok, items } (at most 5 dataset items), so the key never reaches GitHub. _paid.ts holds who may ask and for what.
// Apify enforces each actor's charge cap; every run is metered through _apify.ts. Logs nothing about the link.

export const config = { maxDuration: 300 }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['POST'])) return
  const parsed = parsePaidRun(req.body)
  if ('error' in parsed) return res.status(400).json({ ok: false, error: parsed.error })
  try {
    const check = await checkPaidRun(watchStore, parsed.value)
    if ('error' in check) return res.status(check.status).json({ ok: false, error: check.error })
  } catch {
    return res.status(503).json({ ok: false, error: 'watch_store_unavailable' })
  }
  const { actor, input } = parsed.value
  const limits = WATCH_ACTORS[actor]
  const run = await runActor({
    taskCategory: `content_watch:${actor}`,
    fallbackSlugs: [actor],
    buildInput: () => input,
    timeoutSec: limits.timeoutSec,
    maxTotalChargeUsd: limits.maxUsd,
    maxAttempts: 1,
    source: 'content-watch-cloud',
  })
  const status = run.outcome.status
  if (status === 'ok' || status === 'empty') return res.status(200).json({ ok: true, items: run.items.slice(0, MAX_ITEMS) })
  const error = status === 'exhausted' ? 'apify_out_of_credit'
    : status === 'auth_failed' || status === 'skipped_no_key' ? 'apify_refused'
      : status === 'rate_limited' ? 'apify_rate_limited' : 'apify_failed'
  return res.status(502).json({ ok: false, error })
}
