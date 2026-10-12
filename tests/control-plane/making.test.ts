import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makingStamp, makingSteps, mergeMaking, parseMakingPatch, takeCounts } from '../../apps/control-plane/api/_making.js'

// The making record on content_ideas.meta.making: where a piece is between
// the workroom and every channel, written by Claude Code sessions and by
// Krish, read by Control Center over its realtime subscription. Krish,
// 2026-10-10: "it's crucial that everything is fresh and synchronised in
// real time".

type Row = Record<string, any>
// beforeUpdate runs once, just before the next update is applied: a stand-in
// for another write landing between the route's read and its write.
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, writes: [] as Array<[string, string, Row]>, beforeUpdate: null as null | (() => void) }))

vi.mock('../../apps/control-plane/api/_supabase.js', () => {
  function query(table: string) {
    const rows = () => db.tables[table] || (db.tables[table] = [])
    const filters: Array<(r: Row) => boolean> = []
    let op: 'select' | 'update' = 'select'
    let payload: Row = {}
    const run = () => {
      if (op === 'update' && db.beforeUpdate) { const race = db.beforeUpdate; db.beforeUpdate = null; race() }
      const hit = rows().filter(r => filters.every(f => f(r)))
      if (op === 'update') { hit.forEach(r => Object.assign(r, payload)); if (hit.length) db.writes.push([table, 'update', payload]); return { data: hit, error: null } }
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
  db.beforeUpdate = null
})

const SHA = (c: string) => c.repeat(64)

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
    const three = await call('POST', { video_assets: [{ cut: 'long', name: 'Substack video', path: '3 Video/long.mp4', url: 'https://drive.google.com/x', thumbnail: { path: '3 Video/long thumbnail.jpg' } }] })
    expect(three.body.steps.find((s: Row) => s.key === 'video')).toMatchObject({ state: 'now', note: 'short cut still to produce' })
    const four = await call('POST', { video_assets: [{ cut: 'short', name: 'Shorts video', path: '3 Video/short.mp4', thumbnail: { path: '3 Video/short thumbnail.jpg' } }] })
    expect(four.body.steps.find((s: Row) => s.key === 'video')).toMatchObject({ state: 'done', note: '2 files' })
  })

  it('a cut is made only with its thumbnail: both videos without one leave the step open (Krish, 2026-10-12)', async () => {
    await call('POST', { recordings: [{ cut: 'long', path: 'recordings/a.mp4' }, { cut: 'short', path: 'recordings/b.mp4' }] })
    const bare = await call('POST', { video_assets: [{ cut: 'long', name: 'Substack video', path: '3 Video/long.mp4' }, { cut: 'short', name: 'Shorts video', path: '3 Video/short.mp4' }] })
    expect(bare.body.steps.find((s: Row) => s.key === 'video')).toMatchObject({ state: 'now', note: 'long and short cut thumbnails still to make' })
    // Sent again with the same path, the asset is replaced, now with its thumbnail.
    const long = await call('POST', { video_assets: [{ cut: 'long', name: 'Substack video', path: '3 Video/long.mp4', thumbnail: { path: '3 Video/Who gets paid - wide 16x9 - thumbnail.jpg', url: 'https://drive.google.com/t' } }] })
    expect(long.body.making.video_assets).toHaveLength(2)
    expect(long.body.steps.find((s: Row) => s.key === 'video')).toMatchObject({ state: 'now', note: 'short cut thumbnail still to make' })
    const short = await call('POST', { video_assets: [{ cut: 'short', name: 'Shorts video', path: '3 Video/short.mp4', thumbnail: '3 Video/Who gets paid - tall 9x16 - thumbnail.jpg' }] })
    expect(short.body.steps.find((s: Row) => s.key === 'video')).toMatchObject({ state: 'done', note: '2 files' })
    expect(short.body.making.video_assets.find((a: Row) => a.cut === 'short').thumbnail).toEqual({ path: '3 Video/Who gets paid - tall 9x16 - thumbnail.jpg' })
  })

  it('one cut still to produce and the other without its thumbnail are both said', async () => {
    const out = await call('POST', { video_assets: [{ cut: 'long', name: 'Substack video', path: '3 Video/long.mp4' }] })
    expect(out.body.steps.find((s: Row) => s.key === 'video')).toMatchObject({ state: 'now', note: 'short cut still to produce; long cut thumbnail still to make' })
  })

  it('a video asset carries its thumbnail and its music; a bad one is refused by name and nothing is written', async () => {
    const ok = await call('POST', { by: 'Codex', video_assets: [{ cut: 'long', name: 'Substack video', path: '3 Video/long.mp4', thumbnail: { path: '3 Video/t.jpg', url: 'https://drive.google.com/t' }, music: 'track-one' }] })
    expect(ok.status).toBe(200)
    expect(ok.body.making.by).toBe('Codex')
    expect(ok.body.making.video_assets[0]).toMatchObject({ thumbnail: { path: '3 Video/t.jpg', url: 'https://drive.google.com/t' }, music: 'track-one' })
    db.writes = []
    const plainLink = await call('POST', { video_assets: [{ cut: 'short', name: 'Shorts video', path: '3 Video/short.mp4', thumbnail: { path: '3 Video/t.jpg', url: 'http://plain' } }] })
    expect(plainLink.status).toBe(400)
    expect(plainLink.body.problems).toEqual(["the short cut's thumbnail needs a path, and an https url if it has one"])
    const noPath = await call('POST', { video_assets: [{ cut: 'short', name: 'Shorts video', path: '3 Video/short.mp4', thumbnail: { url: 'https://drive.google.com/t' } }] })
    expect(noPath.body.problems).toEqual(["the short cut's thumbnail needs a path, and an https url if it has one"])
    const noTrack = await call('POST', { video_assets: [{ cut: 'short', name: 'Shorts video', path: '3 Video/short.mp4', music: '  ' }] })
    expect(noTrack.body.problems).toEqual(["the short cut's music is the track id from config/music-library.json"])
    expect(db.writes).toHaveLength(0)
  })

  it('every write says who wrote it: Codex when it says so, Claude Code on the engine key otherwise', async () => {
    const codex = await call('POST', { by: 'Codex', recordings: [{ cut: 'long', path: `recordings/${'a'.repeat(64)}.mp4`, seconds: 172 }] })
    expect(codex.body.making.by).toBe('Codex')
    const plain = await call('POST', { workroom: 'https://claude.ai/artifact/x' })
    expect(plain.body.making.by).toBe('Claude Code')
  })

  it('a script check that recorded one cut still needs both recordings (TWO_CUTS)', async () => {
    await call('POST', { script_check: { passed: true, problems: [], cuts: ['long'] } })
    const one = await call('POST', { recordings: [{ cut: 'long', path: 'recordings/long.mp4' }] })
    expect(one.body.steps.find((s: Row) => s.key === 'record')).toMatchObject({ state: 'now', note: 'short cut still to record' })
  })

  it('the scripts carry their hashes; a bad hash is refused by name and nothing is written', async () => {
    const ok = await call('POST', { script_check: { passed: true, problems: [], cuts: ['long', 'short'], hashes: { long: SHA('a'), short: SHA('b') }, checked_at: '2026-10-11T19:14:16Z' } })
    expect(ok.status).toBe(200)
    expect(ok.body.making.script_check).toEqual({ passed: true, problems: [], cuts: ['long', 'short'], hashes: { long: SHA('a'), short: SHA('b') }, checked_at: '2026-10-11T19:14:16Z' })
    db.writes = []
    for (const hashes of [{ long: 'ABC' }, { long: SHA('A') }, { wide: SHA('a') }, 'not an object', { short: 42 }]) {
      const bad = await call('POST', { script_check: { passed: true, problems: [], hashes } })
      expect(bad.status).toBe(400)
      expect(bad.body.problems).toEqual(["script_check.hashes is the sha256 of each cut's script: {long, short}, each 64 lowercase hex characters"])
    }
    expect(db.writes).toHaveLength(0)
  })

  it('a take keeps the hash of the script it was taken from; a bad one is refused', async () => {
    const ok = await call('POST', { by: 'Recordings lane', recordings: [{ cut: 'long', path: `recordings/${SHA('c')}.mp4`, seconds: 203.4, script_sha256: SHA('a') }] })
    expect(ok.status).toBe(200)
    expect(ok.body.making.recordings[0]).toMatchObject({ cut: 'long', seconds: 203, script_sha256: SHA('a') })
    db.writes = []
    const bad = await call('POST', { recordings: [{ cut: 'short', path: `recordings/${SHA('d')}.mp4`, script_sha256: 'abc' }] })
    expect(bad.status).toBe(400)
    expect(bad.body.problems).toEqual(["the short recording's script_sha256 is the sha256 of the script it was taken from, 64 lowercase hex characters"])
    expect(db.writes).toHaveLength(0)
  })

  it('a take of an older script does not count: Record stays now and says so', async () => {
    await call('POST', { script_check: { passed: true, problems: [], cuts: ['long', 'short'], hashes: { long: SHA('a'), short: SHA('b') } } })
    const out = await call('POST', { recordings: [
      { cut: 'long', path: `recordings/${SHA('c')}.mp4`, script_sha256: SHA('e') },
      { cut: 'short', path: `recordings/${SHA('d')}.mp4`, script_sha256: SHA('b') },
    ] })
    expect(out.body.steps.find((s: Row) => s.key === 'record')).toMatchObject({ label: 'Recorded', state: 'now', note: 'long cut recorded from an older script' })
    // Re-recorded with the current hash (Krish said to use it): the step is done.
    const used = await call('POST', { recordings: [{ cut: 'long', path: `recordings/${SHA('c')}.mp4`, script_sha256: SHA('a') }] })
    expect(used.body.making.recordings).toHaveLength(2)
    expect(used.body.steps.find((s: Row) => s.key === 'record')).toMatchObject({ state: 'done' })
  })

  it('an older take and a missing cut are both said; a take with no hash still counts', async () => {
    await call('POST', { script_check: { passed: true, problems: [], hashes: { long: SHA('a'), short: SHA('b') } } })
    const older = await call('POST', { recordings: [{ cut: 'long', path: `recordings/${SHA('c')}.mp4`, script_sha256: SHA('f') }] })
    expect(older.body.steps.find((s: Row) => s.key === 'record').note).toBe('long cut recorded from an older script; short cut still to record')
    const legacy = await call('POST', { recordings: [{ cut: 'long', path: 'recordings/old-long.mp4' }, { cut: 'short', path: 'recordings/old-short.mp4' }] })
    expect(legacy.body.steps.find((s: Row) => s.key === 'record')).toMatchObject({ state: 'done' })
  })

  it('the scripts keep when each cut\'s words last changed; a bad time is refused by name', async () => {
    const ok = await call('POST', { script_check: { passed: true, problems: [], hashes: { long: SHA('a'), short: SHA('b') },
      changed_at: { long: '2026-10-12T12:00:00Z', short: '2026-10-11T19:14:16Z' } } })
    expect(ok.status).toBe(200)
    expect(ok.body.making.script_check.changed_at).toEqual({ long: '2026-10-12T12:00:00Z', short: '2026-10-11T19:14:16Z' })
    db.writes = []
    for (const changed_at of [{ long: 'yesterday' }, { wide: '2026-10-12T12:00:00Z' }, 'not an object']) {
      const bad = await call('POST', { script_check: { passed: true, problems: [], changed_at } })
      expect(bad.status).toBe(400)
      expect(bad.body.problems).toEqual(["script_check.changed_at is when each cut's words last changed: {long, short}, each a time"])
    }
    expect(db.writes).toHaveLength(0)
  })

  it('a take of older words Krish said to use carries his words; words that are not his are refused', async () => {
    const words = 'Krish, 2026-10-12: a test stand-in, not his words'
    const ok = await call('POST', { recordings: [{ cut: 'long', path: `recordings/${SHA('c')}.mp4`, script_sha256: SHA('a'), use_words: words }] })
    expect(ok.status).toBe(200)
    expect(ok.body.making.recordings[0].use_words).toBe(words)
    db.writes = []
    const bad = await call('POST', { recordings: [{ cut: 'long', path: `recordings/${SHA('d')}.mp4`, use_words: 'use it' }] })
    expect(bad.status).toBe(400)
    expect(bad.body.problems[0]).toMatch(/use_words are Krish's own words/)
    expect(db.writes).toHaveLength(0)
  })

  it('the record\'s start is fixed on its first write and never moves as steps run again', async () => {
    const first = await call('POST', { workroom: 'https://claude.ai/artifact/first' })
    const started = first.body.making.started_at
    expect(Number.isNaN(Date.parse(started))).toBe(false)
    const again = await call('POST', { workroom: 'https://claude.ai/artifact/again', session: { url: 'https://claude.ai/code/session_x', by: 'Codex' } })
    expect(again.body.making.started_at).toBe(started)
    // A record from before started_at was kept begins at its earliest step.
    db.tables.content_ideas[0].meta.making = { workroom: { url: 'https://x.ai', at: '2026-10-10T09:00:00Z' }, pack: { folder: 'f', files: 1, packed_at: '2026-10-11T19:14:09Z' }, updated_at: '2026-10-11T19:14:09Z', by: 'Claude Code' }
    const legacy = await call('POST', { pack: { folder: 'f', files: 2 } })
    expect(legacy.body.making.started_at).toBe('2026-10-10T09:00:00Z')
  })

  it('a lost race on updated_at writes nothing and answers 409 stale_row; sent again, it merges onto the fresh record', async () => {
    await call('POST', { workroom: 'https://claude.ai/artifact/first' })
    db.writes = []
    // Another write lands between the route's read and its write.
    db.beforeUpdate = () => {
      const row = db.tables.content_ideas[0]
      row.meta = { ...row.meta, making: { ...row.meta.making, publish_manager: { url: 'https://claude.ai/artifact/other', at: '2026-10-12T08:00:00Z' } } }
      row.updated_at = '2026-10-12T08:00:00Z'
    }
    const lost = await call('POST', { recordings: [{ cut: 'long', path: `recordings/${SHA('c')}.mp4` }] })
    expect(lost.status).toBe(409)
    expect(lost.body.error).toBe('stale_row')
    expect(db.writes).toHaveLength(0)
    expect(db.tables.content_ideas[0].meta.making.recordings).toBeUndefined()
    const again = await call('POST', { recordings: [{ cut: 'long', path: `recordings/${SHA('c')}.mp4` }] })
    expect(again.status).toBe(200)
    expect(again.body.making.publish_manager.url).toBe('https://claude.ai/artifact/other')
    expect(again.body.making.recordings).toHaveLength(1)
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

  it('makingStamp: a newer record always carries a later stamp, even when this clock runs behind the last writer\'s', () => {
    expect(makingStamp({ updated_at: '2026-10-12T11:00:00.000Z' }, '2026-10-12T11:00:05.000Z')).toBe('2026-10-12T11:00:05.000Z')
    expect(makingStamp({ updated_at: '2026-10-12T11:00:05.000Z' }, '2026-10-12T11:00:05.000Z')).toBe('2026-10-12T11:00:05.001Z')
    expect(makingStamp({ updated_at: '2026-10-12T11:00:05.000Z' }, '2026-10-12T11:00:04.990Z')).toBe('2026-10-12T11:00:05.001Z')
    expect(makingStamp(null, '2026-10-12T11:00:00.000Z')).toBe('2026-10-12T11:00:00.000Z')
    const next = mergeMaking({ updated_at: '2026-10-12T11:00:05.000Z', by: 'x' }, { workroom: { url: 'https://x.ai', at: '2026-10-12T11:00:04.990Z' } }, 'Codex', '2026-10-12T11:00:04.990Z')
    expect(next.updated_at > '2026-10-12T11:00:05.000Z').toBe(true)
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

  it('takeCounts: no hash on the take, no hash on the check, or the same script', () => {
    const check = { passed: true, checked_at: 'x', problems: [], hashes: { long: SHA('a') } }
    expect(takeCounts({ cut: 'long' }, check)).toBe(true)
    expect(takeCounts({ cut: 'long', script_sha256: SHA('a') }, check)).toBe(true)
    expect(takeCounts({ cut: 'long', script_sha256: SHA('b') }, check)).toBe(false)
    expect(takeCounts({ cut: 'short', script_sha256: SHA('b') }, check)).toBe(true)
    expect(takeCounts({ cut: 'long', script_sha256: SHA('b') }, undefined)).toBe(true)
  })

  it('makingSteps: only takes of an older script, on both cuts, leave Record at now', () => {
    const steps = makingSteps({ state: 'review', meta: { making: { script_check: { passed: true, checked_at: 'x', problems: [], hashes: { long: SHA('a'), short: SHA('b') } }, recordings: [
      { cut: 'long', path: 'a', at: '2026-10-12T08:00:00Z', script_sha256: SHA('c') },
      { cut: 'short', path: 'b', at: '2026-10-12T08:10:00Z', script_sha256: SHA('d') },
    ], updated_at: 'x', by: 'Recordings lane' } } })
    expect(steps.find(s => s.key === 'record')).toMatchObject({ label: 'Recorded', state: 'now', note: 'long and short cut recorded from an older script', at: '2026-10-12T08:10:00Z' })
  })

  it('makingSteps: a thumbnail on any asset of a cut counts for that cut', () => {
    const base = { recordings: [{ cut: 'long', path: 'a', at: 'x' }, { cut: 'short', path: 'b', at: 'x' }], updated_at: 'x', by: 'Codex' }
    const twoLong = makingSteps({ state: 'review', meta: { making: { ...base, video_assets: [
      { cut: 'long', name: 'first render', path: 'long-1.mp4', at: '2026-10-12T09:00:00Z' },
      { cut: 'long', name: 'second render', path: 'long-2.mp4', at: '2026-10-12T10:00:00Z', thumbnail: { path: 'wide.jpg' } },
      { cut: 'short', name: 'Shorts video', path: 'short.mp4', at: '2026-10-12T10:00:00Z', thumbnail: { path: 'tall.jpg' } },
    ] } } })
    expect(twoLong.find(s => s.key === 'video')).toMatchObject({ state: 'done', note: '3 files', at: '2026-10-12T10:00:00Z' })
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
