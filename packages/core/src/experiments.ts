import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { AnalyticsObservationV1Schema, ExperimentV1Schema, SCHEMA_VERSION, type AnalyticsObservationV1, type ExperimentV1 } from '@mindmake/contracts'
import { loadJob, readStageArtifact } from './job-store.js'
import { qualifiedActionsPerThousand } from './analytics.js'
import { studioPaths } from './paths.js'

const experimentPath = (): string => join(studioPaths().runtimeRoot, 'analytics', 'experiments.json')

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

export async function evaluateExperiment(experimentId: string): Promise<{ experiment: ExperimentV1; eligible: boolean; reason: string; control_mean: number | null; treatment_mean: number | null; qualification_guard: string }> {
  const experiments = await readExperiments()
  const index = experiments.findIndex((item) => item.experiment_id === experimentId)
  if (index < 0) throw new Error('experiment not found')
  const experiment = experiments[index] as ExperimentV1
  if (experiment.target_metric === 'views') return { experiment, eligible: false, reason: 'views alone cannot make a performance rule eligible', control_mean: null, treatment_mean: null, qualification_guard: 'not_evaluated' }
  const allJobs = [...experiment.control_job_ids, ...experiment.treatment_job_ids]
  const cells = await Promise.all(allJobs.map(comparisonCell))
  if (new Set(cells).size !== 1) return { experiment, eligible: false, reason: 'jobs are not comparable by series, source mode, and duration band', control_mean: null, treatment_mean: null, qualification_guard: 'not_evaluated' }
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
  const replicated = controlValues.length >= 3 && treatmentValues.length >= 3
  const directional = controlMean !== null && treatmentMean !== null && treatmentMean > controlMean
  const eligible = replicated && directional && !qualificationDegraded
  const updated = ExperimentV1Schema.parse({ ...experiment, status: eligible ? 'eligible' : 'running' })
  experiments[index] = updated
  await saveExperiments(experiments)
  return {
    experiment: updated,
    eligible,
    reason: !replicated ? 'three comparable control and treatment observations are required' : !directional ? 'the treatment did not improve the primary metric' : qualificationDegraded ? 'the treatment degraded qualified action' : 'three comparable tests improved the target without degrading qualification; user approval is still required',
    control_mean: controlMean,
    treatment_mean: treatmentMean,
    qualification_guard: qualificationDegraded ? 'degraded' : controlQualification.length && treatmentQualification.length ? 'passed' : 'unavailable',
  }
}

export async function listExperiments(): Promise<ExperimentV1[]> {
  return readExperiments()
}
