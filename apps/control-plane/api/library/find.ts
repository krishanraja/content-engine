import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { hashVideoStudioIdentity } from '../_videoStudioAuth.js'
import { enforceVideoStudioRateLimit } from '../video-studio/_data.js'
import { libraryFileRow, parseLibraryName, type LibraryName } from './_library.js'

// GET /api/library/find, on the engine key or Krish's access cookie (I-07, 14 Nov 2026).
//   ?library=<makeyourmindup|heartside>&sha256=<64 hex>            the copies of those exact bytes
//   ?library=<lib>&prefix=<path prefix>[&type=video|image|pdf|audio|text]  the files under a folder, of one kind
//
// Control Center's SendLinks lane links a library file where it already is, in the content-library bucket, with no
// bytes moved (make_send_link with library_ref). This names each ready file's library, path and storage key. It never
// signs a URL, makes a public one or moves anything. At most 50 rows, newest first.
//
// `approved` is true only for a file a sealed manifest approved; content-engine keeps no such record on library files
// yet, so it is false on every row, and Control Center links only a file whose hash is inside a proposal Krish
// approved. `role` is 'master' on every row and `share` is absent: a smaller share copy is not filed beside its master
// yet. Both are kept in the answer so the contract does not change when they are.

const READER_IDENTITY = hashVideoStudioIdentity('library', 'find-reader')
const SHA256 = /^[a-f0-9]{64}$/
const TYPES: Record<string, (contentType: string) => boolean> = {
  video: (t) => t.startsWith('video/'),
  image: (t) => t.startsWith('image/'),
  audio: (t) => t.startsWith('audio/'),
  pdf: (t) => t === 'application/pdf',
  text: (t) => t.startsWith('text/') || t === 'application/json',
}
export const FIND_MAX = 50

export type FindQuery =
  | { library: LibraryName; sha256: string }
  | { library: LibraryName; prefix: string; type: string | null }

export function parseFindQuery(query: unknown): FindQuery | null {
  const q = (query && typeof query === 'object' ? query : {}) as Record<string, unknown>
  const first = (v: unknown) => (Array.isArray(v) ? v[0] : v)
  const library = parseLibraryName(first(q.library))
  if (!library || first(q.library) === undefined) return null
  const sha = first(q.sha256)
  const prefix = first(q.prefix)
  const type = first(q.type)
  if (sha !== undefined) {
    if (prefix !== undefined || type !== undefined || typeof sha !== 'string' || !SHA256.test(sha)) return null
    return { library, sha256: sha }
  }
  if (typeof prefix !== 'string' || prefix.length < 1 || prefix.length > 180 || /[%_\\]|\.\.|[\u0000-\u001f]/.test(prefix)) return null
  if (type !== undefined && (typeof type !== 'string' || !(type in TYPES))) return null
  return { library, prefix, type: (type as string | undefined) ?? null }
}

function fileType(contentType: string): string {
  for (const [name, test] of Object.entries(TYPES)) if (test(contentType)) return name
  return 'other'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET'])) return
  res.setHeader('Cache-Control', 'no-store')
  const query = parseFindQuery(req.query)
  if (!query) return res.status(400).json({ ok: false, error: 'invalid_find_query' })
  if (await enforceVideoStudioRateLimit(res, 'library:find', READER_IDENTITY, 120, 60)) return

  let read = supabase.from('content_library_files').select('*').eq('library', query.library).eq('state', 'ready')
  read = 'sha256' in query ? read.eq('sha256', query.sha256) : read.like('path', `${query.prefix}%`)
  const { data, error } = await read.order('ready_at', { ascending: false }).limit(FIND_MAX * 4)
  if (error || !Array.isArray(data)) return res.status(503).json({ ok: false, error: 'library_index_unavailable' })

  const files = []
  for (const raw of data) {
    const row = libraryFileRow(raw)
    if (!row || row.state !== 'ready' || row.library !== query.library) continue
    if ('sha256' in query ? row.sha256 !== query.sha256 : !row.path.startsWith(query.prefix)) continue
    const type = fileType(row.content_type)
    if ('type' in query && query.type && type !== query.type) continue
    files.push({ library: row.library, path: row.path, object_key: row.object_key, sha256: row.sha256, bytes: row.bytes, type,
      content_type: row.content_type, ready_at: row.ready_at, role: 'master' as const, approved: false })
    if (files.length >= FIND_MAX) break
  }
  return res.status(200).json({ ok: true, files })
}
