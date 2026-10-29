// Shared by the Claude Code hooks in this folder (registered in .claude/settings.json).
// Each hook reads the event JSON on stdin and answers with one JSON object on stdout.
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

// The secret shapes, read from the one list check-no-secrets.ts uses (scripts/secret-patterns.ts), so there is no
// second copy to drift. Each pattern is one regular-expression literal per line of its array; node runs no TypeScript,
// so the literals are read as text. tests/claude-hooks.test.ts proves this reads the same list the scanner uses.
export function secretPatterns() {
  const source = readFileSync(resolve(ROOT, 'scripts', 'secret-patterns.ts'), 'utf8')
  const block = source.slice(source.indexOf('SECRET_PATTERNS'), source.indexOf(']\n', source.indexOf('SECRET_PATTERNS')))
  return block.split(/\r?\n/).map((line) => line.trim().replace(/,$/, '')).filter((line) => /^\/.+\/[a-z]*$/.test(line))
    .map((literal) => {
      const end = literal.lastIndexOf('/')
      return new RegExp(literal.slice(1, end), literal.slice(end + 1))
    })
}

export function readEvent() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}')
  } catch {
    return {}
  }
}

// The git directory every checkout of a repository shares: the .git folder itself, or, for a linked worktree
// (whose .git is a file reading "gitdir: <main>/.git/worktrees/<name>"), the folder its commondir names.
// Null when the folder is no checkout.
export function gitCommonDir(top) {
  const dotGit = resolve(top, '.git')
  try {
    if (statSync(dotGit).isDirectory()) return realpathSync(dotGit)
    const gitdir = resolve(top, readFileSync(dotGit, 'utf8').match(/^gitdir:\s*(.+?)\s*$/m)[1])
    const common = resolve(gitdir, 'commondir')
    return realpathSync(existsSync(common) ? resolve(gitdir, readFileSync(common, 'utf8').trim()) : gitdir)
  } catch {
    return null
  }
}

// The nearest folder at or above a path that holds a .git, or null.
function checkoutOf(path) {
  for (let dir = path, up = dirname(path); ; dir = up, up = dirname(up)) {
    if (existsSync(resolve(dir, '.git'))) return dir
    if (up === dir) return null
  }
}

// A repository-relative path with forward slashes, or the path as given when it is outside the repository.
// A path in another checkout of this repository (a git worktree, wherever it lives, for example
// /home/user/.wt/<x>/apps/control-plane/api/_houseRules.ts) is read relative to that checkout, so every guard
// knows a guarded file there too.
export function repoPath(path) {
  if (!path) return ''
  const absolute = resolve(ROOT, String(path))
  const top = checkoutOf(absolute)
  if (top && resolve(top) !== resolve(ROOT) && gitCommonDir(top) && gitCommonDir(top) === gitCommonDir(ROOT)) {
    return relative(top, absolute).split(sep).join('/')
  }
  const rel = relative(ROOT, absolute)
  return rel.startsWith('..') ? String(path) : rel.split(sep).join('/')
}

// Everything a Write, Edit or MultiEdit would put in a file.
export function writtenText(input = {}) {
  const parts = [input.content, input.new_string]
  for (const edit of input.edits || []) parts.push(edit?.new_string)
  return parts.filter((part) => typeof part === 'string').join('\n')
}

export function decide(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: decision, permissionDecisionReason: reason },
  }) + '\n')
  process.exit(0)
}
