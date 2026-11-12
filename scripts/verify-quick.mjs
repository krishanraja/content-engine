#!/usr/bin/env node
// verify:quick: the checks a pull request waits on, in a few minutes (Ruling, Krish, 2026-11-11: quick checks on pull
// requests, the full verify after merge; merge fast and he tests live).
//
// It runs every step of `npm run verify` except the whole unit suite: both typechecks, the skills check and every
// check:* guard, all of them fast. In place of the whole suite it runs
//   - the vitest tests related to what changed since the merge base (vitest's import graph, plus any test that names a
//     changed file by its path or file name, which is how a test reaches a Python script, a config or a doc),
//   - the Python tests (tests/*_test.py) that changed or that name a changed file,
//   - the publishing-safety tests every time, touched or not (the publish, secret and taste guards, the teleprompter
//     send, the copy lint, the floor, the board's view contract, no Claude routines),
// and falls back to the whole suite when shared config changed (package.json, the lockfile, vitest or TypeScript
// config, the pinned Python). The full `npm run verify`, on Linux and Windows with the browser jobs, runs after merge
// in .github/workflows/full-verify.yml and never blocks one.
//
//   npm run verify:quick                    # against origin/main
//   VERIFY_BASE=<ref> npm run verify:quick  # against another base
//   npm run verify:quick -- --plan          # print what it would run, run nothing
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

const ROOT = process.cwd()
const PLAN = process.argv.includes('--plan')
const WIN = process.platform === 'win32'
const PY = process.env.PYTHON || (WIN ? 'python' : 'python3')

// The steps of `npm run verify`, read from package.json so a new guard joins the quick set by itself; only the whole
// unit suite is left out.
const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
const steps = pkg.scripts.verify.split('&&').map((s) => s.trim().replace(/^npm run /, '')).filter((s) => s !== 'test')

// A change here can move every test, so the whole suite runs.
const FULL_SUITE = [
  /^package-lock\.json$/, /(^|\/)vitest\.config\.[cm]?[jt]s$/, /(^|\/)tsconfig[^/]*\.json$/,
  /^requirements[^/]*\.txt$/, /^packages\/[^/]+\/package\.json$/,
]
// package.json moves every test only through what it installs or how modules resolve; a new script does not.
const PKG_KEYS = ['dependencies', 'devDependencies', 'optionalDependencies', 'overrides', 'workspaces', 'type', 'imports', 'exports', 'engines']

// Publishing safety: run on every pull request, touched or not.
const ALWAYS_TS = [
  'tests/claude-hooks.test.ts', 'tests/secret-patterns.test.ts', 'tests/no-claude-routines.test.ts', 'tests/one-live-board.test.ts',
  'tests/control-plane/teleprompter-send.test.ts', 'tests/control-plane/teleprompter-server.test.ts',
  'tests/control-plane/copy-lint.test.ts', 'tests/floor-tools.test.ts', 'tests/control-plane/board-view-contract.test.ts',
]
// The board's contract and schema tests, whatever they are named when they land.
const ALWAYS_TS_PATTERN = /^tests\/control-plane\/board-[^/]*(contract|schema)[^/]*\.test\.ts$/
const ALWAYS_PY = [
  'tests/copy_lint_test.py', 'tests/floor_blocking_test.py', 'tests/floor_bar_test.py',
  'tests/publish_figures_test.py', 'tests/taste_backstop_test.py',
]

// A file name this common names nothing in particular.
const GENERIC = new Set(['index.ts', 'index.js', 'index.mjs', '__init__.py', 'README.md', 'SKILL.md', 'types.ts', 'utils.ts', 'common.py', 'schema.json'])

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
const lines = (s) => s.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)

let BASE = null
function changedFiles() {
  const ref = process.env.VERIFY_BASE || 'origin/main'
  let base
  try { base = git('merge-base', 'HEAD', ref) } catch {
    console.log(`verify:quick: no merge base with ${ref}; running the whole suite.`)
    return null
  }
  BASE = base
  const files = new Set([
    ...lines(git('diff', '--name-only', `${base}...HEAD`)),
    ...lines(git('diff', '--name-only', 'HEAD')),
    ...lines(git('ls-files', '--others', '--exclude-standard')),
  ])
  console.log(`verify:quick: ${files.size} file(s) changed since ${base.slice(0, 8)} (${ref}).`)
  return [...files].map((f) => f.replace(/\\/g, '/'))
}

function walk(dir, keep, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = `${dir}/${name}`
    if (statSync(p).isDirectory()) walk(p, keep, out)
    else if (keep(p)) out.push(p)
  }
  return out
}

const TS_TESTS = [
  ...walk('tests', (p) => p.endsWith('.test.ts')),
  ...walk('apps/renderer/src/engine', (p) => p.endsWith('.test.ts')),
]
const PY_TESTS = readdirSync('tests').filter((n) => n.endsWith('_test.py')).map((n) => `tests/${n}`)
const text = new Map()
const read = (p) => { if (!text.has(p)) text.set(p, readFileSync(p, 'utf8')); return text.get(p) }
const names = (file, body) => body.includes(file) || (!GENERIC.has(basename(file)) && basename(file).length >= 6 && body.includes(basename(file)))

function packageMoved() {
  let before
  try { before = JSON.parse(git('show', `${BASE}:package.json`)) } catch { return true }
  return PKG_KEYS.some((k) => JSON.stringify(before[k]) !== JSON.stringify(pkg[k]))
}

function plan(changed) {
  if (changed === null) return { full: true, ts: [], py: [] }
  const trigger = changed.find((f) => FULL_SUITE.some((r) => r.test(f))) || (changed.includes('package.json') && packageMoved() ? 'package.json' : undefined)
  if (trigger) {
    console.log(`verify:quick: ${trigger} changed; running the whole unit suite.`)
    return { full: true, ts: [], py: [] }
  }
  const live = changed.filter((f) => existsSync(f))
  const ts = new Set([...ALWAYS_TS.filter((f) => existsSync(f)), ...TS_TESTS.filter((f) => ALWAYS_TS_PATTERN.test(f))])
  const py = new Set(ALWAYS_PY.filter((f) => existsSync(f)))
  for (const f of live) {
    if (/\.(m|c)?[jt]sx?$/.test(f)) ts.add(f)                 // vitest related follows its importers
    if (/^tests\/[^/]+_test\.py$/.test(f)) { py.add(f); continue } // a changed Python test runs by itself
    if (/\.(m|c)?[jt]sx?$/.test(f) && !f.startsWith('scripts/')) continue
    for (const t of TS_TESTS) if (t !== f && names(f, read(t))) ts.add(t)
    for (const t of PY_TESTS) if (t !== f && names(f, read(t))) py.add(t)
  }
  return { full: false, ts: [...ts].sort(), py: [...py].sort() }
}

function run(label, cmd, args) {
  console.log(`\n> ${label}`)
  if (PLAN) return
  const started = Date.now()
  const r = spawnSync(cmd, args, { cwd: ROOT, stdio: 'inherit', shell: WIN, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
  const secs = ((Date.now() - started) / 1000).toFixed(1)
  if (r.status !== 0) {
    console.error(`\nverify:quick FAILED at ${label} (${secs}s).`)
    process.exit(r.status || 1)
  }
  console.log(`  ok ${label} (${secs}s)`)
}

const t0 = Date.now()
const p = plan(changedFiles())
console.log(p.full ? 'Tests: the whole unit suite.' : `Tests: ${p.ts.length} vitest target(s), ${p.py.length} Python test(s).`)
if (!p.full) { for (const f of p.ts) console.log(`  vitest related ${f}`); for (const f of p.py) console.log(`  python ${f}`) }

for (const step of steps.slice(0, 2)) run(step, 'npm', ['run', step]) // the typechecks first
if (p.full) run('test (whole suite)', 'npx', ['vitest', 'run'])
else {
  if (p.ts.length) run('test (related)', 'npx', ['vitest', 'related', '--run', '--passWithNoTests', ...p.ts])
  for (const f of p.py) run(`python ${f}`, PY, [f])
}
for (const step of steps.slice(2)) run(step, 'npm', ['run', step])
if (!PLAN) console.log(`\nverify:quick passed in ${((Date.now() - t0) / 1000).toFixed(0)}s. The full verify runs after merge (full-verify.yml).`)
