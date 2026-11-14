import { describe, expect, it } from 'vitest'
import { artifactSha256, DAILY_CAP, judgeAsset } from '../../apps/control-plane/api/board/_judge'
import type { PanelInput, PanelResult } from '../../apps/control-plane/api/_judges/panel'
import { ROSTER_VERSION } from '../../apps/control-plane/api/_judges/roster'

// content-engine's 10/10 judges on every Growth carousel and Short (Ruling, Krish, 2026-11-12: "Judge them; count
// passes. Every Growth carousel goes through the same 10/10 judges, and each one that passes and goes live counts.").
// Every post, id and link here is synthetic.

type Row = Record<string, any>
const WEEK = '2026-11-09'
const NOW = new Date('2026-11-13T10:00:00Z')
const A = 'a'.repeat(64), B = 'b'.repeat(64)

/** asset_judgements in memory: the reads and the one insert the route makes. */
function fakeDb(rows: Row[] = []) {
  const db = {
    rows,
    from() {
      const where: Array<(r: Row) => boolean> = []
      let head = false, insert: Row | null = null
      const q: any = {
        select(_c: string, o?: { head?: boolean }) { head = Boolean(o?.head); return q },
        eq(c: string, v: unknown) { where.push(r => r[c] === v); return q },
        in(c: string, v: unknown[]) { where.push(r => v.includes(r[c])); return q },
        gte(c: string, v: string) { where.push(r => String(r[c] ?? '') >= v); return q },
        order() { return q }, limit() { return q },
        insert(r: Row) { insert = r; return q },
        then(resolve: (v: unknown) => void) {
          if (insert) { db.rows.push({ created_at: NOW.toISOString(), ...insert }); return resolve({ error: null }) }
          const hit = db.rows.filter(r => where.every(w => w(r))).reverse()
          return resolve(head ? { count: hit.length, error: null } : { data: hit, error: null })
        },
      }
      return q
    },
  }
  return db
}

const post = (over: Row = {}): Row => ({ op: 'judge', item: 'instagram-2026-11-10-0830', format: 'carousel', channel: 'instagram',
  concept_id: 'synthetic-concept', claim: 'Synthetic claim.', words: 'Slide one says the claim. Read the piece at makeyourmindup.ai',
  assets: [{ name: 'mock-1.png', sha256: A }, { name: 'mock-2.png', sha256: B }], ...over })
function panelOf(scores: number[], calls: PanelInput[] = []) {
  return async (input: PanelInput): Promise<PanelResult> => {
    calls.push(input)
    return { panel_run_id: 'p', idempotency_key: 'k', gate: input.gate, artifact_hash: 'x', roster_version: ROSTER_VERSION, short_circuited: false,
      verdicts: [...(input.deterministic ?? []).map(d => ({ judge: d.judge, score: d.score, verdict: d.verdict, the_one_fix: d.the_one_fix, evidence: [], confidence: 1, deterministic: true, model: null, adversarial: false })),
        ...(input.deterministic?.some(d => d.verdict === 'kill') ? [] : scores.map((s, i) => ({ judge: `j${i}`, score: s, verdict: s >= 7 ? 'pass' as const : 'revise' as const,
          the_one_fix: s >= 7 ? null : `Synthetic fix ${i}.`, evidence: [], confidence: 0.8, deterministic: false, model: 'm', adversarial: false })))],
      spread: { low: null, high: null, kills: [], prosecution: null }, dissent: false, cost_usd: 0.01, started_at: '', finished_at: '' }
  }
}
const run = (db: ReturnType<typeof fakeDb>, body: unknown, panel = panelOf([8, 8, 9, 8, 7, 8, 9, 8, 8])) =>
  judgeAsset(db as any, WEEK, body, { panel, now: () => NOW })

describe('the judges on a Growth carousel or Short', () => {
  it('a post the panel stands ready on passes, bound to its exact words and pictures, and is recorded', async () => {
    const db = fakeDb()
    const calls: PanelInput[] = []
    const out = await run(db, post(), panelOf([8, 8, 9, 8, 7, 8, 9, 8, 8], calls))
    const sha = artifactSha256('carousel', 'instagram', post().words, post().assets)
    expect(out).toEqual({ status: 200, body: { ok: true, verdict: 'pass', score: 8, band: 'ready', reasons: [], artifact_sha256: sha } })
    expect(calls[0]).toMatchObject({ gate: 'draft', subjectId: 'instagram-2026-11-10-0830' })
    expect(calls[0].artifact).toContain(post().words)
    expect(db.rows[0]).toMatchObject({ event: 'judged', artifact_sha256: sha, verdict: 'pass', format: 'carousel', week: WEEK })
  })
  it('a post below the bar fails and comes back with each judge\'s fix', async () => {
    const out = await run(fakeDb(), post(), panelOf([5, 6, 6, 5, 8, 6, 5, 6, 6]))
    expect(out.body.verdict).toBe('fail')
    expect((out.body.reasons as Row[]).map(r => r.fix)).toContain('Synthetic fix 0.')
  })
  it('a copy-lint hit fails it before any judge is paid', async () => {
    const out = await run(fakeDb(), post({ words: 'This is not a tool — it is a habit.' }), panelOf([9, 9, 9]))
    expect(out.body.verdict).toBe('fail')
    expect((out.body.reasons as Row[])[0].judge).toBe('copy_lint')
  })
  it('the same post judged again answers from the record and pays nothing', async () => {
    const db = fakeDb()
    await run(db, post())
    const calls: PanelInput[] = []
    const again = await run(db, post(), panelOf([1], calls))
    expect((again.body as Row).again).toBe(true)
    expect(calls).toEqual([])
  })
  it('stops at the daily cap, and refuses a format it does not judge or a request with no words', async () => {
    const db = fakeDb(Array.from({ length: DAILY_CAP }, (_, i) => ({ event: 'judged', artifact_sha256: String(i).padStart(64, '0'), created_at: NOW.toISOString() })))
    expect((await run(db, post())).status).toBe(429)
    expect((await run(fakeDb(), post({ format: 'meme' }))).status).toBe(400)
    expect((await run(fakeDb(), post({ words: '' }))).status).toBe(400)
  })
})

describe('bound to its post, then live: what the North Star counts', () => {
  it('only a pass binds, and only a bound post is marked live, once', async () => {
    const db = fakeDb()
    const judged = await run(db, post())
    const sha = String(judged.body.artifact_sha256)
    expect((await run(db, { op: 'bind', artifact_sha256: B, buffer_post_id: 'bufpost0001' })).status).toBe(409)
    expect((await run(db, { op: 'bind', artifact_sha256: sha, buffer_post_id: 'bufpost0001', item: 'instagram-2026-11-10-0830' })).status).toBe(200)
    const posts = [{ buffer_post_id: 'bufpost0001', url: 'https://www.instagram.com/p/SYNTHETIC/', at: '2026-11-10T13:30:00Z' },
      { buffer_post_id: 'bufpost0002', url: 'https://www.instagram.com/p/OTHER/', at: '2026-11-10T14:30:00Z' }]
    expect((await run(db, { op: 'live', posts })).body).toEqual({ ok: true, marked: 1 })
    expect((await run(db, { op: 'live', posts })).body).toEqual({ ok: true, marked: 0 })
    expect(db.rows.filter(r => r.event === 'live')).toEqual([expect.objectContaining({ artifact_sha256: sha, buffer_post_id: 'bufpost0001', live_at: '2026-11-10T13:30:00.000Z' })])
  })
  it('a failed post can never bind, so it never counts', async () => {
    const db = fakeDb()
    const failed = await run(db, post(), panelOf([4, 4, 4]))
    expect((await run(db, { op: 'bind', artifact_sha256: failed.body.artifact_sha256, buffer_post_id: 'bufpost0003' })).status).toBe(409)
  })
})
