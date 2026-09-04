import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  AnalyticsObservationV1Schema,
  AnalyticsObservationV2Schema,
  CandidateV1Schema,
  ExperimentV1Schema,
  ExperimentV2Schema,
  RenderManifestV2Schema,
  SCHEMA_VERSION,
  type AnalyticsObservationV1,
  type AnalyticsObservationV2,
  type ExperimentV1,
  type ExperimentV2,
} from '@mindmake/contracts'
import { loadJob, readStageArtifact } from './job-store.js'
import { loadJobV2, readStageArtifactV2 } from './job-store-v2.js'
import { qualifiedActionsPerThousand, verifyFinalForAnalyticsV2 } from './analytics.js'
import { studioPaths } from './paths.js'
import { hashFile } from './hash.js'

const experimentPath = (): string => join(studioPaths().runtimeRoot, 'analytics', 'experiments.json')
const experimentV2Path = (): string => join(studioPaths().runtimeRoot, 'analytics', 'experiments-v2.json')

async function readExperiments(): Promise<ExperimentV1[]> {
  try { return ExperimentV1Schema.array().parse(JSON.parse(await readFile(experimentPath(), 'utf8'))) }
  catch { return [] }
}

async function saveExperiments(experiments: ExperimentV1[]): Promise<void> {
  await mkdir(dirname(experimentPath()), { recursive: true })
  await writeFile(experimentPath(), `${JSON.stringify(experiments, null, 2)}\n`, 'utf8')
}

export async function createExperiment(input: Omit<ExperimentV1, 'schema_version' | 'experiment_id' | 'status'>): Promise<ExperimentV1> {
  if (input.primary_variable.trim().split(',').length > 1) throw new Error('record one primary creative variable per experiment')
  const experiment = ExperimentV1Schema.parse({ ...input, schema_version: SCHEMA_VERSION, experiment_id: randomUUID(), status: 'planned' })
  const experiments = await readExperiments()
  experiments.push(experiment)
  await saveExperiments(experiments)
  return experiment
}

async function observations(): Promise<AnalyticsObservationV1[]> {
  try {
    return (await readFile(join(studioPaths().runtimeRoot, 'analytics', 'observations.jsonl'), 'utf8'))
      .split(/\r?\n/).filter(Boolean).map((line) => AnalyticsObservationV1Schema.parse(JSON.parse(line)))
  } catch { return [] }
}

function numericMetric(observation: AnalyticsObservationV1, metric: string): number | null {
  if (metric === 'qualified_actions_per_1000') return qualifiedActionsPerThousand(observation)
  const value = observation[metric as keyof AnalyticsObservationV1]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length
}

const EDITORIAL_GUARD_METRICS = [
  'semantic_coherence',
  'impact',
  'relevance',
  'insight',
  'specificity',
  'audience_value',
  'hook_strength',
  'ending_strength',
] as const

export type EditorialScores = Record<(typeof EDITORIAL_GUARD_METRICS)[number], number>

export interface EditorialGuardResult {
  status: 'passed' | 'degraded' | 'unavailable'
  degraded_metrics: string[]
  control_means: Partial<EditorialScores>
  treatment_means: Partial<EditorialScores>
}

export function assessEditorialGuard(control: EditorialScores[], treatment: EditorialScores[], metrics: readonly (keyof EditorialScores)[] = EDITORIAL_GUARD_METRICS): EditorialGuardResult {
  if (!control.length || !treatment.length) return { status: 'unavailable', degraded_metrics: [], control_means: {}, treatment_means: {} }
  const controlMeans: Partial<EditorialScores> = {}
  const treatmentMeans: Partial<EditorialScores> = {}
  const degraded: string[] = []
  for (const metric of metrics) {
    controlMeans[metric] = average(control.map((row) => row[metric]))
    treatmentMeans[metric] = average(treatment.map((row) => row[metric]))
    if ((treatmentMeans[metric] as number) < (controlMeans[metric] as number)) degraded.push(metric)
  }
  return {
    status: degraded.length ? 'degraded' : 'passed',
    degraded_metrics: degraded,
    control_means: controlMeans,
    treatment_means: treatmentMeans,
  }
}

async function editorialScoresForJob(jobId: string): Promise<EditorialScores | null> {
  try {
    const treatment = await readStageArtifact<{ candidate_path: string }>(jobId, 'treatment')
    const candidate = CandidateV1Schema.parse(JSON.parse(await readFile(treatment.payload.candidate_path, 'utf8')))
    if (!candidate.editorial) return null
    return candidate.editorial.scores
  } catch {
    return null
  }
}

async function comparisonCell(jobId: string): Promise<string> {
  const job = await loadJob(jobId)
  let durationBand = 'unknown'
  try {
    const qa = await readStageArtifact<{ checks: Array<{ name: string; detail: string }> }>(jobId, 'qa')
    const seconds = Number.parseFloat(qa.payload.checks.find((check) => check.name === 'duration')?.detail || '')
    if (Number.isFinite(seconds)) durationBand = seconds <= 30 ? '0-30' : seconds <= 60 ? '31-60' : '61+'
  } catch { /* A planned experiment may not have rendered jobs yet. */ }
  return `${job.series}:${job.mode}:${durationBand}`
}

export interface ExperimentEvaluation {
  experiment: ExperimentV1
  evidence_class: 'performance'
  eligible: boolean
  reason: string
  control_mean: number | null
  treatment_mean: number | null
  qualification_guard: 'passed' | 'degraded' | 'unavailable' | 'not_evaluated'
  editorial_guard: EditorialGuardResult
}

const emptyEditorialGuard = (): EditorialGuardResult => ({ status: 'unavailable', degraded_metrics: [], control_means: {}, treatment_means: {} })

export async function evaluateExperiment(experimentId: string): Promise<ExperimentEvaluation> {
  const experiments = await readExperiments()
  const index = experiments.findIndex((item) => item.experiment_id === experimentId)
  if (index < 0) throw new Error('experiment not found')
  const experiment = experiments[index] as ExperimentV1
  if (experiment.target_metric === 'views') return { experiment, evidence_class: 'performance', eligible: false, reason: 'views alone cannot make a performance rule eligible', control_mean: null, treatment_mean: null, qualification_guard: 'not_evaluated', editorial_guard: emptyEditorialGuard() }
  const allJobs = [...experiment.control_job_ids, ...experiment.treatment_job_ids]
  const cells = await Promise.all(allJobs.map(comparisonCell))
  if (new Set(cells).size !== 1) return { experiment, evidence_class: 'performance', eligible: false, reason: 'jobs are not comparable by series, source mode, and duration band', control_mean: null, treatment_mean: null, qualification_guard: 'not_evaluated', editorial_guard: emptyEditorialGuard() }
  const ledger = (await observations()).filter((item) => item.platform === experiment.platform)
  const controlRows = experiment.control_job_ids.map((jobId) => ledger.find((item) => item.job_id === jobId)).filter((item): item is AnalyticsObservationV1 => Boolean(item))
  const treatmentRows = experiment.treatment_job_ids.map((jobId) => ledger.find((item) => item.job_id === jobId)).filter((item): item is AnalyticsObservationV1 => Boolean(item))
  const controlValues = controlRows.map((item) => numericMetric(item, experiment.target_metric)).filter((item): item is number => item !== null)
  const treatmentValues = treatmentRows.map((item) => numericMetric(item, experiment.target_metric)).filter((item): item is number => item !== null)
  const controlMean = controlValues.length ? average(controlValues) : null
  const treatmentMean = treatmentValues.length ? average(treatmentValues) : null
  const controlQualification = controlRows.map(qualifiedActionsPerThousand).filter((item): item is number => item !== null)
  const treatmentQualification = treatmentRows.map(qualifiedActionsPerThousand).filter((item): item is number => item !== null)
  const qualificationDegraded = controlQualification.length > 0 && treatmentQualification.length > 0 && average(treatmentQualification) < average(controlQualification)
  const qualificationAvailable = controlQualification.length === experiment.control_job_ids.length && treatmentQualification.length === experiment.treatment_job_ids.length
  const controlEditorial = (await Promise.all(experiment.control_job_ids.map(editorialScoresForJob))).filter((item): item is EditorialScores => item !== null)
  const treatmentEditorial = (await Promise.all(experiment.treatment_job_ids.map(editorialScoresForJob))).filter((item): item is EditorialScores => item !== null)
  const editorialGuard = controlEditorial.length === experiment.control_job_ids.length && treatmentEditorial.length === experiment.treatment_job_ids.length
    ? assessEditorialGuard(controlEditorial, treatmentEditorial)
    : emptyEditorialGuard()
  const replicated = controlValues.length >= 3 && treatmentValues.length >= 3
  const directional = controlMean !== null && treatmentMean !== null && treatmentMean > controlMean
  const eligible = replicated && directional && qualificationAvailable && !qualificationDegraded && editorialGuard.status === 'passed'
  const updated = ExperimentV1Schema.parse({ ...experiment, status: eligible ? 'eligible' : 'running' })
  experiments[index] = updated
  await saveExperiments(experiments)
  return {
    experiment: updated,
    evidence_class: 'performance',
    eligible,
    reason: !replicated
      ? 'three comparable control and treatment observations are required'
      : !directional
        ? 'the treatment did not improve the primary metric'
        : !qualificationAvailable
          ? 'qualified-action evidence is unavailable for one or more comparable jobs'
          : qualificationDegraded
            ? 'the treatment degraded qualified action'
            : editorialGuard.status === 'unavailable'
              ? 'editorial evidence is unavailable for one or more comparable jobs'
              : editorialGuard.status === 'degraded'
                ? `the treatment degraded editorial quality: ${editorialGuard.degraded_metrics.join(', ')}`
                : 'three comparable tests improved the target without degrading qualification or editorial quality; user approval is still required',
    control_mean: controlMean,
    treatment_mean: treatmentMean,
    qualification_guard: qualificationDegraded ? 'degraded' : qualificationAvailable ? 'passed' : 'unavailable',
    editorial_guard: editorialGuard,
  }
}

export async function listExperiments(): Promise<ExperimentV1[]> {
  return readExperiments()
}

async function readExperimentsV2(): Promise<ExperimentV2[]> {
  try { return ExperimentV2Schema.array().parse(JSON.parse(await readFile(experimentV2Path(), 'utf8'))) }
  catch { return [] }
}

async function saveExperimentsV2(experiments: ExperimentV2[]): Promise<void> {
  await mkdir(dirname(experimentV2Path()), { recursive: true })
  await writeFile(experimentV2Path(), `${JSON.stringify(experiments, null, 2)}\n`, 'utf8')
}

export async function createExperimentV2(input: Omit<ExperimentV2, 'schema_version' | 'experiment_id' | 'status'>): Promise<ExperimentV2> {
  if (input.primary_variable.trim().split(',').length > 1) throw new Error('record one primary creative variable per experiment')
  const experiment = ExperimentV2Schema.parse({ ...input, schema_version: 2, experiment_id: randomUUID(), status: 'planned' })
  const experiments = await readExperimentsV2()
  experiments.push(experiment)
  await saveExperimentsV2(experiments)
  return experiment
}

export async function listExperimentsV2(): Promise<ExperimentV2[]> {
  return readExperimentsV2()
}

async function observationsV2(): Promise<AnalyticsObservationV2[]> {
  try {
    return (await readFile(join(studioPaths().runtimeRoot, 'analytics', 'observations-v2.jsonl'), 'utf8'))
      .split(/\r?\n/).filter(Boolean).map((line) => AnalyticsObservationV2Schema.parse(JSON.parse(line)))
  } catch {
    return []
  }
}

async function comparableEvidenceForJobV2(jobId: string, platform: ExperimentV2['platform'], observation: AnalyticsObservationV2): Promise<ComparablePerformanceEvidenceV2> {
  const job = await loadJobV2(jobId)
  if (observation.job_id !== jobId || observation.platform !== platform) throw new Error(`analytics observation does not match ${jobId}/${platform}`)
  await verifyFinalForAnalyticsV2(jobId, platform, observation.published_artifact_hash)
  const render = await readStageArtifactV2<{ renders: Array<{ platform: ExperimentV2['platform']; master_path: string; master_hash: string; manifest_path: string; manifest_hash: string }> }>(jobId, 'render')
  const rendered = render.payload.renders.find((item) => item.platform === platform)
  if (!rendered || await hashFile(rendered.manifest_path) !== rendered.manifest_hash) throw new Error(`current ${platform} render manifest is unavailable for ${jobId}`)
  const manifest = RenderManifestV2Schema.parse(JSON.parse(await readFile(rendered.manifest_path, 'utf8')))
  const candidates = await readStageArtifactV2<{ candidates: Array<{ candidate: unknown }> }>(jobId, 'candidates')
  const candidate = candidates.payload.candidates
    .map((item) => CandidateV1Schema.safeParse(item.candidate))
    .find((item) => item.success && item.data.candidate_id === manifest.candidate_id)
  if (!candidate?.success || !candidate.data.editorial) throw new Error(`approved editorial scores are unavailable for ${jobId}`)
  const durationBand = manifest.duration_ms <= 30_000 ? '0-30' : manifest.duration_ms <= 60_000 ? '31-60' : '61+'
  return {
    comparison_cell: `${job.series}:${job.mode}:${durationBand}:${platform}`,
    observation,
    editorial_scores: candidate.data.editorial.scores,
  }
}

export async function evaluateStoredExperimentV2(experimentId: string): Promise<PerformanceEvidenceEvaluationV2> {
  const experiments = await readExperimentsV2()
  const index = experiments.findIndex((item) => item.experiment_id === experimentId)
  if (index < 0) throw new Error('V2 experiment not found')
  const experiment = experiments[index]!
  if (experiment.status === 'approved' || experiment.status === 'rejected') throw new Error(`V2 experiment is already ${experiment.status}; create a new experiment for new evidence`)
  const ledger = await observationsV2()
  const latest = (jobId: string) => [...ledger].reverse().find((item) => item.job_id === jobId && item.platform === experiment.platform)
  const control = await Promise.all(experiment.control_job_ids.map(async (jobId) => {
    const observation = latest(jobId)
    if (!observation) throw new Error(`no ${experiment.platform} analytics observation is available for control job ${jobId}`)
    return comparableEvidenceForJobV2(jobId, experiment.platform, observation)
  }))
  const treatment = await Promise.all(experiment.treatment_job_ids.map(async (jobId) => {
    const observation = latest(jobId)
    if (!observation) throw new Error(`no ${experiment.platform} analytics observation is available for treatment job ${jobId}`)
    return comparableEvidenceForJobV2(jobId, experiment.platform, observation)
  }))
  const evaluated = evaluatePerformanceEvidenceV2(experiment, control, treatment)
  const updated = ExperimentV2Schema.parse({ ...experiment, status: evaluated.eligible ? 'eligible' : 'running' })
  experiments[index] = updated
  await saveExperimentsV2(experiments)
  return { ...evaluated, experiment: updated }
}

export interface ComparablePerformanceEvidenceV2 {
  comparison_cell: string
  observation: AnalyticsObservationV2
  editorial_scores: EditorialScores
}

export interface PerformanceEvidenceEvaluationV2 {
  evidence_class: 'performance'
  experiment: ExperimentV2
  eligible: boolean
  requires_user_approval: true
  reason: string
  control_mean: number | null
  treatment_mean: number | null
  qualification_guard: 'passed' | 'degraded' | 'unavailable' | 'not_evaluated'
  editorial_guard: EditorialGuardResult
}

function normalizedMetricPerThousand(observation: AnalyticsObservationV2, metric: 'qualified_actions' | 'utm_actions' | 'followers_gained'): number | null {
  const value = observation[metric]
  if (!observation.impressions || value === null) return null
  return (value / observation.impressions) * 1000
}

function v2NumericMetric(observation: AnalyticsObservationV2, metric: string): number | null {
  if (metric === 'qualified_actions_per_1000') return normalizedMetricPerThousand(observation, 'qualified_actions')
  if (metric === 'utm_actions_per_1000') return normalizedMetricPerThousand(observation, 'utm_actions')
  if (metric === 'followers_gained_per_1000') return normalizedMetricPerThousand(observation, 'followers_gained')
  const value = observation[metric as keyof AnalyticsObservationV2]
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function evaluatePerformanceEvidenceV2(
  experiment: ExperimentV2,
  control: ComparablePerformanceEvidenceV2[],
  treatment: ComparablePerformanceEvidenceV2[],
): PerformanceEvidenceEvaluationV2 {
  const base = { evidence_class: 'performance' as const, experiment, requires_user_approval: true as const }
  if (experiment.target_metric === 'views') return { ...base, eligible: false, reason: 'views alone cannot make a performance rule eligible', control_mean: null, treatment_mean: null, qualification_guard: 'not_evaluated', editorial_guard: emptyEditorialGuard() }
  const rows = [...control, ...treatment]
  const cells = new Set(rows.map((row) => row.comparison_cell))
  const platformMatches = rows.every((row) => row.observation.platform === experiment.platform)
  const exactControlJobs = new Set(control.map((row) => row.observation.job_id))
  const exactTreatmentJobs = new Set(treatment.map((row) => row.observation.job_id))
  const jobsMatch = experiment.control_job_ids.every((id) => exactControlJobs.has(id))
    && experiment.treatment_job_ids.every((id) => exactTreatmentJobs.has(id))
    && control.length === experiment.control_job_ids.length
    && treatment.length === experiment.treatment_job_ids.length
    && exactControlJobs.size === experiment.control_job_ids.length
    && exactTreatmentJobs.size === experiment.treatment_job_ids.length
  if (cells.size !== 1 || !platformMatches || !jobsMatch) return { ...base, eligible: false, reason: 'performance evidence must match the exact experiment jobs, platform, series, source mode, and duration cell', control_mean: null, treatment_mean: null, qualification_guard: 'not_evaluated', editorial_guard: emptyEditorialGuard() }

  const controlByJob = new Map(control.map((row) => [row.observation.job_id, row]))
  const treatmentByJob = new Map(treatment.map((row) => [row.observation.job_id, row]))
  const orderedControl = experiment.control_job_ids.map((id) => controlByJob.get(id)!)
  const orderedTreatment = experiment.treatment_job_ids.map((id) => treatmentByJob.get(id)!)
  const controlValues = orderedControl.map((row) => v2NumericMetric(row.observation, experiment.target_metric))
  const treatmentValues = orderedTreatment.map((row) => v2NumericMetric(row.observation, experiment.target_metric))
  const completeTarget = controlValues.every((value): value is number => value !== null) && treatmentValues.every((value): value is number => value !== null)
  const controlMean = completeTarget ? average(controlValues) : null
  const treatmentMean = completeTarget ? average(treatmentValues) : null
  const controlQualified = orderedControl.map((row) => normalizedMetricPerThousand(row.observation, experiment.qualified_guard_metric))
  const treatmentQualified = orderedTreatment.map((row) => normalizedMetricPerThousand(row.observation, experiment.qualified_guard_metric))
  const qualificationAvailable = controlQualified.every((value): value is number => value !== null) && treatmentQualified.every((value): value is number => value !== null)
  const qualificationDegraded = qualificationAvailable && average(treatmentQualified) < average(controlQualified)
  const editorialGuard = assessEditorialGuard(orderedControl.map((row) => row.editorial_scores), orderedTreatment.map((row) => row.editorial_scores), experiment.editorial_guard_metrics)
  const paired = orderedControl.length === orderedTreatment.length
  const replicated = paired && orderedControl.length >= 3
  const sameDirection = completeTarget && paired && treatmentValues.every((value, index) => value > controlValues[index]!)
  const eligible = replicated && completeTarget && sameDirection && qualificationAvailable && !qualificationDegraded && editorialGuard.status === 'passed'
  const reason = !replicated
    ? 'three ordered, comparable control and treatment pairs are required'
    : !completeTarget
      ? 'the target metric is unavailable for one or more comparable jobs'
      : !sameDirection
        ? 'every paired treatment must improve the primary metric; aggregate means cannot override a losing pair'
        : !qualificationAvailable
          ? 'the qualification guard is unavailable for one or more comparable jobs'
          : qualificationDegraded
            ? `the treatment degraded ${experiment.qualified_guard_metric} per 1,000 impressions`
            : editorialGuard.status === 'degraded'
              ? `the treatment degraded editorial quality: ${editorialGuard.degraded_metrics.join(', ')}`
              : 'three comparable paired tests improved in the same direction without degrading qualification or editorial quality; user approval is still required'
  return {
    ...base,
    eligible,
    reason,
    control_mean: controlMean,
    treatment_mean: treatmentMean,
    qualification_guard: qualificationDegraded ? 'degraded' : qualificationAvailable ? 'passed' : 'unavailable',
    editorial_guard: editorialGuard,
  }
}
