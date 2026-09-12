// Rotate the active runner receipt-signing credential without losing the
// authenticated runtime history.
//
// Why this exists: on 2026-09-08 that credential was rotated as though it were
// an ordinary cloud secret. It is not. It is also
// RUNNER_RECEIPT_SIGNING_CREDENTIAL, and it signs local runtime state: the
// authority marker, every claimed command journal, every acknowledged receipt,
// and the project-state cursor and conflict journals. The runner refused to
// start, because listAuthenticatedClaims throws on any file it cannot
// authenticate and offers no skip path. Twenty-three files had to be verified
// under the old key and re-signed under the new one before it would run again.
//
// What makes this safe to automate is a property of the scheme rather than of
// this script: every signature the runner key produces is
// signRunnerReceiptHash(key, someHash), an HMAC over a hash that is already
// stored in the same record. So re-signing needs no knowledge of the body, no
// re-derivation, and no reserialisation of anything that is hashed. The bodies
// and their hashes are untouched; only signature values change, which is why a
// rotated runtime keeps its runner_id and its history.
//
// This script deliberately does NOT rotate MindmakeVideoStudio/approval-signing-key.
// That one is signed over BODIES (signApprovalReceiptBody,
// signRunnerLedgerEventBody in job-store-v2.ts), so rotating it means
// reconstructing every receipt body exactly as its writer built it, including
// the event chain hashes. That is a different and much more dangerous job, and
// a script that half-does it would corrupt the approval ledger, which is the
// one artifact the whole hash-bound approval story rests on. See the note at
// the bottom of this file.
//
//   npx tsx scripts/rotate-runner-signing-key.ts
//   npx tsx scripts/rotate-runner-signing-key.ts --commit \
//     --new-credential-target MindmakeVideoStudio/control-center-runner-signing-key-v2
//
// Windows only: the credential lives in Credential Manager and the runtime root
// is a Windows path.

import { createHash } from 'node:crypto'
import { mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  RUNNER_RECEIPT_SIGNING_CREDENTIAL,
  signRunnerReceiptHash,
  verifyRunnerReceiptHash,
} from '../packages/core/src/approval-signing.js'
import { readWindowsCredential } from '../packages/core/src/credentials.js'

const HEX64 = /^[a-f0-9]{64}$/
const SIGNATURE_SUFFIX = '_signature'
const HASH_SUFFIX = '_hash'
const BODY_SIGNATURE_FIELDS = new Set(['binding_signature'])

interface SignaturePair {
  /** Dotted path to the signature field, for the report. */
  path: string
  hash: string
  signature: string
  /** Replaces the signature in place. */
  set: (value: string) => void
}

/** Every (X_hash, X_signature) pair in a parsed record, at any depth.
 *
 *  Pairs are found by name rather than by a schema on purpose. The runner
 *  writes at least six shapes (marker, claim journal, receipt, cursor,
 *  conflict, resolution) and more will be added; a rotation that knows only
 *  today's list silently skips tomorrow's and leaves a runtime that will not
 *  start. Anything that looks like a signature but has no matching hash is
 *  reported as unrotatable rather than ignored. */
function findSignaturePairs(node: unknown, path: string, out: SignaturePair[], orphans: string[]): void {
  if (Array.isArray(node)) {
    node.forEach((item, index) => findSignaturePairs(item, `${path}[${index}]`, out, orphans))
    return
  }
  if (!node || typeof node !== 'object') return
  const record = node as Record<string, unknown>

  for (const [key, value] of Object.entries(record)) {
    if (BODY_SIGNATURE_FIELDS.has(key)) continue
    if (key.endsWith(SIGNATURE_SUFFIX) && typeof value === 'string') {
      const stem = key.slice(0, -SIGNATURE_SUFFIX.length)
      const hashKey = `${stem}${HASH_SUFFIX}`
      const hash = record[hashKey]
      const here = path ? `${path}.${key}` : key
      if (typeof hash === 'string' && HEX64.test(hash) && HEX64.test(value)) {
        out.push({ path: here, hash, signature: value, set: v => { record[key] = v } })
      } else {
        orphans.push(here)
      }
      continue
    }
    findSignaturePairs(value, path ? `${path}.${key}` : key, out, orphans)
  }
}

function jsonFilesUnder(root: string): string[] {
  const found: string[] = []
  const walk = (directory: string) => {
    let entries: string[]
    try { entries = readdirSync(directory) } catch { return }
    for (const entry of entries) {
      const full = join(directory, entry)
      let info
      try { info = statSync(full) } catch { continue }
      if (info.isDirectory()) walk(full)
      else if (info.isFile() && entry.endsWith('.json')) found.push(full)
    }
  }
  walk(root)
  return found.sort()
}

interface FileReport {
  file: string
  pairs: SignaturePair[]
  orphans: string[]
  parsed: unknown
  failedUnderOldKey: string[]
}

function inspect(files: string[], oldKey: Buffer): FileReport[] {
  const reports: FileReport[] = []
  for (const file of files) {
    let parsed: unknown
    try { parsed = JSON.parse(readFileSync(file, 'utf8')) } catch { continue }
    const pairs: SignaturePair[] = []
    const orphans: string[] = []
    findSignaturePairs(parsed, '', pairs, orphans)
    if (!pairs.length && !orphans.length) continue
    const failedUnderOldKey = pairs
      .filter(pair => !verifyRunnerReceiptHash(oldKey, pair.hash, pair.signature))
      .map(pair => pair.path)
    reports.push({ file, pairs, orphans, parsed, failedUnderOldKey })
  }
  return reports
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const commit = args.includes('--commit')

  /** A flag given without a value is an operator mistake worth stopping on, not
   *  a reason to fall back to a default. */
  const valueOf = (flag: string): string | null => {
    const at = args.indexOf(flag)
    if (at < 0) return null
    const value = args[at + 1]
    if (value === undefined || value.startsWith('--')) {
      console.error(`${flag} needs a value.`)
      process.exit(2)
    }
    return value
  }

  if (process.platform !== 'win32') {
    console.error('This rotates a Windows Credential Manager secret and a Windows runtime root. Run it on the runner machine.')
    process.exit(2)
  }

  const runtimeRoot = resolve(valueOf('--runtime-root')
    ?? join(process.env.USERPROFILE || '', 'Documents', 'MindmakeVideoStudio', 'runtime'))

  const repoRoot = resolve(new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
  const newCredentialTarget = valueOf('--new-credential-target')
  if (newCredentialTarget && !/^MindmakeVideoStudio\/control-center-runner-signing-key-v(?:[2-9]|[1-9][0-9]+)$/.test(newCredentialTarget)) {
    console.error('--new-credential-target must name a versioned control-center runner-signing credential.')
    process.exit(2)
  }
  if (commit && !newCredentialTarget) {
    console.error('--commit requires --new-credential-target. A signing key must never be passed on the command line.')
    process.exit(2)
  }
  if (newCredentialTarget === RUNNER_RECEIPT_SIGNING_CREDENTIAL) {
    console.error('The new credential target must differ from the active target. Reusing a roaming-contaminated name is not a rotation.')
    process.exit(2)
  }

  console.log(`runtime root : ${runtimeRoot}`)
  console.log(`credential   : ${RUNNER_RECEIPT_SIGNING_CREDENTIAL}`)
  console.log(`mode         : ${commit ? 'COMMIT' : 'dry run (pass --commit to write)'}`)
  console.log('')

  const oldSecret = await readWindowsCredential(repoRoot, RUNNER_RECEIPT_SIGNING_CREDENTIAL)
  const oldKey = Buffer.from(oldSecret, 'utf8')
  if (oldKey.byteLength < 32) {
    console.error('The current credential is shorter than 32 bytes, which the loader rejects. Refusing to rotate from a key the runner would not accept.')
    process.exit(2)
  }

  const newSecret = newCredentialTarget
    ? await readWindowsCredential(repoRoot, newCredentialTarget)
    : null
  const newKey = newSecret ? Buffer.from(newSecret, 'utf8') : null
  if (newKey && newKey.byteLength < 32) {
    console.error('The new credential is shorter than 32 bytes; the runner would reject it.')
    process.exit(2)
  }
  if (newKey?.equals(oldKey)) {
    console.error('The new credential is the same as the current one. Nothing to rotate.')
    process.exit(2)
  }

  // ── 1. Read everything and verify it under the key we are replacing ───────
  const reports = inspect(jsonFilesUnder(runtimeRoot), oldKey)
  const totalPairs = reports.reduce((n, r) => n + r.pairs.length, 0)
  const failures = reports.filter(r => r.failedUnderOldKey.length)
  const orphaned = reports.filter(r => r.orphans.length)

  console.log(`signed files : ${reports.length}`)
  console.log(`signatures   : ${totalPairs}`)
  console.log('')

  if (orphaned.length) {
    console.error('REFUSING: these carry a signature field with no matching hash beside it, so they cannot be re-signed without knowing what they sign:')
    for (const r of orphaned) console.error(`  ${r.file}`), r.orphans.forEach(o => console.error(`    ${o}`))
    console.error('')
    console.error('Rotating around them would leave the runtime half-signed, which is the state that stops the runner starting.')
    process.exit(1)
  }

  if (failures.length) {
    console.error('REFUSING: these do not verify under the CURRENT key, so re-signing them would attest something that was never legitimately signed:')
    for (const r of failures) console.error(`  ${r.file}`), r.failedUnderOldKey.forEach(p => console.error(`    ${p}`))
    console.error('')
    console.error('Either the credential in Credential Manager is not the one these were signed with, or the runtime is already damaged. Fix that first.')
    process.exit(1)
  }

  console.log(`OK: all ${totalPairs} signatures verify under the current key.`)

  if (!commit) {
    console.log('')
    console.log('Dry run. Re-run with --commit and --new-credential-target to back up and re-sign the runtime.')
    return
  }

  if (!newKey || !newCredentialTarget || !newSecret) throw new Error('new credential preflight did not complete')

  // ── 2. Back up before touching anything ──────────────────────────────────
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backup = `${runtimeRoot}.backup-${stamp}`
  mkdirSync(backup, { recursive: true })
  cpSync(runtimeRoot, backup, { recursive: true })
  console.log(`backup       : ${backup}`)

  // ── 3. Re-sign, in memory, then write ────────────────────────────────────
  for (const report of reports) {
    for (const pair of report.pairs) pair.set(signRunnerReceiptHash(newKey, pair.hash))
    writeFileSync(report.file, `${JSON.stringify(report.parsed, null, 2)}\n`, 'utf8')
  }

  // ── 4. Read back from disk and verify under the NEW key ──────────────────
  // Re-read rather than trust the in-memory objects: the point of this pass is
  // to catch a bad write, and an in-memory check cannot.
  const after = inspect(jsonFilesUnder(runtimeRoot), newKey)
  const stillBad = after.filter(r => r.failedUnderOldKey.length)
  if (stillBad.length) {
    console.error('')
    console.error('The re-signed runtime does not verify under the new key. The backup above is intact; restore it and do not write the credential.')
    for (const r of stillBad) console.error(`  ${r.file}`)
    process.exit(1)
  }
  const afterCount = after.reduce((n, r) => n + r.pairs.length, 0)
  if (afterCount !== totalPairs) {
    console.error(`Signature count changed from ${totalPairs} to ${afterCount}. Restore the backup and investigate before writing the credential.`)
    process.exit(1)
  }
  console.log(`OK: all ${afterCount} signatures verify under the new key.`)

  // ── 5. Report the already-stored target without revealing it ─────────────
  console.log('')
  const fingerprint = createHash('sha256').update(newSecret).digest('hex').slice(0, 12)
  console.log(`The runtime now verifies under ${newCredentialTarget} (fingerprint ${fingerprint}).`)
  console.log('Deploy the matching VIDEO_STUDIO_RUNNER_SIGNING_KEY, update the active credential constant, reinstall the clean runner checkout, and prove a signed receipt round trip before restarting normal work.')
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})

// A note on the other key, because the next person will ask.
//
// MindmakeVideoStudio/approval-signing-key cannot be rotated this way.
// job-store-v2.ts signs with signApprovalReceiptBody and
// signRunnerLedgerEventBody, both of which HMAC a stableJson body rather than a
// stored hash, and those bodies are built from the event identity, the approval
// or decision, and the PRIOR EVENT CHAIN HASH. Re-signing them means
// reconstructing each body exactly as its writer built it, in chain order.
// Getting one field or one ordering wrong produces a signature that verifies as
// valid and attests the wrong thing, which is worse than a runner that will not
// start. If that key must be rotated, the honest path is a migration inside
// job-store-v2.ts that reuses its own body builders, with the same
// verify-all-first and restore-on-failure discipline as this script.
