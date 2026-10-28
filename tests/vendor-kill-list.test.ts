import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// makeyourmindup's kill list, vendored with a version pin (plan of 28 Oct
// 2026, W2: make-piece runs it before any paid call). The bytes here may only
// change together with vendor/makeyourmindup/kill-list/SOURCE.md, which names
// the upstream commit and every file's hash.

const ROOT = join(__dirname, '..')
const DIR = join(ROOT, 'vendor', 'makeyourmindup', 'kill-list')
const SOURCE = readFileSync(join(DIR, 'SOURCE.md'), 'utf8')
const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex')

interface Row { file: string; upstreamPath: string; upstream: string; vendored: string }
const rows: Row[] = [...SOURCE.matchAll(/^\| `([^`]+)` \| `([^`]+)` \| `([0-9a-f]{64})` \| `([0-9a-f]{64})` \|$/gm)]
  .map((m) => ({ file: m[1] ?? '', upstreamPath: m[2] ?? '', upstream: m[3] ?? '', vendored: m[4] ?? '' }))
const lineOf = (label: string) => new RegExp(`^- ${label} line: \`(.+)\`$`, 'm').exec(SOURCE)?.[1] ?? ''

const gate = (args: string[], input?: string) =>
  spawnSync(process.execPath, [join(DIR, 'kill-list.mjs'), ...args], { cwd: ROOT, encoding: 'utf8', input })

describe('the vendored kill list', () => {
  it('names the upstream repository and a full commit', () => {
    expect(SOURCE).toContain('`krishanraja/makeyourmindup`')
    expect(SOURCE).toMatch(/^- Commit: `[0-9a-f]{40}`/m)
  })

  it('every vendored file is listed in SOURCE.md and matches its hash', () => {
    const files = readdirSync(DIR).filter((f) => f !== 'SOURCE.md').sort()
    expect(rows.map((r) => r.file).sort()).toEqual(files)
    for (const r of rows) expect(sha(readFileSync(join(DIR, r.file))), `${r.file} changed without SOURCE.md`).toBe(r.vendored)
  })

  it('differs from upstream only by the one line SOURCE.md names', () => {
    const upstreamLine = lineOf('Upstream')
    const vendoredLine = lineOf('Vendored')
    expect(upstreamLine && vendoredLine).toBeTruthy()
    for (const r of rows) {
      const bytes = readFileSync(join(DIR, r.file), 'utf8')
      if (r.upstream === r.vendored) continue
      expect(bytes.split(vendoredLine).length, `${r.file} holds the vendored line once`).toBe(2)
      expect(sha(bytes.replace(vendoredLine, upstreamLine)), `${r.file} with the upstream line put back`).toBe(r.upstream)
    }
    expect(rows.filter((r) => r.upstream !== r.vendored).map((r) => r.file)).toEqual(['kill-list.mjs'])
  })

  it('the upstream self-test passes on the vendored copy', () => {
    const r = spawnSync(process.execPath, [join(DIR, 'kill-list-self-test.mjs')], { cwd: ROOT, encoding: 'utf8' })
    expect(r.status, r.stdout + r.stderr).toBe(0)
  })

  it('runs as the make-piece check runs it: a veto exits 1, clean copy exits 0', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'kill-list-'))
    const dirty = join(tmp, 'dirty.md')
    const clean = join(tmp, 'clean.md')
    writeFileSync(dirty, `Disney hired the team ${String.fromCodePoint(0x2014)} and it will leverage the code.\n`)
    writeFileSync(clean, 'Disney hired the team and kept the code.\n')
    const bad = gate([dirty])
    expect(bad.status).toBe(1)
    expect(bad.stdout).toContain('em_dash')
    expect(bad.stdout).toContain('banned_vocabulary')
    const good = gate([clean])
    expect(good.status, good.stdout + good.stderr).toBe(0)
    expect(gate(['--stdin'], 'A plain line.\n').status).toBe(0)
  })
})
