// Runs the control plane's structural guards from apps/control-plane, where
// their inputs live (api/, lib/, vercel.json, the migration fixtures).
//
// Each guard encodes an invariant that already shipped broken once in Control
// Center; they came across with the routes in the 2026-09 unification. They
// are skipped on Windows: several build paths with `new URL().pathname`, which
// is not a Windows path, and the routes only ever run on Vercel's Linux.
//
// Two rules of its own hold that 'manual' means Krish's words (step 3 of the
// design entropy session, PR 6). Krish, 2026-10-11: "this entire session was
// created to deduplicate and eliminate entropy." His words come in through one
// door, Control Center's, so:
//
//   1. No code under apps/ calls a transcription API (audio/transcriptions).
//      The one exception is the engine's old idea recorder,
//      apps/control-plane/api/_whisper.ts, which Control Center main still
//      calls through /api/content-ideas/voice. It goes, with this exception,
//      once Control Center's step 3 PR 4 (retire the other doors) is live.
//   2. A literal 'manual' in a file that touches content_ideas or source_type
//      appears only in apps/control-plane/api/content-ideas.ts (the allow
//      list, which needs a said: ref) or as a read filter,
//      .eq('source_type', 'manual'). No writer under apps/ may store manual.
//      The database refuses one that is not his words too
//      (content_ideas_manual_is_his_words).
//
// Comments are stripped before a file is read (stripComments, from the one
// closer guard). tests/control-plane/his-words-guard.test.ts proves each rule
// fails on a made-up breach and passes the tree.
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, resolve } from 'node:path'
import { stripComments } from './check-one-close.js'

const appRoot = resolve(fileURLToPath(new URL('../apps/control-plane/', import.meta.url)))

const GUARDS = [
  'check-env-example',
  'check-content-engine-schedule',
  'check-judges',
  'check-film-jury',
  'check-run-recovery',
  'check-inspiration-lane',
  'check-creator-moves',
  'check-aeo-packet-schema',
  'check-cache-metering',
  'check-content-window',
  'check-unified-content-spine',
  'check-content-chain',
  'check-content-expiry',
  'check-content-vocabulary',
  'check-content-seed-security',
  'check-content-production-bridge',
  'check-editorial-radar',
  'check-build-signals',
  'check-arc-scoring',
  'check-card-lint',
  'check-slate-calibration',
  'check-teardown-beat',
  'check-selection',
  'check-anchor-attribution',
  'check-video-studio-control-plane',
  'check-video-studio-command-security',
  'check-video-studio-export',
  'check-studio-session-gateway',
]

/** The file allowed to call a transcription API, until Control Center stops calling it. */
export const TRANSCRIBE_EXCEPTION = 'apps/control-plane/api/_whisper.ts'
/** The one file whose allow list carries 'manual'. */
export const MANUAL_ALLOW_LIST = 'apps/control-plane/api/content-ideas.ts'
const CODE = /\.(ts|tsx|mts|js|mjs|cjs|py)$/
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', 'dist', '.cache', '.vercel'])

/** Rule 1: a transcription call outside the one exception. */
export function transcriptionProblems(path: string, text: string): string[] {
  if (path === TRANSCRIBE_EXCEPTION || !path.startsWith('apps/')) return []
  return /audio\/transcriptions/.test(stripComments(path, text))
    ? [`${path}: calls a transcription API. His words come in through Control Center's one door (POST /api/voice there).`]
    : []
}

/** Rule 2: a literal 'manual' a writer could store as content_ideas.source_type. */
export function manualProblems(path: string, text: string): string[] {
  if (path === MANUAL_ALLOW_LIST || !path.startsWith('apps/')) return []
  const code = stripComments(path, text)
  if (!/content_ideas|source_type/.test(code)) return []
  const out: string[] = []
  for (const m of code.matchAll(/(['"`])manual\1/g)) {
    const before = code.slice(Math.max(0, (m.index ?? 0) - 40), m.index)
    if (/\.eq\(\s*['"]source_type['"]\s*,\s*$/.test(before)) continue
    const line = code.slice(0, m.index).split('\n').length
    out.push(`${path}:${line}: 'manual' outside the allow list. manual means Krish's words, filed by Control Center with a said: ref; name your own source.`)
  }
  return out
}

function walk(dir: string, root: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, root, out)
    else if (CODE.test(name)) out.push(relative(root, full).split('\\').join('/'))
  }
}

/** Both rules over the tree under apps/. */
export function hisWordsProblems(repoRoot: string): string[] {
  const files: string[] = []
  walk(join(repoRoot, 'apps'), repoRoot, files)
  return files.flatMap(f => {
    const text = readFileSync(join(repoRoot, f), 'utf8')
    return [...transcriptionProblems(f, text), ...manualProblems(f, text)]
  })
}

function main() {
  if (process.platform === 'win32') {
    console.log('control-plane guards: skipped on Windows (Linux-only paths; the routes deploy to Linux)')
    process.exit(0)
  }

  let failed = 0
  for (const guard of GUARDS) {
    const result = spawnSync('npx', ['tsx', `scripts/${guard}.ts`], { cwd: appRoot, stdio: 'inherit', env: process.env })
    if (result.status !== 0) { failed += 1; console.log(`FAIL  ${guard}`) }
  }
  const words = hisWordsProblems(resolve(appRoot, '..', '..'))
  for (const p of words) console.log(`FAIL  his words: ${p}`)
  if (words.length) failed += 1
  if (failed) { console.log(`${failed} control-plane guard(s) failed`); process.exit(1) }
  console.log(`PASS  ${GUARDS.length} control-plane guards, and manual is his words`)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
