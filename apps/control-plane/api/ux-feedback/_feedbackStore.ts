import { supabase } from '../_supabase.js'
import { googleAccessToken } from '../_google.js'
import { notifyKrishEmail } from '../_alert.js'
import type { FeedbackDrive, FeedbackRow, FeedbackStore, Mailer } from './_feedback.js'

// The store, Drive and mailer the feedback routes use. Every update is conditional on the status and claim the
// caller read, so two home computers never both take or both report the same recording.

const TABLE = 'ux_feedback_recordings'
const COLUMNS = [
  'id', 'name', 'note', 'drive_file_id', 'drive_path', 'mime', 'bytes', 'md5', 'duration_ms', 'venture', 'venture_label',
  'repo', 'domain', 'status', 'status_class', 'attempts', 'claimed_by', 'claimed_at', 'drive_folder_id', 'stills_folder_id',
  'feedback_file_id', 'prompt_file_id', 'requested_at', 'updated_at',
].join(', ')
const DRIVE = 'https://www.googleapis.com/drive/v3'
const FOLDER_MIME = 'application/vnd.google-apps.folder'
// His Drive belongs to this address (docs/DRIVE.md), not the one Gmail sends as.
const DRIVE_OWNER = () => process.env.GOOGLE_DRIVE_OWNER || 'krish@mindmake.co'

export const feedbackStore: FeedbackStore = {
  async claimable(staleBefore, limit) {
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLUMNS)
      .or(`status.eq.queued,and(status.eq.claimed,claimed_at.lt.${staleBefore})`)
      .order('requested_at', { ascending: true })
      .limit(limit)
    if (error) throw new Error('feedback_store_unavailable')
    return (data || []) as unknown as FeedbackRow[]
  },
  async updateIf(id, was, patch) {
    let query = supabase.from(TABLE).update(patch).eq('id', id).eq('status', was.status)
    query = was.claimed_at === null ? query.is('claimed_at', null) : query.eq('claimed_at', was.claimed_at)
    const { data, error } = await query.select(COLUMNS)
    if (error) throw new Error('feedback_store_unavailable')
    return data && data.length === 1 ? data[0] as unknown as FeedbackRow : null
  },
  async get(id) {
    const { data, error } = await supabase.from(TABLE).select(COLUMNS).eq('id', id).maybeSingle()
    if (error) throw new Error('feedback_store_unavailable')
    return (data as unknown as FeedbackRow | null) ?? null
  },
}

export class DriveRefused extends Error {}

/** Ventures > Bugs & Issues by its id in the Drive map hunter keeps (krishanraja/hunter drivemap.py, key
 *  `bugs_and_issues`): found by ID, never by path, and never made here. */
export async function bugsAndIssuesId(): Promise<string | null> {
  const { data, error } = await supabase.from('system_config').select('value').eq('key', 'drive_destinations').maybeSingle()
  if (error || !data) return null
  let value: unknown = (data as { value: unknown }).value
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return null }
  }
  const id = (value as { destinations?: Record<string, unknown> } | null)?.destinations?.bugs_and_issues
  return typeof id === 'string' && id ? id : null
}

/** Drive as the owner of his Drive. The full `drive` scope, because his own folders (Bugs & Issues, the `mindmake`
 *  folder he made inside it) are not this app's, and drive.file cannot see them: with it the lane would make a second
 *  venture folder beside his. Null when that scope is not delegated, with Google's reason. */
export async function googleFeedbackDrive(onError?: (reason: string) => void): Promise<FeedbackDrive | null> {
  const token = await googleAccessToken(['https://www.googleapis.com/auth/drive'], { subject: DRIVE_OWNER(), onError })
  if (!token) return null
  const headers = { Authorization: `Bearer ${token}` }
  return {
    bugsAndIssues: bugsAndIssuesId,
    async folders(parentId) {
      const out: Array<{ id: string; name: string }> = []
      let pageToken = ''
      do {
        const params = new URLSearchParams({
          q: `'${parentId.replace(/'/g, "\\'")}' in parents and mimeType = '${FOLDER_MIME}' and trashed = false`,
          fields: 'nextPageToken, files(id,name)', pageSize: '200', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true',
          ...(pageToken ? { pageToken } : {}),
        })
        const r = await fetch(`${DRIVE}/files?${params}`, { headers })
        const j: any = await r.json().catch(() => ({}))
        if (!r.ok) throw new DriveRefused(`drive_list_${r.status}`)
        for (const f of j.files || []) out.push({ id: String(f.id), name: String(f.name) })
        pageToken = typeof j.nextPageToken === 'string' ? j.nextPageToken : ''
      } while (pageToken)
      return out
    },
    async createFolder(parentId, name) {
      const r = await fetch(`${DRIVE}/files?supportsAllDrives=true&fields=id`, {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json; charset=UTF-8' },
        body: JSON.stringify({ name, mimeType: FOLDER_MIME, parents: [parentId] }),
      })
      const j: any = await r.json().catch(() => ({}))
      if (!r.ok || typeof j?.id !== 'string') throw new DriveRefused(`drive_folder_${r.status}`)
      return j.id
    },
    async startUpload(folderId, name, mime, bytes) {
      const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,name,size', {
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
    async writeText(folderId, name, text) {
      const boundary = `fb${Date.now()}${Math.random().toString(16).slice(2)}`
      const body =
        `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, parents: [folderId], mimeType: 'text/markdown' })}\r\n` +
        `--${boundary}\r\nContent-Type: text/markdown; charset=UTF-8\r\n\r\n${text}\r\n--${boundary}--`
      const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body,
      })
      const j: any = await r.json().catch(() => ({}))
      if (!r.ok || typeof j?.id !== 'string') throw new DriveRefused(`drive_write_${r.status}`)
      return j.id
    },
  }
}

/** Krish's own inbox, through the existing alert path (a draft when gmail.send is not delegated). */
export const krishMailer: Mailer = async (subject, body) => {
  const result = await notifyKrishEmail(subject, body)
  return { sent: result.sent, via: result.via }
}
