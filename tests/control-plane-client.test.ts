import { createHash } from 'node:crypto'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { ControlPlaneClient, hashValue } from '@mindmake/core'
import type { RunnerPreviewUploadRequestV1, RunnerProjectProjectionV1 } from '@mindmake/contracts'

const TOKEN = 'unit-test-runner-token-not-a-live-secret'
const COMMAND_ID = '11111111-1111-4111-8111-111111111111'

const hardGates = {
  truth: { status: 'passed' as const }, rights: { status: 'passed' as const }, confidentiality: { status: 'passed' as const }, transcript_fidelity: { status: 'passed' as const }, naming: { status: 'passed' as const },
}

function projection(): RunnerProjectProjectionV1 {
  const revision = 'a'.repeat(64)
  const artifact = 'b'.repeat(64)
  const map = 'c'.repeat(64)
  return {
    job: { job_id: 'job-client-test', series: 'built_with_ai', mode: 'solo', target_platforms: ['youtube_shorts'], stage: 'treatment', status: 'active', safe_title: 'Ready', safe_summary: 'A safe summary for mobile review.' },
    platform_state: { platform: 'youtube_shorts', active_revision_hash: revision, active_artifact_hash: artifact, active_candidate_hash: null, parent_revision_hash: null, parent_artifact_hash: null, parent_candidate_hash: null, semantic_target_map_hash: map, editorial_state: 'approved', route_state: 'standard' },
    review: {
      id: '22222222-2222-4222-8222-222222222222', gate: 'treatment', safe_title: 'Ready', safe_summary: 'A safe summary for mobile review.', parent_revision_hash: revision, parent_artifact_hash: artifact, revision_hash: revision, artifact_hash: artifact, candidate_hash: null, route_state: 'standard', created_at: '2026-09-04T10:00:00.000Z', hard_gates: hardGates,
      safe_payload: { direction: 'Review the current treatment.', change_title: 'Ready', change_summary: 'No editorial content changed.', range_label: 'Full treatment', changes: [], blocking_gates: hardGates, target: { kind: 'range', start_ms: 0, end_ms: 5000 }, semantic_target_map_hash: map },
    },
  }
}

describe('ControlPlaneClient', () => {
  let temporaryRoot = ''

  afterEach(async () => {
    if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true })
    temporaryRoot = ''
  })

  it('accepts only the exact credential-free runner endpoint and a 32-byte bearer', () => {
    expect(() => new ControlPlaneClient({ baseUrl: 'https://control.example/api/video-studio/runner?token=leak', token: TOKEN })).toThrow('cannot contain credentials')
    expect(() => new ControlPlaneClient({ baseUrl: 'https://user:pass@control.example/api/video-studio/runner', token: TOKEN })).toThrow('cannot contain credentials')
    expect(() => new ControlPlaneClient({ baseUrl: 'https://control.example/api/not-the-runner', token: TOKEN })).toThrow('exact Video Studio runner API')
    expect(() => new ControlPlaneClient({ baseUrl: 'https://control.example/api/video-studio/runner', token: 'under-thirty-two-bytes' })).toThrow('too short')
  })

  it('publishes the exact canonical redacted projection with bearer auth', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const value = projection()
    const projectionHash = hashValue(value)
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), ...(init ? { init } : {}) })
      return Response.json({ ok: true, schema_version: 1, duplicate: false, projection_hash: projectionHash, job_id: value.job.job_id, platform: value.platform_state.platform })
    }
    const client = new ControlPlaneClient({ baseUrl: 'https://control.example/api/video-studio/runner', token: TOKEN, fetchImpl: fetchImpl as typeof fetch })
    await expect(client.project({ runner_id: 'runner-client-test', software_commit: 'a'.repeat(40), idempotency_key: value.review.id, projection: value })).resolves.toMatchObject({ projection_hash: projectionHash, platform: 'youtube_shorts' })
    expect(calls).toHaveLength(1)
    expect(calls[0]!.url).toBe('https://control.example/api/video-studio/runner/project')
    expect(calls[0]!.init?.method).toBe('POST')
    expect((calls[0]!.init?.headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`)
    const body = JSON.parse(String(calls[0]!.init?.body))
    expect(body).toMatchObject({ schema_version: 1, projection_hash: projectionHash, projection: value })
    expect(JSON.stringify(body)).not.toMatch(/media_path|raw_transcript|transcript_(?:text|path)|drive_path|oauth|credential/i)
  })

  it('uploads preview bytes directly through a command-bound signed slot and verifies them', async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), 'mindmake-preview-client-'))
    const bytes = Buffer.from('small deterministic preview')
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const md5 = createHash('md5').update(bytes).digest('hex')
    const path = join(temporaryRoot, 'preview.mp4')
    await writeFile(path, bytes)
    const request: RunnerPreviewUploadRequestV1 = { schema_version: 1, runner_id: 'runner-client-test', command_id: COMMAND_ID, command_hash: 'd'.repeat(64), lease_token: 'lease-token-long-enough-for-test', side: 'before', sha256, md5, content_type: 'video/mp4', byte_size: bytes.length }
    const calls: Array<{ url: string; init?: RequestInit }> = []
    let slotCalls = 0
    const responseBody = (verified: boolean) => ({
      ok: true, schema_version: 1, duplicate: verified, existing_verified: verified,
      slot: {
        command_id: COMMAND_ID, side: 'before', sha256, md5, byte_size: bytes.length, content_type: 'video/mp4', object_key: `commands/${COMMAND_ID}/previews/before/${sha256}.mp4`, slot_expires_at: '2026-09-04T13:00:00.000Z',
        upload: { method: 'PUT', url: verified ? null : 'https://storage.example/storage/v1/object/upload/sign/previews/file.mp4?token=signed', headers: { 'Content-Type': 'video/mp4' }, expires_at: verified ? null : '2026-09-04T12:00:00.000Z' },
      },
    })
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(input), ...(init ? { init } : {}) })
      if (String(input).includes('/preview-upload')) return Response.json(responseBody(++slotCalls > 1))
      return new Response(null, { status: 200 })
    }
    const client = new ControlPlaneClient({ baseUrl: 'https://control.example/api/video-studio/runner', token: TOKEN, previewStorageOrigin: 'https://storage.example', fetchImpl: fetchImpl as typeof fetch })
    await expect(client.uploadPreviewFile(request, path)).resolves.toEqual({ object_key: `commands/${COMMAND_ID}/previews/before/${sha256}.mp4` })
    expect(calls.map((call) => call.url)).toEqual([
      'https://control.example/api/video-studio/runner/preview-upload',
      'https://storage.example/storage/v1/object/upload/sign/previews/file.mp4?token=signed',
      'https://control.example/api/video-studio/runner/preview-upload',
    ])
    expect(calls[1]!.init?.method).toBe('PUT')
    expect(calls[1]!.init?.headers).toEqual({ 'Content-Type': 'video/mp4' })
    expect(calls.every((call) => call.init?.redirect === 'error')).toBe(true)
    expect(JSON.stringify(calls[1]!.init?.headers)).not.toContain(TOKEN)
  })

  it('does not trust an existing-object upload conflict without server readback', async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), 'mindmake-preview-conflict-'))
    const bytes = Buffer.from('preview conflict')
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const md5 = createHash('md5').update(bytes).digest('hex')
    const path = join(temporaryRoot, 'preview.mp4')
    await writeFile(path, bytes)
    const request: RunnerPreviewUploadRequestV1 = { schema_version: 1, runner_id: 'runner-client-test', command_id: COMMAND_ID, command_hash: 'd'.repeat(64), lease_token: 'lease-token-long-enough-for-test', side: 'after', sha256, md5, content_type: 'video/mp4', byte_size: bytes.length }
    const slot = { command_id: COMMAND_ID, side: 'after', sha256, md5, byte_size: bytes.length, content_type: 'video/mp4', object_key: `commands/${COMMAND_ID}/previews/after/${sha256}.mp4`, slot_expires_at: '2026-09-04T13:00:00.000Z', upload: { method: 'PUT', url: 'https://storage.example/storage/v1/object/upload/sign/previews/file.mp4?token=signed', headers: { 'Content-Type': 'video/mp4' }, expires_at: '2026-09-04T12:00:00.000Z' } }
    let apiCalls = 0
    const fetchImpl = async (input: string | URL | Request) => {
      if (!String(input).includes('/preview-upload')) return new Response(null, { status: 409 })
      apiCalls += 1
      return Response.json({ ok: true, schema_version: 1, duplicate: apiCalls > 1, existing_verified: false, slot })
    }
    const client = new ControlPlaneClient({ baseUrl: 'https://control.example/api/video-studio/runner', token: TOKEN, previewStorageOrigin: 'https://storage.example', fetchImpl: fetchImpl as typeof fetch })
    await expect(client.uploadPreviewFile(request, path)).rejects.toThrow('could not be verified')
  })

  it('pins signed uploads to the configured public Supabase Storage origin and rejects redirects', async () => {
    temporaryRoot = await mkdtemp(join(tmpdir(), 'mindmake-preview-origin-'))
    const bytes = Buffer.from('origin-bound-preview')
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const md5 = createHash('md5').update(bytes).digest('hex')
    const path = join(temporaryRoot, 'preview.mp4')
    await writeFile(path, bytes)
    const request: RunnerPreviewUploadRequestV1 = { schema_version: 1, runner_id: 'runner-client-test', command_id: COMMAND_ID, command_hash: 'd'.repeat(64), lease_token: 'lease-token-long-enough-for-test', side: 'before', sha256, md5, content_type: 'video/mp4', byte_size: bytes.length }
    const fetchImpl = async () => Response.json({
      ok: true, schema_version: 1, duplicate: false, existing_verified: false,
      slot: { command_id: COMMAND_ID, side: 'before', sha256, md5, byte_size: bytes.length, content_type: 'video/mp4', object_key: `commands/${COMMAND_ID}/previews/before/${sha256}.mp4`, slot_expires_at: '2026-09-04T13:00:00.000Z', upload: { method: 'PUT', url: 'https://evil.example/storage/v1/object/upload/sign/previews/file.mp4?token=signed', headers: { 'Content-Type': 'video/mp4' }, expires_at: '2026-09-04T12:00:00.000Z' } },
    })
    const client = new ControlPlaneClient({ baseUrl: 'https://control.example/api/video-studio/runner', token: TOKEN, previewStorageOrigin: 'https://storage.example', fetchImpl: fetchImpl as typeof fetch })
    await expect(client.uploadPreviewFile(request, path)).rejects.toThrow('configured Storage origin')
    expect(() => new ControlPlaneClient({ baseUrl: 'https://control.example/api/video-studio/runner', token: TOKEN, previewStorageOrigin: 'http://127.0.0.1:54321' })).toThrow('must use HTTPS')
    expect(() => new ControlPlaneClient({ baseUrl: 'https://control.example/api/video-studio/runner', token: TOKEN, previewStorageOrigin: 'https://2130706433' })).toThrow('local or private')
    expect(() => new ControlPlaneClient({ baseUrl: 'https://control.example/api/video-studio/runner', token: TOKEN, previewStorageOrigin: 'https://[fd00::1]' })).toThrow('local or private')
  })

  it('accepts completion only when command, receipt hash, and mapped status are echoed exactly', async () => {
    const receipt = {
      schema_version: 1 as const, command_id: COMMAND_ID, command_hash: 'a'.repeat(64), job_id: 'job-client-test', status: 'succeeded' as const,
      result_revision_hash: 'b'.repeat(64), result_artifact_hash: 'c'.repeat(64), hard_gates: hardGates, retryable: false as const, safe_code: null,
      started_at: '2026-09-04T10:00:00.000Z', finished_at: '2026-09-04T10:00:01.000Z', receipt_hash: 'd'.repeat(64), receipt_signature: 'e'.repeat(64),
    }
    const valid = new ControlPlaneClient({ baseUrl: 'https://control.example/api/video-studio/runner', token: TOKEN, fetchImpl: (async () => Response.json({ ok: true, schema_version: 1, duplicate: false, command_id: COMMAND_ID, receipt_hash: receipt.receipt_hash, command_status: 'succeeded' })) as typeof fetch })
    await expect(valid.complete({ runner_id: 'runner-client-test', lease_token: 'lease-token-long-enough-for-test', receipt })).resolves.toMatchObject({ command_id: COMMAND_ID, receipt_hash: receipt.receipt_hash })
    const mismatch = new ControlPlaneClient({ baseUrl: 'https://control.example/api/video-studio/runner', token: TOKEN, fetchImpl: (async () => Response.json({ ok: true, schema_version: 1, duplicate: false, command_id: COMMAND_ID, receipt_hash: 'f'.repeat(64), command_status: 'succeeded' })) as typeof fetch })
    await expect(mismatch.complete({ runner_id: 'runner-client-test', lease_token: 'lease-token-long-enough-for-test', receipt })).rejects.toThrow('does not match')
  })

  it('requests only server-selected preview retention with a bounded limit', async () => {
    const calls: Array<{ url: string; body: unknown }> = []
    const client = new ControlPlaneClient({
      baseUrl: 'https://control.example/api/video-studio/runner', token: TOKEN,
      fetchImpl: (async (input, init) => {
        calls.push({ url: String(input), body: JSON.parse(String(init?.body)) })
        return Response.json({ ok: true, schema_version: 1, reviewed: 12, deleted_objects: 4, cutoff: '2026-07-29T10:00:00.000Z' })
      }) as typeof fetch,
    })
    await expect(client.previewRetention({ runner_id: 'runner-client-test', limit: 50 })).resolves.toEqual({ reviewed: 12, deleted_objects: 4, cutoff: '2026-07-29T10:00:00.000Z' })
    expect(calls).toEqual([{ url: 'https://control.example/api/video-studio/runner/preview-retention', body: { schema_version: 1, runner_id: 'runner-client-test', limit: 50 } }])
    await expect(client.previewRetention({ runner_id: 'runner-client-test', limit: 101 })).rejects.toThrow()
  })
})
