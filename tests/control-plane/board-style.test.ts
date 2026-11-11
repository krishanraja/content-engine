import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { CAPTIONS, StyleError, dayStyle, motionBank, nextStyle, sampleUrl, saveStyle, stylePick, type MotionModule, type StyleInputs } from '../../apps/control-plane/api/board/_style.js'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => false, mediaQualityRollout: () => ({ status: 'candidate_pending_calibration' }) }))

// The style choices on a piece (view contract 1.4.0, day.path.style; docs/PUBLISH_BOARDS.md, "The style choices"):
// Krish picks the motion style and the caption style on the board, beside the treatment, and says "Not this" to any he
// does not want; his press writes meta.style on the piece, guarded so a write in between is kept.

type Body = Record<string, any>
const PIECE = '8287846b-6618-4a19-9fb8-23ad4eca2718'
const m = (id: string, fits: string, krish_verdict: string, point_types: string[], formats = ['long_video', 'short_video']): MotionModule =>
  ({ id, name: `The ${id} style`, how: `How ${id} moves.`, rules: [`${id} rule`], point_types, formats, fits, krish_verdict })
const BANK = [m('swiss', 'often', 'untested', ['claim', 'number']), m('ladder', 'often', 'liked', ['number', 'comparison']),
  m('morph', 'sometimes', 'untested', ['transformation']), m('tall-only', 'often', 'untested', ['number'], ['short_video']),
  m('retro', 'rarely', 'not for us', ['mood']), m('ink', 'rarely', 'untested', ['mood'])]
const inputs = (extra: Partial<StyleInputs> = {}): StyleInputs => ({ pieceId: PIECE, meta: {}, formats: ['long_video', 'short_video'], points: null,
  motion: BANK, looks: [{ id: 'face-with-proof', name: 'Face-led', pitch: 'His face with the proof.', status: 'proven' }], recommendedLook: 'face-with-proof', ...extra })
const ids = (o: Array<{ id: string; recommended: boolean }>) => o.filter(x => x.recommended).map(x => x.id)

describe('the motion styles on a piece', () => {
  it('reads the bank\'s motion layer, in bank order', () => {
    const styles = JSON.parse(readFileSync('config/style-references.json', 'utf8'))
    const bank = motionBank(styles)
    expect(bank.length).toBeGreaterThanOrEqual(18)
    expect(bank.every(x => x.name && x.how && x.rules.length && x.formats.length)).toBe(true)
    expect(bank.map(x => x.id)).toEqual(styles.bank.filter((x: Body) => x.layer === 'motion').map((x: Body) => x.id))
  })

  it('recommends at most three, made for every format the piece makes: often first, then his liked ones', () => {
    const s = dayStyle(inputs())
    expect(ids(s.motion.options)).toEqual(['ladder', 'swiss', 'morph'])
    expect(s.motion.options.find(o => o.id === 'ladder')!.why).toBe('You liked it before. It suits the channel often.')
    expect(s.motion.options.find(o => o.id === 'tall-only')!.recommended).toBe(false)
    // Every option is listed, with its rules, point types, formats and both presses.
    expect(s.motion.options.map(o => o.id)).toEqual(['ladder', 'swiss', 'morph', 'tall-only', 'retro', 'ink'])
    expect(s.motion.options[1]).toMatchObject({ line: 'How swiss moves.', rules: ['swiss rule'], point_types: ['claim', 'number'], sample_url: null,
      presses: { yes: { label: 'Yes', op: 'style', body: { piece_id: PIECE, motion: 'swiss' } }, not_this: { label: 'Not this', op: 'style', body: { piece_id: PIECE, reject: { layer: 'motion', id: 'swiss' } } } } })
  })

  it('matches the piece\'s point types when its spec names them', () => {
    const s = dayStyle(inputs({ points: ['transformation'] }))
    expect(ids(s.motion.options)).toEqual(['morph'])
    expect(s.motion.options.find(o => o.id === 'morph')!.why).toBe('It draws the transformation points this piece makes. It suits the channel sometimes.')
    expect(ids(dayStyle(inputs({ formats: ['short_video'], points: ['number'] })).motion.options)).toEqual(['ladder', 'swiss', 'tall-only'])
  })

  it('never recommends one he called not for us, or one he said Not this to on this piece', () => {
    const s = dayStyle(inputs({ points: ['mood'], meta: { style: { rejected: { motion: ['ink'], captions: [] } } } }))
    expect(ids(s.motion.options)).toEqual([])
    expect(s.motion.options.find(o => o.id === 'retro')!.rejected).toBe(true)
    expect(s.motion.options.find(o => o.id === 'ink')!.rejected).toBe(true)
    expect(ids(dayStyle(inputs({ meta: { style: { rejected: { motion: ['ladder'] } } } })).motion.options)).toEqual(['swiss', 'morph', 'ink'])
  })

  it('shows his pick first, then his Pick a style gate, then a creative direction he signed', () => {
    const signed = { piece_id: PIECE, signed: { by: 'Krish', on: '2026-11-15' }, style: { motion: { module: 'morph' } }, brand: { caption_theme: 'cinematic' } }
    const gate = { state: 'picked' as const, at: '2026-11-14T10:00:00Z', sha256: 'a'.repeat(64), module: 'swiss' }
    expect(dayStyle(inputs({ meta: { style: { motion: 'ladder', at: '2026-11-15T11:00:00Z' } }, gate, spec: signed })).motion)
      .toMatchObject({ picked: 'ladder', picked_by: 'Krish', picked_at: '2026-11-15T11:00:00Z' })
    expect(dayStyle(inputs({ gate, spec: signed })).motion).toMatchObject({ picked: 'swiss', picked_by: 'Krish', picked_at: '2026-11-14T10:00:00Z' })
    expect(dayStyle(inputs({ spec: signed })).motion).toMatchObject({ picked: 'morph', picked_by: 'spec', picked_at: '2026-11-15' })
    expect(dayStyle(inputs({ spec: signed })).captions).toMatchObject({ picked: 'cinematic', picked_by: 'spec' })
    // A spec he has not signed is never shown as a pick.
    const unsigned = { ...signed, signed: undefined }
    expect(dayStyle(inputs({ spec: unsigned })).motion).toMatchObject({ picked: null, picked_by: null, picked_at: null })
    expect(dayStyle(inputs({ spec: unsigned })).captions.picked).toBeNull()
  })
})

describe('the caption styles on a piece', () => {
  it('lists every style ve draws, in names.ts order, each with a name, a line and its rules', () => {
    const names = readFileSync('apps/renderer/src/engine/captions/names.ts', 'utf8')
    const listed = [...names.matchAll(/'([a-z0-9-]+)'/g)].map(x => x[1]).filter(x => CAPTIONS.some(c => c.id === x))
    expect(CAPTIONS.map(c => c.id)).toEqual(listed)
    for (const c of CAPTIONS) {
      expect(c.name && c.line && c.rules.length).toBeTruthy()
      expect(`${c.name} ${c.line} ${c.rules.join(' ')}`).not.toMatch(/—/)
    }
  })

  it('recommends his pick, art-directed, with his own words, unless he said Not this to it here', () => {
    const s = dayStyle(inputs())
    expect(ids(s.captions.options)).toEqual(['art-directed'])
    expect(s.captions.options.find(o => o.id === 'art-directed')!.why).toMatch(/like an art director would do them/)
    const no = dayStyle(inputs({ meta: { style: { rejected: { captions: ['art-directed'] } } } }))
    expect(ids(no.captions.options)).toEqual([])
    expect(no.captions.options.find(o => o.id === 'art-directed')!.rejected).toBe(true)
    expect(s.captions.options[0]!.presses.yes.body).toEqual({ piece_id: PIECE, captions: 'pop' })
  })
})

describe('the treatment in the same shape', () => {
  it('lists the looks with the Sunday room\'s recommendation, answered by the look op keeping his experiment and inspiration', () => {
    const s = dayStyle(inputs({ meta: { look: { production: 'face-with-proof', experiment: 'kinetic-movement', inspiration: ['c1'], at: '2026-11-15T10:00:00Z' } } }))
    expect(s.treatment).toMatchObject({ picked: 'face-with-proof', picked_by: 'Krish', picked_at: '2026-11-15T10:00:00Z' })
    expect(s.treatment.options[0]).toMatchObject({ recommended: true, line: 'His face with the proof.',
      presses: { yes: { op: 'look', body: { piece_id: PIECE, production: 'face-with-proof', experiment: 'kinetic-movement', inspiration: ['c1'] } } } })
    expect(s.treatment.options[0]!.presses.not_this).toBeUndefined()
  })
})

describe('a rendered sample', () => {
  it('is only a same-site path, never an outside link', () => {
    expect(sampleUrl('motion', 'ladder', { motion: { ladder: '/api/board/2026-11-16/media/abc' } })).toBe('/api/board/2026-11-16/media/abc')
    expect(sampleUrl('motion', 'ladder', { motion: { ladder: 'https://example.org/x.mp4' } })).toBeNull()
    expect(sampleUrl('motion', 'ladder', { motion: { ladder: '//example.org/x.mp4' } })).toBeNull()
    expect(sampleUrl('captions', 'pop')).toBeNull()
  })
})

describe('his press on a style', () => {
  const motionIds = new Set(BANK.map(x => x.id))
  const refused = (body: Body, ids: Set<string> | null = motionIds) => { try { stylePick(body, ids); return null } catch (e) { return e instanceof StyleError ? [e.status, e.message] : e } }

  it('takes a known motion style, a known caption style, or a Not this on one of either', () => {
    expect(stylePick({ piece_id: PIECE, motion: 'ladder' }, motionIds)).toEqual({ motion: 'ladder' })
    expect(stylePick({ piece_id: PIECE, captions: 'art-directed' }, null)).toEqual({ captions: 'art-directed' })
    expect(stylePick({ piece_id: PIECE, reject: { layer: 'captions', id: 'beast' } }, null)).toEqual({ reject: { layer: 'captions', id: 'beast' } })
    expect(refused({ motion: 'nope' })).toEqual([400, 'unknown_motion'])
    expect(refused({ captions: 'nope' })).toEqual([400, 'unknown_caption'])
    expect(refused({ reject: { layer: 'motion', id: 'nope' } })).toEqual([400, 'unknown_motion'])
    expect(refused({ reject: { layer: 'look', id: 'x' } })).toEqual([400, 'invalid_reject'])
    expect(refused({})).toEqual([400, 'nothing_to_record'])
    expect(refused({ motion: 'ladder' }, null)).toEqual([503, 'styles_unavailable'])
  })

  it('keeps what he said before: a Not this takes the pick away, a pick takes a style off the Not this list', () => {
    const before = { look: { production: 'face-with-proof' }, style: { motion: 'ladder', captions: 'pop', rejected: { motion: ['swiss'], captions: [] } } }
    expect(nextStyle(before, { reject: { layer: 'motion', id: 'ladder' } }, 'T')).toEqual({ motion: null, captions: 'pop', rejected: { motion: ['swiss', 'ladder'], captions: [] }, by: 'Krish', at: 'T' })
    expect(nextStyle(before, { motion: 'swiss' }, 'T')).toEqual({ motion: 'swiss', captions: 'pop', rejected: { motion: [], captions: [] }, by: 'Krish', at: 'T' })
    expect(nextStyle({}, { captions: 'cinematic' }, 'T')).toEqual({ motion: null, captions: 'cinematic', rejected: { motion: [], captions: [] }, by: 'Krish', at: 'T' })
  })
})

/** content_ideas with one row: reads and guarded writes, and another writer that can land between a read and a write. */
function fakeDb(row: Body, landBetween = 0) {
  const state = { row: JSON.parse(JSON.stringify(row)) as Body, writes: 0, conflicts: 0 }
  const db = {
    from: (_table: string) => {
      const filters: Array<[string, unknown]> = []
      let update: Body | null = null
      const match = () => filters.every(([k, v]) => state.row[k] === v)
      const q: any = {
        select: () => q,
        eq: (k: string, v: unknown) => { filters.push([k, v]); return q },
        update: (u: Body) => { update = u; return q },
        single: async () => (match() ? { data: JSON.parse(JSON.stringify(state.row)), error: null } : { data: null, error: { message: 'none' } }),
        maybeSingle: async () => ({ data: match() ? JSON.parse(JSON.stringify(state.row)) : null, error: null }),
        then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => {
          if (update && landBetween > 0) {
            landBetween--
            state.conflicts++
            state.row = { ...state.row, updated_at: `2026-11-16T09:00:0${state.conflicts}Z`, meta: { ...state.row.meta, making: { scripts: 'done' } } }
          }
          const ok = Boolean(update) && match()
          if (ok) { state.row = { ...state.row, ...update }; state.writes++ }
          return Promise.resolve({ data: ok ? [{ id: state.row.id }] : [], error: null }).then(resolve, reject)
        },
      }
      return q
    },
  }
  return { db, state }
}
const ROW = { id: PIECE, idea: 'A piece', scheduled_for: '2026-11-16', lane_slot: 'follow_the_money', updated_at: '2026-11-16T08:00:00Z',
  meta: { look: { production: 'face-with-proof', experiment: null, inspiration: [], at: '2026-11-15T10:00:00Z' } } }

describe('the write', () => {
  it('writes meta.style beside meta.look, and keeps a write that lands in between', async () => {
    const { db, state } = fakeDb(ROW, 1)
    const saved = await saveStyle(db as never, PIECE, { motion: 'ladder' }, new Date('2026-11-16T09:30:00Z'))
    expect(saved).toEqual({ motion: 'ladder', captions: null, rejected: { motion: [], captions: [] }, by: 'Krish', at: '2026-11-16T09:30:00.000Z' })
    expect(state.conflicts).toBe(1)
    expect(state.writes).toBe(1)
    expect(state.row.meta.style).toEqual(saved)
    expect(state.row.meta.look.production).toBe('face-with-proof')
    expect(state.row.meta.making).toEqual({ scripts: 'done' })
  })

  it('says the piece is busy when the writes in between never stop', async () => {
    const { db } = fakeDb(ROW, 99)
    await expect(saveStyle(db as never, PIECE, { captions: 'pop' })).rejects.toMatchObject({ status: 409, message: 'piece_busy' })
  })
})

describe('POST /api/board/<Monday>/style', () => {
  const previous = { ...process.env }
  afterEach(() => {
    for (const key of ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] }
    vi.unstubAllGlobals()
  })
  async function press(body: Body, opts: { row?: Body; operator?: boolean; bank?: Body | null } = {}) {
    process.env.ACCESS_CODE = 'synthetic-board-test'
    process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
    const bank = opts.bank === undefined ? { bank: BANK.map(x => ({ ...x, layer: 'motion' })) } : opts.bank
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: bank !== null, json: async () => bank })))
    const { db, state } = fakeDb(opts.row || ROW)
    const handler = createBoardHandler(async () => db as never)
    const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
    const headers = opts.operator ? { authorization: 'Bearer synthetic-operator' } : { cookie, origin: 'https://controlcenter.krishraja.com' }
    let status = 0; let out: Body = {}
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(v: Body) { out = v } } as unknown as VercelResponse
    await handler({ method: 'POST', headers, query: { week: '2026-11-16', op: 'style' }, body: { piece_id: PIECE, ...body } } as unknown as VercelRequest, res)
    return { status, out, state }
  }

  it('records his pick on the piece and answers with the style', async () => {
    const { status, out, state } = await press({ motion: 'ladder' })
    expect(status).toBe(200)
    expect(out).toMatchObject({ ok: true, style: { motion: 'ladder', captions: null, by: 'Krish' } })
    expect(state.row.meta.style.motion).toBe('ladder')
    expect(state.row.meta.look.production).toBe('face-with-proof')
  })

  it('records a Not this on a caption style with no read of the bank', async () => {
    const { status, state } = await press({ reject: { layer: 'captions', id: 'beast' } }, { bank: null })
    expect(status).toBe(200)
    expect(state.row.meta.style.rejected).toEqual({ motion: [], captions: ['beast'] })
  })

  it('is his press only, on a piece of this week, with a style the engine knows', async () => {
    expect((await press({ motion: 'ladder' }, { operator: true })).out).toMatchObject({ error: 'his_press' })
    expect(await press({ motion: 'ladder' }, { row: { ...ROW, scheduled_for: '2026-11-25' } })).toMatchObject({ status: 404, out: { error: 'piece_not_in_week' } })
    expect(await press({ captions: 'nope' })).toMatchObject({ status: 400, out: { error: 'unknown_caption' } })
    expect(await press({ motion: 'nope' })).toMatchObject({ status: 400, out: { error: 'unknown_motion' } })
    expect(await press({ motion: 'ladder' }, { bank: null })).toMatchObject({ status: 503, out: { error: 'styles_unavailable' } })
    const none = await press({})
    expect(none).toMatchObject({ status: 400, out: { error: 'nothing_to_record' } })
    expect(none.state.writes).toBe(0)
  })
})
