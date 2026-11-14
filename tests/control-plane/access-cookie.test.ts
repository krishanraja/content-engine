import { describe, expect, it } from 'vitest'
import { accessCookieValid, legacyAccessValue, mintAccessValue } from '../../apps/control-plane/api/_accessCookie'

// Security lane APP-3 (14 Nov 2026; control-center pull request 812): cc_access v2 is accepted beside the old value,
// and minted only when ACCESS_COOKIE_V2=1. The fixed vector below was computed apart, with Python's hmac, from the
// same rule: key = HMAC-SHA256(code, "cc_access v2"), sig = base64url(HMAC-SHA256(key, "v2.<expires>")).
const CODE = 'test-access-code'
const VECTOR = 'v2.1763200000.VsqJxFYGLpa815gV-5Hzny3el0AatUQFZvWz85iPe0o'
const BEFORE = 1763200000 * 1000 - 1
const AFTER = 1763200000 * 1000

describe('cc_access', () => {
  it('mints the fixed vector when v2 is on', () => {
    const now = (1763200000 - 2592000) * 1000
    expect(mintAccessValue(CODE, { ACCESS_COOKIE_V2: '1' }, now)).toBe(VECTOR)
  })
  it('accepts a v2 value before its expiry and refuses it after', () => {
    expect(accessCookieValid(VECTOR, CODE, BEFORE)).toBe(true)
    expect(accessCookieValid(VECTOR, CODE, AFTER)).toBe(false)
  })
  it('refuses a v2 value signed with another code, or with its expiry changed', () => {
    expect(accessCookieValid(VECTOR, 'another-code', BEFORE)).toBe(false)
    expect(accessCookieValid(VECTOR.replace('v2.1763200000', 'v2.1999999999'), CODE, BEFORE)).toBe(false)
    expect(accessCookieValid('v2.1763200000.short', CODE, BEFORE)).toBe(false)
  })
  it('still accepts the old value, and mints it while v2 is off', () => {
    expect(mintAccessValue(CODE, {})).toBe(legacyAccessValue(CODE))
    expect(accessCookieValid(legacyAccessValue(CODE), CODE)).toBe(true)
    expect(accessCookieValid(legacyAccessValue('another-code'), CODE)).toBe(false)
  })
  it('an empty code or an empty cookie accepts nothing', () => {
    expect(accessCookieValid(legacyAccessValue(''), '')).toBe(false)
    expect(accessCookieValid('', CODE)).toBe(false)
  })
})
