import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Honest sources (step 3 of the design entropy session, PR 1, 2026-10-13).
//
// POST /api/content-ideas used to store a missing or unknown source_type as
// 'manual', and GET /api/week/options reports every manual row as an idea
// Krish dropped in. Now an unknown source is refused with 400
// source_type_unknown, 'lens_radar' (no intake_sources row, so a write of it
// already failed the foreign key) is gone from the list, the shift card writes
// 'shift_write', and Control Center's pilot builder gets 'pilot_build'.
// All fixtures are synthetic.

const db = vi.hoisted(() => ({
  calls: [] as string[],
  inserts: [] as Array<{ table: string; row: Record<string, unknown> }>,
  dedupSources: [] as Array<Record<string, unknown>>,
  // Sources live has no intake_sources row for yet: an insert naming one
  // fails content_ideas_source_type_fkey, as Postgres reports it.
  unregistered: new Set<string>(),
  // When set, POST /api/content-ideas gets past the dedup gate to its insert.
  noDuplicate: false,
}))

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({
  supabase: {
    from(table: string) {
      db.calls.push(table)
      const chain: Record<string, any> = {}
      const rows: Record<string, unknown> = {
        shifts: { id: 'shift-1', slug: 'synthetic-shift', title: 'A synthetic shift', summary: 'A summary.', implication: 'An implication.' },
        content_ideas: { id: 'idea-1' },
      }
      for (const m of ['select', 'eq', 'order', 'limit']) chain[m] = () => chain
      let inserted: Record<string, unknown> | null = null
      chain.insert = (row: Record<string, unknown>) => { db.inserts.push({ table, row }); inserted = row; return chain }
      chain.single = async () => {
        if (table === 'content_ideas' && inserted && db.unregistered.has(String(inserted.source_type))) {
          return {
            data: null,
            error: {
              code: '23503',
              message: 'insert or update on table "content_ideas" violates foreign key constraint "content_ideas_source_type_fkey"',
              details: `Key (source_type)=(${String(inserted.source_type)}) is not present in table "intake_sources".`,
            },
          }
        }
        return { data: rows[table] ?? null, error: null }
      }
      chain.then = (resolve: (v: unknown) => unknown) => resolve({ data: [], error: null })
      return chain
    },
  },
}))

vi.mock('../../apps/control-plane/api/_dedup.js', () => ({
  // Every accepted POST in these tests stops at the dedup gate, so no model,
  // embedding or insert runs: reaching it is the proof the source was accepted.
  checkDuplicate: async () => db.noDuplicate
    ? { is_duplicate: false }
    : { is_duplicate: true, match_id: 'existing-idea', match_reason: 'title_norm', similarity: 1 },
  recordDuplicateSource: async (_table: string, _id: string, src: Record<string, unknown>) => { db.dedupSources.push(src) },
}))

const TOKEN = 'eot_' + 'h'.repeat(40)
const AUTH = { authorization: `Bearer ${TOKEN}` }

async function call(file: string, req: Record<string, unknown>) {
  const { default: handler } = await import(file)
  const out = { status: 0, body: undefined as any }
  const res: Record<string, any> = {
    setHeader() { return res },
    status(code: number) { out.status = code; return res },
    json(body: unknown) { out.body = body; if (!out.status) out.status = 200; return res },
    end() { return res },
  }
  await handler({ headers: AUTH, query: {}, body: {}, ...req } as never, res as never)
  return out
}

const postIdea = (body: Record<string, unknown>) =>
  call('../../apps/control-plane/api/content-ideas.js', { method: 'POST', body })

beforeEach(() => {
  process.env.ENGINE_OPERATOR_TOKEN = TOKEN
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
  delete process.env.ANTHROPIC_API_KEY
  db.calls.length = 0
  db.inserts.length = 0
  db.dedupSources.length = 0
  db.unregistered.clear()
  db.noDuplicate = false
})

describe('POST /api/content-ideas names its source', () => {
  for (const [label, body] of [
    ['a missing source', { raw_text: 'A synthetic idea' }],
    ['an unknown source', { raw_text: 'A synthetic idea', source_type: 'not_a_source' }],
    ['lens_radar, which has no intake_sources row', { raw_text: 'A synthetic idea', source_type: 'lens_radar' }],
    ['a source that is not text', { raw_text: 'A synthetic idea', source_type: 7 }],
  ] as const) {
    it(`refuses ${label} with 400 and the allowed values, and writes nothing`, async () => {
      const { ALLOWED_SOURCE } = await import('../../apps/control-plane/api/content-ideas.js')
      const r = await postIdea(body)
      expect(r.status).toBe(400)
      expect(r.body).toEqual({ ok: false, error: 'source_type_unknown', detail: { allowed: [...ALLOWED_SOURCE] } })
      expect(db.calls).toEqual([])
      expect(db.dedupSources).toEqual([])
    })
  }

  for (const source of ['shift_write', 'pilot_build', 'manual', 'week_research']) {
    it(`accepts ${source} and carries it as written`, async () => {
      const r = await postIdea({ raw_text: 'A synthetic idea', source_type: source })
      expect(r.status).toBe(200)
      expect(r.body).toMatchObject({ ok: true, via: 'dedup', id: 'existing-idea' })
      expect(db.dedupSources).toEqual([{ source_type: source, source_ref: null, source_url: null }])
    })
  }

  it('never stores an unknown source as manual', () => {
    const src = readFileSync('apps/control-plane/api/content-ideas.ts', 'utf8')
    expect(src).not.toMatch(/:\s*'manual'\s*\n/)
    expect(src).toMatch(/error: 'source_type_unknown'/)
  })
})

// The slugs Control Center's supabase/migrations/20260919120000_one_intake.sql
// seeds into intake_sources. That table is created there, not in this repo,
// so its rows are copied here; this repo's own migrations add the rest.
const SEEDED_BY_CONTROL_CENTER = [
  'inspiration_sweep', 'pool_headline', 'aeo_signal', 'build_signal', 'creator_move', 'lane_sourcing',
  'gmail_newsletters', 'drive_files', 'hunter_newsletter_posts', 'manual', 'mm_ctrl_gather',
  'signal_inbox', 'cleo_chat', 'agatha_chat', 'openclaw_workspace', 'zara_signal',
  'synthesis_hypothesis', 'synthesis', 'customer_voice', 'crm_opportunity', 'requested_research',
]

const MIGRATIONS = 'supabase/migrations'

/** Every slug this repo's migrations insert into intake_sources. */
function seededHere(): string[] {
  const out: string[] = []
  for (const f of readdirSync(MIGRATIONS).filter(n => n.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8')
    for (const m of sql.matchAll(/insert into public\.intake_sources[^;]*?values([\s\S]*?)on conflict/gi)) {
      for (const s of m[1].matchAll(/^\s*\(\s*'([a-z_]+)'/gm)) out.push(s[1])
    }
  }
  return out
}

describe('the allowed sources are rows the foreign key admits', () => {
  it('every ALLOWED_SOURCE value is a seeded intake_sources slug', async () => {
    const { ALLOWED_SOURCE } = await import('../../apps/control-plane/api/content-ideas.js')
    const seeded = new Set([...SEEDED_BY_CONTROL_CENTER, ...seededHere()])
    for (const s of ALLOWED_SOURCE) expect(seeded.has(s), s).toBe(true)
  })

  it('lens_radar is neither allowed nor seeded, and the two new sources are both', async () => {
    const { ALLOWED_SOURCE } = await import('../../apps/control-plane/api/content-ideas.js')
    expect(ALLOWED_SOURCE.has('lens_radar')).toBe(false)
    expect(seededHere()).not.toContain('lens_radar')
    for (const s of ['shift_write', 'pilot_build']) {
      expect(ALLOWED_SOURCE.has(s), s).toBe(true)
      expect(seededHere(), s).toContain(s)
    }
  })

  it('the migration adds the control-center owner before the source that needs it, and reads back the foreign key', () => {
    const sql = readFileSync(join(MIGRATIONS, '20261021080000_honest_sources.sql'), 'utf8')
    const owner = sql.search(/insert into public\.intake_owners[\s\S]*?'control-center'/)
    const sources = sql.search(/insert into public\.intake_sources/)
    expect(owner).toBeGreaterThan(-1)
    expect(sources).toBeGreaterThan(owner)
    expect(sql).toMatch(/\('pilot_build',[\s\S]*?'control-center'/)
    expect(sql).toMatch(/\('shift_write',[\s\S]*?'content-engine'/)
    expect(sql).toMatch(/conname = 'intake_sources_owner_fkey'/)
    expect(sql).not.toMatch(/\b(drop|alter|delete|update)\b/i)
  })

  it('CI replays the migration twice and runs both read-back guard cases', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
    const replays = ci.match(/psql_in supabase\/migrations\/20261021080000_honest_sources\.sql/g) || []
    expect(replays.length).toBeGreaterThanOrEqual(3)
    expect(ci).toMatch(/for guard in no-fkey wrong-owner/)
    expect(ci).toContain('honest-sources-guard-$guard.sql')
    for (const f of ['setup', 'before', 'regression']) expect(ci, f).toContain(`honest-sources-${f}.sql`)
    const fixtures = readdirSync('tests/fixtures/control-plane')
    for (const f of ['setup', 'before', 'regression', 'guard-no-fkey', 'guard-wrong-owner']) {
      expect(fixtures, f).toContain(`honest-sources-${f}.sql`)
    }
  })
})

describe('a piece started from a shift card', () => {
  it("is written as 'shift_write', never as one of Krish's drop-ins", async () => {
    const r = await call('../../apps/control-plane/api/shifts/[id]/write.js', { method: 'POST', query: { id: 'shift-1' } })
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true, idea_id: 'idea-1' })
    const ideas = db.inserts.filter(i => i.table === 'content_ideas')
    expect(ideas).toHaveLength(1)
    expect(ideas[0].row).toMatchObject({ source_type: 'shift_write', source_ref: 'shift:synthetic-shift' })
  })
})

// Merge order (review, 2026-10-13): this code can reach live before
// 20261021080000_honest_sources.sql is applied, because a merge deploys and a
// migration is applied by hand. Until then live has no shift_write or
// pilot_build row, and either order must leave the shift card working.
describe('before the migration is applied', () => {
  it('the shift card still starts a piece, as manual with its shift: ref, and says so', async () => {
    db.unregistered.add('shift_write')
    const r = await call('../../apps/control-plane/api/shifts/[id]/write.js', { method: 'POST', query: { id: 'shift-1' } })
    expect(r.status).toBe(200)
    expect(r.body).toEqual({ ok: true, idea_id: 'idea-1', source_type: 'manual', source_pending: 'shift_write' })
    const ideas = db.inserts.filter(i => i.table === 'content_ideas').map(i => i.row)
    expect(ideas.map(i => i.source_type)).toEqual(['shift_write', 'manual'])
    expect(ideas[1]).toMatchObject({ source_ref: 'shift:synthetic-shift' })
  })

  it('the shift card does not retry on any other insert failure', async () => {
    db.unregistered.add('shift_write')
    db.unregistered.add('manual')
    const r = await call('../../apps/control-plane/api/shifts/[id]/write.js', { method: 'POST', query: { id: 'shift-1' } })
    expect(r.status).toBe(500)
    expect(db.inserts.filter(i => i.table === 'content_ideas')).toHaveLength(2)
  })

  it('POST /api/content-ideas answers 400 source_type_not_registered, not a 500', async () => {
    db.unregistered.add('pilot_build')
    db.noDuplicate = true
    const r = await postIdea({ raw_text: 'A synthetic idea', source_type: 'pilot_build' })
    expect(r.status).toBe(400)
    expect(r.body).toEqual({ ok: false, error: 'source_type_not_registered', detail: { source_type: 'pilot_build' } })
  })
})

describe('isUnregisteredSource', () => {
  it('is true only for the source_type foreign key', async () => {
    const { isUnregisteredSource } = await import('../../apps/control-plane/api/_content.js')
    expect(isUnregisteredSource({ code: '23503', message: 'violates foreign key constraint "content_ideas_source_type_fkey"' })).toBe(true)
    expect(isUnregisteredSource({ code: '23503', message: 'violates foreign key constraint "content_ideas_shift_id_fkey"' })).toBe(false)
    expect(isUnregisteredSource({ code: '23505', message: 'content_ideas_source_type_fkey' })).toBe(false)
    expect(isUnregisteredSource(null)).toBe(false)
  })
})
