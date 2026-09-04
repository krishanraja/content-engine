import { readFile } from 'node:fs/promises'
import {
  VisualNarrativePlanV1Schema,
  type SourceVisualAnalysisV1,
  type VisualNarrativePlanV1,
} from '@mindmake/contracts'
import { hashFile } from './hash.js'
import { solveVirtualCamera } from './virtual-camera.js'

export interface TechniqueDefinitionV1 {
  technique_id: string
  version: number
  name: string
  purpose: string
  required_inputs: string[]
  parameters: string[]
  accessibility: string[]
  cost_class: 'local' | 'hybrid' | 'cloud_optional'
  fallback: string
  experimental: boolean
  signature: boolean
}

export interface TechniqueRegistryV1 {
  schema_version: 1
  registry_id: string
  version: number
  principle: string
  techniques: TechniqueDefinitionV1[]
}

export interface VisualPlanReview {
  passed: boolean
  hard_blocks: string[]
  soft_blocks: string[]
  confidence_fallbacks: string[]
  experimental_techniques: string[]
  requires_styleframes: boolean
  requires_animatic: boolean
}

function assertString(value: unknown, name: string): asserts value is string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} must be a non-empty string`)
}

export async function loadTechniqueRegistry(path: string): Promise<TechniqueRegistryV1> {
  const value = JSON.parse(await readFile(path, 'utf8')) as Partial<TechniqueRegistryV1>
  if (value.schema_version !== 1 || !Array.isArray(value.techniques)) throw new Error('unsupported technique registry')
  assertString(value.registry_id, 'registry_id')
  assertString(value.principle, 'principle')
  if (!Number.isInteger(value.version) || Number(value.version) < 1) throw new Error('technique registry version must be positive')
  const ids = new Set<string>()
  for (const technique of value.techniques) {
    assertString(technique.technique_id, 'technique_id')
    assertString(technique.name, 'technique name')
    assertString(technique.purpose, 'technique purpose')
    assertString(technique.fallback, 'technique fallback')
    if (ids.has(technique.technique_id)) throw new Error(`duplicate technique ID ${technique.technique_id}`)
    ids.add(technique.technique_id)
  }
  return value as TechniqueRegistryV1
}

function intersectionArea(left: { x: number; y: number; width: number; height: number }, right: { x: number; y: number; width: number; height: number }): number {
  const width = Math.max(0, Math.min(left.x + left.width, right.x + right.width) - Math.max(left.x, right.x))
  const height = Math.max(0, Math.min(left.y + left.height, right.y + right.height) - Math.max(left.y, right.y))
  return width * height
}

function attentionCollisionIssues(plan: VisualNarrativePlanV1, analysis: SourceVisualAnalysisV1): string[] {
  const issues: string[] = []
  for (const shot of plan.shot_directives) {
    const midpoint = shot.start_ms + (shot.end_ms - shot.start_ms) / 2
    const protectedRegions = analysis.protected_regions.filter((region) => region.source_id === shot.source_id && region.start_ms <= midpoint && region.end_ms >= midpoint)
    for (const layer of shot.layers.filter((item) => item.kind === 'asset' || item.kind === 'annotation')) {
      if (!layer.bounds) continue
      const collisions = protectedRegions.filter((region) => intersectionArea(layer.bounds!, region.bounds) > Math.min(layer.bounds!.width * layer.bounds!.height, region.bounds.width * region.bounds.height) * 0.08)
      if (collisions.length && shot.primary_attention_target.kind === 'presenter') issues.push(`shot ${shot.shot_id} places ${layer.layer_id} over protected presenter space`)
    }
  }
  return issues
}

export interface ReviewVisualPlanInput {
  plan: unknown
  analysis: SourceVisualAnalysisV1
  sourceAnalysisArtifactHash: string
  candidateHash: string
  claimsArtifactHash: string
  techniqueRegistry: TechniqueRegistryV1
  techniqueRegistryHash: string
  preferenceSnapshotHash: string
  production?: boolean
  provenTreatment?: boolean
}

export function reviewVisualPlan(input: ReviewVisualPlanInput): { plan: VisualNarrativePlanV1; review: VisualPlanReview } {
  const plan = VisualNarrativePlanV1Schema.parse(input.plan)
  const hardBlocks: string[] = []
  const softBlocks: string[] = []
  const fallbacks = new Set<string>()
  if (plan.source_analysis_artifact_hash !== input.sourceAnalysisArtifactHash) hardBlocks.push('visual plan is not bound to the supplied source analysis artifact')
  if (plan.candidate_hash !== input.candidateHash) hardBlocks.push('visual plan is not bound to the exact candidate')
  if (plan.claims_artifact_hash !== input.claimsArtifactHash) hardBlocks.push('visual plan is not bound to the exact claim ledger')
  if (plan.technique_registry_hash !== input.techniqueRegistryHash) hardBlocks.push('visual plan is not bound to the pinned technique registry')
  if (plan.preference_snapshot_hash !== input.preferenceSnapshotHash) hardBlocks.push('visual plan is not bound to the pinned preference snapshot')

  const techniques = new Map(input.techniqueRegistry.techniques.map((technique) => [technique.technique_id, technique]))
  const usedIds = [...new Set(plan.shot_directives.flatMap((shot) => shot.technique_ids))]
  const unknown = usedIds.filter((id) => !techniques.has(id))
  if (unknown.length) hardBlocks.push(`unknown visual techniques: ${unknown.join(', ')}`)
  const experimental = usedIds.filter((id) => techniques.get(id)?.experimental)
  if (experimental.length > 1) hardBlocks.push('experimental lane permits one principal unproven hero technique per Short')
  if (experimental.length && plan.treatment_lane !== 'experimental') hardBlocks.push('experimental techniques require the experimental treatment lane')

  const sourceIds = new Set(input.analysis.sources.map((source) => source.source_id))
  const trackIds = new Set(input.analysis.subjects.map((subject) => subject.track_id))
  const protectedIds = new Set(input.analysis.protected_regions.map((region) => region.region_id))
  for (const shot of plan.shot_directives) {
    if (!sourceIds.has(shot.source_id)) hardBlocks.push(`shot ${shot.shot_id} references an unknown source`)
    for (const trackId of shot.subject_track_ids) if (!trackIds.has(trackId)) hardBlocks.push(`shot ${shot.shot_id} references unknown subject ${trackId}`)
    for (const regionId of shot.camera_plan.protected_region_ids) if (!protectedIds.has(regionId)) hardBlocks.push(`shot ${shot.shot_id} references unknown protected region ${regionId}`)
    if (shot.camera_plan.confidence < 0.58) fallbacks.add(shot.camera_plan.fallback)
    if (shot.layers.length > 6) softBlocks.push(`shot ${shot.shot_id} has ${shot.layers.length} simultaneous layers and may overload the viewer`)
  }

  for (const beat of plan.beats) {
    if (beat.proof_dependency && !beat.claim_ids.length) hardBlocks.push(`beat ${beat.beat_id} needs proof but is not linked to a claim`)
    if (beat.proof_dependency) {
      const placedAssetIds = new Set(
        plan.shot_directives
          .filter((shot) => shot.beat_id === beat.beat_id)
          .flatMap((shot) => shot.layers)
          .filter((layer) => layer.kind === 'asset' && layer.target_id)
          .map((layer) => layer.target_id!),
      )
      for (const claimId of new Set(beat.claim_ids)) {
        const evidenceRequirements = plan.asset_requirements.filter(
          (requirement) => requirement.required && requirement.truth_role === 'evidence' && requirement.claim_ids.includes(claimId),
        )
        if (!evidenceRequirements.length) {
          hardBlocks.push(`beat ${beat.beat_id} claim ${claimId} needs proof but has no required evidence asset requirement`)
          continue
        }
        if (!evidenceRequirements.some((requirement) => placedAssetIds.has(requirement.asset_id))) {
          hardBlocks.push(`beat ${beat.beat_id} claim ${claimId} needs proof but no matching evidence asset is placed in a shot for that beat`)
        }
      }
    }
    if (beat.visual_density === 'high' && beat.end_ms - beat.start_ms < 1200) softBlocks.push(`beat ${beat.beat_id} is too brief for its declared high visual density`)
  }
  for (let index = 1; index < plan.beats.length; index += 1) {
    if (plan.beats[index - 1]?.visual_density === 'high' && plan.beats[index]?.visual_density === 'high') softBlocks.push(`beats ${plan.beats[index - 1]!.beat_id} and ${plan.beats[index]!.beat_id} need a visual rest or a deliberate collision experiment`)
  }
  softBlocks.push(...attentionCollisionIssues(plan, input.analysis))
  if (input.production !== false && (plan.duration_ms < 20_000 || plan.duration_ms > 60_000)) softBlocks.push('story duration falls outside the normal 20 to 60 second range and needs a recorded editorial reason')
  for (const issue of input.analysis.quality_issues.filter((item) => item.severity === 'block')) hardBlocks.push(issue.detail)
  for (const fallback of input.analysis.capabilities.fallbacks) fallbacks.add(fallback)

  const requiresStyleframes = !input.provenTreatment || plan.treatment_lane !== 'restrained' || experimental.length > 0
  const requiresAnimatic = plan.treatment_lane !== 'restrained' || experimental.length > 0 || !input.provenTreatment
  return {
    plan,
    review: {
      passed: hardBlocks.length === 0 && softBlocks.length === 0,
      hard_blocks: [...new Set(hardBlocks)],
      soft_blocks: [...new Set(softBlocks)],
      confidence_fallbacks: [...fallbacks],
      experimental_techniques: experimental,
      requires_styleframes: requiresStyleframes,
      requires_animatic: requiresAnimatic,
    },
  }
}

export function solveVisualPlanCameras(planInput: VisualNarrativePlanV1, analysis: SourceVisualAnalysisV1): VisualNarrativePlanV1 {
  const plan = VisualNarrativePlanV1Schema.parse(planInput)
  return VisualNarrativePlanV1Schema.parse({
    ...plan,
    shot_directives: plan.shot_directives.map((shot) => {
      const beat = plan.beats.find((item) => item.beat_id === shot.beat_id)
      if (!beat) return shot
      const solution = solveVirtualCamera({ analysis, beat, sourceId: shot.source_id, subjectTrackIds: shot.subject_track_ids })
      return {
        ...shot,
        subject_track_ids: solution.subject_track_ids.length ? solution.subject_track_ids : shot.subject_track_ids,
        camera_plan: {
          ...shot.camera_plan,
          subject_track_ids: solution.subject_track_ids.length ? solution.subject_track_ids : shot.camera_plan.subject_track_ids,
          keyframes: solution.keyframes,
          confidence: solution.confidence,
          lead_room: solution.lead_room,
          fallback: solution.rationale.join(' '),
        },
      }
    }),
  })
}

export async function verifyVisualAssets(planInput: VisualNarrativePlanV1): Promise<{ passed: boolean; hard_blocks: string[]; verified_hashes: string[] }> {
  const plan = VisualNarrativePlanV1Schema.parse(planInput)
  const hardBlocks: string[] = []
  const hashes: string[] = []
  const assets = new Map(plan.resolved_assets.map((asset) => [asset.asset_id, asset]))
  for (const requirement of plan.asset_requirements) {
    const asset = assets.get(requirement.asset_id)
    if (requirement.required && !asset) {
      hardBlocks.push(`required asset ${requirement.asset_id} is unresolved`)
      continue
    }
    if (!asset) continue
    try {
      const actual = await hashFile(asset.path)
      hashes.push(actual)
      if (actual !== asset.sha256) hardBlocks.push(`asset ${asset.asset_id} changed after planning`)
      if (asset.approval.state !== 'approved' || asset.approval.artifact_hash !== actual || asset.approval.approved_by !== 'Krish') hardBlocks.push(`asset ${asset.asset_id} lacks exact Krish approval for ${actual}`)
    } catch {
      hardBlocks.push(`asset ${asset.asset_id} is missing or unreadable`)
    }
  }
  for (const asset of plan.resolved_assets) {
    if (asset.generated && asset.truth_role === 'evidence') hardBlocks.push(`generated asset ${asset.asset_id} cannot be evidence`)
  }
  return { passed: hardBlocks.length === 0, hard_blocks: [...new Set(hardBlocks)], verified_hashes: [...new Set(hashes)] }
}
