import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const route = await readFile(new URL('../api/content-seed-candidates.ts', import.meta.url), 'utf8')
assert.match(route, /guardSensitiveRead\(req, res, \['GET'\]\)/)
assert.doesNotMatch(route, /Access-Control-Allow-Origin['"],\s*['"]\*['"]/)
assert.doesNotMatch(route, /error:\s*message/)

const auth = await readFile(new URL('../api/_auth.ts', import.meta.url), 'utf8')
assert.match(auth, /export function guardSensitiveRead/)
// The cookie arm fails closed with no access code: since 14 Nov 2026 every check goes through _accessCookie.ts.
assert.match(auth, /accessCookieValid\(parseCookies\(req\.headers\.cookie\)\[COOKIE\] \|\| '', accessCode\)/)
const cookie = await readFile(new URL('../api/_accessCookie.ts', import.meta.url), 'utf8')
assert.match(cookie, /if \(!code \|\| !supplied\) return false/)
assert.match(auth, /Boolean\(exportToken\)/)
console.log('content seed security invariants passed')
