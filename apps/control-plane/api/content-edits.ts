import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from './_auth.js'
import { supabase } from './_supabase.js'
import { DECISION_ACTIONS, operatorAttribution, validateEditEvent } from './_editEvents.js'

// Append one edit event.
//
//   POST /api/content-edits
//
// What Krish actually did to a piece: which edit he ran, whether he kept it,
// which brief sections he dropped, what he typed over the top, what he approved
// and what he binned.
//
// Before this the answer was scattered and mostly unread. meta.revisions[]
// recorded which button was pressed but never whether the result survived, and
// nothing consumed it. The composer's autosave overwrote the body in place with
// no prior value. briefDiff computed a per-section keep/drop in the browser and
// discarded it, which was the richest taste signal in the product.
//
// The admission rules are in _editEvents.ts so they can be checked without a
// database. This file is the write.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['POST'])) return

  const parsed = validateEditEvent(req.body)
  if (parsed.ok !== true) return res.status(400).json({ ok: false, error: parsed.error })

  // An operator session writes as itself (see operatorAttribution). It may
  // relay one of Krish's decisions, but it cannot make one: a decision row
  // settles a judge in judge_calibration, which reads no actor.
  const operator = operatorAttribution(req.headers.authorization, req.body)
  const row = { ...parsed.value }
  if (operator) {
    if (DECISION_ACTIONS.has(row.action) && operator.observation) {
      return res.status(403).json({ ok: false, error: 'a_decision_needs_krish', detail: "Relay Krish's own decision with decided_by: 'Krish'." })
    }
    row.surface = operator.surface
    row.client = operator.client
    row.actor = operator.actor
    if (operator.observation) row.confirmation_state = 'observation_only'
  }

  const { error } = await supabase.from('content_edit_events').insert(row)
  if (error) {
    // A replay is not a failure. The unique idempotency key is what makes the
    // composer's accept safe to double-fire on a phone.
    if (error.code === '23505') return res.status(200).json({ ok: true, duplicate: true })
    return res.status(500).json({ ok: false, error: 'write_failed' })
  }
  return res.status(200).json({ ok: true, duplicate: false })
}
