import { readFile, stat } from 'node:fs/promises'
import { isIP } from 'node:net'
import {
  ProductionBriefClaimRequestV1Schema,
  ProductionBriefClaimResponseV1Schema,
  ProductionBriefCompleteRequestV1Schema,
  ProductionBriefCompleteResponseV1Schema,
  RunnerClaimRequestV1Schema,
  RunnerCompleteRequestV1Schema,
  RunnerHeartbeatRequestV1Schema,
  RunnerClaimResponseV1Schema,
  RunnerCompleteResponseV1Schema,
  RunnerHeartbeatResponseV1Schema,
  RunnerHeartbeatV1Schema,
  RunnerPreviewUploadRequestV1Schema,
  RunnerPreviewUploadResponseV1Schema,
  RunnerPreviewRetentionRequestV1Schema,
  RunnerPreviewRetentionResponseV1Schema,
  RunnerProjectProjectionV1Schema,
  RunnerProjectRequestV1Schema,
  RunnerProjectResponseV1Schema,
  RunnerReceiptV1Schema,
  runnerProjectProjectionHashInputV1,
  type RunnerCommandEnvelopeV1,
  type RunnerHeartbeatV1,
  type RunnerReceiptV1,
  type RunnerPreviewUploadRequestV1,
  type RunnerPreviewUploadResponseV1,
  type RunnerProjectProjectionV1,
  type ClaimedProductionBriefV1,
  type ProductionBriefCompleteRequestV1,
  SERIES_IDS,
} from '@mindmake/contracts'
import { hashFile, hashFileMd5, hashValue } from './hash.js'

export const CONTROL_CENTER_RUNNER_CREDENTIAL = 'MindmakeVideoStudio/control-center-runner-token-v2'

type FetchLike = typeof fetch

export interface ControlPlaneClientOptions {
  baseUrl: string
  token: string
  previewStorageOrigin?: string
  fetchImpl?: FetchLike
}

export interface ClaimedRunnerCommand {
  command: RunnerCommandEnvelopeV1
  lease: { token: string; expires_at: string }
}

export class ControlPlaneRequestError extends Error {
  constructor(
    public readonly path: string,
    public readonly status: number,
    public readonly safeCode: string | null,
  ) {
    super(`control-plane ${path} returned HTTP ${status}${safeCode ? ` (${safeCode})` : ''}`)
    this.name = 'ControlPlaneRequestError'
  }
}

function normalizedBaseUrl(value: string): string {
  const url = new URL(value)
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(local && url.protocol === 'http:')) throw new Error('control-plane URL must use HTTPS')
  if (url.username || url.password || url.search || url.hash) throw new Error('control-plane URL cannot contain credentials, query parameters, or a fragment')
  const path = url.pathname.replace(/\/$/, '')
  if (path !== '/api/video-studio/runner') throw new Error('control-plane URL must target the exact Video Studio runner API')
  url.pathname = path
  return url.toString().replace(/\/$/, '')
}

function normalizedStorageOrigin(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'https:') throw new Error('preview Storage origin must use HTTPS')
  if (url.username || url.password || url.search || url.hash || (url.pathname !== '' && url.pathname !== '/')) throw new Error('preview Storage origin must be an origin without credentials, path, query parameters, or a fragment')
  const hostname = url.hostname.toLowerCase()
  const unbracketed = hostname.replace(/^\[|\]$/g, '')
  const addressFamily = isIP(unbracketed)
  const octets = addressFamily === 4 ? unbracketed.split('.').map(Number) : []
  const first = octets[0] ?? -1
  const second = octets[1] ?? -1
  const unsafeIpv4 = addressFamily === 4 && (
    first === 0 || first === 10 || first === 127 || first >= 224
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && (second === 0 || second === 168))
    || (first === 198 && (second === 18 || second === 19))
  )
  const unsafeIpv6 = addressFamily === 6 && (/^(?:::|::1$|f[cd]|fe[89ab])/i.test(unbracketed))
  const unsafe = hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || unsafeIpv4
    || unsafeIpv6
  if (unsafe) throw new Error('preview Storage origin cannot target a local or private destination')
  return url.origin
}

export class ControlPlaneClient {
  private readonly baseUrl: string
  private readonly token: string
  private readonly previewStorageOrigin: string | undefined
  private readonly fetchImpl: FetchLike

  constructor(options: ControlPlaneClientOptions) {
    this.baseUrl = normalizedBaseUrl(options.baseUrl)
    this.token = options.token.trim()
    if (Buffer.byteLength(this.token, 'utf8') < 32) throw new Error('control-plane runner credential is missing or too short')
    this.previewStorageOrigin = options.previewStorageOrigin ? normalizedStorageOrigin(options.previewStorageOrigin) : undefined
    this.fetchImpl = options.fetchImpl ?? fetch
  }

  private async post(path: 'claim' | 'heartbeat' | 'complete' | 'preview-upload' | 'preview-retention' | 'project' | 'production-brief-claim' | 'production-brief-complete', body: unknown): Promise<unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}/${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        accept: 'application/json',
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
      redirect: 'error',
    })
    if (!response.ok) {
      let safeCode: string | null = null
      try {
        const value = await response.json() as { error?: { code?: unknown } }
        if (typeof value.error?.code === 'string' && /^[a-z][a-z0-9_]{0,79}$/.test(value.error.code)) safeCode = value.error.code
      } catch { /* HTTP status remains authoritative when the error body is unavailable. */ }
      throw new ControlPlaneRequestError(path, response.status, safeCode)
    }
    try { return await response.json() }
    catch { throw new Error(`control-plane ${path} returned invalid JSON`) }
  }

  async claim(input: { runner_id: string; software_commit: string; lease_seconds?: number }): Promise<ClaimedRunnerCommand | null> {
    const request = RunnerClaimRequestV1Schema.parse({
      schema_version: 1,
      runner_id: input.runner_id,
      software_commit: input.software_commit,
      command_schema_versions: [1],
      ...(input.lease_seconds === undefined ? {} : { lease_seconds: input.lease_seconds }),
    })
    const response = RunnerClaimResponseV1Schema.parse(await this.post('claim', request))
    return response.command && response.lease ? { command: response.command, lease: response.lease } : null
  }

  async claimProductionBrief(input: { runner_id: string; software_commit: string; lease_seconds?: number }): Promise<ClaimedProductionBriefV1 | null> {
    const request = ProductionBriefClaimRequestV1Schema.parse({
      schema_version: 1,
      runner_id: input.runner_id,
      software_commit: input.software_commit,
      command_schema_versions: [1],
      ...(input.lease_seconds === undefined ? {} : { lease_seconds: input.lease_seconds }),
      // Declares every series this runner can parse, so the control plane
      // hands it briefs in the live subchannel names. A runner that says
      // nothing is only given the retired pair.
      series_supported: [...SERIES_IDS],
    })
    const response = ProductionBriefClaimResponseV1Schema.parse(await this.post('production-brief-claim', request))
    if (!response.item) return null
    if (hashValue(response.item.brief) !== response.item.brief_hash) throw new Error('claimed production brief hash does not match its payload')
    if (Date.parse(response.item.lease.expires_at) <= Date.now()) throw new Error('claimed production brief lease is already expired')
    return response.item
  }

  async completeProductionBrief(input: ProductionBriefCompleteRequestV1): Promise<{ duplicate: boolean; brief_id: string; status: ProductionBriefCompleteRequestV1['status']; job_id: string | null }> {
    const request = ProductionBriefCompleteRequestV1Schema.parse(input)
    const response = ProductionBriefCompleteResponseV1Schema.parse(await this.post('production-brief-complete', request))
    if (response.brief_id !== request.brief_id || response.status !== request.status || response.job_id !== request.job_id) {
      throw new Error('control-plane production brief acknowledgement does not match the submitted result')
    }
    return response
  }

  async heartbeat(heartbeatInput: RunnerHeartbeatV1, leaseToken?: string): Promise<{ lease_expires_at?: string }> {
    // Validated as the request it actually is, not as the runner state plus an
    // untyped spread. The old shape was assembled here and hand-parsed on the
    // server, so the rule that an active command must carry its lease lived on
    // one side only: this could build a body the server would refuse and find
    // out over HTTP.
    const request = RunnerHeartbeatRequestV1Schema.parse({
      ...heartbeatInput,
      ...(leaseToken ? { lease_token: leaseToken } : {}),
    })
    const response = RunnerHeartbeatResponseV1Schema.parse(await this.post('heartbeat', request))
    return response.lease_expires_at ? { lease_expires_at: response.lease_expires_at } : {}
  }

  async complete(input: { runner_id: string; lease_token: string; receipt: RunnerReceiptV1 }): Promise<{ duplicate: boolean; command_id: string; receipt_hash: string; command_status: 'succeeded' | 'failed' | 'attention' }> {
    // Same reason as heartbeat: the envelope around a signed receipt is worth a
    // name, so both ends agree on it rather than rebuilding it independently.
    const request = RunnerCompleteRequestV1Schema.parse({
      schema_version: 1,
      runner_id: input.runner_id,
      lease_token: input.lease_token,
      receipt: input.receipt,
    })
    const receipt = request.receipt
    const response = RunnerCompleteResponseV1Schema.parse(await this.post('complete', request))
    const expectedStatus = receipt.status === 'requires_editorial_route' ? 'attention' : receipt.status
    if (response.command_id !== receipt.command_id || response.receipt_hash !== receipt.receipt_hash || response.command_status !== expectedStatus) {
      throw new Error('control-plane completion acknowledgement does not match the submitted receipt')
    }
    return { duplicate: response.duplicate, command_id: response.command_id, receipt_hash: response.receipt_hash, command_status: response.command_status }
  }

  async requestPreviewUpload(input: RunnerPreviewUploadRequestV1): Promise<RunnerPreviewUploadResponseV1> {
    const request = RunnerPreviewUploadRequestV1Schema.parse(input)
    const response = RunnerPreviewUploadResponseV1Schema.parse(await this.post('preview-upload', request))
    const expectedKey = `commands/${request.command_id}/previews/${request.side}/${request.sha256}.mp4`
    if (response.slot.command_id !== request.command_id
      || response.slot.side !== request.side
      || response.slot.sha256 !== request.sha256
      || response.slot.md5 !== request.md5
      || response.slot.byte_size !== request.byte_size
      || response.slot.content_type !== request.content_type
      || response.slot.object_key !== expectedKey) throw new Error('control-plane preview slot does not match its command-bound request')
    if (response.existing_verified && response.slot.upload.url !== null) throw new Error('verified existing preview slot cannot issue another upload URL')
    if (!response.existing_verified && !response.slot.upload.url) throw new Error('unverified preview slot did not issue an upload URL')
    return response
  }

  async previewRetention(input: { runner_id: string; limit?: number }): Promise<{ reviewed: number; deleted_objects: number; cutoff: string }> {
    const request = RunnerPreviewRetentionRequestV1Schema.parse({ schema_version: 1, runner_id: input.runner_id, limit: input.limit ?? 100 })
    const response = RunnerPreviewRetentionResponseV1Schema.parse(await this.post('preview-retention', request))
    return { reviewed: response.reviewed, deleted_objects: response.deleted_objects, cutoff: response.cutoff }
  }

  async uploadPreviewFile(input: RunnerPreviewUploadRequestV1, path: string): Promise<{ object_key: string }> {
    const request = RunnerPreviewUploadRequestV1Schema.parse(input)
    const info = await stat(path)
    if (!info.isFile() || info.size !== request.byte_size
      || await hashFile(path) !== request.sha256
      || await hashFileMd5(path) !== request.md5) throw new Error('local preview does not match its declared upload identity')
    let slot = await this.requestPreviewUpload(request)
    if (!slot.existing_verified) {
      if (!this.previewStorageOrigin) throw new Error('preview Storage origin is not configured')
      const uploadUrl = new URL(slot.slot.upload.url!)
      if (uploadUrl.protocol !== 'https:') throw new Error('preview upload URL must use HTTPS')
      if (uploadUrl.username || uploadUrl.password || uploadUrl.hash) throw new Error('preview upload URL cannot contain credentials or a fragment')
      if (uploadUrl.origin !== this.previewStorageOrigin) throw new Error('preview upload URL does not match the configured Storage origin')
      if (!uploadUrl.pathname.startsWith('/storage/v1/object/upload/sign/')) throw new Error('preview upload URL does not target the signed Supabase Storage upload route')
      const body = await readFile(path)
      const response = await this.fetchImpl(uploadUrl, {
        method: 'PUT',
        headers: slot.slot.upload.headers,
        body: Uint8Array.from(body).buffer,
        signal: AbortSignal.timeout(120_000),
        redirect: 'error',
      })
      if (!response.ok && response.status !== 409) throw new Error(`preview upload returned HTTP ${response.status}`)
      slot = await this.requestPreviewUpload(request)
    }
    if (!slot.existing_verified) throw new Error('uploaded preview could not be verified by the control plane')
    return { object_key: slot.slot.object_key }
  }

  async project(input: { runner_id: string; software_commit: string; idempotency_key: string; projection: RunnerProjectProjectionV1 }): Promise<{ duplicate: boolean; projection_hash: string; job_id: string; platform: RunnerProjectProjectionV1['platform_state']['platform'] }> {
    const projection = RunnerProjectProjectionV1Schema.parse(input.projection)
    const projectionHash = hashValue(runnerProjectProjectionHashInputV1(projection))
    const request = RunnerProjectRequestV1Schema.parse({
      schema_version: 1,
      runner_id: input.runner_id,
      software_commit: input.software_commit,
      idempotency_key: input.idempotency_key,
      projection_hash: projectionHash,
      projection,
    })
    const response = RunnerProjectResponseV1Schema.parse(await this.post('project', request))
    if (response.projection_hash !== projectionHash
      || response.job_id !== projection.job.job_id
      || response.platform !== projection.platform_state.platform) throw new Error('control-plane project response does not match its projection request')
    return {
      duplicate: response.duplicate,
      projection_hash: response.projection_hash,
      job_id: response.job_id,
      platform: response.platform,
    }
  }
}
