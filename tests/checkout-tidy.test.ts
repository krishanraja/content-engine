import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { hostname, tmpdir } from 'node:os'
import { join } from 'node:path'

// scripts/checkout_tidy.mjs on throwaway repositories: a bare origin and a clone, each case built from scratch.
// Ruling (Krish, 2026-11-15): every session on his computers leaves the content-engine checkout on an up-to-date main.
const script = join(import.meta.dirname, '..', 'scripts', 'checkout_tidy.mjs')

// The script skips CI and cloud containers; the tests run it as his home computer would.
const env: NodeJS.ProcessEnv = { ...process.env }
for (const key of ['CI', 'GITHUB_ACTIONS', 'CLAUDE_CODE_REMOTE', 'CHECKOUT_TIDY_OFF', 'CLAUDE_PROJECT_DIR']) delete env[key]
Object.assign(env, {
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@invalid', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@invalid',
  GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
})

let root: string
let origin: string
let work: string

function git(cwd: string, ...args: string[]) {
  const r = spawnSync('git', args, { cwd, env, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
  return r.stdout.trim()
}
function commit(cwd: string, file: string, text: string, message = `edit ${file}`) {
  writeFileSync(join(cwd, file), text)
  git(cwd, 'add', file)
  git(cwd, 'commit', '-q', '-m', message)
}
function tidy(args: string[] = [], input = '', extraEnv: NodeJS.ProcessEnv = {}, cwd = work) {
  const r = spawnSync(process.execPath, [script, ...args], { cwd, env: { ...env, ...extraEnv }, input, encoding: 'utf8' })
  expect(r.status).toBe(0)
  return r.stdout.trim()
}
const branch = (cwd = work) => git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD')
const head = (cwd = work) => git(cwd, 'rev-parse', 'HEAD')
const originMain = () => git(origin, 'rev-parse', 'main')
const lockPath = () => join(work, '.git', 'session.lock')

// Another clone that pushes to origin, standing in for GitHub merging pull requests.
function upstreamCommit(file: string, text: string) {
  const other = join(root, 'other')
  if (!existsSync(other)) git(root, 'clone', '-q', origin, 'other')
  git(other, 'pull', '-q', 'origin', 'main')
  commit(other, file, text)
  git(other, 'push', '-q', 'origin', 'main')
  return other
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'checkout-tidy-'))
  origin = join(root, 'origin.git')
  git(root, 'init', '-q', '--bare', '-b', 'main', origin)
  const seed = join(root, 'seed')
  git(root, 'init', '-q', '-b', 'main', seed)
  commit(seed, 'README.md', 'one\n')
  git(seed, 'remote', 'add', 'origin', origin)
  git(seed, 'push', '-q', 'origin', 'main')
  git(root, 'clone', '-q', origin, 'work')
  work = join(root, 'work')
})
afterEach(() => rmSync(root, { recursive: true, force: true }))

describe('checkout_tidy', () => {
  it('is silent when main is already current', () => {
    expect(tidy()).toBe('')
    expect(branch()).toBe('main')
  })

  it('fast-forwards main that has fallen behind', () => {
    upstreamCommit('a.txt', 'a\n')
    upstreamCommit('b.txt', 'b\n')
    expect(tidy()).toMatch(/fast-forwarded main 2 commit/)
    expect(head()).toBe(originMain())
  })

  it('switches off a branch that is an ancestor of origin/main, and keeps the branch', () => {
    git(work, 'checkout', '-q', '-b', 'feature')
    commit(work, 'f.txt', 'f\n')
    git(work, 'push', '-q', 'origin', 'feature:main')
    upstreamCommit('later.txt', 'later\n')
    expect(tidy()).toMatch(/switched to main/)
    expect(branch()).toBe('main')
    expect(head()).toBe(originMain())
    expect(git(work, 'branch', '--list', 'feature')).toContain('feature')
  })

  it('switches off a squash-merged branch whose upstream was deleted', () => {
    git(work, 'checkout', '-q', '-b', 'claude/old-session')
    commit(work, 'f.txt', 'f1\n')
    commit(work, 'f.txt', 'f2\n')
    git(work, 'push', '-q', '-u', 'origin', 'claude/old-session')
    // GitHub's squash merge: one new commit on main with the branch's whole change, then the branch is deleted.
    const other = upstreamCommit('f.txt', 'f2\n')
    git(other, 'push', '-q', 'origin', '--delete', 'claude/old-session')
    upstreamCommit('later.txt', 'later\n')
    expect(tidy()).toMatch(/switched to main/)
    expect(branch()).toBe('main')
    expect(head()).toBe(originMain())
    expect(git(work, 'branch', '--list', 'claude/old-session')).toContain('claude/old-session')
  })

  it('leaves a dirty tree untouched, says how to keep the change and records it', () => {
    git(work, 'checkout', '-q', '-b', 'feature')
    upstreamCommit('a.txt', 'a\n')
    writeFileSync(join(work, 'README.md'), 'edited by hand\n')
    const before = head()
    const out = tidy()
    expect(out).toMatch(/uncommitted changes \(README\.md\)/)
    expect(out).toMatch(/git stash push -m/)
    expect(branch()).toBe('feature')
    expect(head()).toBe(before)
    expect(readFileSync(join(work, 'README.md'), 'utf8')).toBe('edited by hand\n')
    const log = readFileSync(join(work, '.scratch', 'checkout-tidy.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
    expect(log.at(-1)).toMatchObject({ outcome: 'held', branch: 'feature', files: ['README.md'] })
  })

  it('leaves a dirty main untouched even when it is behind', () => {
    upstreamCommit('a.txt', 'a\n')
    writeFileSync(join(work, 'README.md'), 'mine\n')
    const before = head()
    expect(tidy()).toMatch(/uncommitted changes/)
    expect(head()).toBe(before)
  })

  it('leaves a branch with unmerged commits untouched', () => {
    git(work, 'checkout', '-q', '-b', 'wip')
    commit(work, 'w.txt', 'work in progress\n')
    git(work, 'push', '-q', '-u', 'origin', 'wip')
    upstreamCommit('a.txt', 'a\n')
    const before = head()
    expect(tidy()).toMatch(/1 commit\(s\) not on origin\/main/)
    expect(branch()).toBe('wip')
    expect(head()).toBe(before)
  })

  it('leaves a local main with unpushed commits untouched', () => {
    commit(work, 'local.txt', 'local\n')
    upstreamCommit('a.txt', 'a\n')
    const before = head()
    expect(tidy()).toMatch(/local main has 1 commit/)
    expect(head()).toBe(before)
  })

  it('skips a linked worktree', () => {
    upstreamCommit('a.txt', 'a\n')
    const wt = join(root, 'wt')
    git(work, 'worktree', 'add', '-q', '-b', 'wt-branch', wt)
    const before = head(wt)
    expect(tidy([], '', {}, wt)).toBe('')
    expect(branch(wt)).toBe('wt-branch')
    expect(head(wt)).toBe(before)
  })

  it('skips CI and a cloud container', () => {
    upstreamCommit('a.txt', 'a\n')
    const before = head()
    expect(tidy([], '', { CI: 'true' })).toBe('')
    expect(tidy([], '', { CLAUDE_CODE_REMOTE: 'true' })).toBe('')
    expect(head()).toBe(before)
  })

  it('skips a checkout another live session holds', () => {
    upstreamCommit('a.txt', 'a\n')
    const before = head()
    writeFileSync(lockPath(), JSON.stringify({ session_id: 'other', pid: process.pid, host: hostname(), started_at: new Date().toISOString() }))
    expect(tidy(['--hook', 'start'], JSON.stringify({ session_id: 'mine' }))).toMatch(/another session \(other/)
    expect(head()).toBe(before)
    expect(JSON.parse(readFileSync(lockPath(), 'utf8')).session_id).toBe('other')
  })

  it('takes over a stale lock: a gone pid, or older than 12 hours', () => {
    upstreamCommit('a.txt', 'a\n')
    writeFileSync(lockPath(), JSON.stringify({ session_id: 'gone', pid: 2 ** 22 + 12345, host: hostname(), started_at: new Date().toISOString() }))
    expect(tidy(['--hook', 'start'], JSON.stringify({ session_id: 'mine' }))).toMatch(/fast-forwarded/)
    expect(JSON.parse(readFileSync(lockPath(), 'utf8')).session_id).toBe('mine')

    upstreamCommit('b.txt', 'b\n')
    const old = new Date(Date.now() - 13 * 60 * 60 * 1000).toISOString()
    writeFileSync(lockPath(), JSON.stringify({ session_id: 'old', pid: process.pid, host: hostname(), started_at: old }))
    expect(tidy(['--hook', 'start'], JSON.stringify({ session_id: 'mine2' }))).toMatch(/fast-forwarded/)
    expect(head()).toBe(originMain())
  })

  it('start writes the lock and end releases its own lock, then tidies', () => {
    expect(tidy(['--hook', 'start'], JSON.stringify({ session_id: 's1' }))).toBe('')
    const lock = JSON.parse(readFileSync(lockPath(), 'utf8'))
    expect(lock).toMatchObject({ session_id: 's1', host: hostname() })
    expect(typeof lock.pid).toBe('number')
    upstreamCommit('a.txt', 'a\n')
    expect(tidy(['--hook', 'end'], JSON.stringify({ session_id: 's1' }))).toMatch(/fast-forwarded/)
    expect(existsSync(lockPath())).toBe(false)
  })

  it('does nothing when origin cannot be reached', () => {
    git(work, 'remote', 'set-url', 'origin', join(root, 'missing.git'))
    expect(tidy()).toBe('')
    expect(branch()).toBe('main')
  })
})
