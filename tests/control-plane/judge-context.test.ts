import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'

// What the draft judges read.
//
// Found on the three-piece walk, 2026-09-24: the draft gate's evidence judge
// saw none of the sources a piece was written from. It gave the first draft,
// whose headline figure had no source, a 9, and called the eighth, fully
// sourced, "invented" with a kill. channel_fit had no mandate and guessed
// retired channel names. The row below is the walk piece's real shape.

process.env.SUPABASE_URL = 'http://127.0.0.1:9'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'

const SUB = { slug: 'split_the_bill', label: 'split.the.bill', mandate: 'Work out where the money moves. THE CLOSE is a verdict.' }
const ROW = {
  idea: 'Same agent, opposite answers',
  thesis: 'Amazon blocked Muse; Shopify deepened its partnership.',
  meta: {
    adjacent_stories: [{ title: 'Amazon blocks Muse', url: 'https://www.geekwire.com/x', published_date_iso: '2026-09-21' }],
    materials: [{ kind: 'text', title: 'Amazon 10-K advertising services', content: 'Advertising services revenue was $68.635 billion in 2025. ' + 'x'.repeat(3000) }],
  },
}
const base = { voice: 'VOICE', corpusSlice: 'CORPUS', recentIdeas: ['another idea'], channel: null, sub: SUB, row: ROW }

describe('judgeContext', () => {
  test('the draft gate reads the mandate and the sources on file', async () => {
    const { judgeContext } = await import('../../apps/control-plane/api/content-ideas/[id]/judge.js')
    const c = judgeContext({ ...base, gate: 'draft' })
    assert.match(c, /### The subchannel this is for: split\.the\.bill/)
    assert.match(c, /THE CLOSE is a verdict/)
    assert.match(c, /### The sources on file/)
    assert.match(c, /geekwire\.com\/x/)
    assert.match(c, /\$68\.635 billion/)
  })

  test('a checker gets more of each source than a writer does', async () => {
    const { judgeContext } = await import('../../apps/control-plane/api/content-ideas/[id]/judge.js')
    const c = judgeContext({ ...base, gate: 'draft' })
    // The writer's allowance is 2,400 characters an item; the source is longer.
    const kept = (c.match(/x+/g) || []).reduce((a, m) => Math.max(a, m.length), 0)
    assert.ok(kept > 2400, `kept ${kept} characters of the source`)
  })

  test('the idea gate is unchanged: no sources, no mandate', async () => {
    const { judgeContext } = await import('../../apps/control-plane/api/content-ideas/[id]/judge.js')
    const c = judgeContext({ ...base, gate: 'idea' })
    assert.doesNotMatch(c, /The sources on file|The subchannel this is for/)
    assert.match(c, /### How Krish writes\n\nVOICE/)
  })

  test('the route passes the routed subchannel to the draft gate', () => {
    const src = readFileSync('apps/control-plane/api/content-ideas/[id]/judge.ts', 'utf8')
    assert.match(src, /const sub = gate === 'draft' \? await loadSubchannel\(row\.lane_slot\) : null/)
  })
})

describe('final pass', () => {
  test('has room for a long piece and reads sources at the checker allowance', () => {
    const src = readFileSync('apps/control-plane/api/content-ideas/[id]/final-pass.ts', 'utf8')
    assert.match(src, /maxTokens: 6000/)
    assert.match(src, /materialsContext\(materials, 4000, 16000\)/)
  })
})
