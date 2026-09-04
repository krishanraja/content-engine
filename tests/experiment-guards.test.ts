import { describe, expect, it } from 'vitest'
import { AnalyticsObservationV2Schema, ExperimentV2Schema } from '@mindmake/contracts'
import { assessEditorialGuard, evaluatePerformanceEvidenceV2 } from '@mindmake/core'

const scores = (overrides: Partial<Record<'semantic_coherence' | 'impact' | 'relevance' | 'insight' | 'specificity' | 'audience_value' | 'hook_strength' | 'ending_strength', number>> = {}) => ({
  semantic_coherence: 0.9,
  impact: 0.8,
  relevance: 0.9,
  insight: 0.85,
  specificity: 0.8,
  audience_value: 0.9,
  hook_strength: 0.8,
  ending_strength: 0.85,
  ...overrides,
})

describe('performance evidence editorial guard', () => {
  it('requires unique, disjoint control and treatment jobs', () => {
    const base = {
      schema_version: 2 as const,
      experiment_id: '00000000-0000-4000-8000-000000000009',
      hypothesis: 'A stronger proof beat improves completion.',
      primary_variable: 'proof timing',
      control_job_ids: ['job-one'],
      treatment_job_ids: ['job-one'],
      platform: 'youtube_shorts' as const,
      target_metric: 'completion_rate',
      editorial_guard_metrics: ['semantic_coherence' as const],
      qualified_guard_metric: 'qualified_actions' as const,
      confounds: [],
      status: 'planned' as const,
    }
    expect(() => ExperimentV2Schema.parse(base)).toThrow('control and treatment jobs must be disjoint')
    expect(() => ExperimentV2Schema.parse({ ...base, control_job_ids: ['job-one', 'job-one'], treatment_job_ids: ['job-two'] })).toThrow('control jobs must be unique')
  })

  it('blocks a performance win that degrades any editorial quality dimension', () => {
    const result = assessEditorialGuard([scores(), scores()], [scores(), scores({ insight: 0.6 })])
    expect(result.status).toBe('degraded')
    expect(result.degraded_metrics).toContain('insight')
  })

  it('passes only when every tracked editorial dimension is maintained', () => {
    const result = assessEditorialGuard([scores()], [scores({ impact: 0.9, hook_strength: 0.9 })])
    expect(result.status).toBe('passed')
    expect(result.degraded_metrics).toEqual([])
  })

  it('keeps performance evidence separate and blocks eligibility when editorial quality degrades', () => {
    const controlIds = ['control-1', 'control-2', 'control-3']
    const treatmentIds = ['treatment-1', 'treatment-2', 'treatment-3']
    const experiment = ExperimentV2Schema.parse({
      schema_version: 2,
      experiment_id: '00000000-0000-4000-8000-000000000001',
      hypothesis: 'A faster proof beat will increase completion.',
      primary_variable: 'proof timing',
      control_job_ids: controlIds,
      treatment_job_ids: treatmentIds,
      platform: 'youtube_shorts',
      target_metric: 'completion_rate',
      editorial_guard_metrics: ['semantic_coherence', 'insight', 'ending_strength'],
      qualified_guard_metric: 'qualified_actions',
      confounds: [],
      status: 'running',
    })
    const observation = (jobId: string, completion: number) => AnalyticsObservationV2Schema.parse({
      schema_version: 2,
      observation_id: crypto.randomUUID(),
      job_id: jobId,
      platform: 'youtube_shorts',
      impressions: 1000,
      views: 800,
      viewed_vs_swiped: 70,
      early_hold_rate: 68,
      average_view_duration_seconds: 25,
      average_percentage_viewed: 75,
      completion_rate: completion,
      rewatch_rate: 5,
      shares: 12,
      saves: 14,
      comments: 8,
      substantive_comments: 3,
      comment_quality: 0.8,
      followers_gained: 5,
      qualified_actions: 10,
      utm_actions: 2,
      published_artifact_hash: 'a'.repeat(64),
      source_file_hash: 'b'.repeat(64),
    })
    const control = controlIds.map((jobId) => ({ comparison_cell: 'money_of_ai:solo:0-30', observation: observation(jobId, 60), editorial_scores: scores() }))
    const treatment = treatmentIds.map((jobId, index) => ({ comparison_cell: 'money_of_ai:solo:0-30', observation: observation(jobId, 72), editorial_scores: scores(index === 0 ? { insight: 0.6 } : {}) }))
    const result = evaluatePerformanceEvidenceV2(experiment, control, treatment)
    expect(result.evidence_class).toBe('performance')
    expect(result.eligible).toBe(false)
    expect(result.editorial_guard.status).toBe('degraded')
    expect(result.requires_user_approval).toBe(true)
  })

  it('requires every ordered pair to improve instead of allowing one outlier to carry the mean', () => {
    const controlIds = ['outlier-control-1', 'outlier-control-2', 'outlier-control-3']
    const treatmentIds = ['outlier-treatment-1', 'outlier-treatment-2', 'outlier-treatment-3']
    const experiment = ExperimentV2Schema.parse({
      schema_version: 2,
      experiment_id: '00000000-0000-4000-8000-000000000002',
      hypothesis: 'A faster proof beat consistently improves completion.',
      primary_variable: 'proof timing',
      control_job_ids: controlIds,
      treatment_job_ids: treatmentIds,
      platform: 'youtube_shorts',
      target_metric: 'completion_rate',
      editorial_guard_metrics: ['semantic_coherence', 'impact'],
      qualified_guard_metric: 'qualified_actions',
      confounds: [],
      status: 'running',
    })
    const observation = (jobId: string, completionRate: number) => AnalyticsObservationV2Schema.parse({
      schema_version: 2,
      observation_id: crypto.randomUUID(),
      job_id: jobId,
      platform: 'youtube_shorts',
      impressions: 1000,
      views: 800,
      viewed_vs_swiped: 70,
      early_hold_rate: 68,
      average_view_duration_seconds: 25,
      average_percentage_viewed: 75,
      completion_rate: completionRate,
      rewatch_rate: 5,
      shares: 12,
      saves: 14,
      comments: 8,
      substantive_comments: 3,
      comment_quality: 0.8,
      followers_gained: 5,
      qualified_actions: 10,
      utm_actions: 2,
      published_artifact_hash: 'c'.repeat(64),
      source_file_hash: 'd'.repeat(64),
    })
    const control = controlIds.map((jobId) => ({ comparison_cell: 'built_with_ai:short_native:0-30:youtube_shorts', observation: observation(jobId, 60), editorial_scores: scores() }))
    const treatmentRates = [50, 50, 100]
    const treatment = treatmentIds.map((jobId, index) => ({ comparison_cell: 'built_with_ai:short_native:0-30:youtube_shorts', observation: observation(jobId, treatmentRates[index]!), editorial_scores: scores() }))
    const result = evaluatePerformanceEvidenceV2(experiment, control, treatment)
    expect(result).toMatchObject({ eligible: false, control_mean: 60, treatment_mean: 200 / 3 })
    expect(result.reason).toContain('aggregate means cannot override a losing pair')
  })
})
