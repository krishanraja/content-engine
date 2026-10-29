import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// The published-standard floor in the tools (Wave 2, W2.5). Floor nevers block (lip sync, never 3; official logos,
// never 6); aims are measured and reported, never blocking (stabilisation, chapter lifts). All on synthetic media.

const ROOT = join(__dirname, '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'

describe('the floor in the tools', () => {
  for (const [name, args] of [
    ['loudness after the encode, the share copy, chapter lifts, stabilisation, lip sync, privacy crop, the sound slot, logos and overnight artwork',
      ['tests/quick_edit_floor_test.py']],
    ['the logo-registry gate', ['scripts/post-pack/logo_gate.py', '--self-test']],
  ] as const) {
    it(name, () => {
      const r = spawnSync(PY, [...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
      expect(r.status, r.stdout + r.stderr).toBe(0)
    }, 300_000)
  }
})
