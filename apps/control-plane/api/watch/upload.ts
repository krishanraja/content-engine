import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardEngine } from '../_auth.js'
import { googleAccessToken } from '../_google.js'
import { WATCH_FOLDER_IDS, driveLiteral, parseUpload, planUpload, type DriveFile, type DriveWriter } from './_upload.js'
import { watchStore } from './_watchStore.js'

// POST /api/watch/upload { id, machine, folder, name, sha256, bytes, mime }, on the engine key.
//
// The cloud backup files one fetched file: the engine opens a Drive upload session in the lane's Inspiration folder,
// as Krish, and answers { ok, exists: false, name, upload_url }; the machine PUTs the bytes to upload_url and checks
// the sha256 Google answers. The same bytes already filed answer { ok, exists: true, name }. Only a cloud machine
// holding the request's claim may ask (_upload.ts has the rules). Logs nothing about the link or the file.
//
// GET /api/watch/upload, on the engine key: the probe. For each folder, which delegated scope can add a file there,
// or Google's reason for each refusal. It writes nothing.
//
// GET /api/watch/upload?session=1 also proves the session URL the cloud machine PUTs to takes no key: it opens a
// session for a two-byte file in Production Inspo, asks its status with no Authorization (an empty PUT with
// Content-Range bytes */2; a live, unfinished session answers 308), then cancels it. An upload that never completes
// never becomes a file. (A one-byte chunk cannot be the test: Google refuses any chunk but the last that is not a
// multiple of 256 KiB, with or without a key.)

const SCOPES = ['https://www.googleapis.com/auth/drive.file', 'https://www.googleapis.com/auth/drive'] as const
const DRIVE = 'https://www.googleapis.com/drive/v3'

interface FolderAccess { scope: string | null; token: string | null; tried: Array<{ scope: string; reason: string }> }

async function folderAccess(folderId: string): Promise<FolderAccess> {
  const tried: FolderAccess['tried'] = []
  for (const scope of SCOPES) {
    const short = scope.slice(scope.lastIndexOf('/') + 1)
    let why = 'no_token'
    const token = await googleAccessToken([scope], { onError: r => { why = r } })
    if (!token) { tried.push({ scope: short, reason: why.slice(0, 160) }); continue }
    try {
      const r = await fetch(`${DRIVE}/files/${encodeURIComponent(folderId)}?fields=id,capabilities/canAddChildren&supportsAllDrives=true`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const j: any = await r.json().catch(() => ({}))
      if (!r.ok) { tried.push({ scope: short, reason: `drive_${r.status}:${String(j?.error?.message || '').slice(0, 120)}` }); continue }
      if (!j?.capabilities?.canAddChildren) { tried.push({ scope: short, reason: 'cannot_add_children' }); continue }
      return { scope: short, token, tried }
    } catch (e) {
      tried.push({ scope: short, reason: (e as Error)?.message?.slice(0, 120) || 'drive_threw' })
    }
  }
  return { scope: null, token: null, tried }
}

class DriveRefused extends Error {}

function googleDriveWriter(token: string): DriveWriter {
  return {
    async filesNamed(folderId, names): Promise<DriveFile[]> {
      const q = `${driveLiteral(folderId)} in parents and trashed = false and (${names.map(n => `name = ${driveLiteral(n)}`).join(' or ')})`
      const params = new URLSearchParams({ q, fields: 'files(name,sha256Checksum)', pageSize: '100', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' })
      const r = await fetch(`${DRIVE}/files?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const j: any = await r.json().catch(() => ({}))
      if (!r.ok) throw new DriveRefused(`drive_list_${r.status}`)
      return (j.files || []).map((f: any) => ({ name: String(f.name), sha256: typeof f.sha256Checksum === 'string' ? f.sha256Checksum.toLowerCase() : null }))
    },
    async startUpload(folderId, name, mime, bytes) {
      const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size,sha256Checksum', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mime,
          'X-Upload-Content-Length': String(bytes),
        },
        body: JSON.stringify({ name, parents: [folderId], mimeType: mime }),
      })
      const location = r.headers.get('location')
      if (!r.ok || !location) throw new DriveRefused(`drive_session_${r.status}`)
      return location
    },
  }
}

/** Open a session, ask its status with no key, cancel it: the URL a cloud machine PUTs to, proven without a file. */
async function sessionProbe(): Promise<{ put_without_key: number | string; cancelled: number | string; said?: string }> {
  const access = await folderAccess(WATCH_FOLDER_IDS.video_inspiration)
  if (!access.token) return { put_without_key: 'no_access', cancelled: 'none' }
  let url: string
  try {
    url = await googleDriveWriter(access.token).startUpload(WATCH_FOLDER_IDS.video_inspiration, '.content-watch-probe', 'text/plain', 2)
  } catch (e) {
    return { put_without_key: (e as Error).message.slice(0, 60), cancelled: 'none' }
  }
  let put: number | string = 'threw'
  let cancelled: number | string = 'threw'
  let said: string | undefined
  try {
    const r = await fetch(url, { method: 'PUT', headers: { 'Content-Range': 'bytes */2', 'Content-Length': '0' } })
    put = r.status
    if (r.status !== 308) said = (await r.text()).replace(/\s+/g, ' ').slice(0, 160)
  } catch { /* reported as threw */ }
  try {
    const r = await fetch(url, { method: 'DELETE', headers: { 'Content-Length': '0' } })
    cancelled = r.status
  } catch { /* reported as threw */ }
  return { put_without_key: put, cancelled, ...(said ? { said } : {}) }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return
  if (req.method === 'GET') {
    const folders: Record<string, { scope: string | null; tried: FolderAccess['tried'] }> = {}
    for (const [folder, id] of Object.entries(WATCH_FOLDER_IDS)) {
      const access = await folderAccess(id)
      folders[folder] = { scope: access.scope, tried: access.tried }
    }
    const writable = Object.values(folders).every(f => f.scope !== null)
    if (req.query?.session !== '1') return res.status(200).json({ ok: true, writable, folders })
    return res.status(200).json({ ok: true, writable, folders, session: await sessionProbe() })
  }
  const parsed = parseUpload(req.body)
  if ('error' in parsed) return res.status(400).json({ ok: false, error: parsed.error })
  const access = await folderAccess(WATCH_FOLDER_IDS[parsed.value.folder])
  if (!access.token) return res.status(503).json({ ok: false, error: 'drive_not_writable', tried: access.tried })
  try {
    const outcome = await planUpload(watchStore, googleDriveWriter(access.token), parsed.value)
    if ('error' in outcome) return res.status(outcome.status).json({ ok: false, error: outcome.error })
    return res.status(200).json(outcome)
  } catch (e) {
    if (e instanceof DriveRefused) return res.status(502).json({ ok: false, error: e.message })
    return res.status(503).json({ ok: false, error: 'watch_store_unavailable' })
  }
}
