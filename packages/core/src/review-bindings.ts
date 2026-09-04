import { randomUUID } from 'node:crypto'
import { mkdir, open, readFile, rename } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  RunnerLocalReviewBindingV1Schema,
  type RunnerLocalReviewBindingV1,
  type RunnerReviewTargetV1,
  type VideoPlatformV1,
} from '@mindmake/contracts'
import { loadApprovalSigningKey, signRunnerLedgerEventBody, verifyRunnerLedgerEventBody } from './approval-signing.js'
import { hashValue } from './hash.js'
import { withJobEventLock } from './job-store-v2.js'
import { jobPath } from './paths.js'

type LocalReviewBindingBody = Omit<RunnerLocalReviewBindingV1, 'binding_hash' | 'binding_signature'>

function reviewBindingPath(jobId: string, reviewId: string): string {
  return join(jobPath(jobId), 'control-plane', 'reviews', `${reviewId}.json`)
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  const handle = await open(temporary, 'wx', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await handle.sync()
  } finally { await handle.close() }
  await rename(temporary, path)
}

export function deterministicRunnerReviewId(value: unknown): string {
  const hash = hashValue({ domain: 'MindmakeVideoStudio/RunnerReviewId/v1', value })
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

export async function createLocalReviewSemanticMap(input: {
  job_id: string
  platform: VideoPlatformV1
  gate: 'story' | 'learning'
  parent_revision_hash: string
  parent_artifact_hash: string
  target: RunnerReviewTargetV1
}): Promise<string> {
  const body = { schema_version: 1 as const, kind: 'local_review_semantic_map' as const, ...input }
  const semanticHash = hashValue(body)
  const path = join(jobPath(input.job_id), 'control-plane', 'review-target-maps', `${semanticHash}.json`)
  await withJobEventLock(input.job_id, async () => {
    try {
      const existing = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
      if (hashValue(existing) !== semanticHash) throw new Error('local review semantic map failed content-address verification')
      return
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    await writeJsonAtomic(path, body)
  })
  return semanticHash
}

function verifyBinding(bindingInput: unknown, signingKey: Buffer): RunnerLocalReviewBindingV1 {
  const binding = RunnerLocalReviewBindingV1Schema.parse(bindingInput)
  const { binding_hash: bindingHash, binding_signature: bindingSignature, ...body } = binding
  if (hashValue(body) !== bindingHash || !verifyRunnerLedgerEventBody(signingKey, body, bindingSignature)) throw new Error('local review binding failed authentication')
  return binding
}

export async function persistLocalReviewBinding(input: LocalReviewBindingBody): Promise<RunnerLocalReviewBindingV1> {
  return withJobEventLock(input.job_id, async () => {
    const signingKey = await loadApprovalSigningKey()
    if (!signingKey) throw new Error('local review binding signing credential is unavailable or too short')
    const body = input
    const binding = RunnerLocalReviewBindingV1Schema.parse({
      ...body,
      binding_hash: hashValue(body),
      binding_signature: signRunnerLedgerEventBody(signingKey, body),
    })
    const path = reviewBindingPath(binding.job_id, binding.review_id)
    try {
      const existing = verifyBinding(JSON.parse(await readFile(path, 'utf8')), signingKey)
      if (existing.binding_hash !== binding.binding_hash) {
        const { binding_hash: _existingHash, binding_signature: _existingSignature, ...existingBody } = existing
        const existingRecovery = existingBody.recovery_provenance
        const incomingRecovery = body.recovery_provenance
        if (!existingRecovery || !incomingRecovery) throw new Error('local review ID was reused for different content')

        // The bridge command ID is a transport-attempt identity. A runner may
        // crash after atomically persisting this signed binding and receive the
        // same recovery command under a new attempt UUID. Compare the complete
        // signed body after removing only that UUID; bridge_command_hash remains
        // the immutable semantic identity and protects every recovery binding.
        const { bridge_command_id: _existingAttempt, ...existingSemanticRecovery } = existingRecovery
        const { bridge_command_id: _incomingAttempt, ...incomingSemanticRecovery } = incomingRecovery
        const existingSemanticBody = { ...existingBody, recovery_provenance: existingSemanticRecovery }
        const incomingSemanticBody = { ...body, recovery_provenance: incomingSemanticRecovery }
        if (hashValue(existingSemanticBody) !== hashValue(incomingSemanticBody)) throw new Error('local review ID was reused for different semantic content')
      }
      return existing
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
    await writeJsonAtomic(path, binding)
    return binding
  })
}

export async function loadLocalReviewBinding(jobId: string, reviewId: string): Promise<RunnerLocalReviewBindingV1> {
  return withJobEventLock(jobId, async () => {
    const signingKey = await loadApprovalSigningKey()
    if (!signingKey) throw new Error('local review binding signing credential is unavailable or too short')
    const binding = verifyBinding(JSON.parse(await readFile(reviewBindingPath(jobId, reviewId), 'utf8')), signingKey)
    if (binding.job_id !== jobId || binding.review_id !== reviewId) throw new Error('local review binding identity does not match its content-addressed location')
    return binding
  })
}
