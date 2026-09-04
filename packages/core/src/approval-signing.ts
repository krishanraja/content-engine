import { createHmac, timingSafeEqual } from 'node:crypto'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readWindowsCredential } from './credentials.js'
import { stableJson } from './hash.js'

export const APPROVAL_SIGNING_CREDENTIAL = 'MindmakeVideoStudio/approval-signing-key'
export const RUNNER_RECEIPT_SIGNING_CREDENTIAL = 'MindmakeVideoStudio/control-center-runner-signing-key'
const APPROVAL_SIGNATURE_DOMAIN = 'MindmakeVideoStudio/ApprovalReceipt/v1'
const RUNNER_LEDGER_SIGNATURE_DOMAIN = 'MindmakeVideoStudio/RunnerLedgerEvent/v1'
const DEFAULT_REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

type ApprovalSigningKeyProvider = () => Promise<string | null | undefined> | string | null | undefined

let injectedTestProvider: ApprovalSigningKeyProvider | null | undefined
let productionKeyPromise: Promise<Buffer | null> | undefined
let injectedRunnerTestProvider: ApprovalSigningKeyProvider | null | undefined
let productionRunnerKeyPromise: Promise<Buffer | null> | undefined

function normalizedKey(secret: string | null | undefined): Buffer | null {
  if (!secret || Buffer.byteLength(secret, 'utf8') < 32) return null
  return Buffer.from(secret, 'utf8')
}

async function readProductionKey(): Promise<Buffer | null> {
  if (process.platform !== 'win32') return null
  try {
    return normalizedKey(await readWindowsCredential(DEFAULT_REPO_ROOT, APPROVAL_SIGNING_CREDENTIAL))
  } catch {
    return null
  }
}

export async function loadApprovalSigningKey(): Promise<Buffer | null> {
  if (injectedTestProvider !== undefined) {
    if (injectedTestProvider === null) return null
    try { return normalizedKey(await injectedTestProvider()) }
    catch { return null }
  }
  productionKeyPromise ??= readProductionKey()
  return productionKeyPromise
}

export function setApprovalSigningKeyProviderForTests(provider: ApprovalSigningKeyProvider | null): void {
  injectedTestProvider = provider
}

export function resetApprovalSigningKeyProviderForTests(): void {
  injectedTestProvider = undefined
}

export async function approvalSigningCredentialReady(repoRoot: string): Promise<boolean> {
  if (process.platform !== 'win32') return false
  try { return normalizedKey(await readWindowsCredential(repoRoot, APPROVAL_SIGNING_CREDENTIAL)) !== null }
  catch { return false }
}

export async function loadRunnerReceiptSigningKey(): Promise<Buffer | null> {
  if (injectedRunnerTestProvider !== undefined) {
    if (injectedRunnerTestProvider === null) return null
    try { return normalizedKey(await injectedRunnerTestProvider()) }
    catch { return null }
  }
  productionRunnerKeyPromise ??= process.platform === 'win32'
    ? readWindowsCredential(DEFAULT_REPO_ROOT, RUNNER_RECEIPT_SIGNING_CREDENTIAL).then(normalizedKey).catch(() => null)
    : Promise.resolve(null)
  return productionRunnerKeyPromise
}

export function setRunnerReceiptSigningKeyProviderForTests(provider: ApprovalSigningKeyProvider | null): void {
  injectedRunnerTestProvider = provider
}

export function resetRunnerReceiptSigningKeyProviderForTests(): void {
  injectedRunnerTestProvider = undefined
}

export async function runnerReceiptSigningCredentialReady(repoRoot: string): Promise<boolean> {
  if (process.platform !== 'win32') return false
  try { return normalizedKey(await readWindowsCredential(repoRoot, RUNNER_RECEIPT_SIGNING_CREDENTIAL)) !== null }
  catch { return false }
}

export function signApprovalReceiptBody(key: Buffer, body: unknown): string {
  return createHmac('sha256', key).update(APPROVAL_SIGNATURE_DOMAIN).update('\0').update(stableJson(body)).digest('hex')
}

export function verifyApprovalReceiptBody(key: Buffer, body: unknown, signature: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false
  const expected = Buffer.from(signApprovalReceiptBody(key, body), 'hex')
  const supplied = Buffer.from(signature, 'hex')
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function signRunnerReceiptHash(key: Buffer, receiptHash: string): string {
  if (!/^[a-f0-9]{64}$/.test(receiptHash)) throw new Error('runner receipt hash must be lowercase SHA-256')
  return createHmac('sha256', key).update(receiptHash, 'ascii').digest('hex')
}

export function verifyRunnerReceiptHash(key: Buffer, receiptHash: string, signature: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(receiptHash)) return false
  if (!/^[a-f0-9]{64}$/.test(signature)) return false
  const expected = Buffer.from(signRunnerReceiptHash(key, receiptHash), 'hex')
  const supplied = Buffer.from(signature, 'hex')
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

export function signRunnerLedgerEventBody(key: Buffer, body: unknown): string {
  return createHmac('sha256', key).update(RUNNER_LEDGER_SIGNATURE_DOMAIN).update('\0').update(stableJson(body)).digest('hex')
}

export function verifyRunnerLedgerEventBody(key: Buffer, body: unknown, signature: string): boolean {
  if (!/^[a-f0-9]{64}$/.test(signature)) return false
  const expected = Buffer.from(signRunnerLedgerEventBody(key, body), 'hex')
  const supplied = Buffer.from(signature, 'hex')
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}
