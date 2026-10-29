// Ephemeral signing keys and synthetic bytes for contract tests only.
import { generateKeyPairSync, sign } from 'node:crypto'
import { MEDIA_STANDARD, MEDIA_STANDARD_HASH, canonicalMediaJson, mediaDigest, type MediaReview } from '../../packages/core/src/media-quality.js'
export class MediaFixture {
  readonly key = generateKeyPairSync('ed25519')
  readonly proofKey = generateKeyPairSync('ed25519')
  readonly rows: Record<string, any>[] = []
  readonly objects = new Map<string, Buffer>()
  readonly prefix = '3 Posts/2026-10-26 Mon follow.the.money - Who gets paid/3 Video/'
  get keys() { return { final: { public_key: this.key.publicKey.export({ type: 'spki', format: 'pem' }).toString(), reviewer_id: 'fixture-final' }, proof: { public_key: this.proofKey.publicKey.export({ type: 'spki', format: 'pem' }).toString(), reviewer_id: 'fixture-proof' } } }
  put(name: string, data: string | Buffer, contentType = 'application/json') {
    const bytes = Buffer.from(data), sha256 = mediaDigest(bytes), path = this.prefix + name
    const object_key = `files/${sha256}.${name.split('.').pop()}`
    if (!this.rows.some(r => r.path === path && r.sha256 === sha256)) this.rows.push({ path, sha256, object_key, bytes: bytes.length, content_type: contentType, state: 'ready' })
    this.objects.set(object_key, bytes)
    return { path, sha256 }
  }
  sign(payload: MediaReview, proof = false) { return { key_id: proof ? 'proof' : 'final', payload, signature: sign(null, Buffer.from(canonicalMediaJson(payload)), (proof ? this.proofKey : this.key).privateKey).toString('base64') } }
  video(piece = 'fixture-piece', cut: 'short' | 'long' | 'feature' = 'short', name = `${cut}.mp4`) {
    const artifact = this.put(name, `Synthetic ${piece} ${cut} video bytes`, 'video/mp4')
    const evidence = this.put(`${cut}-evidence.json`, JSON.stringify({ synthetic_test_evidence: true, piece, cut }))
    const p: MediaReview = { schema_version: 1, kind: 'media_quality', stage: 'proof', standard_sha256: MEDIA_STANDARD_HASH,
      brief: { schema_version: 1, standard_sha256: MEDIA_STANDARD_HASH, piece_id: piece, production_id: `job-${piece}`, producer_run_id: 'fixture-producer', surface: 'video_voiceover', cut, subject: 'Synthetic independent-review fixture',
        assets: [{ id: 'image', sha256: evidence.sha256, kind: 'piece', piece_id: piece, source: 'Synthetic test', truth_role: 'illustration', relevance: 'This test scene' }],
        units: [{ id: 'one', takeaway: 'Visible transfer', visual_cues: ['Transfer between two spaces'], asset_ids: ['image'], visible_words: [], word_purpose: 'No words', motion_purpose: 'Transfer' }] },
      reviewer_run_id: 'fixture-reviewer', reviewed_at: '2026-10-26T00:00:00.000Z', artifacts: [{ ...artifact, id: 'master', role: 'video', content_type: 'video/mp4' }], evidence: [evidence],
      proof_roles: ['opening', 'dense_explanation', 'transition_or_conclusion'].map(role => ({ role: role as MediaReview['proof_roles'][number]['role'], evidence_sha256: evidence.sha256 })), proof_receipt_sha256: null,
      coverage: { unit_ids: ['one'], artifact_sha256: [artifact.sha256], continuous_playback: true, all_slides: false, audio_review: 'human_listening', comprehension_method: 'model_prediction', comprehension_evidence_sha256: evidence.sha256 },
      findings: [...MEDIA_STANDARD.criteria, ...MEDIA_STANDARD.video_criteria].map(criterion => ({ criterion, result: 'pass', observation: 'Synthetic fixture only; no real quality approval', evidence_sha256: [evidence.sha256] })),
    }
    const proof = this.put(`${cut}-proof.json`, canonicalMediaJson(this.sign(p, true)))
    const final = { ...p, stage: 'final' as const, proof_receipt_sha256: proof.sha256 }
    const receipt = this.put(`${cut}-review.json`, canonicalMediaJson(this.sign(final)))
    return { request: { piece_id: piece, production_id: `job-${piece}`, role: 'video' as const, cut, artifact, receipt }, final, proof, evidence }
  }
  fetch = async (url: string | URL | Request) => {
    const key = new URL(String(url)).pathname.slice(1)
    const bytes = this.objects.get(key)
    return new Response(bytes ? new Uint8Array(bytes) : null, { status: bytes ? 200 : 404 })
  }
  get storage() { return { from: () => ({ createSignedUrl: async (key: string) => ({ data: { signedUrl: `https://media-fixture.invalid/${key}` }, error: null }) }) } }
  get db() {
    return { storage: this.storage, from: () => {
      const filters: ((r: Record<string, any>) => boolean)[] = []; let max = Infinity
      const result = () => ({ data: this.rows.filter(r => filters.every(f => f(r))).slice(0, max), error: null })
      const chain = { select: () => chain, eq: (key: string, value: unknown) => { filters.push(r => r[key] === value); return chain }, limit: (n: number) => { max = n; return chain }, maybeSingle: async () => ({ data: result().data[0] || null, error: null }), then: (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve) }
      return chain
    } }
  }
}
