import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// scripts/post-pack/piece_manifest.py (W2.8): the piece's 0 Publish/manifest.json in Growth's closed shape, sealed
// only by Krish's Approve for publish bound to the draft's sha256, and the go-live dispatch that names it with every
// slot per_item_review true (one decision per post). Nothing here sends: --deliver needs his words for that send.

const ROOT = join(__dirname, '..', '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'
const env: NodeJS.ProcessEnv = { ...process.env, PYTHONIOENCODING: 'utf-8' }
delete env.ENGINE_OPERATOR_TOKEN

describe('piece manifest (W2.8)', () => {
  it('self-test: draft, seal on his approval only, dispatch with per_item_review on every slot, every refusal', () => {
    const r = spawnSync(PY, [join(ROOT, 'scripts', 'post-pack', 'piece_manifest.py'), 'self-test'], { encoding: 'utf8', env })
    expect(r.status, r.stdout + r.stderr).toBe(0)
    expect(r.stdout).toMatch(/piece_manifest self-test passed/)
  })
  it('the schema is Growth\'s closed shape, content-engine-piece-manifest/1', () => {
    const schema = JSON.parse(readFileSync(join(ROOT, 'config', 'schema', 'piece-manifest.schema.json'), 'utf8'))
    expect(schema.properties.schema.const).toBe('content-engine-piece-manifest/1')
    expect(schema.additionalProperties).toBe(false)
    expect(schema.required).toEqual(['schema', 'piece_id', 'approval_sha256', 'qa', 'assets', 'channels'])
  })
})
