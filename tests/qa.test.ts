import { describe, expect, it } from 'vitest'
import { publicCopyChecks } from '@mindmake/core'

describe('public copy gates', () => {
  it('blocks legacy names and em dashes', () => {
    const checks = publicCopyChecks('Paid — the old series')
    expect(checks.filter((check) => check.status === 'fail')).toHaveLength(2)
  })

  it('accepts canonical series names', () => {
    expect(publicCopyChecks('The Money of AI and Built With AI').every((check) => check.status === 'pass')).toBe(true)
  })
})
