import { afterEach, describe, expect, it, vi } from 'vitest'
import { MediaFixture } from '../helpers/media-quality.js'
vi.hoisted(() => { process.env.SUPABASE_URL = 'https://storage-fixture.invalid'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'synthetic-test' })
import { qualifyMedia } from '../../apps/control-plane/api/_mediaQuality.js'
const oldKeys = process.env.MEDIA_REVIEW_PUBLIC_KEYS
afterEach(() => { vi.unstubAllGlobals(); if (oldKeys === undefined) delete process.env.MEDIA_REVIEW_PUBLIC_KEYS; else process.env.MEDIA_REVIEW_PUBLIC_KEYS = oldKeys })
function setup() { const f = new MediaFixture(); process.env.MEDIA_REVIEW_PUBLIC_KEYS = JSON.stringify(f.keys); vi.stubGlobal('fetch', f.fetch); return f }
describe('server media qualification with actual streamed byte verification', () => {
  it('fetches and hashes proof, final review, evidence and output before qualifying', async () => {
    const f = setup(), v = f.video()
    await expect(qualifyMedia(f.db as never, v.request)).resolves.toMatchObject({ qualified: true, stage: 'final', role: 'video', artifact: v.request.artifact })
  })
  it('rejects corrupt stored bytes despite matching declared metadata', async () => {
    const f = setup(), v = f.video(), row = f.rows.find(r => r.sha256 === v.request.artifact.sha256)!
    f.objects.set(row.object_key, Buffer.from('corrupt'))
    await expect(qualifyMedia(f.db as never, v.request)).rejects.toThrow(/hash mismatch|size mismatch/)
  })
  it('rejects a valid receipt reused across jobs and a manifest selected as video', async () => {
    const f = setup(), v = f.video()
    await expect(qualifyMedia(f.db as never, { ...v.request, production_id: 'other-job' })).rejects.toThrow('another production job')
    const manifest = f.put('manifest.json', '{}')
    v.final.artifacts.push({ ...manifest, id: 'manifest', role: 'manifest', content_type: 'application/json' })
    v.final.coverage.artifact_sha256.push(manifest.sha256)
    const receipt = f.put('with-manifest.json', JSON.stringify(f.sign(v.final)))
    await expect(qualifyMedia(f.db as never, { ...v.request, artifact: manifest, receipt })).rejects.toThrow(/role, bytes and destination/)
  })
  it('invalidates the chain when only the proof key is revoked', async () => {
    const f = setup(), v = f.video()
    await qualifyMedia(f.db as never, v.request)
    process.env.MEDIA_REVIEW_PUBLIC_KEYS = JSON.stringify({ final: f.keys.final })
    await expect(qualifyMedia(f.db as never, v.request)).rejects.toThrow('representative proof: trusted independent reviewer unavailable')
  })
  it('rejects missing evidence and stored MIME substitution', async () => {
    const f = setup(), v = f.video()
    f.rows.find(r => r.sha256 === v.request.artifact.sha256)!.content_type = 'image/png'
    await expect(qualifyMedia(f.db as never, v.request)).rejects.toThrow('stored media type differs')
    f.rows.find(r => r.sha256 === v.evidence.sha256)!.state = 'reserved'
    await expect(qualifyMedia(f.db as never, v.request)).rejects.toThrow('exact media or evidence version unavailable')
  })
})
