// Shared by the Claude Code hooks in this folder (registered in .claude/settings.json).
// Each hook reads the event JSON on stdin and answers with one JSON object on stdout.
import { readFileSync } from 'node:fs'
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

// A repository-relative path with forward slashes, or the path as given when it is outside the repository.
export function repoPath(path) {
  if (!path) return ''
  const rel = relative(ROOT, resolve(ROOT, String(path)))
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
