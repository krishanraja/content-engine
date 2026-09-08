import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guard } from './_auth.js'
import { supabase } from './_supabase.js'
import { validateEditEvent } from './_editEvents.js'

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
  if (guard(req, res, ['POST'])) return

  const parsed = validateEditEvent(req.body)
  if (parsed.ok !== true) return res.status(400).json({ ok: false, error: parsed.error })

  const { error } = await supabase.from('content_edit_events').insert(parsed.value)
  if (error) {
    // A replay is not a failure. The unique idempotency key is what makes the
    // composer's accept safe to double-fire on a phone.
    if (error.code === '23505') return res.status(200).json({ ok: true, duplicate: true })
    return res.status(500).json({ ok: false, error: 'write_failed' })
  }
  return res.status(200).json({ ok: true, duplicate: false })
}
