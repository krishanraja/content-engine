import { spawnSync } from 'node:child_process'
import { copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// Fleet audit 14 Nov (seams-1): two pull requests that each regenerated docs/REPO_MAP.md made each other stale, both
// failed check:repo-map, and sessions merged them around red CI, so main went red. A pull request is now warned for a
// stale map, auto-merge regenerates it on main after the merge, and the full verify starts after that.
const ROOT = join(__dirname, '..')
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8').replace(/\r\n/g, '\n')

describe('the repo map heals itself after a merge', () => {
  it('auto-merge regenerates the map with the fold and starts the full verify after it', () => {
    const text = read('.github/workflows/auto-merge.yml')
    const fold = text.indexOf('name: Fold closeout notes into NOW.md')
    const map = text.indexOf('node scripts/gen-repo-map.mjs', fold)
    const verify = text.indexOf('gh workflow run full-verify.yml')
    expect(fold).toBeGreaterThan(0)
    expect(map).toBeGreaterThan(fold)
    expect(text).toContain('git add -A -- NOW.md now-notes docs/history docs/REPO_MAP.md')
    expect(text).toContain('npm ci --no-audit --no-fund --ignore-scripts')
    expect(verify).toBeGreaterThan(map)
    expect([...text.matchAll(/gh workflow run full-verify\.yml/g)]).toHaveLength(1)
  })

  it('a stale map warns a pull request in CI and still fails everywhere else', () => {
    const map = join(ROOT, 'docs/REPO_MAP.md')
    const keep = map + '.test-keep'
    copyFileSync(map, keep)
    try {
      writeFileSync(map, read('docs/REPO_MAP.md') + '\nstale line\n')
      const run = (event?: string) => spawnSync('node', ['scripts/gen-repo-map.mjs', '--check'], {
        cwd: ROOT, encoding: 'utf8', env: { ...process.env, GITHUB_EVENT_NAME: event ?? '' },
      })
      const pr = run('pull_request')
      expect(pr.status).toBe(0)
      expect(pr.stdout).toContain('::warning::docs/REPO_MAP.md is stale on this pull request')
      const local = run()
      expect(local.status).toBe(1)
      expect(local.stderr).toContain('docs/REPO_MAP.md is stale')
      expect(run('workflow_dispatch').status).toBe(1)
    } finally {
      copyFileSync(keep, map)
      rmSync(keep, { force: true })
    }
  }, 60_000) // three runs of the generator, each a second or two, slower on Windows
})
