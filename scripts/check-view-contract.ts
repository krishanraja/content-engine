// The Publish Board view's contract check (Ruling, Krish, 2026-11-11: engine changes upgrade Control Centre's board and
// never break it). Compares apps/control-plane/api/board/view.schema.json with the same file on main (or --base <ref>)
// and fails only on a breaking change that is not a major bump. An additive change passes, with a notice reminding
// that Control Centre's pinned copy is behind (control-center tests/fixtures/board-view/), which it draws generically
// until it is copied. Also exported: validate(), the small JSON Schema reader the contract test runs every view through.
//
//   npx tsx scripts/check-view-contract.ts            compare with main
//   npx tsx scripts/check-view-contract.ts --base REF compare with REF
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SCHEMA_PATH = 'apps/control-plane/api/board/view.schema.json'

type S = Record<string, unknown>
const isObj = (v: unknown): v is S => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

function deref(root: S, s: unknown): S {
  let cur: unknown = s
  for (let i = 0; i < 20 && isObj(cur) && typeof cur.$ref === 'string'; i++) {
    const ref = cur.$ref
    if (!ref.startsWith('#/')) throw new Error(`only local refs: ${ref}`)
    cur = ref.slice(2).split('/').reduce<unknown>((o, k) => (isObj(o) ? o[k] : undefined), root)
  }
  if (!isObj(cur)) throw new Error('a schema node is not an object')
  return cur
}

const types = (s: S): string[] => (Array.isArray(s.type) ? s.type.map(String) : typeof s.type === 'string' ? [s.type] : [])
function typeOf(v: unknown): string {
  if (v === null) return 'null'
  if (Array.isArray(v)) return 'array'
  if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number'
  return typeof v
}
const fits = (t: string, v: unknown) => t === typeOf(v) || (t === 'number' && typeOf(v) === 'integer')

/** Every way `value` breaks `schema` (a subset of JSON Schema: type, const, enum, pattern, properties, required,
 *  items, minItems, maxItems, allOf, if/then, $ref). Empty when it keeps the contract. With open, a value outside an
 *  enum marked x-open passes: that is how Control Centre reads it (a kind it does not know is drawn generically); the
 *  engine's own views are held to the declared values, so every kind it sends is in the schema. */
export function validate(root: S, value: unknown, node: unknown = root, at = '$', opts: { open?: boolean } = {}): string[] {
  const s = deref(root, node)
  const out: string[] = []
  const t = types(s)
  if (t.length && !t.some(x => fits(x, value))) return [`${at}: is ${typeOf(value)}, the contract says ${t.join(' or ')}`]
  if ('const' in s && JSON.stringify(s.const) !== JSON.stringify(value)) out.push(`${at}: is not ${JSON.stringify(s.const)}`)
  if (Array.isArray(s.enum) && !(opts.open && s['x-open'] === true) && !s.enum.some(e => JSON.stringify(e) === JSON.stringify(value))) out.push(`${at}: ${JSON.stringify(value)} is not one of ${JSON.stringify(s.enum)}`)
  if (typeof s.pattern === 'string' && typeof value === 'string' && !new RegExp(s.pattern).test(value)) out.push(`${at}: does not match ${s.pattern}`)
  if (isObj(value)) {
    for (const k of Array.isArray(s.required) ? s.required.map(String) : []) if (!(k in value)) out.push(`${at}.${k}: missing`)
    if (isObj(s.properties)) for (const [k, sub] of Object.entries(s.properties)) if (k in value) out.push(...validate(root, value[k], sub, `${at}.${k}`, opts))
  }
  if (Array.isArray(value)) {
    if (typeof s.minItems === 'number' && value.length < s.minItems) out.push(`${at}: fewer than ${s.minItems} items`)
    if (typeof s.maxItems === 'number' && value.length > s.maxItems) out.push(`${at}: more than ${s.maxItems} items`)
    if (s.items !== undefined) value.forEach((v, i) => out.push(...validate(root, v, s.items, `${at}[${i}]`, opts)))
  }
  if (Array.isArray(s.allOf)) for (const sub of s.allOf) out.push(...validate(root, value, sub, at, opts))
  if (s.if !== undefined && s.then !== undefined && validate(root, value, s.if, at).length === 0) out.push(...validate(root, value, s.then, at, opts))
  return out
}

/** What changed between two versions of the schema, split into what breaks a reader and what only adds. */
export function compare(oldRoot: S, newRoot: S): { breaking: string[]; additive: string[] } {
  const breaking: string[] = []
  const additive: string[] = []
  const seen = new Set<string>()
  const walk = (o: unknown, n: unknown, at: string) => {
    const a = deref(oldRoot, o), b = deref(newRoot, n)
    const key = `${at}|${JSON.stringify(a)}|${JSON.stringify(b)}`
    if (seen.has(key)) return
    seen.add(key)
    const ta = types(a), tb = types(b)
    for (const t of tb) if (ta.length && !ta.includes(t) && !(t === 'integer' && ta.includes('number'))) breaking.push(`${at}: may now be ${t}`)
    for (const t of ta) if (tb.length && !tb.includes(t)) additive.push(`${at}: is never ${t} now`)
    if (JSON.stringify(a.const) !== JSON.stringify(b.const)) breaking.push(`${at}: its fixed value changed`)
    if (a.pattern !== b.pattern) breaking.push(`${at}: its pattern changed`)
    if (Array.isArray(a.enum) || Array.isArray(b.enum)) {
      const ea = (Array.isArray(a.enum) ? a.enum : []).map(x => JSON.stringify(x)), eb = (Array.isArray(b.enum) ? b.enum : []).map(x => JSON.stringify(x))
      const open = b['x-open'] === true
      for (const e of eb) if (!ea.includes(e)) (open ? additive : breaking).push(`${at}: may now be ${e}${open ? ' (an open list: drawn generically)' : ''}`)
      for (const e of ea) if (!eb.includes(e)) additive.push(`${at}: is never ${e} now`)
      if (a['x-open'] === true && !open) breaking.push(`${at}: its list is closed now`)
    }
    for (const k of ['minItems', 'maxItems'] as const) if (a[k] !== b[k]) breaking.push(`${at}: ${k} changed`)
    const pa = isObj(a.properties) ? a.properties : {}, pb = isObj(b.properties) ? b.properties : {}
    const ra = Array.isArray(a.required) ? a.required.map(String) : [], rb = Array.isArray(b.required) ? b.required.map(String) : []
    for (const k of Object.keys(pa)) {
      if (!(k in pb)) breaking.push(`${at}.${k}: removed or renamed`)
      else walk(pa[k], pb[k], `${at}.${k}`)
    }
    for (const k of Object.keys(pb)) if (!(k in pa)) additive.push(`${at}.${k}: added`)
    for (const k of ra) if (!rb.includes(k) && !(k in pa && !(k in pb))) breaking.push(`${at}.${k}: no longer always sent`)
    for (const k of rb) if (!ra.includes(k)) additive.push(`${at}.${k}: always sent now`)
    const aa = Array.isArray(a.allOf) ? a.allOf : [], ba = Array.isArray(b.allOf) ? b.allOf : []
    aa.forEach((rule, k) => {
      const nr = ba[k]
      if (nr === undefined) { breaking.push(`${at}: its rule ${k + 1} was removed`); return }
      const ra2 = deref(oldRoot, rule), rb2 = deref(newRoot, nr)
      if (JSON.stringify(ra2.if) !== JSON.stringify(rb2.if)) breaking.push(`${at}: its rule ${k + 1} now applies elsewhere`)
      else if (ra2.then !== undefined && rb2.then !== undefined) walk(ra2.then, rb2.then, `${at}(rule ${k + 1})`)
    })
    for (let k = aa.length; k < ba.length; k++) additive.push(`${at}: rule ${k + 1} added`)
    if (a.items !== undefined && b.items !== undefined) walk(a.items, b.items, `${at}[]`)
    else if (a.items !== undefined) breaking.push(`${at}[]: its items lost their shape`)
  }
  walk(oldRoot, newRoot, '$')
  return { breaking, additive }
}

const version = (s: S) => String(s['x-contract-version'] || '0.0.0').split('.').map(n => Number(n) || 0)

/** The verdict on one change of the schema: ok, and the lines to print. */
export function judge(oldRoot: S | null, newRoot: S): { ok: boolean; lines: string[] } {
  if (!oldRoot) return { ok: true, lines: ['The view contract is new on this branch: nothing to compare.'] }
  if (JSON.stringify(oldRoot) === JSON.stringify(newRoot)) return { ok: true, lines: ['The view contract is unchanged.'] }
  const { breaking, additive } = compare(oldRoot, newRoot)
  const [oa = 0, ob = 0, oc = 0] = version(oldRoot), [na = 0, nb = 0, nc = 0] = version(newRoot)
  const bumped = na !== oa || nb !== ob || nc !== oc
  const major = na > oa
  const lines: string[] = []
  if (breaking.length && !major) {
    return { ok: false, lines: [
      `The view contract breaks Control Centre's Publish Board and is not a major bump (${oa}.${ob}.${oc} to ${na}.${nb}.${nc}).`,
      'The rule (docs/PUBLISH_BOARDS.md, "The view\'s contract"): add freely; never remove or rename a field.',
      ...breaking.map(b => `  breaks: ${b}`)] }
  }
  if (!bumped) return { ok: false, lines: ['The view contract changed but x-contract-version did not: bump the minor for an addition.', ...additive.map(a => `  adds: ${a}`)] }
  if (breaking.length) lines.push(`::warning title=Publish Board contract, major ${na}::Control Centre falls back to the archive page until it reads major ${na}. Update control-center src/surfaces/content/board/contract.ts and its pinned copy (tests/fixtures/board-view/).`, ...breaking.map(b => `  breaks: ${b}`))
  lines.push(`::notice title=Publish Board contract ${na}.${nb}.${nc}::Control Centre draws the additions generically. Copy ${SCHEMA_PATH} and fixtures/view.json to control-center tests/fixtures/board-view/ and update its pin (engine commit and sha256) to draw them by design.`)
  lines.push(...additive.map(a => `  adds: ${a}`))
  return { ok: true, lines }
}

function git(args: string[]): string | null {
  try { return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return null }
}

function main(): number {
  const i = process.argv.indexOf('--base')
  let base = i > 0 ? process.argv[i + 1] || 'origin/main' : 'origin/main'
  if (i < 0 && !git(['rev-parse', '--verify', '--quiet', base])) git(['fetch', '--quiet', '--depth=50', 'origin', 'main'])
  if (!git(['rev-parse', '--verify', '--quiet', base])) {
    console.log(`NOT CHECKED: ${base} is not reachable here, so the view contract was not compared.`)
    return 0
  }
  const mb = git(['merge-base', 'HEAD', base])?.trim()
  if (mb) base = mb
  const before = git(['show', `${base}:${SCHEMA_PATH}`])
  const after = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8')) as S
  const verdict = judge(before ? JSON.parse(before) as S : null, after)
  for (const l of verdict.lines) (verdict.ok ? console.log : console.error)(l)
  return verdict.ok ? 0 : 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) process.exit(main())
