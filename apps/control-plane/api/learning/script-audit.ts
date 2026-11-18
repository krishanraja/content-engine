import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { auditLedger, auditRows } from './_scriptAudit.js'

// GET /api/learning/script-audit: the rolling ledger of the three-way script audit (scripts/voice/script_audit.py
// ledger). Krish, 2026-11-18: "comparing a script that you put into the dashboard versus the script that went into
// Teleprompter after my edits versus the actual words I said in the video". Across every audited cut: his edit rate
// (draft to approved), his ad-lib rate (approved to said), the whole gap, the words he swaps out with what he put
// instead, the swaps seen in two pieces or more (habits) and every text that could not be found, with why. Evidence
// for his list and the Scripts step, never a rule: a rule is only what he kept (GET /api/learning/spoken-rules). On
// the engine key, read only.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET'])) return
  const { data, error } = await supabase
    .from('content_ideas')
    .select('id, meta->making->script_audit')
    .not('meta->making->script_audit', 'is', null)
    .limit(500)
  if (error) return res.status(503).json({ ok: false, error: 'audit_store_unavailable' })
  return res.status(200).json({ ok: true, ledger: auditLedger(auditRows((data || []) as { id: string; script_audit: unknown }[])) })
}
