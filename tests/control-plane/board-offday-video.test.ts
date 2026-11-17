import { describe, expect, it } from 'vitest'
import { thisWeek } from './board-week-model.test'
import { buildView } from '../../apps/control-plane/api/board/_view'
import { validBody, wordsDocId } from '../../apps/control-plane/api/board/_contracts'
import { inWeek, linkOffdayPiece, offdayPieceId, videoOffday } from '../../apps/control-plane/api/board/_offdayPiece'
import { heldSend } from '../../apps/control-plane/api/board/_weekModel'

// Two of Krish's board reports, 17 Nov, made system fixes for every day (his words: "well ultimately all this feedback
// applies to all relevant days, i told you i do not want one off fixes but system upgrades"):
// - "at no point does a voiceover short give me the same controls as a mon/wed/fri piece in terms of the motion, captions
//   etc etc. why not?"
// - "the button does not seem to work. Would it not just send to teleprompter directly and change the board state
//   immediately?"

type Body = Record<string, any>
const WEEK = '2026-11-09'
const UUID4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const MOTION = [{ id: 'ladder', name: 'Ladder', how: 'Steps.', rules: ['r'], point_types: ['claim'], formats: ['long_video', 'short_video'], fits: 'core', krish_verdict: 'liked', ve_route: ['headline'] }]

function week(extra: Partial<ReturnType<typeof thisWeek>> = {}) {
  const i = thisWeek()
  i.now = new Date('2026-11-09T09:00:00Z') // before its Tuesday, so nothing on it is missed
  ;(i as Body).motion = MOTION
  return Object.assign(i, extra)
}
const tue = (i: ReturnType<typeof week>) => buildView(i).model.days.find(d => d.day === 'tue')!.items

describe("an off-day video post gets a piece's production picks", () => {
  it('only a post cut on the ve route is a video post', () => {
    expect(videoOffday('voiceover', 'Voiceover short with motion graphics, 9:16')).toBe(true)
    expect(videoOffday('meme', 'Meme video, 9:16')).toBe(true)
    expect(videoOffday('good_news', 'Uplifting AI news short, voiceover over real footage, 9:16')).toBe(true)
    for (const [k, f] of [['supporting', 'Carousel, 4 cards'], ['meme', 'Meme, 2 panels, 4:5'], ['explainer', 'Explainer carousel']]) expect(videoOffday(k, f)).toBe(false)
  })

  it('its record id is the piece id its option names, else one derived from the week and the option, the same every read', () => {
    expect(offdayPieceId(WEEK, 'off-tue-x', { piece_id: '701A2C55-7400-4DC8-99CB-D6001147AE16' })).toBe('701a2c55-7400-4dc8-99cb-d6001147ae16')
    const a = offdayPieceId(WEEK, 'off-tue-x', {})
    expect(a).toMatch(UUID4)
    expect(offdayPieceId(WEEK, 'off-tue-x', null)).toBe(a)
    expect(offdayPieceId(WEEK, 'off-tue-y', {})).not.toBe(a)
    expect(offdayPieceId('2026-11-16', 'off-tue-x', {})).not.toBe(a)
  })

  it('the approved voiceover offers the motion and caption picks with its record id and its item; the carousel and meme do not', () => {
    const items = tue(week())
    const vo = items.find(x => x.key === 'off-tue-mcpskin')!
    const id = offdayPieceId(WEEK, 'off-tue-mcpskin', {})
    const looks = (vo.others || []).filter((a: Body) => a.kind === 'press' && (a.op === 'style' || a.op === 'look')) as Body[]
    expect(looks.map(a => a.label)).toEqual(expect.arrayContaining(['Pick the motion style', 'Pick the captions']))
    for (const a of looks) expect(a.body).toMatchObject({ piece_id: id, item: 'off-tue-mcpskin' })
    const homework = items.find(x => x.key === 'off-tue-homework')
    if (homework) expect((homework.others || []).some((a: Body) => a.op === 'style' || a.op === 'look')).toBe(false)
  })

  it('once its record exists, the post reports to it and its picks read back from it', () => {
    const id = offdayPieceId(WEEK, 'off-tue-mcpskin', {})
    const i = week()
    i.pieces = [...i.pieces, { id, idea: 'What MCP actually does', scheduled_for: null, state: 'seeded', buried_at: null, body: '', updated_at: '2026-11-09T08:00:00Z',
      meta: { offday_link: { week: WEEK, day: 'tue', item: 'off-tue-mcpskin' }, style: { motion: 'ladder', captions: null, rejected: { motion: [], captions: [], treatment: [] }, by: 'Krish', at: '2026-11-09T08:30:00Z' } } }]
    const vo = tue(i).find(x => x.key === 'off-tue-mcpskin')!
    // His pick reads back from the record: the press becomes Change the motion style, his pick in it.
    const motion = (vo.others || []).find((a: Body) => a.label === 'Change the motion style') as Body
    expect(JSON.stringify(motion.choose)).toContain('ladder')
    expect(String((vo.next as Body).prompt)).toContain(id)
    // Never a second card on the day: the record is unscheduled.
    expect(tue(i).filter(x => x.type === 'piece' && x.piece_id === id)).toEqual([])
  })

  it('a record belongs to the week it is scheduled in or linked to', () => {
    expect(inWeek({ scheduled_for: '2026-11-10' }, WEEK)).toBe(true)
    expect(inWeek({ scheduled_for: '2026-11-17' }, WEEK)).toBe(false)
    expect(inWeek({ scheduled_for: null, meta: { offday_link: { week: WEEK } } }, WEEK)).toBe(true)
    expect(inWeek({ scheduled_for: null, meta: { offday_link: { week: '2026-11-16' } } }, WEEK)).toBe(false)
    expect(inWeek(null, WEEK)).toBe(false)
  })

  it('makes the record seeded and linked, unscheduled, and links one that exists without touching the rest', async () => {
    const rows: Body[] = []
    const db = {
      from: () => {
        const f: Body = {}; let ins: Body | null = null; let upd: Body | null = null
        const q: any = {
          select: () => q, eq: (k: string, v: unknown) => { f[k] = v; return q },
          insert: (r: Body) => { ins = r; return q }, update: (u: Body) => { upd = u; return q },
          maybeSingle: async () => ({ data: rows.find(r => r.id === f.id) ?? null, error: null }),
          then: (res: (v: unknown) => unknown) => {
            if (ins) { rows.push({ ...ins, updated_at: 'u1' }); return Promise.resolve({ data: [{ id: ins.id }], error: null }).then(res) }
            const r = rows.find(x => x.id === f.id && x.updated_at === f.updated_at)
            if (upd && r) Object.assign(r, upd)
            return Promise.resolve({ data: r ? [{ id: r.id }] : [], error: null }).then(res)
          },
        }
        return q
      },
    }
    const id = offdayPieceId(WEEK, 'off-tue-x', {})
    expect(await linkOffdayPiece(db as never, id, { week: WEEK, day: 'tue', item: 'off-tue-x', title: 'A voiceover' }, 'T')).toBe(true)
    expect(rows[0]).toMatchObject({ id, idea: 'A voiceover', state: 'seeded', meta: { offday_link: { week: WEEK, day: 'tue', item: 'off-tue-x' } } })
    expect('scheduled_for' in rows[0]).toBe(false)
    rows.push({ id: '701a2c55-7400-4dc8-99cb-d6001147ae16', idea: 'Habits', updated_at: 'u2', meta: { making: { kept: true } } })
    expect(await linkOffdayPiece(db as never, '701a2c55-7400-4dc8-99cb-d6001147ae16', { week: WEEK, day: 'tue', item: 'off-tue-y', title: 'Habits' }, 'T')).toBe(true)
    expect(rows[1].meta).toMatchObject({ making: { kept: true }, offday_link: { item: 'off-tue-y' } })
    // can fail: a bad id, a document that is no off-day option, or no words
    expect(await linkOffdayPiece(db as never, 'nope', { week: WEEK, day: 'tue', item: 'off-tue-x', title: 'x' }, 'T')).toBe(false)
    expect(await linkOffdayPiece(db as never, id, { week: WEEK, day: 'tue', item: 'mon-scripts', title: 'x' }, 'T')).toBe(false)
    expect(await linkOffdayPiece(db as never, id, { week: WEEK, day: 'tue', item: 'off-tue-x', title: ' ' }, 'T')).toBe(false)
  })
})

describe('his Approve scripts counts the moment he presses it; a held send is said and handled (Tue 17 Nov)', () => {
  const FRI = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118'
  const said = { words: 'Approve', said_at: '2026-11-17T14:57:28Z', said_where: 'the Publish Board in Control Centre', session_ref: 'https://controlcenter.krishraja.com/#/content', at: '2026-11-17T14:57:28Z' }
  const approval = (send: Body | null) => ({ kind: 'approve_scripts', day: 'tue', via: 'words', approved: true, piece_id: FRI, texts: { long: 'Long words.', short: 'Short words.' },
    titles: { long: 'L', short: 'S' }, folder_title: 'F', ...said, ...(send ? { send } : {}) })
  const HELD = { at: 'x', by: 'content-engine server', status: 'held', error: "these words have not passed the scripts' check, so nothing was sent: a session checks them" }

  // F50 (Krish, 2026-11-17): in his words, never the engine's, and his Approve is the way on.
  it('says in plain words that his scripts never reached his Teleprompter, and that Approve sends them', () => {
    const h = heldSend({ pieces: [], picks: [{ doc_id: wordsDocId('tue', 'scripts', FRI), body: approval(HELD) }] }, FRI)!
    expect(h.line).toBe('Your approved scripts are saved (Tue 17 Nov) but never reached your Teleprompter: the send before today\'s fix waited on checks that your own words no longer wait on. '
      + 'Read or edit them, then press Approve to send exactly those words to your Teleprompter.')
    expect(h.line).not.toMatch(/\.py|making|session/)
  })

  it('can fail: a sent approval, none at all, or a making record that shows them in Teleprompter since, says nothing', () => {
    const doc = (send: Body | null) => [{ doc_id: wordsDocId('tue', 'scripts', FRI), body: approval(send) }]
    expect(heldSend({ pieces: [], picks: doc({ ...HELD, status: 'sent', error: undefined }) }, FRI)).toBeNull()
    expect(heldSend({ pieces: [], picks: doc(null) }, FRI)).toBeNull()
    expect(heldSend({ pieces: [], picks: [] }, FRI)).toBeNull()
    const sentSince = { id: FRI, meta: { making: { teleprompter: { cuts: { long: { script_id: 'a' }, short: { script_id: 'b' } } } } } }
    expect(heldSend({ pieces: [sentSince], picks: doc(HELD) }, FRI)).toBeNull()
  })

  it('a new approval goes under its piece\'s own name; the bare day-wide name is refused', () => {
    const body = approval(null)
    expect(validBody('picks', wordsDocId('tue', 'scripts', FRI), body)).toBe(true)
    expect(validBody('picks', 'tue-scripts-words', body)).toBe(false)
  })
})
