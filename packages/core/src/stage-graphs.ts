import type { SourceMode, StageName, StageNameV2 } from '@mindmake/contracts'

export const V1_STAGE_ORDER = [
  'brief', 'script', 'recording_brief', 'ingest', 'normalize', 'transcript', 'candidates', 'claims', 'treatment', 'render', 'qa', 'package',
] as const satisfies readonly StageName[]

export const V2_STAGE_ORDER = [
  'brief', 'script', 'recording_brief', 'ingest', 'normalize', 'transcript', 'source_analysis', 'candidates', 'claims', 'visual_plan', 'assets', 'styleframes', 'animatic', 'treatment', 'render', 'qa', 'package',
] as const satisfies readonly StageNameV2[]

export const V2_SHORT_NATIVE_STAGE_ORDER = [
  'brief', 'script', 'candidates', 'claims', 'recording_brief', 'ingest', 'normalize', 'transcript', 'source_analysis', 'visual_plan', 'assets', 'styleframes', 'animatic', 'treatment', 'render', 'qa', 'package',
] as const satisfies readonly StageNameV2[]

const V1_DESCENDANTS: Record<StageName, readonly StageName[]> = {
  brief: ['script', 'recording_brief', 'ingest', 'normalize', 'transcript', 'candidates', 'claims', 'treatment', 'render', 'qa', 'package'],
  script: ['recording_brief', 'ingest', 'normalize', 'transcript', 'candidates', 'claims', 'treatment', 'render', 'qa', 'package'],
  recording_brief: ['ingest', 'normalize', 'transcript', 'candidates', 'claims', 'treatment', 'render', 'qa', 'package'],
  ingest: ['normalize', 'transcript', 'candidates', 'claims', 'treatment', 'render', 'qa', 'package'],
  normalize: ['transcript', 'candidates', 'claims', 'treatment', 'render', 'qa', 'package'],
  transcript: ['candidates', 'claims', 'treatment', 'render', 'qa', 'package'],
  candidates: ['claims', 'treatment', 'render', 'qa', 'package'],
  claims: ['treatment', 'render', 'qa', 'package'],
  treatment: ['render', 'qa', 'package'],
  render: ['qa', 'package'],
  qa: ['package'],
  package: [],
}

export function v1DescendantsFor(stage: StageName, mode: SourceMode): StageName[] {
  if (mode !== 'short_native') return [...V1_DESCENDANTS[stage]]
  if (stage === 'ingest') return ['normalize', 'transcript', 'treatment', 'render', 'qa', 'package']
  if (stage === 'normalize') return ['transcript', 'treatment', 'render', 'qa', 'package']
  if (stage === 'transcript') return ['treatment', 'render', 'qa', 'package']
  return [...V1_DESCENDANTS[stage]]
}

export function v2StageOrder(mode: SourceMode): readonly StageNameV2[] {
  return mode === 'short_native' ? V2_SHORT_NATIVE_STAGE_ORDER : V2_STAGE_ORDER
}

function v2PrerequisiteMap(mode: SourceMode): Record<StageNameV2, readonly StageNameV2[]> {
  const common: Record<StageNameV2, readonly StageNameV2[]> = {
    brief: [], script: ['brief'], recording_brief: ['script'], ingest: [], normalize: ['ingest'], transcript: ['normalize'], source_analysis: ['normalize'], candidates: ['transcript'], claims: ['candidates'], visual_plan: ['source_analysis', 'candidates', 'claims'], assets: ['visual_plan'], styleframes: ['visual_plan', 'assets'], animatic: ['styleframes'], treatment: ['animatic'], render: ['treatment'], qa: ['render'], package: ['qa'],
  }
  if (mode !== 'short_native') return common
  return { ...common, candidates: ['script'], claims: ['candidates'], recording_brief: ['candidates', 'claims'], ingest: ['recording_brief'], visual_plan: ['transcript', 'source_analysis', 'candidates', 'claims'] }
}

export function v2PrerequisitesFor(stage: StageNameV2, mode: SourceMode): StageNameV2[] {
  return [...v2PrerequisiteMap(mode)[stage]]
}

export function v2DescendantsFor(stage: StageNameV2, mode: SourceMode): StageNameV2[] {
  const prerequisites = v2PrerequisiteMap(mode)
  const descendants = new Set<StageNameV2>()
  const queue: StageNameV2[] = [stage]
  while (queue.length) {
    const parent = queue.shift()!
    for (const candidate of v2StageOrder(mode)) {
      if (descendants.has(candidate) || !prerequisites[candidate].includes(parent)) continue
      descendants.add(candidate)
      queue.push(candidate)
    }
  }
  return v2StageOrder(mode).filter((candidate) => descendants.has(candidate))
}

export type RunnableStageStatus = 'pending' | 'running' | 'complete' | 'blocked' | 'invalidated' | 'skipped'

export function v2RunnableStages(states: Partial<Record<StageNameV2, { status: RunnableStageStatus }>>, mode: SourceMode): StageNameV2[] {
  return v2StageOrder(mode).filter((stage) => {
    const state = states[stage]
    if (!state || (state.status !== 'pending' && state.status !== 'invalidated')) return false
    return v2PrerequisitesFor(stage, mode).every((dependency) => {
      const status = states[dependency]?.status
      return status === 'complete' || status === 'skipped'
    })
  })
}
