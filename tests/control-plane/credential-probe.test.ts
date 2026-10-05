import { createHmac } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, describe, expect, it } from 'vitest'
import handler from '../../apps/control-plane/api/video-studio/runner/credential-probe.js'

class MockResponse {
  statusCode = 200
  body: unknown
  headers = new Map<string, string | number | readonly string[]>()

  status(code: number) {
    this.statusCode = code
    return this
  }

  json(value: unknown) {
    this.body = value
    return this
  }

  setHeader(name: string, value: string | number | readonly string[]) {
    this.headers.set(name.toLowerCase(), value)
    return this
  }
}

function request(token: string, body: unknown): VercelRequest {
  return {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    query: {},
    cookies: {},
    body,
  } as unknown as VercelRequest
}

function response(): { raw: MockResponse; value: VercelResponse } {
  const raw = new MockResponse()
  return { raw, value: raw as unknown as VercelResponse }
}

const previousBearer = process.env.VIDEO_STUDIO_RUNNER_TOKEN
const previousSigning = process.env.VIDEO_STUDIO_RUNNER_SIGNING_KEY

afterEach(() => {
  if (previousBearer === undefined) delete process.env.VIDEO_STUDIO_RUNNER_TOKEN
  else process.env.VIDEO_STUDIO_RUNNER_TOKEN = previousBearer
  if (previousSigning === undefined) delete process.env.VIDEO_STUDIO_RUNNER_SIGNING_KEY
  else process.env.VIDEO_STUDIO_RUNNER_SIGNING_KEY = previousSigning
})

describe('runner credential probe', () => {
  const bearer = 'r'.repeat(48)
  const signing = 's'.repeat(48)
  const challengeHash = 'a'.repeat(64)

  it('proves both runner credentials without reading or writing control-plane state', () => {
    process.env.VIDEO_STUDIO_RUNNER_TOKEN = bearer
    process.env.VIDEO_STUDIO_RUNNER_SIGNING_KEY = signing
    const signature = createHmac('sha256', signing).update(challengeHash).digest('hex')
    const res = response()

    handler(request(bearer, {
      schema_version: 1,
      challenge_hash: challengeHash,
      challenge_signature: signature,
    }), res.value)

    expect(res.raw.statusCode).toBe(200)
    expect(res.raw.body).toEqual({ ok: true, schema_version: 1, bearer: 'accepted', signing: 'accepted' })
    expect(res.raw.headers.get('cache-control')).toBe('no-store')
  })

  it('has no control-plane storage dependency', async () => {
    const source = await readFile(new URL('../../apps/control-plane/api/video-studio/runner/credential-probe.ts', import.meta.url), 'utf8')
    expect(source).not.toContain('_supabase')
    expect(source).not.toContain('video_studio_')
    expect(source).not.toContain('enforceVideoStudioRateLimit')
  })

  it('rejects a wrong bearer before checking the signing challenge', () => {
    process.env.VIDEO_STUDIO_RUNNER_TOKEN = bearer
    process.env.VIDEO_STUDIO_RUNNER_SIGNING_KEY = signing
    const res = response()
    handler(request('w'.repeat(48), {
      schema_version: 1,
      challenge_hash: challengeHash,
      challenge_signature: 'b'.repeat(64),
    }), res.value)
    expect(res.raw.statusCode).toBe(401)
    expect(res.raw.body).toEqual({ ok: false, error: { code: 'unauthorized' } })
  })

  it('rejects malformed and incorrectly signed challenges without echoing them', () => {
    process.env.VIDEO_STUDIO_RUNNER_TOKEN = bearer
    process.env.VIDEO_STUDIO_RUNNER_SIGNING_KEY = signing

    const malformed = response()
    handler(request(bearer, { schema_version: 1, challenge_hash: challengeHash }), malformed.value)
    expect(malformed.raw.statusCode).toBe(400)
    expect(malformed.raw.body).toEqual({ ok: false, error: { code: 'invalid_credential_probe' } })

    const invalid = response()
    handler(request(bearer, {
      schema_version: 1,
      challenge_hash: challengeHash,
      challenge_signature: 'b'.repeat(64),
    }), invalid.value)
    expect(invalid.raw.statusCode).toBe(401)
    expect(invalid.raw.body).toEqual({ ok: false, error: { code: 'receipt_signature_rejected' } })
  })
})
