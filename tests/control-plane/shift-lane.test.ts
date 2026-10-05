import assert from 'node:assert/strict'
import { test } from 'vitest'
import { laneForShift, SHIFT_CATEGORIES } from '../../apps/control-plane/api/_trendGate.ts'

// `shifts.lane` is a foreign key to venture_formats(slug). From 2026-09-19 the
// detector wrote the storage keys `built` and `paid`, the key refused them, and
// every Friday run failed on shifts_lane_fkey with nothing written.
//
// The live list is written out here rather than imported from _subchannels.ts,
// which creates a Supabase client at import time and would need its variables
// in CI.
const LIVE_SUBCHANNELS = ['follow_the_money', 'mind_the_gap', 'under_the_hood']

test('every lane the detector can write is a live subchannel slug, never a retired key', () => {
  for (const category of SHIFT_CATEGORIES) {
    const lane = laneForShift(category)
    if (lane === null) continue
    assert.ok(LIVE_SUBCHANNELS.includes(lane), `${category} maps to ${lane}, which is not a live slug`)
    assert.ok(!['built', 'paid', 'built_with_ai', 'money_of_ai'].includes(lane))
  }
})

test('the mapping follows the format_aliases successors and leaves cross-cutting categories unlaned', () => {
  assert.equal(laneForShift('tools'), 'under_the_hood')
  assert.equal(laneForShift('economics'), 'follow_the_money')
  assert.equal(laneForShift('governance'), null)
})
