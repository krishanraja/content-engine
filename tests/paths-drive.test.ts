import { describe, expect, it } from 'vitest'
import { DEFAULT_WINDOWS_DRIVE_ROOT, canonicalWindowsDrivePath } from '@mindmake/core'

describe('Windows Drive path authority', () => {
  it('uses the mounted 04_Content root as the canonical default', () => {
    expect(DEFAULT_WINDOWS_DRIVE_ROOT).toBe('G:\\My Drive\\Ventures\\Active\\Mindmaker\\04_Content\\Video Engine')
    expect(canonicalWindowsDrivePath(undefined, DEFAULT_WINDOWS_DRIVE_ROOT)).toBe(DEFAULT_WINDOWS_DRIVE_ROOT)
    expect(canonicalWindowsDrivePath(DEFAULT_WINDOWS_DRIVE_ROOT, 'wrong')).toBe(DEFAULT_WINDOWS_DRIVE_ROOT)
  })

  it('replaces the previously configured nonexistent 04\\_Content path', () => {
    const invalidRoot = 'G:\\My Drive\\Ventures\\Active\\Mindmaker\\04\\_Content\\Video Engine'
    const expectedInbox = `${DEFAULT_WINDOWS_DRIVE_ROOT}\\Inbox`
    expect(canonicalWindowsDrivePath(`${invalidRoot}\\Inbox`, expectedInbox)).toBe(expectedInbox)
    expect(canonicalWindowsDrivePath(invalidRoot, DEFAULT_WINDOWS_DRIVE_ROOT)).toBe(DEFAULT_WINDOWS_DRIVE_ROOT)
  })

  it('preserves an explicitly configured different mounted path', () => {
    const alternate = 'H:\\Shared Drive\\Mindmaker Video\\Inbox'
    expect(canonicalWindowsDrivePath(alternate, `${DEFAULT_WINDOWS_DRIVE_ROOT}\\Inbox`)).toBe(alternate)
  })
})
