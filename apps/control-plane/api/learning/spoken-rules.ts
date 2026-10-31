import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { supabase } from '../_supabase.js'

// GET /api/learning/spoken-rules: the read-aloud rules Krish kept or reworded, live for drafting a spoken script
// (scripts/voice/spoken_rules.py, make-piece's Scripts step). Krish, 2026-10-31: "you know that I want the ability
// to make this better iteratively". The Sunday compiler proposes (learning/compile.ts, scope key spoken:*); he keeps,
// rewords or turns each down on his list; his wording, when he gave one, wins over the engine's. On the engine key,
// read only.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET'])) return
  const { data, error } = await supabase
    .from('mindmake_studio_learning_proposals')
    .select('id, assertion, decision_note, scope, status, decided_at')
    .in('status', ['approved', 'corrected'])
    .like('scope->>key', 'spoken:%')
    .order('decided_at', { ascending: false })
    .limit(40)
  if (error) return res.status(503).json({ ok: false, error: 'learning_store_unavailable' })
  const rules = (data || []).map(r => ({
    id: r.id,
    rule: (r.decision_note as string | null) || r.assertion,
    reworded: Boolean(r.decision_note),
    decided_at: r.decided_at,
    key: (r.scope as { key?: string } | null)?.key ?? null,
  }))
  return res.status(200).json({ ok: true, rules })
}
