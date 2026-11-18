import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine, operatorBearerAllowed } from '../_auth.js'
import { StoreError, addText, archive, confirmFile, fileType, listing, parseScope, readMaterial, uploadUrl, writerOf, type StoreDb } from '../_pieceStore.js'
import type { FolderDb } from '../_postFolder.js'
/** _postFolder.ts GOT_ROLE, written here so this route loads the library (and its database client) only when a file of
 *  his arrives; tests/control-plane/post-folder.test.ts holds the two equal. */
export const GOT_ROLE = 'krish_got'
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
// A file Krish got himself for a piece (role krish_got: the production plan's "What you get yourself", dropped on the
// board, or filed by any session) is also filed into his Drive (api/_postFolder.ts; Krish, 2026-11-18: "when I drop
// stuff in there, it needs to be filed properly in my Drive in the right place"). Its confirm takes `beats` (the plan's
// beat ids it is for) and `for` (what the plan asked for); the piece's post folder is bound if nothing bound it yet,
// the material's key names its beats (got:<beats>:<sha256 16>), and the same bytes become a library row at
// `3 Posts/<folder>/3 Video/Your materials/<BEATS> - <name>`, which the library sync on his home computer writes into
// Drive. The answer's `drive` says { state: filed | already, path, folder }, or { state: held | later, why } (the
// material is on the piece either way; the same drop again files what is still missing).
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
      if (op === 'confirm' && body.role === GOT_ROLE) return res.status(201).json(await withCopy(await confirmGot(db, body, bearer, by)))
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

/** A file Krish got himself, filed on its piece and into the piece's folder in his Drive (the header says how). */
export async function confirmGot(db: StoreDb, body: Record<string, unknown>, bearer: boolean, by: string, fetcher?: Parameters<typeof confirmFile>[4]): Promise<Record<string, unknown>> {
  const { PostFolderError, beatsOf, bindPostFolder, fileToPostFolder, gotKey, MATERIALS_FOLDER, MATERIALS_SECTION } = await import('../_postFolder.js')
  const pieceId = typeof body.piece_id === 'string' ? body.piece_id.toLowerCase() : ''
  if (!pieceId) throw new StoreError(400, 'got_needs_a_piece')
  const sha = typeof body.sha256 === 'string' ? body.sha256.toLowerCase() : ''
  const beats = beatsOf(body.beats)
  const asked = typeof body.for === 'string' ? body.for.replace(/\s+/g, ' ').trim().slice(0, 300) : ''
  const { ext, contentType } = await fileType(body.name)
  // Who put it there, said plainly: his own drop, or a session filing something he gave it.
  const who = bearer ? `${by} filed this for Krish` : 'Krish got this himself'
  const note = `${who} for ${beats.length ? `beat ${beats.join(', ')}` : 'the production plan'}${asked ? `: ${asked}` : ''}. `
    + `In his Drive it goes in the piece's post folder, ${MATERIALS_SECTION}/${MATERIALS_FOLDER}.`
  // The bytes are read back and checked first; only a file that is on the piece binds a folder or reaches Drive.
  const filed = await confirmFile(db, { ...body, role: GOT_ROLE, material_key: /^[a-f0-9]{64}$/.test(sha) ? gotKey(beats, sha) : undefined, note }, bearer, by, fetcher)
  const md5 = typeof filed.md5 === 'string' ? filed.md5 : ''
  let folder: string
  try { folder = (await bindPostFolder(db as unknown as FolderDb, pieceId, by)).folder }
  catch (e) { return { ...filed, drive: { state: 'held', why: e instanceof PostFolderError ? e.message : 'not_bound' } } }
  const subject = folder.split(' - ').slice(1).join(' - ')
  const purpose = `Krish's own, for ${beats.length ? beats.map(b => b.toUpperCase()).join(' ') : 'the production plan'} of ${subject}`.slice(0, 200)
  try {
    const f = await fileToPostFolder(db as unknown as FolderDb, { folder, name: typeof body.name === 'string' ? body.name : 'file', beats, ext, contentType,
      sha256: sha, md5, bytes: Number(body.bytes), purpose, sentBy: sentByOf(by) })
    return { ...filed, drive: { state: f.state, path: f.path, folder } }
  } catch (e) { return { ...filed, drive: { state: 'later', folder, why: e instanceof Error ? e.message : 'not_filed' } } }
}

/** The library's sender name (content_library_files.sent_by: a letter, then letters, digits and underscores). */
export const sentByOf = (by: string): string => {
  const s = by.replace(/[^A-Za-z0-9_]+/g, '_').replace(/^[^A-Za-z]+/, '').slice(0, 40)
  return s || 'Krish'
}

export default createStoreHandler(
  async () => (await import('../_supabase.js')).supabase as unknown as StoreDb,
  async id => (await import('../_researchLibraryGoogle.js')).copyNow(id),
  async () => (await import('../_researchLink.js')).driveLinkReader(),
  async (db, pieceId) => (await import('../board/_view.js')).readPieceDecisions(db as never, pieceId) as unknown as Promise<Record<string, unknown> | null>,
)
