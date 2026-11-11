import { googleAccessToken, googleConfigured } from './_google.js'
import {
  INDEX_MATERIAL_COLUMN, LIBRARY_KINDS, LIBRARY_ROLES, PROP, RESEARCH_LIBRARY_FOLDER_ID, RESEARCH_LIBRARY_INDEX_ID, mirror,
  type LibraryDrive, type LibraryFile, type LibraryFolder, type LibraryIndex, type LibrarySource, type MirrorReport, type PieceInfo, type StoredMaterial,
} from './_researchLibrary.js'

// The research library's Google side and the store it reads (docs/DRIVE.md, "The research library"). The rules are in
// api/_researchLibrary.ts; this file only moves bytes.
//
// It writes as the owner of his Drive (GOOGLE_DRIVE_OWNER, krish@mindmake.co) with the delegated `drive` scope, as the
// feedback lane does: the library is his folder, not this app's, so drive.file cannot see it. It adds a folder, a file
// or an index row; it has no call that renames, moves, overwrites or deletes.

const DRIVE = 'https://www.googleapis.com/drive/v3'
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files'
const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive'
const DRIVE_OWNER = () => process.env.GOOGLE_DRIVE_OWNER || 'krish@mindmake.co'
const COLUMNS = 'id,scope,piece_id,week,day,material_key,version,kind,role,title,note,sha256,bytes,content_type,storage,text_sha256,object_key,added_by,added_at,archived_at'

type Fetch = typeof fetch
const lit = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const has = (key: string, value: string) => `properties has { key=${lit(key)} and value=${lit(value)} }`

class GoogleRefused extends Error {}
async function json(r: Response, what: string): Promise<any> {
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new GoogleRefused(`${what}_${r.status}${j?.error?.message ? `: ${String(j.error.message).slice(0, 120)}` : ''}`)
  return j
}

/** Drive, as the owner of his Drive. */
export function googleLibraryDrive(token: string, f: Fetch = fetch): LibraryDrive {
  const headers = { Authorization: `Bearer ${token}` }
  const list = async (q: string) => {
    const out: any[] = []
    let pageToken = ''
    do {
      const params = new URLSearchParams({
        q, pageSize: '1000', spaces: 'drive', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
        fields: 'nextPageToken, files(id,name,webViewLink,sha256Checksum,properties,trashed,createdTime)', ...(pageToken ? { pageToken } : {}),
      })
      const j = await json(await f(`${DRIVE}/files?${params}`, { headers }), 'drive_list')
      out.push(...(Array.isArray(j.files) ? j.files : []))
      pageToken = typeof j.nextPageToken === 'string' ? j.nextPageToken : ''
    } while (pageToken)
    return out
  }
  const fileOf = (x: any): LibraryFile => ({
    id: String(x.id), name: String(x.name || ''), link: typeof x.webViewLink === 'string' ? x.webViewLink : `https://drive.google.com/file/d/${x.id}/view`,
    sha256: typeof x.sha256Checksum === 'string' ? x.sha256Checksum.toLowerCase() : null, material: String(x.properties?.[PROP.material] || ''), trashed: Boolean(x.trashed),
  })
  return {
    async root(rootId) {
      const r = await f(`${DRIVE}/files/${encodeURIComponent(rootId)}?fields=id,mimeType,trashed,capabilities(canAddChildren)&supportsAllDrives=true`, { headers })
      const j: any = await r.json().catch(() => ({}))
      if (r.status === 404) return { ok: false, why: 'the library folder is gone (its ID answers 404)' }
      if (!r.ok) return { ok: false, why: `drive_${r.status}${j?.error?.message ? `: ${String(j.error.message).slice(0, 120)}` : ''}` }
      if (j.mimeType !== FOLDER_MIME) return { ok: false, why: 'the library ID no longer names a folder' }
      if (j.trashed) return { ok: false, why: 'the library folder is in the bin' }
      if (!j.capabilities?.canAddChildren) return { ok: false, why: 'the library folder does not take new files' }
      return { ok: true }
    },
    async folders(rootId) {
      const found = await list(`${has(PROP.root, rootId)} and mimeType = ${lit(FOLDER_MIME)} and trashed = false`)
      // Oldest first: should two writes ever have made the same folder at once, every later run uses the same one.
      found.sort((a, b) => String(a.createdTime || '').localeCompare(String(b.createdTime || '')) || String(a.id).localeCompare(String(b.id)))
      return found.map((x): LibraryFolder => ({ id: String(x.id), name: String(x.name || ''), props: (x.properties || {}) as Record<string, string> }))
    },
    async files(rootId, materialIds) {
      if (!materialIds) return (await list(`${has(PROP.root, rootId)} and mimeType != ${lit(FOLDER_MIME)}`)).map(fileOf)
      const out: LibraryFile[] = []
      for (let i = 0; i < materialIds.length; i += 20) {
        const chunk = materialIds.slice(i, i + 20)
        out.push(...(await list(`(${chunk.map(id => has(PROP.material, id)).join(' or ')}) and mimeType != ${lit(FOLDER_MIME)}`)).map(fileOf))
      }
      return out
    },
    async createFolder(parentId, name, props) {
      const j = await json(await f(`${DRIVE}/files?supportsAllDrives=true&fields=id`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId], properties: props }),
      }), 'drive_folder')
      if (typeof j.id !== 'string') throw new GoogleRefused('drive_folder_no_id')
      return j.id
    },
    async createFile({ parentId, name, mime, bytes, description, props }) {
      const start = await f(`${UPLOAD}?uploadType=resumable&supportsAllDrives=true&fields=id,name,webViewLink,sha256Checksum,properties`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json; charset=UTF-8', 'X-Upload-Content-Type': mime, 'X-Upload-Content-Length': String(bytes.byteLength) },
        body: JSON.stringify({ name, parents: [parentId], mimeType: mime, description, properties: props }),
      })
      const location = start.headers.get('location')
      if (!start.ok || !location) throw new GoogleRefused(`drive_session_${start.status}`)
      const j = await json(await f(location, { method: 'PUT', headers: { 'Content-Type': mime }, body: bytes as unknown as string }), 'drive_upload')
      if (typeof j.id !== 'string') throw new GoogleRefused('drive_upload_no_id')
      return fileOf({ ...j, properties: { ...(j.properties || {}), [PROP.material]: props[PROP.material] } })
    },
  }
}

/** The `00 Index` Sheet on the same token (the `drive` scope covers the Sheets API). Rows are appended, never edited. */
export function googleLibraryIndex(token: string, sheetId = RESEARCH_LIBRARY_INDEX_ID, f: Fetch = fetch): LibraryIndex {
  const headers = { Authorization: `Bearer ${token}` }
  const col = `${INDEX_MATERIAL_COLUMN}:${INDEX_MATERIAL_COLUMN}`
  return {
    async materialIds() {
      const j = await json(await f(`${SHEETS}/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(col)}?majorDimension=COLUMNS`, { headers }), 'sheets_read')
      const values: unknown[] = Array.isArray(j.values?.[0]) ? j.values[0] : []
      return new Set(values.map(v => String(v).trim()).filter(v => /^[0-9a-f-]{36}$/.test(v)))
    },
    async append(rows) {
      await json(await f(`${SHEETS}/${encodeURIComponent(sheetId)}/values/${encodeURIComponent('A1')}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ values: rows }),
      }), 'sheets_append')
    },
  }
}

// The narrow part of a Supabase client this reads.
export interface SourceDb {
  from(table: string): any
  storage: any
}

/** The store's records and bytes, read with the service key. */
export function storeSource(db: SourceDb, bucket: string): LibrarySource {
  return {
    async materials(only) {
      const out: StoredMaterial[] = []
      if (only) {
        for (let i = 0; i < only.length; i += 100) {
          const r = await db.from('piece_materials').select(COLUMNS).in('id', only.slice(i, i + 100))
          if (r.error) throw new Error('store_unreadable')
          out.push(...(r.data || []))
        }
        return out
      }
      const research = `kind.in.(${LIBRARY_KINDS.join(',')}),role.in.(${LIBRARY_ROLES.join(',')})`
      for (let from = 0; ; from += 1000) {
        const r = await db.from('piece_materials').select(COLUMNS).is('archived_at', null).in('storage', ['text', 'bucket']).or(research)
          .order('added_at', { ascending: true }).order('id', { ascending: true }).range(from, from + 999)
        if (r.error) throw new Error('store_unreadable')
        out.push(...(r.data || []))
        if (!r.data || r.data.length < 1000) break
      }
      return out
    },
    async pieces(ids) {
      const out = new Map<string, PieceInfo>()
      for (let i = 0; i < ids.length; i += 100) {
        const r = await db.from('content_ideas').select('id,idea,scheduled_for,lane_slot').in('id', ids.slice(i, i + 100))
        if (r.error) throw new Error('pieces_unreadable')
        for (const p of r.data || []) out.set(p.id, { id: p.id, idea: p.idea ?? null, scheduled_for: p.scheduled_for ?? null, series: p.lane_slot ?? null })
      }
      return out
    },
    async bytes(m) {
      if (m.storage === 'text' && m.text_sha256) {
        const r = await db.from('material_texts').select('content').eq('sha256', m.text_sha256).maybeSingle()
        if (r.error || typeof r.data?.content !== 'string') return null
        return new Uint8Array(Buffer.from(r.data.content, 'utf8'))
      }
      if (m.storage === 'bucket' && m.object_key) {
        const r = await db.storage.from(bucket).download(m.object_key)
        if (r.error || !r.data) return null
        return new Uint8Array(await r.data.arrayBuffer())
      }
      return null
    },
  }
}

/** One pass with the real store and his real Drive. `only` copies those materials now; with none it is the sweep. */
export async function runMirror(opts: { only?: string[]; budgetMs?: number } = {}): Promise<MirrorReport> {
  const empty: MirrorReport = { ok: false, eligible: 0, already: 0, mirrored: 0, indexed: 0, settling: 0, later: 0, failed: [], copies: [] }
  if (!googleConfigured()) return { ...empty, error: 'the engine has no Google service account, so it cannot reach the research library' }
  let why = 'no_token'
  const token = await googleAccessToken([DRIVE_SCOPE], { subject: DRIVE_OWNER(), onError: r => { why = r } })
  if (!token) return { ...empty, error: `research_library_no_token: ${why.slice(0, 160)}` }
  const [{ supabase }, { LIBRARY_BUCKET }] = await Promise.all([import('./_supabase.js'), import('./library/_library.js')])
  return mirror(storeSource(supabase as unknown as SourceDb, LIBRARY_BUCKET), googleLibraryDrive(token), googleLibraryIndex(token),
    { rootId: RESEARCH_LIBRARY_FOLDER_ID, only: opts.only, budgetMs: opts.budgetMs })
}

/** What the write that filed a material says about its copy: copied now (with the link), already there, not research,
 *  or later (the sweep copies it; the store holds it either way). Never throws, and gives up waiting after `waitMs`. */
export async function copyNow(materialId: string | null | undefined, waitMs = 20_000): Promise<Record<string, unknown>> {
  if (!materialId) return { state: 'later', why: 'no_material' }
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<Record<string, unknown>>(resolve => { timer = setTimeout(() => resolve({ state: 'later', why: 'slow' }), waitMs) })
  const work = runMirror({ only: [materialId], budgetMs: waitMs })
    .then((r): Record<string, unknown> => {
      const copy = r.copies.find(c => c.material === materialId)
      if (copy) return { state: copy.created ? 'copied' : 'already', link: copy.link, ...(r.ok ? {} : { why: r.error }) }
      if (r.eligible === 0 && !r.error) return { state: 'not_research' }
      return { state: 'later', why: r.error || 'not_copied' }
    })
    .catch((e: unknown) => ({ state: 'later', why: e instanceof Error ? e.message.slice(0, 120) : 'failed' }))
  try { return await Promise.race([work, timeout]) } finally { if (timer) clearTimeout(timer) }
}
