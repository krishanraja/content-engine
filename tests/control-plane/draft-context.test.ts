import assert from 'node:assert/strict'
import { describe, test } from 'vitest'

// What the draft route hands the model.
//
// Curation (the judge ladder, the contrarian pass, the adjacent-story search,
// Krish's grading notes) writes a lot onto a row, and before 2026-09-24 no
// drafting stage read any of it. These cases pin that none of it is dropped,
// that Krish's notes arrive as his words, and that an empty field adds
// nothing rather than a blank heading. The row is the real shape of the first
// walk piece.

process.env.SUPABASE_URL = 'http://127.0.0.1:9'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'

const ROW = {
  idea: "The Agent That Shops for You Is the Agent That Eats Amazon's Ad Revenue",
  thesis: 'Amazon blocked Meta\'s Muse 12 days after launch, citing identity masking and credential storage.',
  meta: {
    ladder: {
      panel_run_id: 'ebba1eae-7b65-4e9a-bfe3-d6e038c488e8',
      expansion: {
        angle: "Amazon's takedown of Muse is a pricing dispute wearing a security notice.",
        parties: ['Amazon', 'Meta', 'Sellers who buy sponsored placement'],
      },
    },
    contrarian: "Amazon's stated objections concern undisclosed automated access, not advertising revenue.",
    adjacent_stories: [
      { title: "Amazon blocks Meta's Muse AI assistant", url: 'https://www.geekwire.com/x', published_date_iso: '2026-09-21', why_relevant: 'Amazon objected to Muse entering the store without notice.' },
    ],
    krish_notes: [{ note: 'In the absence of tons of evidence, we need to look at hypotheticals and sense-backed predictions.', stage: 'grade' }],
  },
}

describe('draft: the curation context', () => {
  test('every field curation wrote reaches the prompt', async () => {
    const { curationBlock } = await import('../../apps/control-plane/api/content-ideas/[id]/draft.js')
    const block = curationBlock(ROW, 'Label the ad motive as the hypothesis.')
    assert.match(block, /THE SEED/)
    assert.match(block, /pricing dispute wearing a security notice/, 'the angle the panel judged, not only the seed')
    assert.match(block, /Sellers who buy sponsored placement/)
    assert.match(block, /THE COUNTER-CASE[\s\S]*undisclosed automated access/)
    assert.match(block, /geekwire\.com\/x/)
    assert.match(block, /2026-09-21/)
    assert.match(block, /Label the ad motive as the hypothesis/)
  })

  test("Krish's notes arrive verbatim and are attributed to him", async () => {
    const { curationBlock } = await import('../../apps/control-plane/api/content-ideas/[id]/draft.js')
    const block = curationBlock(ROW, null)
    assert.match(block, /KRISH'S NOTES ON THIS PIECE, in his own words:\n- "In the absence of tons of evidence, we need to look at hypotheticals and sense-backed predictions\."/)
  })

  test('an empty row adds only the seed, never a blank heading', async () => {
    const { curationBlock } = await import('../../apps/control-plane/api/content-ideas/[id]/draft.js')
    const block = curationBlock({ idea: 'Just a seed', thesis: null, meta: {} }, null)
    assert.equal(block, 'THE SEED, as it arrived:\nJust a seed')
  })
})
