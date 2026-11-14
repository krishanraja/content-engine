import { randomUUID } from 'node:crypto'
import { googleAccessToken, googleConfigured } from './_google.js'
import {
  INDEX_LINK_AT, INDEX_MATERIAL_COLUMN, LIBRARY_KINDS, LIBRARY_LEASE, LIBRARY_LEASE_MS, LIBRARY_ROLES, PROP, RESEARCH_LIBRARY_FOLDER_ID, RESEARCH_LIBRARY_INDEX_ID, deleteRuns, mirror,
  type LibraryDrive, type LibraryFile, type LibraryFolder, type LibraryIndex, type LibraryLock, type LibrarySource, type MirrorReport, type PieceInfo, type StoredMaterial,
} from './_researchLibrary.js'

// The research library's Google side and the store it reads (docs/DRIVE.md, "The research library"). The rules are in
// api/_researchLibrary.ts; this file only moves bytes.
//
// It writes as the owner of his Drive (GOOGLE_DRIVE_OWNER, krish@mindmake.co) with the delegated `drive` scope, as the
// feedback lane does: the library is his folder, not this app's, so drive.file cannot see it. In Drive it adds a folder
// or a file; it has no call that renames, moves, overwrites or deletes. In the index it adds rows, and its one other
// write is the tidy: a batchUpdate that sets a Drive link and removes the rows tidyPlan named, and nothing else.

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

/** The `00 Index` Sheet on the same token (the `drive` scope covers the Sheets API). Rows are appended; the tidy sets a
 *  link and removes rows on the tab the bare ranges read and append to (the first visible one), found by its title. */
export function googleLibraryIndex(token: string, sheetId = RESEARCH_LIBRARY_INDEX_ID, f: Fetch = fetch): LibraryIndex {
  const headers = { Authorization: `Bearer ${token}` }
  const col = `${INDEX_MATERIAL_COLUMN}:${INDEX_MATERIAL_COLUMN}`
  const sheet = `${SHEETS}/${encodeURIComponent(sheetId)}`
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
    async read() {
      const j = await json(await f(`${sheet}/values/${encodeURIComponent(`A:${INDEX_MATERIAL_COLUMN}`)}?majorDimension=ROWS`, { headers }), 'sheets_read')
      // The answer names the range it read, `'00 Index'!A1:M1214`: its tab's title and the row it starts on.
      const range = /^(?:'((?:[^']|'')+)'|([^!']+))!\$?[A-Z]+\$?(\d+)/.exec(String(j.range || ''))
      if (!range) throw new GoogleRefused('sheets_read_no_range')
      const title = range[1] !== undefined ? range[1].replace(/''/g, "'") : range[2]
      const meta = await json(await f(`${sheet}?fields=${encodeURIComponent('sheets.properties(sheetId,title)')}`, { headers }), 'sheets_meta')
      const tab = (Array.isArray(meta.sheets) ? meta.sheets : []).map((x: any) => x?.properties).find((p: any) => p && p.title === title)
      if (!tab) throw new GoogleRefused('sheets_tab_not_found')
      // The API leaves out a sheetId of 0, the first tab's.
      const tabId = tab.sheetId === undefined ? 0 : Number(tab.sheetId)
      if (!Number.isInteger(tabId) || tabId < 0) throw new GoogleRefused('sheets_tab_id')
      const values = Array.isArray(j.values) ? j.values.map((r: unknown) => Array.isArray(r) ? r.map(v => String(v ?? '')) : []) : []
      return { tab: tabId, firstRow: Number(range[3]), values }
    },
    async tidy(plan) {
      // Never the header, never a row that is not a whole sheet row number.
      if ([...plan.deletes, ...plan.repairs.map(r => r.row)].some(r => !Number.isInteger(r) || r < 2)) throw new GoogleRefused('sheets_tidy_header')
      const requests = [
        ...plan.repairs.map(r => ({ updateCells: {
          range: { sheetId: plan.tab, startRowIndex: r.row - 1, endRowIndex: r.row, startColumnIndex: INDEX_LINK_AT, endColumnIndex: INDEX_LINK_AT + 1 },
          rows: [{ values: [{ userEnteredValue: { stringValue: r.link } }] }], fields: 'userEnteredValue',
        } })),
        ...deleteRuns(plan.deletes).map(([top, bottom]) => ({ deleteDimension: { range: { sheetId: plan.tab, dimension: 'ROWS', startIndex: top - 1, endIndex: bottom } } })),
      ]
      if (!requests.length) return
      // One batchUpdate: Sheets applies all of it or none of it.
      await json(await f(`${sheet}:batchUpdate`, {
        method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ requests }),
      }), 'sheets_tidy')
    },
  }
}

// The narrow part of a Supabase client this reads.
export interface SourceDb {
  from(table: string): any
  storage: any
}

/** The narrow part of a Supabase client the lease needs. */
export interface LeaseDb {
  rpc(fn: string, args: Record<string, unknown>): PromiseLike<{ data: unknown; error: { message?: string } | null }>
}

/** The library's lease in the database (engine_lease_take, migration 20261127100000), held by this one run. A lease that
 *  cannot be asked for (the function is missing, the database is down) is not to be had: the run writes nothing. */
export function storeLease(db: LeaseDb, who: 'sweep' | 'write', name = LIBRARY_LEASE, ms = LIBRARY_LEASE_MS): LibraryLock {
  const holder = `${who}:${randomUUID()}`
  return {
    async take() {
      let r: { data: unknown; error: { message?: string } | null }
      try { r = await db.rpc('engine_lease_take', { p_name: name, p_holder: holder, p_seconds: Math.ceil(ms / 1000) }) } catch (e) {
        return { ok: false, held: false, why: (e as Error).message?.slice(0, 160) || 'lease_rpc_failed' }
      }
      if (r.error) return { ok: false, held: false, why: String(r.error.message || 'lease_rpc_failed').slice(0, 160) }
      const d = (r.data && typeof r.data === 'object' ? r.data : {}) as Record<string, unknown>
      if (d.ok === true) {
        return { ok: true, async release() { await db.rpc('engine_lease_release', { p_name: name, p_holder: holder }) } }
      }
      if (d.error === 'held') {
        return { ok: false, held: true, holder: typeof d.holder === 'string' ? d.holder : null, until: typeof d.lease_until === 'string' ? d.lease_until : null }
      }
      return { ok: false, held: false, why: typeof d.error === 'string' ? d.error : 'lease_refused' }
    },
  }
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
  const empty: MirrorReport = { ok: false, eligible: 0, already: 0, mirrored: 0, indexed: 0, index_deduped: 0, index_repaired: 0, settling: 0, later: 0, failed: [], copies: [] }
  if (!googleConfigured()) return { ...empty, error: 'the engine has no Google service account, so it cannot reach the research library' }
  let why = 'no_token'
  const token = await googleAccessToken([DRIVE_SCOPE], { subject: DRIVE_OWNER(), onError: r => { why = r } })
  if (!token) return { ...empty, error: `research_library_no_token: ${why.slice(0, 160)}` }
  const [{ supabase }, { LIBRARY_BUCKET }] = await Promise.all([import('./_supabase.js'), import('./library/_library.js')])
  // One writer at a time: the sweep, by hand or on the hour, and the write that filed a material share one lease.
  return mirror(storeSource(supabase as unknown as SourceDb, LIBRARY_BUCKET), googleLibraryDrive(token), googleLibraryIndex(token),
    storeLease(supabase as unknown as LeaseDb, opts.only?.length ? 'write' : 'sweep'),
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
      return { state: 'later', why: r.error || r.skipped || 'not_copied' }
    })
    .catch((e: unknown) => ({ state: 'later', why: e instanceof Error ? e.message.slice(0, 120) : 'failed' }))
  try { return await Promise.race([work, timeout]) } finally { if (timer) clearTimeout(timer) }
}
