import { describe, expect, it } from 'vitest'
import { askForBrief, FIRST_ATTEMPT, ROOMY_RETRY } from '../../apps/control-plane/api/briefs/_ask'
import type { ClaudeOpts } from '../../apps/control-plane/api/_content'

// Audit content-engine-7 (14 Nov 2026): briefs_assemble failed every other Friday with "model returned an unusable
// shape (not JSON)". A reply whose thinking spends the ceiling stops at max_tokens with the JSON unclosed. No model is
// called here: the replies are fixtures.
const GOOD = JSON.stringify({
  title: 'T', stance: 'confirms', belief: 'B', standfirst: 'S', consensus_md: 'c', evidence_md: 'e', next_year_md: 'n', position_md: 'p',
  headlines: [1, 2, 3].map(n => ({ id: `s${n}`, headline: `h${n}`, why: 'w', url: 'https://x.test', source: 'x' })),
})
const TRUNCATED = GOOD.slice(0, Math.floor(GOOD.length / 2))
const base = { agent: 'briefs-assemble', model: 'test-model', temperature: 0.4, system: 'SYSTEM', user: 'USER' }

function fake(replies: Array<{ text: string; stopReason: string; output: number }>) {
  const seen: ClaudeOpts[] = []
  const call = async (opts: ClaudeOpts) => {
    seen.push(opts)
    const reply = replies[seen.length - 1]!
    opts.onUsage?.({ input: 100, output: reply.output, model: 'test-model', stopReason: reply.stopReason })
    return reply.text
  }
  return { call, seen }
}

describe('the weekly brief model call', () => {
  it('a reply cut off at the ceiling retries with thinking off and more room, and logs why', async () => {
    const { call, seen } = fake([
      { text: TRUNCATED, stopReason: 'max_tokens', output: 12000 },
      { text: GOOD, stopReason: 'end_turn', output: 3100 },
    ])
    const lines: string[] = []
    const { parsed, attempts } = await askForBrief(call, base, (l) => lines.push(l))
    expect(parsed.title).toBe('T')
    expect(seen.map(o => [o.maxTokens, o.think])).toEqual([[FIRST_ATTEMPT.maxTokens, true], [ROOMY_RETRY.maxTokens, false]])
    expect(ROOMY_RETRY.maxTokens).toBeGreaterThan(FIRST_ATTEMPT.maxTokens)
    expect(seen[1]!.system).toContain('ran out of room')
    expect(attempts.map(a => [a.stopReason, a.fault])).toEqual([['max_tokens', 'not JSON'], ['end_turn', '']])
    expect(lines[0]).toMatch(/stop_reason max_tokens, 12000 output tokens, \d+ characters/)
  })

  it('a closed reply missing a field retries with the same settings and the fault named', async () => {
    const missing = JSON.stringify({ ...JSON.parse(GOOD), belief: '' })
    const { call, seen } = fake([
      { text: missing, stopReason: 'end_turn', output: 3000 },
      { text: GOOD, stopReason: 'end_turn', output: 3000 },
    ])
    await askForBrief(call, base, () => {})
    expect(seen.map(o => [o.maxTokens, o.think])).toEqual([[12000, true], [12000, true]])
    expect(seen[1]!.system).toContain('no belief named')
  })

  it('two misses throw, naming the cut-off', async () => {
    const { call } = fake([
      { text: TRUNCATED, stopReason: 'max_tokens', output: 12000 },
      { text: TRUNCATED, stopReason: 'max_tokens', output: 16000 },
    ])
    await expect(askForBrief(call, base, () => {})).rejects.toThrow('unusable shape (not JSON, cut off at 16000 tokens)')
  })

  it('reads a fenced reply through robustJson', async () => {
    const { call } = fake([{ text: '```json\n' + GOOD + '\n```', stopReason: 'end_turn', output: 3000 }])
    const { attempts } = await askForBrief(call, base, () => {})
    expect(attempts).toHaveLength(1)
  })
})
