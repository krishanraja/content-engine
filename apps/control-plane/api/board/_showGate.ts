import type { SupabaseClient } from '@supabase/supabase-js'
import showGate from '../../../../config/ve/show-gate.json' with { type: 'json' }

// The show gate on the board (Krish, 2026-11-19: "Krish was the quality check. Cuts reached him before anyone had watched
// them."). His Approve proof is refused (409 proof_not_shown) unless the piece carries a show receipt for that exact
// clip: a material with role `show_receipt` whose text is `ve show-check`'s receipt (scripts/velib/showgate.py), bound to
// the clip's sha256 and `ok`. A receipt is filed on the piece like any material (`board_session.py PIECE add FILE --role
// show_receipt`; ve proof says so). Config: config/ve/show-gate.json `board`; mode off turns it off, enforce_from_week
// leaves earlier weeks alone. A Reject is never refused: he may always turn a proof down.

type Body = Record<string, unknown>
const isObj = (v: unknown): v is Body => Boolean(v) && typeof v === 'object' && !Array.isArray(v)
const SHA = /^[a-f0-9]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const RECEIPT_SCHEMA = 've-show-receipt/1'
export const RECEIPT_ROLE = 'show_receipt'

export class ShowGateError extends Error { constructor(public status: number, message: string) { super(message) } }

/** Does this receipt text show this clip as ready: right schema, this sha256, nothing missing. Pure. */
export function receiptCovers(text: string, sha: string): boolean {
  let v: unknown
  try { v = JSON.parse(text) } catch { return false }
  return isObj(v) && v.schema === RECEIPT_SCHEMA && v.cut_sha256 === sha && v.ok === true && Array.isArray(v.missing) && v.missing.length === 0
}

/** Is the gate on for this press: an approve (never a reject) of a proof, in a week from enforce_from_week, with mode enforce. Pure. */
export function gateApplies(body: Body, week: string, cfg = showGate.board): boolean {
  if (cfg.mode !== 'enforce' || body.kind !== 'approve_proof' || body.verdict === 'reject') return false
  return week >= cfg.enforce_from_week
}

export async function checkProofShown(db: SupabaseClient, body: Body, week: string): Promise<void> {
  if (!gateApplies(body, week)) return
  const sha = String(body.sha256 || '')
  const pieceId = String(body.piece_id || '').toLowerCase()
  if (!SHA.test(sha) || !UUID.test(pieceId)) return
  const rows = await db.from('piece_materials').select('text_sha256').eq('piece_id', pieceId).eq('role', RECEIPT_ROLE).is('archived_at', null)
  if (rows.error) throw new ShowGateError(503, 'board_store_unavailable')
  const keys = (rows.data as Body[] ?? []).map(r => r.text_sha256).filter((x): x is string => typeof x === 'string' && SHA.test(x))
  if (keys.length) {
    const texts = await db.from('material_texts').select('content').in('sha256', keys)
    if (texts.error) throw new ShowGateError(503, 'board_store_unavailable')
    if ((texts.data as Body[] ?? []).some(t => typeof t.content === 'string' && receiptCovers(t.content, sha))) return
  }
  throw new ShowGateError(409, 'proof_not_shown')
}
