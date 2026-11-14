import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { StoreError, addText, shelfRefusal, ventureOf, type StoreDb } from '../../apps/control-plane/api/_pieceStore'
import { inLibrary } from '../../apps/control-plane/api/_researchLibrary'

// A research shelf for every venture (I-30; Ruling, Krish, 2026-11-14: "I want wave 3 now"). Another venture's research
// goes on venture:<slug>, through the same door, with no piece and no working set, and it never reaches Make Your Mind
// Up's Drive research library. The database half (active slugs only, publication refused, same bytes once) is checked by
// the migration's own constraints and board_scope_of; this file checks the door and the mirror.

type Body = Record<string, any>
function fakeDb() {
  const calls: Array<{ fn: string; args: Body }> = []
  const db: StoreDb = {
    rpc(fn, args) {
      calls.push({ fn, args })
      const p = (args as Body).p as Body
      return Promise.resolve({ data: { ok: true, duplicate: false, material: { id: 'm1', scope: `venture:${p.venture}`, venture: p.venture, sha256: 'x' } }, error: null })
    },
    from() { throw new Error('a venture shelf write reads no table') },
  }
  return { db, calls }
}
const RESEARCH = '# Mindmake: who buys AI training for leadership teams\n\nThree findings, each with its source page.'

describe('the venture shelf door', () => {
  it('files a text on venture:<slug> in the store alone, with no piece, day or working set', async () => {
    const { db, calls } = fakeDb()
    const r = await addText(db, { venture: 'mindmake', content: RESEARCH, title: 'Leadership training buyers', session_id: 'wave-s4' }, true, 'Claude Code')
    expect(r).toMatchObject({ ok: true, working_set: 'store_only', shelf: 'venture:mindmake' })
    expect(calls).toHaveLength(1)
    expect(calls[0].fn).toBe('board_material_put')
    const p = calls[0].args.p as Body
    expect(p).toMatchObject({ venture: 'mindmake', storage: 'text', kind: 'research', source: 'session', title: 'Leadership training buyers' })
    expect(p).not.toHaveProperty('piece_id')
    expect(p).not.toHaveProperty('week')
  })

  it('takes a link too, and a named version', async () => {
    const { db, calls } = fakeDb()
    await addText(db, { venture: 'heartside', op: 'link', url: 'https://example.org/report' }, true, 'Claude Code')
    await addText(db, { venture: 'heartside', content: 'v2 of the brief', material_key: 'brief', base_version: 1 }, true, 'Claude Code')
    expect(calls[0].args.p).toMatchObject({ storage: 'link', url: 'https://example.org/report', kind: 'link' })
    expect(calls[1].args.p).toMatchObject({ material_key: 'brief', base_version: 1 })
  })

  it('refuses a malformed slug, publication, and a venture mixed with a piece or a day', () => {
    expect(() => ventureOf({ venture: 'Mind Make!' })).toThrow('invalid_venture')
    expect(() => ventureOf({ venture: 'publication' })).toThrow('publication_files_on_its_pieces')
    expect(() => ventureOf({ venture: 'mindmake', piece_id: '8287846b-6618-4a19-9fb8-23ad4eca2718' })).toThrow('venture_and_piece')
    expect(() => ventureOf({ venture: 'mindmake', week: '2026-11-16', day: 'mon' })).toThrow('venture_and_piece')
    expect(ventureOf({ venture: 'full_time' })).toBe('full_time')
    expect(ventureOf({})).toBeNull()
  })

  it('refuses a text holding a key, an email address or a phone number, and writes nothing', async () => {
    const cases: Array<[string, string]> = [
      ['holds_a_secret', RESEARCH + '\nkey: sk-' + 'a'.repeat(40)],
      ['holds_an_email_address', RESEARCH + '\nContact: someone@example.com'],
      ['holds_a_phone_number', RESEARCH + '\nCall +44 20 7946 0958'],
      ['holds_a_phone_number', RESEARCH + '\nCall (555) 123-4567'],
      ['holds_a_phone_number', RESEARCH + '\nCall 555-123-4567'],
    ]
    for (const [why, content] of cases) {
      const { db, calls } = fakeDb()
      const err = await addText(db, { venture: 'mindmake', content }, true, 'Claude Code').catch(e => e)
      expect(err).toBeInstanceOf(StoreError)
      expect((err as StoreError).status).toBe(422)
      expect((err as StoreError).message).toBe(why)
      expect(calls).toHaveLength(0)
    }
    // The title and the note go through the same door.
    expect(shelfRefusal('clean text', 'Title for a@b.co')).toBe('holds_an_email_address')
  })

  it('lets ordinary research numbers through: years, ranges, money and dates', () => {
    expect(shelfRefusal('Revenue grew from $1,234,567 in 2025 to 2026 levels; 2025-2026 range; 14 Nov 2026; 3.5% of 120,000 firms; v1.2.3')).toBeNull()
  })

  it('leaves the piece and day doors as they were', async () => {
    const { db, calls } = fakeDb()
    await addText(db, { week: '2026-11-16', day: 'tue', content: 'Day note with someone@example.com', material_key: 'n' }, true, 'Claude Code')
    expect(calls[0].args.p).toMatchObject({ week: '2026-11-16', day: 'tue' })
    expect(calls[0].args.p).not.toHaveProperty('venture')
  })
})

describe('the Drive mirror keeps to Make Your Mind Up', () => {
  const research = { kind: 'research', role: 'research', storage: 'text', archived_at: null, bytes: 10 }
  it('never copies a venture shelf item, however research-like', () => {
    expect(inLibrary({ ...research, scope: 'venture:mindmake' })).toBe(false)
    expect(inLibrary({ ...research, scope: '8287846b-6618-4a19-9fb8-23ad4eca2718' })).toBe(true)
    expect(inLibrary({ ...research, scope: 'day:2026-11-16/tue' })).toBe(true)
  })
  it('asks the store for no venture shelf item when it sweeps', () => {
    const src = readFileSync(new URL('../../apps/control-plane/api/_researchLibraryGoogle.ts', import.meta.url), 'utf8')
    expect(src).toContain(".not('scope', 'like', 'venture:%')")
  })
})

describe('the migration holds the shelf in the database', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20261203090000_research_venture_shelves.sql', import.meta.url), 'utf8')
  it('checks the slug against venture_registry, active only, and refuses publication', () => {
    expect(sql).toMatch(/references public\.venture_registry \(slug\)/)
    expect(sql).toMatch(/r\.slug = p_venture and r\.active/)
    expect(sql).toMatch(/publication_files_on_its_pieces/)
    expect(sql).toMatch(/venture <> 'publication'/)
    expect(sql).toMatch(/insert into public\.piece_materials \(scope, piece_id, week, day, venture,/)
  })
})
