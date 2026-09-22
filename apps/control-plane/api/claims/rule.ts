import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute } from '../_auth.js'
import { supabase } from '../_supabase.js'

// Record a ruling on a claim whose falsifier has matured.
//
// This is the human half of the scoreboard. api/claims/resolve.ts notices the
// date; this records what actually happened. It is a POST only: there is no
// cron, because there is deliberately no automated verdict. A system grading
// its own predictions produces a number nobody should trust and certainly
// should not publish.
//
// The write is append only at the database level. A ruling that later turns
// out to be wrong is corrected by recording a further ruling, and the first
// one stays: the scoreboard reads the latest per claim and keeps the rest. A
// record whose losing rows can be tidied afterwards proves nothing, which is
// the entire reason to keep one.
//
//   POST { claim_id, verdict, rationale?, evidence?, ruled_by? }
//
// verdict:
//   held          the claim survived its own falsifier
//   broke         the falsifier fired and the call was wrong
//   unclear       checked, genuinely indeterminate
//   not_checkable the falsifier turned out not to be checkable after all,
//                 which is a finding about our claim writing, not the world

const VERDICTS = new Set(['held', 'broke', 'unclear', 'not_checkable'])

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')
  if (guardCronRoute(req, res)) return
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'POST only: a ruling is made by a person' })
  }

  try {
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) ?? {}
    const claimId = typeof body.claim_id === 'string' ? body.claim_id.trim() : ''
    const verdict = typeof body.verdict === 'string' ? body.verdict.trim() : ''
    const ruledBy = typeof body.ruled_by === 'string' && body.ruled_by.trim() ? body.ruled_by.trim() : 'krish'

    if (!claimId) return res.status(400).json({ ok: false, error: 'claim_id is required' })
    if (!VERDICTS.has(verdict)) {
      return res.status(400).json({ ok: false, error: `verdict must be one of ${[...VERDICTS].join(', ')}` })
    }

    // A broken call with no reason recorded is the one that will be argued
    // about later, so it is the one that must carry its reasoning. held is
    // allowed to be terse; broke and not_checkable are not.
    const rationale = typeof body.rationale === 'string' ? body.rationale.trim() : ''
    if ((verdict === 'broke' || verdict === 'not_checkable') && rationale.length < 10) {
      return res.status(400).json({
        ok: false,
        error: `a ${verdict} ruling needs a rationale: it is the one that gets argued about later`,
      })
    }

    const { data: claim, error: claimErr } = await supabase
      .from('investigation_claims')
      .select('id, ref, falsifier_due_on')
      .eq('id', claimId)
      .maybeSingle()
    if (claimErr) throw new Error(claimErr.message)
    if (!claim) return res.status(404).json({ ok: false, error: 'no such claim' })

    const evidence = Array.isArray(body.evidence) ? body.evidence : []

    const { data: written, error } = await supabase
      .from('claim_resolutions')
      .insert({
        claim_id: claimId,
        event: 'ruled',
        verdict,
        rationale: rationale || null,
        evidence,
        ruled_by: ruledBy,
        due_on: claim.falsifier_due_on,
      })
      .select('id, created_at')
      .single()
    if (error) throw new Error(error.message)

    const { data: board } = await supabase.from('claim_scoreboard').select('*').maybeSingle()

    return res.json({ ok: true, ruling: written, ref: claim.ref, scoreboard: board ?? null })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}
