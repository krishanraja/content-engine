import { describe, expect, it } from 'vitest'
import { formatAmount } from './money'

describe('kinetic_stat money (20 Nov 2026 recipe samples printed "195" over "THOUSAND DOLLARS")', () => {
  it('writes money and thousands as a viewer reads them', () => {
    expect(formatAmount(195, 'THOUSAND DOLLARS')).toEqual({ text: '$195,000', unit: '' })
    expect(formatAmount(33, 'THOUSAND DOLLARS')).toEqual({ text: '$33,000', unit: '' })
    expect(formatAmount(2.5, 'MILLION POUNDS')).toEqual({ text: '£2,500,000', unit: '' })
    expect(formatAmount(1200, 'MILLION DOLLARS')).toEqual({ text: '$1.2 billion', unit: '' })
    expect(formatAmount(40, 'THOUSAND jobs')).toEqual({ text: '40,000', unit: 'jobs' })
  })
  it('leaves any other unit exactly as before', () => {
    expect(formatAmount(27, 'PER CENT')).toEqual({ text: '27', unit: 'PER CENT' })
    expect(formatAmount(3, 'item')).toEqual({ text: '3', unit: 'item' })
  })
})
