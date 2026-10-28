import { describe, expect, it, vi } from 'vitest'
import {
  MAX_ATTEMPTS, PROMPT_FILE, RETRY_AFTER_MS, STALE_CLAIM_MS, STILLS_FOLDER, claimOne, composeEmail, composePrompt, fileUrl,
  folderName, folderUrl, parseDrive, parseReport, planDrive, report, ventureFolder,
  type FeedbackDrive, type FeedbackRow, type FeedbackStore, type Mailer, type Summary,
} from '../../apps/control-plane/api/ux-feedback/_feedback.js'

// Feedback videos Krish records on his phone, with an in-memory queue, a fake Drive and a fake mailer: only a home
// computer claims one and gets where it sits in his Drive, the outputs go to Ventures > Bugs & Issues > <venture> (his
// own venture folder when he has one, never the top of his Drive), stills into Stills, and done writes the prompt
// into the folder and sends one email naming the product's repository. Krish, 2026-10-28. Synthetic rows only.

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))

const NOW = new Date('2026-10-28T12:00:00.000Z')
const minutesAgo = (m: number) => new Date(NOW.getTime() - m * 60_000).toISOString()
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const AREA = 'bugs_ABCDEFGHIJ'
const FILE = 'file_ABCDEFGHIJKL'

function recording(n: number, over: Partial<FeedbackRow> = {}): FeedbackRow {
  return {
    id: uuid(n), name: `Checkout run ${n}.mp4`, note: 'the invented checkout', drive_file_id: `src_ABCDEFGHIJ${n}`,
    drive_path: `Ventures/Bugs & Issues/Checkout run ${n}.mp4`, mime: 'video/mp4', bytes: 1000, md5: 'a'.repeat(32),
    duration_ms: 46000, venture: 'heartside', venture_label: 'Heartside', repo: 'krishanraja/heartside', domain: 'heartside.io',
    status: 'queued', status_class: null, attempts: 0, claimed_by: null, claimed_at: null, drive_folder_id: null,
    stills_folder_id: null, feedback_file_id: null, prompt_file_id: null, requested_at: minutesAgo(30 - n), updated_at: null, ...over,
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
  }
}

function drive(opts: { area?: string | null; existing?: Array<{ id: string; name: string }> } = {}) {
  const made: string[] = []
  const sessions: string[] = []
  const written: Array<{ folder: string; name: string; text: string }> = []
  let n = 0
  const d: FeedbackDrive = {
    async bugsAndIssues() { return opts.area === undefined ? AREA : opts.area },
    async folders() { return opts.existing ?? [] },
    async createFolder(parent, name) { n += 1; made.push(`${parent}/${name}`); return `made_ABCDEFGH${n}` },
    async startUpload(folder, name) { sessions.push(`${folder}/${name}`); return `https://upload.example/${name}` },
    async writeText(folder, name, text) { written.push({ folder, name, text }); return 'prompt_ABCDEFGHIJ' },
  }
  return { d, made, sessions, written }
}

const SUMMARY: Summary = {
  duration_s: 46, stills: 11, images: 7, width: 1080, height: 2340, portrait: true,
  signals: [{ t: 5.2, signal: 'friction', term: "can't find", said: "The menu opened, but I can't find billing anywhere.", still: 2 }],
}
const held = (over: Partial<FeedbackRow> = {}) => recording(1, {
  status: 'claimed', claimed_by: 'Surface', claimed_at: minutesAgo(5), attempts: 1, ...over,
})

describe('claiming a feedback video', () => {
  it('gives the oldest queued recording to a home computer, with where it sits in his Drive and no link', async () => {
    const s = store([recording(2), recording(1)])
    const out = await claimOne(s, 'Surface', NOW)
    if (!out.ok || !out.recording) throw new Error('no claim')
    expect(out.recording.id).toBe(uuid(1))
    expect(out.recording.drive_path).toBe('Ventures/Bugs & Issues/Checkout run 1.mp4')
    expect(out.recording.md5).toBe('a'.repeat(32))
    expect(JSON.stringify(out.recording)).not.toMatch(/https?:/)
    expect([s.rows.get(uuid(1))!.status, s.rows.get(uuid(1))!.claimed_by]).toEqual(['claimed', 'Surface'])
  })

  it('refuses the cloud backup: it has no synced Drive', async () => {
    const s = store([recording(1)])
    expect(await claimOne(s, 'cloud-gh', NOW)).toEqual({ ok: false, code: 403, error: 'home_machines_only' })
  })

  it('waits after a failed try (most often a file not synced yet) before anyone takes it again', async () => {
    const s = store([recording(1, { attempts: 1, updated_at: minutesAgo(5), status_class: 'not_synced_yet' })])
    expect(await claimOne(s, 'Surface', NOW)).toEqual({ ok: true, recording: null, expired: 0 })
    const later = new Date(NOW.getTime() + RETRY_AFTER_MS)
    const out = await claimOne(s, 'Surface', later)
    expect(out.ok && out.recording?.id).toBe(uuid(1))
  })

  it('fails a stale claim on its last attempt instead of trying forever', async () => {
    const stale = new Date(NOW.getTime() - STALE_CLAIM_MS - 60_000).toISOString()
    const s = store([recording(1, { status: 'claimed', claimed_by: 'Lorimer', claimed_at: stale, attempts: MAX_ATTEMPTS })])
    expect(await claimOne(s, 'Surface', NOW)).toEqual({ ok: true, recording: null, expired: 1 })
    expect(s.rows.get(uuid(1))!.status_class).toBe('timeout')
  })
})

describe('the outputs go to Ventures > Bugs & Issues > the venture', () => {
  const ask = (files: unknown[], machine = 'Surface') => {
    const parsed = parseDrive({ id: uuid(1), machine, files })
    if (!parsed.ok) throw new Error(parsed.error)
    return parsed.value
  }
  const still = { name: 'still_001_0000500ms.jpg', mime: 'image/jpeg', bytes: 2000 }
  const feedback = { name: 'feedback.md', mime: 'text/markdown', bytes: 300 }

  it('uses his own venture folder, matched in any case, then makes the day folder and Stills once', async () => {
    const s = store([held({ venture: 'mindmake', venture_label: 'Mindmake' })])
    const { d, made, sessions } = drive({ existing: [{ id: 'his_mindmake01', name: 'mindmake' }, { id: 'other_folder1', name: 'Heartside' }] })
    const first = await planDrive(s, d, ask([still]), NOW)
    const second = await planDrive(s, d, ask([feedback]), NOW)
    expect(made).toEqual(['his_mindmake01/2026-10-28 Checkout run 1', `made_ABCDEFGH1/${STILLS_FOLDER}`])
    expect(first.ok && first.folder_url).toBe(folderUrl('made_ABCDEFGH1'))
    expect(second.ok && second.folder_id).toBe('made_ABCDEFGH1')
    expect(sessions).toEqual(['made_ABCDEFGH2/still_001_0000500ms.jpg', 'made_ABCDEFGH1/feedback.md'])
  })

  it('makes the venture folder with its label when he has none', async () => {
    const s = store([held()])
    const { d, made } = drive({ existing: [{ id: 'his_mindmake01', name: 'mindmake' }] })
    await planDrive(s, d, ask([feedback]), NOW)
    expect(made).toEqual([`${AREA}/Heartside`, 'made_ABCDEFGH1/2026-10-28 Checkout run 1'])
  })

  it('makes nothing anywhere when the Drive map has no Bugs & Issues', async () => {
    const s = store([held()])
    const { d, made } = drive({ area: null })
    expect(await planDrive(s, d, ask([still]), NOW)).toEqual({ ok: false, code: 503, error: 'no_drive_destination' })
    expect(made).toEqual([])
  })

  it('opens nothing for a machine that does not hold the claim', async () => {
    const s = store([held({ claimed_by: 'Lorimer' })])
    const { d, made } = drive()
    expect(await planDrive(s, d, ask([still]), NOW)).toEqual({ ok: false, code: 409, error: 'not_your_claim' })
    expect(made).toEqual([])
  })

  it('accepts only stills and the feedback file, never the recording, the prompt file or an unsafe name', () => {
    const files = (f: unknown) => parseDrive({ id: uuid(1), machine: 'Surface', files: [f] }).ok
    expect(files(feedback)).toBe(true)
    expect(files({ ...still, place: 'folder' })).toBe(false)
    expect(files({ name: 'run.mp4', mime: 'video/mp4', bytes: 10 })).toBe(false)
    expect(files({ name: PROMPT_FILE, mime: 'text/markdown', bytes: 10 })).toBe(false)
    expect(files({ name: '../x.jpg', mime: 'image/jpeg', bytes: 10 })).toBe(false)
  })

  it('matches a venture folder by slug or label, ignoring case and spacing', () => {
    const row = { venture: 'full_time', venture_label: 'Full Time' }
    expect(ventureFolder([{ id: 'a', name: 'FULL TIME' }], row)).toBe('a')
    expect(ventureFolder([{ id: 'b', name: 'full_time' }], row)).toBe('b')
    expect(ventureFolder([{ id: 'c', name: 'Full Time Archive' }], row)).toBeNull()
    expect(folderName({ name: 'My run: v2.mov', requested_at: '2026-10-28T09:00:00Z' })).toBe('2026-10-28 My run v2')
  })
})

describe('reporting', () => {
  const done = parseReport({ id: uuid(1), machine: 'Surface', status: 'done', feedback_file_id: FILE, summary: SUMMARY })
  if (!done.ok) throw new Error('parse')

  it('done writes the prompt into the folder and sends one email naming the product, its repository and the links', async () => {
    const s = store([held({ drive_folder_id: 'folder_ABCDEFGHIJ' })])
    const { d, written } = drive()
    const sent: Array<{ subject: string; body: string }> = []
    const mailer: Mailer = async (subject, body) => { sent.push({ subject, body }); return { sent: true, via: 'send' } }
    expect(await report(s, d, mailer, done.value, NOW)).toEqual({ ok: true, status: 'done', emailed_via: 'send', prompt_file_id: 'prompt_ABCDEFGHIJ' })
    expect(written).toHaveLength(1)
    expect([written[0].folder, written[0].name]).toEqual(['folder_ABCDEFGHIJ', PROMPT_FILE])
    const prompt = written[0].text
    expect(prompt).toContain('real-world UX feedback on Heartside (heartside.io), recorded on my phone')
    expect(prompt).toContain('Work in the krishanraja/heartside repository.')
    expect(prompt).toContain(fileUrl(FILE))
    expect(prompt).toContain(fileUrl('src_ABCDEFGHIJ1'))
    expect(prompt).toContain(`0:05 friction ("can't find"), still 02`)
    expect(sent).toHaveLength(1)
    expect(sent[0].subject).toBe('UX feedback: Heartside, Checkout run 1.mp4')
    expect(sent[0].body).toContain('Ventures > Bugs & Issues > Heartside')
    expect(sent[0].body).toContain(fileUrl('prompt_ABCDEFGHIJ'))
    expect(sent[0].body).toContain(prompt)
    const row = s.rows.get(uuid(1))! as FeedbackRow & { emailed_via?: string }
    expect([row.status, row.feedback_file_id, row.prompt_file_id, row.emailed_via]).toEqual(['done', FILE, 'prompt_ABCDEFGHIJ', 'send'])
  })

  it('a prompt file that will not write still leaves the email with the prompt, and a mailer that throws leaves it done', async () => {
    const s = store([held({ drive_folder_id: 'folder_ABCDEFGHIJ' })])
    const { d } = drive()
    d.writeText = async () => { throw new Error('drive down') }
    const mailer: Mailer = async () => { throw new Error('gmail down') }
    expect(await report(s, d, mailer, done.value, NOW)).toEqual({ ok: true, status: 'done', emailed_via: 'failed', prompt_file_id: null })
  })

  it('done without a Drive folder is refused and sends nothing', async () => {
    const s = store([held()])
    const mailer = vi.fn()
    expect(await report(s, null, mailer as unknown as Mailer, done.value, NOW)).toEqual({ ok: false, code: 409, error: 'no_drive_folder' })
    expect(mailer).not.toHaveBeenCalled()
  })

  it('a failure goes back to the queue, and stays failed on the last attempt', async () => {
    const failed = parseReport({ id: uuid(1), machine: 'Surface', status: 'failed', status_class: 'not_synced_yet' })
    if (!failed.ok) throw new Error('parse')
    const s = store([held()])
    expect(await report(s, null, vi.fn() as unknown as Mailer, failed.value, NOW)).toEqual({ ok: true, status: 'queued' })
    expect(s.rows.get(uuid(1))!.claimed_by).toBeNull()
    const last = store([held({ attempts: MAX_ATTEMPTS })])
    expect(await report(last, null, vi.fn() as unknown as Mailer, failed.value, NOW)).toEqual({ ok: true, status: 'failed' })
  })

  it('validates the summary', () => {
    const ok = (summary: unknown) => parseReport({ id: uuid(1), machine: 'Surface', status: 'done', feedback_file_id: FILE, summary }).ok
    expect(ok({ ...SUMMARY, signals: [{ ...SUMMARY.signals[0], signal: 'anger' }] })).toBe(false)
    expect(ok({ ...SUMMARY, portrait: 'yes' })).toBe(false)
    expect(ok({ ...SUMMARY, stills: -1 })).toBe(false)
    expect(ok(SUMMARY)).toBe(true)
  })

  it('a landscape recording is said to be on screen, and a product with no repository asks for none', () => {
    const prompt = composePrompt(recording(1, { repo: null, domain: null, note: null }), { ...SUMMARY, portrait: false, signals: [] },
      { folder: folderUrl('f'), feedback: fileUrl('x') })
    expect(prompt).toContain('real-world UX feedback on Heartside, recorded on screen')
    expect(prompt).not.toContain('repository')
    expect(prompt).toContain('No friction, confusion, expectation or delight words were heard')
    const { body } = composeEmail(recording(1), SUMMARY, { folder: 'F', feedback: 'X', prompt: null }, prompt)
    expect(body).not.toContain('The prompt, in the folder')
  })
})
