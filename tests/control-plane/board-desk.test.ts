import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { buildView, lockSigned, viewProblems, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { JOBS, dispatchJob, readRuns, type JobName } from '../../apps/control-plane/api/board/_run'
import { DESK_PAGE } from '../../apps/control-plane/api/board/_deskPage'

// The live board (docs/plans/2026-11-09-board-desk/PLAN.md). Krish, 2026-11-09: "I should always open it with
// something to do for each piece or for the week, unless the day or the week is complete", "Absolutely everything that
// isn't 100% complete needs an action button", and the buttons must start "what is actually running the machinery".

const WEEK = '2026-11-16'
const MON = '8287846b-6618-4a19-9fb8-23ad4eca2718', WED = 'db9f9f6a-1092-49be-8024-f335e060305a', FRI = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118'
const SIGNED = readFileSync('docs/plans/2026-11-16-week/narrative-lock-fri.md', 'utf8')
const piece = (id: string, date: string, slot: string, making: Record<string, unknown> = {}, extra: Record<string, unknown> = {}) =>
  ({ id, idea: `Piece ${id.slice(0, 4)}`, scheduled_for: date, lane_slot: slot, state: 'drafting', buried_at: null, body: '', updated_at: '2026-11-09T12:00:00Z', meta: { making }, ...extra })
const option = (id: string, extra: Record<string, unknown> = {}) => ({ id, format: 'Meme video, 9:16', copy: `Option ${id}`, ...extra })
const verdict = (day: string, id: string, side: Record<string, unknown>) => ({ doc_id: `off-${day}-${id}`, updated_by: 'Krish', body: { use: 'offday', pick: `off-${day}-${id}`, day, ...side } })
const run = (job: JobName, state: 'queued' | 'running' | 'done' | 'failed') => ({ job, workflow: JOBS[job].workflow, state, started_at: '2026-11-09T17:00:00Z', updated_at: '2026-11-09T17:05:00Z', url: `https://github.com/x/${job}`, event: 'repository_dispatch' })

function inputs(over: Partial<ViewInputs> = {}): ViewInputs {
  return {
    week: WEEK, now: new Date('2026-11-09T18:00:00Z'),
    pieces: [piece(MON, '2026-11-16', 'follow_the_money'), piece(WED, '2026-11-18', 'under_the_hood'), piece(FRI, '2026-11-20', 'mind_the_gap')],
    picks: [], queue: [], history: [], runs: {}, north_star: { current: 3, target: 8 },
    ideas: { offdays: { tue: [option('povteach'), option('infosys')], thu: [option('lookalikes')], sat: [] } },
    locks: { mon: null, wed: null, fri: SIGNED },
    ...over,
  }
}
const day = (v: ReturnType<typeof buildView>, d: string) => v.days.find(x => x.day === d)!

describe('the live board view', () => {
  it('reads a signed lock by its last line, and a template or an unsigned lock as not signed', () => {
    expect(lockSigned(SIGNED)).toBe(true)
    expect(lockSigned('# Lock\n\nSigned by Krish: "<his words>", 2026-11-09')).toBe(false)
    expect(lockSigned('# Lock\n\nSome arc')).toBe(false)
    expect(lockSigned(null)).toBe(false)
  })

  it('gives every day that is not done a next step and an action, in every state the week can be in', () => {
    const states: ViewInputs[] = [
      inputs(),
      inputs({ pieces: [], ideas: null }),
      inputs({ runs: { 'make-piece': run('make-piece', 'running'), 'offday-revise': run('offday-revise', 'failed') } }),
      inputs({ queue: [verdict('tue', 'povteach', { idea: { verdict: 'improve', words: 'Change the caption', sha256: 'a'.repeat(64) } })] }),
      inputs({ ideas: { offdays: { tue: [option('povteach', { revised: 'his words' })] } },
        queue: [verdict('tue', 'povteach', { idea: { verdict: 'improve', words: 'x', sha256: 'a'.repeat(64) } })] }),
      inputs({ queue: [verdict('thu', 'lookalikes', { idea: { verdict: 'approve', words: null, sha256: 'b'.repeat(64) } })] }),
    ]
    for (const s of states) {
      const v = buildView(s)
      expect(v.days.map(d => d.day)).toEqual(['mon', 'tue', 'wed', 'thu', 'fri', 'sat'])
      expect(viewProblems(v)).toEqual([])
      for (const d of v.days) if (d.who !== 'done') expect(d.actions.length).toBeGreaterThan(0)
    }
  })

  it('gives every next action a Claude prompt as a backup, after the machine that runs it', () => {
    const v = buildView(inputs({ queue: [verdict('tue', 'povteach', { idea: { verdict: 'improve', words: 'x', sha256: 'a'.repeat(64) } })] }))
    for (const d of v.days.filter(x => x.who !== 'done')) {
      const prompt = d.actions.find(a => a.kind === 'prompt')
      expect(prompt, d.day).toBeTruthy()
      if (!/conversation/.test(d.runs_on)) expect(prompt && prompt.kind === 'prompt' && prompt.prompt, d.day).toContain(d.next)
    }
    const fri = day(v, 'fri')
    expect(fri.actions.map(a => a.kind)).toEqual(['run', 'prompt'])
    expect(fri.actions[1].kind === 'prompt' && fri.actions[1].prompt).toContain(`making.py ${FRI} show`)
  })

  it('starts the make for a signed lock with a run, not a prompt, and shows the run while it goes', () => {
    const fri = day(buildView(inputs()), 'fri')
    expect(fri.who).toBe('you')
    expect(fri.actions[0]).toMatchObject({ kind: 'run', job: 'make-piece', input: { piece_id: FRI } })
    // The latest make-piece run may be another piece's: it is shown, and the start button stays.
    const running = day(buildView(inputs({ runs: { 'make-piece': run('make-piece', 'running') } })), 'fri')
    expect(running.run?.state).toBe('running')
    expect(running.actions[0]).toMatchObject({ kind: 'run', job: 'make-piece' })
  })

  it('keeps the prompt only for a conversation with him: a lock not yet written or signed', () => {
    const mon = day(buildView(inputs()), 'mon')
    expect(mon.actions[0].kind).toBe('prompt')
    expect(mon.runs_on).toMatch(/conversation/)
    expect(mon.actions[0].kind === 'prompt' && mon.actions[0].prompt).toContain(`piece_id: ${MON}`)
  })

  it('runs his Improve when no revision has come back, and asks him to review once it has', () => {
    const stuck = day(buildView(inputs({ queue: [verdict('tue', 'povteach', { idea: { verdict: 'improve', words: 'x', sha256: 'a'.repeat(64) } })] })), 'tue')
    expect(stuck.who).toBe('stuck')
    expect(stuck.actions[0]).toMatchObject({ kind: 'run', job: 'offday-revise', input: { week: WEEK, option: 'off-tue-povteach' } })
    const back = day(buildView(inputs({ ideas: { offdays: { tue: [option('povteach', { revised: 'his words' })] } },
      queue: [verdict('tue', 'povteach', { idea: { verdict: 'improve', words: 'x', sha256: 'a'.repeat(64) } })] })), 'tue')
    expect(back.who).toBe('you')
    expect(back.actions[0]).toMatchObject({ kind: 'review', label: 'Review the revised version' })
    expect(back.reviews?.[0]).toMatchObject({ doc_id: 'off-tue-povteach', side: 'idea', option: { id: 'povteach' } })
    expect(back.reviews?.[0].option.idea_sha256).toMatch(/^[0-9a-f]{64}$/)
  })

  it('lets Saturday start the good-news run, and lists only his and stuck days in Your move', () => {
    const v = buildView(inputs())
    expect(day(v, 'sat').actions[0]).toMatchObject({ kind: 'run', job: 'saturday-goodnews', input: { week: WEEK } })
    expect([...new Set(v.yours.map(y => y.day))].sort()).toEqual(v.days.filter(d => d.who === 'you' || d.who === 'stuck').map(d => d.day).sort())
  })

  it('opens on Week done when every day is published', () => {
    const done = { channels: Object.fromEntries(['substack', 'linkedin', 'youtube', 'instagram', 'x', 'tiktok'].map(c => [c, { posted_at: '2026-11-16T10:00:00Z' }])) }
    const v = buildView(inputs({ pieces: ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21'].map((d, k) =>
      piece(`0000000${k}-0000-4000-8000-000000000000`, d, ['follow_the_money', '', 'under_the_hood', '', 'mind_the_gap', ''][k], done, { state: 'published', meta: { offday: { date: d }, making: done } })) }))
    expect(v.days.every(d => d.who === 'done')).toBe(true)
    expect(v.yours).toEqual([])
  })
})

describe('every board button starts a real machine', () => {
  it('sends each job as a repository_dispatch named for it, with the board token, and refuses bad input', async () => {
    const sent: Array<{ url: string; body: string; auth: string }> = []
    const fetcher = async (url: string, init: { method: string; headers: Record<string, string>; body?: string }) => {
      sent.push({ url, body: init.body || '', auth: init.headers.Authorization || '' }); return { status: 204, text: async () => '' }
    }
    const env = { OFFDAY_REVISE_DISPATCH_TOKEN: 't0ken' }
    const ok = await dispatchJob('make-piece', { piece_id: FRI }, env, fetcher)
    expect(ok.sent).toBe(true)
    expect(sent[0].url).toBe('https://api.github.com/repos/krishanraja/content-engine/dispatches')
    expect(JSON.parse(sent[0].body)).toEqual({ event_type: 'make-piece', client_payload: { piece_id: FRI } })
    expect(sent[0].auth).toBe('Bearer t0ken')
    expect(await dispatchJob('make-piece', { piece_id: 'not-a-uuid' }, env, fetcher)).toMatchObject({ sent: false, reason: 'invalid_input' })
    expect(await dispatchJob('saturday-goodnews', { week: '2026-11-17' }, env, fetcher)).toMatchObject({ sent: false, reason: 'invalid_input' })
    expect(await dispatchJob('saturday-goodnews', { week: WEEK }, {}, fetcher)).toMatchObject({ sent: false, reason: 'not_configured' })
    expect(await dispatchJob('repair-round', { week: WEEK, cuts: ['wed-long', 'fri-short'] }, env, fetcher)).toMatchObject({ sent: true })
    expect(JSON.parse(sent[1].body).client_payload).toEqual({ week: WEEK, cuts: 'wed-long,fri-short' })
    expect(await dispatchJob('repair-round', { week: WEEK, cuts: ['wed-long; rm -rf'] }, env, fetcher)).toMatchObject({ sent: false, reason: 'invalid_input' })
    await dispatchJob('saturday-goodnews', { week: WEEK }, env, fetcher)
    expect(JSON.parse(sent[2].body).client_payload).toEqual({ week: WEEK, force: true })
  })

  it('reads each workflow\'s latest run as queued, running, done or failed', async () => {
    const fetcher = async (url: string) => ({ status: 200, text: async () => JSON.stringify({ workflow_runs: [
      url.includes('make-piece') ? { status: 'in_progress', conclusion: null, run_started_at: 'a', updated_at: 'b', html_url: 'u', event: 'repository_dispatch' }
        : { status: 'completed', conclusion: 'failure', run_started_at: 'a', updated_at: 'b', html_url: 'u', event: 'workflow_dispatch' }] }) })
    const runs = await readRuns({}, fetcher as never, ['make-piece', 'offday-revise'])
    expect(runs['make-piece']?.state).toBe('running')
    expect(runs['offday-revise']?.state).toBe('failed')
  })

  it('has a repository_dispatch type in every workflow the board can start, named as the job', () => {
    for (const [job, { workflow }] of Object.entries(JOBS)) {
      const text = readFileSync(`.github/workflows/${workflow}`, 'utf8')
      expect(text, workflow).toMatch(/repository_dispatch:\s*\n\s*types:\s*\[([^\]]*)\]/)
      const types = /repository_dispatch:\s*\n\s*types:\s*\[([^\]]*)\]/.exec(text)![1].split(',').map(t => t.trim())
      expect(types, workflow).toContain(job)
    }
  })

  it('serves the page built from its one source, with no data baked in', () => {
    expect(DESK_PAGE).toBe(readFileSync('apps/control-plane/board-next/desk.html', 'utf8'))
    expect(DESK_PAGE).toContain('/api/board/${week}/view')
    expect(DESK_PAGE).not.toMatch(/piece_id: [0-9a-f]{8}-/)
  })
})

describe('a press on the live board binds the same words as the full board', () => {
  it('hashes every side of every real off-day option exactly as week_board.py does', async () => {
    const { execFileSync } = await import('node:child_process')
    const { offdaySides } = await import('../../apps/control-plane/api/board/_offdaySides')
    const py = `import sys,json\nsys.path.insert(0,'scripts/post-pack')\nimport week_board as wb\nd=json.load(open(sys.argv[1]))\nr=wb.read_offdays(d['offdays'])\nprint(json.dumps({o['id']:[o.get('idea_sha256'),o.get('direction_sha256'),o['copy_sha256'],o['source']] for v in r.values() for o in v}))`
    const file = 'docs/plans/2026-11-16-week/ideas.json'
    const want = JSON.parse(execFileSync('python3', ['-c', py, file], { encoding: 'utf8' })) as Record<string, [string, string | null, string, string]>
    const ideas = JSON.parse(readFileSync(file, 'utf8'))
    let n = 0
    for (const opts of Object.values(ideas.offdays) as Array<Array<Record<string, unknown>>>) for (const o of opts) {
      const got = offdaySides(o)
      expect([got.idea_sha256, got.direction_sha256, got.copy_sha256, got.source], String(o.id)).toEqual(want[String(o.id)])
      n++
    }
    expect(n).toBeGreaterThanOrEqual(8)
  })
})

describe('a review press on the live board is a record the server takes', () => {
  it('builds Approve, Improve and Reject on a revised option exactly as the full board does, and the server validates each', async () => {
    const { offdaySides } = await import('../../apps/control-plane/api/board/_offdaySides')
    const { validBody, hisOnlyRefusal } = await import('../../apps/control-plane/api/board/_contracts')
    const ideas = JSON.parse(readFileSync('docs/plans/2026-11-16-week/ideas.json', 'utf8'))
    const o = offdaySides({ ...ideas.offdays.thu.find((x: { id: string }) => x.id === 'lookalikes'), revised: { side: 'direction', words: 'A standalone explainer.' } })
    const id = 'off-thu-lookalikes', at = '2026-11-09T19:00:00.000Z'
    const prev = { idea: { verdict: null, words: null, sha256: o.idea_sha256, at }, direction: { verdict: 'improve', words: 'x', sha256: 'd'.repeat(64), at } }
    for (const [verdict, words] of [['approve', null], ['improve', 'Shorter, please.'], ['reject', 'Not this week.']] as const) {
      const body: Record<string, unknown> = { pick: id, use: 'offday', day: 'thu', week: WEEK, option_id: o.id, format: o.format, source: o.source, copy_sha256: o.copy_sha256, at, ...prev }
      body.direction = { verdict, words, sha256: o.direction_sha256, at, ...(verdict === 'approve' ? { shown: o.direction } : {}) }
      expect(validBody('queue', id, body), verdict).toBe(true)
      expect(hisOnlyRefusal('queue', body, 'Krish')).toBeNull()
      expect(hisOnlyRefusal('queue', body, 'engine_operator')).not.toBeNull()
    }
  })
})
