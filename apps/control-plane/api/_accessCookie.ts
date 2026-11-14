import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

// The cc_access cookie Control Center's gate issues for the access code (security lane APP-3, 14 Nov 2026;
// control-center pull request 812). Two forms are accepted:
//   v2.<expiresUnixSeconds>.<sig>, sig = base64url(no padding) of HMAC-SHA256(key, "v2.<expires>"), where
//     key = HMAC-SHA256(key = ACCESS_CODE, message "cc_access v2"); valid only before its expiry.
//   the old sha256(ACCESS_CODE) hex value, until Control Center stops minting it.
// Minting follows ACCESS_COOKIE_V2: "1" mints v2 (30 days), anything else the old value. The one copy of this rule
// for every check and every call this engine makes to Control Center.

const V2 = /^v2\.(\d{9,12})\.([A-Za-z0-9_-]{43})$/
const V2_LIFETIME_S = 2592000

const b64url = (b: Buffer) => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

export function v2Signature(code: string, signed: string): string {
  const key = createHmac('sha256', code).update('cc_access v2').digest()
  return b64url(createHmac('sha256', key).update(signed).digest())
}

function same(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8')
  const bb = Buffer.from(b, 'utf8')
  return ba.length === bb.length && timingSafeEqual(new Uint8Array(ba), new Uint8Array(bb))
}

export function legacyAccessValue(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

/** Whether a supplied cc_access value is valid for this access code now. An empty code accepts nothing. */
export function accessCookieValid(supplied: string, code: string, nowMs: number = Date.now()): boolean {
  if (!code || !supplied) return false
  const m = V2.exec(supplied)
  if (m) {
    const expires = Number(m[1])
    if (!(expires * 1000 > nowMs)) return false
    return same(m[2]!, v2Signature(code, `v2.${m[1]}`))
  }
  return same(supplied, legacyAccessValue(code))
}

/** The cc_access value this engine sends: v2 when ACCESS_COOKIE_V2 is "1", else the old value. */
export function mintAccessValue(code: string, env: Record<string, string | undefined> = process.env, nowMs: number = Date.now()): string {
  if (env.ACCESS_COOKIE_V2 !== '1') return legacyAccessValue(code)
  const signed = `v2.${Math.floor(nowMs / 1000) + V2_LIFETIME_S}`
  return `${signed}.${v2Signature(code, signed)}`
}
