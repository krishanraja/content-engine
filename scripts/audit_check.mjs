#!/usr/bin/env node
// CI's dependency audit: `npm audit --audit-level=high`, except the advisories config/audit-allow.json allows until its
// recheck date (Ruling, Krish, 2026-11-17: allow GHSA-fc5q-39xc-vjpf, a picomatch ReDoS with no fixed release, and
// recheck weekly). Any other high or critical advisory fails, and so does an allowed one past its recheck date.
//   node scripts/audit_check.mjs              run npm audit and judge it
//   node scripts/audit_check.mjs --self-test  check the judging rule
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const HIGH = new Set(['high', 'critical'])

/** The high or critical advisories npm audit reports that the allow list does not cover today, and allowed ones past
 *  their recheck date, as lines to print. Empty means the audit passes. */
export function judge(audit, allow, today) {
  const allowed = new Map((allow?.allow || []).map(a => [a.advisory, a]))
  const out = []
  const seen = new Set()
  for (const [name, v] of Object.entries(audit?.vulnerabilities || {})) {
    if (!HIGH.has(v.severity)) continue
    // An advisory's own entries carry its id in their url; a package that is vulnerable only through another one
    // (vite through picomatch) names that package, and is judged there.
    for (const via of v.via || []) {
      if (typeof via !== 'object' || !HIGH.has(via.severity)) continue
      const id = /GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}/.exec(String(via.url || ''))?.[0] || String(via.source)
      if (seen.has(id)) continue
      seen.add(id)
      const a = allowed.get(id)
      if (!a) out.push(`${name}: ${via.severity} ${id} ${via.title || ''} is not allowed (config/audit-allow.json)`)
      else if (!(today < a.recheck_by)) out.push(`${name}: ${id} was allowed until ${a.recheck_by}; recheck it, then move the date or remove the entry`)
    }
  }
  return out
}

function selfTest() {
  const pico = { picomatch: { severity: 'high', via: [{ source: 1, severity: 'high', title: 'ReDoS', url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf' }] },
    vite: { severity: 'high', via: ['picomatch'] } }
  const allow = { allow: [{ advisory: 'GHSA-fc5q-39xc-vjpf', recheck_by: '2026-11-24' }] }
  const cases = [
    ['an allowed advisory before its date passes', judge({ vulnerabilities: pico }, allow, '2026-11-17').length, 0],
    ['on its recheck date it fails', judge({ vulnerabilities: pico }, allow, '2026-11-24').length, 1],
    ['with no allow list it fails', judge({ vulnerabilities: pico }, { allow: [] }, '2026-11-17').length, 1],
    ['another high advisory fails', judge({ vulnerabilities: { ...pico, x: { severity: 'high', via: [{ source: 2, severity: 'high', title: 'Other', url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc' }] } } }, allow, '2026-11-17').length, 1],
    ['a moderate advisory is not judged', judge({ vulnerabilities: { y: { severity: 'moderate', via: [{ source: 3, severity: 'moderate', url: 'https://github.com/advisories/GHSA-dddd-eeee-ffff' }] } } }, allow, '2026-11-17').length, 0],
  ]
  let bad = 0
  for (const [what, got, want] of cases) if (got !== want) { bad++; console.error(`FAIL ${what}: ${got} != ${want}`) }
  if (bad) process.exit(1)
  console.log(`audit check self-test passed: ${cases.length} checks`)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--self-test')) selfTest()
  else {
    let raw
    try { raw = execFileSync('npm', ['audit', '--json'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) }
    catch (e) { raw = e.stdout } // npm audit exits non-zero when it finds anything
    const allow = JSON.parse(readFileSync(new URL('../config/audit-allow.json', import.meta.url), 'utf8'))
    const problems = judge(JSON.parse(raw), allow, new Date().toISOString().slice(0, 10))
    for (const p of problems) console.error(p)
    if (problems.length) process.exit(1)
    console.log('dependency audit: no high or critical advisory outside config/audit-allow.json')
  }
}
