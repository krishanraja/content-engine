import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
import { POSTS_FOLDER_ID, assetsOf, copyKey, driveFolderIdOf, driveIdOf, filesOfPosts, readWeekPosts, servedDrive, versionKey, weekPosts, resetDrivePostsCache,
  type BoardDrive, type DriveFile, type DriveStore } from '../../apps/control-plane/api/board/_drivePosts'
import { NO_DRIVE_LINK, dayMedia, libraryPaths, signMedia } from '../../apps/control-plane/api/board/_media'

// Everything made for a week's posts, from their folders in Drive (Ruling, Krish, 2026-11-12: every cut on the board
// carries its Google Drive link; "I should always be able to link the assets in Google Drive as well as see them if I am
// to approve them"). The names below are the real files of the week of 9 Nov 2026 (ids made up).

type Body = Record<string, any>
const FOLDER = 'application/vnd.google-apps.folder'
const f = (id: string, name: string, mimeType: string, modifiedTime: string, parents: string[] = [], extra: Partial<DriveFile> = {}): DriveFile =>
  ({ id, name, mimeType, modifiedTime, parents, size: '1000', ...extra })
const id = (s: string) => `1${s.padEnd(24, 'x')}`

describe('a post\'s assets', () => {
  it('reads a reskin as the newer version of the same meme, and a black v2 video as the newer version of its cut', () => {
    expect(versionKey('table-for-two-meme-black-v2.png')).toBe(versionKey('table-for-two-meme.png'))
    const wed = assetsOf([
      { folder: '4 Social', file: f(id('old'), 'table-for-two-meme.png', 'image/png', '2026-11-11T08:24:00Z') },
      { folder: '4 Social', file: f(id('new'), 'table-for-two-meme-black-v2.png', 'image/png', '2026-11-12T00:51:24Z') },
      { folder: '4 Social', file: f(id('txt'), 'post-description.txt', 'text/plain', '2026-11-11T08:23:59Z') },
    ])
    expect(wed.map(a => [a.kind, a.title, a.versions.map(v => v.title)])).toEqual([
      ['meme', 'table-for-two-meme-black-v2.png', ['table-for-two-meme.png']], ['note', 'post-description.txt', []]])
    expect(wed[0]!.url).toBe(`https://drive.google.com/file/d/${id('new')}/view`)
    const thu = assetsOf([
      { folder: '', file: f(id('v1'), 'AI agent not set up - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4', 'video/mp4', '2026-11-11T12:18:16Z', [], { videoMediaMetadata: { durationMillis: '19000' } }) },
      { folder: '', file: f(id('v2'), 'AI agent not set up - tall 9x16 - black v2.mp4', 'video/mp4', '2026-11-12T00:51:26Z') },
    ])
    expect(thu.map(a => [a.kind, a.title, a.versions.map(v => v.title)])).toEqual([
      ['video', 'AI agent not set up - tall 9x16 - black v2.mp4', ['AI agent not set up - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4']]])
    expect(thu[0]!.versions[0]!.seconds).toBe(19)
  })

  it('pages a carousel\'s slides in order, the newest of each slide first and the older kept', () => {
    const git = assetsOf([5, 3, 1, 4, 2].flatMap(n => [
      { folder: '4 Social', file: f(id(`n${n}`), `git-card-${n}.png`, 'image/png', '2026-11-04T07:00:00Z') },
      { folder: '4 Social', file: f(id(`o${n}`), `git-card-${n}.png`, 'image/png', '2026-11-03T07:00:00Z') },
    ]))
    expect(git).toHaveLength(1)
    expect(git[0]!.kind).toBe('carousel')
    expect(git[0]!.slides!.map(s => s.id)).toEqual([1, 2, 3, 4, 5].map(n => id(`n${n}`)))
    expect(git[0]!.versions).toHaveLength(5)
    expect(git[0]!.id).toBe(id('n1'))
    // A card marked superseded is an older version of its slide, never a carousel of its own (Thu 12 Nov's git post).
    const kept = assetsOf([1, 2, 3, 4, 5].map(n => ({ folder: '4 Social', file: f(id(`g${n}`), `git-card-${n}.png`, 'image/png', '2026-11-11T07:00:00Z') }))
      .concat([{ folder: '4 Social', file: f(id('old5'), 'SUPERSEDED_git-card-5-v1.png', 'image/png', '2026-11-10T07:00:00Z') }]))
    expect(kept.map(a => [a.kind, a.slides!.length, a.versions.map(v => v.title)])).toEqual([['carousel', 5, ['SUPERSEDED_git-card-5-v1.png']]])
    expect(versionKey('SUPERSEDED_fri13-cover-9x16-neon.png')).toBe(versionKey('fri13-cover-9x16-neon-v2.png'))
  })

  it('keeps a series post\'s files apart: the wide and the tall cut, each thumbnail, each cover, and skips pages and scripts', () => {
    const fri = assetsOf([
      { folder: '3 Video', file: f(id('long'), 'fri13-5min-v3.mp4', 'video/mp4', '2026-11-11T10:06:01Z') },
      { folder: '3 Video', file: f(id('short'), 'fri13-counting-rat-tails-90s-9x16.mp4', 'video/mp4', '2026-11-11T07:59:43Z') },
      { folder: '3 Video', file: f(id('tw'), 'Counting rat tails - wide 16x9 - thumbnail.jpg', 'image/jpeg', '2026-11-11T11:04:59Z') },
      { folder: '3 Video', file: f(id('tt'), 'Counting rat tails - tall 9x16 - thumbnail.jpg', 'image/jpeg', '2026-11-11T11:04:58Z') },
      { folder: '3 Video', file: f(id('script'), 'video-script-5-minute.md', 'text/markdown', '2026-11-11T11:05:00Z') },
      { folder: '2 Covers and images', file: f(id('sq'), 'square-1080x1080.png', 'image/png', '2026-11-11T11:00:00Z') },
      { folder: '2 Covers and images', file: f(id('fig'), 'figure-tails.png', 'image/png', '2026-11-11T11:00:00Z') },
      { folder: '2 Covers and images', file: f(id('share'), 'share-card-1200x675.png', 'image/png', '2026-11-11T11:00:00Z') },
      { folder: '0 Publish', file: f(id('html'), 'publish.html', 'text/html', '2026-11-11T11:00:00Z') },
    ])
    expect(fri.map(a => [a.kind, a.title])).toEqual([
      ['cut', 'fri13-5min-v3.mp4'], ['cut', 'fri13-counting-rat-tails-90s-9x16.mp4'],
      ['cover', 'share-card-1200x675.png'], ['cover', 'square-1080x1080.png'], ['figure', 'figure-tails.png'],
      ['thumbnail', 'Counting rat tails - wide 16x9 - thumbnail.jpg'], ['thumbnail', 'Counting rat tails - tall 9x16 - thumbnail.jpg']])
    expect(fri.every(a => a.versions.length === 0)).toBe(true)
  })

  it('reads the Drive links of a making record and of an option', () => {
    expect(driveIdOf('https://drive.google.com/file/d/1atdOZVwtSTdR5gnl5juP6_9U-ecCeeFe/view?usp=drivesdk')).toBe('1atdOZVwtSTdR5gnl5juP6_9U-ecCeeFe')
    expect(driveIdOf('https://example.org/file/d/1atdOZVwtSTdR5gnl5juP6_9U-ecCeeFe/view')).toBeNull()
    expect(driveFolderIdOf('https://drive.google.com/drive/folders/1UU2FiU2HAvUuuEbJ2GM7nqzm76rZg9GJ')).toBe('1UU2FiU2HAvUuuEbJ2GM7nqzm76rZg9GJ')
    expect(driveFolderIdOf(null)).toBeNull()
  })
})

/** Drive as the week of 9 Nov 2026 had it: Wednesday's Table for two, Thursday's two off-day posts, and a folder of
 *  another week that must not be read. */
function drive() {
  const files: DriveFile[] = [
    f(id('wedpost'), '2026-11-11 Wed off.day - Table for two', FOLDER, '2026-11-11T08:23:59Z', [POSTS_FOLDER_ID]),
    f(id('thupost'), '2026-11-12 Thu off.day - AI agent not set up', FOLDER, '2026-11-11T08:24:02Z', [POSTS_FOLDER_ID]),
    f(id('gitpost'), '2026-11-12 Thu off.day - AI broke Git', FOLDER, '2026-11-04T06:57:03Z', [POSTS_FOLDER_ID]),
    f(id('nextpost'), '2026-11-17 Tue off.day - Proactive AI', FOLDER, '2026-11-11T11:25:54Z', [POSTS_FOLDER_ID]),
    f(id('wedsocial'), '4 Social', FOLDER, '2026-11-11T08:23:59Z', [id('wedpost')]),
    f(id('thusocial'), '4 Social', FOLDER, '2026-11-11T08:24:02Z', [id('thupost')]),
    f(id('thuwork'), 'working - source', FOLDER, '2026-11-11T11:45:46Z', [id('thupost')]),
    f(id('gitsocial'), '4 Social', FOLDER, '2026-11-04T06:57:03Z', [id('gitpost')]),
    f(id('meme'), 'table-for-two-meme.png', 'image/png', '2026-11-11T08:24:00Z', [id('wedsocial')]),
    f(id('memev2'), 'table-for-two-meme-black-v2.png', 'image/png', '2026-11-12T00:51:24Z', [id('wedsocial')]),
    f(id('vid'), 'AI agent not set up - tall 9x16 - Shorts, Reels, TikTok, LinkedIn.mp4', 'video/mp4', '2026-11-11T12:18:16Z', [id('thupost')]),
    f(id('vidv2'), 'AI agent not set up - tall 9x16 - black v2.mp4', 'video/mp4', '2026-11-12T00:51:26Z', [id('thupost')]),
    f(id('src'), 'geek-original.mp4', 'video/mp4', '2026-11-11T11:45:46Z', [id('thuwork')]),
    f(id('desc'), 'post-description.txt', 'text/plain', '2026-11-11T08:24:02Z', [id('thusocial')]),
    ...[1, 2, 3, 4, 5].map(n => f(id(`git${n}`), `git-card-${n}.png`, 'image/png', '2026-11-04T07:00:00Z', [id('gitsocial')])),
  ]
  const queries: string[] = []
  const list = async (q: string) => {
    queries.push(q)
    const parents = [...q.matchAll(/'([^']+)' in parents/g)].map(m => m[1])
    const folderOnly = q.includes(`mimeType = '${FOLDER}'`)
    return files.filter(x => x.parents!.some(p => parents.includes(p)) && (!folderOnly || x.mimeType === FOLDER))
  }
  return { files, list, queries }
}

describe('the week\'s posts from Drive', () => {
  it('reads every post folder of the week by its date, what is in it and in its sub-folders, and nothing of another week', async () => {
    const d = drive()
    const posts = await readWeekPosts(d.list, '2026-11-09')
    expect(posts.map(p => [p.date, p.name, p.url])).toEqual([
      ['2026-11-11', '2026-11-11 Wed off.day - Table for two', `https://drive.google.com/drive/folders/${id('wedpost')}`],
      ['2026-11-12', '2026-11-12 Thu off.day - AI agent not set up', `https://drive.google.com/drive/folders/${id('thupost')}`],
      ['2026-11-12', '2026-11-12 Thu off.day - AI broke Git', `https://drive.google.com/drive/folders/${id('gitpost')}`]])
    const [wed, thu, git] = posts
    expect(wed!.assets.map(a => [a.kind, a.id, a.versions.map(v => v.id)])).toEqual([['meme', id('memev2'), [id('meme')]]])
    expect(thu!.assets.map(a => [a.kind, a.id, a.folder])).toEqual([['video', id('vidv2'), ''], ['note', id('desc'), '4 Social']])
    // A working folder's source clip is never an asset.
    expect(thu!.assets.flatMap(a => [a.id, ...a.versions.map(v => v.id)])).not.toContain(id('src'))
    expect(git!.assets[0]!.slides!.map(s => s.title)).toEqual([1, 2, 3, 4, 5].map(n => `git-card-${n}.png`))
    expect(d.queries).toHaveLength(3)
    // What the drive route may serve: every asset, slide and version, and nothing else.
    const served = filesOfPosts(posts)
    expect(served.has(id('meme'))).toBe(true)
    expect(served.has(id('git3'))).toBe(true)
    expect(served.has(id('src'))).toBe(false)
  })

  it('keeps the week a minute, and answers null when Drive cannot be read', async () => {
    resetDrivePostsCache()
    expect(await weekPosts('2026-11-09', async () => null)).toBeNull()
    const fetcher = vi.fn(async () => ({ ok: false, status: 403, json: async () => ({}) }))
    expect(await weekPosts('2026-11-09', async () => 'token', 0, fetcher as never)).toBeNull()
    const ok = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ files: [] }) }))
    expect(await weekPosts('2026-11-09', async () => 'token', 1000, ok as never)).toEqual([])
    expect(await weekPosts('2026-11-09', async () => 'token', 30_000, ok as never)).toEqual([])
    expect(ok).toHaveBeenCalledTimes(1)
    resetDrivePostsCache()
  })
})

describe('serving one Drive file on the board', () => {
  const file: DriveFile = { id: id('vidv2'), name: 'AI agent not set up - tall 9x16 - black v2.mp4', mimeType: 'video/mp4', size: '1220389', md5Checksum: 'a'.repeat(32), modifiedTime: '2026-11-12T00:51:26Z' }
  const fakeStore = (has: string[] = []) => {
    const calls: string[] = []
    const store: DriveStore = {
      async exists(key) { calls.push(`exists:${key}`); return has.includes(key) },
      async sign(key, ttl) { calls.push(`sign:${key}:${ttl}`); return `https://store.example/${key}?t=${ttl}` },
      async uploadUrl(key) { calls.push(`upload:${key}`); return `https://store.example/upload/${key}` },
    }
    return { store, calls }
  }

  it('copies a file the store does not hold once, then signs it; a held copy is signed without asking Drive', async () => {
    const key = copyKey(file)
    expect(key).toBe(`board-drive/${id('vidv2')}-${'a'.repeat(16)}.mp4`)
    const first = fakeStore()
    const copy = vi.fn(async () => ({ status: 200 }))
    expect(await servedDrive(first.store, copy, file)).toBe(`https://store.example/${key}?t=600`)
    expect(copy).toHaveBeenCalledWith(id('vidv2'), `https://store.example/upload/${key}`, 'video/mp4', 1220389, expect.any(Number))
    const again = fakeStore([key])
    const none = vi.fn(async () => ({ status: 200 }))
    expect(await servedDrive(again.store, none, file)).toBe(`https://store.example/${key}?t=600`)
    expect(none).not.toHaveBeenCalled()
  })

  it('answers nothing when the copy is refused', async () => {
    expect(await servedDrive(fakeStore().store, async () => ({ status: 400 }), file)).toBeNull()
    expect(await servedDrive(fakeStore().store, async () => ({ status: 200 }), { ...file, size: undefined })).toBeNull()
  })
})

describe('the media route: a cut the library lacks plays from Drive (Friday 13 Nov)', () => {
  const FRI_PIECE = { id: 'f3fcd5e1-573e-4692-a413-db7c5823a10e', scheduled_for: '2026-11-13', meta: { making: {
    pack: { folder: '2026-11-13 Fri mind.the.gap - Counting rat tails' },
    video_assets: [{ cut: 'long', name: 'YouTube and Substack video, 5 minutes', path: '3 Video/fri13-5min-v3.mp4', at: '2026-11-11T11:26:39.381Z', seconds: 327,
      url: 'https://drive.google.com/file/d/1atdOZVwtSTdR5gnl5juP6_9U-ecCeeFe/view',
      thumbnail: { path: '2 Covers and images/fri13-thumbnail-16x9-neon.jpg', url: 'https://drive.google.com/file/d/1VgpEJ5nyzv4fOJUZ7ayWsAh-MUoInyGP/view' } },
    { cut: 'short', name: 'Shorts', path: '3 Video/no-drive.mp4', at: '2026-11-11T11:26:41Z' }] } } }
  const LONG = createHash('sha256').update('path:3 Video/fri13-5min-v3.mp4').digest('hex')

  it('carries each file\'s Drive link, or says why it has none', () => {
    const media = dayMedia(FRI_PIECE)
    expect(media.map(m => [m.kind, m.cut, m.drive?.url ?? m.drive_why])).toEqual([
      ['cut', 'short', NO_DRIVE_LINK],
      ['cut', 'long', 'https://drive.google.com/file/d/1atdOZVwtSTdR5gnl5juP6_9U-ecCeeFe/view'],
      ['thumbnail', 'long', 'https://drive.google.com/file/d/1VgpEJ5nyzv4fOJUZ7ayWsAh-MUoInyGP/view']])
    expect(NO_DRIVE_LINK).toMatch(/^Not in Drive yet: /)
  })

  it('looks for a relative path inside the post\'s own library folder, then serves the Drive copy', async () => {
    expect(libraryPaths({ path: '3 Video/fri13-5min-v3.mp4', folder: '2026-11-13 Fri mind.the.gap - Counting rat tails' }))
      .toEqual(['3 Posts/2026-11-13 Fri mind.the.gap - Counting rat tails/3 Video/fri13-5min-v3.mp4', '3 Video/fri13-5min-v3.mp4'])
    expect(libraryPaths({ path: '3 Posts/x/3 Video/a.mp4', folder: 'x' })).toEqual(['3 Posts/x/3 Video/a.mp4'])
    const asked: string[] = []
    const q = (table: string) => {
      const o: Body = {}
      for (const k of ['select', 'gte', 'lte', 'order', 'limit']) o[k] = () => o
      o.eq = (col: string, v: string) => { if (col === 'path') asked.push(v); return o }
      o.then = (resolve: (v: unknown) => void) => resolve(table === 'content_ideas' ? { error: null, data: [FRI_PIECE] } : { error: null, data: [] })
      return o
    }
    const db = { from: q, storage: { from: () => ({ createSignedUrl: async () => ({ error: null, data: { signedUrl: 'x' } }) }) } }
    const served: string[] = []
    const url = await signMedia(db as never, '2026-11-09', '2026-11-15', LONG, async fileId => { served.push(fileId); return `https://store.example/board-drive/${fileId}` })
    expect(asked).toEqual(['3 Posts/2026-11-13 Fri mind.the.gap - Counting rat tails/3 Video/fri13-5min-v3.mp4', '3 Video/fri13-5min-v3.mp4'])
    expect(served).toEqual(['1atdOZVwtSTdR5gnl5juP6_9U-ecCeeFe'])
    expect(url).toBe('https://store.example/board-drive/1atdOZVwtSTdR5gnl5juP6_9U-ecCeeFe')
    // Without a Drive serve (or a Drive link), a file the library lacks is still not found.
    expect(await signMedia(db as never, '2026-11-09', '2026-11-15', LONG)).toBeNull()
  })
})

describe('GET /api/board/<Monday>/drive/<id>', () => {
  const previous = { ...process.env }
  afterEach(() => { if (previous.ACCESS_CODE === undefined) delete process.env.ACCESS_CODE; else process.env.ACCESS_CODE = previous.ACCESS_CODE })

  async function get(fileId: string, d: Partial<BoardDrive> = {}, cookie = true) {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    const posts = await readWeekPosts(drive().list, '2026-11-09')
    const served: string[] = []
    const fake: BoardDrive = { posts: async () => posts, serve: async x => { served.push(x); return `https://store.example/${x}` }, ...d }
    const handler = createBoardHandler(async () => ({}) as never, { drive: () => fake })
    const headers = cookie ? { cookie: `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`, origin: 'https://controlcenter.krishraja.com' } : {}
    let status = 0; let out: Body = {}; let location = ''
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(v: Body) { out = v }, redirect(code: number, url: string) { status = code; location = url } } as unknown as VercelResponse
    await handler({ method: 'GET', headers, query: { week: '2026-11-09', op: 'drive', id: fileId } } as unknown as VercelRequest, res)
    return { status, out, location, served }
  }

  it('serves a file the week\'s posts list, as a short signed link', async () => {
    const r = await get(id('memev2'))
    expect([r.status, r.location, r.served]).toEqual([302, `https://store.example/${id('memev2')}`, [id('memev2')]])
    expect((await get(id('git4'))).status).toBe(302)
  })

  it('refuses a file the week does not list, a working file, a bad id, an unread Drive, and a reader without the board\'s login', async () => {
    expect((await get(id('src'))).out).toEqual({ ok: false, error: 'drive_file_not_found' })
    expect((await get('not an id')).status).toBe(404)
    expect((await get(id('meme'), { posts: async () => null })).out).toEqual({ ok: false, error: 'drive_unavailable' })
    expect((await get(id('meme'), {}, false)).status).toBe(401)
  })
})
