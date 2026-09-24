import { describe, expect, it } from 'vitest'
import { claudeRequestBody, type ClaudeOpts } from '../../apps/control-plane/api/_content.js'
import { DeferredCall, isDeferred } from '../../apps/control-plane/api/_judges/deferred.js'
import { runPanel, standing } from '../../apps/control-plane/api/_judges/panel.js'
import { expand } from '../../apps/control-plane/api/_judges/expand.js'
import { createHash } from 'node:crypto'

// The batched sweep at half price, and the two ways it would be silently wrong.
//
// Neither is visible in an output body, which is why they are tested rather
// than read. A swallowed deferral produces a complete, well-formed judgment of
// nothing — exactly the spend-cap failure of 2026-09-24, where every call after
// the cap failed, every judge abstained, `standing()` correctly returned
// `unjudged`, and 102 rows were written as judged. A cache hit on the bury
// confirmation produces a second reading that agrees with itself.
//
// requestKey is reimplemented here rather than imported: _judges/batch.ts loads
// the Supabase client at module scope, which throws with no credentials, and
// this suite runs without any. The shape it must hold is asserted instead.
const keyOf = (opts: ClaudeOpts) => {
  const sample = Number.isFinite(Number(opts.sample)) ? Number(opts.sample) : 0
  return createHash('sha256').update(`${sample}\u0000${JSON.stringify(claudeRequestBody(opts))}`).digest('hex')
}

const BASE: ClaudeOpts = { system: 'a system prompt', user: 'a question', model: 'claude-haiku-4-5', maxTokens: 900, temperature: 0.2 }

describe('the request key', () => {
  it('is the same for two calls that send the same thing', () => {
    expect(keyOf(BASE)).toBe(keyOf({ ...BASE }))
  })

  it('ignores what the model never sees', () => {
    // agent is a meter stamp and timeoutMs is a client deadline. Keying on
    // either would split one reply into several and pay for each.
    expect(keyOf({ ...BASE, agent: 'judge-novelty', timeoutMs: 45_000 })).toBe(keyOf(BASE))
  })

  it('separates an INDEPENDENT draw of an identical request', () => {
    // The bury confirmation asks the same question twice on purpose. Measured
    // 2026-09-24: only 2 of 10 seeds expanded to the same angle twice, and all
    // the score variance lived in the other eight. A content-keyed cache would
    // hand back the first expansion, the second panel would agree with itself,
    // and the row would record a confirmation nothing tested.
    expect(keyOf({ ...BASE, sample: 2 })).not.toBe(keyOf(BASE))
  })

  it('does not put the sample on the wire', () => {
    expect(JSON.stringify(claudeRequestBody({ ...BASE, sample: 2 })))
      .toBe(JSON.stringify(claudeRequestBody(BASE)))
  })

  it('changes when the prompt changes', () => {
    expect(keyOf({ ...BASE, user: 'a different question' })).not.toBe(keyOf(BASE))
    expect(keyOf({ ...BASE, maxTokens: 901 })).not.toBe(keyOf(BASE))
  })
})

describe('a deferral is never mistaken for a judgment', () => {
  const defer = async () => { throw new DeferredCall('k', 'judge-test') }

  it('escapes the panel instead of becoming nine abstentions', async () => {
    await expect(runPanel({
      gate: 'idea', subjectTable: 'content_ideas', subjectId: 'i1',
      artifact: 'x'.repeat(200), context: 'some context', call: defer,
    })).rejects.toSatisfy(isDeferred)
  })

  it('escapes the expansion instead of becoming a failed expansion', async () => {
    await expect(expand('a seed', 'the mandates', 'what he does', { call: defer }))
      .rejects.toSatisfy(isDeferred)
  })

  it('is what would otherwise read as a clean, complete, empty verdict', () => {
    // The damage a swallowed deferral does, stated as the thing it produces:
    // every judge abstaining is band `unjudged`, which the walk writes onto the
    // row with its artifact_hash, and the next run skips it forever.
    const abstentions = ['novelty', 'evidence', 'consequence'].map(judge => ({
      judge, score: null, verdict: 'abstain' as const,
      the_one_fix: 'the judge could not be reached: deferred:judge-test',
      evidence: [], confidence: null, deterministic: false, model: 'm', adversarial: false,
    }))
    expect(standing(abstentions).band).toBe('unjudged')
    expect(standing(abstentions).score).toBe(null)
  })

  it('still lets a real failure abstain, one judge at a time', async () => {
    let n = 0
    const flaky = async () => {
      n += 1
      if (n === 1) throw new Error('anthropic_529:overloaded')
      return JSON.stringify({ score: 7, verdict: 'pass', the_one_fix: null, evidence: ['a fact'], confidence: 0.8 })
    }
    const panel = await runPanel({
      gate: 'idea', subjectTable: 'content_ideas', subjectId: 'i1',
      artifact: 'x'.repeat(200), context: 'some context', call: flaky,
    })
    const abstained = panel.verdicts.filter(v => v.verdict === 'abstain')
    expect(abstained).toHaveLength(1)
    expect(abstained[0]!.the_one_fix).toMatch(/could not be reached/)
    // The rest still report, which is the whole point of the fail-soft path
    // that the deferral rule must not disturb.
    expect(panel.verdicts.filter(v => v.score !== null).length).toBeGreaterThan(3)
  })
})

describe('isDeferred', () => {
  it('does not fire on an ordinary error', () => {
    expect(isDeferred(new Error('anthropic_429:rate limited'))).toBe(false)
    expect(isDeferred(null)).toBe(false)
    expect(isDeferred({ deferred: true })).toBe(true)
  })
})
