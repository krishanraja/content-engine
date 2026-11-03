import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_supabase.js'
import { guardEngine } from '../_auth.js'
import { ROLES, type Role, rankCandidates, readCards, readUses } from './_cards.js'

// GET /api/inspiration/candidates?role=look&format=reel&limit=3
//        the production-lane cards to offer a piece for one role (look, motion, captions, hook, pacing, layout), best
//        first: a card that teaches the role (his word before the engine's guess), then his kept or liked signal
//        (study_style, then why he likes it), then a card in `format` (the clip's facets.format) when one is given,
//        then a card never used (card_uses), then the newest. Dismissed cards and cards that teach no cut (a feed, a
//        corpus, an idea) are never offered. `ve init` writes the top one per role into brand.references marked
//        `offered: true`, and ve lint refuses a spec until the session confirms each.
//
// The ranking is deterministic over the rows (no model, no embedding call): the readings in content_reads carry no
// stored embedding, and embedding every reading on each request would be a paid call per offer.
//
// Read only: nothing here writes, spends or picks.

const READ_LIMIT = 500

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET'])) return
  res.setHeader('Cache-Control', 'no-store')
  const role = String(req.query?.role || '') as Role
  if (!ROLES.includes(role)) return res.status(400).json({ ok: false, error: 'bad_role', problems: [`role is one of ${ROLES.join(', ')}`] })
  const limit = Number(req.query?.limit ?? 3)
  if (!Number.isInteger(limit) || limit < 1 || limit > 10) return res.status(400).json({ ok: false, error: 'bad_limit', problems: ['limit is 1 to 10'] })
  const format = typeof req.query?.format === 'string' ? req.query.format.slice(0, 40) : ''

  const cards = await readCards(supabase, q => q.eq('lane', 'production').is('dismissed_at', null).order('drive_created_at', { ascending: false }).limit(READ_LIMIT))
  if (cards.error) return res.status(500).json({ ok: false, error: cards.error })
  const uses = await readUses(supabase, cards.rows.map(r => String(r.id).toLowerCase()))
  if (uses.error) return res.status(500).json({ ok: false, error: uses.error })
  return res.status(200).json({
    ok: true, role, format: format || null,
    candidates: rankCandidates(cards.rows, uses.uses, { role, format, limit }),
    ...(cards.pending || uses.pending ? { migration_pending: true } : {}),
  })
}
