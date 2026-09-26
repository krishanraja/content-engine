import { readFile } from 'node:fs/promises'
import {
  ArtDirectorRepertoireV1Schema,
  VisualNarrativePlanV1Schema,
  type ArtDirectorRepertoireV1,
  type EditorialFormatV1,
  type PreferenceRuleV1,
  type SourceVisualAnalysisV1,
  type VisualNarrativePlanV1,
  sameSeriesLine,
} from '@mindmake/contracts'
import { hashFile } from './hash.js'
import { BUILT_WITH_AI_EDITORIAL_RULE_ID, MONEY_OF_AI_EDITORIAL_RULE_ID } from './editorial.js'
import { validateShortDeviceSelections } from './art-director.js'
import { solveVirtualCamera } from './virtual-camera.js'

export type TechniqueRegistryV1 = ArtDirectorRepertoireV1

export interface VisualPlanReview {
  passed: boolean
  hard_blocks: string[]
  soft_blocks: string[]
  confidence_fallbacks: string[]
  experimental_techniques: string[]
  requires_styleframes: boolean
  requires_animatic: boolean
}

export async function loadTechniqueRegistry(path: string): Promise<TechniqueRegistryV1> {
  return ArtDirectorRepertoireV1Schema.parse(JSON.parse(await readFile(path, 'utf8')))
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

function deviceImplementationIssues(plan: VisualNarrativePlanV1): string[] {
  const issues: string[] = []
  for (const shot of plan.shot_directives) {
    const ids = new Set(shot.technique_ids)
    if (ids.has('noun-to-proof-cut') && !shot.layers.some((layer) => layer.kind === 'asset' && layer.target_id)) {
      issues.push(`shot ${shot.shot_id} uses noun-to-proof-cut without an approved asset layer`)
    }
    if (ids.has('tracked-object-label') && !shot.layers.some((layer) => layer.kind === 'annotation' && layer.anchor === 'tracked_region' && (layer.tracking_keyframes?.length || 0) >= 2)) {
      issues.push(`shot ${shot.shot_id} uses tracked-object-label without ordered tracking keyframes on an annotation layer`)
    }
    if (ids.has('progressive-value-reveal')) {
      const reveals = shot.layers
        .filter((layer) => (layer.kind === 'annotation' || layer.kind === 'asset') && layer.visible_start_ms !== undefined)
        .map((layer) => layer.visible_start_ms!)
      if (new Set(reveals).size < 2) issues.push(`shot ${shot.shot_id} uses progressive-value-reveal without at least two staged reveal moments`)
    }
    if (ids.has('embodied-closing-action')) {
      const beat = plan.beats.find((item) => item.beat_id === shot.beat_id)
      if (!beat || !['payoff', 'ending'].includes(beat.narrative_function) || shot.end_ms < plan.duration_ms - 50) {
        issues.push(`shot ${shot.shot_id} uses embodied-closing-action outside the final payoff or ending beat`)
      }
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
  activePreferences?: PreferenceRuleV1[]
  preferenceContext?: { series: string; mode: string; jobId: string; editorialFormat?: EditorialFormatV1 }
  production?: boolean
  provenTreatment?: boolean
}

function activeEditorialStandards(input: ReviewVisualPlanInput): Set<string> {
  const context = input.preferenceContext
  if (!context) return new Set()
  return new Set((input.activePreferences || []).filter((rule) => {
    if (![MONEY_OF_AI_EDITORIAL_RULE_ID, BUILT_WITH_AI_EDITORIAL_RULE_ID].includes(rule.rule_id) || rule.status !== 'active') return false
    if (rule.scope.level === 'global') return true
    if (rule.scope.level === 'series') return sameSeriesLine(rule.scope.key, context.series)
    if (rule.scope.level === 'mode') return rule.scope.key === context.mode
    if (rule.scope.level === 'job') return rule.scope.key === context.jobId
    return false
  }).map((rule) => rule.rule_id))
}

function editorialStandardVisualIssues(plan: VisualNarrativePlanV1, input: ReviewVisualPlanInput, standards: Set<string>): string[] {
  const requirements = new Map(plan.asset_requirements.map((item) => [item.asset_id, item]))
  const openingEvidence = (deadlineMs: number) => plan.beats.some((beat) => {
    if (beat.start_ms >= deadlineMs) return false
    const placed = plan.shot_directives
      .filter((shot) => shot.beat_id === beat.beat_id)
      .flatMap((shot) => shot.layers)
      .filter((layer) => layer.kind === 'asset' && layer.target_id)
    return placed.some((layer) => ['evidence', 'owned_artifact'].includes(requirements.get(layer.target_id!)?.truth_role || ''))
  })
  const genericBrollBeats = plan.beats.filter((beat) => beat.proof_dependency || ['evidence', 'mechanism'].includes(beat.narrative_function)).filter((beat) => {
    const placed = plan.shot_directives
      .filter((shot) => shot.beat_id === beat.beat_id)
      .flatMap((shot) => shot.layers)
      .filter((layer) => layer.kind === 'asset' && layer.target_id)
    return placed.some((layer) => {
      const requirement = requirements.get(layer.target_id!)
      return requirement?.content_kind === 'licensed_b_roll' && requirement.truth_role !== 'evidence'
    })
  })
  const issues: string[] = []
  if (standards.has(MONEY_OF_AI_EDITORIAL_RULE_ID) && !openingEvidence(5_000)) issues.push('The Money of AI standard expects a sourced receipt or artifact in the first five seconds')
  const builtArtifactLed = standards.has(BUILT_WITH_AI_EDITORIAL_RULE_ID) && ['build_itself', 'first_version'].includes(input.preferenceContext?.editorialFormat || '')
  if (builtArtifactLed && !openingEvidence(8_000)) issues.push(`${input.preferenceContext?.editorialFormat} expects a concrete build or artifact in the first eight seconds`)
  if (genericBrollBeats.length) issues.push(`confirmed editorial standard rejects generic licensed B-roll as proof in beats: ${genericBrollBeats.map((beat) => beat.beat_id).join(', ')}`)
  return issues
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
  if (input.production === true && input.techniqueRegistry.version >= 2 && plan.device_selection_traces.length !== plan.beats.length) {
    hardBlocks.push('production visual plans require one deterministic device selection trace per beat')
  }
  if (plan.device_selection_traces.length) {
    hardBlocks.push(...validateShortDeviceSelections(input.techniqueRegistry, plan.device_selection_traces))
    if (plan.device_selection_traces.some((trace) => trace.invention) && plan.treatment_lane !== 'experimental') hardBlocks.push('invented devices require the experimental treatment lane')
    const beatIds = new Set(plan.beats.map((beat) => beat.beat_id))
    const tracedBeatIds = plan.device_selection_traces.map((trace) => trace.beat_id)
    if (new Set(tracedBeatIds).size !== tracedBeatIds.length) hardBlocks.push('device selection traces must bind unique beats')
    for (const trace of plan.device_selection_traces) {
      if (!beatIds.has(trace.beat_id)) hardBlocks.push(`device selection trace ${trace.trace_id} references an unknown beat`)
      if (trace.registry_id !== input.techniqueRegistry.registry_id || trace.registry_version !== input.techniqueRegistry.version) hardBlocks.push(`device selection trace ${trace.trace_id} references a different technique registry`)
      if (trace.registry_hash && trace.registry_hash !== input.techniqueRegistryHash) hardBlocks.push(`device selection trace ${trace.trace_id} references a different technique registry hash`)
      if (input.production === true && !trace.registry_hash) hardBlocks.push(`production device selection trace ${trace.trace_id} is missing its registry hash`)
      const placed = new Set(plan.shot_directives.filter((shot) => shot.beat_id === trace.beat_id).flatMap((shot) => shot.technique_ids))
      for (const selected of [trace.selected_primary, ...trace.selected_support].filter((id): id is string => Boolean(id))) {
        if (!placed.has(selected)) hardBlocks.push(`device selection trace ${trace.trace_id} selected ${selected} but no shot for its beat uses it`)
      }
    }
  }
  const usedIds = [...new Set(plan.shot_directives.flatMap((shot) => shot.technique_ids))]
  const unknown = usedIds.filter((id) => !techniques.has(id))
  if (unknown.length) hardBlocks.push(`unknown visual techniques: ${unknown.join(', ')}`)
  hardBlocks.push(...deviceImplementationIssues(plan))
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
  const editorialStandards = activeEditorialStandards(input)
  if (editorialStandards.size) softBlocks.push(...editorialStandardVisualIssues(plan, input, editorialStandards))
  for (const fallback of input.analysis.capabilities.fallbacks) fallbacks.add(fallback)

  const hasInvention = plan.device_selection_traces.some((trace) => trace.invention)
  const requiresStyleframes = !input.provenTreatment || plan.treatment_lane !== 'restrained' || experimental.length > 0 || hasInvention
  const requiresAnimatic = plan.treatment_lane !== 'restrained' || experimental.length > 0 || hasInvention || !input.provenTreatment
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
