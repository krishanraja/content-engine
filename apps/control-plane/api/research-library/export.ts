import type { VercelRequest, VercelResponse } from '@vercel/node'
import { LIBRARY_KINDS, LIBRARY_ROLES } from '../_researchLibrary.js'
import { VAULT_RULE, verifyGithubIdentity, type IdentityResult } from '../_githubIdentity.js'

// GET /api/research-library/export[?after=<cursor>][&limit=1..200]: the vault's weekly research deposit (I-31; Ruling,
// Krish, 2026-11-14, with claude-archive's North Star wording: "every research document the fleet files ... land here on
// a regular schedule, so no research and no conversation exists in only one place").
//
// One caller only: claude-archive's research-deposit workflow, on its main branch, while that repository is private,
// proved by its own GitHub identity token (api/_githubIdentity.ts). No cookie, engine key or stored secret opens it; a
// token from any other repository gets 401. Read only: it writes nothing, moves no bytes and spends nothing.
//
// It pages every research text the store holds, oldest first, from the cursor: every version, every shelf (Make Your
// Mind Up's pieces and days and other ventures' own shelves), never an archived one, by the library's own research rule
// (kind research, corpus, note or paste, or role research, sources, source, corpus or notes). Each item carries its
// manifest and its exact text; the vault checks each sha256 and zips them. A file kept in the bucket is not in the
// deposit yet. A page stops before the function's response limit; next_cursor is null when nothing is left.

export const EXPORT_LIMIT_DEFAULT = 100
export const EXPORT_LIMIT_MAX = 200
/** The most text one page carries, under the function's response limit. */
export const EXPORT_PAGE_BYTES = 3_000_000

const COLUMNS = 'id,scope,piece_id,week,day,material_key,version,kind,role,title,note,sha256,bytes,text_sha256,source,added_by,added_at'

export interface ExportItem {
  id: string; scope: string; venture: string; piece_id: string | null; week: string | null; day: string | null
  material_key: string; version: number; kind: string; role: string | null; title: string; note: string | null
  sha256: string; bytes: number; source: string; added_by: string; added_at: string; content: string
}

type Row = Omit<ExportItem, 'venture' | 'content'> & { text_sha256: string }
type Db = { from(table: string): any }
export type Verify = (authorization: string | undefined) => Promise<IdentityResult>

/** The cursor a page ends on: the last item's added_at and id. */
export const cursorOf = (r: { added_at: string; id: string }) => Buffer.from(`${r.added_at}|${r.id}`, 'utf8').toString('base64url')
export function parseCursor(c: unknown): { at: string; id: string } | null {
  if (typeof c !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(c)) return null
  const [at, id] = Buffer.from(c, 'base64url').toString('utf8').split('|')
  if (!at || isNaN(Date.parse(at)) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id || '')) return null
  return { at, id }
}

/** Which venture a scope belongs to: its own shelf's, or Make Your Mind Up's ('publication'). */
export const ventureOfScope = (scope: string) => (scope.startsWith('venture:') ? scope.slice('venture:'.length) : 'publication')

export function createExportHandler(getDb: () => Promise<Db>, verify: Verify = a => verifyGithubIdentity(a, VAULT_RULE)) {
  return async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Cache-Control', 'no-store')
    if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'method_not_allowed' })
    const who = await verify(req.headers.authorization)
    if (who.ok !== true) {
      const no = who as Extract<IdentityResult, { ok: false }>
      return res.status(no.status).json({ ok: false, error: no.status === 401 ? 'unauthorized' : 'identity_unverifiable', why: no.why })
    }
    const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)
    const rawAfter = first(req.query.after)
    const after = rawAfter === undefined || rawAfter === '' ? null : parseCursor(rawAfter)
    if (rawAfter !== undefined && rawAfter !== '' && !after) return res.status(400).json({ ok: false, error: 'invalid_cursor' })
    const rawLimit = first(req.query.limit)
    const limit = rawLimit === undefined ? EXPORT_LIMIT_DEFAULT : Number(rawLimit)
    if (!Number.isInteger(limit) || limit < 1 || limit > EXPORT_LIMIT_MAX) return res.status(400).json({ ok: false, error: 'invalid_limit' })
    try {
      const db = await getDb()
      const research = `kind.in.(${LIBRARY_KINDS.join(',')}),role.in.(${LIBRARY_ROLES.join(',')})`
      // One `or` filter carries both rules, so nothing depends on how repeated filters combine.
      const where = after
        ? `and(or(${research}),or(added_at.gt."${after.at}",and(added_at.eq."${after.at}",id.gt.${after.id})))`
        : research
      const page = await db.from('piece_materials').select(COLUMNS).eq('storage', 'text').is('archived_at', null).or(where).order('added_at', { ascending: true }).order('id', { ascending: true }).limit(limit + 1)
      if (page.error || !Array.isArray(page.data)) return res.status(503).json({ ok: false, error: 'store_unreadable' })
      const rows = page.data as Row[]
      const more = rows.length > limit
      const take: Row[] = []
      let bytes = 0
      for (const r of rows.slice(0, limit)) {
        if (take.length && bytes + Number(r.bytes) > EXPORT_PAGE_BYTES) break
        take.push(r); bytes += Number(r.bytes)
      }
      const shas = [...new Set(take.map(r => r.text_sha256))]
      const texts = new Map<string, string>()
      for (let i = 0; i < shas.length; i += 100) {
        const t = await db.from('material_texts').select('sha256,content').in('sha256', shas.slice(i, i + 100))
        if (t.error || !Array.isArray(t.data)) return res.status(503).json({ ok: false, error: 'store_unreadable' })
        for (const x of t.data as Array<{ sha256: string; content: string }>) texts.set(x.sha256, x.content)
      }
      const items: ExportItem[] = []
      for (const r of take) {
        const content = texts.get(r.text_sha256)
        // A text the store cannot hand back stops the page there, so the cursor never skips it.
        if (typeof content !== 'string') break
        const { text_sha256: _t, ...rest } = r
        items.push({ ...rest, bytes: Number(r.bytes), venture: ventureOfScope(r.scope), content })
      }
      const last = items[items.length - 1]
      // next_cursor is where the next page starts (the vault keeps it); done says nothing is left after it.
      const done = !more && items.length === rows.length
      return res.status(200).json({
        ok: true, count: items.length, bytes: items.reduce((n, i) => n + i.bytes, 0),
        after: rawAfter || null, next_cursor: last ? cursorOf(last) : (rawAfter || null), done, items,
      })
    } catch {
      return res.status(503).json({ ok: false, error: 'store_unreadable' })
    }
  }
}

export default createExportHandler(async () => (await import('../_supabase.js')).supabase as unknown as Db)
