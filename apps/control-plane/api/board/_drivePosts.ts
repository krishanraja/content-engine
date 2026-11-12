import { createHash } from 'node:crypto'
import { DRIVE_READONLY_SCOPE, googleAccessToken } from '../_google.js'

// Everything made for a week's posts, read from Krish's Drive (Ruling, Krish, 2026-11-12: every cut on the board carries
// its Google Drive link; and "I should always be able to link the assets in Google Drive as well as see them if I am to
// approve them"). Each post has its own folder in `makeyourmindup > 3 Posts` (docs/DRIVE.md, "One filing home for
// finished assets: 3 Posts"), named by its date first: the engine's cuts and thumbnails, Growth's carousels, memes,
// Notes, off-day posts and their reskins all land there. So the board reads them where they are, by the folder's ID,
// as the folder's owner (GOOGLE_DRIVE_OWNER, read only), and lists each post of each day with every asset in it: its
// kind, its Drive file, the slides of a carousel in order, and the older versions of each, newest first.
//
// It reads and never writes Drive. A file it lists can be seen on the board through GET /api/board/<Monday>/drive/<id>,
// which copies that one file into the engine's own store the first time and answers with a short signed link
// (servedDrive below): Drive's own links need his Google login, which a player on the board does not carry.

/** `makeyourmindup > 3 Posts`, by its ID (docs/DRIVE.md, the first table). */
export const POSTS_FOLDER_ID = '17KdbFrZXKmGXkCaMpmntRD9rrAhnWkcT'
const FOLDER = 'application/vnd.google-apps.folder'
/** A Drive file id: what Drive's own links carry. */
export const DRIVE_ID = /^[A-Za-z0-9_-]{20,80}$/
/** A post's folder: its date first, then the day, the series and its title ("2026-11-12 Thu off.day - AI broke Git"). */
const POST_NAME = /^(\d{4}-\d{2}-\d{2}) /
/** Sub-folders that hold work in progress, never a finished asset. */
const WORKING = /^(working|rejected|old|archive|scratch|_)/i

export interface DriveFile {
  id: string; name: string; mimeType: string; parents?: string[]; size?: string; md5Checksum?: string
  modifiedTime?: string; createdTime?: string
  videoMediaMetadata?: { durationMillis?: string; width?: number; height?: number }
  imageMediaMetadata?: { width?: number; height?: number }
}
export const DRIVE_FIELDS = 'id,name,mimeType,parents,size,md5Checksum,modifiedTime,createdTime,videoMediaMetadata(durationMillis,width,height),imageMediaMetadata(width,height)'

/** One Drive query, every page: the files a `q` finds, with DRIVE_FIELDS. Throws when Drive cannot be read. */
export type DriveLister = (q: string) => Promise<DriveFile[]>

/** The link Drive opens a file at, where he can play it or download it. */
export const driveFileUrl = (id: string) => `https://drive.google.com/file/d/${id}/view`
export const driveFolderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`

/** The Drive file id in a Drive file link (the making record's `url`, a cut's or a thumbnail's), or null. */
export function driveIdOf(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const m = /^https:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([A-Za-z0-9_-]{20,80})/.exec(url.trim())
  return m ? m[1] : null
}
/** The Drive folder id in a Drive folder link (an off-day option's `drive`), or null. */
export function driveFolderIdOf(url: unknown): string | null {
  if (typeof url !== 'string') return null
  const m = /^https:\/\/drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([A-Za-z0-9_-]{20,80})/.exec(url.trim())
  return m ? m[1] : null
}

export type AssetKind = 'cut' | 'video' | 'meme' | 'carousel' | 'image' | 'cover' | 'figure' | 'thumbnail' | 'note'
/** One file of an asset: a version, or a slide of a carousel. */
export interface AssetFile {
  id: string; title: string; mime: string; at: string | null; url: string
  seconds?: number; width?: number; height?: number
}
/** One asset of a post: its newest version, the slides of a carousel in order, and its older versions, newest first. */
export interface PostAsset extends AssetFile {
  kind: AssetKind
  /** The sub-folder of the post it is in ("4 Social", "3 Video"), or "" for the post's own folder. */
  folder: string
  /** A carousel: every slide, in order, each the newest version of that slide. */
  slides?: AssetFile[]
  /** The older versions, newest first (a carousel: the older files of its slides). */
  versions: AssetFile[]
}
/** A post's folder and what is in it. */
export interface DrivePost { id: string; name: string; url: string; date: string; assets: PostAsset[] }

const time = (f: DriveFile) => f.modifiedTime || f.createdTime || ''
const newest = (a: DriveFile, b: DriveFile) => time(b).localeCompare(time(a))
const classOf = (mime: string) => (mime.startsWith('video/') ? 'video' : mime.startsWith('image/') ? 'image' : mime === 'text/plain' ? 'text' : null)
const stem = (name: string) => name.replace(/\.[A-Za-z0-9]{1,5}$/, '')

/** A file's name with its version marks taken out, so two versions of one asset read the same: "table-for-two-meme"
 *  and "table-for-two-meme-black-v2" are one meme; "... tall 9x16 - black v2" is the newer "... tall 9x16 - Shorts". */
export function versionKey(name: string): string {
  return stem(name).toLowerCase().replace(/\(\d+\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(v\d+|version \d+|black|white|dark|light|final|new|old|reskin|reskinned|copy|edited|updated|fixed)\b/g, ' ')
    .replace(/\s+/g, ' ').trim()
}
/** Whether two keys name one asset: the same, or one is the other followed by more words. */
const sameAsset = (a: string, b: string) => a === b || (a.length > 0 && b.length > 0 && (a.startsWith(`${b} `) || b.startsWith(`${a} `)))

/** A carousel slide: "git-card-3.png", "slide 2.png", "homework_card_5-black.png". */
const SLIDE = /^(.*?)[-_ ]?(?:card|slide)[-_ ]?(\d{1,2})(?:[-_ .].*)?$/i

function fileOf(f: DriveFile): AssetFile {
  const secs = Number(f.videoMediaMetadata?.durationMillis) / 1000
  const w = f.videoMediaMetadata?.width ?? f.imageMediaMetadata?.width, h = f.videoMediaMetadata?.height ?? f.imageMediaMetadata?.height
  return {
    id: f.id, title: f.name, mime: f.mimeType, at: time(f) || null, url: driveFileUrl(f.id),
    ...(Number.isFinite(secs) && secs > 0 ? { seconds: Math.round(secs) } : {}),
    ...(typeof w === 'number' && w > 0 ? { width: w } : {}), ...(typeof h === 'number' && h > 0 ? { height: h } : {}),
  }
}

/** What an asset is, by where it is, its type and its name. */
export function kindOf(folder: string, f: DriveFile): AssetKind {
  const n = f.name.toLowerCase(), c = classOf(f.mimeType)
  if (c === 'text') return 'note'
  if (c === 'image' && /thumbnail/.test(n)) return 'thumbnail'
  if (/meme/.test(n)) return 'meme'
  if (c === 'video') return /^3 video/i.test(folder) ? 'cut' : 'video'
  if (/^2 covers/i.test(folder)) return /^figure/.test(n) ? 'figure' : 'cover'
  return 'image'
}
const RANK: Record<AssetKind, number> = { cut: 0, video: 1, meme: 2, carousel: 3, image: 4, cover: 5, figure: 6, thumbnail: 7, note: 8 }

/** Every asset of one post from the files in it (each with the sub-folder it is in): a carousel's slides together, in
 *  order, and each asset's versions together, newest first. Files that are not a picture, a video or a plain-text note
 *  (an article page, a script, a manifest) are left to Drive. Pure. */
export function assetsOf(files: Array<{ folder: string; file: DriveFile }>): PostAsset[] {
  const out: PostAsset[] = []
  const shown = files.filter(x => classOf(x.file.mimeType) !== null)
  // Carousels: slides of one stem in one folder, by number; the newest of each number is the slide, the rest its versions.
  const decks = new Map<string, Array<{ n: number; folder: string; file: DriveFile }>>()
  const rest: Array<{ folder: string; file: DriveFile }> = []
  for (const x of shown) {
    const m = classOf(x.file.mimeType) === 'image' ? SLIDE.exec(stem(x.file.name)) : null
    if (m) {
      const key = `${x.folder}\u0000${versionKey(m[1] || 'card')}`
      decks.set(key, [...(decks.get(key) || []), { n: Number(m[2]), folder: x.folder, file: x.file }])
    } else rest.push(x)
  }
  for (const slides of decks.values()) {
    if (slides.length < 2 && slides.every(s => s.n === 1)) { rest.push(...slides); continue }
    const byN = new Map<number, DriveFile[]>()
    for (const s of slides) byN.set(s.n, [...(byN.get(s.n) || []), s.file])
    const order = [...byN.keys()].sort((a, b) => a - b)
    const first = order.map(n => byN.get(n)!.sort(newest)[0])
    const older = order.flatMap(n => byN.get(n)!.slice(1)).sort(newest)
    const lead = first[0]
    const at = [...first].sort(newest)[0]
    out.push({ ...fileOf(lead), at: time(at) || null, kind: 'carousel', folder: slides[0].folder, title: `${first.length} slides`,
      slides: first.map(fileOf), versions: older.map(fileOf) })
  }
  // Every other file: one asset per version group (same folder, same type, the same name less its version marks).
  const groups: Array<{ folder: string; cls: string; key: string; files: DriveFile[] }> = []
  for (const x of rest.sort((a, b) => versionKey(a.file.name).length - versionKey(b.file.name).length)) {
    const cls = classOf(x.file.mimeType)!, key = versionKey(x.file.name)
    const g = groups.find(y => y.folder === x.folder && y.cls === cls && sameAsset(y.key, key))
    if (g) g.files.push(x.file)
    else groups.push({ folder: x.folder, cls, key, files: [x.file] })
  }
  for (const g of groups) {
    const [lead, ...older] = g.files.sort(newest)
    out.push({ ...fileOf(lead), kind: kindOf(g.folder, lead), folder: g.folder, versions: older.map(fileOf) })
  }
  return out.sort((a, b) => RANK[a.kind] - RANK[b.kind] || String(b.at || '').localeCompare(String(a.at || '')) || a.title.localeCompare(b.title))
}

const lit = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))
const ymd = (week: string, plus: number) => { const d = new Date(`${week}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + plus); return d.toISOString().slice(0, 10) }

/** Every post folder of the week (Monday to Sunday) in 3 Posts, with every asset in it and in its sub-folders. Three
 *  kinds of Drive query, each by parent IDs: the week's post folders, what is in them, what is in their sub-folders. */
export async function readWeekPosts(list: DriveLister, week: string): Promise<DrivePost[]> {
  const dates = Array.from({ length: 7 }, (_, i) => ymd(week, i))
  const folders = (await list(`${lit(POSTS_FOLDER_ID)} in parents and trashed = false and mimeType = ${lit(FOLDER)} and (${dates.map(d => `name contains ${lit(d)}`).join(' or ')})`))
    .filter(f => f.mimeType === FOLDER && dates.includes(POST_NAME.exec(f.name)?.[1] || ''))
  if (!folders.length) return []
  const inside = async (parents: string[]) => (await Promise.all(chunks(parents, 20).map(ids => list(`(${ids.map(id => `${lit(id)} in parents`).join(' or ')}) and trashed = false`)))).flat()
  const top = await inside(folders.map(f => f.id))
  const subs = top.filter(f => f.mimeType === FOLDER && !WORKING.test(f.name))
  const deep = subs.length ? await inside(subs.map(f => f.id)) : []
  return folders.sort((a, b) => a.name.localeCompare(b.name)).map(p => {
    const mine = subs.filter(s => s.parents?.includes(p.id))
    const files = [
      ...top.filter(f => f.mimeType !== FOLDER && f.parents?.includes(p.id)).map(file => ({ folder: '', file })),
      ...mine.flatMap(s => deep.filter(f => f.mimeType !== FOLDER && f.parents?.includes(s.id)).map(file => ({ folder: s.name, file }))),
    ]
    return { id: p.id, name: p.name, url: driveFolderUrl(p.id), date: POST_NAME.exec(p.name)![1], assets: assetsOf(files) }
  })
}

/** Every Drive file id a week's posts show (each asset, its slides and its versions): what the drive route may serve. */
export function filesOfPosts(posts: DrivePost[]): Map<string, AssetFile> {
  const out = new Map<string, AssetFile>()
  for (const p of posts) for (const a of p.assets) for (const f of [a, ...(a.slides || []), ...a.versions]) out.set(f.id, { id: f.id, title: f.title, mime: f.mime, at: f.at, url: f.url })
  return out
}

// ── Reading Drive, as the folder's owner ────────────────────────────────────

/** A lister over Drive's API with an access token (read only), every page of a query. */
export function driveLister(token: string, f: typeof fetch = fetch): DriveLister {
  return async (q: string) => {
    const out: DriveFile[] = []
    let pageToken = ''
    for (let page = 0; page < 10; page++) {
      const params = new URLSearchParams({ q, fields: `nextPageToken,files(${DRIVE_FIELDS})`, pageSize: '1000', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' })
      if (pageToken) params.set('pageToken', pageToken)
      const r = await f(`https://www.googleapis.com/drive/v3/files?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!r.ok) throw new Error(`drive_list_${r.status}`)
      const j = await r.json() as { files?: DriveFile[]; nextPageToken?: string }
      out.push(...(Array.isArray(j.files) ? j.files : []))
      pageToken = typeof j.nextPageToken === 'string' ? j.nextPageToken : ''
      if (!pageToken) break
    }
    return out
  }
}

const CACHE_MS = 60_000
const cache = new Map<string, { at: number; posts: DrivePost[] }>()
/** For tests. */
export function resetDrivePostsCache(): void { cache.clear() }

/** The week's posts from Drive, kept for a minute so the live board's reads do not each ask Drive again; null when
 *  Drive cannot be read (no token, or Drive refused), and the view then says it could not read Drive. */
export async function weekPosts(week: string, token: () => Promise<string | null>, now = Date.now(), f: typeof fetch = fetch): Promise<DrivePost[] | null> {
  const hit = cache.get(week)
  if (hit && now - hit.at < CACHE_MS) return hit.posts
  const t = await token().catch(() => null)
  if (!t) return null
  try {
    const posts = await readWeekPosts(driveLister(t, f), week)
    cache.set(week, { at: now, posts })
    return posts
  } catch { return null }
}

// ── Serving one Drive file on the board ─────────────────────────────────────

/** The store the board's copies of Drive files live in, and how long a link to one lasts. */
const BUCKET = 'content-library'
const PREFIX = 'board-drive'
const TTL = 600
/** What one serve may spend copying (the board route's maxDuration is 300 seconds). */
const COPY_BUDGET_MS = 240_000

/** The narrow store the serve needs: list a prefix, sign a key, and a signed upload URL for a key. */
export interface DriveStore {
  exists(key: string): Promise<boolean>
  sign(key: string, ttl: number): Promise<string | null>
  uploadUrl(key: string): Promise<string | null>
}
/** Copies one Drive file to an upload URL, answering the upload's status. */
export type DriveCopier = (fileId: string, uploadUrl: string, contentType: string, bytes: number, timeoutMs: number) => Promise<{ status: number }>

/** Where the board keeps its copy of one Drive file: by its id and its version (Drive's md5, or its modified time and
 *  size), so a file replaced in Drive is copied again and an unchanged one never is. */
export function copyKey(f: Pick<DriveFile, 'id' | 'name' | 'md5Checksum' | 'modifiedTime' | 'size'>): string {
  const ver = /^[a-f0-9]{32}$/.test(f.md5Checksum || '') ? f.md5Checksum! : createHash('sha256').update(`${f.modifiedTime || ''}|${f.size || ''}`).digest('hex').slice(0, 32)
  const ext = (/\.([A-Za-z0-9]{1,5})$/.exec(f.name)?.[1] || 'bin').toLowerCase()
  return `${PREFIX}/${f.id}-${ver.slice(0, 16)}.${ext}`
}

/** A short signed link to the board's copy of one Drive file, copying it from Drive first when the store has none. Null
 *  when it cannot be copied (too large for one press, refused). */
export async function servedDrive(store: DriveStore, copy: DriveCopier, f: DriveFile): Promise<string | null> {
  const key = copyKey(f)
  if (!(await store.exists(key))) {
    const bytes = Number(f.size)
    if (!Number.isSafeInteger(bytes) || bytes < 1) return null
    const url = await store.uploadUrl(key)
    if (!url) return null
    const sent = await copy(f.id, url, f.mimeType || 'application/octet-stream', bytes, COPY_BUDGET_MS)
    if (sent.status < 200 || sent.status >= 300) return null
  }
  return store.sign(key, TTL)
}

/** The store, over the engine's Supabase client. */
export function supabaseDriveStore(db: { storage: { from(b: string): any } }): DriveStore {
  const bucket = () => db.storage.from(BUCKET)
  return {
    async exists(key) {
      const [dir, name] = [key.slice(0, key.lastIndexOf('/')), key.slice(key.lastIndexOf('/') + 1)]
      const r = await bucket().list(dir, { search: name, limit: 5 })
      if (r.error) throw new Error('board_store_unavailable')
      return (r.data || []).some((o: { name?: string }) => o.name === name)
    },
    async sign(key, ttl) {
      const r = await bucket().createSignedUrl(key, ttl)
      return r.error || !r.data?.signedUrl ? null : r.data.signedUrl
    },
    async uploadUrl(key) {
      const r = await bucket().createSignedUploadUrl(key, { upsert: true })
      return r.error || !r.data?.signedUrl ? null : r.data.signedUrl
    },
  }
}

/** One Drive file's fields by its id, read as the folder's owner; null when Drive has none (or it is in the bin). */
export async function driveFile(token: string, id: string, f: typeof fetch = fetch): Promise<DriveFile | null> {
  const r = await f(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(id)}?fields=${encodeURIComponent(`${DRIVE_FIELDS},trashed`)}&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}` } })
  if (r.status === 404) return null
  if (!r.ok) throw new Error(`drive_file_${r.status}`)
  const j = await r.json() as DriveFile & { trashed?: boolean }
  return j && typeof j.id === 'string' && !j.trashed ? j : null
}

/** A read-only Drive token as the owner of his Drive (GOOGLE_DRIVE_OWNER), as the research library and the Heartside
 *  library read it; null when the engine cannot sign in to Google. */
export function ownerDriveToken(env: Record<string, string | undefined> = process.env): Promise<string | null> {
  return googleAccessToken([DRIVE_READONLY_SCOPE], { subject: env.GOOGLE_DRIVE_OWNER || 'krish@mindmake.co' })
}

/** The board's Drive, as the folder's owner (read only): one file's serve, by its Drive id. Built per request by the
 *  board's handler; a test passes its own. */
export interface BoardDrive {
  /** The week's posts (cached a minute), or null when Drive cannot be read. */
  posts(week: string): Promise<DrivePost[] | null>
  /** A short signed link to the board's copy of one Drive file, or null (not in Drive, a folder, or not copied). */
  serve(fileId: string): Promise<string | null>
}

export function boardDrive(db: { storage: { from(b: string): any } }, opts: { token?: () => Promise<string | null>; fetch?: typeof fetch; copy?: DriveCopier } = {}): BoardDrive {
  const token = opts.token ?? (() => ownerDriveToken())
  const f = opts.fetch ?? fetch
  return {
    posts: (week) => weekPosts(week, token, Date.now(), f),
    async serve(fileId) {
      if (!DRIVE_ID.test(fileId)) return null
      const t = await token().catch(() => null)
      if (!t) return null
      const file = await driveFile(t, fileId, f)
      if (!file || file.mimeType === FOLDER) return null
      // The Inbox's streaming copy (library/_inboxDrive.ts), loaded only here: the library module reads the store's
      // settings when it loads, which a view read never needs.
      const copy: DriveCopier = opts.copy ?? (async (id, url, type, bytes, ms) => (await import('../library/_inboxDrive.js')).copyDriveFile(id, url, type, bytes, ms, t))
      return servedDrive(supabaseDriveStore(db), copy, file)
    },
  }
}
