import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { MagicEditDirectionV1Schema, MagicEditTargetMapV1Schema, type MagicEditTargetMapV1 } from '@mindmake/contracts'
import { compileMagicEditDirection, hashValue, persistMagicEditTargetMap } from '@mindmake/core'

const REVISION = 'a'.repeat(64)
const ARTIFACT = 'b'.repeat(64)
const MANIFEST = 'c'.repeat(64)

function targetMap(targets: MagicEditTargetMapV1['targets'], generatedAt = '2026-09-04T10:00:00.000Z'): MagicEditTargetMapV1 {
  const body = {
    schema_version: 1 as const,
    map_id: 'magic-map-test',
    job_id: 'job-magic-test',
    platform: 'youtube_shorts' as const,
    expected_parent_revision_hash: REVISION,
    expected_parent_artifact_hash: ARTIFACT,
    render_manifest_hash: MANIFEST,
    duration_ms: 10_000,
    targets,
  }
  return MagicEditTargetMapV1Schema.parse({ ...body, generated_at: generatedAt, semantic_target_map_hash: hashValue(body) })
}

function direction(map: MagicEditTargetMapV1, instruction: string, targetId: string) {
  return MagicEditDirectionV1Schema.parse({
    schema_version: 1,
    direction_id: '11111111-1111-4111-8111-111111111111',
    job_id: map.job_id,
    platform: map.platform,
    expected_parent_revision_hash: map.expected_parent_revision_hash,
    expected_parent_artifact_hash: map.expected_parent_artifact_hash,
    semantic_target_map_hash: map.semantic_target_map_hash,
    selection: { kind: 'target', target_ids: [targetId] },
    instruction,
    protections: { preserve_spoken_words: true, preserve_spoken_order: true, preserve_claims: true, preserve_evidence: true, preserve_rights: true },
    requested_profile: 'preview',
    submitted_by: 'Krish',
    submitted_at: '2026-09-04T10:00:00.000Z',
  })
}

describe('bounded magic edit compiler', () => {
  let root = ''

  afterEach(async () => {
    delete process.env.MINDMAKE_RUNTIME_ROOT
    if (root) await rm(root, { recursive: true, force: true })
    root = ''
  })

  it('moves existing proof earlier only inside its declared beat window', () => {
    const map = targetMap([{
      target_id: 'overlay-proof', kind: 'overlay', ordinal: 0, start_ms: 3500, end_ms: 5500, allowed_start_ms: 1000, allowed_end_ms: 7000,
      capabilities: ['overlay_anchor', 'overlay_opacity', 'overlay_timing_shift'], allowed_anchors: ['right'], current_anchor: 'right', current_opacity: 1,
    }])
    const compiled = compileMagicEditDirection(direction(map, 'Move this approved proof earlier.', 'overlay-proof'), map)
    expect(compiled.status).toBe('compiled')
    if (compiled.status !== 'compiled') throw new Error('expected a compiled direction')
    expect(compiled.intent.operations).toEqual([{ operation: 'overlay_timing_shift', target_id: 'overlay-proof', delta_ms: -1500 }])

    const atBoundary = targetMap([{ ...map.targets[0]!, start_ms: 1000, end_ms: 3000 }])
    expect(compileMagicEditDirection(direction(atBoundary, 'Move this approved proof earlier.', 'overlay-proof'), atBoundary).status).toBe('requires_editorial_route')
  })

  it('resolves an exact requested caption token instead of guessing the first word', () => {
    const map = targetMap([{
      target_id: 'caption-one', kind: 'caption', ordinal: 0, start_ms: 0, end_ms: 2000, caption_tokens: ['This', 'changes', 'the', 'outcome'], capabilities: ['caption_emphasis'], allowed_anchors: [],
    }])
    const compiled = compileMagicEditDirection(direction(map, 'Highlight outcome in this caption.', 'caption-one'), map)
    expect(compiled.status).toBe('compiled')
    if (compiled.status !== 'compiled') throw new Error('expected a compiled direction')
    expect(compiled.intent.operations).toEqual([{ operation: 'caption_emphasis', target_id: 'caption-one', word_indexes: [3] }])
    expect(compileMagicEditDirection(direction(map, 'Give the captions more emphasis.', 'caption-one'), map).status).toBe('requires_editorial_route')
    expect(compileMagicEditDirection(direction(map, 'Highlight a word that is absent.', 'caption-one'), map).status).toBe('requires_editorial_route')
  })

  it('routes anchor and opacity no-ops instead of claiming a candidate change', () => {
    const map = targetMap([{
      target_id: 'overlay-proof', kind: 'overlay', ordinal: 0, start_ms: 2000, end_ms: 4000, allowed_start_ms: 1000, allowed_end_ms: 5000,
      capabilities: ['overlay_anchor', 'overlay_opacity', 'overlay_timing_shift'], allowed_anchors: ['right'], current_anchor: 'right', current_opacity: 1,
    }])
    expect(compileMagicEditDirection(direction(map, 'Move this overlay to the right.', 'overlay-proof'), map).status).toBe('requires_editorial_route')
    expect(compileMagicEditDirection(direction(map, 'Make this overlay fully visible.', 'overlay-proof'), map).status).toBe('requires_editorial_route')
    expect(compileMagicEditDirection(direction(map, 'Make this overlay more subtle.', 'overlay-proof'), map).status).toBe('compiled')
  })

  it('requires an explicit camera direction instead of guessing from a complaint', () => {
    const map = targetMap([{ target_id: 'camera-one', kind: 'camera', ordinal: 0, start_ms: 0, end_ms: 2000, capabilities: ['camera_crop_scale'], allowed_anchors: [] }])
    expect(compileMagicEditDirection(direction(map, 'The camera is covering my face.', 'camera-one'), map).status).toBe('requires_editorial_route')
    const closer = compileMagicEditDirection(direction(map, 'Push in closer on this camera shot.', 'camera-one'), map)
    expect(closer.status).toBe('compiled')
    if (closer.status !== 'compiled') throw new Error('expected explicit camera direction to compile')
    expect(closer.intent.operations).toEqual([{ operation: 'camera_crop_scale', target_id: 'camera-one', factor: 0.88 }])
  })

  it('keeps a content-addressed target map byte-identical across repeat generation', async () => {
    root = await mkdtemp(join(tmpdir(), 'mindmake-target-map-'))
    process.env.MINDMAKE_RUNTIME_ROOT = root
    const original = targetMap([{
      target_id: 'caption-one', kind: 'caption', ordinal: 0, start_ms: 0, end_ms: 2000, caption_tokens: ['Exact', 'words'], capabilities: ['caption_emphasis'], allowed_anchors: [],
    }])
    const later = { ...original, generated_at: '2026-09-04T11:00:00.000Z' }
    const first = await persistMagicEditTargetMap(original.job_id, original)
    const path = join(root, 'jobs', original.job_id, 'control-plane', 'target-maps', `${original.semantic_target_map_hash}.json`)
    const firstBytes = await readFile(path)
    const second = await persistMagicEditTargetMap(original.job_id, later)
    const secondBytes = await readFile(path)
    expect(second.generated_at).toBe(first.generated_at)
    expect(secondBytes).toEqual(firstBytes)
    expect(hashValue(JSON.parse(firstBytes.toString('utf8')))).toBe(hashValue(JSON.parse(secondBytes.toString('utf8'))))
  })

  it('routes story, claim, and evidence changes through editorial review', () => {
    const map = targetMap([{
      target_id: 'caption-one', kind: 'caption', ordinal: 0, start_ms: 0, end_ms: 2000, caption_tokens: ['Exact', 'words'], capabilities: ['caption_emphasis'], allowed_anchors: [],
    }])
    expect(compileMagicEditDirection(direction(map, 'Change the hook and add a stronger claim.', 'caption-one'), map)).toMatchObject({ status: 'requires_editorial_route' })
    expect(compileMagicEditDirection(direction(map, 'Replace the evidence screenshot.', 'caption-one'), map)).toMatchObject({ status: 'requires_editorial_route' })
  })
})
