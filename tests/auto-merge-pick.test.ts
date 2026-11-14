import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Security lane APP-2 (14 Nov 2026): this repository is public, and auto-merge merged any green pull request on the
// branch name a CI run reported, a fork's included. The real jq rule (.github/scripts/auto-merge-pick.jq) against
// six fixtures, as control-center's tests/api/autoMergeGuard.test.ts does.
const ROOT = join(__dirname, '..')
const RULE = join(ROOT, '.github/scripts/auto-merge-pick.jq')
const SHA = 'a'.repeat(40)
const hasJq = spawnSync('jq', ['--version']).status === 0

function pick(prs: unknown[]) {
  const r = spawnSync('jq', ['-r', '--arg', 'sha', SHA, '--arg', 'owner', 'krishanraja', '-f', RULE], { input: JSON.stringify(prs), encoding: 'utf8' })
  expect(r.status, r.stderr).toBe(0)
  return r.stdout.trim()
}
const pr = (over: Record<string, unknown> = {}) => ({ number: 7, headRefOid: SHA, isDraft: false, isCrossRepository: false,
  author: { login: 'krishanraja' }, headRepositoryOwner: { login: 'krishanraja' }, ...over })

describe.skipIf(!hasJq)('auto-merge picks only our own pull request', () => {
  it('ours and the Actions bot merge', () => {
    expect(pick([pr()])).toBe('7')
    expect(pick([pr({ author: { login: 'app/github-actions' } })])).toBe('7')
  })
  it('a fork, a foreign owner, a stranger, a draft or another commit never merge', () => {
    expect(pick([pr({ isCrossRepository: true })])).toBe('')
    expect(pick([pr({ headRepositoryOwner: { login: 'someone' } })])).toBe('')
    expect(pick([pr({ author: { login: 'stranger' } })])).toBe('')
    expect(pick([pr({ isDraft: true })])).toBe('')
    expect(pick([pr({ headRefOid: 'b'.repeat(40) })])).toBe('')
  })
  it('the workflow uses the rule from main and skips a fork run before any step', () => {
    const wf = readFileSync(join(ROOT, '.github/workflows/auto-merge.yml'), 'utf8')
    expect(wf).toContain("github.event.workflow_run.head_repository.full_name == github.repository")
    expect(wf).toContain('-f .auto-merge-pick/.github/scripts/auto-merge-pick.jq')
    expect(wf).toContain('ref: ${{ github.event.repository.default_branch }}')
  })
})
