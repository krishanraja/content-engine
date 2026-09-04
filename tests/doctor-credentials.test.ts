import { describe, expect, it } from 'vitest'
import { credentialHasMinimumBytes } from '@mindmake/core'

describe('runner credential doctor boundary', () => {
  it('requires at least 32 encoded bytes for bearer and signing material', () => {
    expect(credentialHasMinimumBytes('a'.repeat(31))).toBe(false)
    expect(credentialHasMinimumBytes('a'.repeat(32))).toBe(true)
    expect(credentialHasMinimumBytes('🔐'.repeat(8))).toBe(true)
  })
})
