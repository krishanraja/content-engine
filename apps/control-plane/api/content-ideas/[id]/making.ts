import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_supabase.js'
import { guardEngine, operatorBearerAllowed } from '../../_auth.js'
import { type Making, makingSteps, mergeMaking, parseMakingPatch } from '../../_making.js'
import { askChecksForPiece } from '../../_controlCenter.js'

// GET  /api/content-ideas/:id/making           where this piece is: the record and its steps
// POST /api/content-ideas/:id/making  body: a patch (apps/control-plane/api/_making.ts):
//        { workroom: {url}, publish_manager: {url}, visual_gate: {passed, problems},
//          script_check: {passed, problems, cuts, hashes: {long, short}}, pack: {folder, files, sent_at},
//          recordings: [{cut, path, seconds, script_sha256}], video_assets: [{cut, name, path, url}],
//          channels: {substack: {url}, youtube: null, ...}, session: {url, by},
//          teleprompter: {folder_id, folder_name, cuts: {long|short: {script_id, title, script_sha256,
//            sent_at, error, failed_at}}} }
//
// teleprompter is where each cut's script is in Krish's teleprompter.com
// account (scripts/post-pack/teleprompter_send.py record, making.py
// teleprompter): one folder per piece, one script per cut, ids in upper case.
// Descript was retired on 2026-10-12 (Krish: "Descript is permanently gone,
// teleprompter.com is permanently in, connected via MCP here"): a descript
// patch is refused, and the descript field records written before then still
// hold is kept as it is and read by nothing.
//
// The GET answer also carries the piece's lane_slot, its series, so
// making.py scripts can check each script opens with its series line
// (house rule SERIES_OPENER).
//
// Every write lands on content_ideas.meta.making, so Control Center's realtime
// subscription on content_ideas shows it within a second. A Claude Code
// session writes with the engine key (scripts/post-pack/making.py); Krish's
// cookie writes when he ticks a channel off in Control Center. Nothing here
// sends, posts, spends or deletes: it records what was done, and by whom.
//
// The write is guarded on the row's updated_at (docs/CADENCE.md, "The row
// changes under a write"): when another write lands between this read and
// this write, nothing is written and the answer is 409 stale_row, so the
// caller sends its patch again and it is merged onto the fresh record.
// making.py retries once by itself.
//
// A step that lands closes nothing here. The engine asks Control Center's
// done-check sweep to look at the piece's open board items now
// (_controlCenter.ts), and the sweep closes the ones whose step is done.
// Krish, 2026-10-11: "I am happy to Clear(complete)/Bump/Purge things off my
// lists as I go but the rest should be automatically done." The answer's
// `closed` stays empty for one release, for callers that still read it, and
// `looked` names the items the sweep was asked to look at.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return

  const raw = req.query?.id
  const ideaId = Array.isArray(raw) ? raw[0] : raw
  if (!ideaId) return res.status(400).json({ ok: false, error: 'id required' })

  const { data: row, error } = await supabase.from('content_ideas').select('id, idea, state, lane_slot, meta, buried_at, updated_at').eq('id', ideaId).maybeSingle()
  if (error) return res.status(500).json({ ok: false, error: error.message })
  if (!row) return res.status(404).json({ ok: false, error: 'idea not found' })
  const meta = ((row as any).meta && typeof (row as any).meta === 'object' ? (row as any).meta : {}) as Record<string, unknown>
  const prev = (meta.making || null) as Making | null

  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, idea_id: ideaId, state: (row as any).state, lane_slot: (row as any).lane_slot ?? null, making: prev, steps: makingSteps(row as any) })
  }

  const now = new Date().toISOString()
  const body = (req.body || {}) as Record<string, unknown>
  const { patch, problems } = parseMakingPatch(body, now)
  if (problems.length) return res.status(400).json({ ok: false, error: 'bad_patch', problems })
  if (!Object.keys(patch).length) return res.status(400).json({ ok: false, error: 'empty_patch', problems: ['nothing to record'] })

  const who = typeof body.by === 'string' && body.by.trim() ? body.by.trim().slice(0, 60) : operatorBearerAllowed(req) ? 'Claude Code' : 'Krish'
  const next = mergeMaking(prev, patch, who, now)
  const { data: written, error: upErr } = await supabase
    .from('content_ideas')
    .update({ meta: { ...meta, making: next }, updated_at: now })
    .eq('id', ideaId)
    .eq('updated_at', (row as any).updated_at)
    .select('id')
  if (upErr) return res.status(500).json({ ok: false, error: upErr.message })
  if (!written?.length) return res.status(409).json({ ok: false, error: 'stale_row', problems: ['the piece changed while this was being written; nothing was written, so send it again'] })
  const after = { ...(row as any), meta: { ...meta, making: next } }
  // The sweep looks at the items waiting on this piece now. The write waits up
  // to 3 s for the ask (_controlCenter.ts, ASK_MS); a failed ask changes nothing.
  const look = await askChecksForPiece(ideaId)
  return res.status(200).json({ ok: true, idea_id: ideaId, making: next, steps: makingSteps(after), closed: [], looked: look.keys })
}
