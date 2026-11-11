import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_supabase.js'
import { guardEngine } from '../../_auth.js'

// POST /api/content-ideas/:id/schedule   body: { date: 'YYYY-MM-DD' | null }
//
// Sets (or clears, when date is null) `scheduled_for` so a draft lands on the
// Content calendar. `scheduled_for` is a `date` column, so we store the plain
// YYYY-MM-DD the caller computed from the clicked cell's local components — no
// timezone coercion. Touches scheduled_for + updated_at only.
//
// The ideas gate (docs/PUBLISH_BOARDS.md, "The ideas gate"; Krish, 2026-11-11: "I shouldn't end up seeing random ideas
// in the publish board that I never wanted there and that I didn't approve to move to the publish board"): a date is
// set only when Krish's approval of this idea for that date stands (board_approval_holds). Without it the route answers
// 409 not_approved_by_krish and writes nothing; the database refuses the same write from any other route
// (content_ideas_board_gate). Clearing the date is never refused.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res)) return

  const id = req.query?.id
  const ideaId = Array.isArray(id) ? id[0] : id
  if (!ideaId) return res.status(400).json({ ok: false, error: 'id required' })

  const { date } = (req.body || {}) as { date?: string | null }
  let scheduled_for: string | null = null
  if (date != null) {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ ok: false, error: 'date must be YYYY-MM-DD or null' })
    }
    scheduled_for = date
    const holds = await supabase.rpc('board_approval_holds', { p_idea: String(ideaId).toLowerCase(), p_date: date, p_offday_doc: null })
    if (holds.error) return res.status(503).json({ ok: false, error: 'approvals_unavailable' })
    if (holds.data !== true) {
      return res.status(409).json({ ok: false, error: 'not_approved_by_krish',
        problem: `Only Krish's Approve on the ideas board puts an idea on the publish board; no approval of his holds this idea for ${date}. Propose it on the ideas board instead.` })
    }
  }

  const { data, error } = await supabase
    .from('content_ideas')
    .update({ scheduled_for, updated_at: new Date().toISOString() })
    .eq('id', ideaId)
    .select('id, scheduled_for')
    .single()

  if (error) {
    if (/not_approved_by_krish/.test(error.message)) return res.status(409).json({ ok: false, error: 'not_approved_by_krish', problem: error.message })
    return res.status(500).json({ ok: false, error: error.message })
  }
  if (!data) return res.status(404).json({ ok: false, error: 'idea not found' })
  return res.status(200).json({ ok: true, idea: data })
}
