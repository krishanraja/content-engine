import { describe, expect, it } from 'vitest'
import { v1DescendantsFor, v2DescendantsFor, v2PrerequisitesFor, v2RunnableStages, type RunnableStageStatus } from '@mindmake/core'
import type { StageNameV2 } from '@mindmake/contracts'

describe('V1 stage graph compatibility', () => {
  it('preserves short-native recording invalidation behaviour', () => {
    expect(v1DescendantsFor('ingest', 'short_native')).toEqual(['normalize', 'transcript', 'treatment', 'render', 'qa', 'package'])
    expect(v1DescendantsFor('transcript', 'short_native')).not.toContain('candidates')
  })

  it('preserves original extracted-work descendants', () => {
    expect(v1DescendantsFor('normalize', 'extract')).toEqual(['transcript', 'candidates', 'claims', 'treatment', 'render', 'qa', 'package'])
  })
})

describe('V2 stage graph', () => {
  it('keeps transcript and source analysis as independent siblings', () => {
    expect(v2PrerequisitesFor('transcript', 'extract')).toEqual(['normalize'])
    expect(v2PrerequisitesFor('source_analysis', 'extract')).toEqual(['normalize'])
    expect(v2DescendantsFor('source_analysis', 'extract')).not.toContain('transcript')
    expect(v2DescendantsFor('transcript', 'extract')).not.toContain('source_analysis')
  })

  it('invalidates visual descendants when source analysis changes', () => {
    expect(v2DescendantsFor('source_analysis', 'solo')).toEqual(['visual_plan', 'assets', 'styleframes', 'animatic', 'treatment', 'render', 'qa', 'package'])
  })

  it('keeps short-native candidates upstream of recorded media', () => {
    expect(v2PrerequisitesFor('candidates', 'short_native')).toEqual(['script'])
    expect(v2PrerequisitesFor('recording_brief', 'short_native')).toEqual(['candidates', 'claims'])
    expect(v2PrerequisitesFor('ingest', 'short_native')).toEqual(['recording_brief'])
    expect(v2DescendantsFor('normalize', 'short_native')).not.toContain('candidates')
    expect(v2DescendantsFor('normalize', 'short_native')).toEqual(['transcript', 'source_analysis', 'visual_plan', 'assets', 'styleframes', 'animatic', 'treatment', 'render', 'qa', 'package'])
  })

  it('returns both parallel stages when normalization completes', () => {
    const states = { brief: { status: 'skipped' }, script: { status: 'skipped' }, recording_brief: { status: 'skipped' }, ingest: { status: 'complete' }, normalize: { status: 'complete' }, transcript: { status: 'pending' }, source_analysis: { status: 'pending' }, candidates: { status: 'pending' } } satisfies Partial<Record<StageNameV2, { status: RunnableStageStatus }>>
    expect(v2RunnableStages(states, 'extract')).toEqual(['transcript', 'source_analysis'])
  })
})
