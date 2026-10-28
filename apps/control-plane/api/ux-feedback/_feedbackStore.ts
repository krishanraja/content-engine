import { supabase } from '../_supabase.js'
import { googleAccessToken } from '../_google.js'
import { notifyKrishEmail } from '../_alert.js'
import { DOWNLOAD_TTL_SECONDS, type FeedbackDrive, type FeedbackRow, type FeedbackStore, type Mailer } from './_feedback.js'

// The store, Drive and mailer the feedback routes use. Every update is conditional on the status and claim the
// caller read, so two home computers never both take or both report the same recording.

export const BUCKET = 'ux-feedback'
const TABLE = 'ux_feedback_recordings'
const COLUMNS = 'id, name, note, object_path, mime, bytes, status, status_class, attempts, claimed_by, claimed_at, drive_folder_id, feedback_file_id, requested_at, updated_at'
const DRIVE = 'https://www.googleapis.com/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
const PARENT_NAME = 'UX Feedback'

export const feedbackStore: FeedbackStore = {
  async claimable(staleBefore, limit) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .or(`status.eq.queued,and(status.eq.claimed,claimed_at.lt.${staleBefore})`)
      .order('requested_at', { ascending: true })
      .limit(limit)
    if (error) throw new Error('feedback_store_unavailable')
    return (data || []) as FeedbackRow[]
  },
  async updateIf(id, was, patch) {
    let query = supabase.from(TABLE).update(patch).eq('id', id).eq('status', was.status)
    query = was.claimed_at === null ? query.is('claimed_at', null) : query.eq('claimed_at', was.claimed_at)
    const { data, error } = await query.select(COLUMNS)
    if (error) throw new Error('feedback_store_unavailable')
    return data && data.length === 1 ? data[0] as FeedbackRow : null
  },
  async get(id) {
    const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq('id', id).maybeSingle()
    if (error) throw new Error('feedback_store_unavailable')
    return (data as FeedbackRow | null) ?? null
  },
  async downloadUrl(objectPath) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(objectPath, DOWNLOAD_TTL_SECONDS)
    return error || !data?.signedUrl ? null : data.signedUrl
  },
}

export class DriveRefused extends Error {}

function literal(value: string): string {
  return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

/** Drive as Krish (domain-wide delegation, drive.file: only what this app made), like the cloud backup's uploads. */
export async function googleFeedbackDrive(): Promise<FeedbackDrive | null> {
  const token = await googleAccessToken(['https://www.googleapis.com/auth/drive.file'])
  if (!token) return null
  const headers = { Authorization: `Bearer ${token}` }
  async function createFolder(parentId: string | null, name: string): Promise<string> {
    const r = await fetch(`${DRIVE}/files?supportsAllDrives=true&fields=id`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ name, mimeType: FOLDER_MIME, ...(parentId ? { parents: [parentId] } : {}) }),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok || typeof j?.id !== 'string') throw new DriveRefused(`drive_folder_${r.status}`)
    return j.id
  }
  return {
    async parentFolder() {
      const configured = process.env.UX_FEEDBACK_DRIVE_FOLDER_ID
      if (configured) return configured
      // drive.file sees only what this app made, so the folder it made before is the one it finds.
      const q = `name = ${literal(PARENT_NAME)} and mimeType = ${literal(FOLDER_MIME)} and 'root' in parents and trashed = false`
      const params = new URLSearchParams({ q, fields: 'files(id)', pageSize: '1', orderBy: 'createdTime' })
      const r = await fetch(`${DRIVE}/files?${params}`, { headers })
      const j: any = await r.json().catch(() => ({}))
      if (!r.ok) throw new DriveRefused(`drive_list_${r.status}`)
      if (j?.files?.[0]?.id) return String(j.files[0].id)
      return createFolder(null, PARENT_NAME)
    },
    createFolder,
    async startUpload(folderId, name, mime, bytes) {
      const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size,sha256Checksum', {
        method: 'POST',
        headers: {
          ...headers,
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

/** Krish's own inbox, through the existing alert path (a draft when gmail.send is not delegated). */
export const krishMailer: Mailer = async (subject, body) => {
  const result = await notifyKrishEmail(subject, body)
  return { sent: result.sent, via: result.via }
}
