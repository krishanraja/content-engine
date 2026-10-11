import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_supabase.js'
import { guardEngine, operatorBearerAllowed } from '../../_auth.js'
import { type Making, makingSteps, mergeMaking, parseMakingPatch } from '../../_making.js'
import { closeBoardItemsForPiece } from '../../_boardClose.js'

// GET  /api/content-ideas/:id/making           where this piece is: the record and its steps
// POST /api/content-ideas/:id/making  body: a patch (apps/control-plane/api/_making.ts):
//        { workroom: {url}, publish_manager: {url}, visual_gate: {passed, problems},
//          script_check: {passed, problems, cuts}, pack: {folder, files, sent_at},
//          recordings: [{cut, path}], video_assets: [{cut, name, path, url}],
//          channels: {substack: {url}, youtube: null, ...}, session: {url, by} }
//
// Every write lands on content_ideas.meta.making, so Control Center's realtime
// subscription on content_ideas shows it within a second. A Claude Code
// session writes with the engine key (scripts/post-pack/making.py); Krish's
// cookie writes when he ticks a channel off in Control Center. Nothing here
// sends, posts, spends or deletes: it records what was done, and by whom.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return

  const raw = req.query?.id
  const ideaId = Array.isArray(raw) ? raw[0] : raw
  if (!ideaId) return res.status(400).json({ ok: false, error: 'id required' })

  const { data: row, error } = await supabase.from('content_ideas').select('id, idea, state, meta, buried_at, updated_at').eq('id', ideaId).maybeSingle()
  if (error) return res.status(500).json({ ok: false, error: error.message })
  if (!row) return res.status(404).json({ ok: false, error: 'idea not found' })
  const meta = ((row as any).meta && typeof (row as any).meta === 'object' ? (row as any).meta : {}) as Record<string, unknown>
  const prev = (meta.making || null) as Making | null

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, idea_id: ideaId, state: (row as any).state, making: prev, steps: makingSteps(row as any) })
  }

  const now = new Date().toISOString()
  const body = (req.body || {}) as Record<string, unknown>
  const { patch, problems } = parseMakingPatch(body, now)
  if (problems.length) return res.status(400).json({ ok: false, error: 'bad_patch', problems })
  if (!Object.keys(patch).length) return res.status(400).json({ ok: false, error: 'empty_patch', problems: ['nothing to record'] })

  const who = typeof body.by === 'string' && body.by.trim() ? body.by.trim().slice(0, 60) : operatorBearerAllowed(req) ? 'Claude Code' : 'Krish'
  const next = mergeMaking(prev, patch, who, now)
  const { error: upErr } = await supabase
    .from('content_ideas')
    .update({ meta: { ...meta, making: next }, updated_at: now })
    .eq('id', ideaId)
  if (upErr) return res.status(500).json({ ok: false, error: upErr.message })
  const after = { ...(row as any), meta: { ...meta, making: next } }
  // A step that lands closes the board items waiting on it (_boardClose.ts).
  const closed = await closeBoardItemsForPiece(after)
  return res.status(200).json({ ok: true, idea_id: ideaId, making: next, steps: makingSteps(after), closed })
}
