import { sign } from 'node:crypto'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MediaFixture } from '../helpers/media-quality.js'
import { BoardDeliverySchema, MEDIA_STANDARD_HASH, canonicalMediaJson, mediaDigest } from '../../packages/core/src/media-quality.js'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
const rollout = vi.hoisted(() => ({ active: true }))
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => rollout.active, mediaQualityRollout: () => ({ status: rollout.active ? 'active' : 'candidate_pending_calibration' }) }))

// Qualification receives our in-memory database. Never construct a real provider client.
vi.mock('../../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))

const previousKeys = process.env.MEDIA_REVIEW_PUBLIC_KEYS
const previousToken = process.env.ENGINE_OPERATOR_TOKEN
afterEach(() => {
  vi.unstubAllGlobals()
  if (previousKeys === undefined) delete process.env.MEDIA_REVIEW_PUBLIC_KEYS
  else process.env.MEDIA_REVIEW_PUBLIC_KEYS = previousKeys
  if (previousToken === undefined) delete process.env.ENGINE_OPERATOR_TOKEN
  else process.env.ENGINE_OPERATOR_TOKEN = previousToken
})

function setup() {
  rollout.active = true // Test-only activation, not a production environment toggle.
  const media = new MediaFixture(), video = media.video()
  const week = '2026-10-26', token = 'synthetic-board-quality-test'
  process.env.ENGINE_OPERATOR_TOKEN = token
  process.env.MEDIA_REVIEW_PUBLIC_KEYS = JSON.stringify(media.keys)
  const types = new Map<string, string>()
  function boardFile(name: string, bytes: Buffer, type: string) {
    const sha256 = mediaDigest(bytes), key = `boards/${week}/${sha256}`
    media.objects.set(key, bytes)
    types.set(key, type)
    return { name, sha256, bytes: bytes.length, type, key }
  }
  const source = media.rows.find(row => row.path === video.request.artifact.path)!
  const asset = boardFile('synthetic-video.mp4', media.objects.get(source.object_key)!, 'video/mp4')
  const html = boardFile('synthetic-board.html', Buffer.from(`<!doctype html><title>Synthetic contract fixture</title><a href="/api/board/${week}/assets/video?sha=${asset.sha256}">Synthetic media</a>`), 'text/html')
  const manifest = { version: 1 as const, week, html, assets: { video: asset } }
  const evidence = media.put('board-evidence.json', JSON.stringify({ synthetic_test_evidence: true, note: 'Contract fixture only; no real visual or delivery approval' }))
  const payload = {
    schema_version: 1, kind: 'board_delivery', standard_sha256: MEDIA_STANDARD_HASH,
    manifest_sha256: mediaDigest(canonicalMediaJson(manifest)), reviewer_run_id: 'synthetic-board-review',
    reviewed_at: '2026-10-26T00:00:00.000Z', evidence: [evidence],
    all_media_bound: true, no_unqualified_ready_claims: true,
    qualifications: [{ piece_id: video.request.piece_id, role: 'video', artifact: video.request.artifact, receipt: video.request.receipt }],
  }
  const delivery_review = BoardDeliverySchema.parse({ key_id: 'final', payload,
    signature: sign(null, Buffer.from(canonicalMediaJson(payload)), media.key.privateKey).toString('base64') })
  const signedManifest = { ...manifest, delivery_review }
  const builds = new Map<string, typeof signedManifest>()
  let pointer: { build_id: string; revision: number } | null = null
  const rpc = vi.fn(async (name: string, args: Record<string, any>) => {
    if (name !== 'board_activate') throw new Error(`Unexpected RPC ${name}`)
    builds.set(args.p_build, structuredClone(args.p_manifest))
    pointer = { build_id: args.p_build, revision: args.p_revision + 1 }
    return { data: { ok: true, ...pointer }, error: null }
  })
  const db = {
    storage: media.storage, rpc,
    from(table: string) {
      if (table === 'content_library_files') return media.db.from()
      if (!['board_weeks', 'board_builds'].includes(table)) throw new Error(`Unexpected table ${table}`)
      const filters = new Map<string, unknown>()
      const chain = {
        select: () => chain,
        eq: (key: string, value: unknown) => { filters.set(key, value); return chain },
        maybeSingle: async () => ({ data: filters.get('week') !== week ? null
          : table === 'board_weeks' ? pointer
            : builds.has(String(filters.get('build_id'))) ? { manifest: builds.get(String(filters.get('build_id'))) } : null, error: null }),
      }
      return chain
    },
  }
  const fetch = vi.fn(async (url: string | URL | Request) => {
    const parsed = new URL(String(url))
    if (parsed.origin !== 'https://media-fixture.invalid') throw new Error('Real network is forbidden in this fixture')
    const key = parsed.pathname.slice(1), bytes = media.objects.get(key)
    return new Response(bytes ? new Uint8Array(bytes) : null, { status: bytes ? 200 : 404,
      headers: { 'Content-Type': types.get(key) || 'application/json' } })
  })
  vi.stubGlobal('fetch', fetch)
  const handler = createBoardHandler(async () => db as never)
  async function call(method: string, query: Record<string, string> = {}, body?: unknown) {
    let status = 0, out: any, location: string | undefined
    const headers: Record<string, unknown> = {}
    const res = {
      setHeader(name: string, value: unknown) { headers[name] = value },
      status(code: number) { status = code; return this },
      json(value: unknown) { out = value; return this },
      redirect(code: number, url: string) { status = code; location = url; return this },
    } as unknown as VercelResponse
    await handler({ method, headers: { authorization: `Bearer ${token}` }, query: { week, ...query }, body } as unknown as VercelRequest, res)
    return { status, out, headers, location }
  }
  return { media, signedManifest, builds, rpc, fetch, call }
}

describe('signed board activation and current-read revocation', () => {
  it('preserves draft board writes/reads while pending and never labels them qualified', async () => {
    const f = setup()
    rollout.active = false
    delete process.env.MEDIA_REVIEW_PUBLIC_KEYS
    const { delivery_review: _unused, ...manifest } = f.signedManifest
    const activated = await f.call('PUT', {}, { manifest, revision: 0 })
    expect(activated.status).toBe(200)
    expect(activated.out.media_quality_rollout).toBe('candidate_pending_calibration')
    const metadata = await f.call('GET')
    expect(metadata.out).toMatchObject({ media_quality_rollout: 'candidate_pending_calibration', media_qualification: 'candidate_pending_calibration', manifest })
    expect(metadata.headers['X-Media-Qualification']).toBe('candidate_pending_calibration')
    const asset = await f.call('GET', { op: 'assets', id: 'video' })
    expect(asset.status).toBe(303)
    expect(asset.headers['X-Media-Qualification']).toBe('candidate_pending_calibration')
    expect(f.rpc).toHaveBeenCalledOnce()
  })

  it('persists the exact signed envelope and returns the qualified build on independent readback', async () => {
    const f = setup()
    const result = await f.call('PUT', {}, { manifest: f.signedManifest, revision: 0 })
    expect(result.status).toBe(200)
    expect(f.rpc).toHaveBeenCalledOnce()
    expect(f.builds.get(result.out.build_id)).toEqual(f.signedManifest)
    expect(f.builds.get(result.out.build_id)?.delivery_review).toEqual(f.signedManifest.delivery_review)
    expect(result.out.build_id).toBe(mediaDigest(canonicalMediaJson(f.signedManifest)))
    const readback = await f.call('GET')
    expect(readback.status).toBe(200)
    expect(readback.out).toMatchObject({ build_id: result.out.build_id, manifest: f.signedManifest, media_qualification: 'qualified' })
    expect(readback.headers['X-Media-Qualification']).toBe('qualified')
  })

  it('refuses a changed manifest before activating or fetching its substituted HTML', async () => {
    const f = setup(), changedHash = mediaDigest('Synthetic changed HTML')
    const changed = { ...f.signedManifest, html: { ...f.signedManifest.html, sha256: changedHash, key: `boards/2026-10-26/${changedHash}` } }
    const result = await f.call('PUT', {}, { manifest: changed, revision: 0 })
    expect(result.status).toBe(409)
    expect(result.out.error).toContain('exact HTML and asset manifest')
    expect(f.rpc).not.toHaveBeenCalled()
    expect(f.fetch).not.toHaveBeenCalled()
    expect(f.builds.size).toBe(0)
  })

  it.each(['board signer', 'media proof signer'] as const)('invalidates current delivery after revoking the %s while retaining explicit history', async revoked => {
    const f = setup()
    const activation = await f.call('PUT', {}, { manifest: f.signedManifest, revision: 0 })
    expect(activation.status).toBe(200)
    process.env.MEDIA_REVIEW_PUBLIC_KEYS = JSON.stringify(revoked === 'board signer' ? { proof: f.media.keys.proof } : { final: f.media.keys.final })
    const metadata = await f.call('GET')
    expect(metadata.status).toBe(200)
    expect(metadata.out).toMatchObject({ build_id: activation.out.build_id, media_qualification: 'unqualified', manifest: f.signedManifest })
    expect(metadata.headers['X-Media-Qualification']).toBe('unqualified')
    const currentQueries: Record<string, string>[] = [{ op: 'html' }, { op: 'assets', id: 'video' }]
    for (const query of currentQueries) {
      const current = await f.call('GET', query)
      expect(current.status).toBe(409)
      expect(current.out.error).toBe('board_media_review_no_longer_valid')
      expect(current.location).toBeUndefined()
    }
    const historical = await f.call('GET', { build: activation.out.build_id, op: 'assets', id: 'video' })
    expect(historical.status).toBe(303)
    expect(historical.headers['X-Media-Qualification']).toBe('historical')
    expect(historical.location).toBe(`https://media-fixture.invalid/${f.signedManifest.assets.video.key}`)
    expect(f.rpc).toHaveBeenCalledOnce()
    expect(f.builds.get(activation.out.build_id)).toEqual(f.signedManifest)
  })
})
