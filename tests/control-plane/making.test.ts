import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makingSteps, mergeMaking, parseMakingPatch } from '../../apps/control-plane/api/_making.js'

// The making record on content_ideas.meta.making: where a piece is between
// the workroom and every channel, written by Claude Code sessions and by
// Krish, read by Control Center over its realtime subscription. Krish,
// 2026-10-10: "it's crucial that everything is fresh and synchronised in
// real time".

type Row = Record<string, any>
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, writes: [] as Array<[string, string, Row]> }))

vi.mock('../../apps/control-plane/api/_supabase.js', () => {
  function query(table: string) {
    const rows = () => db.tables[table] || (db.tables[table] = [])
    const filters: Array<(r: Row) => boolean> = []
    let op: 'select' | 'update' = 'select'
    let payload: Row = {}
    const run = () => {
      const hit = rows().filter(r => filters.every(f => f(r)))
      if (op === 'update') { hit.forEach(r => Object.assign(r, payload)); db.writes.push([table, 'update', payload]); return { data: hit, error: null } }
      return { data: hit, error: null }
    }
    const chain: Record<string, any> = {
      select() { return chain },
      update(patch: Row) { op = 'update'; payload = patch; return chain },
      eq(k: string, v: unknown) { filters.push(r => r[k] === v); return chain },
      async maybeSingle() { const r = run(); return { data: r.data[0] ?? null, error: null } },
      then(resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) { try { return Promise.resolve(run()).then(resolve, reject) } catch (e) { return reject(e) } },
    }
    return chain
  }
  return { supabase: { from: (t: string) => query(t) } }
})

const TOKEN = 'eot_' + 'w'.repeat(40)
const CODE = 'making-test-access-code'
const COOKIE = `cc_access=${createHash('sha256').update(CODE).digest('hex')}`
const ID = '904658db-4df2-4537-a0ed-ebe93e081db7'

async function call(method: 'GET' | 'POST', body: Row = {}, who: 'agent' | 'krish' | 'nobody' = 'agent', id = ID) {
  const { default: handler } = await import('../../apps/control-plane/api/content-ideas/[id]/making.js')
  const headers: Record<string, string> = who === 'agent' ? { authorization: `Bearer ${TOKEN}` } : who === 'krish' ? { cookie: COOKIE } : {}
  const out = { status: 0, body: undefined as any }
  const res: Record<string, any> = {
    setHeader() { return res },
    status(code: number) { out.status = code; return res },
    json(b: unknown) { out.body = b; if (!out.status) out.status = 200; return res },
    end() { return res },
  }
  await handler({ method, headers, query: { id }, body } as never, res as never)
  return out
}

beforeEach(() => {
  process.env.ENGINE_OPERATOR_TOKEN = TOKEN
  process.env.ACCESS_CODE = CODE
  db.tables = { content_ideas: [{ id: ID, idea: 'Why are there suddenly so many AIs?', state: 'review', meta: { fact_check: { passed: true, ran_at: '2026-10-10T01:00:00Z' } }, updated_at: '2026-10-10T00:00:00Z' }] }
  db.writes = []
})

describe('the making record', () => {
  it('refuses anyone without the cookie or the engine key', async () => {
    expect((await call('GET', {}, 'nobody')).status).toBe(401)
  })

  it('a fresh piece shows every step, with the workroom up next', async () => {
    const out = await call('GET')
    expect(out.status).toBe(200)
    expect(out.body.making).toBeNull()
    expect(out.body.steps.map((s: Row) => [s.key, s.state])).toEqual([
      ['workroom', 'now'], ['draft', 'done'], ['visual_gate', 'todo'], ['scripts', 'todo'], ['pack', 'todo'], ['record', 'todo'], ['video', 'todo'], ['publish', 'todo'],
    ])
  })

  it('a Claude Code session records the workroom, the gate and the pack; each lands on meta.making', async () => {
    const one = await call('POST', { workroom: 'https://claude.ai/artifact/MmaKvtHTHUYbSY9JEiCBAn', visual_gate: { passed: true, problems: [] } })
    expect(one.status).toBe(200)
    expect(one.body.making.workroom.url).toBe('https://claude.ai/artifact/MmaKvtHTHUYbSY9JEiCBAn')
    expect(one.body.making.by).toBe('Claude Code')
    expect(db.writes[0][2].meta.fact_check).toBeTruthy()
    expect(db.writes[0][2].meta.making.visual_gate.passed).toBe(true)
    const two = await call('POST', { pack: { folder: '2026-10-09 Fri mind.the.gap - Why so many AIs', files: 14 } })
    expect(two.body.making.workroom).toBeTruthy()
    expect(two.body.steps.find((s: Row) => s.key === 'pack')).toMatchObject({ state: 'now', label: 'Pack built' })
    const three = await call('POST', { pack: { folder: '2026-10-09 Fri mind.the.gap - Why so many AIs', files: 14, sent_at: '2026-10-10T02:00:00Z' } })
    expect(three.body.steps.find((s: Row) => s.key === 'pack')).toMatchObject({ state: 'done', label: 'Pack in Drive' })
    expect(three.body.steps.find((s: Row) => s.key === 'scripts').state).toBe('now')
  })

  it('a failed gate is shown as failed with its first problem', async () => {
    const out = await call('POST', { visual_gate: { passed: false, problems: ['the cover shows none of the companies the piece names'] } })
    expect(out.body.steps.find((s: Row) => s.key === 'visual_gate')).toMatchObject({ state: 'failed', note: 'the cover shows none of the companies the piece names' })
  })

  it('recordings and video assets merge by path; the record step waits for both cuts', async () => {
    await call('POST', { script_check: { passed: true, problems: [], cuts: ['long', 'short'] } })
    const one = await call('POST', { recordings: [{ cut: 'long', path: 'recordings/long.mp4', seconds: 412 }] })
    expect(one.body.steps.find((s: Row) => s.key === 'record')).toMatchObject({ state: 'now', note: 'short cut still to record' })
    const two = await call('POST', { recordings: [{ cut: 'short', path: 'recordings/short.mp4' }, { cut: 'long', path: 'recordings/long.mp4', seconds: 415 }] })
    expect(two.body.making.recordings).toHaveLength(2)
    expect(two.body.making.recordings.find((r: Row) => r.cut === 'long').seconds).toBe(415)
    expect(two.body.steps.find((s: Row) => s.key === 'record').state).toBe('done')
    const three = await call('POST', { video_assets: [{ cut: 'long', name: 'Substack video', path: '3 Video/long.mp4', url: 'https://drive.google.com/x' }] })
    expect(three.body.steps.find((s: Row) => s.key === 'video')).toMatchObject({ state: 'now', note: 'short cut still to produce' })
    const four = await call('POST', { video_assets: [{ cut: 'short', name: 'Shorts video', path: '3 Video/short.mp4' }] })
    expect(four.body.steps.find((s: Row) => s.key === 'video')).toMatchObject({ state: 'done', note: '2 files' })
  })

  it('a script check that recorded one cut still needs both recordings (TWO_CUTS)', async () => {
    await call('POST', { script_check: { passed: true, problems: [], cuts: ['long'] } })
    const one = await call('POST', { recordings: [{ cut: 'long', path: 'recordings/long.mp4' }] })
    expect(one.body.steps.find((s: Row) => s.key === 'record')).toMatchObject({ state: 'now', note: 'short cut still to record' })
  })

  it('Krish ticks channels off from his cookie; a null clears one; an unknown channel is refused', async () => {
    const one = await call('POST', { channels: { substack: { url: 'https://makeyourmindup.substack.com/p/why-so-many-ais' }, youtube: {} } }, 'krish')
    expect(one.status).toBe(200)
    expect(one.body.making.by).toBe('Krish')
    expect(one.body.steps.find((s: Row) => s.key === 'publish')).toMatchObject({ state: 'now', note: '2 of 5 channels' })
    const two = await call('POST', { channels: { youtube: null } }, 'krish')
    expect(Object.keys(two.body.making.channels)).toEqual(['substack'])
    const bad = await call('POST', { channels: { myspace: {} } })
    expect(bad.status).toBe(400)
    expect(bad.body.problems[0]).toMatch(/unknown channel "myspace"/)
  })

  it('a bad link, an empty patch and a missing piece are refused with reasons', async () => {
    expect((await call('POST', { workroom: 'http://plain' })).body.problems).toEqual(['workroom needs an https url'])
    expect((await call('POST', { nothing: 1 })).body.error).toBe('empty_patch')
    expect((await call('GET', {}, 'agent', '00000000-0000-4000-8000-000000000000')).status).toBe(404)
    expect(db.writes).toHaveLength(0)
  })
})

describe('the pure helpers', () => {
  it('parseMakingPatch drops unknown keys and names what is wrong', () => {
    const { patch, problems } = parseMakingPatch({ session: { url: 'https://claude.ai/code/session_1', by: 'Claude Code' }, pack: { files: 3 }, extra: true }, '2026-10-10T00:00:00Z')
    expect(patch.session).toMatchObject({ url: 'https://claude.ai/code/session_1', by: 'Claude Code', started_at: '2026-10-10T00:00:00Z' })
    expect(problems).toEqual(['pack needs {folder, files}'])
    expect('extra' in patch).toBe(false)
  })

  it('mergeMaking keeps what the patch does not mention', () => {
    const prev = mergeMaking(null, { workroom: { url: 'https://a', at: '2026-10-10T00:00:00Z' } }, 'Claude Code', '2026-10-10T00:00:00Z')
    const next = mergeMaking(prev, { publish_manager: { url: 'https://b', at: '2026-10-10T00:01:00Z' } }, 'Claude Code', '2026-10-10T00:01:00Z')
    expect(next.workroom?.url).toBe('https://a')
    expect(next.publish_manager?.url).toBe('https://b')
    expect(next.updated_at).toBe('2026-10-10T00:01:00Z')
  })

  it('every step names its owner: Claude makes, Krish records and posts, Codex produces the video', () => {
    const steps = makingSteps({ state: 'drafting', meta: {} })
    expect(Object.fromEntries(steps.map(s => [s.key, s.owner]))).toEqual({
      workroom: 'Claude', draft: 'Claude', visual_gate: 'Claude', scripts: 'Claude', pack: 'Claude', record: 'Krish', video: 'Codex', publish: 'Krish',
    })
  })

  it('a published piece with every channel is done', () => {
    const channels = Object.fromEntries(['substack', 'youtube', 'shorts', 'tiktok', 'reels', 'linkedin'].map(c => [c, { posted_at: '2026-10-10T03:00:00Z' }]))
    const steps = makingSteps({ state: 'published', meta: { fact_check: { status: 'passed' }, making: { channels, updated_at: 'x', by: 'Krish' } } })
    expect(steps.find(s => s.key === 'publish')).toMatchObject({ state: 'done', note: '5 of 5 channels' })
  })

  it('the Substack post alone (state published) leaves the publish step open until the reposts are ticked', () => {
    const substack = { substack: { url: 'https://home.makeyourmindup.ai/p/x', posted_at: '2026-10-16T13:00:00Z' } }
    const one = makingSteps({ state: 'published', meta: { making: { channels: substack, updated_at: 'x', by: 'publish watcher' } } })
    expect(one.find(s => s.key === 'publish')).toMatchObject({ state: 'now', note: 'Substack is out; 1 of 5 channels' })
    const three = makingSteps({ state: 'published', meta: { making: { channels: { ...substack, youtube: { posted_at: 'x' }, shorts: { posted_at: 'x' } }, updated_at: 'x', by: 'Krish' } } })
    expect(three.find(s => s.key === 'publish')).toMatchObject({ state: 'now', note: 'Substack is out; 3 of 5 channels' })
    // Published by any route counts as Substack's tick, and only Substack's.
    const bare = makingSteps({ state: 'published', meta: { making: { channels: { youtube: { posted_at: 'x' }, shorts: { posted_at: 'x' }, tiktok: { posted_at: 'x' }, reels: { posted_at: 'x' } }, updated_at: 'x', by: 'Krish' } } })
    expect(bare.find(s => s.key === 'publish')).toMatchObject({ state: 'done', note: '5 of 5 channels' })
  })

  it('the standing five close the publish step; LinkedIn and WhatsApp never stand in for TikTok', () => {
    const five = Object.fromEntries(['substack', 'youtube', 'shorts', 'tiktok', 'reels'].map(c => [c, { posted_at: 'x' }]))
    expect(makingSteps({ state: 'approved', meta: { making: { channels: five, updated_at: 'x', by: 'Krish' } } }).find(s => s.key === 'publish')?.state).toBe('done')
    const { tiktok: _t, ...four } = five
    expect(makingSteps({ state: 'approved', meta: { making: { channels: { ...four, linkedin: { posted_at: 'x' }, whatsapp: { posted_at: 'x' } }, updated_at: 'x', by: 'Krish' } } }).find(s => s.key === 'publish')?.state).toBe('now')
  })
})
