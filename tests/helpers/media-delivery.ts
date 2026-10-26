// Client test double only. Server signature/byte verification is exercised by
// control-plane/media-quality*.test.ts, including a real local HTTP request.
import { writeFile } from 'node:fs/promises'
import { vi } from 'vitest'
import { hashFile } from '../../packages/core/src/hash.js'
import { MEDIA_STANDARD_HASH } from '../../packages/core/src/media-quality.js'
export async function attachQualifiedClientFixture(path: string, job: string) {
  vi.stubEnv('ENGINE_OPERATOR_TOKEN', 'synthetic-client-fixture')
  const artifact = { path: `3 Posts/2026-10-26 Mon follow.the.money - Fixture/3 Video/${job}.mp4`, sha256: await hashFile(path) }
  const binding = { piece_id: 'fixture-piece', production_id: job, role: 'video', cut: 'short', artifact, receipt: { path: 'fixture-review.json', sha256: 'f'.repeat(64) } }
  await writeFile(`${path}.media-quality.json`, JSON.stringify(binding))
  vi.stubGlobal('fetch', async (_url: unknown, init: RequestInit) => {
    const r = JSON.parse(String(init.body))
    return new Response(JSON.stringify({ ok: true, qualification: { qualified: true, qualification_id: r.receipt.sha256, piece_id: r.piece_id, production_id: r.production_id, role: r.role, cut: r.cut, stage: r.stage, artifact: r.artifact, standard_sha256: MEDIA_STANDARD_HASH } }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  })
}
