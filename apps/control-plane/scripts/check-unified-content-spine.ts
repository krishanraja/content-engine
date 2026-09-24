// The editorial route: one neutral source, two independent series lenses, and
// a child row that never invents its own judgement.
//
// The browser half of this spine stays in Control Center
// (scripts/check-unified-content-spine.mts), which guards the opportunity shape
// and the output registry the Composer reads. This half guards the route that
// turns an approved opportunity into a publication child.
//
//   npx tsx scripts/check-unified-content-spine.ts
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const route = readFileSync(new URL('../api/content-ideas/[id]/editorial-route.ts', import.meta.url), 'utf8')
// guardEngine since 2026-09-24: the cookie or the operator bearer, and it never
// fails open. It must not slip back to nothing, or to the fail-open guard().
assert.match(route, /guardEngine\(req, res, \['POST'\]\)/)
assert.match(route, /editorial-route-v1:/)
assert.match(route, /lane: 'publication'/)
assert.match(route, /const slot = series/)
assert.match(route, /status === 'near_miss' && overrideReason\.length < 8/)
assert.match(route, /hard_editorial_gate_failed/)
assert.doesNotMatch(route, /callClaude|ANTHROPIC_API_KEY|openai/i)


console.log('PASS  the editorial route stays a router: no model call, exact gates, one child per series')
