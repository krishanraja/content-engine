import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_supabase.js'
import { CATALOGUE_FROM, catalogue, type CataloguePiece } from '../_publicationCatalogue.js'

// GET /api/publish/catalogue: the public publication catalogue (_publicationCatalogue.ts).
//
// Public and read-only on purpose: it returns only what is already public (published pieces and the live addresses
// they went out at), so makeyourmindup.ai can read it with no key. Every value comes from the piece's making record,
// which the existing receipts keep current (the hourly publish watcher for Substack; Growth's posted route and
// making.py for YouTube and Shorts), so a video that goes out days after its article appears on the next read.
//
// A failed read is a 503 with ok: false, never an empty list: the reader must keep what it had (Krish, 2026-11-11:
// "A failed feed must not silently become a successful empty catalogue").

const COLUMNS = 'id, idea, lane_slot, published_at, published_url, meta, transformed_outputs'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, error: 'method_not_allowed' })
  }
  const { data, error } = await supabase.from('content_ideas').select(COLUMNS)
    .eq('state', 'published').is('buried_at', null).gte('published_at', CATALOGUE_FROM)
    .order('published_at', { ascending: false }).limit(1000)
  if (error || !data) {
    res.setHeader('Cache-Control', 'no-store')
    return res.status(503).json({ ok: false, error: 'catalogue_unavailable' })
  }
  const out = catalogue(data as CataloguePiece[])
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=3600')
  res.setHeader('Access-Control-Allow-Origin', '*')
  return res.status(200).json({ ok: true, generated_at: new Date().toISOString(), ...out })
}
