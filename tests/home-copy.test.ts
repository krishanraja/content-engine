import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// scripts/home-copy.ps1: the one way a home computer pulls its machine-owned copies (recordings-source,
// library-source), and heals them when main's history was rewritten.
//
// 18 to 20 Nov 2026: main was force-rewritten on GitHub (a history scrub). Every machine-owned copy on both home
// computers was then ahead (the old history) and behind, `git pull --ff-only` failed on every pass for more than a
// day, and the lanes ran old code. Krish fixed each copy by hand, then: "We need to ensure this can never happen again
// in the future."
//
// The static half runs everywhere. The behavioral half needs PowerShell, so it runs on Windows (the full verify after
// merge runs there) or wherever pwsh is installed: an origin whose main is rewritten, and a machine-owned clone that is
// left both ahead and behind.

const ROOT = join(__dirname, '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n')
const helper = read('scripts/home-copy.ps1')
const upload = read('scripts/recordings-upload.ps1')
const sync = read('scripts/library-sync.ps1')
const installer = read('scripts/install-recordings-upload.ps1')
const body = (source: string, name: string) => {
  const start = source.indexOf(`function ${name}`)
  expect(start, name).toBeGreaterThan(-1)
  const next = source.indexOf('\nfunction ', start + 1)
  return source.slice(start, next === -1 ? undefined : next)
}

const shell = (() => {
  for (const candidate of process.platform === 'win32' ? ['powershell.exe', 'pwsh'] : ['pwsh']) {
    if (spawnSync(candidate, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8' }).status === 0) return candidate
  }
  return null
})()

describe('the shared pull and heal of a machine-owned copy', () => {
  it('is plain ASCII and runs nothing when it is dot-sourced', () => {
    expect([...helper].filter((ch) => ch.charCodeAt(0) > 127)).toEqual([])
    const code = helper.slice(helper.indexOf('#>') + 2)
    // Only the folder list and function definitions at the top level.
    const topLevel = code.split('\n').filter((line) => line && !/^\s/.test(line) && !line.startsWith('#') && !line.startsWith('}'))
    expect(topLevel.every((line) => line.startsWith('function ') || line.startsWith('$HomeCopyFolders = '))).toBe(true)
  })

  it('owns only recordings-source and library-source: never runner-source, never a person\'s copy', () => {
    expect(helper).toContain("$HomeCopyFolders = @('recordings-source', 'library-source')")
    expect(helper).not.toMatch(/\$HomeCopyFolders = [^\n]*runner-source/)
    const update = body(helper, 'Update-HomeCopy')
    // The ownership check comes before any git call.
    expect(update.indexOf('Test-HomeCopyOwned $Repo')).toBeGreaterThan(-1)
    expect(update.indexOf('Test-HomeCopyOwned $Repo')).toBeLessThan(update.indexOf('Invoke-HomeCopyGit'))
  })

  it('heals only after a failed pull, a fetch, and with no tracked change or git operation in progress', () => {
    const step = body(helper, 'Get-HomeCopyHealStep')
    const order = ["return 'not_owned'", "return 'fetch_failed'", "return 'operation_in_progress'", "return 'tracked_changes'", "return 'heal'"]
    const at = order.map((s) => step.indexOf(s))
    expect(at.every((n) => n > -1)).toBe(true)
    expect([...at].sort((a, b) => a - b)).toEqual(at)
    const update = body(helper, 'Update-HomeCopy')
    const sequence = ["@('pull', '--ff-only', '--quiet')", "@('fetch', '--quiet', 'origin', 'main')", "@('status', '--porcelain', '--untracked-files=no')",
      'Get-HomeCopyHealStep', "@('branch', $backup, 'HEAD')", "@('reset', '--hard', '--quiet', 'origin/main')"]
    const positions = sequence.map((s) => update.indexOf(s))
    expect(positions.every((n) => n > -1), JSON.stringify(positions)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
    for (const name of ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD']) expect(body(helper, 'Get-HomeCopyOperation')).toContain(name)
    expect(update).toContain('$backup = "backup/auto-$stamp"')
    expect(update).toContain("ToString('yyyyMMdd-HHmmss'")
  })

  it('never deletes a branch, pushes, cleans, or removes untracked files', () => {
    expect(helper).not.toMatch(/'push'|'clean'|branch', '-[dD]'|'--delete'|'-D'|stash/)
  })

  it('is the only pull in the recordings upload, the library sync and the installer, each reporting only a failed heal', () => {
    for (const [name, source] of [['recordings-upload.ps1', upload], ['library-sync.ps1', sync]] as const) {
      expect(source, name).toContain("$HomeCopyScript = Join-Path $PSScriptRoot 'home-copy.ps1'")
      expect(source, name).toContain('. $HomeCopyScript')
      // Its own copies are pulled only through Update-HomeCopy (the content watcher's clone is another repository).
      expect(source, name).not.toMatch(/-C \$(RepoRoot|library) pull/)
      expect(source, name).not.toMatch(/reset --hard|'reset'/)
      // A change to the helper restarts the loop, as a change to the script does.
      expect(source, name).toMatch(/Get-Sha256 \$HomeCopyScript/)
    }
    expect(body(upload, 'Update-Source')).toContain("Set-PullProblem 'engine_pull_failed' (-not $copy.ok)")
    expect(body(upload, 'Update-LibrarySource')).toContain("Set-PullProblem 'library_source_pull_failed' (-not $copy.ok)")
    expect(body(sync, 'Update-Source')).toContain("Set-PullProblem 'library_source_pull_failed' (-not $copy.ok)")
    expect(installer).toContain(". (Join-Path $PSScriptRoot 'home-copy.ps1')")
    expect(installer).not.toMatch(/pull --ff-only\n/)
  })

  it('never reaches the runner\'s pinned checkout', () => {
    for (const path of ['scripts/verify-runner-source.ps1', 'scripts/runner.ps1', 'scripts/install-runner-task.ps1']) {
      expect(read(path), path).not.toMatch(/home-copy\.ps1|Update-HomeCopy/)
    }
  })
})

// Real repositories and a real PowerShell per pass: on the Windows runner one test outran vitest's default 5 s, while each
// PowerShell call already allows itself 120 s.
describe.runIf(shell)('the heal on real repositories (PowerShell)', { timeout: 120_000 }, () => {
  const env: NodeJS.ProcessEnv = {
    ...process.env, GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@invalid', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@invalid',
    GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
  }
  const git = (cwd: string, ...args: string[]) => {
    const r = spawnSync('git', args, { cwd, env, encoding: 'utf8' })
    if (r.status !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr}`)
    return r.stdout.trim()
  }
  const commit = (cwd: string, file: string, text: string) => {
    writeFileSync(join(cwd, file), text)
    git(cwd, 'add', file)
    git(cwd, 'commit', '-q', '-m', `edit ${file}`)
  }
  const run = (repo: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'home-copy-ps-'))
    const file = join(dir, 'run.ps1')
    const ps = (p: string) => p.replace(/'/g, "''")
    writeFileSync(file, '﻿' + [
      "$ErrorActionPreference = 'Stop'", 'Set-StrictMode -Version Latest',
      `. '${ps(join(ROOT, 'scripts', 'home-copy.ps1'))}'`,
      `$r = Update-HomeCopy 'git' '${ps(repo)}'`,
      '$r | ConvertTo-Json -Compress',
    ].join('\n'), 'utf8')
    const out = execFileSync(shell!, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], { env, encoding: 'utf8', windowsHide: true, timeout: 120_000 })
    rmSync(dir, { recursive: true, force: true })
    return JSON.parse(out.trim().split(/\r?\n/).pop()!)
  }
  // An origin, a machine-owned clone of it, and a rewrite of origin's main that leaves the clone ahead and behind.
  const setup = (folder = 'recordings-source') => {
    const root = mkdtempSync(join(tmpdir(), 'home-copy-'))
    const origin = join(root, 'origin.git')
    git(root, 'init', '-q', '--bare', '-b', 'main', origin)
    const author = join(root, 'author')
    git(root, 'init', '-q', '-b', 'main', author)
    git(author, 'remote', 'add', 'origin', origin)
    commit(author, 'a.txt', 'a\n')
    commit(author, 'secret.txt', 'scrub me\n')
    git(author, 'push', '-q', 'origin', 'main')
    const copy = join(root, folder)
    git(root, 'clone', '-q', origin, folder)
    // The rewrite: a new history with secret.txt never in it, force-pushed, then a commit on top.
    git(author, 'checkout', '-q', '--orphan', 'rewritten')
    git(author, 'rm', '-q', '--cached', 'secret.txt')
    rmSync(join(author, 'secret.txt'))
    git(author, 'commit', '-q', '-m', 'a, rewritten')
    commit(author, 'b.txt', 'b\n')
    git(author, 'push', '-q', '-f', 'origin', 'rewritten:main')
    return { root, origin, copy, author }
  }

  it('fast-forwards when it can, and heals a copy left ahead and behind: backup branch, then main on origin/main', () => {
    const { root, copy, author } = setup()
    try {
      const old = git(copy, 'rev-parse', 'HEAD')
      writeFileSync(join(copy, 'untracked.log'), 'kept\n')
      const healed = run(copy)
      expect(healed).toMatchObject({ ok: true, pulled: false, healed: true })
      expect(healed.backup).toMatch(/^backup\/auto-\d{8}-\d{6}$/)
      expect(healed.line).toMatch(/healed itself: its old HEAD is kept on the local branch backup\/auto-/)
      expect(git(copy, 'rev-parse', 'HEAD')).toBe(git(copy, 'rev-parse', 'origin/main'))
      expect(git(copy, 'symbolic-ref', '--short', 'HEAD')).toBe('main')
      expect(git(copy, 'rev-parse', healed.backup)).toBe(old)
      expect(readFileSync(join(copy, 'untracked.log'), 'utf8')).toBe('kept\n')
      // The backup is local only.
      expect(git(copy, 'ls-remote', '--heads', 'origin')).not.toContain('backup/')
      // The next pass is an ordinary fast-forward.
      commit(author, 'c.txt', 'c\n')
      git(author, 'push', '-q', 'origin', 'rewritten:main')
      expect(run(copy)).toMatchObject({ ok: true, pulled: true, healed: false })
      expect(git(copy, 'rev-parse', 'HEAD')).toBe(git(author, 'rev-parse', 'HEAD'))
    } finally { rmSync(root, { recursive: true, force: true }) }
  })

  it('leaves a copy with tracked changes, or one that is not machine-owned, exactly as it is', () => {
    const dirty = setup()
    try {
      const before = git(dirty.copy, 'rev-parse', 'HEAD')
      writeFileSync(join(dirty.copy, 'a.txt'), 'edited\n')
      expect(run(dirty.copy)).toMatchObject({ ok: false, healed: false, reason: 'tracked_changes' })
      expect(git(dirty.copy, 'rev-parse', 'HEAD')).toBe(before)
      expect(readFileSync(join(dirty.copy, 'a.txt'), 'utf8')).toBe('edited\n')
    } finally { rmSync(dirty.root, { recursive: true, force: true }) }
    for (const folder of ['runner-source', 'content-engine']) {
      const other = setup(folder)
      try {
        const before = git(other.copy, 'rev-parse', 'HEAD')
        expect(run(other.copy)).toMatchObject({ ok: false, reason: 'not_owned' })
        expect(git(other.copy, 'rev-parse', 'HEAD')).toBe(before)
      } finally { rmSync(other.root, { recursive: true, force: true }) }
    }
  })

  it('heals a copy left on another branch, keeping both it and the old main', () => {
    const { root, copy } = setup()
    try {
      const oldMain = git(copy, 'rev-parse', 'main')
      git(copy, 'checkout', '-q', '-b', 'stray')
      commit(copy, 'stray.txt', 'stray\n')
      const stray = git(copy, 'rev-parse', 'HEAD')
      const healed = run(copy)
      expect(healed).toMatchObject({ ok: true, healed: true })
      expect(git(copy, 'symbolic-ref', '--short', 'HEAD')).toBe('main')
      expect(git(copy, 'rev-parse', healed.backup)).toBe(stray)
      expect(git(copy, 'rev-parse', `${healed.backup}-main`)).toBe(oldMain)
    } finally { rmSync(root, { recursive: true, force: true }) }
  })
})
