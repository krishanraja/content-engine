import { describe, expect, it } from 'vitest'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { hisWordsProblems, manualProblems, MANUAL_ALLOW_LIST, transcriptionProblems } from '../../scripts/check-control-plane.js'

// Manual is his words (step 3 of the design entropy session, PR 6). The guard
// in scripts/check-control-plane.ts holds two rules: no transcription call
// under apps/ (no exception since the old idea recorder was deleted), and no
// 'manual' a writer could store as a content idea's source outside the allow
// list. Synthetic sources.

const ROOT = resolve(fileURLToPath(new URL('../..', import.meta.url)))

describe('rule 1: one way his voice becomes words', () => {
  it('fails a new transcription call under apps/', () => {
    const src = "await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST' })"
    expect(transcriptionProblems('apps/control-plane/api/notes/voice.ts', src)).toHaveLength(1)
  })

  it('ignores one in a comment', () => {
    expect(transcriptionProblems('apps/control-plane/api/x.ts', '// audio/transcriptions went away')).toEqual([])
  })

  it('has no exception: the old idea recorder fails too', () => {
    expect(transcriptionProblems('apps/control-plane/api/_whisper.ts', "const U = 'https://api.openai.com/v1/audio/transcriptions'")).toHaveLength(1)
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

  it('reads a Windows checkout the same: a comment ending in CRLF is still a comment', () => {
    const src = "// source_type is never 'manual' here\r\nawait supabase.from('content_ideas').insert({ source_type: 'shift_write' })\r\n"
    expect(manualProblems('apps/control-plane/api/shifts/[id]/write.ts', src)).toEqual([])
    expect(transcriptionProblems('apps/control-plane/api/x.ts', '// audio/transcriptions went away\r\n')).toEqual([])
  })

  it('the tree passes both rules', () => {
    expect(hisWordsProblems(ROOT)).toEqual([])
  })
})
