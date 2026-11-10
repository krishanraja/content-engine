import { describe, expect, it } from 'vitest'
import { buildView, type ViewInputs } from '../../apps/control-plane/api/board/_view'
import { dayMedia, findMedia, signMedia } from '../../apps/control-plane/api/board/_media'

// The rendered media on the board's view (_media.ts): Control Centre's board shows a day's cuts and thumbnails large
// when they exist (Krish, 2026-11-10: "mock ups and rendered assets are going to actually make up a big part of the
// screen as and when they are available"). Ids only in the view; a signed link only from the media route.

const WEEK = '2026-11-16'
const MON = '8287846b-6618-4a19-9fb8-23ad4eca2718', WED = 'db9f9f6a-1092-49be-8024-f335e060305a'
const SHA_LONG = 'a'.repeat(64)
const making = {
  video_assets: [
    { cut: 'long', name: 'old.mp4', path: '3 Posts/2026-11-16 mon/old-long.mp4', at: '2026-11-14T10:00:00Z' },
    { cut: 'long', name: 'long.mp4', path: '3 Posts/2026-11-16 mon/long.mp4', at: '2026-11-15T10:00:00Z', sha256: SHA_LONG, seconds: 412.4, thumbnail: { path: '3 Posts/2026-11-16 mon/long-thumb.jpg' } },
    { cut: 'short', name: 'short.mp4', path: '3 Posts/2026-11-16 mon/short.mp4', at: '2026-11-15T11:00:00Z' },
  ],
}
const piece = (id: string, date: string, slot: string, m: Record<string, unknown> = {}) =>
  ({ id, idea: `Piece ${id.slice(0, 4)}`, scheduled_for: date, lane_slot: slot, state: 'drafting', buried_at: null, body: '', updated_at: '2026-11-09T12:00:00Z', meta: { making: m } })
const pieces = [piece(MON, '2026-11-16', 'follow_the_money', making), piece(WED, '2026-11-18', 'under_the_hood')]
const inputs = (): ViewInputs => ({ week: WEEK, now: new Date('2026-11-09T18:00:00Z'), pieces, picks: [], queue: [], history: [], runs: {}, north_star: null, ideas: null, locks: {} })

describe('the board view lists rendered media', () => {
  it('lists the newest asset of each cut, then its thumbnail, with ids and no path or link', () => {
    const v = buildView(inputs())
    const mon = v.days.find(d => d.day === 'mon')!
    expect(mon.media.map(m => [m.kind, m.cut])).toEqual([['cut', 'short'], ['cut', 'long'], ['thumbnail', 'long']])
    const long = mon.media.find(m => m.kind === 'cut' && m.cut === 'long')!
    expect(long.id).toBe(SHA_LONG)
    expect(long.seconds).toBe(412)
    expect(long.poster).toBe(mon.media.find(m => m.kind === 'thumbnail')!.id)
    expect(JSON.stringify(v)).not.toMatch(/3 Posts|\.mp4|\.jpg|https?:/)
  })

  it('gives a day with nothing rendered an empty list', () => {
    const v = buildView(inputs())
    expect(v.days.find(d => d.day === 'wed')!.media).toEqual([])
    expect(v.days.find(d => d.day === 'tue')!.media).toEqual([])
    expect(dayMedia(undefined)).toEqual([])
  })

  it('finds a file only by an id on the pieces it is given', () => {
    expect(findMedia(pieces, SHA_LONG)?.path).toBe('3 Posts/2026-11-16 mon/long.mp4')
    expect(findMedia([pieces[1]], SHA_LONG)).toBeNull()
    expect(findMedia(pieces, 'not-an-id')).toBeNull()
    expect(findMedia(pieces, 'b'.repeat(64))).toBeNull()
  })
})

/** A store that answers the reads signMedia makes. */
function store(opts: { rows?: Array<Record<string, unknown>>; failRead?: boolean } = {}) {
  const calls: string[] = []
  const query = (table: string) => {
    const q: Record<string, unknown> = {}
    const chain = () => q
    for (const k of ['select', 'gte', 'lte', 'eq', 'order', 'limit']) q[k] = (...a: unknown[]) => { calls.push(`${table}.${k}:${JSON.stringify(a)}`); return chain() }
    q.then = (resolve: (v: unknown) => void) => resolve(table === 'content_ideas'
      ? (opts.failRead ? { error: { message: 'x' }, data: null } : { error: null, data: pieces })
      : { error: null, data: opts.rows ?? [{ object_key: 'library/aa/bb.mp4', sha256: SHA_LONG }] })
    return q
  }
  const db = {
    from: (t: string) => query(t),
    storage: { from: () => ({ createSignedUrl: async (key: string, ttl: number) => { calls.push(`sign:${key}:${ttl}`); return { error: null, data: { signedUrl: `https://store.example/${key}?t=${ttl}` } } } }) },
  }
  return { db: db as never, calls }
}

describe('the media route signs one file of the week', () => {
  it('signs the library file behind an id of this week', async () => {
    const s = store()
    expect(await signMedia(s.db, WEEK, '2026-11-22', SHA_LONG)).toBe('https://store.example/library/aa/bb.mp4?t=600')
    expect(s.calls.some(c => c.includes('"sha256","' + SHA_LONG + '"'))).toBe(true)
  })

  it('answers nothing for an id that is not on the week, or a file not yet filed', async () => {
    expect(await signMedia(store().db, WEEK, '2026-11-22', 'c'.repeat(64))).toBeNull()
    expect(await signMedia(store({ rows: [] }).db, WEEK, '2026-11-22', SHA_LONG)).toBeNull()
  })

  it('says the store is unavailable rather than answering not found', async () => {
    await expect(signMedia(store({ failRead: true }).db, WEEK, '2026-11-22', SHA_LONG)).rejects.toThrow('board_store_unavailable')
  })
})
