import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hisWordsProblems, manualProblems, MANUAL_ALLOW_LIST, TRANSCRIBE_EXCEPTION, transcriptionProblems } from '../../scripts/check-control-plane.js'

// Manual is his words (step 3 of the design entropy session, PR 6). The guard
// in scripts/check-control-plane.ts holds two rules: no transcription call
// under apps/ but the one named exception, and no 'manual' a writer could
// store as a content idea's source outside the allow list. Synthetic sources.

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))

describe('rule 1: one way his voice becomes words', () => {
  it('fails a new transcription call under apps/', () => {
    const src = "await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST' })"
    expect(transcriptionProblems('apps/control-plane/api/notes/voice.ts', src)).toHaveLength(1)
  })

  it('ignores one in a comment, and the named exception', () => {
    expect(transcriptionProblems('apps/control-plane/api/x.ts', '// audio/transcriptions went away')).toEqual([])
    expect(transcriptionProblems(TRANSCRIBE_EXCEPTION, "const U = 'https://api.openai.com/v1/audio/transcriptions'")).toEqual([])
  })
})

describe("rule 2: 'manual' is only for his words", () => {
  it('fails a writer that stores manual, however it is spelled', () => {
    for (const src of [
      "await supabase.from('content_ideas').insert({ source_type: 'manual', idea })",
      "const row = { source_type: body.source_type || 'manual' }",
      "const t = 'content_ideas'\nawait insertIdea(\"manual\")",
    ]) expect(manualProblems('apps/control-plane/api/shifts/[id]/write.ts', src), src).toHaveLength(1)
  })

  it("passes a read filter, the allow list, a comment, and files that never touch content_ideas", () => {
    expect(manualProblems('apps/control-plane/api/week/options.ts', "supabase.from('content_ideas').select('id').eq('source_type', 'manual')")).toEqual([])
    expect(manualProblems(MANUAL_ALLOW_LIST, "const ALLOWED_SOURCE = new Set(['manual'])")).toEqual([])
    expect(manualProblems('apps/control-plane/api/x.ts', "// source_type was stored as 'manual' once")).toEqual([])
    expect(manualProblems('apps/control-plane/api/_runs.ts', "const trigger = isScheduled ? 'cron' : 'manual'")).toEqual([])
  })

  it('the tree passes both rules', () => {
    expect(hisWordsProblems(ROOT)).toEqual([])
  })
})

describe('the database holds the same rule', () => {
  const sql = readFileSync('supabase/migrations/20261021100000_manual_is_his_words.sql', 'utf8')

  it('adds content_ideas_manual_is_his_words NOT VALID, with the route\'s pattern, null-safe', async () => {
    // The route's module needs these to load; nothing is called.
    process.env.SUPABASE_URL ||= 'http://127.0.0.1:9'
    process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'not-a-key'
    const { SAID_REF } = await import('../../apps/control-plane/api/content-ideas.js')
    expect(sql).toMatch(/add constraint content_ideas_manual_is_his_words/)
    expect(sql).toMatch(/\) not valid;/)
    expect(sql).toMatch(/source_type is distinct from 'manual'/)
    expect(sql).toContain(`coalesce(source_ref, '') ~ '${SAID_REF.source}'`)
    expect(sql).toMatch(/created_at < timestamptz '2026-10-13 00:00:00\+00'/)
    expect(sql).toMatch(/drop constraint if exists content_ideas_manual_is_his_words/)
  })

  it('CI replays it twice on the minimal fixture, after honest sources, then the regression', () => {
    const ci = readFileSync('.github/workflows/ci.yml', 'utf8')
    const at = (s: string) => ci.indexOf(s)
    const minimal = at('psql_in tests/fixtures/control-plane/content-ideas-minimal.sql')
    const honest = ci.indexOf('psql_in supabase/migrations/20261021080000_honest_sources.sql', minimal)
    const manual = ci.indexOf('psql_in supabase/migrations/20261021100000_manual_is_his_words.sql', honest)
    const again = ci.indexOf('psql_in supabase/migrations/20261021100000_manual_is_his_words.sql', manual + 1)
    const regression = ci.indexOf('psql_in tests/fixtures/control-plane/manual-is-his-words.sql', again)
    expect(minimal).toBeGreaterThan(-1)
    for (const n of [honest, manual, again, regression]) expect(n).toBeGreaterThan(minimal)
    expect([honest, manual, again, regression]).toEqual([...[honest, manual, again, regression]].sort((a, b) => a - b))
  })
})
