#!/usr/bin/env node
// Keep the content-engine checkout on an up-to-date main (Ruling, Krish, 2026-11-15: every session on his computers
// leaves the content-engine checkout on an up-to-date main, never stranded on an old branch).
//
// On 15 Nov his Windows checkout sat on an old session's branch, local main 1,784 commits behind origin/main, with an
// uncommitted edit blocking `git pull`. This script is the clean-up, safe by construction: it never loses work and
// never disturbs a session still working.
//
//   - It fetches origin main (offline: it does nothing).
//   - On main with no tracked changes: fast-forwards to origin/main (`merge --ff-only`; never a merge commit or rebase).
//   - On another branch (or a detached HEAD) with no tracked changes, whose work is already on origin/main (an ancestor
//     of it, squash-merged with the same patch, or its upstream deleted and every file it touched the same on main):
//     switches to main and fast-forwards. It never deletes a branch.
//   - Anything else (tracked changes, unmerged commits, a local main ahead of origin, a merge or rebase in progress)
//     touches nothing: one plain line says what is there and the exact commands to keep it, and the case is recorded
//     in the ignored .scratch/checkout-tidy.jsonl.
//   - A local main both ahead of and behind origin/main because origin/main was rewritten (every local-only commit's
//     patch already on origin/main, or more than 200 of them) is held too, never reset: the line names which and
//     prints the three commands that keep the old main on a backup branch and realign it (git branch backup/...,
//     git checkout main, git reset --hard origin/main). Krish, 2026-11-20, after main's history was rewritten:
//     "We need to ensure this can never happen again in the future." Machine-owned copies heal themselves instead
//     (scripts/home-copy.ps1).
//   - It skips a linked worktree (.claude/worktrees, .worktrees), a cloud container (CLAUDE_CODE_REMOTE), CI, and a
//     checkout another live session holds (the lock below).
//
// The lock is <git dir>/session.lock, JSON {session_id, pid, host, started_at}, written by the SessionStart hook and
// removed by the SessionEnd hook. It is stale after 12 hours, or when its pid is gone on this host.
//
//   node scripts/checkout_tidy.mjs              # tidy now (Codex, or by hand): before work and before finishing
//   node scripts/checkout_tidy.mjs --hook start # Claude Code SessionStart: tidy, then take the lock
//   node scripts/checkout_tidy.mjs --hook end   # Claude Code SessionEnd: release our lock, then tidy
//   --repo <dir>                                # the checkout (default: CLAUDE_PROJECT_DIR, else the current folder)
//
// Silent when there is nothing to do. Always exits 0, so it can never block a session.
import { spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs'
import { hostname } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const LOCK_NAME = 'session.lock'
export const STALE_MS = 12 * 60 * 60 * 1000
const SHELLS = /^(sh|bash|dash|zsh|fish|cmd(\.exe)?|powershell(\.exe)?|pwsh(\.exe)?)$/i

function args(argv) {
  const out = { hook: null, repo: null }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--hook') out.hook = argv[++i] || null
    else if (argv[i] === '--repo') out.repo = argv[++i] || null
  }
  return out
}

function truthy(v) {
  return Boolean(v) && !['0', 'false', 'no', 'off', ''].includes(String(v).toLowerCase())
}

function makeGit(cwd) {
  const env = { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_ASKPASS: '', LC_ALL: 'C' }
  const run = (gitArgs, opts = {}) => spawnSync('git', gitArgs, { cwd, encoding: 'utf8', env, timeout: opts.timeout || 20_000, windowsHide: true })
  const out = (gitArgs, opts) => {
    const r = run(gitArgs, opts)
    return r.status === 0 ? r.stdout.trim() : null
  }
  const ok = (gitArgs, opts) => run(gitArgs, opts).status === 0
  return { run, out, ok }
}

// The process that owns this session: the hook's parent, walked up past any shell that launched it (Linux /proc).
export function ownerPid() {
  let pid = process.ppid
  for (let i = 0; i < 4 && process.platform === 'linux'; i++) {
    try {
      const comm = readFileSync(`/proc/${pid}/comm`, 'utf8').trim()
      if (!SHELLS.test(comm)) break
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
      const parent = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1])
      if (!parent || parent <= 1) break
      pid = parent
    } catch {
      break
    }
  }
  return pid
}

export function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error.code === 'EPERM'
  }
}

// Live when it is under 12 hours old and, on this host, its pid still runs. A lock from another host (a shared disk)
// is judged by its age alone.
export function lockIsLive(lock, now = Date.now()) {
  if (!lock || typeof lock !== 'object') return false
  const started = Date.parse(lock.started_at)
  if (!Number.isFinite(started) || now - started > STALE_MS) return false
  if (lock.host && lock.host !== hostname()) return true
  return pidAlive(Number(lock.pid))
}

function readLock(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

function record(top, entry) {
  try {
    const dir = join(top, '.scratch')
    mkdirSync(dir, { recursive: true })
    appendFileSync(join(dir, 'checkout-tidy.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), ...entry })}\n`)
  } catch {
    // Recording is a convenience; never fail on it.
  }
}

// Is the branch's work already on origin/main? Three ways, each one safe to get wrong only by saying no.
function alreadyOnMain(git, upstream) {
  if (git.ok(['merge-base', '--is-ancestor', 'HEAD', 'origin/main'])) return 'merged'
  const base = git.out(['merge-base', 'HEAD', 'origin/main'])
  if (!base) return null
  // Squash-merged: one commit carrying the branch's whole change, whose patch git cherry finds on origin/main.
  const tree = git.out(['rev-parse', 'HEAD^{tree}'])
  const squash = tree && git.out(['commit-tree', tree, '-p', base, '-m', 'checkout-tidy probe'])
  if (squash) {
    const cherry = git.out(['cherry', 'origin/main', squash])
    if (cherry !== null && cherry.startsWith('-')) return 'squash-merged'
  }
  // Its upstream is gone from origin and every file it touched reads the same on origin/main.
  if (upstream) {
    const name = upstream.replace(/^origin\//, '')
    const remote = git.run(['ls-remote', '--exit-code', '--heads', 'origin', name], { timeout: 15_000 })
    if (remote.status === 2) {
      const files = (git.out(['diff', '--name-only', base, 'HEAD']) || '').split(/\r?\n/).filter(Boolean)
      if (files.length && git.ok(['diff', '--quiet', 'HEAD', 'origin/main', '--', ...files])) return 'upstream gone, same on main'
    }
  }
  return null
}

// Over this many commits only on local main, with main also behind, the copy is on an old history rather than ahead
// with work of its own (on 20 Nov 2026 each home copy was 2,292 ahead and 2,494 behind).
export const REWRITE_AHEAD = 200

function stamp(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`
}

// Has origin/main been rewritten under this local main? Only when main is both ahead of origin/main and behind it,
// and either every local-only commit's patch is already on origin/main (by patch-id, git's --cherry-pick), or the
// local-only commits are more than REWRITE_AHEAD. Null otherwise: then local main holds work of its own.
function rewrittenOrigin(git) {
  const ahead = Number(git.out(['rev-list', '--count', 'origin/main..main']) || 0)
  const behind = Number(git.out(['rev-list', '--count', 'main..origin/main']) || 0)
  if (!ahead || !behind) return null
  const unmatched = git.out(['rev-list', '--count', '--cherry-pick', '--right-only', '--no-merges', 'origin/main...main'], { timeout: 120_000 })
  if (unmatched !== null && Number(unmatched) === 0) {
    return { kind: 'patch-id', why: `every one of its ${ahead} local-only commit(s) is already on origin/main by patch`, ahead, behind }
  }
  if (ahead > REWRITE_AHEAD) {
    return { kind: 'count', why: `${ahead} local-only commit(s), more than ${REWRITE_AHEAD}, with main also ${behind} behind`, ahead, behind }
  }
  return null
}

function inProgress(gitDir) {
  return ['MERGE_HEAD', 'rebase-merge', 'rebase-apply', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'BISECT_LOG']
    .find((name) => existsSync(join(gitDir, name))) || null
}

export function tidy({ repo, hook = null, sessionId = null, pid = null, log = (line) => console.log(line) } = {}) {
  const env = process.env
  if (truthy(env.CHECKOUT_TIDY_OFF)) return { outcome: 'skipped', reason: 'CHECKOUT_TIDY_OFF' }
  if (truthy(env.CLAUDE_CODE_REMOTE)) return { outcome: 'skipped', reason: 'cloud container' }
  if (truthy(env.CI) || truthy(env.GITHUB_ACTIONS)) return { outcome: 'skipped', reason: 'CI' }

  const git = makeGit(repo)
  const top = git.out(['rev-parse', '--show-toplevel'])
  if (!top) return { outcome: 'skipped', reason: 'not a git checkout' }
  const abs = (p) => (isAbsolute(p) ? p : resolve(top, p))
  const gitDir = abs(git.out(['rev-parse', '--git-dir']) || '.git')
  const commonDir = abs(git.out(['rev-parse', '--git-common-dir']) || '.git')
  if (resolve(gitDir) !== resolve(commonDir)) return { outcome: 'skipped', reason: 'linked worktree' }

  const lockPath = join(gitDir, LOCK_NAME)
  const lock = readLock(lockPath)
  const ours = lock && sessionId && lock.session_id === sessionId
  if (lock && !ours && lockIsLive(lock)) {
    log(`checkout-tidy: another session (${lock.session_id || 'unknown'}, pid ${lock.pid}, since ${lock.started_at}) holds this checkout; left it as it is.`)
    return { outcome: 'skipped', reason: 'locked by another session' }
  }
  if (hook === 'end' && ours) {
    try { unlinkSync(lockPath) } catch { /* already gone */ }
  }

  const result = tidyCheckout(git, top, gitDir, log)

  if (hook === 'start') {
    try {
      writeFileSync(lockPath, `${JSON.stringify({ session_id: sessionId, pid: pid ?? ownerPid(), host: hostname(), started_at: new Date().toISOString() })}\n`)
    } catch { /* a lock we cannot write only means no protection */ }
  }
  return result
}

function tidyCheckout(git, top, gitDir, log) {
  const hold = (reason, extra = {}) => {
    const line = `checkout-tidy: left the checkout as it is: ${reason}`
    log(line)
    record(top, { outcome: 'held', reason, ...extra })
    return { outcome: 'held', reason, ...extra }
  }

  if (!git.ok(['fetch', '--quiet', '--no-tags', 'origin', 'main'], { timeout: 30_000 })) {
    return { outcome: 'skipped', reason: 'fetch failed (offline?)' }
  }
  const busy = inProgress(gitDir)
  if (busy) return hold(`a git operation is in progress (${busy}). Finish it or abort it first.`)

  const branch = git.out(['symbolic-ref', '--quiet', '--short', 'HEAD']) // null when detached
  const status = git.run(['status', '--porcelain', '--untracked-files=no'])
  const changed = (status.status === 0 ? status.stdout : '').split(/\r?\n/).filter(Boolean).map((l) => l.slice(3))
  const where = branch ? `branch ${branch}` : 'a detached HEAD'
  if (changed.length) {
    const shown = changed.slice(0, 8).join(', ') + (changed.length > 8 ? ` and ${changed.length - 8} more` : '')
    return hold(
      `${where} has uncommitted changes (${shown}). Keep them with ` +
        `\`git stash push -m "kept by checkout-tidy ${new Date().toISOString().slice(0, 10)}"\` ` +
        `or commit them (\`git add -A && git commit -m "..."\`), then run \`node scripts/checkout_tidy.mjs\` again.`,
      { branch, files: changed },
    )
  }

  const mainExists = git.ok(['show-ref', '--verify', '--quiet', 'refs/heads/main'])
  if (mainExists && !git.ok(['merge-base', '--is-ancestor', 'main', 'origin/main'])) {
    const ahead = git.out(['rev-list', '--count', 'origin/main..main'])
    const rewritten = rewrittenOrigin(git)
    if (rewritten) {
      // origin/main was rewritten (a history scrub, 18 to 20 Nov 2026): this copy is not ahead with work of its own,
      // it is on the old history. Never reset here (a person's copy); say the three commands that keep the old main
      // and realign it. Krish, 2026-11-20: "We need to ensure this can never happen again in the future."
      const backup = `backup/main-before-realign-${stamp()}`
      return hold(
        `local main has diverged from origin/main because origin/main was rewritten (${rewritten.why}): ` +
          `${rewritten.ahead} commit(s) only here, ${rewritten.behind} only on origin/main. ` +
          `Keep the old main on a backup branch and realign: \`git branch ${backup} main\`, \`git checkout main\`, ` +
          '`git reset --hard origin/main`. Untracked files stay; the backup branch keeps every old commit.',
        { branch, rewritten: rewritten.kind, ahead: rewritten.ahead, behind: rewritten.behind, backup },
      )
    }
    return hold(`local main has ${ahead} commit(s) that are not on origin/main. Push them on a branch and open a pull request, then run this again.`, { branch })
  }

  if (branch !== 'main') {
    const upstream = branch ? git.out(['rev-parse', '--abbrev-ref', `${branch}@{upstream}`]) : null
    const why = alreadyOnMain(git, upstream)
    if (!why) {
      const ahead = git.out(['rev-list', '--count', 'origin/main..HEAD'])
      return hold(
        `${where} has ${ahead} commit(s) not on origin/main. Push it and open a pull request (\`git push -u origin HEAD\`), ` +
          'or keep working on it; this runs again at the next session.',
        { branch },
      )
    }
    const switched = mainExists ? git.run(['checkout', '--quiet', 'main']) : git.run(['checkout', '--quiet', '-b', 'main', '--track', 'origin/main'])
    if (switched.status !== 0) return hold(`could not switch from ${where} to main: ${(switched.stderr || '').trim().split(/\r?\n/)[0]}`, { branch })
    const behind = git.out(['rev-list', '--count', 'main..origin/main'])
    const ff = git.run(['merge', '--ff-only', '--quiet', 'origin/main'])
    if (ff.status !== 0) return hold(`switched to main, but it would not fast-forward: ${(ff.stderr || '').trim().split(/\r?\n/)[0]}`, { branch })
    const line = `checkout-tidy: ${where} was already on origin/main (${why}); switched to main and fast-forwarded ${behind} commit(s). The branch is kept.`
    log(line)
    record(top, { outcome: 'moved', from: branch, why, behind: Number(behind) })
    return { outcome: 'moved', from: branch, why }
  }

  const behind = Number(git.out(['rev-list', '--count', 'main..origin/main']) || 0)
  if (!behind) return { outcome: 'current' }
  const ff = git.run(['merge', '--ff-only', '--quiet', 'origin/main'])
  if (ff.status !== 0) return hold(`main would not fast-forward: ${(ff.stderr || '').trim().split(/\r?\n/)[0]}`, { branch })
  log(`checkout-tidy: fast-forwarded main ${behind} commit(s) to origin/main.`)
  return { outcome: 'fast-forwarded', behind }
}

function readHookEvent() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    return {}
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  try {
    const opts = args(process.argv.slice(2))
    const event = opts.hook ? readHookEvent() : {}
    const repo = opts.repo || process.env.CLAUDE_PROJECT_DIR || process.cwd()
    tidy({ repo, hook: opts.hook, sessionId: event.session_id || null })
  } catch (error) {
    console.log(`checkout-tidy: skipped (${error && error.message ? error.message : error}).`)
  }
  process.exit(0)
}
