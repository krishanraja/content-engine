import { CandidateV1Schema, JobManifestV1Schema, StageNameSchema } from '@mindmake/contracts'
import { applyPresenterIdentityCorrections, BUILT_WITH_AI_EDITORIAL_RULE_ID, captionTreatmentIssues, exactWordFidelity, INVESTIGATIVE_SHORT_REFERENCE_RULE_ID, meaningCriticalRemovalIssues, suggestCaptionTreatment, validateEditorialCandidate, validateShortNativeEditorialCandidate, type EditorialThresholds, type TranscriptDocument } from '@mindmake/core'
import { describe, expect, it } from 'vitest'

const thresholds: EditorialThresholds = {
  semantic_coherence: 0.82,
  impact: 0.72,
  relevance: 0.75,
  insight: 0.7,
  specificity: 0.65,
  audience_value: 0.75,
  hook_strength: 0.68,
  ending_strength: 0.78,
  cold_open_max_ms: 5500,
  long_video_ms: 30000,
  minimum_segment_ms: 500,
}

function transcript(): TranscriptDocument {
  const source = "Hi I'm Chris um um the useful part is not the AI model it is the workflow because the handoff gets faster that is the decision that saves the team time"
  const words = source.split(' ')
  return applyPresenterIdentityCorrections({
    language: 'en',
    source: 'faster_whisper',
    verified: false,
    segments: [{
      start_ms: 0,
      end_ms: words.length * 700,
      text: `${source}.`,
      words: words.map((text, index) => ({ start_ms: index * 700, end_ms: index * 700 + 600, text, probability: 0.94 })),
    }],
  }, 'Krish', ['Chris'])
}

function job() {
  const now = new Date().toISOString()
  return JobManifestV1Schema.parse({
    schema_version: 1,
    job_id: 'job-editorial',
    created_at: now,
    updated_at: now,
    series: 'built_with_ai',
    mode: 'solo',
    purpose: 'production',
    presenter_name: 'Krish',
    source: { kind: 'file', ref: 'source.mp4', rights: 'owned' },
    config_hash: 'config',
    skill_hashes: {},
    pinned_inputs: { config_path: 'pinned/studio.json', skill_paths: {} },
    stages: Object.fromEntries(StageNameSchema.options.map((stage) => [stage, { status: 'pending', updated_at: now }])),
    approvals: [],
  })
}

function candidate(overrides: Record<string, unknown> = {}) {
  const source = transcript()
  const duration = source.segments[0]!.end_ms
  const cleaned = "Hi I'm Krish the useful part is not the AI model it is the workflow because the handoff gets faster. That is the decision that saves the team time."
  return CandidateV1Schema.parse({
    schema_version: 1,
    candidate_id: 'candidate-editorial',
    job_id: 'job-editorial',
    series: 'built_with_ai',
    mode: 'solo',
    start_ms: 0,
    end_ms: duration,
    transcript: cleaned,
    hook: 'The useful part is not the AI model.',
    payoff: 'That is the decision that saves the team time.',
    scores: { truth: 0.9, evidence: 0.8, clarity: 0.9, tension: 0.8, payoff: 0.9, visual_proof: 0.8, qualified_fit: 0.9, novelty: 0.8 },
    claims: [],
    challenge: { strongest_objection: 'The workflow proof must remain visible.', safer_version: 'Keep the continuous argument.', stretch_version: 'Open on the decision.', recommendation: 'Publish the coherent continuous cut.', hard_blocks: [], soft_blocks: [] },
    edit_plan: {
      structure: 'continuous',
      segments: [{ segment_id: 'main', start_ms: 0, end_ms: duration, role: 'ending', transcript: cleaned, selection_reason: 'This is the complete self-contained argument.' }],
      caption_script: cleaned,
      semantic_throughline: 'The workflow matters more than the model because it improves the handoff and saves time.',
      continuity_rationale: 'One continuous cut preserves the causal chain and already lands the strongest ending.',
      continuous_baseline: { start_ms: 0, end_ms: duration, verdict: 'selected', rationale: 'This complete source window is the strongest continuous version.' },
      cold_open: { decision: 'not_used', rationale: 'The opening reaches the central contrast immediately.' },
      source_order: { decision: 'preserved', rationale: 'The continuous cut preserves the verified source order.' },
      meaning_preservation: [],
      retained_disfluencies: [],
      total_duration_ms: duration,
    },
    editorial: {
      disposition: 'publishable',
      scores: { semantic_coherence: 0.92, impact: 0.86, relevance: 0.9, insight: 0.84, specificity: 0.8, audience_value: 0.9, hook_strength: 0.82, ending_strength: 0.9 },
      semantic_checks: { standalone_without_source: true, referents_resolved: true, claim_boundaries_preserved: true, causal_chain_preserved: true, visual_dependencies_available: true, audience_payoff_specific: true, ending_complete: true },
      semantic_failure_notes: [],
      strongest_reason_to_reject: 'The proof is spoken rather than visually demonstrated.',
      selection_rationale: 'This is the most complete mechanism and decision in the source.',
      audience_payoff: 'Builders learn to prioritise the workflow handoff over model novelty.',
    },
    source_refs: ['source.mp4'],
    ...overrides,
  })
}

describe('editorial judgement gates', () => {
  it('corrects the known presenter identity without changing a guest named Chris', () => {
    const corrected = transcript()
    expect(corrected.segments[0]?.text).toContain("I'm Krish")
    expect(corrected.segments[0]?.words?.[2]?.text).toBe('Krish')
  })

  it('allows a real Chris only when the non-presenter identity is explicit', () => {
    const unresolved = candidate({ hook: 'Chris built a useful workflow.' })
    expect(validateEditorialCandidate(unresolved, transcript(), job(), thresholds).hard_blocks).toContain('unresolved identity mention: the verified presenter is Krish; declare a real guest or subject named Chris explicitly')
    const declared = candidate({ hook: 'Chris built a useful workflow.', identity_mentions: [{ name: 'Chris', role: 'subject', evidence: 'Named in the verified source material.' }] })
    expect(validateEditorialCandidate(declared, transcript(), job(), thresholds).hard_blocks).not.toContain('unresolved identity mention: the verified presenter is Krish; declare a real guest or subject named Chris explicitly')
  })

  it('accepts removal-only caption treatment and preserves exact source order', () => {
    const source = transcript()
    const result = validateEditorialCandidate(candidate(), source, job(), thresholds)
    expect(result.hard_blocks).toEqual([])
    expect(result.exact_word_fidelity).toBe(true)
    expect(result.removed_source_tokens).toEqual(expect.arrayContaining(['um', 'um']))
  })

  it('rejects invented synonyms, reordered words, fillers, and accidental duplicates', () => {
    const source = transcript()
    expect(exactWordFidelity('The workflow improves the handoff.', source).exact_word_fidelity).toBe(false)
    expect(exactWordFidelity('Workflow the useful part.', source).exact_word_fidelity).toBe(false)
    expect(captionTreatmentIssues('Um the the workflow works.')).toEqual(expect.arrayContaining(['unresolved filler word: um', 'unresolved duplicate word: the']))
  })

  it('keeps intentional repetition only with an explicit rationale', () => {
    expect(captionTreatmentIssues('Never never publish filler.', [{ phrase: 'never never', rationale: 'Intentional emphasis in the spoken delivery.' }])).toEqual([])
  })

  it('blocks deletion-only edits that silently remove meaning-critical words', () => {
    expect(exactWordFidelity('This is safe.', { language: 'en', source: 'manual', segments: [{ start_ms: 0, end_ms: 1000, text: 'This is not safe.' }] }).exact_word_fidelity).toBe(true)
    expect(meaningCriticalRemovalIssues(['not', 'probably', '42'])).toEqual(expect.arrayContaining([
      'removed meaning-critical negation token requires explicit preservation rationale: not',
      'removed meaning-critical uncertainty token requires explicit preservation rationale: probably',
      'removed meaning-critical quantity token requires explicit preservation rationale: 42',
    ]))
    expect(meaningCriticalRemovalIssues(['but'], [{ removed_token: 'but', category: 'contrast', rationale: 'The complete preceding clause is omitted, so the retained claim keeps its original meaning.' }])).toEqual([])
  })

  it('blocks weak endings and non-publishable dispositions', () => {
    const weak = candidate({ editorial: { ...candidate().editorial, disposition: 'revise', scores: { ...candidate().editorial!.scores, ending_strength: 0.4 } } })
    const result = validateEditorialCandidate(weak, transcript(), job(), thresholds)
    expect(result.hard_blocks).toEqual(expect.arrayContaining(['editorial disposition is revise; do not create a treatment', 'ending strength is below the publishable threshold']))
  })

  it('blocks a candidate when any explicit semantic-coherence check fails', () => {
    const base = candidate()
    const failed = candidate({ editorial: { ...base.editorial, semantic_checks: { ...base.editorial!.semantic_checks, referents_resolved: false }, semantic_failure_notes: ['The opening pronoun has no visible antecedent.'] } })
    expect(validateEditorialCandidate(failed, transcript(), job(), thresholds).hard_blocks).toContain('semantic check failed: referents resolved')
  })

  it('requires a source-grounded hook role when a cold open is used', () => {
    const base = candidate()
    const invalid = candidate({ edit_plan: { ...base.edit_plan, structure: 'stitched', cold_open: { decision: 'used', rationale: 'The later contrast makes the clearest first five seconds.' }, segments: base.edit_plan!.segments } })
    expect(validateEditorialCandidate(invalid, transcript(), job(), thresholds).hard_blocks).toEqual(expect.arrayContaining(['stitched edits require at least two source segments', 'a used cold open must be the first hook segment']))
  })

  it('blocks hidden source reordering and mismatched per-segment wording', () => {
    const base = candidate()
    const duration = base.edit_plan!.total_duration_ms
    const split = Math.floor(duration / 2)
    const changed = candidate({
      edit_plan: {
        ...base.edit_plan,
        structure: 'stitched',
        continuous_baseline: { ...base.edit_plan!.continuous_baseline, verdict: 'rejected', rationale: 'The continuous version buries the strongest consequence after unnecessary setup.' },
        segments: [
          { segment_id: 'later', start_ms: split, end_ms: duration, role: 'body', transcript: 'because the handoff gets faster that is the decision that saves the team time', selection_reason: 'This later section states the decision and payoff.' },
          { segment_id: 'earlier', start_ms: 0, end_ms: split, role: 'ending', transcript: "Hi I'm Krish the useful part is not the AI model it is the workflow", selection_reason: 'This earlier section establishes the central contrast.' },
        ],
        caption_script: base.transcript,
        source_order: { decision: 'preserved', rationale: 'This intentionally claims no reorder occurred.' },
      },
    })
    const blocks = validateEditorialCandidate(changed, transcript(), job(), thresholds).hard_blocks
    expect(blocks).toContain('edit segment order changed without an explicit source-order decision')
    expect(blocks).toContain('caption script must equal the treated segment transcripts in final edit order')
  })

  it('requires stitched edits to beat a declared continuous baseline', () => {
    const base = candidate()
    const invalid = candidate({ edit_plan: { ...base.edit_plan, structure: 'stitched', segments: [base.edit_plan!.segments[0], { ...base.edit_plan!.segments[0], segment_id: 'repeat', start_ms: 1000 }], continuous_baseline: { ...base.edit_plan!.continuous_baseline, verdict: 'selected' } } })
    expect(validateEditorialCandidate(invalid, transcript(), job(), thresholds).hard_blocks).toContain('a stitched edit must explicitly reject the strongest continuous baseline')
  })

  it('automatically suggests only a deletion-based caption starting point', () => {
    expect(suggestCaptionTreatment('um This this is the workflow')).toBe('This is the workflow.')
  })

  it('applies the same quality floor to short-native scripts', () => {
    const base = candidate({ mode: 'short_native', job_id: 'native-job', edit_plan: undefined })
    expect(validateShortNativeEditorialCandidate(base, thresholds, 'Krish').hard_blocks).toEqual([])
    const weak = CandidateV1Schema.parse({ ...base, editorial: { ...base.editorial, scores: { ...base.editorial!.scores, insight: 0.2 } } })
    expect(validateShortNativeEditorialCandidate(weak, thresholds, 'Krish').hard_blocks).toContain('insight is below the publishable threshold')
  })

  it('applies the confirmed investigative preference only inside its approved series scope', () => {
    const preference = {
      schema_version: 1 as const,
      rule_id: INVESTIGATIVE_SHORT_REFERENCE_RULE_ID,
      assertion: 'Lead with receipts and finish on an earned verdict.',
      scope: { level: 'series' as const, key: 'money_of_ai' },
      evidence_feedback_ids: ['feedback-reference-videos-20260908-01'],
      counterexamples: [],
      regression_cases: [],
      status: 'active' as const,
      approved_by: 'Krish',
      approved_at: '2026-09-08T07:35:45.761Z',
    }
    const cleanClaim = { text: 'The workflow reduces handoff time.', kind: 'fact' as const, evidence_urls: ['https://example.com/workflow'], verification: 'verified' as const }
    const built = candidate({ mode: 'short_native', job_id: 'native-job', edit_plan: undefined, transcript: 'This is insane. Follow me for more. What do you think?', claims: [] })
    expect(validateShortNativeEditorialCandidate(built, thresholds, 'Krish', [preference]).soft_blocks).toEqual([])

    const money = CandidateV1Schema.parse({ ...built, series: 'money_of_ai' })
    expect(validateShortNativeEditorialCandidate(money, thresholds, 'Krish', [preference]).soft_blocks).toEqual(expect.arrayContaining([
      'confirmed editorial standard rejects unsupported sensational framing: insane',
      'confirmed editorial standard rejects follow or subscribe requests inside the story',
      'confirmed editorial standard rejects empty comment prompts in place of an earned ending',
      'The Money of AI standard requires at least one explicit claim boundary',
    ]))

    const cleanMoney = CandidateV1Schema.parse({ ...money, transcript: 'Here is the source. It shows the workflow reduces handoff time.', hook: 'Here is the source.', payoff: 'The workflow reduces handoff time.', claims: [cleanClaim] })
    expect(validateShortNativeEditorialCandidate(cleanMoney, thresholds, 'Krish', [preference]).soft_blocks).toEqual([])
  })

  it('adapts the Built With AI proof requirement to the canonical format', () => {
    const preference = {
      schema_version: 1 as const,
      rule_id: BUILT_WITH_AI_EDITORIAL_RULE_ID,
      assertion: 'Make the build or human consequence concrete.',
      scope: { level: 'series' as const, key: 'built_with_ai' },
      evidence_feedback_ids: ['feedback-cross-series-format-expansion-20260908-01'],
      counterexamples: [], regression_cases: [], status: 'active' as const,
      approved_by: 'Krish', approved_at: '2026-09-08T12:00:00.000Z',
    }
    const humanLed = candidate({ mode: 'short_native', job_id: 'native-job', edit_plan: undefined, editorial_format: 'third_why', source_refs: [], claims: [], scores: { truth: 0.9, evidence: 0.5, clarity: 0.9, tension: 0.8, payoff: 0.9, visual_proof: 0.5, qualified_fit: 0.9, novelty: 0.8 } })
    expect(validateShortNativeEditorialCandidate(humanLed, thresholds, 'Krish', [preference]).soft_blocks).toEqual([])

    const build = candidate({ mode: 'short_native', job_id: 'native-job', edit_plan: undefined, editorial_format: 'build_itself', source_refs: [], claims: [], scores: { truth: 0.9, evidence: 0.8, clarity: 0.9, tension: 0.8, payoff: 0.9, visual_proof: 0.5, qualified_fit: 0.9, novelty: 0.8 } })
    expect(validateShortNativeEditorialCandidate(build, thresholds, 'Krish', [preference]).soft_blocks).toEqual(expect.arrayContaining([
      'build_itself requires a more concrete build or artifact proof plan',
      'build_itself requires a concrete build, artifact, or recorded source reference',
    ]))
  })
})
