import { describe, expect, it } from 'vitest'
import { DEFAULT_WINDOWS_DRIVE_ROOT, canonicalWindowsDrivePath } from '@mindmake/core'

describe('Windows Drive path authority', () => {
  // Krish, 2026-09-28: the Video Studio's Drive moves from G: to H:, the
  // krish@themindmaker.ai account. The old G: folder stays as a rollback copy.
  it('uses the makeyourmindup Video Engine folder on H: as the canonical default (moved 2026-10-07)', () => {
    expect(DEFAULT_WINDOWS_DRIVE_ROOT).toBe('H:\\My Drive\\Ventures\\Active\\makeyourmindup\\Video Engine')
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

  it('still honours the retired G: root when a machine sets it explicitly', () => {
    // The rollback copy: setting the environment back to G: must be obeyed,
    // never silently rewritten to the new default.
    const rollback = 'G:\\My Drive\\Ventures\\Active\\Mindmaker\\04_Content\\Video Engine\\Inbox'
    expect(canonicalWindowsDrivePath(rollback, `${DEFAULT_WINDOWS_DRIVE_ROOT}\\Inbox`)).toBe(rollback)
  })
})
