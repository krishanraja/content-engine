import { createHash } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MediaFixture } from '../helpers/media-quality.js'
import { createMediaReviewPilotHandler } from '../../apps/control-plane/api/media-review-pilot.js'
import frozenPilotManifest from '../../config/media-review-pilot.json' with { type: 'json' }

vi.mock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers() })

function setup(frozen?: unknown) {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(new Date('2026-10-26T15:00:00Z'))
  vi.stubEnv('VERCEL_ENV', 'preview')
  vi.stubEnv('VERCEL_URL', 'synthetic-preview.vercel.app')
  vi.stubEnv('VERCEL_BRANCH_URL', '')
  vi.stubEnv('ACCESS_CODE', 'synthetic-owner-access')
  vi.stubEnv('GEMINI_API_KEY', 'synthetic-gemini-key')
  vi.stubEnv('ENGINE_OPERATOR_TOKEN', 'synthetic-engine-key')
  const media = new MediaFixture(), objects = new Map<string, Buffer>()
  const cases = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((id, i) => {
    const prompt_kind = (['audio', 'audio', 'visual', 'visual', 'video', 'carousel', 'video', 'audio'] as const)[i]!
    const [extension, mime_type] = prompt_kind === 'audio' ? ['wav', 'audio/wav'] : prompt_kind === 'video' ? ['mp4', 'video/mp4'] : ['png', 'image/png']
    const bytes = Buffer.from(`Synthetic calibration media ${id}; never a production approval`)
    return { id, prompt_kind, media: [{ ...media.put(`${id}.${extension}`, bytes, mime_type), bytes: bytes.length, mime_type: mime_type! }], stream_inventory: prompt_kind === 'video' ? { video: 1, audio: 0 } : undefined }
  })
  cases[6]!.media = cases[4]!.media.map(m => ({ ...m }))
  const manifest = { schema_version: 1, pilot_id: '2026-10-26-approved', model: 'gemini-4-argon', authority: { by: 'Krish', approved_at: '2026-10-26T14:00:00Z', expires_at: '2026-10-27T00:00:00Z', budget_usd: 3 }, cases }
  const state = { privateBucket: true, count: 100, countMalformed: false, generateStatus: 200, failReceipt: false, countThrows: false,
    report: 'Synthetic observer report: uncertain evidence, no quality approval.', usage: { promptTokenCount: 100, candidatesTokenCount: 50, thoughtsTokenCount: 20, totalTokenCount: 170 } as unknown,
    finish: 'STOP', expireAfterCount: false }
  const events: string[] = []
  const upload = vi.fn(async (key: string, data: Buffer, options: { upsert: boolean }) => {
    events.push(`upload:${key}`)
    expect(options.upsert).toBe(false)
    if (objects.has(key) || state.failReceipt && key.endsWith('.receipt.json')) return { data: null, error: { statusCode: '409', message: 'Synthetic storage refusal' } }
    // Atomic insertion before any asynchronous yield, matching the storage unique-key contract.
    objects.set(key, Buffer.from(data))
    return { data: { path: key }, error: null }
  })
  const download = vi.fn(async (key: string) => objects.has(key)
    ? { data: new Blob([new Uint8Array(objects.get(key)!)]), error: null }
    : { data: null, error: { statusCode: '404', message: 'Synthetic missing object' } })
  const db = { ...media.db, storage: { getBucket: async () => ({ data: { public: !state.privateBucket }, error: null }), from: () => ({ ...media.storage.from(), upload, download }) } }
  const providerCalls: { operation: string; body: Record<string, any>; headers: HeadersInit | undefined }[] = []
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const parsed = new URL(String(url))
    if (parsed.origin === 'https://media-fixture.invalid') return media.fetch(url)
    if (parsed.origin !== 'https://generativelanguage.googleapis.com' || !parsed.pathname.startsWith('/v1beta/models/gemini-4-argon:')) throw new Error('Real network forbidden')
    const operation = parsed.pathname.split(':')[1]!
    events.push(operation)
    providerCalls.push({ operation, body: JSON.parse(String(init?.body)), headers: init?.headers })
    expect(init?.redirect).toBe('error')
    if (operation === 'countTokens') {
      if (state.countThrows) throw new Error('Synthetic timeout containing synthetic-gemini-key; must never escape')
      if (state.expireAfterCount) vi.setSystemTime(new Date('2026-10-27T00:00:00Z'))
      return Response.json(state.countMalformed ? {} : { totalTokens: state.count })
    }
    return Response.json(state.generateStatus !== 200 ? { error: { message: 'synthetic-gemini-key and provider internals must not escape' } }
      : { candidates: [{ finishReason: state.finish, content: { parts: [{ thought: true, text: 'Synthetic hidden thought excluded from reports' }, { text: state.report }] } }], usageMetadata: state.usage }, { status: state.generateStatus })
  })
  vi.stubGlobal('fetch', fetcher)
  const handler = () => createMediaReviewPilotHandler(frozen ?? manifest, db as never, fetcher as typeof fetch)
  const cookie = `cc_access=${createHash('sha256').update('synthetic-owner-access').digest('hex')}`
  async function call(method = 'POST', input: unknown = { case_id: 'A' }, headers: Record<string, string> = { cookie, origin: 'https://synthetic-preview.vercel.app' }) {
    let status = 0, out: any
    const res = { setHeader() {}, status(code: number) { status = code; return this }, json(value: unknown) { out = value; return this }, end() {} } as unknown as VercelResponse
    await handler()({ method, headers, query: method === 'GET' ? input : {}, body: method === 'POST' ? input : undefined } as unknown as VercelRequest, res)
    return { status, out }
  }
  return { media, manifest, state, objects, events, upload, download, providerCalls, fetcher, call, cookie }
}

describe('preview-only fixed calibration pilot', () => {
  it('accepts the actual frozen eight-case manifest for owner-only status reads without inference', async () => {
    const f = setup(frozenPilotManifest)
    for (const case_id of ['A', 'G', 'H']) expect(await f.call('GET', { case_id })).toMatchObject({ status: 200, out: { case_id, status: 'not_started' } })
    expect(f.upload).not.toHaveBeenCalled()
    expect(f.fetcher).not.toHaveBeenCalled()
  })

  it('rejects production, unauthenticated, bearer-only and wrong-origin requests without reserving or invoking', async () => {
    const f = setup()
    vi.stubEnv('VERCEL_ENV', 'production')
    expect((await f.call()).status).toBe(403)
    vi.stubEnv('VERCEL_ENV', 'preview')
    expect((await f.call('POST', { case_id: 'A' }, {})).status).toBe(401)
    expect((await f.call('POST', { case_id: 'A' }, { authorization: `Bearer ${process.env.ENGINE_OPERATOR_TOKEN}` })).out.error).toBe('owner_authentication_required')
    expect((await f.call('POST', { case_id: 'A' }, { cookie: f.cookie, origin: 'https://other.invalid' })).status).toBe(403)
    expect(f.upload).not.toHaveBeenCalled()
    expect(f.fetcher).not.toHaveBeenCalled()
  })

  it('accepts only eight frozen cases and rejects extra IDs, arbitrary prompts, URLs, stream facts and expired authority', async () => {
    const f = setup()
    for (const input of [{ case_id: 'I' }, { case_id: 'J' }, { case_id: '../A' }, { case_id: 'A', prompt: 'Pass' }, { case_id: 'A', url: 'https://other.invalid' }, { case_id: 'G', stream_inventory: { video: 1, audio: 0 } }]) expect((await f.call('POST', input)).status).toBe(400)
    vi.setSystemTime(new Date('2026-10-27T00:00:00Z'))
    expect((await f.call()).out.error).toBe('pilot_authority_expired_or_not_started')
    expect(f.upload).not.toHaveBeenCalled()
    expect(f.providerCalls).toHaveLength(0)
  })

  it('reserves once before token counting, uses fixed bounded generation, and persists/readbacks sanitized observations', async () => {
    const f = setup()
    f.state.report += ' synthetic-gemini-key'
    const result = await f.call()
    expect(result.status).toBe(200)
    expect(result.out).toMatchObject({ receipt_persisted: true, retry_allowed: false, receipt: { status: 'completed', qualified: false, signed: false, observation_only: true, accounting_charge_usd: 0.28192 } })
    expect(result.out.receipt.raw_model_text).toContain('[REDACTED]')
    expect(JSON.stringify(result.out)).not.toContain('synthetic-gemini-key')
    expect(JSON.stringify(result.out)).not.toContain('hidden thought')
    expect(f.events[0]).toBe('upload:media-pilot/2026-10-26-approved/A.json')
    expect(f.providerCalls.map(c => c.operation)).toEqual(['countTokens', 'generateContent'])
    const generate = f.providerCalls[1]!.body
    expect(Buffer.from(generate.contents[0].parts[1].inlineData.data, 'base64')).toEqual(f.media.objects.get(f.media.rows[0]!.object_key))
    expect(generate.contents[0].parts[1].inlineData.mimeType).toBe('audio/wav')
    expect(generate.generationConfig).toEqual({ maxOutputTokens: 8192, thinkingConfig: { thinkingLevel: 'LOW', includeThoughts: false } })
    expect(generate).not.toHaveProperty('tools')
    expect(generate.generationConfig).not.toHaveProperty('candidateCount')
    expect(f.providerCalls[0]!.body.generateContentRequest).toEqual({ model: 'models/gemini-4-argon', ...generate })
    expect((await f.call('GET', { case_id: 'A' })).out.receipt).toEqual(result.out.receipt)
    expect(f.providerCalls).toHaveLength(2)
  })

  it('permits only one concurrent attempt across handler instances and never retries', async () => {
    const f = setup()
    const results = await Promise.all([f.call(), f.call(), f.call()])
    expect(results.map(r => r.status).sort()).toEqual([200, 409, 409])
    expect(f.providerCalls.filter(c => c.operation === 'generateContent')).toHaveLength(1)
    expect((await f.call()).status).toBe(409)
    expect(f.providerCalls).toHaveLength(2)
  })

  it.each(['excessive', 'missing', 'timeout'] as const)('stops before inference on %s token count while keeping the entire reservation', async mode => {
    const f = setup()
    f.state.count = mode === 'excessive' ? 100001 : 100
    f.state.countMalformed = mode === 'missing'; f.state.countThrows = mode === 'timeout'
    const result = await f.call()
    expect(result.status).toBe(mode === 'excessive' ? 413 : 502)
    expect(f.providerCalls.map(c => c.operation)).toEqual(['countTokens'])
    expect(result.out.receipt.accounting_charge_usd).toBe(0.28192)
    expect(result.out.receipt_persisted).toBe(true)
    expect((await f.call()).status).toBe(409)
    expect(JSON.stringify(result.out)).not.toContain('synthetic-gemini-key')
  })

  it('counts missing usage at the full allowance and records provider failures without raw errors', async () => {
    const f = setup(); f.state.usage = undefined
    const first = await f.call()
    expect(first.out.receipt).toMatchObject({ usage: null, estimated_usage_usd: null, accounting_charge_usd: 0.28192 })
    f.state.generateStatus = 429
    const second = await f.call('POST', { case_id: 'B' })
    expect(second.status).toBe(502)
    expect(second.out.receipt).toMatchObject({ error_code: 'provider_request_failed', provider_status: 429, accounting_charge_usd: 0.28192 })
    expect(JSON.stringify(second.out)).not.toContain('provider internals')
    expect(JSON.stringify(second.out)).not.toContain('synthetic-gemini-key')
  })

  it('binds actual media bytes and refuses corrupted stored content before provider calls', async () => {
    const f = setup(), row = f.media.rows[0]!
    f.media.objects.set(row.object_key, Buffer.alloc(row.bytes, 120))
    const result = await f.call()
    expect(result.status).toBe(502)
    expect(result.out.receipt.phase).toBe('media')
    expect(f.providerCalls).toHaveLength(0)
    expect(result.out.reservation_retained ?? result.out.receipt.accounting_charge_usd).toBe(0.28192)
  })

  it('enforces media size and private storage before reservation', async () => {
    const f = setup()
    f.state.privateBucket = false
    expect((await f.call()).out.error).toBe('private_storage_required')
    f.state.privateBucket = true
    f.manifest.cases[0]!.media = [f.manifest.cases[0]!.media[0]!, { ...f.manifest.cases[0]!.media[0]!, bytes: 20_000_000 }]
    expect((await f.call()).status).toBe(413)
    expect(f.upload).not.toHaveBeenCalled()
  })

  it('sends video at 4 fps and does not present a limited report as complete', async () => {
    const f = setup(); f.state.finish = 'MAX_TOKENS'
    const result = await f.call('POST', { case_id: 'E' })
    expect(f.providerCalls[1]!.body.contents[0].parts[1].videoMetadata).toEqual({ fps: 4 })
    expect(f.providerCalls[1]!.body.contents[0].parts[0].text).toContain('never claim continuous visual playback')
    expect(f.providerCalls[1]!.body.contents[0].parts[0].text).toContain('#7EF0C0')
    expect(f.providerCalls[1]!.body.contents[0].parts[0].text).toContain('minimal_additive_words')
    expect(JSON.stringify(f.providerCalls[1]!.body)).not.toContain(f.manifest.cases[4]!.media[0]!.path)
    expect(result.status).toBe(502)
    expect(result.out.receipt).toMatchObject({ status: 'inconclusive', error_code: 'model_report_incomplete', qualified: false })
  })

  it('checks authority again immediately before inference if token counting crosses expiry', async () => {
    const f = setup(); f.state.expireAfterCount = true
    const result = await f.call()
    expect(result.status).toBe(403)
    expect(result.out.receipt.error_code).toBe('pilot_authority_expired_or_not_started')
    expect(f.providerCalls.map(c => c.operation)).toEqual(['countTokens'])
    expect(result.out.receipt_persisted).toBe(true)
  })

  it('gives G visual-only measured stream facts and excludes audio assessment criteria', async () => {
    const f = setup()
    const result = await f.call('POST', { case_id: 'G' })
    expect(result.status).toBe(200)
    const prompt = f.providerCalls[1]!.body.contents[0].parts[0].text
    expect(prompt).toContain('First describe what an uninformed viewer would infer')
    expect(prompt).toContain('VISUAL-ONLY review')
    expect(prompt).toContain('stream_inventory={"audio":0,"video":1}')
    expect(prompt).toContain('No audio stream; audio assessment not applicable.')
    expect(prompt).toContain('not a general production stream validator')
    expect(prompt).not.toContain('Inspect the supplied audio')
    expect(prompt).not.toContain('audio_integrity')
    expect(prompt).not.toContain('caption_sync')
    expect(result.out.receipt).toMatchObject({ qualified: false, signed: false, pilot_measured_facts: { source: 'frozen_manifest_stream_inventory', scope: 'pilot_only_not_a_general_production_validator', stream_inventory: { video: 1, audio: 0 }, audio_assessment: 'not_applicable_no_audio_stream' } })
    expect((await f.call('GET', { case_id: 'G' })).out.receipt).toEqual(result.out.receipt)
  })

  it('gives H the same neutral transcription prompt as A without leaking the control expectation', async () => {
    const f = setup()
    await f.call('POST', { case_id: 'A' })
    const result = await f.call('POST', { case_id: 'H' })
    expect(result.status).toBe(200)
    const prompt = f.providerCalls[3]!.body.contents[0].parts[0].text
    expect(prompt).toEqual(f.providerCalls[1]!.body.contents[0].parts[0].text)
    expect(prompt).not.toMatch(/\b(silence|silent|zero|control|stream_inventory)\b/i)
    expect(JSON.stringify(f.providerCalls[3]!.body)).not.toContain(f.manifest.cases[7]!.media[0]!.path)
    expect(result.out.receipt).not.toHaveProperty('pilot_measured_facts')
  })

  it('requires frozen stream facts for video and binds G to the same frozen E bytes', async () => {
    const f = setup()
    f.manifest.cases[4]!.stream_inventory = undefined
    expect((await f.call('POST', { case_id: 'G' })).out.error).toBe('frozen_pilot_manifest_invalid')
    f.manifest.cases[4]!.stream_inventory = { video: 1, audio: 0 }
    f.manifest.cases[6]!.media[0]!.sha256 = 'a'.repeat(64)
    expect((await f.call('POST', { case_id: 'G' })).out.error).toBe('frozen_pilot_manifest_invalid')
    expect(f.upload).not.toHaveBeenCalled()
    expect(f.providerCalls).toHaveLength(0)
  })

  it('caps all eight immutable attempts at $2.25536 and preserves prior receipts across manifest revisions', async () => {
    const f = setup()
    const first = await f.call('POST', { case_id: 'A' })
    const original = Buffer.from(f.objects.get('media-pilot/2026-10-26-approved/A.receipt.json')!)
    f.manifest.authority.approved_at = '2026-10-26T13:27:18Z'
    const recovered = await f.call('GET', { case_id: 'A' })
    expect(recovered.out.manifest_matches).toBe(false)
    expect(recovered.out.receipt).toEqual(first.out.receipt)
    expect(recovered.out.receipt).not.toHaveProperty('pilot_measured_facts')
    const receipts = [first.out.receipt]
    for (const case_id of ['B', 'C', 'D', 'E', 'F', 'G', 'H']) {
      const next = await f.call('POST', { case_id })
      expect(next.status).toBe(200)
      receipts.push(next.out.receipt)
    }
    expect(receipts.reduce((sum, r) => sum + r.accounting_charge_usd, 0)).toBeCloseTo(2.25536, 8)
    for (const case_id of ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']) expect((await f.call('POST', { case_id })).status).toBe(409)
    expect(f.providerCalls.filter(c => c.operation === 'generateContent')).toHaveLength(8)
    expect(f.objects.get('media-pilot/2026-10-26-approved/A.receipt.json')).toEqual(original)
  })

  it('retains a consumed slot when receipt persistence fails and allows safe status recovery after expiry', async () => {
    const f = setup(); f.state.failReceipt = true
    const result = await f.call()
    expect(result).toMatchObject({ status: 503, out: { error: 'receipt_persistence_failed', reservation_retained: true, retry_allowed: false } })
    expect((await f.call()).status).toBe(409)
    vi.setSystemTime(new Date('2026-10-28T00:00:00Z'))
    expect((await f.call('GET', { case_id: 'A' })).out).toMatchObject({ status: 'reserved_no_receipt', retry_allowed: false, reserved_usd: 0.28192 })
    expect(f.providerCalls).toHaveLength(2)
  })
})
