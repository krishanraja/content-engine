import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { addUsage, readUsage } from '../../apps/control-plane/api/_prices.js'

// The judge batch meters one summed usage per model. Summing used to read the
// cache fields by hand in _judges/batch.ts, the pattern check-cache-metering
// exists to stop; the sum now lives beside readUsage, the one parser.
describe('addUsage', () => {
  test('sums every token kind, cache writes by lifetime included', () => {
    const a = { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 5, cache_creation_input_tokens: 7 }
    const b = { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 10, cache_creation: { ephemeral_1h_input_tokens: 4, ephemeral_5m_input_tokens: 6 } }
    const u = readUsage(addUsage(addUsage(null, a), b))
    assert.deepEqual(u, { input: 101, output: 22, cacheRead: 8, cacheWrite5m: 13, cacheWrite1h: 4 })
  })
  test('a missing usage adds nothing', () => {
    assert.deepEqual(readUsage(addUsage(null, undefined)), { input: 0, output: 0, cacheRead: 0, cacheWrite5m: 0, cacheWrite1h: 0 })
  })
})
