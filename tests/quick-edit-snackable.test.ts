import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// scripts/quick-edit/snackable.py (W2.9): a short cut from an approved master by word range, in and out only in clean
// gaps (80 ms wide, 30 ms clear), so his words are never cut, changed or out of sync (floor never 3). A master counts as
// approved only when its sha256 is in the piece's sealed manifest. Synthetic word clocks and a synthetic clip only.

const ROOT = join(__dirname, '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'

describe('snackable cuts (W2.9)', () => {
  it('self-test: clean gaps only, the nearest clean range named, approved masters only, a render the plan\'s length', () => {
    const r = spawnSync(PY, [join(ROOT, 'scripts', 'quick-edit', 'snackable.py'), 'self-test'], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(r.stdout).toMatch(/snackable self-test passed/)
  }, 120_000)
})
