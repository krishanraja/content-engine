// Stop: typecheck and the tests related to what changed, reported back (AGENTS.md, Verification). A pass is shown
// as a message. A failure sends the session back once with the errors to fix; on that second stop
// stop_hook_active is set and this hook steps aside, so it can never loop.
import { execFileSync, spawnSync } from 'node:child_process'
import { ROOT, readEvent } from './lib.mjs'

const event = readEvent()
if (event.stop_hook_active) process.exit(0)

function git(args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean)
  } catch {
    return []
  }
}

const changed = [...new Set([...git(['diff', '--name-only', 'HEAD']), ...git(['ls-files', '--others', '--exclude-standard'])])]
const code = changed.filter((file) => /\.(?:ts|tsx|mts|mjs)$/.test(file))
if (!code.length) process.exit(0)

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const run = (args) => spawnSync(npx, args, { cwd: ROOT, encoding: 'utf8', shell: process.platform === 'win32', timeout: 280_000 })
const lines = []

const checks = [['typecheck', ['tsc', '--noEmit']]]
if (code.some((file) => file.startsWith('apps/control-plane/'))) {
  checks.push(['typecheck:control-plane', ['tsc', '--noEmit', '-p', 'apps/control-plane/tsconfig.json']])
}
for (const [name, args] of checks) {
  const result = run(args)
  const errors = `${result.stdout}${result.stderr}`.split(/\r?\n/).filter((line) => /error TS\d+/.test(line))
  lines.push(result.status === 0 ? `${name} passed` : `${name} FAILED (${errors.length} errors): ${errors.slice(0, 3).join(' | ')}`)
}
const tests = run(['vitest', 'related', '--run', '--passWithNoTests', ...code])
const summary = `${tests.stdout}${tests.stderr}`.split(/\r?\n/).filter((line) => /^\s*(?:Test Files|Tests)\s/.test(line)).map((line) => line.trim())
lines.push(tests.status === 0 ? `related tests passed (${summary.join('; ') || 'none found'})` : `related tests FAILED (${summary.join('; ')})`)

const failed = lines.some((line) => line.includes('FAILED'))
const message = `stop-check on ${code.length} changed code file(s): ${lines.join('; ')}.`
process.stdout.write(JSON.stringify(failed
  ? { decision: 'block', reason: `${message} Fix this, or say plainly that it is still failing, before stopping; run npm run verify before any push.` }
  : { systemMessage: message }) + '\n')
process.exit(0)
