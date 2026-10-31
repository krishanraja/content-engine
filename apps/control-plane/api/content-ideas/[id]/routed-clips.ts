import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_supabase.js'
import { guardEngine } from '../../_auth.js'
import { pathId } from '../../_content.js'
import { MAKING_ALL_CUTS } from '../../_making.js'
import { ROUTED_CLIP_COLS, missingClips, presentClip } from '../../_routedClips.js'

// GET /api/content-ideas/:id/routed-clips
//   -> { ok, clips: [RoutedClip], placements: {long|short|feature: {card_id: place}}, missing: {cut: [card_id]} }
//
// Every Inspiration card Krish linked to this piece (inspiration_items.piece_id), with how the cut uses it
// (_routedClips.ts): `show_with_sound` only when the making record holds his quoted words saying so (clip_uses), else
// `reference`. `missing` names, per cut, each show_with_sound clip the making record has not placed with its sound on,
// nor left out on his words. make-piece reads this before the creative direction; making.py video warns on a cut it
// names (whether that should stop the cut is his call, not made yet).
// Read only: nothing here writes, sends or spends.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Credentials first, then the method: a request with neither is a 401, never a hint about what the route takes.
  if (guardEngine(req, res, ['GET', 'POST'])) return
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'read only: GET' })
  res.setHeader('Cache-Control', 'no-store')
  const id = pathId(req)
  if (!id) return res.status(400).json({ ok: false, error: 'id required' })
  const [idea, cards] = await Promise.all([
    supabase.from('content_ideas').select('id,meta').eq('id', id).maybeSingle(),
    supabase.from('inspiration_items').select(ROUTED_CLIP_COLS).eq('piece_id', id).is('dismissed_at', null).order('created_at', { ascending: true }).limit(100),
  ])
  if (idea.error || cards.error) return res.status(500).json({ ok: false, error: (idea.error || cards.error)!.message })
  if (!idea.data) return res.status(404).json({ ok: false, error: 'idea not found' })
  const making = (idea.data.meta as Record<string, any> | null)?.making
  const uses = making && typeof making.clip_uses === 'object' && making.clip_uses ? making.clip_uses : {}
  const clips = ((cards.data || []) as Array<Record<string, any>>).map(card => presentClip(card, uses))
  const placements = making && typeof making.clip_placements === 'object' && making.clip_placements ? making.clip_placements : {}
  const missing: Record<string, string[]> = {}
  for (const cut of MAKING_ALL_CUTS) missing[cut] = missingClips(clips, placements[cut]).map(c => c.card_id)
  return res.status(200).json({ ok: true, clips, placements, missing })
}
