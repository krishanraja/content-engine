import { JobManifestV1Schema, StageNameSchema } from '@mindmake/contracts'
import { assessTranscriptQuality, generateCandidates, seriesFit } from '@mindmake/core'
import { describe, expect, it } from 'vitest'

function job(series: 'money_of_ai' | 'built_with_ai', purpose: 'production' | 'calibration' = 'production') {
  const now = new Date().toISOString()
  return JobManifestV1Schema.parse({
    schema_version: 1,
    job_id: 'job-1',
    created_at: now,
    updated_at: now,
    series,
    mode: 'solo',
    purpose,
    source: { kind: 'file', ref: 'source.mp4', rights: 'owned' },
    config_hash: 'config',
    skill_hashes: {},
    pinned_inputs: { config_path: 'pinned/studio.json', skill_paths: {} },
    stages: Object.fromEntries(StageNameSchema.options.map((stage) => [stage, { status: 'pending', updated_at: now }])),
    approvals: [],
  })
}

const publisherTranscript = {
  language: 'en',
  source: 'faster_whisper' as const,
  segments: [{
    start_ms: 0,
    end_ms: 30_000,
    text: 'Meta guidance changed how publishers describe their proof and sales outreach. The walled gardens take more spend, but this recording does not explain an artificial intelligence business mechanism. The source then stops before finishing the promised answer',
    words: Array.from({ length: 36 }, (_, index) => ({ start_ms: index * 800, end_ms: index * 800 + 700, text: `word${index}`, probability: 0.92 })),
  }],
}

describe('editorial candidate gates', () => {
  it('does not grant series fit from word count and surfaces consequential claims', () => {
    const candidate = generateCandidates(job('built_with_ai'), publisherTranscript, 1)[0]
    expect(candidate?.scores.clarity).toBeLessThan(0.65)
    expect(candidate?.scores.qualified_fit).toBeLessThan(0.65)
    expect(candidate?.challenge.soft_blocks).toContain('the excerpt does not yet demonstrate a credible AI build, workflow, or implementation mechanism')
    expect(candidate?.challenge.soft_blocks).toContain('the excerpt ends before a complete payoff')
    expect(candidate?.claims.some((claim) => /Meta guidance/.test(claim.text))).toBe(true)
    expect(candidate?.challenge.hard_blocks.some((block) => /human verification/.test(block))).toBe(true)
  })

  it('produces deterministic candidate identities', () => {
    expect(generateCandidates(job('built_with_ai'), publisherTranscript, 1)[0]?.candidate_id)
      .toBe(generateCandidates(job('built_with_ai'), publisherTranscript, 1)[0]?.candidate_id)
  })

  it('requires both AI context and the relevant series mechanism', () => {
    expect(seriesFit('We built an AI workflow and tested the handoff.', 'built_with_ai')).toBeGreaterThan(0.8)
    expect(seriesFit('We improved publisher sales outreach.', 'built_with_ai')).toBeLessThan(0.65)
    expect(seriesFit('AI changed the enterprise cost and commercial margin.', 'money_of_ai')).toBeGreaterThan(0.8)
  })

  it('flags incomplete transcripts before downstream work', () => {
    const quality = assessTranscriptQuality(publisherTranscript)
    expect(quality.complete_ending).toBe(false)
    expect(quality.issues).toContain('recording or excerpt ends without a complete sentence')
  })

  it('marks calibration output as analysis-only', () => {
    const candidate = generateCandidates(job('built_with_ai', 'calibration'), publisherTranscript, 1)[0]
    expect(candidate?.challenge.soft_blocks).toContain('calibration jobs are analysis-only and cannot create publishable packages')
  })
})
