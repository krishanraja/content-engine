import { describe, expect, it } from 'vitest'
import { buildView, readPieceDecisions, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { DECISIONS_RULE, nextStep, pieceDecisions } from '../../apps/control-plane/api/board/_decisions'
import { createStoreHandler } from '../../apps/control-plane/api/content-ideas/store'
import { approval } from './_approvals'

// F46-asked-for-a-press-already-made (config/failures.json). Tue 17 Nov 2026, piece b019dbf8, the data-centres piece
// placed on Tuesday: at 11:09 UTC Krish pressed Pick the look, Pick the motion style and Pick the captions on the board
// (meta.look and meta.style, by Krish). The board's prompt he then pasted said "step look", and get_piece_board carried
// none of his picks, so at 11:13 the session asked him to press all three again. His words: "I already did that in the
// UI, before I pasted my last prompt to you. Why are you asking me to go back and repeat this?"

type Body = Record<string, any>
const W16 = '2026-11-16'
const TUE = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118'
const AT = '2026-11-17T11:09:12.000Z'
const LOCK = `# Narrative lock: Tue 17\n\npiece_id: ${TUE}\nPublishes: 2026-11-17\n\nThe arc.\n\nSigned by Krish: "Signed.", 2026-11-17`
const PICKED = {
  look: { production: 'face-with-proof', experiment: null, inspiration: [], by: 'Krish', at: AT },
  style: { motion: 'eating-jobs-ladder', captions: 'art-directed', rejected: { motion: [], captions: [], treatment: [] }, by: 'Krish', at: AT },
}
const mod = (id: string, name: string) => ({ id, name, how: `${name}.`, rules: [], point_types: ['claim'], formats: ['long_video', 'short_video'], fits: 'often', krish_verdict: '', ve_route: ['ve'] })
const looks = [{ id: 'face-with-proof', name: 'Face with proof', pitch: 'x', status: 'live' }]

function inputs(meta: Body = {}, picks: Body[] = []): ViewInputs {
  return {
    week: W16, now: new Date('2026-11-17T11:10:00Z'),
    pieces: [{ id: TUE, idea: 'OpenAI pledges to pay for data center power', thesis: 'x', scheduled_for: '2026-11-17', lane_slot: 'mind_the_gap',
      state: 'drafting', buried_at: null, body: '', updated_at: AT, meta }],
    picks, queue: [], history: [], runs: {}, north_star: null, ideas: { days: {} }, locks: { tue: LOCK },
    motion: [mod('eating-jobs-ladder', 'The unwanted neighbour'), mod('swiss-kinetic-type', 'Swiss grid')], formats: { production: looks, script: [] },
    approvals: [approval(W16, 'tue', TUE)], items: [], all_items: [], plans: {},
  } as unknown as ViewInputs
}
const item = (v: ReturnType<typeof buildView>) => v.model!.days.find(d => d.day === 'tue')!.items.find(x => x.piece_id === TUE)!
const prompts = (it: ReturnType<typeof item>) => [it.next, ...it.others].filter((a: any) => a?.kind === 'prompt' && /Claude/.test(a.label)).map((a: any) => String(a.prompt))

describe('F46: a board prompt never asks Krish for a decision he has already made', () => {
  it('17 Nov reproduced: look, motion and captions picked by Krish, so the prompt\'s step is not look and it names his picks', () => {
    const it = item(buildView(inputs(PICKED)))
    const all = prompts(it)
    expect(all.length).toBeGreaterThan(0)
    for (const p of all) {
      expect(p).not.toMatch(/step look\)/)
      expect(p).toMatch(/step board\)/)
      expect(p).toContain(`- Look: done, face-with-proof, by Krish at ${AT} (his press on the board)`)
      expect(p).toContain(`- Motion style: done, eating-jobs-ladder, by Krish at ${AT}`)
      expect(p).toContain(`- Captions: done, art-directed, by Krish at ${AT}`)
      expect(p).toContain('- Narrative lock signed: done')
      expect(p).toContain('- Scripts approved: not made yet')
      expect(p).toContain(DECISIONS_RULE)
    }
    expect(it.line).toBe('Branded: its narrative lock is signed for Tue 17. Your production picks are in. Next: the storyboard and both scripts, for your Approve.')
    expect(it.stage.key).toBe('fleshed_out')
  })
  it('before his picks the step is still look, and the prompt says the three are not made', () => {
    const p = prompts(item(buildView(inputs())))
    expect(p[0]).toMatch(/step look\)/)
    expect(p[0]).toContain('- Look: not made yet')
  })
  it('his scripts approved too: the step is record', () => {
    const scripts = { doc_id: 'tue-scripts', updated_by: 'Krish', updated_at: '2026-11-17T12:00:00Z', body: { approved: true, piece_id: TUE } }
    const it = item(buildView(inputs(PICKED, [scripts])))
    expect(prompts(it)[0]).toMatch(/step record\)/)
    expect(prompts(it)[0]).toContain('- Scripts approved: done, approved, by Krish at 2026-11-17T12:00:00Z')
  })
  it('a decision that could not be read is unknown, never "not made", and leaves no step to act on', () => {
    const d = pieceDecisions({ meta: PICKED, lock: undefined, scripts: undefined })
    expect(d.items.find(x => x.key === 'lock')!.made).toBeNull()
    expect(d.next_step).toBeNull()
    expect(nextStep(pieceDecisions({ meta: {}, lock: { signed: true, on: null, typed: null }, scripts: undefined }).items)).toBe('look')
  })
})

describe('F46: the piece\'s own read (get_piece_board) carries his decisions', () => {
  // A small stand-in for the database: the piece row, the week's presses and the overlay the listing reads.
  const db = (meta: Body, picks: Body[] = []) => {
    const rows: Record<string, Body[]> = {
      content_ideas: [{ id: TUE, idea: 'Data centres', scheduled_for: '2026-11-17', lane_slot: 'mind_the_gap', meta }],
      board_documents: picks.map(p => ({ ...p, week: W16, collection: 'picks' })),
    }
    const query = (table: string) => {
      const filters: Array<[string, unknown]> = []
      const run = () => ({ data: (rows[table] || []).filter(r => filters.every(([k, v]) => r[k] === v)), error: null })
      const q: Body = {
        select: () => q, eq: (k: string, v: unknown) => { filters.push([k, v]); return q },
        maybeSingle: async () => ({ data: run().data[0] ?? null, error: null }),
        then: (ok: (r: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(run()).then(ok, bad),
      }
      return q
    }
    return { from: query, rpc: async () => ({ data: { as_of: AT, materials: [], sessions: [], fields: [], events: [] }, error: null }) }
  }
  const github = async (url: string) => (/narrative-lock-tue\.md$/.test(url) ? new Response(LOCK, { status: 200 })
    : /api\.github\.com/.test(url) ? new Response('{}', { status: 404 }) : new Response('', { status: 404 }))

  it('readPieceDecisions: his three picks, the signed lock and the step they leave, each with who and when', async () => {
    const d = await readPieceDecisions(db(PICKED) as never, TUE, {}, github as never)
    expect(d).toMatchObject({ week: W16, day: 'tue', next_step: 'board', rule: DECISIONS_RULE })
    expect(d!.items.map(x => [x.key, x.made, x.value, x.by, x.at])).toEqual([
      ['lock', true, 'signed', 'Krish', '2026-11-17'],
      ['look', true, 'face-with-proof', 'Krish', AT],
      ['motion', true, 'eating-jobs-ladder', 'Krish', AT],
      ['captions', true, 'art-directed', 'Krish', AT],
      ['scripts', false, null, null, null],
    ])
  })
  it('GitHub unreachable: the lock is unknown, the step is unknown, the picks still show', async () => {
    const d = await readPieceDecisions(db(PICKED) as never, TUE, {}, (async () => { throw new Error('offline') }) as never)
    expect(d!.items.find(x => x.key === 'lock')!.made).toBeNull()
    expect(d!.items.find(x => x.key === 'look')!.made).toBe(true)
    expect(d!.next_step).toBeNull()
  })
  it('GET /api/content-ideas/store?piece=<id> returns them as decisions; a failed read says unread, never not made', async () => {
    const call = async (decide: Parameters<typeof createStoreHandler>[3]) => {
      const handler = createStoreHandler(async () => db(PICKED) as never, undefined, undefined, decide)
      let status = 0, body: Body = {}
      const res: Body = { setHeader: () => res, status: (s: number) => { status = s; return res }, json: (b: Body) => { body = b; return res }, redirect: () => res }
      await handler({ method: 'GET', query: { piece: TUE }, headers: { authorization: 'Bearer k' } } as never, res as never)
      return { status, body }
    }
    process.env.ENGINE_OPERATOR_TOKEN = 'k'
    const ok = await call(async (d, id) => readPieceDecisions(d as never, id, {}, github as never) as never)
    expect(ok.status).toBe(200)
    expect(ok.body.decisions.next_step).toBe('board')
    expect(ok.body.decisions.items.find((x: Body) => x.key === 'look')).toMatchObject({ made: true, value: 'face-with-proof', by: 'Krish', at: AT })
    const failed = await call(async () => { throw new Error('down') })
    expect(failed.body.decisions).toEqual({ unread: true, rule: DECISIONS_RULE })
  })
})
