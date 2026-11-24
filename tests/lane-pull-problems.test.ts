import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))
const { LANE_PROBLEMS, carryPullSince, lanePlainProblems, parseLaneReport, staleCopies, staleCopyLine } = await import('../apps/control-plane/api/library/_lanes.js')

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
      // A pull (or its heal, Update-HomeCopy) that succeeds clears its problem again; only both failing sets it.
      expect(script).toMatch(/Set-PullProblem '[a-z_]+' \(-not \$copy\.ok\)/)
      expect(script).not.toMatch(/Set-PullProblem '[a-z_]+' \(\$code -ne 0\)/)
    })
  }

  it('reads as plain words on a fresh report', () => {
    const now = Date.parse('2026-11-14T12:00:00Z')
    const words = lanePlainProblems([{ schema_version: 1, machine: 'HOME-PC', at: '2026-11-14T11:30:00Z',
      problems: ['engine_pull_failed'] } as never], now)
    expect(words).toEqual([`home computer HOME-PC ${LANE_PROBLEMS.engine_pull_failed}`])
  })
})

// 18 to 20 Nov 2026: main's history was rewritten, both home computers reported engine_pull_failed for more than a day,
// and the line read like any other. Krish, 2026-11-20: "We need to ensure this can never happen again in the future."
describe('a pull problem held for more than two hours is a stale copy, named with its fix', () => {
  const report = (at: string, problems: string[], pull_since?: Record<string, string>) =>
    parseLaneReport({ machine: 'LORIMER', problems, ...(pull_since ? { pull_since } : {}) }, at)!

  it('keeps when each pull problem was first reported, from the machine\'s last report, never from the machine', () => {
    const first = carryPullSince(null, report('2026-11-18T10:00:00Z', ['engine_pull_failed', 'sending_failed']))
    expect(first.pull_since).toEqual({ engine_pull_failed: '2026-11-18T10:00:00Z' })
    const later = carryPullSince(first, report('2026-11-18T13:00:00Z', ['engine_pull_failed', 'library_source_pull_failed'],
      { engine_pull_failed: '2026-11-19T00:00:00Z' }))
    expect(later.pull_since).toEqual({ engine_pull_failed: '2026-11-18T10:00:00Z', library_source_pull_failed: '2026-11-18T13:00:00Z' })
    // Healed: the problem goes, and so does its time; a report from before pull_since existed starts at its own time.
    expect(carryPullSince(later, report('2026-11-18T13:05:00Z', []))).not.toHaveProperty('pull_since')
    const old = report('2026-11-18T09:00:00Z', ['engine_pull_failed'])
    expect(carryPullSince(old, report('2026-11-18T13:00:00Z', ['engine_pull_failed'])).pull_since)
      .toEqual({ engine_pull_failed: '2026-11-18T09:00:00Z' })
  })

  it('leads the Inbox job\'s problems with the machine, the hours and the fix once held over two hours', () => {
    const now = Date.parse('2026-11-19T12:00:00Z')
    const young = carryPullSince(null, report('2026-11-19T11:00:00Z', ['engine_pull_failed']))
    expect(staleCopies([young], now)).toEqual([])
    expect(lanePlainProblems([young], now)).toEqual([`home computer LORIMER ${LANE_PROBLEMS.engine_pull_failed}`])

    const stale = carryPullSince(report('2026-11-18T10:00:00Z', ['engine_pull_failed', 'library_source_pull_failed']),
      report('2026-11-19T11:55:00Z', ['inbox_unreachable', 'engine_pull_failed', 'library_source_pull_failed']))
    expect(staleCopies([stale], now).map((s) => [s.copy, s.hours])).toEqual([['recordings-source', 26], ['library-source', 26]])
    const words = lanePlainProblems([stale], now)
    expect(words).toHaveLength(3)
    expect(words[0]).toBe(staleCopyLine(staleCopies([stale], now)[0]!))
    expect(words[0]).toMatch(/^home computer LORIMER has run an out-of-date copy of the engine for 26 hours: its recordings-source copy/)
    expect(words[0]).toContain('Fix on LORIMER: in %USERPROFILE%\\Documents\\MindmakeVideoStudio\\recordings-source run git fetch origin main, then git branch backup/manual-20261118 HEAD, then git checkout main, then git reset --hard origin/main')
    expect(words[1]).toMatch(/its library-source copy/)
    expect(words[2]).toBe(`home computer LORIMER ${LANE_PROBLEMS.inbox_unreachable}`)
    for (const line of words) expect(line).not.toMatch(/—/)
  })

  it('stops counting once the report itself is stale: a machine that is off is not a fault', () => {
    const stale = carryPullSince(report('2026-11-18T10:00:00Z', ['engine_pull_failed']), report('2026-11-18T13:00:00Z', ['engine_pull_failed']))
    expect(staleCopies([stale], Date.parse('2026-11-19T12:00:00Z'))).toEqual([])
  })
})
