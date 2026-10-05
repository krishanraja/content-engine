import assert from 'node:assert/strict'
import { test, vi } from 'vitest'

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))
const { summariseRepoErrors } = await import('../../apps/control-plane/api/discover-build-signals.ts')

// On 2026-09-26 and 2026-10-03 every repository answered 401 and the run
// ledger said only "the job reported failure without a reason".

test('a run where every repo failed names the cause and the fix', () => {
  const body = 'github https://api.github.com/repos/krishanraja/control-center/commits: HTTP 401 {\r\n  "message": "Bad credentials",\r\n  "status": "401"\r\n}'
  const reason = summariseRepoErrors({ 'krishanraja/control-center': body, 'krishanraja/mindmake': body })
  assert.match(reason, /all 2 repositories failed/)
  assert.match(reason, /GitHub 401 Bad credentials/)
  assert.match(reason, /GITHUB_TOKEN is rejected/)
})

test('an error with no HTTP status is passed through, shortened', () => {
  assert.match(summariseRepoErrors({ 'a/b': 'socket hang up' }), /first a\/b: socket hang up/)
})
