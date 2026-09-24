import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import { buildReviseSystem } from '../../apps/control-plane/api/_revisePrompt.js'

// A rewrite of a routed piece is held to its subchannel's mandate.
//
// Found on the three-piece walk, 2026-09-24: draft and final-pass read the
// mandate from venture_formats, but revise did not, and its persona line told
// the model every piece ends on a "hard verdict". The lift.the.lid mandate
// forbids a closing moral, so every revise pass on a lift.the.lid piece pulled
// it back toward the close its own mandate fails. The mandate text below is an
// excerpt of the live row.

const LIFT = {
  label: 'lift.the.lid',
  text: 'Take a shipped thing apart to show what is really in it. NO PREACHING: no closing moral, no lesson for leaders. The verdict is the reader\'s to reach.',
}

const ctx = (mandate: typeof LIFT | null) => ({ voice: '', channelCorpus: '', materialsBlock: '', mandate })

describe('revise: a routed piece is rewritten to its mandate', () => {
  test('the mandate reaches the system prompt, whole, and is told it wins', () => {
    const s = buildReviseSystem(ctx(LIFT), { value: 'custom', humour: false })
    assert.match(s, /THE MANDATE FOR LIFT\.THE\.LID/)
    assert.match(s, /The verdict is the reader's to reach/)
    assert.match(s, /the mandate wins/)
  })

  test('the house "hard-verdict endings" line is dropped when a mandate governs the close', () => {
    assert.doesNotMatch(buildReviseSystem(ctx(LIFT), { value: 'custom', humour: false }), /hard-verdict endings/)
  })

  test('an unrouted piece keeps the house voice line exactly as before', () => {
    const s = buildReviseSystem(ctx(null), { value: 'custom', humour: false })
    assert.match(s, /the "Not X, Y" clarifier, hard-verdict endings\./)
    assert.doesNotMatch(s, /THE MANDATE FOR/)
  })

  test('the route loads the mandate for the piece, or for the subchannel it is adapted to', () => {
    const src = readFileSync('apps/control-plane/api/content-ideas/[id]/revise.ts', 'utf8')
    assert.match(src, /loadSubchannel\(adaptMatch \? adaptMatch\[1\] : \(idea as any\)\?\.lane_slot\)/)
    assert.match(src, /mandate: sub \? \{ label: sub\.label, text: sub\.mandate \} : null/)
  })
})
