import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../_supabase.js'
import { guardEngine, operatorBearerAllowed } from '../_auth.js'
import { ACTION_COLS, brief, jobPatch, parseJobReport } from './_actions.js'

// GET  /api/inspiration/actions?id=<uuid>
//        one of Krish's ticks on an Inspiration card (control-center inspiration_actions), as the inspiration-piece job
//        reads it: the tick, his words, the card (name, lane, kind, Drive file, how to read it, the post it came from,
//        its transcript), the link it came from and that link's reading (content_reads.read_md, cut to 20,000
//        characters), and `ready` (a card or a reading to read; without either the link is still being fetched).
// POST /api/inspiration/actions  { id, job_state: running | drafted | failed, piece_id?, error?, run_url? }
//        the job's report on its own tick, the operator's key only: running, then drafted with the idea it wrote onto
//        the ideas board (the tick moves to drafted and names it), or failed with the reason in words, which Control
//        Centre shows on the card and in To approve. It never creates, drops or closes a tick, never moves one past
//        drafted, and never writes a piece's day: only his Approve does (the ideas gate).
//
// Ruling (Krish, 2026-11-12): an inspiration card he ticks is an instruction that jumps the queue: Content means make
// it into a piece now, Production means use the style within a week. docs/PUBLISH_BOARDS.md, "His instruction".

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const CARD_COLS = 'id,name,lane,kind,drive_file_id,why_here,why_like,why_like_source,note_for_claude,read_as,facets,transcript,dismissed_at'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    const id = String(req.query?.id || '')
    if (!UUID.test(id)) return res.status(400).json({ ok: false, error: 'bad_id', problems: ['id is the inspiration action id (a uuid)'] })
    const a = await supabase.from('inspiration_actions').select(ACTION_COLS).eq('id', id.toLowerCase()).maybeSingle()
    if (a.error) return res.status(500).json({ ok: false, error: a.error.message })
    if (!a.data) return res.status(404).json({ ok: false, error: 'not_found' })
    const action = a.data as Record<string, any>
    const [card, request] = await Promise.all([
      action.item_id ? supabase.from('inspiration_items').select(CARD_COLS).eq('id', action.item_id).maybeSingle() : Promise.resolve({ data: null, error: null }),
      action.watch_request_id
        ? supabase.from('content_watch_requests').select('id,url,platform,status,read_id,item_id').eq('id', action.watch_request_id).maybeSingle()
        : action.item_id
          ? supabase.from('content_watch_requests').select('id,url,platform,status,read_id,item_id').eq('item_id', action.item_id).order('requested_at', { ascending: true }).limit(1).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
    ])
    if (card.error || request.error) return res.status(500).json({ ok: false, error: (card.error || request.error)!.message })
    const readId = (request.data as Record<string, any> | null)?.read_id
    const reading = readId ? await supabase.from('content_reads').select('source_url,platform,read_md').eq('id', readId).maybeSingle() : { data: null, error: null }
    if (reading.error) return res.status(500).json({ ok: false, error: reading.error.message })
    return res.status(200).json({ ok: true, ...brief(action, card.data as Record<string, any> | null, request.data as Record<string, any> | null, reading.data as Record<string, any> | null) })
  }

  // Only the job writes its report; his login reads, and never reports a job as running.
  if (!operatorBearerAllowed(req)) return res.status(403).json({ ok: false, error: 'operator_only' })
  const { report, problems } = parseJobReport(req.body)
  if (!report) return res.status(400).json({ ok: false, error: 'bad_report', problems })
  const a = await supabase.from('inspiration_actions').select(ACTION_COLS).eq('id', report.id).maybeSingle()
  if (a.error) return res.status(500).json({ ok: false, error: a.error.message })
  if (!a.data) return res.status(404).json({ ok: false, error: 'not_found' })
  if (report.piece_id) {
    // The idea must be one the engine holds: the job wrote it through POST /api/content-ideas first.
    const p = await supabase.from('content_ideas').select('id').eq('id', report.piece_id).maybeSingle()
    if (p.error) return res.status(500).json({ ok: false, error: p.error.message })
    if (!p.data) return res.status(404).json({ ok: false, error: 'piece_not_found' })
  }
  const now = new Date().toISOString()
  const decided = jobPatch(a.data as Record<string, any>, report, now)
  if ('refused' in decided) return res.status(409).json({ ok: false, error: decided.refused })
  const w = await supabase.from('inspiration_actions').update(decided.patch).eq('id', report.id).in('state', ['open', 'drafted']).select(ACTION_COLS).maybeSingle()
  if (w.error) return res.status(500).json({ ok: false, error: w.error.message })
  if (!w.data) return res.status(409).json({ ok: false, error: 'moved_on' })
  return res.status(200).json({ ok: true, action: w.data })
}
