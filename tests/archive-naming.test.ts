import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ARCHIVE_COPY_MAX,
  ARCHIVE_FOLDER_MAX,
  ARCHIVE_PLACE_FOR_PLATFORM,
  ARCHIVE_PLACES,
  ARCHIVE_TIME_ZONE,
  archiveFileName,
  archiveFolder,
  archiveJob,
  archiveLocalDate,
  hashFile,
  nextArchiveFolder,
  type ArchivePackageInput,
} from '@mindmake/core'

// The one rule both archivers follow. scripts/quick-edit/archive.py reads the
// same file in its --self-test, so the TypeScript and the Python cannot drift.
interface Cases {
  time_zone: string
  folder_max: number
  copy_max: number
  places: string[]
  studio_platforms: Record<string, string>
  quick_edit: { tall: string[]; tall_with_tiktok: string[]; wide: string[] }
  folders: Array<{ why: string; date: string; subject: string; places: string[]; copy?: number; folder?: string; subject_used?: string; error?: string }>
  files: Array<{ why: string; subject: string; shape: 'tall' | 'wide'; places: string[]; file?: string; error?: string }>
  existing: Array<{ why: string; date: string; subject: string; places: string[]; existing: string[]; folder: string }>
  dates: Array<{ why: string; instant: string; date: string }>
}
const cases = JSON.parse(readFileSync('config/archive-naming.cases.json', 'utf8')) as Cases

describe('the archive naming rule, from the shared cases', () => {
  it('keeps the same constants as the cases', () => {
    expect(ARCHIVE_PLACES).toEqual(cases.places)
    expect(ARCHIVE_FOLDER_MAX).toBe(cases.folder_max)
    expect(ARCHIVE_COPY_MAX).toBe(cases.copy_max)
    expect(ARCHIVE_TIME_ZONE).toBe(cases.time_zone)
    expect(ARCHIVE_PLACE_FOR_PLATFORM).toEqual(cases.studio_platforms)
  })

  it.each(cases.folders.map((item) => [item.why, item] as const))('folder: %s', (_why, item) => {
    const input = { date: item.date, subject: item.subject, places: item.places, ...(item.copy === undefined ? {} : { copy: item.copy }) }
    if (item.error) {
      expect(() => archiveFolder(input)).toThrow(item.error)
      return
    }
    const folder = archiveFolder(input)
    expect(folder.name).toBe(item.folder)
    expect(folder.subject).toBe(item.subject_used)
    expect(Array.from(folder.name).length).toBeLessThanOrEqual(cases.folder_max)
  })

  it.each(cases.files.map((item) => [item.why, item] as const))('file: %s', (_why, item) => {
    const input = { subject: item.subject, shape: item.shape, places: item.places }
    if (item.error) expect(() => archiveFileName(input)).toThrow(item.error)
    else expect(archiveFileName(input)).toBe(item.file)
  })

  it.each(cases.existing.map((item) => [item.why, item] as const))('already exists: %s', (_why, item) => {
    expect(nextArchiveFolder({ date: item.date, subject: item.subject, places: item.places }, item.existing).name).toBe(item.folder)
  })

  it.each(cases.dates.map((item) => [item.why, item] as const))('date: %s', (_why, item) => {
    expect(archiveLocalDate(new Date(item.instant))).toBe(item.date)
  })
})

describe('archiveJob', () => {
  const roots: string[] = []
  const prior = { runtime: process.env.MINDMAKE_RUNTIME_ROOT, archive: process.env.MINDMAKE_ARCHIVE_ROOT, drive: process.env.MINDMAKE_DRIVE_ROOT }

  afterEach(async () => {
    for (const [key, value] of [['MINDMAKE_RUNTIME_ROOT', prior.runtime], ['MINDMAKE_ARCHIVE_ROOT', prior.archive], ['MINDMAKE_DRIVE_ROOT', prior.drive]] as const) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  async function fixtureJob(): Promise<{ jobId: string; jobRoot: string; archiveRoot: string; packages: ArchivePackageInput[] }> {
    const root = await mkdtemp(join(tmpdir(), 'mindmake-archive-'))
    roots.push(root)
    process.env.MINDMAKE_RUNTIME_ROOT = join(root, 'runtime')
    process.env.MINDMAKE_ARCHIVE_ROOT = join(root, 'Archive')
    const jobId = 'job-archive-naming'
    const jobRoot = join(root, 'runtime', 'jobs', jobId)
    await mkdir(jobRoot, { recursive: true })
    await writeFile(join(jobRoot, 'job.json'), '{"job_id":"job-archive-naming"}\n', 'utf8')
    const packages: ArchivePackageInput[] = []
    // TikTok and Reels share one exact master, so they share one file.
    const masters = { youtube_shorts: 'shorts master', linkedin: 'linkedin master', tiktok: 'vertical master', instagram_reels: 'vertical master' } as const
    for (const [platform, body] of Object.entries(masters) as Array<[keyof typeof masters, string]>) {
      const dir = join(jobRoot, 'packages', 'v2', platform, 'a'.repeat(64))
      await mkdir(dir, { recursive: true })
      const master = join(dir, 'master.mp4')
      await writeFile(master, body, 'utf8')
      await writeFile(join(dir, 'cover.jpg'), 'cover', 'utf8')
      await writeFile(join(dir, 'captions.srt'), 'captions', 'utf8')
      packages.push({
        platform,
        master_path: master,
        master_hash: await hashFile(master),
        titles: [`${platform} title`, `${platform} backup`],
        description: `${platform} description`,
        post_copy: platform === 'youtube_shorts' ? '' : `${platform} post`,
        ...(platform === 'youtube_shorts' ? { pinned_comment: 'What would you test first?' } : {}),
        cover_path: join(dir, 'cover.jpg'),
        captions_path: join(dir, 'captions.srt'),
      })
    }
    return { jobId, jobRoot, archiveRoot: join(root, 'Archive'), packages }
  }

  it('files the approved package under the date, the subject and where to post it, and never overwrites', async () => {
    const { jobId, jobRoot, archiveRoot, packages } = await fixtureJob()
    const input = { subject: 'Who picks your AI?', subject_from: 'production_brief' as const, packages, package_artifact_hash: 'f'.repeat(64), now: new Date('2026-10-05T23:30:00Z') }
    const first = await archiveJob(jobId, input)
    const folder = '2026-10-06 Who picks your AI (post to Shorts, Reels, TikTok, LinkedIn)'
    expect(first).toMatchObject({ folder, archive_path: join(archiveRoot, folder), subject: 'Who picks your AI', date: '2026-10-06', date_from: 'archive_day', post_to: ['Shorts', 'Reels', 'TikTok', 'LinkedIn'] })
    expect(first.files.map((item) => [item.file, item.platforms])).toEqual([
      ['Who picks your AI - tall 9x16 - Shorts.mp4', ['youtube_shorts']],
      ['Who picks your AI - tall 9x16 - Reels, TikTok.mp4', ['instagram_reels', 'tiktok']],
      ['Who picks your AI - tall 9x16 - LinkedIn.mp4', ['linkedin']],
    ])
    expect((await readdir(first.archive_path)).sort()).toEqual([
      'Who picks your AI - tall 9x16 - LinkedIn.mp4',
      'Who picks your AI - tall 9x16 - Reels, TikTok.mp4',
      'Who picks your AI - tall 9x16 - Shorts.mp4',
      'job',
      'job.txt',
      'where-to-post.txt',
    ])
    expect(await readFile(join(first.archive_path, 'Who picks your AI - tall 9x16 - Reels, TikTok.mp4'), 'utf8')).toBe('vertical master')
    expect(await readFile(join(first.archive_path, 'job', 'job.json'), 'utf8')).toBe('{"job_id":"job-archive-naming"}\n')

    // The job id is kept in job.txt beside the videos; the folder name leaves it out.
    const jobText = await readFile(join(first.archive_path, 'job.txt'), 'utf8')
    expect(jobText).toContain(`Studio job: ${jobId}`)
    expect(jobText).toContain(`Approved package: ${'f'.repeat(64)}`)
    expect(jobText).toContain('Subject: Who picks your AI? (from the approved title of the production brief bound to the job)')
    expect(first.folder).not.toContain(jobId)

    const where = await readFile(join(first.archive_path, 'where-to-post.txt'), 'utf8')
    expect(where.startsWith('Who picks your AI?\nDate: 2026-10-06 (the day it was archived, London time)\nPost to: Shorts, Reels, TikTok, LinkedIn\n')).toBe(true)
    expect(where).toContain('- Who picks your AI - tall 9x16 - Reels, TikTok.mp4\n  Post to Reels (Instagram Reels), TikTok.')
    expect(where).toContain('SHORTS (YOUTUBE SHORTS)\nVideo: Who picks your AI - tall 9x16 - Shorts.mp4\nTitle: youtube_shorts title\nOther titles:\n- youtube_shorts backup\nDescription:\nyoutube_shorts description\nPinned comment: What would you test first?')
    expect(where).toContain(`LINKEDIN\nVideo: Who picks your AI - tall 9x16 - LinkedIn.mp4\nTitle: linkedin title`)
    expect(where).toContain(`Cover: ${join('job', 'packages', 'v2', 'linkedin', 'a'.repeat(64), 'cover.jpg')}`)
    expect(where.indexOf('SHORTS (YOUTUBE SHORTS)')).toBeLessThan(where.indexOf('REELS (INSTAGRAM REELS)'))
    expect(where.indexOf('TIKTOK')).toBeLessThan(where.indexOf('LINKEDIN\n'))
    expect(where).not.toContain('\u2014')

    // A second archive of the same job lands beside the first, which is untouched.
    const before = await stat(join(first.archive_path, 'job.txt'))
    const second = await archiveJob(jobId, input)
    expect(second.folder).toBe(`${folder} (2)`)
    expect((await stat(join(first.archive_path, 'job.txt'))).mtimeMs).toBe(before.mtimeMs)
    expect(await readFile(join(first.archive_path, 'job.txt'), 'utf8')).toBe(jobText)
    expect((await readdir(archiveRoot)).sort()).toEqual([folder, `${folder} (2)`])
    // The job folder itself is never moved or changed.
    expect(await readFile(join(jobRoot, 'job.json'), 'utf8')).toBe('{"job_id":"job-archive-naming"}\n')
  })

  it('uses the publish date when it is known, and refuses a date that is not one', async () => {
    const { jobId, packages } = await fixtureJob()
    const archived = await archiveJob(jobId, { subject: 'Who gets paid', subject_from: 'package_title', publish_date: '2026-10-12', packages: packages.slice(0, 1), now: new Date('2026-10-05T12:00:00Z') })
    expect(archived).toMatchObject({ folder: '2026-10-12 Who gets paid (post to Shorts)', date_from: 'publish_date' })
    expect(await readFile(join(archived.archive_path, 'job.txt'), 'utf8')).toContain('(from the approved package\'s first title, because no production brief is bound to the job)')
    await expect(archiveJob(jobId, { subject: 'Who gets paid', subject_from: 'package_title', publish_date: '12/10/2026', packages })).rejects.toThrow('is not a date in the form YYYY-MM-DD')
  })

  it('refuses a master that does not match its approved hash, and an archive with no root', async () => {
    const { jobId, packages } = await fixtureJob()
    await expect(archiveJob(jobId, { subject: 'Who gets paid', subject_from: 'package_title', packages: [{ ...packages[0]!, master_hash: '0'.repeat(64) }] })).rejects.toThrow('does not match the approved master')
    // An archive folder that cannot be made says so plainly. A regular file
    // in the path makes mkdir fail on every platform.
    const blocker = join(await mkdtemp(join(tmpdir(), 'archive-blocked-')), 'not-a-folder')
    await writeFile(blocker, 'x')
    process.env.MINDMAKE_ARCHIVE_ROOT = join(blocker, 'Archive')
    await expect(archiveJob(jobId, { subject: 'Who gets paid', subject_from: 'package_title', packages })).rejects.toThrow('is not reachable')
    // Off Windows an unset archive is refused; on Windows it defaults inside
    // Google Drive (config/studio.json), so it is never unset there.
    delete process.env.MINDMAKE_ARCHIVE_ROOT
    delete process.env.MINDMAKE_DRIVE_ROOT
    if (process.platform !== 'win32') {
      await expect(archiveJob(jobId, { subject: 'Who gets paid', subject_from: 'package_title', packages })).rejects.toThrow('MINDMAKE_ARCHIVE_ROOT is not configured')
    }
  })
})
