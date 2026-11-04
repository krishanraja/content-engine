import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_supabase.js'
import { guardEngine } from '../_auth.js'
import { fileIncidents, parseIncidents } from '../_incidents.js'
import { toProposalRow, type Proposal } from './_patterns.js'

// The failure loop (Krish, 2026-11-04: "all of this stuff should feed an intelligent system that automatically gets
// more intelligent every week, not just pile up loads of individual feedback for me to sift through").
//
// GET  /api/learning/incidents?since=ISO[&limit=N][&rounds=1]
//        the incidents since then, newest first (at most 1000): what the weekly loop (scripts/learning/) clusters.
//        With rounds=1, also each piece changed since then that records `rounds` on its making record.
// POST /api/learning/incidents  { incidents: [{ stage, kind, maker?, piece_id?, piece_path?, session_ref?, skill?,
//        artifact_ref?, artifact_sha256?, his_words?, preflight?, brief_score?, floor_groups?, failure_ids?, meta?,
//        client_ref?, at? }] }
//        files each once (client_ref): the Python writers' door (scripts/incidents.py: the Critic's block, a lint
//        override, a guard test that fails).
// POST /api/learning/incidents  { proposals: [Proposal], batch: 'learning-YYYY-MM-DD' }
//        the weekly loop's at most three proposals (engine_quality or taste), each citing the incident ids it rests
//        on, into mindmake_studio_learning_proposals for Krish's list. A key already proposed is never proposed again.
//
// The engine key only (guardEngine). Nothing here decides, sends, posts or spends: it records and proposes.

export const MAX_PROPOSALS = 3

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return
  const now = new Date().toISOString()

  if (req.method === 'GET') {
    const since = typeof req.query?.since === 'string' && !Number.isNaN(Date.parse(req.query.since)) ? req.query.since : new Date(Date.now() - 7 * 86_400_000).toISOString()
    const limit = Math.min(1000, Math.max(1, Number(req.query?.limit) || 1000))
    const read = await supabase.from('engine_incidents').select('*').gte('at', since).order('at', { ascending: false }).limit(limit)
    if (read.error) return res.status(500).json({ ok: false, error: 'read_failed' })
    let rounds: Array<{ piece_id: string; rounds: number }> | undefined
    if (req.query?.rounds === '1') {
      const pieces = await supabase.from('content_ideas').select('id, meta->making->rounds').not('meta->making->rounds', 'is', null).gte('updated_at', since).limit(500)
      rounds = pieces.error ? [] : ((pieces.data || []) as Array<{ id: string; rounds: unknown }>)
        .filter(r => typeof r.rounds === 'number').map(r => ({ piece_id: r.id, rounds: r.rounds as number }))
    }
    return res.status(200).json({ ok: true, since, incidents: read.data || [], ...(rounds ? { rounds } : {}) })
  }

  const body = (req.body || {}) as Record<string, unknown>
  if (Array.isArray(body.proposals)) {
    const list = body.proposals as Proposal[]
    if (!list.length || list.length > MAX_PROPOSALS) return res.status(400).json({ ok: false, error: 'bad_proposals', problems: [`1 to ${MAX_PROPOSALS} proposals a week`] })
    const batch = typeof body.batch === 'string' ? body.batch : ''
    const problems: string[] = []
    const rows: Record<string, unknown>[] = []
    for (const p of list) {
      if (!['engine_quality', 'taste'].includes(String(p?.proposal_class))) { problems.push('the loop proposes engine_quality or taste only'); continue }
      if (typeof p?.scope?.key !== 'string' || !String(p.scope.key).startsWith('loop:')) { problems.push('scope.key is the failure mode, starting loop:'); continue }
      const shaped = toProposalRow(p, batch)
      if ('row' in shaped) rows.push(shaped.row)
      else problems.push(`${String(p.scope.key)}: ${shaped.reason}`)
    }
    if (problems.length) return res.status(400).json({ ok: false, error: 'bad_proposals', problems })
    // A mode already on his list, kept or turned down, is never proposed again.
    const asked = await supabase.from('mindmake_studio_learning_proposals').select('scope').like('scope->>key', 'loop:%').limit(1000)
    if (asked.error) return res.status(500).json({ ok: false, error: 'read_failed' })
    const held = new Set(((asked.data || []) as { scope: { key?: string } | null }[]).map(r => r.scope?.key).filter(Boolean))
    const fresh = rows.filter(r => !held.has(String((r.scope as Record<string, unknown>).key)))
    if (!fresh.length) return res.status(200).json({ ok: true, proposals: 0, already_proposed: rows.length })
    const written = await supabase.from('mindmake_studio_learning_proposals').insert(fresh).select('id')
    if (written.error) return res.status(500).json({ ok: false, error: `write_failed: ${written.error.message}`.slice(0, 300) })
    return res.status(200).json({ ok: true, proposals: fresh.length, ids: (written.data || []).map((r: { id: string }) => r.id), already_proposed: rows.length - fresh.length })
  }

  const { rows, problems } = parseIncidents(body, now)
  if (problems.length) return res.status(400).json({ ok: false, error: 'bad_incidents', problems })
  const filed = await fileIncidents(supabase, rows)
  return res.status(filed === 'filed' ? 200 : 503).json({ ok: filed === 'filed', filed, count: rows.length })
}
