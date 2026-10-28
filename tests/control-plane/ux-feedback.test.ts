import { describe, expect, it, vi } from 'vitest'
import {
  MAX_ATTEMPTS, STALE_CLAIM_MS, claimOne, composeEmail, fileUrl, folderName, folderUrl, parseDrive, parseReport, planDrive,
  report, type FeedbackDrive, type FeedbackRow, type FeedbackStore, type Mailer, type Summary,
} from '../../apps/control-plane/api/ux-feedback/_feedback.js'

// Feedback videos Krish records himself, with an in-memory queue, a fake Drive and a fake mailer: only a home computer
// claims one, only the machine holding it gets Drive sessions or reports, its folder is made once, and done sends one
// email holding a Claude Code prompt with both links. Krish, 2026-10-28. Synthetic rows only.

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))

const NOW = new Date('2026-10-28T12:00:00.000Z')
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString()
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const FOLDER = 'folder_ABCDEFGHIJ'
const FILE = 'file_ABCDEFGHIJKL'

function recording(n: number, over: Partial<FeedbackRow> = {}): FeedbackRow {
  return {
    id: uuid(n), name: `Checkout run ${n}.mp4`, note: 'the checkout in control-center', object_path: `recordings/${uuid(n)}/run.mp4`,
    mime: 'video/mp4', bytes: 1000, status: 'queued', status_class: null, attempts: 0, claimed_by: null, claimed_at: null,
    drive_folder_id: null, feedback_file_id: null, requested_at: minutesAgo(30 - n), updated_at: null, ...over,
  }
}

function store(rows: FeedbackRow[]): FeedbackStore & { rows: Map<string, FeedbackRow> } {
  const map = new Map(rows.map(r => [r.id, { ...r }]))
  return {
    rows: map,
    async claimable(staleBefore, limit) {
      return [...map.values()]
        .filter(r => r.status === 'queued' || (r.status === 'claimed' && (r.claimed_at || '') < staleBefore))
        .sort((a, b) => a.requested_at.localeCompare(b.requested_at))
        .slice(0, limit)
    },
    async updateIf(id, was, patch) {
      const row = map.get(id)
      if (!row || row.status !== was.status || row.claimed_at !== was.claimed_at) return null
      const next = { ...row, ...patch } as FeedbackRow
      map.set(id, next)
      return { ...next }
    },
    async get(id) {
      const row = map.get(id)
      return row ? { ...row } : null
    },
    async downloadUrl(path) {
      return `https://storage.example/signed/${path}?token=t`
    },
  }
}

function drive(): FeedbackDrive & { folders: string[]; sessions: string[] } {
  const made = { folders: [] as string[], sessions: [] as string[] }
  return {
    ...made,
    async parentFolder() { return 'parent_ABCDEFGHIJ' },
    async createFolder(parent, name) { made.folders.push(`${parent}/${name}`); return FOLDER },
    async startUpload(folder, name) { made.sessions.push(`${folder}/${name}`); return `https://upload.example/${name}` },
    get folders() { return made.folders },
    get sessions() { return made.sessions },
  }
}

const SUMMARY: Summary = {
  duration_s: 46, stills: 11, images: 7,
  signals: [{ t: 5.2, signal: 'friction', term: "can't find", said: "The menu opened, but I can't find billing anywhere.", still: 2 }],
}

describe('claiming a feedback video', () => {
  it('gives the oldest queued recording to a home computer, with a download link', async () => {
    const s = store([recording(2), recording(1)])
    const out = await claimOne(s, 'Surface', NOW)
    expect(out.ok && out.recording?.id).toBe(uuid(1))
    expect(out.ok && out.recording?.download_url).toContain(`recordings/${uuid(1)}/run.mp4`)
    const row = s.rows.get(uuid(1))!
    expect([row.status, row.claimed_by, row.attempts]).toEqual(['claimed', 'Surface', 1])
  })

  it('refuses the cloud backup: a feedback video is read on his own machine', async () => {
    const s = store([recording(1)])
    expect(await claimOne(s, 'cloud-gh', NOW)).toEqual({ ok: false, code: 403, error: 'home_machines_only' })
    expect(s.rows.get(uuid(1))!.status).toBe('queued')
  })

  it('never claims one still uploading, and takes back a claim gone stale', async () => {
    const stale = new Date(NOW.getTime() - STALE_CLAIM_MS - 60_000).toISOString()
    const s = store([recording(1, { status: 'uploading' }), recording(2, { status: 'claimed', claimed_by: 'Lorimer', claimed_at: stale, attempts: 1 })])
    const out = await claimOne(s, 'Surface', NOW)
    expect(out.ok && out.recording?.id).toBe(uuid(2))
    expect(s.rows.get(uuid(2))!.claimed_by).toBe('Surface')
    expect(s.rows.get(uuid(1))!.status).toBe('uploading')
  })

  it('fails a stale claim on its last attempt instead of trying forever', async () => {
    const stale = new Date(NOW.getTime() - STALE_CLAIM_MS - 60_000).toISOString()
    const s = store([recording(1, { status: 'claimed', claimed_by: 'Lorimer', claimed_at: stale, attempts: MAX_ATTEMPTS })])
    const out = await claimOne(s, 'Surface', NOW)
    expect(out).toEqual({ ok: true, recording: null, expired: 1 })
    expect(s.rows.get(uuid(1))!.status_class).toBe('timeout')
  })
})

describe('Drive for the stills and the feedback file', () => {
  const ask = (machine = 'Surface') => parseDrive({ id: uuid(1), machine, files: [{ name: 'still_001_0000500ms.jpg', mime: 'image/jpeg', bytes: 2000 }] })

  it('makes the recording its own folder once, then reuses it', async () => {
    const s = store([recording(1, { status: 'claimed', claimed_by: 'Surface', claimed_at: minutesAgo(2), attempts: 1 })])
    const d = drive()
    const parsed = ask()
    if (!parsed.ok) throw new Error('parse')
    const first = await planDrive(s, d, parsed.value, NOW)
    const second = await planDrive(s, d, parsed.value, NOW)
    expect(first).toEqual({ ok: true, folder_id: FOLDER, folder_url: folderUrl(FOLDER), uploads: [{ name: 'still_001_0000500ms.jpg', upload_url: 'https://upload.example/still_001_0000500ms.jpg' }] })
    expect(second.ok).toBe(true)
    expect(d.folders).toEqual(['parent_ABCDEFGHIJ/2026-10-28 Checkout run 1'])
    expect(s.rows.get(uuid(1))!.drive_folder_id).toBe(FOLDER)
  })

  it('opens nothing for a machine that does not hold the claim', async () => {
    const s = store([recording(1, { status: 'claimed', claimed_by: 'Lorimer', claimed_at: minutesAgo(2), attempts: 1 })])
    const d = drive()
    const parsed = ask()
    if (!parsed.ok) throw new Error('parse')
    expect(await planDrive(s, d, parsed.value, NOW)).toEqual({ ok: false, code: 409, error: 'not_your_claim' })
    expect(d.folders).toEqual([])
  })

  it('accepts only stills and the feedback file, with safe names', () => {
    const files = (f: unknown) => parseDrive({ id: uuid(1), machine: 'Surface', files: [f] })
    expect(files({ name: 'feedback.md', mime: 'text/markdown', bytes: 10 }).ok).toBe(true)
    expect(files({ name: '../x.jpg', mime: 'image/jpeg', bytes: 10 }).ok).toBe(false)
    expect(files({ name: 'x.mp4', mime: 'video/mp4', bytes: 10 }).ok).toBe(false)
    expect(files({ name: 'x.jpg', mime: 'image/jpeg', bytes: 0 }).ok).toBe(false)
  })

  it('names the folder by day and name', () => {
    expect(folderName(recording(3, { name: 'My run: v2.mov', requested_at: '2026-10-28T09:00:00Z' }))).toBe('2026-10-28 My run v2')
  })
})

describe('reporting', () => {
  const held = (over: Partial<FeedbackRow> = {}) => recording(1, {
    status: 'claimed', claimed_by: 'Surface', claimed_at: minutesAgo(5), attempts: 1, drive_folder_id: FOLDER, ...over,
  })
  const done = parseReport({ id: uuid(1), machine: 'Surface', status: 'done', feedback_file_id: FILE, summary: SUMMARY })
  if (!done.ok) throw new Error('parse')

  it('done sends one email holding the Claude Code prompt and both links', async () => {
    const s = store([held()])
    const sent: Array<{ subject: string; body: string }> = []
    const mailer: Mailer = async (subject, body) => { sent.push({ subject, body }); return { sent: true, via: 'send' } }
    expect(await report(s, mailer, done.value, NOW)).toEqual({ ok: true, status: 'done', emailed_via: 'send' })
    expect(sent).toHaveLength(1)
    expect(sent[0].subject).toBe('UX feedback ready: Checkout run 1.mp4')
    expect(sent[0].body).toContain(fileUrl(FILE))
    expect(sent[0].body).toContain(folderUrl(FOLDER))
    expect(sent[0].body).toContain('--- Claude Code prompt: copy from here ---')
    expect(sent[0].body).toContain(`0:05 friction ("can't find"), still 02`)
    expect(sent[0].body).toContain('the checkout in control-center')
    const row = s.rows.get(uuid(1))!
    expect([row.status, row.feedback_file_id, (row as any).emailed_via]).toEqual(['done', FILE, 'send'])
  })

  it('a mailer that throws still leaves the recording done, marked as not emailed', async () => {
    const s = store([held()])
    const mailer: Mailer = async () => { throw new Error('gmail down') }
    expect(await report(s, mailer, done.value, NOW)).toEqual({ ok: true, status: 'done', emailed_via: 'failed' })
  })

  it('done without a Drive folder is refused', async () => {
    const s = store([held({ drive_folder_id: null })])
    const mailer = vi.fn()
    expect(await report(s, mailer as unknown as Mailer, done.value, NOW)).toEqual({ ok: false, code: 409, error: 'no_drive_folder' })
    expect(mailer).not.toHaveBeenCalled()
  })

  it('a failure goes back to the queue, and stays failed on the last attempt', async () => {
    const failed = parseReport({ id: uuid(1), machine: 'Surface', status: 'failed', status_class: 'timeline_failed' })
    if (!failed.ok) throw new Error('parse')
    const mailer = vi.fn()
    const s = store([held()])
    expect(await report(s, mailer as unknown as Mailer, failed.value, NOW)).toEqual({ ok: true, status: 'queued' })
    expect(s.rows.get(uuid(1))!.claimed_by).toBeNull()
    const last = store([held({ attempts: MAX_ATTEMPTS })])
    expect(await report(last, mailer as unknown as Mailer, failed.value, NOW)).toEqual({ ok: true, status: 'failed' })
    expect(mailer).not.toHaveBeenCalled()
  })

  it('refuses a report from a machine that does not hold the claim', async () => {
    const s = store([held({ claimed_by: 'Lorimer' })])
    expect(await report(s, vi.fn() as unknown as Mailer, done.value, NOW)).toEqual({ ok: false, code: 409, error: 'not_your_claim' })
  })

  it('validates the summary', () => {
    const bad = (summary: unknown) => parseReport({ id: uuid(1), machine: 'Surface', status: 'done', feedback_file_id: FILE, summary }).ok
    expect(bad({ ...SUMMARY, signals: [{ ...SUMMARY.signals[0], signal: 'anger' }] })).toBe(false)
    expect(bad({ ...SUMMARY, stills: -1 })).toBe(false)
    expect(bad(SUMMARY)).toBe(true)
  })

  it('composes a prompt that works with no note and no signals', () => {
    const { body } = composeEmail(recording(1, { note: null }), { ...SUMMARY, signals: [] }, FOLDER, FILE)
    expect(body).toContain('the product in this recording')
    expect(body).toContain('No friction, confusion, expectation or delight words were heard')
  })
})
