import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))
const { LANE_PROBLEMS, lanePlainProblems } = await import('../apps/control-plane/api/library/_lanes.js')

// Audit ve-11 (14 Nov 2026): a home computer that failed to pull main said so only in its own log, and kept running
// old code. The failure now rides on the lane report the engine already reads and words for Krish.
const ROOT = join(__dirname, '..')
const read = (name: string) => readFileSync(join(ROOT, 'scripts', name), 'utf8').replace(/\r\n/g, '\n')

describe('a failed pull of main reaches the lane report', () => {
  for (const name of ['recordings-upload.ps1', 'library-sync.ps1']) {
    const script = read(name)
    it(`${name}: every pull problem is a known lane problem, kept apart from the per-pass list, and reported`, () => {
      const codes = [...script.matchAll(/Set-PullProblem '([a-z_]+)'/g)].map(m => m[1]!)
      expect(codes.length).toBeGreaterThan(0)
      for (const code of codes) expect(Object.keys(LANE_PROBLEMS), code).toContain(code)
      // A pass clears $script:Problems before it runs; the pull happens outside the pass, so its result must not
      // live in that list.
      expect(script).toContain('$script:PullProblems = New-Object System.Collections.Generic.List[string]')
      expect(script).not.toMatch(/PullProblems\.Clear\(\)/)
      expect(script).toContain('@(@($script:Problems) + @($script:PullProblems) | Select-Object -Unique)')
      // A pull that succeeds clears its problem again.
      expect(script).toMatch(/Set-PullProblem '[a-z_]+' \(\$code -ne 0\)/)
    })
  }

  it('reads as plain words on a fresh report', () => {
    const now = Date.parse('2026-11-14T12:00:00Z')
    const words = lanePlainProblems([{ schema_version: 1, machine: 'HOME-PC', at: '2026-11-14T11:30:00Z',
      problems: ['engine_pull_failed'] } as never], now)
    expect(words).toEqual([`home computer HOME-PC ${LANE_PROBLEMS.engine_pull_failed}`])
  })
})
