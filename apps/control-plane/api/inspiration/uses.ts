import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_supabase.js'
import { guardEngine } from '../_auth.js'
import { parseUses, refusal } from './_cards.js'

// POST /api/inspiration/uses  { uses: [{ card_id, piece_id, spec_path, cut, role, critic_score }] }
//        records which cut each Inspiration card shaped and the Critic's score against it (card_uses), one row per
//        card, spec, cut and role. Written by `ve verdict` (scripts/velib/board.py). A verdict written again replaces
//        the score of its row and never adds a second use; `published` and his verdict are never written here
//        (published turns true when the piece's making record gets a posted channel, api/content-ideas/[id]/making.ts).
//        A card that is unknown, dismissed or outside the production lane is refused, and nothing is written.
//
// Nothing here sends, posts or spends: it records what the Critic scored.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['POST'])) return
  res.setHeader('Cache-Control', 'no-store')
  const { uses, problems } = parseUses(req.body)
  if (problems.length) return res.status(400).json({ ok: false, error: 'bad_uses', problems })

  const ids = [...new Set(uses.map(u => u.card_id))]
  const read = await supabase.from('inspiration_items').select('id,lane,kind,dismissed_at').in('id', ids)
  if (read.error) return res.status(500).json({ ok: false, error: read.error.message })
  const found = new Map(((read.data || []) as Array<Record<string, any>>).map(r => [String(r.id).toLowerCase(), r]))
  const refused = ids.flatMap(id => {
    const row = found.get(id)
    if (!row) return [`${id} is no Inspiration card`]
    const why = refusal(row)
    return why ? [`${id}: ${why}`] : []
  })
  if (refused.length) return res.status(409).json({ ok: false, error: 'card_refused', problems: refused })

  const now = new Date().toISOString()
  const rows = uses.map(u => ({ ...u, updated_at: now }))
  const written = await supabase.from('card_uses').upsert(rows, { onConflict: 'card_id,spec_path,cut,role' }).select('id,card_id,role,cut,critic_score')
  if (written.error) return res.status(500).json({ ok: false, error: written.error.message })
  return res.status(200).json({ ok: true, written: (written.data || []).length, uses: written.data || [] })
}
