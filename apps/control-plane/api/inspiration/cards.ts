import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_supabase.js'
import { guardEngine } from '../_auth.js'
import { MAX_IDS, cardView, parseIds, readCards, readUses } from './_cards.js'

// GET /api/inspiration/cards?ids=<uuid>,<uuid>
//        each named Inspiration card as ve reads it: its label (the file stem a spec calls `card`), its Drive file id,
//        lane, kind, his answers, what it teaches and every cut it shaped (card_uses). `problem` is why a card cannot
//        hold a cut (dismissed, not_production_lane, not_a_clip) and null when it can; `unknown` lists ids that are no
//        card. `ve refs` refuses a spec whose card is unknown or has a problem (scripts/velib/board.py).
//
// Read only: nothing here writes, spends or picks.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET'])) return
  res.setHeader('Cache-Control', 'no-store')
  const { ids, bad } = parseIds(req.query?.ids)
  if (bad.length) return res.status(400).json({ ok: false, error: 'bad_ids', problems: bad.map(b => `${b} is not an Inspiration card id (a uuid)`) })
  if (!ids.length) return res.status(400).json({ ok: false, error: 'ids_required', problems: ['ids is a comma-separated list of inspiration_items ids'] })
  if (ids.length > MAX_IDS) return res.status(400).json({ ok: false, error: 'too_many_ids', problems: [`at most ${MAX_IDS} ids`] })

  const cards = await readCards(supabase, q => q.in('id', ids))
  if (cards.error) return res.status(500).json({ ok: false, error: cards.error })
  const uses = await readUses(supabase, ids)
  if (uses.error) return res.status(500).json({ ok: false, error: uses.error })
  const found = new Map(cards.rows.map(r => [String(r.id).toLowerCase(), r]))
  return res.status(200).json({
    ok: true,
    cards: ids.filter(id => found.has(id)).map(id => cardView(found.get(id)!, uses.uses.get(id) || [])),
    unknown: ids.filter(id => !found.has(id)),
    ...(cards.pending || uses.pending ? { migration_pending: true } : {}),
  })
}
