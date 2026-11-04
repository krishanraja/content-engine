import type { SupabaseClient } from '@supabase/supabase-js'

// Krish's ruling on one learning proposal: the one write of mindmake_studio_learning_proposals' decision, shared by
// POST /api/video-studio/learning-proposals (the Studio's door) and the standards page (/standards, api/board op
// standards), which decides the rejection floor's groups on the board's own login. One write, two doors.
//
// corrected: right idea, his wording. It needs his words, which replace the engine's on every reader
// (taste_profile_current and taste_floor read decision_note first).
export const LEARNING_DECISIONS = new Set(['approved', 'rejected', 'corrected'])
export const MAX_DECISION_NOTE = 600
const UUID = /^[0-9a-f-]{36}$/

export type LearningDecision = { id: string; decision: 'approved' | 'rejected' | 'corrected'; note: string }
export type DecisionRefusal = { status: number; code: string }

/** His press as the routes receive it ({ id, decision, krish? }), or the reason it is refused. */
export function parseLearningDecision(raw: unknown): LearningDecision | DecisionRefusal {
  const body = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const id = typeof body.id === 'string' ? body.id : ''
  const decision = typeof body.decision === 'string' ? body.decision : ''
  if (!UUID.test(id)) return { status: 400, code: 'invalid_id' }
  if (!LEARNING_DECISIONS.has(decision)) return { status: 400, code: 'invalid_decision' }
  const note = typeof body.krish === 'string' ? body.krish.trim() : ''
  if (decision === 'corrected' && (!note || note.length > MAX_DECISION_NOTE)) return { status: 400, code: 'corrected_needs_his_words' }
  return { id, decision: decision as LearningDecision['decision'], note }
}

/** Only an open proposal can be decided, and only once: the filter on status makes a replayed tap a no-op instead of a
 *  second decision. */
export async function decideLearningProposal(db: SupabaseClient, d: LearningDecision, now = new Date().toISOString()):
  Promise<{ ok: true; proposal: { id: string; status: string } } | DecisionRefusal> {
  const { data, error } = await db
    .from('mindmake_studio_learning_proposals')
    .update({
      status: d.decision,
      decided_at: now,
      decided_by: 'Krish',
      ...(d.decision === 'corrected' ? { decision_note: d.note } : {}),
    })
    .eq('id', d.id)
    .eq('status', 'proposed')
    .select('id, status')
  if (error) return { status: 503, code: 'learning_store_unavailable' }
  if (!data?.length) return { status: 409, code: 'already_decided' }
  return { ok: true, proposal: data[0] as { id: string; status: string } }
}
