import { randomUUID } from 'node:crypto'
import { link, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import {
  MagicEditActivationV1Schema,
  MagicEditCandidateV1Schema,
  MagicEditCompileResultV1Schema,
  MagicEditDirectionV1Schema,
  MagicEditIntentV1Schema,
  MagicEditReturnToParentV1Schema,
  MagicEditTargetMapV1Schema,
  RenderManifestV2Schema,
  StageArtifactV2Schema,
  VideoPlatformV1Schema,
  type MagicEditActivationV1,
  type MagicEditCandidateV1,
  type MagicEditCompileResultV1,
  type MagicEditDirectionV1,
  type MagicEditGateResultsV1,
  type MagicEditIntentV1,
  type MagicEditOperationV1,
  type MagicEditReturnToParentV1,
  type MagicEditTargetMapV1,
  type RenderManifestV2,
  type StageArtifactV2,
  type TreatmentStagePayloadV2,
  type VideoPlatformV1,
} from '@mindmake/contracts'
import { hashFile, hashValue } from './hash.js'
import {
  completeStageV2,
  hasApprovalV2,
  jobRevisionHashV2,
  loadJobV2,
  readStageArtifactV2,
  recordApprovalV2,
  recordJobEventV2,
  recordJobEventOnceV2,
  stageArtifactSemanticHashV2,
  withJobEventLock,
} from './job-store-v2.js'
import { jobPath } from './paths.js'
import { renderStoryV2, validateV2RenderReadiness } from './render-v2.js'

const MAGIC_EDIT_VERSION = 'magic-edit-control-plane-v1'
const INVALIDATED_STAGES = ['render', 'qa', 'package'] as const

type TreatmentArtifact = StageArtifactV2 & { payload: TreatmentStagePayloadV2 }

interface TreatmentContext {
  job: Awaited<ReturnType<typeof loadJobV2>>
  treatment: TreatmentArtifact
  manifest: RenderManifestV2
  manifestPath: string
  manifestHash: string
  revisionHash: string
}

function controlPlaneRoot(jobId: string): string {
  return join(jobPath(jobId), 'control-plane')
}

async function writeJsonAtomic(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
  const { rename } = await import('node:fs/promises')
  await rename(temporary, path)
}

async function writeJsonImmutable(path: string, value: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  const temporary = `${path}.${randomUUID()}.tmp`
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' })
  try { await link(temporary, path) }
  finally { await unlink(temporary).catch(() => undefined) }
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8'))
}

async function treatmentContext(jobId: string, platformInput: VideoPlatformV1): Promise<TreatmentContext> {
  const platform = VideoPlatformV1Schema.parse(platformInput)
  const job = await loadJobV2(jobId)
  const treatment = await readStageArtifactV2<TreatmentStagePayloadV2>(jobId, 'treatment')
  const entry = treatment.payload.manifests.find((item) => item.platform === platform)
  if (!entry) throw new Error(`current treatment has no ${platform} render manifest`)
  const manifestPath = resolve(entry.manifest_path)
  const manifestHash = await hashFile(manifestPath)
  if (manifestHash !== entry.manifest_hash) throw new Error('current treatment render manifest no longer matches its content hash')
  const manifest = RenderManifestV2Schema.parse(await readJson(manifestPath))
  if (manifest.job_id !== job.job_id || manifest.target_platform !== platform) throw new Error('current treatment render manifest belongs to a different job or platform')
  return { job, treatment, manifest, manifestPath, manifestHash, revisionHash: jobRevisionHashV2(job) }
}

function targetMapSemanticBody(value: Omit<MagicEditTargetMapV1, 'semantic_target_map_hash' | 'generated_at'>): unknown {
  return value
}

function verifyStoredTargetMap(value: unknown, expectedHash: string): MagicEditTargetMapV1 {
  const targetMap = MagicEditTargetMapV1Schema.parse(value)
  const { semantic_target_map_hash: semanticHash, generated_at: _generatedAt, ...body } = targetMap
  if (semanticHash !== expectedHash || hashValue(targetMapSemanticBody(body)) !== semanticHash) throw new Error('stored magic-edit target map failed content-address verification')
  return targetMap
}

export async function persistMagicEditTargetMap(jobId: string, targetMapInput: MagicEditTargetMapV1): Promise<MagicEditTargetMapV1> {
  const targetMap = verifyStoredTargetMap(targetMapInput, targetMapInput.semantic_target_map_hash)
  if (targetMap.job_id !== jobId) throw new Error('magic-edit target map belongs to a different job')
  const targetMapPath = join(controlPlaneRoot(jobId), 'target-maps', `${targetMap.semantic_target_map_hash}.json`)
  try { return verifyStoredTargetMap(await readJson(targetMapPath), targetMap.semantic_target_map_hash) }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  try { await writeJsonImmutable(targetMapPath, targetMap); return targetMap }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    return verifyStoredTargetMap(await readJson(targetMapPath), targetMap.semantic_target_map_hash)
  }
}

function targetId(kind: 'camera' | 'caption' | 'overlay', ordinal: number, sourceId: string): string {
  return `${kind}-${ordinal}-${hashValue({ kind, ordinal, sourceId }).slice(0, 12)}`
}

type ManifestShot = RenderManifestV2['shot_directives'][number]
type ManifestLayer = ManifestShot['layers'][number]

interface OverlaySegment {
  shotIndex: number
  layerIndex: number
  shot: ManifestShot
  layer: ManifestLayer
}

interface OverlayGroup {
  key: string
  beatId: string
  segments: OverlaySegment[]
}

function overlayGroups(manifest: RenderManifestV2): OverlayGroup[] {
  const byKey = new Map<string, OverlayGroup>()
  manifest.shot_directives.forEach((shot, shotIndex) => {
    shot.layers.forEach((layer, layerIndex) => {
      if (layer.kind !== 'asset') return
      const key = `${shot.beat_id}:${layer.layer_id}:${layer.target_id ?? ''}`
      const group = byKey.get(key) ?? { key, beatId: shot.beat_id, segments: [] }
      group.segments.push({ shotIndex, layerIndex, shot, layer })
      byKey.set(key, group)
    })
  })
  return [...byKey.values()].sort((left, right) => {
    const leftStart = Math.min(...left.segments.map((segment) => segment.layer.visible_start_ms ?? segment.shot.start_ms))
    const rightStart = Math.min(...right.segments.map((segment) => segment.layer.visible_start_ms ?? segment.shot.start_ms))
    return leftStart - rightStart || left.key.localeCompare(right.key)
  })
}

export async function createMagicEditTargetMap(jobId: string, platformInput: VideoPlatformV1): Promise<MagicEditTargetMapV1> {
  const context = await treatmentContext(jobId, platformInput)
  const targets: MagicEditTargetMapV1['targets'] = []
  context.manifest.shot_directives.forEach((shot, ordinal) => {
    targets.push({
      target_id: targetId('camera', ordinal, shot.shot_id),
      kind: 'camera',
      ordinal,
      start_ms: shot.start_ms,
      end_ms: shot.end_ms,
      capabilities: ['camera_crop_scale'],
      allowed_anchors: [],
    })
  })
  context.manifest.captions.forEach((caption, ordinal) => {
    targets.push({
      target_id: targetId('caption', ordinal, `${caption.start_ms}:${caption.end_ms}`),
      kind: 'caption',
      ordinal,
      start_ms: caption.start_ms,
      end_ms: caption.end_ms,
      caption_tokens: caption.text.trim().split(/\s+/),
      capabilities: ['caption_emphasis'],
      allowed_anchors: [],
    })
  })
  overlayGroups(context.manifest).forEach((group, overlayOrdinal) => {
    const first = group.segments[0]!
    const beatShots = context.manifest.shot_directives.filter((shot) => shot.beat_id === group.beatId)
    const startMs = Math.min(...group.segments.map((segment) => segment.layer.visible_start_ms ?? segment.shot.start_ms))
    const endMs = Math.max(...group.segments.map((segment) => segment.layer.visible_end_ms ?? segment.shot.end_ms))
    const allowedStartMs = Math.max(0, Math.min(...beatShots.map((shot) => shot.start_ms)))
    const allowedEndMs = Math.min(context.manifest.duration_ms, Math.max(...beatShots.map((shot) => shot.end_ms)))
    targets.push({
      target_id: targetId('overlay', overlayOrdinal, group.key),
      kind: 'overlay',
      ordinal: overlayOrdinal,
      start_ms: startMs,
      end_ms: endMs,
      allowed_start_ms: allowedStartMs,
      allowed_end_ms: allowedEndMs,
      capabilities: ['overlay_anchor', 'overlay_opacity', 'overlay_timing_shift'],
      // Alternate positions require a separately prepared face-safe target map.
      allowed_anchors: first.layer.anchor === 'full' ? [] : [first.layer.anchor],
      current_anchor: first.layer.anchor,
      current_opacity: first.layer.opacity,
    })
  })
  if (!targets.length) throw new Error('current treatment exposes no deterministic magic-edit targets')
  const preliminary = {
    schema_version: 1 as const,
    map_id: 'pending-map',
    job_id: context.job.job_id,
    platform: context.manifest.target_platform,
    expected_parent_revision_hash: context.revisionHash,
    expected_parent_artifact_hash: context.treatment.artifact_hash,
    render_manifest_hash: context.manifestHash,
    duration_ms: context.manifest.duration_ms,
    targets,
  }
  const mapId = `magic-map-${hashValue(preliminary).slice(0, 16)}`
  const body = { ...preliminary, map_id: mapId }
  const targetMap = MagicEditTargetMapV1Schema.parse({
    ...body,
    generated_at: new Date().toISOString(),
    semantic_target_map_hash: hashValue(targetMapSemanticBody(body)),
  })
  return persistMagicEditTargetMap(jobId, targetMap)
}

const EDITORIAL_PATTERNS: Array<{ code: 'meaning_change' | 'claim_change' | 'evidence_change' | 'story_change'; pattern: RegExp }> = [
  { code: 'meaning_change', pattern: /\b(?:rewrite|reword|change what|spoken words?|dialogue|transcript|sentence meaning|make (?:me|them) say)\b/i },
  { code: 'claim_change', pattern: /\b(?:change|add|remove|replace|invent|strengthen)\b.{0,28}\b(?:claim|fact|number|statistic|promise|guarantee)\b|\b(?:claim|fact|number|statistic|promise|guarantee)\b.{0,28}\b(?:change|add|remove|replace|invent)\b/i },
  { code: 'evidence_change', pattern: /\b(?:add|remove|replace|swap|invent|generate|change)\b.{0,28}\b(?:evidence|proof|source|citation|screenshot|headline)\b|\b(?:evidence|proof|source|citation|screenshot|headline)\b.{0,28}\b(?:add|remove|replace|swap|invent|generate|change)\b/i },
  { code: 'story_change', pattern: /\b(?:new hook|change the hook|cut|trim|shorten|lengthen|delete|remove a section|reorder|stitch|change the ending|change the story|story structure|different beat|move the payoff)\b/i },
]

function deterministicUuid(hash: string): string {
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

function targetsForDirection(direction: MagicEditDirectionV1, targetMap: MagicEditTargetMapV1) {
  const selection = direction.selection
  if (selection.kind === 'target') {
    const requested = new Set(selection.target_ids)
    return targetMap.targets.filter((target) => requested.has(target.target_id))
  }
  if (selection.kind === 'moment') return targetMap.targets.filter((target) => target.start_ms <= selection.at_ms && target.end_ms >= selection.at_ms)
  return targetMap.targets.filter((target) => target.start_ms < selection.end_ms && target.end_ms > selection.start_ms)
}

function inferredTargetKind(instruction: string): 'camera' | 'caption' | 'overlay' | null {
  if (/\b(?:caption|subtitle|word|text|emphasis|emphasise|emphasize|highlight)\b/i.test(instruction)) return 'caption'
  if (/\b(?:overlay|card|visual|screenshot|image|panel|proof|evidence)\b/i.test(instruction)) return 'overlay'
  if (/\b(?:camera|crop|zoom|closer|wider|push|pull|face|framing)\b/i.test(instruction)) return 'camera'
  return null
}

function normalizedCaptionToken(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('en-GB').replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')
}

function requestedCaptionToken(instruction: string): string | null {
  const match = instruction.match(/\b(?:emphasise|emphasize|highlight|stress)\s+(?:the\s+)?(?:word\s+)?["“']?([\p{L}\p{N}][\p{L}\p{N}'’_-]{0,79})/iu)
  if (!match?.[1]) return null
  const token = normalizedCaptionToken(match[1])
  return ['caption', 'captions', 'subtitle', 'subtitles', 'text', 'word', 'words', 'this', 'that', 'it', 'more'].includes(token) ? null : token
}

function compileBoundedOperations(direction: MagicEditDirectionV1, targetMap: MagicEditTargetMapV1): MagicEditOperationV1[] | null {
  let targets = targetsForDirection(direction, targetMap)
  const inferred = inferredTargetKind(direction.instruction)
  if (inferred) targets = targets.filter((target) => target.kind === inferred)
  if (!targets.length) return null
  if (!inferred && new Set(targets.map((target) => target.kind)).size > 1) return null
  const selected = targets.slice(0, 3)
  if (selected.every((target) => target.kind === 'camera')) {
    const wider = /\b(?:wider|pull out|less close|zoom out)\b/i.test(direction.instruction)
    const closer = /\b(?:closer|push in|zoom in|tighter|crop in)\b/i.test(direction.instruction)
    if (wider === closer) return null
    const stronger = /\b(?:much|way|significantly|stronger|punchier|decisive)\b/i.test(direction.instruction)
    const factor = wider ? (stronger ? 1.18 : 1.12) : (stronger ? 0.82 : 0.88)
    return selected.map((target) => ({ operation: 'camera_crop_scale' as const, target_id: target.target_id, factor }))
  }
  if (selected.every((target) => target.kind === 'caption')) {
    const requested = requestedCaptionToken(direction.instruction)
    if (!requested) return null
    const operations = selected.flatMap((target) => {
      const indexes = (target.caption_tokens ?? []).map((token, index) => normalizedCaptionToken(token) === requested ? index : -1).filter((index) => index >= 0).slice(0, 4)
      return indexes.length ? [{ operation: 'caption_emphasis' as const, target_id: target.target_id, word_indexes: indexes }] : []
    })
    return operations.length ? operations : null
  }
  if (selected.every((target) => target.kind === 'overlay')) {
    const earlier = /\b(?:sooner|earlier|forward|first|up front|upfront)\b/i.test(direction.instruction)
    const later = /\b(?:later|after|delay|back)\b/i.test(direction.instruction)
    if (earlier || later) {
      const magnitude = /\b(?:slightly|little|subtle)\b/i.test(direction.instruction) ? 750 : /\b(?:much|way|significantly)\b/i.test(direction.instruction) ? 2500 : 1500
      const deltaMs = earlier ? -magnitude : magnitude
      if (selected.some((target) => {
        if (target.allowed_start_ms === undefined || target.allowed_end_ms === undefined) return true
        const duration = target.end_ms - target.start_ms
        return Math.min(target.allowed_end_ms - duration, Math.max(target.allowed_start_ms, target.start_ms + deltaMs)) === target.start_ms
      })) return null
      return selected.map((target) => ({ operation: 'overlay_timing_shift' as const, target_id: target.target_id, delta_ms: deltaMs }))
    }
    const requestedAnchor = (['top_left', 'top_right', 'left', 'right', 'center', 'bottom'] as const).find((anchor) => new RegExp(`\\b${anchor.replace('_', '[ _-]')}\\b`, 'i').test(direction.instruction))
    if (requestedAnchor) {
      if (selected.some((target) => !target.allowed_anchors.includes(requestedAnchor))) return null
      if (selected.some((target) => target.current_anchor === requestedAnchor)) return null
      return selected.map((target) => ({ operation: 'overlay_anchor' as const, target_id: target.target_id, anchor: requestedAnchor }))
    }
    const moreVisible = /\b(?:more visible|stronger|full opacity|fully visible)\b/i.test(direction.instruction)
    const lessVisible = /\b(?:less visible|softer|fainter|lower opacity|more subtle)\b/i.test(direction.instruction)
    if (!moreVisible && !lessVisible) return null
    const opacity = lessVisible ? 0.75 : 1
    if (selected.some((target) => target.current_opacity === opacity)) return null
    return selected.map((target) => ({ operation: 'overlay_opacity' as const, target_id: target.target_id, opacity }))
  }
  return null
}

export function compileMagicEditDirection(directionInput: MagicEditDirectionV1, targetMapInput: MagicEditTargetMapV1): MagicEditCompileResultV1 {
  const direction = MagicEditDirectionV1Schema.parse(directionInput)
  const targetMap = MagicEditTargetMapV1Schema.parse(targetMapInput)
  const directionHash = hashValue(direction)
  const editorial = EDITORIAL_PATTERNS.find((candidate) => candidate.pattern.test(direction.instruction))
  if (editorial) return MagicEditCompileResultV1Schema.parse({ schema_version: 1, status: 'requires_editorial_route', intent_hash: directionHash, reason_code: editorial.code })
  if (direction.job_id !== targetMap.job_id || direction.platform !== targetMap.platform) throw new Error('magic-edit direction belongs to a different job or platform')
  if (direction.expected_parent_revision_hash !== targetMap.expected_parent_revision_hash || direction.expected_parent_artifact_hash !== targetMap.expected_parent_artifact_hash) throw new Error('magic-edit direction is stale against its exact parent')
  if (direction.semantic_target_map_hash && direction.semantic_target_map_hash !== targetMap.semantic_target_map_hash) throw new Error('magic-edit direction target map is stale')
  const operations = compileBoundedOperations(direction, targetMap)
  if (!operations?.length) return MagicEditCompileResultV1Schema.parse({ schema_version: 1, status: 'requires_editorial_route', intent_hash: directionHash, reason_code: 'unsupported_direction' })
  const targets = new Map(targetMap.targets.map((target) => [target.target_id, target]))
  for (const operation of operations) {
    const target = targets.get(operation.target_id)
    if (!target) throw new Error(`magic-edit operation references unknown target ${operation.target_id}`)
    if (!target.capabilities.includes(operation.operation)) throw new Error(`magic-edit target ${operation.target_id} does not allow ${operation.operation}`)
    if (operation.operation === 'overlay_anchor' && !target.allowed_anchors.includes(operation.anchor)) throw new Error(`magic-edit target ${operation.target_id} has no approved face-safe ${operation.anchor} placement`)
    if (operation.operation === 'overlay_timing_shift' && (target.allowed_start_ms === undefined || target.allowed_end_ms === undefined)) throw new Error(`magic-edit target ${operation.target_id} has no declared timing window`)
  }
  const intent = MagicEditIntentV1Schema.parse({
    schema_version: 1,
    intent_id: deterministicUuid(directionHash),
    direction_id: direction.direction_id,
    direction_hash: directionHash,
    instruction_hash: hashValue(direction.instruction),
    job_id: direction.job_id,
    platform: direction.platform,
    expected_parent_revision_hash: direction.expected_parent_revision_hash,
    expected_parent_artifact_hash: direction.expected_parent_artifact_hash,
    ...(direction.semantic_target_map_hash ? { semantic_target_map_hash: direction.semantic_target_map_hash } : {}),
    selection: direction.selection,
    operations,
    protections: direction.protections,
    requested_profile: direction.requested_profile,
    submitted_by: direction.submitted_by,
    compiler: { kind: 'bounded_deterministic', version: 1 },
    compiled_at: direction.submitted_at,
  })
  const intentHash = hashValue(intent)
  return MagicEditCompileResultV1Schema.parse({
    schema_version: 1,
    status: 'compiled',
    intent_hash: intentHash,
    intent,
    protected_invariants: ['spoken_words', 'spoken_order', 'claims', 'evidence', 'rights'],
  })
}

function scaleCrop(crop: RenderManifestV2['shot_directives'][number]['camera_plan']['keyframes'][number]['crop'], factor: number) {
  const width = Math.min(1, Math.max(0.05, crop.width * factor))
  const height = Math.min(1, Math.max(0.05, crop.height * factor))
  const centerX = crop.x + crop.width / 2
  const centerY = crop.y + crop.height / 2
  return {
    x: Math.min(1 - width, Math.max(0, centerX - width / 2)),
    y: Math.min(1 - height, Math.max(0, centerY - height / 2)),
    width,
    height,
  }
}

function shiftedOverlayWindow(target: MagicEditTargetMapV1['targets'][number], deltaMs: number): { startMs: number; endMs: number } {
  if (target.allowed_start_ms === undefined || target.allowed_end_ms === undefined) throw new Error('overlay timing target has no declared timing window')
  const duration = target.end_ms - target.start_ms
  if (duration > target.allowed_end_ms - target.allowed_start_ms) throw new Error('overlay timing target exceeds its declared timing window')
  const startMs = Math.min(target.allowed_end_ms - duration, Math.max(target.allowed_start_ms, target.start_ms + deltaMs))
  if (startMs === target.start_ms) throw new Error('magic-edit direction produced no render change')
  return { startMs, endMs: startMs + duration }
}

function nextAvailableZIndex(shot: ManifestShot, preferred: number): number {
  const used = new Set(shot.layers.map((layer) => layer.z_index))
  let candidate = preferred
  while (used.has(candidate)) candidate += 1
  return candidate
}

function applyOverlayTimingShift(manifest: RenderManifestV2, groupKey: string, target: MagicEditTargetMapV1['targets'][number], deltaMs: number): void {
  const group = overlayGroups(manifest).find((candidate) => candidate.key === groupKey)
  if (!group) throw new Error('overlay timing target no longer exists in the current render manifest')
  const window = shiftedOverlayWindow(target, deltaMs)
  const destinationShots = manifest.shot_directives.filter((shot) => shot.beat_id === group.beatId && shot.start_ms < window.endMs && shot.end_ms > window.startMs)
  if (!destinationShots.length) throw new Error('overlay timing shift has no safe destination shot')
  const destinationIds = new Set(destinationShots.map((shot) => shot.shot_id))
  for (const segment of group.segments) {
    const remaining = segment.shot.layers.filter((layer) => layer !== segment.layer)
    if (!remaining.length && !destinationIds.has(segment.shot.shot_id)) throw new Error('overlay timing shift would leave a source shot without a visual layer')
  }

  const baseLayer = structuredClone(group.segments[0]!.layer)
  delete baseLayer.visible_start_ms
  delete baseLayer.visible_end_ms
  for (const segment of [...group.segments].sort((left, right) => right.shotIndex - left.shotIndex || right.layerIndex - left.layerIndex)) {
    segment.shot.layers.splice(segment.layerIndex, 1)
  }
  for (const shot of destinationShots) {
    const layer = structuredClone(baseLayer)
    layer.visible_start_ms = Math.max(window.startMs, shot.start_ms)
    layer.visible_end_ms = Math.min(window.endMs, shot.end_ms)
    layer.z_index = nextAvailableZIndex(shot, layer.z_index)
    shot.layers.push(layer)
    shot.layers.sort((left, right) => left.z_index - right.z_index || left.layer_id.localeCompare(right.layer_id))
  }
}

export function applyMagicEditOperations(manifestInput: RenderManifestV2, targetMap: MagicEditTargetMapV1, operations: MagicEditOperationV1[]): { manifest: RenderManifestV2; changeCodes: MagicEditCandidateV1['change_codes'] } {
  const before = structuredClone(RenderManifestV2Schema.parse(manifestInput))
  let manifest = structuredClone(before)
  const targetById = new Map(targetMap.targets.map((target) => [target.target_id, target]))
  const initialOverlayGroups = overlayGroups(manifest)
  const overlayGroupKeyByTargetId = new Map(targetMap.targets.filter((target) => target.kind === 'overlay').map((target) => [target.target_id, initialOverlayGroups[target.ordinal]?.key]))
  const changeCodes = new Set<MagicEditCandidateV1['change_codes'][number]>()
  for (const operation of operations) {
    const target = targetById.get(operation.target_id)!
    if (operation.operation === 'camera_crop_scale') {
      const shot = manifest.shot_directives[target.ordinal]
      if (!shot) throw new Error('camera target no longer exists in the current render manifest')
      shot.camera_plan.keyframes = shot.camera_plan.keyframes.map((keyframe) => ({
        ...keyframe,
        crop: scaleCrop(keyframe.crop, operation.factor),
        zoom: Math.min(4, Math.max(1, keyframe.zoom / operation.factor)),
      }))
      changeCodes.add('camera_crop_changed')
      continue
    }
    if (operation.operation === 'caption_emphasis') {
      const cue = manifest.captions[target.ordinal]
      if (!cue) throw new Error('caption target no longer exists in the current render manifest')
      const words = cue.text.trim().split(/\s+/)
      if (operation.word_indexes.some((index) => index >= words.length)) throw new Error('caption emphasis index exceeds the verified caption words')
      cue.emphasis = [...new Set(operation.word_indexes.map((index) => words[index]!))]
      changeCodes.add('caption_emphasis_changed')
      continue
    }
    const groupKey = overlayGroupKeyByTargetId.get(operation.target_id)
    if (!groupKey) throw new Error('overlay target no longer exists in the current render manifest')
    const group = overlayGroups(manifest).find((candidate) => candidate.key === groupKey)
    if (!group) throw new Error('overlay target no longer exists in the current render manifest')
    if (operation.operation === 'overlay_anchor') {
      for (const segment of group.segments) {
        segment.layer.anchor = operation.anchor
        delete segment.layer.bounds
      }
      changeCodes.add('overlay_anchor_changed')
    } else if (operation.operation === 'overlay_opacity') {
      for (const segment of group.segments) segment.layer.opacity = operation.opacity
      changeCodes.add('overlay_opacity_changed')
    } else {
      applyOverlayTimingShift(manifest, groupKey, target, operation.delta_ms)
      changeCodes.add('overlay_timing_changed')
    }
  }
  manifest = RenderManifestV2Schema.parse(manifest)
  if (hashValue(manifest) === hashValue(before)) throw new Error('magic-edit direction produced no render change')
  return { manifest, changeCodes: [...changeCodes] }
}

export function evaluateMagicEditGates(before: RenderManifestV2, after: RenderManifestV2): MagicEditGateResultsV1 {
  const passed = () => ({ status: 'passed' as const, codes: [] as string[] })
  const gate = (unchanged: boolean, code: string) => unchanged ? passed() : { status: 'blocked' as const, codes: [code] }
  const captionSemantics = (manifest: RenderManifestV2) => manifest.captions.map((caption) => ({ start_ms: caption.start_ms, end_ms: caption.end_ms, text: caption.text }))
  const sourceSemantics = (manifest: RenderManifestV2) => manifest.shot_directives.map((shot) => ({ source_id: shot.source_id, source_start_ms: shot.source_start_ms, source_end_ms: shot.source_end_ms, start_ms: shot.start_ms, end_ms: shot.end_ms, audio_continuity: shot.audio_continuity }))
  const confidentialitySemantics = (manifest: RenderManifestV2) => ({
    sources: manifest.sources,
    assets: manifest.assets,
    generated_shots: manifest.generated_shots,
    caption_provenance: manifest.caption_provenance,
    captions: captionSemantics(manifest),
    audio_plan: manifest.audio_plan,
    disclosures: manifest.disclosures,
    source_spans: manifest.shot_directives.map((shot) => ({
      source_id: shot.source_id,
      source_start_ms: shot.source_start_ms,
      source_end_ms: shot.source_end_ms,
      subject_track_ids: [...shot.subject_track_ids].sort(),
    })),
    referenced_layers: [...new Map(manifest.shot_directives.flatMap((shot) => shot.layers)
      .filter((layer) => layer.kind === 'source' || layer.kind === 'subject_cutout' || layer.kind === 'asset')
      .map((layer) => [`${layer.kind}:${layer.target_id ?? ''}:${layer.protected}`, { kind: layer.kind, target_id: layer.target_id, protected: layer.protected }])).values()]
      .sort((left, right) => `${left.kind}:${left.target_id ?? ''}`.localeCompare(`${right.kind}:${right.target_id ?? ''}`)),
  })
  return {
    truth: gate(hashValue(before.disclosures) === hashValue(after.disclosures), 'truth_boundary_changed'),
    rights: gate(hashValue(before.assets) === hashValue(after.assets) && hashValue(before.generated_shots) === hashValue(after.generated_shots), 'rights_ledger_changed'),
    confidentiality: gate(hashValue(confidentialitySemantics(before)) === hashValue(confidentialitySemantics(after)), 'source_bearing_content_changed'),
    transcript_fidelity: gate(hashValue(captionSemantics(before)) === hashValue(captionSemantics(after)) && hashValue(before.audio_plan) === hashValue(after.audio_plan) && hashValue(sourceSemantics(before)) === hashValue(sourceSemantics(after)), 'spoken_content_changed'),
    naming: gate(before.series === after.series && hashValue(before.branding) === hashValue(after.branding), 'canonical_naming_changed'),
  }
}

function preparedTreatmentIdentity(jobId: string, configHash: string, payload: TreatmentStagePayloadV2, intentHash: string, parentHash: string) {
  const inputHashes = { magic_intent: intentHash, parent_treatment: parentHash, manifests: hashValue(payload) }
  const toolVersions = { magic_edit: MAGIC_EDIT_VERSION }
  const artifactHash = stageArtifactSemanticHashV2({ schema_version: 2, job_id: jobId, stage: 'treatment', input_hashes: inputHashes, config_hash: configHash, tool_versions: toolVersions, payload })
  return { inputHashes, toolVersions, artifactHash }
}

export type PrepareMagicEditResult = MagicEditCompileResultV1 | MagicEditCandidateV1

export interface MagicEditMutationOptions {
  assertMutationAllowed?: () => void
  expectedCurrentCandidateHash?: string | null
}

export async function prepareMagicEditCandidate(jobId: string, directionInput: MagicEditDirectionV1, options: MagicEditMutationOptions = {}): Promise<PrepareMagicEditResult> {
  return withJobEventLock(jobId, async () => {
  const direction = MagicEditDirectionV1Schema.parse(directionInput)
  if (direction.job_id !== jobId) throw new Error('magic-edit direction belongs to a different job')
  const context = await treatmentContext(jobId, direction.platform)
  if (context.revisionHash !== direction.expected_parent_revision_hash || context.treatment.artifact_hash !== direction.expected_parent_artifact_hash) throw new Error('magic-edit direction is stale against the current job parent')
  if (!hasApprovalV2(context.job, 'treatment', context.treatment.artifact_hash, 'krish')) throw new Error('magic edits require the exact current treatment approval from Krish')
  const targetMap = await createMagicEditTargetMap(jobId, direction.platform)
  const compiled = compileMagicEditDirection(direction, targetMap)
  if (compiled.status === 'requires_editorial_route') {
    options.assertMutationAllowed?.()
    await recordJobEventOnceV2(jobId, 'magic_edit_intent_received', direction.direction_id, { intent_hash: compiled.intent_hash, status: compiled.status, reason_code: compiled.reason_code })
    return compiled
  }
  const intent = compiled.intent
  const changed = applyMagicEditOperations(context.manifest, targetMap, intent.operations)
  const gates = evaluateMagicEditGates(context.manifest, changed.manifest)
  const readiness = validateV2RenderReadiness(changed.manifest)
  const manifestDirectory = join(controlPlaneRoot(jobId), 'magic-edits', 'manifests')
  const manifestPath = join(manifestDirectory, `${compiled.intent_hash}.json`)
  options.assertMutationAllowed?.()
  await writeJsonAtomic(manifestPath, changed.manifest)
  const manifestHash = await hashFile(manifestPath)
  const preparedManifests = context.treatment.payload.manifests.map((item) => item.platform === intent.platform
    ? { platform: item.platform, manifest_path: manifestPath, manifest_hash: manifestHash }
    : item)
  const preparedPayload = { manifests: preparedManifests.sort((left, right) => left.platform.localeCompare(right.platform)) }
  const identity = preparedTreatmentIdentity(jobId, context.job.config_hash, preparedPayload, compiled.intent_hash, context.treatment.artifact_hash)
  const candidateCore = {
    schema_version: 1 as const,
    job_id: jobId,
    platform: intent.platform,
    intent_hash: compiled.intent_hash,
    expected_parent_revision_hash: context.revisionHash,
    expected_parent_artifact_hash: context.treatment.artifact_hash,
    semantic_target_map_hash: targetMap.semantic_target_map_hash,
    prepared_render_manifest_hash: manifestHash,
    prepared_treatment_artifact_hash: identity.artifactHash,
    prepared_treatment_payload: preparedPayload,
    operations: intent.operations,
    gates,
    change_codes: changed.changeCodes,
    invalidates: [...INVALIDATED_STAGES],
    hard_blocks: readiness,
    soft_blocks: [],
    preview: {},
  }
  const candidateHash = hashValue(candidateCore)
  const candidate = MagicEditCandidateV1Schema.parse({
    ...candidateCore,
    candidate_id: `magic-${candidateHash.slice(0, 16)}`,
    candidate_hash: candidateHash,
    created_at: new Date().toISOString(),
  })
  const candidatePath = join(controlPlaneRoot(jobId), 'magic-edits', 'candidates', `${candidateHash}.json`)
  let persistedCandidate = candidate
  try {
    const existing = MagicEditCandidateV1Schema.parse(await readJson(candidatePath))
    if (existing.candidate_hash !== candidateHash) throw new Error('stored magic-edit candidate does not match its expected hash')
    const { candidate_id: _id, candidate_hash: _hash, created_at: _created, ...existingCore } = existing
    if (hashValue(existingCore) !== candidateHash) throw new Error('stored magic-edit candidate content no longer matches its semantic hash')
    persistedCandidate = existing
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    options.assertMutationAllowed?.()
    await writeJsonAtomic(candidatePath, candidate)
  }
  options.assertMutationAllowed?.()
  await recordJobEventOnceV2(jobId, 'magic_edit_intent_received', direction.direction_id, { intent_hash: compiled.intent_hash, status: compiled.status, semantic_target_map_hash: targetMap.semantic_target_map_hash })
  options.assertMutationAllowed?.()
  await recordJobEventOnceV2(jobId, 'magic_edit_candidate_created', candidateHash, { candidate_hash: candidateHash, parent_artifact_hash: context.treatment.artifact_hash, prepared_treatment_artifact_hash: identity.artifactHash })
  return persistedCandidate
  })
}

export async function loadMagicEditCandidate(jobId: string, candidateHash: string): Promise<MagicEditCandidateV1> {
  if (!/^[a-f0-9]{64}$/.test(candidateHash)) throw new Error('invalid magic-edit candidate hash')
  const candidate = MagicEditCandidateV1Schema.parse(await readJson(join(controlPlaneRoot(jobId), 'magic-edits', 'candidates', `${candidateHash}.json`)))
  const { candidate_id: _id, candidate_hash: _hash, created_at: _created, ...core } = candidate
  if (candidate.candidate_hash !== hashValue(core)) throw new Error('magic-edit candidate content no longer matches its semantic hash')
  if (candidate.job_id !== jobId) throw new Error('magic-edit candidate belongs to a different job')
  return candidate
}

export interface MagicEditComparisonPreview {
  before_path: string
  before_hash: string
  after_path: string
  after_hash: string
  comparison_start_ms: number
  comparison_end_ms: number
}

export async function renderMagicEditComparisonPreview(repoRoot: string, jobId: string, candidateHash: string): Promise<MagicEditComparisonPreview> {
  const candidate = await loadMagicEditCandidate(jobId, candidateHash)
  const targetMap = verifyStoredTargetMap(await readJson(join(controlPlaneRoot(jobId), 'target-maps', `${candidate.semantic_target_map_hash}.json`)), candidate.semantic_target_map_hash)
  if (targetMap.semantic_target_map_hash !== candidate.semantic_target_map_hash
    || targetMap.expected_parent_revision_hash !== candidate.expected_parent_revision_hash
    || targetMap.expected_parent_artifact_hash !== candidate.expected_parent_artifact_hash) throw new Error('magic-edit preview target map does not match candidate lineage')
  const selectedTargets = candidate.operations.map((operation) => targetMap.targets.find((target) => target.target_id === operation.target_id))
  if (selectedTargets.some((target) => !target)) throw new Error('magic-edit preview target no longer exists')
  const rawStart = Math.max(0, Math.min(...selectedTargets.map((target) => target!.start_ms)) - 750)
  const rawEnd = Math.min(targetMap.duration_ms, Math.max(...selectedTargets.map((target) => target!.end_ms)) + 750)
  const maximumDuration = 12_000
  const comparisonStartMs = rawEnd - rawStart <= maximumDuration ? rawStart : Math.max(0, Math.floor((rawStart + rawEnd - maximumDuration) / 2))
  const comparisonEndMs = Math.min(targetMap.duration_ms, comparisonStartMs + Math.min(maximumDuration, rawEnd - rawStart))
  const parent = await readTreatmentArtifactByHash(jobId, candidate.expected_parent_artifact_hash)
  const beforeEntry = parent.payload.manifests.find((entry) => entry.platform === candidate.platform)
  const afterEntry = candidate.prepared_treatment_payload.manifests.find((entry) => entry.platform === candidate.platform)
  if (!beforeEntry || !afterEntry) throw new Error('magic-edit comparison is missing its exact platform manifest')
  if (await hashFile(resolve(beforeEntry.manifest_path)) !== beforeEntry.manifest_hash || await hashFile(resolve(afterEntry.manifest_path)) !== afterEntry.manifest_hash) throw new Error('magic-edit comparison manifest failed content verification')
  const beforeManifest = RenderManifestV2Schema.parse(await readJson(resolve(beforeEntry.manifest_path)))
  const afterManifest = RenderManifestV2Schema.parse(await readJson(resolve(afterEntry.manifest_path)))
  const previewOptions = { profile: 'preview' as const, previewStartMs: comparisonStartMs, previewDurationMs: comparisonEndMs - comparisonStartMs, previewScale: 0.25 as const }
  const beforePath = await renderStoryV2(repoRoot, beforeManifest, previewOptions)
  const afterPath = await renderStoryV2(repoRoot, afterManifest, previewOptions)
  return {
    before_path: beforePath,
    before_hash: await hashFile(beforePath),
    after_path: afterPath,
    after_hash: await hashFile(afterPath),
    comparison_start_ms: comparisonStartMs,
    comparison_end_ms: comparisonEndMs,
  }
}

export interface ActivatedMagicEdit {
  candidate_hash: string
  artifact_hash: string
  revision_hash: string
  invalidated_stages: Array<'render' | 'qa' | 'package'>
  local_event_id: string
}

export interface MagicEditActivationContext {
  expected_parent_revision_hash: string
  expected_parent_artifact_hash: string
  command_id: string
  command_hash: string
}

export async function activateMagicEditCandidate(jobId: string, activationInput: MagicEditActivationV1, activationContext: MagicEditActivationContext, options: MagicEditMutationOptions = {}): Promise<ActivatedMagicEdit> {
  return withJobEventLock(jobId, async () => {
  const activation = MagicEditActivationV1Schema.parse(activationInput)
  if (activation.job_id !== jobId) throw new Error('magic-edit activation belongs to a different job')
  const candidate = await loadMagicEditCandidate(jobId, activation.candidate_hash)
  if (activationContext.expected_parent_revision_hash !== candidate.expected_parent_revision_hash
    || activationContext.expected_parent_artifact_hash !== candidate.expected_parent_artifact_hash
    || activation.expected_parent_revision_hash !== candidate.expected_parent_revision_hash
    || activation.expected_parent_artifact_hash !== candidate.expected_parent_artifact_hash
    || activation.prepared_treatment_artifact_hash !== candidate.prepared_treatment_artifact_hash
    || activation.platform !== candidate.platform) throw new Error('magic-edit activation does not bind the exact prepared candidate lineage')
  const nonPassingGates = Object.entries(candidate.gates).filter(([, result]) => result.status !== 'passed').map(([gate]) => gate)
  if (nonPassingGates.length) throw new Error(`magic-edit candidate has non-passing gates: ${nonPassingGates.join(', ')}`)
  if (candidate.hard_blocks.length) throw new Error(`magic-edit candidate has hard blocks: ${candidate.hard_blocks.join('; ')}`)
  if (candidate.soft_blocks.length) throw new Error('magic-edit candidate soft blocks require the full editorial approval route')

  let job = await loadJobV2(jobId)
  const currentTreatmentHash = job.stages.treatment.artifact_hash
  if (currentTreatmentHash !== candidate.prepared_treatment_artifact_hash) {
    if (currentTreatmentHash !== candidate.expected_parent_artifact_hash || jobRevisionHashV2(job) !== candidate.expected_parent_revision_hash) throw new Error('magic-edit activation is stale against the current parent')
    const identity = preparedTreatmentIdentity(jobId, job.config_hash, candidate.prepared_treatment_payload, candidate.intent_hash, candidate.expected_parent_artifact_hash)
    if (identity.artifactHash !== candidate.prepared_treatment_artifact_hash) throw new Error('prepared magic-edit treatment no longer matches its content address')
    options.assertMutationAllowed?.()
    const artifact = await completeStageV2(jobId, 'treatment', candidate.prepared_treatment_payload, identity.inputHashes, identity.toolVersions)
    if (artifact.artifact_hash !== candidate.prepared_treatment_artifact_hash) throw new Error('activated treatment differs from the exact reviewed magic-edit candidate')
    job = await loadJobV2(jobId)
  }

  if (!hasApprovalV2(job, 'treatment', candidate.prepared_treatment_artifact_hash, 'krish')) {
    options.assertMutationAllowed?.()
    job = await recordApprovalV2(
      jobId,
      'treatment',
      'approved',
      candidate.prepared_treatment_artifact_hash,
      undefined,
      'krish',
      activation.confirmation_ref,
    )
  }
  options.assertMutationAllowed?.()
  const event = await recordJobEventOnceV2(jobId, 'magic_edit_activated', activation.activation_id, {
    activation_id: activation.activation_id,
    command_id: activationContext.command_id,
    command_hash: activationContext.command_hash,
    candidate_hash: candidate.candidate_hash,
    parent_artifact_hash: candidate.expected_parent_artifact_hash,
    artifact_hash: candidate.prepared_treatment_artifact_hash,
  })
  return {
    candidate_hash: candidate.candidate_hash,
    artifact_hash: candidate.prepared_treatment_artifact_hash,
    revision_hash: jobRevisionHashV2(job),
    invalidated_stages: [...INVALIDATED_STAGES],
    local_event_id: event.event_id,
  }
  })
}

export async function readTreatmentArtifactByHash(jobId: string, artifactHash: string): Promise<TreatmentArtifact> {
  const artifactPath = join(jobPath(jobId), 'artifacts', 'treatment', `${artifactHash}.json`)
  const artifact = StageArtifactV2Schema.parse(await readJson(artifactPath)) as TreatmentArtifact
  if (artifact.job_id !== jobId || artifact.stage !== 'treatment' || artifact.artifact_hash !== artifactHash || stageArtifactSemanticHashV2(artifact) !== artifactHash) throw new Error('stored parent treatment artifact failed content-address verification')
  return artifact
}

export interface ReturnedMagicEdit {
  artifact_hash: string
  revision_hash: string
  invalidated_stages: Array<'render' | 'qa' | 'package'>
  local_event_id: string
}

async function immediateParentCandidate(jobId: string, currentArtifactHash: string, target: MagicEditReturnToParentV1): Promise<MagicEditCandidateV1> {
  const directory = join(controlPlaneRoot(jobId), 'magic-edits', 'candidates')
  let names: string[]
  try { names = await readdir(directory) }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw new Error('magic-edit lineage does not contain the requested immediate parent')
    throw error
  }
  const matches: MagicEditCandidateV1[] = []
  for (const name of names.filter((candidate) => /^[a-f0-9]{64}\.json$/.test(candidate)).sort()) {
    const candidate = await loadMagicEditCandidate(jobId, name.slice(0, -5))
    if (candidate.prepared_treatment_artifact_hash === currentArtifactHash
      && candidate.expected_parent_artifact_hash === target.target_parent_artifact_hash
      && candidate.expected_parent_revision_hash === target.target_parent_revision_hash
      && candidate.platform === target.platform) matches.push(candidate)
  }
  if (matches.length !== 1) throw new Error('magic-edit lineage does not contain one exact immediate parent')
  return matches[0]!
}

export async function returnMagicEditToParent(
  jobId: string,
  expectedCurrentRevisionHash: string,
  expectedCurrentArtifactHash: string,
  targetInput: MagicEditReturnToParentV1,
  commandId: string,
  commandHash?: string,
  options: MagicEditMutationOptions = {},
): Promise<ReturnedMagicEdit> {
  return withJobEventLock(jobId, async () => {
  const target = MagicEditReturnToParentV1Schema.parse(targetInput)
  if (target.job_id !== jobId) throw new Error('magic-edit return belongs to a different job')
  if (target.expected_parent_revision_hash !== expectedCurrentRevisionHash || target.expected_parent_artifact_hash !== expectedCurrentArtifactHash) throw new Error('magic-edit return does not bind its exact current parent')
  const lineage = await immediateParentCandidate(jobId, expectedCurrentArtifactHash, target)
  if (options.expectedCurrentCandidateHash !== undefined && options.expectedCurrentCandidateHash !== lineage.candidate_hash) throw new Error('magic-edit return candidate lineage does not match the current command metadata')
  const parent = await readTreatmentArtifactByHash(jobId, target.target_parent_artifact_hash)
  let job = await loadJobV2(jobId)
  if (!hasApprovalV2(job, 'treatment', parent.artifact_hash, 'krish')) throw new Error('magic-edit return target no longer has its exact Krish approval')
  let restored = parent
  if (job.stages.treatment.artifact_hash === expectedCurrentArtifactHash) {
    if (jobRevisionHashV2(job) !== expectedCurrentRevisionHash) throw new Error('magic-edit return is stale against the exact current parent')
    options.assertMutationAllowed?.()
    restored = await completeStageV2(jobId, 'treatment', parent.payload, parent.input_hashes, parent.tool_versions) as TreatmentArtifact
    if (restored.artifact_hash !== parent.artifact_hash) throw new Error('magic-edit return target changed during content-addressed activation')
  } else if (job.stages.treatment.artifact_hash !== target.target_parent_artifact_hash) {
    throw new Error('magic-edit return is stale against the exact current parent')
  }
  job = await loadJobV2(jobId)
  options.assertMutationAllowed?.()
  const event = await recordJobEventOnceV2(jobId, 'magic_edit_activated', target.return_id, {
    action: 'return_to_parent',
    return_id: target.return_id,
    command_id: commandId,
    ...(commandHash ? { command_hash: commandHash } : {}),
    candidate_hash: lineage.candidate_hash,
    from_artifact_hash: expectedCurrentArtifactHash,
    artifact_hash: restored.artifact_hash,
  })
  return {
    artifact_hash: restored.artifact_hash,
    revision_hash: jobRevisionHashV2(job),
    invalidated_stages: [...INVALIDATED_STAGES],
    local_event_id: event.event_id,
  }
  })
}
