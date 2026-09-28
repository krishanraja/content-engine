import { randomBytes } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardVideoStudioRunner, videoStudioRunnerIdentity } from '../../_videoStudioAuth.js'
import { supabase } from '../../_supabase.js'
import { contentRevisionHash, jsonRecord, readProductionApproval } from '../../_productionBrief.js'
import { VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, sendVideoStudioError } from '../_contracts.js'
import { enforceVideoStudioRateLimit } from '../_data.js'
import {
  hashLeaseToken,
  productionBriefCanBeClaimed,
  readProductionBriefEnvelope,
} from '../_productionBriefQueue.js'
import { parseProductionBriefClaimRequest, runnerTakesFormat, runnerTakesSeries } from '../_runnerContracts.js'
import { mayStartNewWork, NOTHING_TO_CLAIM_BRIEF, runnerStanding } from '../_runnerRoles.js'

// A runner that may not start new work (a standby, an unassigned or retired
// hash) gets exactly the empty answer any runner gets when the queue is
// empty. The runner's contract parses this response strictly, so it carries
// nothing else: a runner at 6bf7862 reads it as "nothing to claim" and idles.
function nothingToClaim(res: VercelResponse) {
  return res.status(200).json({ ...NOTHING_TO_CLAIM_BRIEF })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardVideoStudioRunner(req, res, ['POST'])) return
  const body = parseProductionBriefClaimRequest(req.body)
  if (!body) return sendVideoStudioError(res, 400, 'invalid_claim_request')

  const runnerIdentity = videoStudioRunnerIdentity(body.runner_id)
  if (await enforceVideoStudioRateLimit(res, 'runner:production-brief-claim', runnerIdentity, 60, 60)) return

  // The runner-role fence, answered early so a standby does not walk the
  // queue. The database decides again, atomically, when a lease is written.
  const roles = await supabase.from('video_studio_runner_roles').select('runner_id_hash,role')
  if (roles.error) return sendVideoStudioError(res, 503, 'production_brief_store_unavailable')
  if (!mayStartNewWork(runnerStanding(roles.data || [], runnerIdentity))) return nothingToClaim(res)

  const read = await supabase.from('content_ideas')
    .select('id,idea,thesis,body,lane,lane_slot,meta,transformed_outputs,updated_at')
    .not('transformed_outputs->production_briefs', 'is', null)
    .order('updated_at', { ascending: true })
    .limit(100)
  if (read.error) return sendVideoStudioError(res, 503, 'production_brief_store_unavailable')

  const now = new Date()
  for (const rawRow of read.data || []) {
    const row = rawRow as { id: string; idea: string; thesis: string | null; body: string | null; lane: string | null; lane_slot: string | null; meta: unknown; transformed_outputs: unknown; updated_at: string }
    const outputs = jsonRecord(row.transformed_outputs)
    const briefs = jsonRecord(outputs.production_briefs)
    const approval = readProductionApproval(jsonRecord(row.meta).production_approval)
    const currentRevisionHash = contentRevisionHash(row)
    for (const [briefId, rawEnvelope] of Object.entries(briefs)) {
      const envelope = readProductionBriefEnvelope(rawEnvelope)
      if (!envelope || envelope.brief.brief_id !== briefId || envelope.brief.content_idea_id !== row.id) continue
      if (!approval || approval.content_revision_hash !== currentRevisionHash || envelope.brief.content_revision_hash !== currentRevisionHash) continue
      if (!productionBriefCanBeClaimed(envelope, now)) continue
      if (!runnerTakesSeries(body.series_supported, envelope.brief.series)) continue
      if (!runnerTakesFormat(body.editorial_formats_supported, envelope.brief.editorial_format)) continue

      const leaseToken = randomBytes(32).toString('base64url')
      const claimedAt = now.toISOString()
      const expiresAt = new Date(now.getTime() + body.lease_seconds * 1000).toISOString()
      const nextEnvelope = {
        ...jsonRecord(rawEnvelope),
        brief: envelope.brief,
        brief_hash: envelope.brief_hash,
        status: 'leased',
        lease: {
          runner_id_hash: runnerIdentity,
          token_hash: hashLeaseToken(leaseToken),
          software_commit: body.software_commit,
          claimed_at: claimedAt,
          expires_at: expiresAt,
        },
      }
      // One brief's envelope, written under the role fence and compared on
      // updated_at in the same transaction
      // (public.video_studio_lease_production_brief).
      const lease = await supabase.rpc('video_studio_lease_production_brief', {
        p_runner_id_hash: runnerIdentity,
        p_content_idea_id: row.id,
        p_expected_updated_at: row.updated_at,
        p_brief_id: briefId,
        p_envelope: nextEnvelope,
      })
      if (lease.error) return sendVideoStudioError(res, 503, 'production_brief_store_unavailable')
      if (lease.data === 'fenced') return nothingToClaim(res)
      if (lease.data !== 'leased') continue
      return res.status(200).json({
        ok: true,
        schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
        item: {
          content_idea_id: row.id,
          brief: envelope.brief,
          brief_hash: envelope.brief_hash,
          lease: { token: leaseToken, expires_at: expiresAt },
        },
      })
    }
  }

  return nothingToClaim(res)
}
