import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readCatalogue } from '../../lib/readCatalogue.js'

// GET /api/publish/catalogue: the public publication catalogue (_publicationCatalogue.ts).
//
// Public and read-only on purpose: it returns only what is already public (published pieces and the live addresses
// they went out at), so makeyourmindup.ai can read it with no key. Every value comes from the piece's making record,
// which the existing receipts keep current (the hourly publish watcher for Substack; Growth's posted route and
// making.py for YouTube and Shorts), so a video that goes out days after its article appears on the next read.
//
// A failed read is a 503 with ok: false, never an empty list: the reader must keep what it had (Krish, 2026-11-11:
// "A failed feed must not silently become a successful empty catalogue").

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }
  const out = await readCatalogue().catch(() => null)
  if (!out) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(503).json({ ok: false, error: 'catalogue_unavailable' })
  }
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600')
  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(200).json({ ok: true, generated_at: new Date().toISOString(), ...out })
}
