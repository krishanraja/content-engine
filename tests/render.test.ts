import { describe, expect, it } from 'vitest'
import { loudnormSecondPassFilter, renderCacheKey, validateAudioDurationParity } from '@mindmake/core'
import { evidenceIntentLabel } from '../apps/renderer/src/evidence-label'

describe('render audio normalization', () => {
  it('builds a measured second-pass loudnorm filter', () => {
    const filter = loudnormSecondPassFilter(`noise before\n{
      "input_i" : "-21.34",
      "input_tp" : "-3.12",
      "input_lra" : "2.10",
      "input_thresh" : "-31.40",
      "output_i" : "-13.90",
      "output_tp" : "-1.02",
      "output_lra" : "1.90",
      "output_thresh" : "-24.10",
      "normalization_type" : "dynamic",
      "target_offset" : "-0.10"
    }\nnoise after`)
    expect(filter).toContain('measured_I=-21.34')
    expect(filter).toContain('TP=-1.5')
    expect(filter).toContain('measured_TP=-3.12')
    expect(filter).toContain('offset=-0.10')
    expect(filter).toContain('linear=true')
  })

  it('rejects missing or non-finite loudness measurements', () => {
    expect(() => loudnormSecondPassFilter('no measurement')).toThrow('did not return JSON')
    expect(() => loudnormSecondPassFilter('{"input_i":"-inf","input_tp":"-3","input_lra":"1","input_thresh":"-30","target_offset":"0"}')).toThrow('input_i')
  })
})

describe('render cache invalidation', () => {
  it('changes when the renderer implementation changes', () => {
    const manifest = { treatment_id: 'evidence-kinetic-v2', fixed_seed: 'fixed' }
    expect(renderCacheKey(manifest, 'review-proxy', 'renderer-a')).not.toBe(renderCacheKey(manifest, 'review-proxy', 'renderer-b'))
  })
})

describe('render audio integrity', () => {
  it('rejects the half-duration audio produced by frame-skipping proxies', () => {
    expect(validateAudioDurationParity(12.867, 6.5)).toContain('rendered audio duration differs from video by 6.367 seconds')
  })

  it('accepts normal container rounding differences', () => {
    expect(validateAudioDurationParity(12.833, 12.82)).toEqual([])
  })
})

describe('evidence labels', () => {
  it('labels fresh contextual reporting without presenting it as direct proof', () => {
    expect(evidenceIntentLabel({ viewer_intent: 'maintain_connection', source_role: 'context', temporality: 'fresh_news' })).toBe('CURRENT CONTEXT')
  })

  it('does not describe evergreen context as current', () => {
    expect(evidenceIntentLabel({ viewer_intent: 'maintain_connection', source_role: 'context', temporality: 'evergreen' })).toBe('CONTEXT')
  })
})
