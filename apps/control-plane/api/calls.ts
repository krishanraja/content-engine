import type { VercelRequest, VercelResponse } from '@vercel/node'

// GET /api/calls   retired: it answers, and it answers with no calls.
//
// Until 2026-11-18 this was the public scoreboard feed: every published
// piece's dated Call, our confidence, its due date, Krish's verdict and the
// market's odds, for makeyourmindup.ai to print and keep score. The format is
// abandoned. Ruling (Krish, 2026-11-17): "I don't do dated-and-scored
// make-your-mind-up pieces because it felt quite tacky and gimmicky. I don't
// really have the clout such that my opinion can hold up in official scores."
// Ruling (Krish, 2026-11-18): "get rid of that - i have abandoned the
// prediction format, it feels lame".
//
// The route stays, dormant, so a page that still asks for it gets an empty
// board and a plain reason instead of an error: no call, no confidence, no
// due date and no verdict is served, whatever an older piece's text says.
// The market pin and the daily odds cron that fed it are deleted
// (api/_signals.ts). Nothing here reads the database, spends or is a secret.

const ORIGINS = new Set([
  'https://makeyourmindup.ai',
  'https://www.makeyourmindup.ai',
  'https://home.makeyourmindup.ai',
  'https://controlcenter.krishraja.com',
])

/** Why the feed is empty, as it says so to whoever reads it. */
export const CALLS_RETIRED = 'Retired on 18 November 2026: makeyourmindup no longer makes dated predictions or keeps a public score of them.'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  const origin = String(req.headers.origin || '')
  if (ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  }
  if (req.method === 'OPTIONS') { res.status(204).end(); return }
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'GET only' })
  return res.status(200).json({ ok: true, retired: CALLS_RETIRED, read_at: new Date().toISOString(), calls: [] })
}
