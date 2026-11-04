import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_supabase.js'
import {
  guardVideoStudioOperatorMutation,
  guardVideoStudioOperatorRead,
  videoStudioOperatorIdentity,
} from '../_videoStudioAuth.js'
import { VIDEO_STUDIO_CONTROL_SCHEMA_VERSION, sendVideoStudioError } from './_contracts.js'
import { enforceVideoStudioRateLimit } from './_data.js'
import { withVenture } from '../_taste.js'
import { decideLearningProposal, parseLearningDecision } from '../_learningDecision.js'

// GET  /api/video-studio/learning-proposals            the open proposals
// POST /api/video-studio/learning-proposals            { id, decision, krish? }
//
// What the Studio has learned and wants confirmed. The MCP gateway writes
// mindmake_studio_learning_proposals every week; until this route nothing read
// them back, so the learning loop recorded and never applied. A decision here
// is Krish's ruling on one assertion. Approval does not change any engine
// configuration on its own: the studio's activation boundary is a reviewed
// Git commit (docs/ENGINE_SESSION.md), and the proposal row is the receipt.
//
// Every venture's proposals are listed, each with its venture (scope.venture,
// none meaning Make Your Mind Up's) and that venture's plain name. The board is
// the only place Krish rewords a rule, so it shows them all, labelled, and
// filters none.

const PROPOSAL_FIELDS = 'id, weekly_batch_id, proposal_class, assertion, scope, independent_session_count, independent_job_count, counterexamples, regression_cases, proposed_change, status, created_at'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method === 'GET') {
    if (guardVideoStudioOperatorRead(req, res, ['GET'])) return
    if (await enforceVideoStudioRateLimit(res, 'operator:learning:list', videoStudioOperatorIdentity(req), 120, 60)) return
    const { data, error } = await supabase
      .from('mindmake_studio_learning_proposals')
      .select(PROPOSAL_FIELDS)
      .eq('status', 'proposed')
      // The rejection floor's groups are decided on their own page (/standards), so twenty of them never crowd the
      // board's lessons out of this list.
      .or('scope->>source.is.null,scope->>source.neq.rejections_group')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return sendVideoStudioError(res, 503, 'learning_store_unavailable')
    return res.status(200).json({
      ok: true,
      schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
      proposals: (data || []).map(withVenture),
      server_time: new Date().toISOString(),
    })
  }

  if (guardVideoStudioOperatorMutation(req, res, ['POST'])) return
  if (await enforceVideoStudioRateLimit(res, 'operator:learning:decide', videoStudioOperatorIdentity(req), 60, 60)) return
  // His ruling, through the one decision write (_learningDecision.ts) the standards page shares.
  const parsed = parseLearningDecision(req.body)
  if ('code' in parsed) return sendVideoStudioError(res, parsed.status, parsed.code)
  const decided = await decideLearningProposal(supabase, parsed)
  if ('code' in decided) return sendVideoStudioError(res, decided.status, decided.code)
  return res.status(200).json({
    ok: true,
    schema_version: VIDEO_STUDIO_CONTROL_SCHEMA_VERSION,
    proposal: decided.proposal,
    server_time: new Date().toISOString(),
  })
}
