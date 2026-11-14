import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine, operatorBearerAllowed } from '../_auth.js'
import { StoreError, listing, parseReport, parseScope, report, writerOf, type StoreDb } from '../_pieceStore.js'

// A session's reports to the board (api/_pieceStore.ts; docs/PUBLISH_BOARDS.md, "Sessions and materials"). Every prompt
// the board copies out says to call this, through Control Centre's connector (report_board_session) or
// scripts/post-pack/board_session.py, so the board shows who is working on a piece and what each is doing.
//
//   POST /api/content-ideas/sessions  { piece_id | week+day, session_id, kind: start|progress|heartbeat|blocked|done|end,
//                                       step?, summary?, client_key?, lease_seconds?, label?, surface?, by?, detail?,
//                                       fields?: [{ name, value, base_revision, mode: set|append }] }
//        -> { ok, duplicate, event_id, fields: [per field: ok, revision, or revision_conflict with the value now],
//             others: the other sessions on it }
//   GET  /api/content-ideas/sessions?piece=<id>   the same listing as /api/content-ideas/store
//
// A report is appended, never changes another; the same report sent again lands once; a field set with a stale
// revision is refused with what is there now. Nothing here sends, posts, spends or deletes.

export function createSessionsHandler(getDb: () => Promise<StoreDb>) {
  return async (req: VercelRequest, res: VercelResponse) => {
    if (guardEngine(req, res, ['GET', 'POST'])) return
    res.setHeader('Cache-Control', 'private, no-store')
    const q = (v: unknown) => (Array.isArray(v) ? v[0] : v)
    try {
      const db = await getDb()
      if (req.method === 'GET') {
        const scope = parseScope({ piece: q(req.query.piece) ?? q(req.query.piece_id), week: q(req.query.week), day: q(req.query.day) })
        return res.status(200).json(await listing(db, scope))
      }
      const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as Record<string, unknown>
      const input = parseReport(body)
      const saved = await report(db, input, writerOf(operatorBearerAllowed(req), body))
      // Who else is on it, so a session knows at once that it is not alone.
      const now = await listing(db, input.scope).catch(() => null)
      const others = (now?.sessions as Array<Record<string, unknown>> | undefined || []).filter(s => s.session_id !== input.session_id)
      return res.status(saved.duplicate ? 200 : 201).json({ ...saved, others })
    } catch (e) {
      if (e instanceof StoreError) return res.status(e.status).json({ ...e.extra, ok: false, error: e.message })
      console.error('[piece store] unexpected', e instanceof Error ? e.message : 'error')
      return res.status(503).json({ ok: false, error: 'board_store_unavailable' })
    }
  }
}

export default createSessionsHandler(async () => (await import('../_supabase.js')).supabase as unknown as StoreDb)
