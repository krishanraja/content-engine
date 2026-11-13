import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
import { hisOnlyRefusal, validBody } from '../../apps/control-plane/api/board/_contracts.js'
import { JOBS } from '../../apps/control-plane/api/board/_run.js'
import {
  CARD_ITEM, SignOffError, cardSha256, checkAgainst, parseManifest, pressesOf, recordSignOff, signOffFiles, signOffPick,
  signOffPresses, signOffsView, type SignOffConfigs, type SignOffManifest,
} from '../../apps/control-plane/api/board/_signOffs.js'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => false, mediaQualityRollout: () => ({ status: 'candidate_pending_calibration' }) }))

// The three video sign-offs, one review card each on his board (view contract 1.11.0; Ruling, Krish, 2026-11-12: the
// three video sign-offs are one review card each on his board, with samples, and only his presses write the configs).
// Synthetic samples only: ids, hashes and Drive ids are invented.

type Body = Record<string, any>
const h = (s: string) => createHash('sha256').update(s).digest('hex')
const drive = (n: string) => ({ file_id: `1SyntheticDriveId${n}`, url: `https://drive.google.com/file/d/1SyntheticDriveId${n}/view` })
const MANIFEST = {
  schema: 've-sign-offs/1',
  cards: [
    { id: 'sfx', title: 'Sound effects', ask: 'Approve the sounds you would use.', presses: 'each', writes: 'config/sfx-approved.json', items: [
      { id: 'thud', title: 'A thud', kind: 'audio', mime: 'audio/wav', sha256: h('thud'), drive: drive('A'), slot: 'slam', use: 'A card slams in', seconds: 2.1, provider: 'Epidemic Sound', provider_id: 'p1' },
      { id: 'ding', title: 'A ding', kind: 'audio', mime: 'audio/wav', sha256: h('ding'), drive: drive('B'), slot: 'count', use: 'A count lands', seconds: 1.2, provider: 'Epidemic Sound', provider_id: 'p2' }] },
    { id: 'golden', title: 'Golden frames', ask: 'Approve the frames that set the bar.', presses: 'each', want: { min: 5, max: 10 }, items: [
      { id: 'mon02-tall-00178', title: 'The quote', kind: 'image', mime: 'image/jpeg', sha256: h('g1'), drive: drive('C'), piece: 'A piece', date: '2026-11-02', shape: 'tall 9:16', at: '0:17.9', at_s: 17.87, cut: 'short', cut_sha256: h('cut') }] },
    { id: 'gate2', title: 'Gate 2', ask: 'One press for the four frames.', presses: 'card', lock: 'face-with-proof@16:9', items: ['hook', 'face', 'proof', 'close'].map((b, k) => (
      { id: b, beat: b, title: b, kind: 'image', mime: 'image/jpeg', sha256: h(b), drive: drive(`G${k}`), at: `0:0${k}.0` })) },
  ],
}
const manifest = () => parseManifest(JSON.stringify(MANIFEST)) as SignOffManifest
const NONE: SignOffConfigs = { sfx: { approved: [] }, golden: { slots: [{ slot: 'g1', status: 'empty' }] }, lock: { formats: {}, drafts: { 'face-with-proof@16:9': {} } } }
const press = (card: string, item: string, verdict: string, sha256: string, at: string, words: string | null = null) => ({ card, item, verdict, sha256, words, at, by: 'Krish' })
const doc = (card: string, presses: Body[], by = 'Krish', week = '2026-11-09') => ({ week, doc_id: `signoff-${card}`, updated_by: by, body: { kind: 'sign_off', card, presses } })

describe('the sign-off cards on the view', () => {
  it('reads the manifest the engine writes, and refuses one that is not its shape', () => {
    expect(manifest().cards.map(c => [c.id, c.items.length])).toEqual([['sfx', 2], ['golden', 1], ['gate2', 4]])
    expect(parseManifest('{')).toBeNull()
    expect(parseManifest(JSON.stringify({ ...MANIFEST, schema: 'other' }))).toBeNull()
    // A sample with no Drive link is never drawn.
    const broken = parseManifest(JSON.stringify({ ...MANIFEST, cards: [{ ...MANIFEST.cards[0], items: [{ ...MANIFEST.cards[0].items[0], drive: { file_id: 'x' } }] }] }))
    expect(broken?.cards[0].items).toEqual([])
  })

  it('reads the committed manifest the board draws: three cards, every sample a Drive file with its sha256', () => {
    const real = parseManifest(readFileSync('config/ve/sign-offs.json', 'utf8'))
    expect(real?.cards.map(c => c.id)).toEqual(['sfx', 'golden', 'gate2'])
    const n = real!.cards.map(c => c.items.length)
    expect(n[0]).toBeGreaterThanOrEqual(8); expect(n[0]).toBeLessThanOrEqual(15)
    expect(n[1]).toBeGreaterThanOrEqual(10)
    expect(real!.cards[2].items.map(i => i.id)).toEqual(['hook', 'face', 'proof', 'close'])
    expect(JSON.parse(readFileSync('config/ve/sign-offs.json', 'utf8')).cards.length).toBe(real!.cards.length)
  })

  it('gives every sound and frame its own Approve and Not this, and Gate 2 one press for the card', () => {
    const v = signOffsView(manifest(), [], NONE)!
    expect(v.waiting).toBe(3)
    const sfx = v.cards[0]
    expect(sfx.items[0]).toMatchObject({ id: 'thud', kind: 'audio', src: '/api/board/sign-offs?file=1SyntheticDriveIdA', verdict: null, written: false,
      lines: ['A card slams in', 'For: slam · 2.1 s · Epidemic Sound'] })
    expect(sfx.items[0].presses!.approve).toMatchObject({ kind: 'press', label: 'Approve', op: 'sign-off', body: { card: 'sfx', item: 'thud', verdict: 'approve', sha256: h('thud') } })
    expect(sfx.items[0].presses!.approve.words).toBeUndefined()
    expect(sfx.items[0].presses!.not_this.words).toEqual({ path: 'words', ask: 'What is not right about this sound? (optional)', required: false })
    expect(sfx.line).toBe('0 approved, 0 not this, 2 waiting on you of 2.')
    const gate2 = v.cards[2]
    expect(gate2.items.every(i => i.presses === null)).toBe(true)
    expect(gate2.sha256).toBe(cardSha256(manifest().cards[2]))
    expect(gate2.presses!.approve.body).toEqual({ card: 'gate2', item: CARD_ITEM, verdict: 'approve', sha256: gate2.sha256 })
    expect(gate2.presses!.approve.words?.required).toBe(false)
    expect(gate2.line).toBe('Waiting on you: one Approve or Not this for all 4 frames.')
  })

  it('binds Gate 2 to the canonical map of its stills, the same digest velib/signoffs.py card_sha256 makes', () => {
    const map = Object.fromEntries(['hook', 'face', 'proof', 'close'].map(b => [b, h(b)]))
    const canonical = `{${Object.keys(map).sort().map(k => `${JSON.stringify(k)}:${JSON.stringify(map[k])}`).join(',')}}`
    expect(cardSha256(manifest().cards[2])).toBe(h(canonical))
  })

  it('says what he already decided, by his latest press on the bytes he saw, and what the engine holds', () => {
    const presses = pressesOf([
      doc('sfx', [press('sfx', 'thud', 'approve', h('thud'), '2026-11-13T10:00:00Z'), press('sfx', 'ding', 'approve', h('ding'), '2026-11-13T10:01:00Z'),
        press('sfx', 'ding', 'not_this', h('ding'), '2026-11-13T10:02:00Z', 'Too cute.')]),
      // A session's record is never read as his.
      doc('golden', [press('golden', 'mon02-tall-00178', 'approve', h('g1'), '2026-11-13T10:03:00Z')], 'engine_operator'),
      // A press on bytes the card no longer holds stays with those bytes.
      doc('gate2', [press('gate2', CARD_ITEM, 'approve', 'f'.repeat(64), '2026-11-13T10:04:00Z')]),
    ])
    const configs: SignOffConfigs = { ...NONE, sfx: { approved: [{ id: 'thud', sha256: h('thud') }] } }
    const v = signOffsView(manifest(), presses, configs)!
    const [sfx, golden, gate2] = v.cards
    expect(sfx.items.map(i => [i.id, i.verdict?.said, i.verdict?.words, i.written])).toEqual([['thud', 'approve', null, true], ['ding', 'not_this', 'Too cute.', false]])
    expect(sfx.state).toBe('answered')
    expect(sfx.line).toBe('1 approved, 1 not this of 2. The engine is writing it in.')
    expect(golden.items[0].verdict).toBeNull()
    expect(gate2.verdict).toBeNull()
    expect(v.waiting).toBe(2)
    // Once his no is in the config too, the card says so.
    const both = signOffsView(manifest(), presses, { ...configs, sfx: { approved: [{ id: 'thud', sha256: h('thud') }], declined: [{ id: 'ding', sha256: h('ding') }] } })!
    expect(both.cards[0].state).toBe('written')
    expect(both.cards[0].line).toBe('1 approved, 1 not this of 2. Written to the engine.')
  })

  it('reads Gate 2 as written once the lock is frozen from his approved stills', () => {
    const sha = cardSha256(manifest().cards[2])
    const presses = pressesOf([doc('gate2', [press('gate2', CARD_ITEM, 'approve', sha, '2026-11-13T11:00:00Z')])])
    const lock = { formats: { 'face-with-proof@16:9': { approved: { by: 'Krish', sha256: sha } } }, drafts: {} }
    const card = signOffsView(manifest(), presses, { ...NONE, lock })!.cards[2]
    expect([card.state, card.verdict?.said, card.line]).toEqual(['written', 'approve', 'Approved, Fri 13 Nov. Written to the engine.'])
  })

  it('serves only the samples a card shows', () => {
    expect([...signOffFiles(manifest())]).toEqual(['1SyntheticDriveIdA', '1SyntheticDriveIdB', '1SyntheticDriveIdC', '1SyntheticDriveIdG0', '1SyntheticDriveIdG1', '1SyntheticDriveIdG2', '1SyntheticDriveIdG3'])
    expect(signOffFiles(null).size).toBe(0)
    expect(signOffsView(null, [], NONE)).toBeNull()
  })
})

describe('his press', () => {
  const refused = (f: () => unknown) => { try { f(); return null } catch (e) { return e instanceof SignOffError ? [e.status, e.message] : e } }

  it('takes a card, a sample, Approve or Not this and the sha256 it names; his words are optional and kept as typed', () => {
    expect(signOffPick({ card: 'sfx', item: 'thud', verdict: 'approve', sha256: h('thud') })).toEqual({ card: 'sfx', item: 'thud', verdict: 'approve', sha256: h('thud'), words: null })
    expect(signOffPick({ card: 'golden', item: 'mon02-tall-00178', verdict: 'not_this', sha256: h('g1'), words: '  Too busy.  ' }).words).toBe('Too busy.')
    expect(refused(() => signOffPick({ card: 'music', item: 'x', verdict: 'approve', sha256: h('x') }))).toEqual([400, 'invalid_card'])
    expect(refused(() => signOffPick({ card: 'sfx', item: 'x', verdict: 'yes', sha256: h('x') }))).toEqual([400, 'invalid_verdict'])
    expect(refused(() => signOffPick({ card: 'sfx', item: 'x', verdict: 'approve', sha256: 'abc' }))).toEqual([400, 'invalid_sha256'])
    expect(refused(() => signOffPick({ card: 'sfx', item: '../x', verdict: 'approve', sha256: h('x') }))).toEqual([400, 'invalid_item'])
  })

  it('counts only on a sample on the card now, with the bytes he saw', () => {
    const m = manifest()
    expect(refused(() => checkAgainst(m, signOffPick({ card: 'sfx', item: 'thud', verdict: 'approve', sha256: h('thud') })))).toBeNull()
    expect(refused(() => checkAgainst(m, signOffPick({ card: 'sfx', item: 'thud', verdict: 'approve', sha256: h('older') })))).toEqual([409, 'sample_changed'])
    expect(refused(() => checkAgainst(m, signOffPick({ card: 'sfx', item: 'gone', verdict: 'approve', sha256: h('gone') })))).toEqual([404, 'sample_not_found'])
    expect(refused(() => checkAgainst(m, signOffPick({ card: 'gate2', item: 'hook', verdict: 'approve', sha256: h('hook') })))).toEqual([400, 'invalid_item'])
    expect(refused(() => checkAgainst(m, signOffPick({ card: 'gate2', item: CARD_ITEM, verdict: 'approve', sha256: cardSha256(m.cards[2]) })))).toBeNull()
    expect(refused(() => checkAgainst(null, signOffPick({ card: 'sfx', item: 'thud', verdict: 'approve', sha256: h('thud') })))).toEqual([503, 'sign_offs_unavailable'])
  })

  it('is kept as his alone: a record of the right shape, which no session can write', () => {
    const body = { kind: 'sign_off', card: 'sfx', presses: [press('sfx', 'thud', 'approve', h('thud'), '2026-11-13T10:00:00Z')] }
    expect(validBody('picks', 'signoff-sfx', body)).toBe(true)
    expect(validBody('picks', 'signoff-golden', body)).toBe(false)
    expect(validBody('picks', 'signoff-sfx', { ...body, presses: [{ ...body.presses[0], by: 'engine_operator' }] })).toBe(false)
    expect(validBody('picks', 'signoff-sfx', { ...body, presses: [{ ...body.presses[0], send: true }] })).toBe(false)
    expect(hisOnlyRefusal('picks', body, 'engine_operator')).toBe('decision_is_his')
    expect(hisOnlyRefusal('picks', body, 'Krish')).toBeNull()
    // The job his press starts takes nothing from the press: it reads his presses back from the board.
    expect(JOBS['signoff-apply']).toMatchObject({ workflow: 'signoff-apply.yml' })
    expect(JOBS['signoff-apply'].payload({ card: 'sfx', item: 'thud' })).toEqual({})
  })
})

/** board_documents and board_save, enough for recordSignOff and the routes. */
function store(rows: Body[] = []) {
  const docs = new Map<string, Body>(rows.map(r => [`${r.week}/${r.doc_id}`, { ...r, revision: 1 }]))
  const saves: Body[] = []
  const db: any = {
    rpc: async (name: string, a: Body) => {
      if (name !== 'board_save') throw new Error(name)
      const key = `${a.p_week}/${a.p_id}`
      const held = docs.get(key)
      if ((held?.revision || 0) !== a.p_revision) return { data: { ok: false, error: 'revision_conflict' }, error: null }
      docs.set(key, { week: a.p_week, doc_id: a.p_id, body: a.p_body, updated_by: a.p_actor, revision: Number(a.p_revision) + 1 })
      saves.push(a)
      return { data: { ok: true }, error: null }
    },
    from: () => {
      const f: Body = {}
      const q: any = {
        select: () => q, eq: (k: string, v: unknown) => { f[k] = v; return q }, like: (k: string, v: string) => { f.like = v; return q },
        limit: async () => ({ data: [...docs.values()].filter(d => String(d.doc_id).startsWith(String(f.like).replace('%', ''))), error: null }),
        maybeSingle: async () => ({ data: docs.get(`${f.week}/${f.doc_id}`) ?? null, error: null }),
      }
      return q
    },
  }
  return { db, docs, saves }
}

describe('the record of his presses', () => {
  it('appends each press on the week he pressed, never rewriting one, and keeps the same answer twice once', async () => {
    const s = store()
    const pick = signOffPick({ card: 'sfx', item: 'thud', verdict: 'approve', sha256: h('thud') })
    const a = await recordSignOff(s.db, '2026-11-09', pick, '2026-11-13T10:00:00.000Z')
    expect(a.already).toBe(false)
    expect(s.saves[0]).toMatchObject({ p_week: '2026-11-09', p_collection: 'picks', p_id: 'signoff-sfx', p_actor: 'Krish' })
    const b = await recordSignOff(s.db, '2026-11-16', pick, '2026-11-13T10:05:00.000Z')
    expect(b.already).toBe(true)
    expect(s.saves).toHaveLength(1)
    const c = await recordSignOff(s.db, '2026-11-09', { ...pick, verdict: 'not_this', words: 'On reflection, no.' }, '2026-11-13T10:06:00.000Z')
    expect(c.already).toBe(false)
    expect((s.docs.get('2026-11-09/signoff-sfx')!.body.presses as Body[]).map(p => p.verdict)).toEqual(['approve', 'not_this'])
  })
})

describe('the routes', () => {
  const previous = { ...process.env }
  afterEach(() => {
    for (const key of ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] }
    vi.unstubAllGlobals()
  })
  async function call(opts: { method?: string; query: Body; body?: Body; operator?: boolean; rows?: Body[]; manifest?: SignOffManifest | null }) {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, text: async () => '' })))
    const s = store(opts.rows)
    const dispatched: Body[] = []
    const served: string[] = []
    const handler = createBoardHandler(async () => s.db as never, {
      now: () => '2026-11-13T12:00:00.000Z',
      signOffs: async () => ({ manifest: opts.manifest === undefined ? manifest() : opts.manifest, configs: NONE }),
      dispatch: (async (job: string, input: Body) => { dispatched.push({ job, input }); return { sent: true, job, workflow: 'signoff-apply.yml', at: 'x' } }) as never,
      drive: () => ({ posts: async () => [], serve: async (id: string) => { served.push(id); return `https://store.example/signed/${id}` } }),
    })
    const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE!).digest('hex')}`
    const headers = opts.operator ? { authorization: 'Bearer synthetic-operator' } : { cookie, origin: 'https://controlcenter.krishraja.com' }
    let status = 0; let out: Body = {}; let location = ''
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(v: Body) { out = v }, redirect(code: number, url: string) { status = code; location = url } } as unknown as VercelResponse
    await handler({ method: opts.method || 'POST', headers, query: opts.query, body: opts.body } as unknown as VercelRequest, res)
    return { status, out, location, s, dispatched, served }
  }
  const POST = { week: '2026-11-09', collection: 'sign-off' }

  it('records his press and starts the job that writes the configs; a session is refused', async () => {
    const r = await call({ query: POST, body: { card: 'sfx', item: 'thud', verdict: 'approve', sha256: h('thud') } })
    expect(r.status).toBe(200)
    expect(r.out).toMatchObject({ ok: true, already: false, press: { card: 'sfx', item: 'thud', verdict: 'approve', by: 'Krish', at: '2026-11-13T12:00:00.000Z' }, apply: { sent: true } })
    expect(r.dispatched).toEqual([{ job: 'signoff-apply', input: {} }])
    const op = await call({ query: POST, operator: true, body: { card: 'sfx', item: 'thud', verdict: 'approve', sha256: h('thud') } })
    expect([op.status, op.out.error, op.s.saves.length, op.dispatched.length]).toEqual([403, 'his_press', 0, 0])
  })

  it('refuses a press on bytes the card no longer holds, and starts nothing for the same answer twice', async () => {
    const stale = await call({ query: POST, body: { card: 'sfx', item: 'thud', verdict: 'approve', sha256: h('older') } })
    expect([stale.status, stale.out.error, stale.s.saves.length]).toEqual([409, 'sample_changed', 0])
    const again = await call({ query: POST, rows: [doc('sfx', [press('sfx', 'thud', 'approve', h('thud'), '2026-11-13T10:00:00Z')])],
      body: { card: 'sfx', item: 'thud', verdict: 'approve', sha256: h('thud') } })
    expect([again.status, again.out.already, again.dispatched.length]).toEqual([200, true, 0])
  })

  it('answers the apply job with every press of his, on the engine key', async () => {
    const r = await call({ method: 'GET', operator: true, query: { op: 'sign-offs' },
      rows: [doc('sfx', [press('sfx', 'thud', 'approve', h('thud'), '2026-11-13T10:00:00Z')]), doc('golden', [press('golden', 'x', 'approve', h('x'), '2026-11-13T10:00:00Z')], 'engine_operator')] })
    expect(r.status).toBe(200)
    expect(r.out.presses).toEqual([{ ...press('sfx', 'thud', 'approve', h('thud'), '2026-11-13T10:00:00Z'), week: '2026-11-09' }])
  })

  it('serves a sample by its Drive id only when a card shows it', async () => {
    const ok = await call({ method: 'GET', query: { op: 'sign-offs', file: '1SyntheticDriveIdA' } })
    expect([ok.status, ok.location, ok.served]).toEqual([302, 'https://store.example/signed/1SyntheticDriveIdA', ['1SyntheticDriveIdA']])
    const link = await call({ method: 'GET', operator: true, query: { op: 'sign-offs', file: '1SyntheticDriveIdG2', link: '1' } })
    expect([link.status, link.out.url]).toEqual([200, 'https://store.example/signed/1SyntheticDriveIdG2'])
    const other = await call({ method: 'GET', query: { op: 'sign-offs', file: '1SomeOtherFileInHisDrive' } })
    expect([other.status, other.out.error, other.served]).toEqual([404, 'sample_not_found', []])
    const none = await call({ method: 'GET', query: { op: 'sign-offs', file: '1SyntheticDriveIdA' }, manifest: null })
    expect([none.status, none.out.error]).toEqual([503, 'sign_offs_unavailable'])
  })

  it('builds presses the board posts as they are', () => {
    const p = signOffPresses(manifest().cards[1], manifest().cards[1].items[0])
    expect(p.approve.done).toBe('Approved. The engine takes it in, and this card says so when it has.')
    expect(p.not_this.done).toBe('Saved as your no. The engine records it, and nothing here is used.')
  })
})
