import { describe, expect, it, afterEach } from 'vitest'
import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { buildView, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler'
import { TAKES_OP, TAKES_SLACK_MS, newTakes, productionBrief, takesInOf, takesPress } from '../../apps/control-plane/api/board/_takesIn'
import { approval } from './_approvals'
import { parsePlan, swapsOf } from '../../apps/control-plane/api/board/_productionPlan'
import { validBody } from '../../apps/control-plane/api/board/_contracts'

// Krish, 2026-11-17: "whenever I press approve script, the new board state should be waiting for me to confirm the videos
// are in the Inbox, at which point it will fetch the name of the video(s) and integrate them in the piece on the board so
// the next post production prompt does a completely accurate job, with all the research, motion styles etc being in one
// place and decided as well, the post production should always be one shot - and can decide where to bring in logos, real
// visuals, social posts, screen shots, motion design, cinematic generation, my face etc etc."
// The case: Tue 17's OpenAI data-centre piece (b019dbf8), scripts approved on the board at 14:57.

type Body = Record<string, any>
const W16 = '2026-11-16'
const TUE = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118'
const AT = '2026-11-17T11:09:12.000Z'
const APPROVED_AT = '2026-11-17T14:57:28.000Z'
const LOCK = `# Narrative lock: Tue 17\n\npiece_id: ${TUE}\nPublishes: 2026-11-17\n\nThe arc.\n\nSigned by Krish: "Signed.", 2026-11-17`
const PICKED = {
  look: { production: 'face-with-proof', experiment: null, inspiration: [], by: 'Krish', at: AT },
  style: { motion: 'eating-jobs-ladder', captions: 'art-directed', rejected: { motion: [], captions: [], treatment: [] }, by: 'Krish', at: AT },
}
const mod = (id: string, name: string) => ({ id, name, how: `${name}.`, rules: [], point_types: ['claim'], formats: ['long_video', 'short_video'], fits: 'often', krish_verdict: '', ve_route: ['ve'] })
const said = { said_at: APPROVED_AT, said_where: 'the Publish Board in Control Centre', session_ref: 'https://controlcenter.krishraja.com/#/content?week=2026-11-16&day=tue', at: APPROVED_AT }
const SCRIPTS = { doc_id: `tue-scripts-words-${TUE.slice(0, 8)}`, updated_by: 'Krish', updated_at: APPROVED_AT, body: { kind: 'approve_scripts', day: 'tue', via: 'words',
  approved: true, piece_id: TUE, texts: { long: 'OpenAI says it will pay for the power.', short: 'Who pays for the power?' }, titles: { long: 'L', short: 'S' }, folder_title: 'F',
  words: 'Approve both scripts', ...said, send: { at: APPROVED_AT, by: 'content-engine server', status: 'sent' } } }
const filed = [{ cut: 'long', id: 'a', title: 'Long', text: 'OpenAI says it will pay for the power.', at: null }, { cut: 'short', id: 'b', title: 'Short', text: 'Who pays for the power?', at: null }]
const TAKES = { confirmed_at: '2026-11-17T16:00:00.000Z', by: 'Krish', since: APPROVED_AT, files: [
  { name: '2026-11-17 openai long.mp4', drive_id: 'drv1', bytes: 400_000_000, sha256: 'a'.repeat(64), md5: null, modified: '2026-11-17T15:40:00.000Z' },
  { name: '2026-11-17 openai short.mp4', drive_id: 'drv2', bytes: 90_000_000, sha256: null, md5: null, modified: '2026-11-17T15:50:00.000Z' }] }

function inputs(meta: Body = PICKED, picks: Body[] = [SCRIPTS]): ViewInputs {
  return {
    week: W16, now: new Date('2026-11-17T12:00:00Z'),
    pieces: [{ id: TUE, idea: 'OpenAI pledges to pay for data center power', thesis: 'x', scheduled_for: '2026-11-17', lane_slot: 'mind_the_gap',
      state: 'drafting', buried_at: null, body: '', updated_at: AT, meta }],
    picks, queue: [], history: [], runs: {}, north_star: null, ideas: { days: {} }, locks: { tue: LOCK }, scripts: { [TUE]: filed },
    motion: [mod('eating-jobs-ladder', 'The unwanted neighbour'), mod('swiss-kinetic-type', 'Swiss grid')],
    formats: { production: [{ id: 'face-with-proof', name: 'Face with proof', pitch: 'x', status: 'live' }], script: [] },
    approvals: [approval(W16, 'tue', TUE)], items: [], all_items: [], plans: {},
  } as unknown as ViewInputs
}
const card = (i: ViewInputs) => buildView(i).model!.days.find(d => d.day === 'tue')!.items.find(x => x.piece_id === TUE)!

describe('the production plan on the card (contract 1.25.0; Krish, 2026-11-17: "mocked up 2 or 3 scenes [...] the final opportunity to switch something out")', () => {
  const STILL = '11111111-2222-4333-8444-555555555555'
  const PLAN = {
    version: 1, piece_id: TUE, made_at: '2026-11-17T22:40:00Z', takes: ['2026-11-17 openai short.mp4'],
    edit: { raw_seconds: 101.2, restarts: [{ at: 14.2, said: 'The habit that' }], silences_cut: 9, kept_seconds: 93.4, cap_seconds: 90, speed: 1.064, final_seconds: 87.8 },
    style: { look: 'face-with-proof', motion: 'eating-jobs-ladder', captions: 'art-directed' },
    beats: [
      { id: 'b1', from: 0, to: 4.1, words: 'Who pays for the power?', picture: { id: 'face', kind: 'face', what: 'Him to camera' },
        options: [{ id: 'post', kind: 'social_post', what: 'The viral post about the power bill', source: 'https://example.org/post' }, { id: 'bad', kind: 'nonsense', what: 'x' }] },
      { id: 'b2', from: 4.1, to: 9, words: 'Your engineer is as confident as a crocodile hunter', picture: { id: 'croc', kind: 'humour', what: 'A nerdy engineer creeping up on a crocodile' },
        options: [{ id: 'shot', kind: 'screenshot', what: 'The pricing page' }], humour: { mechanism: 'incongruity', gag: 'Khaki hat, laptop bag' } },
      { id: 'b4', from: 9, to: 13, words: 'Nobody checks the work', picture: { id: 'gen', kind: 'generated', what: 'A conveyor of unchecked reports',
        recipe: 'gpt_image_2_6, 9:16: "a conveyor belt of unchecked reports"; then seedance_2_5 omni_reference from that still, 4 s, 1080p' }, options: [] },
      { id: 'BAD ID', from: 0, to: 1, words: 'x', picture: { id: 'face', kind: 'face', what: 'x' } },
    ],
    scenes: [{ beat: 'b1', still: STILL, caption: 'Who pays for the power?', style: 'art-directed' }, { beat: 'nope', still: STILL, caption: '', style: '' }],
    humour: [{ words: 'as confident as a crocodile hunter', mechanism: 'incongruity', gag: 'A nerdy engineer creeping up on a crocodile', beat: 'b2' }],
  }
  const text = JSON.stringify(PLAN)
  const sha = createHash('sha256').update(text).digest('hex')
  const plan = parsePlan(text, TUE, sha)!
  const withPlan = (picks: Body[] = [SCRIPTS]) => ({ ...inputs({ ...PICKED, takes_in: TAKES }, picks), productionPlans: { [TUE]: plan } }) as unknown as ViewInputs

  it('reads the plan, dropping only what is malformed', () => {
    expect(plan.beats.map(b => b.id)).toEqual(['b1', 'b2', 'b4'])
    expect(plan.beats[0].options.map(o => o.id)).toEqual(['post'])
    expect(plan.scenes).toEqual([{ beat: 'b1', still: STILL, caption: 'Who pays for the power?', style: 'art-directed' }])
    expect(parsePlan(text, '99999999-2222-4333-8444-555555555555', sha)).toBeNull()
    expect(parsePlan('not json', TUE, sha)).toBeNull()
  })

  it('while it is being made the card says so; once filed it shows the scenes, the beats and a Use this on every other option', () => {
    const run = (at: string, sent = true) => ({ ...PICKED, takes_in: { ...TAKES, plan_run: { sent, at, reason: sent ? null : 'not_configured' } } })
    expect((card(inputs(run('2026-11-17T11:00:00Z'))).plan as Body).status).toBe('making')
    // Never "being made" forever: a run that did not start, or filed nothing in two hours, says so.
    expect(card(inputs(run('2026-11-17T11:00:00Z', false))).plan).toMatchObject({ status: 'not_made', line: expect.stringContaining('the plan run did not start') })
    expect(card(inputs(run('2026-11-17T09:00:00Z'))).plan).toMatchObject({ status: 'not_made', line: expect.stringContaining('filed nothing in two hours') })
    expect(card(inputs({ ...PICKED, takes_in: TAKES })).plan).toBeUndefined()
    const it = card(withPlan())
    const p = it.plan as Body
    expect(p.status).toBe('ready')
    expect(it.line).toContain('Your production plan is ready: Your take runs 1:41, 1 restarted sentence clipped, 9 silences cut, 1:33 kept, sped up 6% to 1:28, under the 90-second limit.')
    expect(p.scenes[0]).toMatchObject({ beat: 'b1', src: `/api/content-ideas/store?op=read&id=${STILL}`, picture: { kind: 'face', label: 'You on camera' } })
    const use = p.beats[0].options[0].press
    expect(use).toMatchObject({ kind: 'press', label: 'Use this', collection: 'picks', id: `plan-${TUE.slice(0, 8)}`, body: { kind: 'plan_swaps', piece_id: TUE, plan_sha256: sha, swaps: { b1: 'post' } } })
    expect(validBody('picks', use.id, { ...use.body, at: '2026-11-17T22:50:00Z' })).toBe(true)
  })

  it('the Claude production prompt carries the edit pass, the humour, higgsfield-generator and the plan with his swaps', () => {
    const swapped = { doc_id: `plan-${TUE.slice(0, 8)}`, updated_by: 'Krish', body: { kind: 'plan_swaps', piece_id: TUE, plan_sha256: sha, swaps: { b1: 'post' } } }
    const it = card(withPlan([SCRIPTS, swapped]))
    const prompt = String((it.next as Body).prompt)
    expect((it.next as Body).label).toBe('Claude production prompt')
    for (const s of ['edit_pass.py', 'restarted a sentence', 'under 90 seconds', 'humour-engine', 'crocodile', 'higgsfield-generator', 'real viral social post', 'screenshot'])
      expect(prompt).toContain(s)
    expect(prompt).toContain('A real social post: The viral post about the power bill (source: https://example.org/post)   [Krish swapped this in]')
    expect((it.plan as Body).beats[0]).toMatchObject({ swapped: true, picture: { id: 'post' } })
  })

  it('never claims a cut fits when even 1.25x leaves it over the limit', () => {
    const over = parsePlan(JSON.stringify({ ...PLAN, edit: { ...PLAN.edit, kept_seconds: 120, speed: 1.25, final_seconds: 96, over_cap: true } }), TUE, sha)!
    const it = card({ ...inputs({ ...PICKED, takes_in: TAKES }), productionPlans: { [TUE]: over } } as unknown as ViewInputs)
    expect(it.line).toContain('even sped up 25% it runs 1:36, 6 seconds over the 90-second limit, so lines must come out')
    expect(it.line).not.toContain('under the 90-second limit')
  })

  it('a generated beat carries its higgsfield recipe into the prompt, stills before video, with the house limits', () => {
    const it = card(withPlan())
    const prompt = String((it.next as Body).prompt)
    expect(prompt).toContain('recipe: gpt_image_2_6, 9:16: "a conveyor belt of unchecked reports"; then seedance_2_5 omni_reference from that still')
    for (const s of ['higgsfield-generate/SKILL.md', 'Stills before video', 'higgsfield generate cost', 'reframe workflow', 'never Soul ID for him',
      'never Higgsfield audio', 'Virality Predictor']) expect(prompt).toContain(s)
    expect((it.plan as Body).beats.find((b: Body) => b.id === 'b4').picture.recipe).toContain('seedance_2_5')
  })

  it('can fail: a swap made on another version of the plan, or naming an option the beat lacks, does not count', () => {
    const stale = { doc_id: `plan-${TUE.slice(0, 8)}`, body: { kind: 'plan_swaps', piece_id: TUE, plan_sha256: 'b'.repeat(64), swaps: { b1: 'post' } } }
    expect(swapsOf([stale], plan)).toEqual({})
    const unknown = { doc_id: `plan-${TUE.slice(0, 8)}`, body: { kind: 'plan_swaps', piece_id: TUE, plan_sha256: sha, swaps: { b1: 'nothing' } } }
    expect(swapsOf([unknown], plan)).toEqual({})
    expect(validBody('picks', `plan-${TUE.slice(0, 8)}`, { kind: 'plan_swaps', piece_id: TUE, plan_sha256: sha, swaps: { b1: 'post' }, extra: 1 })).toBe(false)
    expect(validBody('picks', 'plan-00000000', { kind: 'plan_swaps', piece_id: TUE, plan_sha256: sha, swaps: {} })).toBe(false)
  })
})

describe('which Inbox files are his takes', () => {
  const file = (id: string, name: string, modifiedTime: string, extra: Body = {}) => ({ id, name, modifiedTime, mimeType: 'video/mp4', size: '100', ...extra })
  it('video files changed since he approved the scripts (less three hours), held by no other piece, in the order recorded', () => {
    const files = [file('b', 'take 2.mp4', '2026-11-17T16:00:00Z', { sha256Checksum: 'B'.repeat(64) }), file('a', 'take 1.MOV', '2026-11-17T15:00:00Z'),
      file('old', 'last week.mp4', '2026-11-10T09:00:00Z'), file('doc', 'notes.txt', '2026-11-17T15:30:00Z', { mimeType: 'text/plain' }), file('mine', 'other piece.mp4', '2026-11-17T15:30:00Z')]
    const got = newTakes(files, APPROVED_AT, new Set(['mine']))
    expect(got.map(f => f.drive_id)).toEqual(['a', 'b'])
    expect(got[1]).toEqual({ name: 'take 2.mp4', drive_id: 'b', bytes: 100, sha256: 'b'.repeat(64), md5: null, modified: '2026-11-17T16:00:00Z' })
    // Recorded just before the approval landed still counts; before the slack does not.
    const edge = Date.parse(APPROVED_AT) - TAKES_SLACK_MS
    expect(newTakes([file('e', 'e.mp4', new Date(edge).toISOString())], APPROVED_AT, new Set()).length).toBe(1)
    expect(newTakes([file('e', 'e.mp4', new Date(edge - 1000).toISOString())], APPROVED_AT, new Set()).length).toBe(0)
  })
  it('reads back what the press wrote, and nothing from a malformed record', () => {
    expect(takesInOf({ takes_in: TAKES })!.files.map(f => f.name)).toEqual(['2026-11-17 openai long.mp4', '2026-11-17 openai short.mp4'])
    expect(takesInOf({})).toBeNull()
    expect(takesInOf({ takes_in: { files: [] } })).toBeNull()
  })
})

describe('after his Approve scripts, every card waits on his takes, then makes one post-production prompt', () => {
  it('approved and in his Teleprompter: the next action is his My takes are in the Inbox, the record step\'s prompt beside it', () => {
    const it = card(inputs())
    expect(it.next).toEqual(expect.objectContaining({ kind: 'press', op: TAKES_OP, label: 'My takes are in the Inbox', body: { piece_id: TUE } }))
    expect(it.decision).toBe(true)
    expect(it.line).toBe('Scripts approved Tue 17 Nov, sent to your Teleprompter at 14:57 UTC. Record both cuts from your Teleprompter, drop the takes in the Video Engine Inbox, then press My takes are in the Inbox.')
    expect(it.others.some((a: Body) => a.kind === 'prompt' && /step record\)/.test(a.prompt))).toBe(true)
  })

  it('his takes on the piece: the card names them, and the next action is the one-shot production prompt with everything decided', () => {
    const it = card(inputs({ ...PICKED, takes_in: TAKES }))
    expect(it.line).toBe('Your takes are on the piece: "2026-11-17 openai long.mp4", "2026-11-17 openai short.mp4". Next: one Claude production session makes the finished cut from them.')
    expect(it.decision).toBe(false)
    const p = String((it.next as Body).prompt)
    for (const words of [`piece_id ${TUE}`, 'in one go', 'never ask him for one again', 'The motion style: The unwanted neighbour (eating-jobs-ladder), picked by Krish',
      'The captions:', 'The look:', 'in his words "Approve both scripts"', 'python scripts/post-pack/recording.py get "2026-11-17 openai long.mp4"   (or --sha256 ' + 'a'.repeat(64),
      'python scripts/post-pack/recording.py get "2026-11-17 openai short.mp4"', '--- long cut, as he approved it ---\nOpenAI says it will pay for the power.',
      'his face on camera', 'a logo or wordmark', 'real visuals', 'a social post or a screenshot', 'motion design', 'cinematic generation', 'scripts/av_sync.py',
      'separate reviewer', 'Keep the board current as you work']) expect(p, words).toContain(words)
    expect(p).not.toContain('Not picked yet')
  })

  it('a production pick still missing comes first as his press, so the session never decides one', () => {
    const noCaptions = { ...PICKED, style: { ...PICKED.style, captions: null }, takes_in: TAKES }
    const it = card(inputs(noCaptions))
    expect(it.next).toMatchObject({ kind: 'press', op: 'style', label: 'Pick the captions' })
    expect(it.decision).toBe(true)
    expect(it.line).toMatch(/First, pick the captions, so the cut is fully decided\.$/)
  })

  it('a take already recorded is never sent back to a pick: the prompt names what is not picked', () => {
    const recorded = { ...PICKED, style: { ...PICKED.style, captions: null }, making: { recordings: [{ cut: 'long', path: `recordings/${'c'.repeat(64)}.mp4`, at: '2026-11-17T16:10:00Z' }] } }
    const it = card(inputs(recorded))
    expect((it.next as Body).kind).toBe('prompt')
    expect(String((it.next as Body).prompt)).toContain(`recording.py get "recordings/${'c'.repeat(64)}.mp4"`)
    expect(String((it.next as Body).prompt)).toContain('Not picked yet: the captions')
  })

  it('can fail: not approved, no stage; a cut already made, no stage', () => {
    expect((card(inputs(PICKED, [])).next as Body)?.op).not.toBe(TAKES_OP)
    const cut = card(inputs({ ...PICKED, takes_in: TAKES, making: { video_assets: [{ cut: 'long', name: 'x', path: 'y', at: 'z' }] } }))
    expect(String((cut.next as Body)?.prompt ?? '')).not.toContain('This is the one post-production session')
  })

  it('the press and the brief say the same thing on every kind of card', () => {
    expect(takesPress(TUE, 'off-tue-x')).toMatchObject({ op: TAKES_OP, body: { piece_id: TUE, item: 'off-tue-x' } })
    const brief = productionBrief({ pieceId: TUE, title: 'T', takes: TAKES, decisions: ['A'], research: ['R'], scripts: {}, offday: true })
    expect(brief).toContain('finished short in one go')
  })
})

describe('which Inbox files are this piece\'s takes (17 Nov: his .aac voiceover take was skipped)', () => {
  const at = (t: string) => `2026-11-17T${t}:00Z`
  // The Video Engine Inbox as it stood at 22:20 UTC on 17 Nov, his habits approval at 17:57.
  const INBOX17 = [
    { id: 'bb-long', name: 'Build-or-buy-long.mp4', mimeType: 'video/mp4', modifiedTime: at('22:07') },
    { id: 'bb-short', name: 'Build-or-buy-short.mp4', mimeType: 'video/mp4', modifiedTime: at('22:05') },
    { id: 'habits', name: 'Which of your habits will cost you your job once AI is at work__ short cut.aac', mimeType: 'audio/aac', modifiedTime: at('22:03') },
    { id: 'sk-long', name: 'ai-finding-your-skeletons-long.mp4', mimeType: 'video/mp4', modifiedTime: at('21:32') },
    { id: 'dc-short', name: 'data-centers-and-midterms-short.mp4', mimeType: 'video/mp4', modifiedTime: at('20:47') },
  ]
  const HABITS = 'Which of your habits will cost you your job once AI is at work?'
  const WEEK = ['Should you build or buy your AI?', 'AI is finding your skeletons', 'Data centers and the midterms']

  it('takes his audio take by its name, and none of the takes dropped for other pieces', () => {
    const got = newTakes(INBOX17, '2026-11-17T17:57:14Z', new Set(), [HABITS, `${HABITS}: short cut`], WEEK)
    expect(got.map(t => t.drive_id)).toEqual(['habits'])
  })

  it('a take named for another piece is never taken, even when nothing names this one', () => {
    const got = newTakes(INBOX17.filter(f => f.id !== 'habits'), '2026-11-17T17:57:14Z', new Set(), [HABITS], WEEK)
    expect(got).toEqual([])
  })

  it('a name that names no piece still counts when nothing names this one (a camera export)', () => {
    const dji = { id: 'dji', name: 'dji_export_20261117_202539_editor.mp4', mimeType: 'video/mp4', modifiedTime: at('20:30') }
    expect(newTakes([...INBOX17.filter(f => f.id !== 'habits'), dji], '2026-11-17T17:57:14Z', new Set(), [HABITS], WEEK).map(t => t.drive_id)).toEqual(['dji'])
  })

  it('can fail: a document or picture in the Inbox is never a take', () => {
    const doc = { id: 'doc', name: 'habits notes.pdf', mimeType: 'application/pdf', modifiedTime: at('22:00') }
    expect(newTakes([doc], '2026-11-17T17:57:14Z', new Set(), [HABITS], WEEK)).toEqual([])
  })
})

/** content_ideas and board_documents, enough for the route: reads by id, a list with a filter, and guarded writes. */
function fakeDb(row: Body, picks: Body[], others: Body[] = []) {
  const state = { row: JSON.parse(JSON.stringify(row)) as Body }
  return {
    state,
    db: {
      from: (table: string) => {
        const f: Body = {}; let upd: Body | null = null
        const q: any = {
          select: () => q, eq: (k: string, v: unknown) => { f[k] = v; return q }, neq: () => q, not: () => q, or: () => q, limit: () => q,
          update: (u: Body) => { upd = u; return q },
          maybeSingle: async () => ({ data: f.id === state.row.id ? JSON.parse(JSON.stringify(state.row)) : null, error: null }),
          single: async () => ({ data: f.id === state.row.id ? JSON.parse(JSON.stringify(state.row)) : null, error: null }),
          then: (res: (v: unknown) => unknown) => {
            if (table === 'board_documents') return Promise.resolve({ data: picks, error: null }).then(res)
            if (upd) { const ok = f.id === state.row.id && f.updated_at === state.row.updated_at; if (ok) state.row = { ...state.row, ...upd }; return Promise.resolve({ data: ok ? [{ id: state.row.id }] : [], error: null }).then(res) }
            return Promise.resolve({ data: others, error: null }).then(res)
          },
        }
        return q
      },
    },
  }
}

describe('POST /api/board/<Monday>/takes-in', () => {
  const previous = { ...process.env }
  afterEach(() => { for (const k of ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN']) { if (previous[k] === undefined) delete process.env[k]; else process.env[k] = previous[k] } })
  const ROW = { id: TUE, idea: 'OpenAI', scheduled_for: '2026-11-17', lane_slot: 'mind_the_gap', updated_at: AT, meta: { ...PICKED } }
  const INBOX = [{ id: 'drv1', name: 'openai long.mp4', mimeType: 'video/mp4', size: '400', modifiedTime: '2026-11-17T15:40:00Z' },
    { id: 'drv2', name: 'openai short.mp4', mimeType: 'video/mp4', size: '90', modifiedTime: '2026-11-17T15:50:00Z' },
    { id: 'drv0', name: 'old.mp4', mimeType: 'video/mp4', size: '9', modifiedTime: '2026-11-01T09:00:00Z' }]
  async function press(opts: { operator?: boolean; picks?: Body[]; inbox?: Body; others?: Body[] } = {}) {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
    const { db, state } = fakeDb(ROW, opts.picks ?? [SCRIPTS], opts.others ?? [])
    const dispatched: number[] = []
    const handler = createBoardHandler(async () => db as never, {
      now: () => '2026-11-17T16:00:00.000Z',
      inbox: async () => (opts.inbox ?? { ok: true, folderName: 'Video Engine Inbox', files: INBOX, truncated: false }) as never,
      placeTakes: async (n: number) => { dispatched.push(n); return { sent: true } as never },
    })
    const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
    const headers = opts.operator ? { authorization: 'Bearer synthetic-operator' } : { cookie, origin: 'https://controlcenter.krishraja.com' }
    let status = 0; let out: Body = {}
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(v: Body) { out = v } } as unknown as VercelResponse
    await handler({ method: 'POST', headers, query: { week: W16, op: TAKES_OP }, body: { piece_id: TUE } } as unknown as VercelRequest, res)
    return { status, out, state, dispatched }
  }

  it('writes his takes on the piece by name and asks GitHub to place them on their cuts', async () => {
    const { status, out, state, dispatched } = await press()
    expect(status).toBe(200)
    expect(out.takes.map((t: Body) => t.name)).toEqual(['openai long.mp4', 'openai short.mp4'])
    expect(state.row.meta.takes_in).toMatchObject({ confirmed_at: '2026-11-17T16:00:00.000Z', by: 'Krish', since: APPROVED_AT })
    expect(state.row.meta.style).toEqual(PICKED.style)
    expect(dispatched).toEqual([2])
  })

  it('can fail: his press only, scripts approved first, takes there, the Inbox readable, none another piece holds', async () => {
    expect((await press({ operator: true })).out).toMatchObject({ error: 'his_press' })
    expect(await press({ picks: [] })).toMatchObject({ status: 409, out: { error: 'scripts_not_approved' } })
    const none = await press({ inbox: { ok: true, folderName: 'x', files: [INBOX[2]], truncated: false } })
    expect(none).toMatchObject({ status: 409, out: { error: 'no_new_takes' } })
    expect(none.out.line).toMatch(/^No recording is in the Video Engine Inbox since you approved the scripts on Tue 17 Nov\./)
    expect(none.state.row.meta.takes_in).toBeUndefined()
    expect(await press({ inbox: { ok: false, reason: 'not shared', fix: 'share it' } })).toMatchObject({ status: 503, out: { error: 'inbox_unreadable', fix: 'share it' } })
    const held = await press({ others: [{ id: 'other', meta: { takes_in: { confirmed_at: 'x', files: [{ name: 'openai long.mp4', drive_id: 'drv1' }, { name: 'openai short.mp4', drive_id: 'drv2' }] } } }] })
    expect(held).toMatchObject({ status: 409, out: { error: 'no_new_takes' } })
  })
})
