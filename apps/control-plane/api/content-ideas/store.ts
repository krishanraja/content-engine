import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine, operatorBearerAllowed } from '../_auth.js'
import { StoreError, addText, archive, confirmFile, listing, parseScope, readMaterial, uploadUrl, writerOf, type StoreDb } from '../_pieceStore.js'
import { driveFileIdOf, isResearchLink, type LinkReader } from '../_researchLink.js'
import { DECISIONS_RULE } from '../board/_decisions.js'

// The piece materials store (api/_pieceStore.ts; docs/PUBLISH_BOARDS.md, "Sessions and materials"): one listing every
// session reads, and the one door the board and every session file through. On the engine key or his login; Control
// Centre reaches it through its own rewrite of /api/content-ideas/* and through its connector's tools.
//
//   GET  /api/content-ideas/store?piece=<id>                  what is on record for the piece, its day and its week, who is
//        (or ?week=<Monday>&day=<mon..sun>)                    working on it and what each said, the fields and the newest
//        [&all=1 every version] [&archived=1]                  reports
//   GET  /api/content-ideas/store?op=read&id=<material id>     a text as JSON; a file or link redirects (add &link=1 for JSON)
//   POST /api/content-ideas/store?op=text   { piece_id | week+day, content, title?, kind?, role?, note?, session_id?, material_key?, base_version? }
//   POST /api/content-ideas/store?op=link   { piece_id | week+day, url, title?, ... }
//   POST op=text or op=link with { venture: <slug> } in place of a piece or a day: another venture's research shelf
//        (I-30), store only, never copied to the Drive library; refused for publication, an unknown or inactive slug, and
//        a text holding a key, an email address or a phone number (api/_pieceStore.ts, shelfRefusal)
//   POST /api/content-ideas/store?op=upload-url  { piece_id | week+day, name, sha256, bytes }   then PUT the bytes, then:
//   POST /api/content-ideas/store?op=confirm     { the same, title?, kind?, role?, note?, session_id?, material_key? }
//   POST /api/content-ideas/store?op=archive     { id, reason? }   archived, never deleted
//
// Nothing here deletes, sends, posts or spends.
//
// A text or a file that is research (api/_researchLibrary.ts, inLibrary) is also copied into his Drive's Research library
// by the write that filed it, and the answer says so: `library` is { state: copied | already, link } or { state: later }
// (the hourly sweep copies it; the store holds it either way) or { state: not_research } (docs/DRIVE.md, "The research
// library"). A copy that fails never fails the write.
//
// A link filed as research (kind or role research) keeps that kind, and when it names a file in his Drive the engine reads
// the file's words (api/_researchLink.ts) and files them on the same piece or day as research text, which is copied into
// the library like any research; the answer's `research_text` says what happened ({ state: filed, material, library },
// or { state: later | unreadable }). Reading never fails the write: the link is on file either way (Krish, 2026-11-17:
// "are both logged correctly in the same place in the library and UI automatically?").

export const config = { maxDuration: 60 }

const q = (v: unknown) => (Array.isArray(v) ? v[0] : v)

/** Copies one material into the research library and says what happened; never throws. */
export type LibraryCopy = (materialId: string | null) => Promise<Record<string, unknown>>
const materialIdOf = (r: Record<string, unknown>): string | null => {
  const m = r.material && typeof r.material === 'object' ? r.material as Record<string, unknown> : null
  return typeof m?.id === 'string' ? m.id : null
}

/** His decisions on a piece, read live (_view.ts readPieceDecisions; F46); null when they could not be read. */
export type DecisionsReader = (db: StoreDb, pieceId: string) => Promise<Record<string, unknown> | null>

export function createStoreHandler(getDb: () => Promise<StoreDb>, copy?: LibraryCopy, readLink?: () => Promise<LinkReader | null>, decide?: DecisionsReader) {
  const withCopy = async (r: Record<string, unknown>) => {
    if (!copy) return r
    try { return { ...r, library: await copy(materialIdOf(r)) } } catch { return { ...r, library: { state: 'later', why: 'copy_failed' } } }
  }
  /** A research link's words, filed beside it as research text and copied to the library; never throws. */
  const researchText = async (db: StoreDb, body: Record<string, unknown>, bearer: boolean, by: string): Promise<Record<string, unknown> | null> => {
    const url = typeof body.url === 'string' ? body.url.trim() : ''
    // A venture's shelf is never copied to his library (I-30), so its links are not read here either.
    if (!isResearchLink(body) || !driveFileIdOf(url) || !readLink || body.venture) return null
    try {
      const reader = await readLink()
      if (!reader) return { state: 'later', why: 'no_drive' }
      const got = await reader(url)
      if (!got) return { state: 'unreadable', why: 'no_words_in_the_file' }
      const { url: _u, op: _o, material_key: _k, base_version: _b, ...rest } = body
      const title = typeof body.title === 'string' && body.title.trim() ? `${body.title.trim().slice(0, 260)} (text)` : got.title
      const filed = await withCopy(await addText(db, { ...rest, op: 'text', content: got.text, kind: 'research', role: typeof body.role === 'string' && body.role ? body.role : 'research',
        title, note: `The words of ${url} (${got.title}), read from his Drive by the engine when the link was filed as research.` }, bearer, by))
      return { state: 'filed', material: filed.material, duplicate: filed.duplicate ?? false, library: filed.library }
    } catch (e) {
      if (e instanceof StoreError) return { state: 'later', why: e.message }
      return { state: 'later', why: 'read_failed' }
    }
  }
  return async (req: VercelRequest, res: VercelResponse) => {
    if (guardEngine(req, res, ['GET', 'POST'])) return
    res.setHeader('Cache-Control', 'private, no-store')
    const op = String(q(req.query.op) || '')
    try {
      const db = await getDb()
      if (req.method === 'GET') {
        if (op === 'read') {
          const got = await readMaterial(db, String(q(req.query.id) || ''))
          if (got.kind === 'redirect' && q(req.query.link) !== '1') return res.redirect(302, got.url)
          return res.status(200).json(got.body)
        }
        const scope = parseScope({ piece: q(req.query.piece) ?? q(req.query.piece_id), week: q(req.query.week), day: q(req.query.day) })
        const listed = await listing(db, scope, { all: q(req.query.all) === '1', archived: q(req.query.archived) === '1' })
        // A piece's read carries his decisions, so a session checks before it asks him for a press (F46). Unread is said
        // as unread, never as not made.
        if (!scope.piece_id || !decide) return res.status(200).json(listed)
        const decisions = await decide(db, scope.piece_id).catch(() => null)
        return res.status(200).json({ ...listed, decisions: decisions ?? { unread: true, rule: DECISIONS_RULE } })
      }
      const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}) as Record<string, unknown>
      const bearer = operatorBearerAllowed(req)
      const by = writerOf(bearer, body)
      if (op === 'text') return res.status(201).json(await withCopy(await addText(db, { ...body, op }, bearer, by)))
      if (op === 'link') {
        const linked = await addText(db, { ...body, op }, bearer, by)
        const text = await researchText(db, body, bearer, by)
        return res.status(201).json(text ? { ...linked, research_text: text } : linked)
      }
      if (op === 'upload-url') return res.status(200).json(await uploadUrl(db, body))
      if (op === 'confirm') return res.status(201).json(await withCopy(await confirmFile(db, body, bearer, by)))
      if (op === 'archive') return res.status(200).json(await archive(db, String(body.id || ''), by, typeof body.reason === 'string' ? body.reason.slice(0, 500) : null))
      return res.status(400).json({ ok: false, error: 'unknown_op', ops: ['text', 'link', 'upload-url', 'confirm', 'archive'] })
    } catch (e) {
      if (e instanceof StoreError) return res.status(e.status).json({ ...e.extra, ok: false, error: e.message })
      console.error('[piece store] unexpected', e instanceof Error ? e.message : 'error')
      return res.status(503).json({ ok: false, error: 'board_store_unavailable' })
    }
  }
}

export default createStoreHandler(
  async () => (await import('../_supabase.js')).supabase as unknown as StoreDb,
  async id => (await import('../_researchLibraryGoogle.js')).copyNow(id),
  async () => (await import('../_researchLink.js')).driveLinkReader(),
  async (db, pieceId) => (await import('../board/_view.js')).readPieceDecisions(db as never, pieceId) as unknown as Promise<Record<string, unknown> | null>,
)
