// One closer: nothing in the engine closes a board item but the board route,
// which takes a close only from a check, Krish, or a session on its own work.
//
// Krish, 2026-10-11: "I think closing what you can check is already done is
// one of the most obvious things I've ever heard of as a suggestion", and
// "this entire session was created to deduplicate and eliminate entropy."
// Step 4 of his operating system is one done-check sweep in Control Center
// (api/_doneChecks.ts there). The engine's own closers (the making route's
// close, the publish watcher's closes and let-go, the recordings lane's
// close, the purge's archive, the midday run's done) went in step 4, part C.
// This guard stops one coming back:
//
//   1. No code under apps/ or scripts/ writes a board item into done or
//      archived, except the board route (apps/control-plane/api/workbench.ts).
//      What is checked: a line in a file that touches the board naming lane
//      with a literal 'done' or 'archived', or a board helper called with
//      one; and, in any file, a write of closed_by, which only a close makes
//      (so a closer that passes the lane through a variable is caught too).
//      A lane passed through a variable with no closed_by is not seen here;
//      the database trigger refuses that close (check_closes_it).
//   2. The old closers' names are gone for good (tombstones).
//   3. CLOSE_KINDS in the board route equals the kinds the newest migration's
//      work_board_items_closes_on_check allows.
//   4. The database trigger's agent list (only_a_check_or_krish_closes,
//      agents) equals AGENT_CLIENTS (apps/control-plane/api/_editEvents.ts).
//
// The skills that write board items are held to the same rule by
// `npm run skills:validate` (scripts/validate-skills.py, board_item_problems).
// Comments are stripped before a file is read, and so are Python self-tests,
// whose fake boards hold done items on purpose. Tests are not scanned for
// rule 1.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const ROUTE = 'apps/control-plane/api/workbench.ts'
/** The guard and its own test name the tombstones on purpose. */
const SELF = new Set(['scripts/check-one-close.ts', 'tests/control-plane/one-close-guard.test.ts'])
const CODE = /\.(ts|tsx|mts|js|mjs|py|ps1)$/
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', 'dist', '.cache', '.vercel'])

export const TOMBSTONES: Array<[RegExp, string]> = [
  [/\bcloseBoardItemsForPiece\b/, 'closeBoardItemsForPiece: the making route asks the sweep to look (_controlCenter.ts)'],
  [/\bitemsToClose\b/, 'itemsToClose: pieceVerdict in _making.ts, and the sweep\'s piece_step check'],
  [/\bheldToLetGo\b/, 'heldToLetGo: the sweep\'s session moot'],
  [/\bLET_GO_BY\b/, 'LET_GO_BY: the sweep\'s session moot'],
  [/\bHELD_DAYS\b/, 'HELD_DAYS: the sweep\'s session moot'],
  [/\bboard_close\b/, 'board_close: the recordings lane notes, it never closes (making.board_note)'],
  [/_boardClose\b/, '_boardClose.ts: deleted in step 4, part C'],
]

/** Text with comments taken out: // and /* *\/ for TypeScript and JavaScript, # for Python and PowerShell. */
export function stripComments(path: string, text: string): string {
  if (/\.(py|ps1)$/.test(path)) return text.split('\n').map(l => (/^\s*#/.test(l) ? '' : l)).join('\n')
  return text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' ')).split('\n').map(l => l.replace(/(^|[^:'"`\\])\/\/.*$/, '$1')).join('\n')
}

/** Python with every self-test function taken out: their fake boards hold done items on purpose. */
export function stripSelfTests(path: string, text: string): string {
  if (!path.endsWith('.py')) return text
  const out: string[] = []
  let skipping = false
  for (const line of text.split('\n')) {
    if (/^def \w*self_test\w*\(/.test(line)) { skipping = true; continue }
    if (skipping && /^\S/.test(line)) skipping = false
    out.push(skipping ? '' : line)
  }
  return out.join('\n')
}

const TOUCHES_BOARD = /work_board_items|\/api\/workbench|BOARD_PATH|board_upsert|board_note|boardCall/
/** A write that names a closing lane: lane: 'done', 'lane': "archived", lane='done'. */
const CLOSING_LANE = /['"]?\blane['"]?\s*[:=]\s*['"](done|archived)['"]/
/** A board helper called with a closing lane among its arguments. */
const CLOSING_CALL = /\bboard(?:_upsert|_note|Call)?\(([^()]|\([^()]*\))*['"](done|archived)['"]/

/** A write of closed_by: closed_by: x, 'closed_by': x, row['closed_by'] = x, closed_by=x. Not ==, ===, or a type. */
const CLOSED_BY_WRITE = /['"]?\bclosed_by['"]?\]?\s*(?::(?!\s*(?:string|null|unknown|any)\b)|=(?!=))/

/** Rule 1: the lines of one file that close a board item, or [] when none do. */
export function closingWrites(path: string, text: string): string[] {
  if (path === ROUTE) return []
  const code = stripSelfTests(path, stripComments(path, text))
  const board = TOUCHES_BOARD.test(code)
  return code.split('\n')
    .map((line, i) => ({ line, n: i + 1 }))
    .filter(({ line }) => CLOSED_BY_WRITE.test(line) || (board && (CLOSING_LANE.test(line) || CLOSING_CALL.test(line))))
    .map(({ line, n }) => `${path}:${n}: ${line.trim().slice(0, 120)}`)
}

/** Rule 2: the tombstones a file still names. */
export function tombstonesIn(path: string, text: string): string[] {
  if (SELF.has(path)) return []
  const code = stripComments(path, text)
  return TOMBSTONES.filter(([re]) => re.test(code)).map(([, why]) => `${path}: names ${why}`)
}

/** The quoted words inside a list. */
function quoted(list: string): string[] {
  return [...list.matchAll(/'([a-z_]+)'/g)].map(m => m[1] ?? '')
}

/** Rule 3: the kinds the route takes, from PIECE_KINDS and CLOSE_KINDS. */
export function routeKinds(route: string): string[] {
  const pieces = /PIECE_KINDS\s*=\s*\[([^\]]*)\]/.exec(route)?.[1]
  const close = /CLOSE_KINDS\s*=\s*new Set<string>\(\[([^\]]*)\]\)/.exec(route)?.[1]
  if (!pieces || !close) return []
  return [...new Set([...(close.includes('...PIECE_KINDS') ? quoted(pieces) : []), ...quoted(close)])].sort()
}

/** Rule 3: the kinds the newest migration that sets work_board_items_closes_on_check allows. */
export function migrationKinds(migrations: Array<[string, string]>): { file: string; kinds: string[] } | null {
  const sets = migrations.filter(([, sql]) => /add\s+constraint\s+work_board_items_closes_on_check/i.test(sql)).sort(([a], [b]) => a.localeCompare(b))
  const newest = sets.at(-1)
  if (!newest) return null
  const after = newest[1].slice(newest[1].search(/add\s+constraint\s+work_board_items_closes_on_check/i))
  const list = /closes_on\s+in\s*\(([^)]*)\)/i.exec(after)?.[1] ?? ''
  return { file: newest[0], kinds: quoted(list).sort() }
}

/** Rule 4: the agent clients the trigger lets close session work, from the newest migration that defines it. */
export function triggerClients(migrations: Array<[string, string]>): { file: string; clients: string[] } | null {
  const defs = migrations.filter(([, sql]) => /function\s+public\.only_a_check_or_krish_closes\s*\(/i.test(sql)).sort(([a], [b]) => a.localeCompare(b))
  const newest = defs.at(-1)
  if (!newest) return null
  const list = /\bagents\s+constant\s+text\[\]\s*:=\s*array\[([^\]]*)\]/i.exec(newest[1])?.[1] ?? ''
  return { file: newest[0], clients: quoted(list).sort() }
}

/** Rule 4: AGENT_CLIENTS in _editEvents.ts. */
export function agentClients(editEvents: string): string[] {
  return quoted(/AGENT_CLIENTS\s*=\s*new Set\(\[([^\]]*)\]\)/.exec(editEvents)?.[1] ?? '').sort()
}

/** Rule 3: why the route's kinds and the newest migration's differ, or null when they agree. */
export function kindsProblem(routeSrc: string, migrations: Array<[string, string]>): string | null {
  const route = routeKinds(routeSrc)
  const db = migrationKinds(migrations)
  if (!route.length) return `rule 3: CLOSE_KINDS could not be read from ${ROUTE}`
  if (!db) return 'rule 3: no migration sets work_board_items_closes_on_check'
  if (route.join(',') !== db.kinds.join(',')) return `rule 3: CLOSE_KINDS in ${ROUTE} (${route.join(', ')}) differs from ${db.file} (${db.kinds.join(', ')})`
  return null
}

/** Rule 4: why the trigger's agent list and AGENT_CLIENTS differ, or null when they agree. */
export function clientsProblem(editEventsSrc: string, migrations: Array<[string, string]>): string | null {
  const clients = agentClients(editEventsSrc)
  const trigger = triggerClients(migrations)
  if (!clients.length) return 'rule 4: AGENT_CLIENTS could not be read from apps/control-plane/api/_editEvents.ts'
  if (!trigger) return 'rule 4: no migration defines only_a_check_or_krish_closes'
  if (clients.join(',') !== trigger.clients.join(',')) {
    return `rule 4: the trigger in ${trigger.file} lets ${trigger.clients.join(', ') || 'no client'} close session work, but AGENT_CLIENTS is ${clients.join(', ')}`
  }
  return null
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(join(ROOT, dir))) {
    if (SKIP_DIRS.has(name)) continue
    const rel = join(dir, name)
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (CODE.test(name)) out.push(rel.split('\\').join('/'))
  }
  return out
}

export function check(): string[] {
  const problems: string[] = []
  const read = (p: string) => readFileSync(join(ROOT, p), 'utf8')
  for (const path of walk('apps').concat(walk('scripts'))) {
    const text = read(path)
    problems.push(...closingWrites(path, text).map(l => `rule 1, only the board route closes a board item: ${l}`))
    problems.push(...tombstonesIn(path, text).map(l => `rule 2, ${l}`))
  }
  for (const path of walk('tests')) problems.push(...tombstonesIn(path, read(path)).map(l => `rule 2, ${l}`))

  const migrations = readdirSync(join(ROOT, 'supabase/migrations')).filter(f => f.endsWith('.sql'))
    .map(f => [f, read(join('supabase/migrations', f))] as [string, string])
  for (const problem of [kindsProblem(read(ROUTE), migrations), clientsProblem(read('apps/control-plane/api/_editEvents.ts'), migrations)]) {
    if (problem) problems.push(problem)
  }
  return problems
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = check()
  if (problems.length) {
    for (const p of problems) console.log(`FAIL  ${p}`)
    console.log(`one-close guard: ${problems.length} problem(s). Control Center's done-check sweep closes board items; record the fact instead.`)
    process.exit(1)
  }
  console.log('PASS  one-close guard: only the board route closes a board item, and the kinds and session clients agree with the database')
}

