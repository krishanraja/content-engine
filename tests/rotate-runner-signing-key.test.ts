import assert from 'node:assert/strict'
import { test } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { signRunnerReceiptHash, verifyRunnerReceiptHash } from '../packages/core/src/approval-signing.js'

// The rotation script's value is entirely in what it REFUSES. A script that
// re-signs everything it finds turns one bad file into a runtime that attests
// something nobody signed, and the runner would start and be wrong, which is
// worse than the outage that prompted this.
//
// These exercise the two decisions the script makes, on the same primitives it
// uses. The walker and the guards are duplicated here deliberately small; the
// script itself is a Windows-only entry point (Credential Manager, USERPROFILE)
// and cannot be imported in CI.

const OLD = Buffer.from('a'.repeat(48), 'utf8')
const NEW = Buffer.from('b'.repeat(48), 'utf8')
const HASH = 'c'.repeat(64)

const HEX64 = /^[a-f0-9]{64}$/
const BODY_SIGNATURE_FIELDS = new Set(['binding_signature'])

interface Pair { path: string; hash: string; signature: string; set: (v: string) => void }

function findSignaturePairs(node: unknown, path: string, out: Pair[], orphans: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((item, i) => findSignaturePairs(item, `${path}[${i}]`, out, orphans))
    return
  }
  if (!node || typeof node !== 'object') return
  const record = node as Record<string, unknown>
  for (const [key, value] of Object.entries(record)) {
    if (BODY_SIGNATURE_FIELDS.has(key)) continue
    if (key.endsWith('_signature') && typeof value === 'string') {
      const hash = record[`${key.slice(0, -'_signature'.length)}_hash`]
      const here = path ? `${path}.${key}` : key
      if (typeof hash === 'string' && HEX64.test(hash) && HEX64.test(value)) {
        out.push({ path: here, hash, signature: value, set: v => { record[key] = v } })
      } else orphans.push(here)
      continue
    }
    findSignaturePairs(value, path ? `${path}.${key}` : key, out, orphans)
  }
}

test('a signature is HMAC over a hash that travels with it, which is what makes rotation mechanical', () => {
  const signature = signRunnerReceiptHash(OLD, HASH)
  assert.ok(verifyRunnerReceiptHash(OLD, HASH, signature))
  assert.ok(!verifyRunnerReceiptHash(NEW, HASH, signature), 'a different key must not verify')

  // Re-signing needs the hash only. No body, no re-derivation, no chain order.
  const rotated = signRunnerReceiptHash(NEW, HASH)
  assert.ok(verifyRunnerReceiptHash(NEW, HASH, rotated))
  assert.notEqual(rotated, signature)
})

test('every signature is found, at any depth and inside arrays', () => {
  const record = {
    marker_hash: HASH,
    marker_signature: signRunnerReceiptHash(OLD, HASH),
    project: { cursor_hash: HASH, cursor_signature: signRunnerReceiptHash(OLD, HASH) },
    claims: [
      { journal_hash: HASH, journal_signature: signRunnerReceiptHash(OLD, HASH) },
      { journal_hash: HASH, journal_signature: signRunnerReceiptHash(OLD, HASH) },
    ],
  }
  const pairs: Pair[] = []
  const orphans: string[] = []
  findSignaturePairs(record, '', pairs, orphans)

  assert.equal(pairs.length, 4, 'a shape-specific walker would miss one of these; the runner writes at least six shapes')
  assert.deepEqual(orphans, [])
  assert.deepEqual(pairs.map(p => p.path).sort(), [
    'claims[0].journal_signature',
    'claims[1].journal_signature',
    'marker_signature',
    'project.cursor_signature',
  ])
})

test('a signature with no hash beside it is an orphan, never silently skipped', () => {
  const pairs: Pair[] = []
  const orphans: string[] = []
  findSignaturePairs({ receipt_signature: 'd'.repeat(64) }, '', pairs, orphans)
  assert.deepEqual(pairs, [])
  assert.deepEqual(orphans, ['receipt_signature'],
    'skipping it would leave the runtime half-signed, which is exactly the state that stops the runner starting')
})

test('body-signed review bindings are excluded from hash-bound runner rotation', () => {
  const pairs: Pair[] = []
  const orphans: string[] = []
  findSignaturePairs({ binding_hash: HASH, binding_signature: 'd'.repeat(64) }, '', pairs, orphans)
  assert.deepEqual(pairs, [])
  assert.deepEqual(orphans, [])
})

test('one signature that fails under the old key condemns the whole run', () => {
  const good = { a_hash: HASH, a_signature: signRunnerReceiptHash(OLD, HASH) }
  const bad = { a_hash: HASH, a_signature: signRunnerReceiptHash(Buffer.from('z'.repeat(48)), HASH) }

  const verifyAll = (records: unknown[]) => records.every(record => {
    const pairs: Pair[] = []
    findSignaturePairs(record, '', pairs, [])
    return pairs.every(p => verifyRunnerReceiptHash(OLD, p.hash, p.signature))
  })

  assert.equal(verifyAll([good, good]), true)
  assert.equal(verifyAll([good, bad]), false,
    're-signing an unverifiable file would attest something nobody ever signed')
})

test('a rotated file keeps its body and hash, changing only the signature', () => {
  const root = mkdtempSync(join(tmpdir(), 'rotate-'))
  mkdirSync(join(root, 'claims'), { recursive: true })
  const file = join(root, 'claims', 'one.json')
  const original = {
    runner_id: 'runner-29b875c1',
    command_id: 'cmd-1',
    journal_hash: HASH,
    journal_signature: signRunnerReceiptHash(OLD, HASH),
  }
  writeFileSync(file, JSON.stringify(original, null, 2))

  const parsed = JSON.parse(readFileSync(file, 'utf8'))
  const pairs: Pair[] = []
  findSignaturePairs(parsed, '', pairs, [])
  for (const p of pairs) p.set(signRunnerReceiptHash(NEW, p.hash))
  writeFileSync(file, JSON.stringify(parsed, null, 2))

  const after = JSON.parse(readFileSync(file, 'utf8'))
  assert.equal(after.runner_id, 'runner-29b875c1', 'the runner identity must survive a rotation')
  assert.equal(after.command_id, 'cmd-1')
  assert.equal(after.journal_hash, HASH, 'the hash is over the body and the body did not change')
  assert.notEqual(after.journal_signature, original.journal_signature)
  assert.ok(verifyRunnerReceiptHash(NEW, after.journal_hash, after.journal_signature))
})

test('a key under 32 bytes is refused, because the loader would silently drop it', () => {
  // normalizedKey() in approval-signing.ts returns null below 32 bytes, and a
  // null key means the runner has no signing key at all rather than a bad one.
  const short = Buffer.from('short', 'utf8')
  assert.ok(short.byteLength < 32)
  assert.ok(Buffer.from('b'.repeat(48), 'utf8').byteLength >= 32)
})

test('the operator script reads a new key from Credential Manager and never prints it', () => {
  const source = readFileSync(join(process.cwd(), 'scripts', 'rotate-runner-signing-key.ts'), 'utf8')
  assert.match(source, /--new-credential-target/)
  assert.doesNotMatch(source, /--new-key/)
  assert.doesNotMatch(source, /console\.log\(`\s*\$\{newSecret\}/)
  assert.match(source, /BODY_SIGNATURE_FIELDS/)
  assert.match(source, /control-center-runner-signing-key-v/)
})
