import { describe, expect, it } from 'vitest'
import { isPriced, MODEL_PRICES, priceFamily, priceUsd, priceUsdDetailed } from '../../apps/control-plane/api/_prices.js'

// The Anthropic table matches as Control Center's api/_prices.ts does (its owner; control-center check:price-drift
// compares the tables): the exact id, else the longest key followed by a dated snapshot suffix only. A plain prefix
// priced claude-opus-5-5 as claude-opus-5 ($5/$25 instead of $4/$20), and isPriced() could never see it.
describe('the price family of a model', () => {
  it('an exact id prices off its own row', () => {
    expect(priceFamily('claude-opus-5-5')).toBe('claude-opus-5-5')
    expect(priceUsd('claude-opus-5-5', 1_000_000, 1_000_000)).toBeCloseTo(24, 9)
    expect(priceUsd('claude-opus-5', 1_000_000, 1_000_000)).toBeCloseTo(30, 9)
    expect(priceUsd('claude-fable-5-1', 1_000_000, 1_000_000)).toBeCloseTo(60, 9)
    expect(priceUsd('claude-sonnet-5-5', 1_000_000, 1_000_000)).toBeCloseTo(12, 9)
  })

  it('a dated snapshot prices off the longest key it extends by -YYYYMMDD, and nothing else does', () => {
    expect(priceFamily('claude-haiku-4-5-20251001')).toBe('claude-haiku-4-5')
    expect(priceFamily('claude-opus-5-5-20261101')).toBe('claude-opus-5-5')
    expect(priceFamily('claude-opus-5-6')).toBeNull()
    expect(priceFamily('claude-opus-5-latest')).toBeNull()
  })

  it('an unknown model is unpriced: zero dollars and isPriced false, never an older rate', () => {
    expect(isPriced('claude-opus-6')).toBe(false)
    expect(priceUsd('claude-opus-6', 1_000_000, 1_000_000)).toBe(0)
    expect(priceUsdDetailed('claude-opus-6', { input: 1, output: 1, cacheRead: 1 })).toBe(0)
  })

  it('a model with its own cache read rate uses it; the rest read back at a tenth of input', () => {
    expect(MODEL_PRICES['claude-opus-5-5'].cacheRead).toBe(0.2)
    expect(priceUsdDetailed('claude-opus-5-5', { input: 0, output: 0, cacheRead: 1_000_000 })).toBeCloseTo(0.2, 9)
    expect(priceUsdDetailed('claude-fable-5-1', { input: 0, output: 0, cacheRead: 1_000_000 })).toBeCloseTo(0.25, 9)
    expect(priceUsdDetailed('claude-sonnet-5-5', { input: 0, output: 0, cacheRead: 1_000_000 })).toBeCloseTo(0.2, 9)
  })
})
