import type { CandidateV1, EditSegmentV1, JobManifestV1, PreferenceRuleV1 } from '@mindmake/contracts'
import type { TranscriptDocument, TranscriptWord } from './candidates.js'
import { sliceTranscript } from './captions.js'

export interface EditorialThresholds {
  semantic_coherence: number
  impact: number
  relevance: number
  insight: number
  specificity: number
  audience_value: number
  hook_strength: number
  ending_strength: number
  cold_open_max_ms: number
  long_video_ms: number
  minimum_segment_ms: number
  /** Content terms the opening sentence must share with the approved brief title. Absent means one. */
  promise_match_min_terms?: number
}

export interface EditorialValidation {
  hard_blocks: string[]
  soft_blocks: string[]
  exact_word_fidelity: boolean
  source_token_count: number
  caption_token_count: number
  removed_source_tokens: string[]
}

export const MONEY_OF_AI_EDITORIAL_RULE_ID = 'pref-money-investigative-receipts-v1'
export const BUILT_WITH_AI_EDITORIAL_RULE_ID = 'pref-built-concrete-story-v1'
export const INVESTIGATIVE_SHORT_REFERENCE_RULE_ID = MONEY_OF_AI_EDITORIAL_RULE_ID

function preferenceAppliesToCandidate(rule: PreferenceRuleV1, candidate: CandidateV1): boolean {
  if (rule.status !== 'active') return false
  if (rule.scope.level === 'global') return true
  if (rule.scope.level === 'series') return rule.scope.key === candidate.series
  if (rule.scope.level === 'mode') return rule.scope.key === candidate.mode
  if (rule.scope.level === 'job') return rule.scope.key === candidate.job_id
  return false
}

export function editorialPreferenceIssues(candidate: CandidateV1, preferences: PreferenceRuleV1[] = []): string[] {
  const moneyEnabled = preferences.some((rule) => rule.rule_id === MONEY_OF_AI_EDITORIAL_RULE_ID && preferenceAppliesToCandidate(rule, candidate))
  const builtEnabled = preferences.some((rule) => rule.rule_id === BUILT_WITH_AI_EDITORIAL_RULE_ID && preferenceAppliesToCandidate(rule, candidate))
  if (!moneyEnabled && !builtEnabled) return []

  const text = `${candidate.hook} ${candidate.transcript} ${candidate.payoff}`.toLowerCase()
  const issues: string[] = []
  const sensationalTerms = [...new Set(text.match(/\b(?:insane|unbelievable|shocking|mind[- ]?blowing|terrifying|crazy|game[- ]?changer)\b/g) || [])]
  if (sensationalTerms.length) issues.push(`confirmed editorial standard rejects unsupported sensational framing: ${sensationalTerms.join(', ')}`)
  if (/\b(?:follow (?:me|us|for)|subscribe|smash (?:the )?like|hit (?:the )?follow)\b/i.test(text)) issues.push('confirmed editorial standard rejects follow or subscribe requests inside the story')
  if (/\b(?:comment below|drop (?:a )?comment|let me know in the comments|what do you think\??)\b/i.test(text)) issues.push('confirmed editorial standard rejects empty comment prompts in place of an earned ending')

  if (moneyEnabled) {
    if (candidate.scores.evidence < 0.8) issues.push('The Money of AI standard requires stronger source receipts before this angle is approved')
    if (candidate.scores.visual_proof < 0.75) issues.push('The Money of AI standard requires a more concrete visual proof plan')
    if (!candidate.claims.length) issues.push('The Money of AI standard requires at least one explicit claim boundary')
  }

  if (builtEnabled && ['build_itself', 'first_version'].includes(candidate.editorial_format || '')) {
    if (candidate.scores.visual_proof < 0.75) issues.push(`${candidate.editorial_format} requires a more concrete build or artifact proof plan`)
    if (!candidate.source_refs.length && !candidate.claims.length) issues.push(`${candidate.editorial_format} requires a concrete build, artifact, or recorded source reference`)
  }
  return [...new Set(issues)]
}

export const investigativeShortPreferenceIssues = editorialPreferenceIssues

export interface OpeningContextV1 {
  approved_title?: string
}

const PROMISE_STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'your', 'you', 'our', 'was', 'were', 'are', 'has', 'have',
  'had', 'but', 'not', 'how', 'why', 'what', 'when', 'who', 'its', 'his', 'her', 'their', 'they', 'them', 'than', 'then',
  'about', 'after', 'before', 'over', 'under', 'just', 'can', 'will', 'would', 'could', 'should', 'does', 'did', 'been',
])

function promiseTerm(token: string): string {
  return token.length > 3 && token.endsWith('s') && !token.endsWith('ss') ? token.slice(0, -1) : token
}

function promiseTerms(value: string): Set<string> {
  const terms = value.split(/\s+/).map(normalizeSpokenToken).filter((token) => token.length > 2 && !PROMISE_STOPWORDS.has(token)).map(promiseTerm)
  return new Set(terms)
}

/** The first spoken sentence, which is where the packaging promise has to be confirmed. */
export function openingSentence(script: string): string {
  const trimmed = script.trim()
  const match = trimmed.match(/^[^.!?]*[.!?]?/)
  return (match?.[0] || trimmed).trim()
}

/** Content terms shared by the approved title and the opening sentence. Reported so a reviewer can see the overlap, not only the verdict. */
export function promiseMatchTerms(approvedTitle: string, script: string): string[] {
  const opening = promiseTerms(openingSentence(script))
  return [...promiseTerms(approvedTitle)].filter((term) => opening.has(term))
}

export const OPENING_PROMISE_UNCHECKED = 'promise match is unchecked: no approved brief title is bound to this job'
export const OPENING_PROMISE_MISSED = 'the opening sentence does not name the subject of the approved title; the first thing the viewer hears must confirm the promise the packaging made'
export const OPENING_STANDING_UNSTATED = "the opening does not state the narrator's relation to the claim; confirm the standing is visible on screen if it is not spoken"
export const OPENING_POSITION_UNSTATED = 'nothing tells the viewer where they are in the story; past thirty seconds, name the stage or the count'

const STANDING_MARKER = /\b(?:i|i'm|im|i've|ive|my|mine|we|we're|we've|our|us)\b/i
const POSITION_COUNT = '\\d+|two|three|four|five|six|seven|eight|nine|ten'
const POSITION_MARKER = new RegExp(`\\b(?:first|second|third|next|then|finally|last|by the end|step (?:${POSITION_COUNT})|(?:${POSITION_COUNT}) (?:things|steps|reasons|ways|rules|questions|mistakes|parts|lessons))\\b`, 'i')

function estimatedDurationMs(candidate: CandidateV1): number {
  if (candidate.edit_plan) return candidate.edit_plan.total_duration_ms
  const words = candidate.transcript.split(/\s+/).filter(Boolean).length
  return Math.round(words / 2.5 * 1000)
}

/**
 * The opening contract: the first sentence confirms the promise the packaging made, makes the narrator's standing
 * visible, and, past the long-video threshold, tells the viewer where they are. `promise_match` is the only one of the
 * three with a deterministic verdict; the others report what a reviewer must look at.
 */
export function openingContractIssues(candidate: CandidateV1, thresholds: EditorialThresholds, context: OpeningContextV1 = {}, promiseMatchBlocks = false): { hard_blocks: string[]; soft_blocks: string[] } {
  const hardBlocks: string[] = []
  const softBlocks: string[] = []
  const opening = openingSentence(candidate.transcript)

  if (!context.approved_title) {
    softBlocks.push(OPENING_PROMISE_UNCHECKED)
  } else if (promiseMatchTerms(context.approved_title, candidate.transcript).length < (thresholds.promise_match_min_terms ?? 1)) {
    const issue = OPENING_PROMISE_MISSED
    if (promiseMatchBlocks) hardBlocks.push(issue)
    else softBlocks.push(issue)
  }

  if (!STANDING_MARKER.test(opening)) softBlocks.push(OPENING_STANDING_UNSTATED)
  if (estimatedDurationMs(candidate) > thresholds.long_video_ms && !POSITION_MARKER.test(candidate.transcript)) softBlocks.push(OPENING_POSITION_UNSTATED)

  return { hard_blocks: hardBlocks, soft_blocks: softBlocks }
}

export function normalizeSpokenToken(value: string): string {
  return value.toLowerCase().replace(/[’]/g, "'").replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
}

function textTokens(value: string): string[] {
  return value.split(/\s+/).map(normalizeSpokenToken).filter(Boolean)
}

function timedWords(transcript: TranscriptDocument): TranscriptWord[] {
  return transcript.segments.flatMap((segment) => segment.words?.length
    ? segment.words
    : segment.text.split(/\s+/).filter(Boolean).map((text, index, values) => ({
      text,
      start_ms: Math.round(segment.start_ms + (segment.end_ms - segment.start_ms) * index / values.length),
      end_ms: Math.round(segment.start_ms + (segment.end_ms - segment.start_ms) * (index + 1) / values.length),
    })))
}

export function applyPresenterIdentityCorrections(transcript: TranscriptDocument, presenterName: string, aliases: string[]): TranscriptDocument {
  const corrections: NonNullable<TranscriptDocument['corrections']> = [...(transcript.corrections || [])]
  const aliasSet = new Set(aliases.map(normalizeSpokenToken))
  const segments = transcript.segments.map((segment, segmentIndex) => {
    let text = segment.text
    for (const alias of aliases) {
      const pattern = new RegExp(`\\b(i(?:['’]m| am)|my name is)\\s+${alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi')
      text = text.replace(pattern, (match, prefix: string) => {
        corrections.push({ from: match.slice(prefix.length).trim(), to: presenterName, reason: 'presenter identity metadata', segment_index: segmentIndex })
        return `${prefix} ${presenterName}`
      })
    }
    const words = segment.words?.map((word, wordIndex, values) => {
      if (!aliasSet.has(normalizeSpokenToken(word.text))) return { ...word }
      const previousOne = normalizeSpokenToken(values[wordIndex - 1]?.text || '')
      const previousTwo = normalizeSpokenToken(values[wordIndex - 2]?.text || '')
      const selfIntroduction = ["i'm", 'im'].includes(previousOne)
        || (previousTwo === 'i' && previousOne === 'am')
        || (previousTwo === 'name' && previousOne === 'is')
      if (!selfIntroduction) return { ...word }
      corrections.push({ from: word.text, to: presenterName, reason: 'presenter identity metadata', segment_index: segmentIndex, word_index: wordIndex })
      return { ...word, text: presenterName }
    })
    return { ...segment, text, ...(words ? { words } : {}) }
  })
  return { ...transcript, segments, corrections }
}

export function composeEditTranscript(transcript: TranscriptDocument, segments: EditSegmentV1[]): TranscriptDocument {
  let offset = 0
  const composed = segments.flatMap((selection) => {
    const sliced = sliceTranscript(transcript, selection.start_ms, selection.end_ms)
    const duration = selection.end_ms - selection.start_ms
    const shifted = sliced.segments.map((segment) => ({
      ...segment,
      start_ms: segment.start_ms + offset,
      end_ms: segment.end_ms + offset,
      ...(segment.words ? { words: segment.words.map((word) => ({ ...word, start_ms: word.start_ms + offset, end_ms: word.end_ms + offset })) } : {}),
    }))
    offset += duration
    return shifted
  })
  return { ...transcript, segments: composed }
}

export function exactWordFidelity(captionScript: string, sourceTranscript: TranscriptDocument): Omit<EditorialValidation, 'hard_blocks' | 'soft_blocks'> {
  const sourceWords = timedWords(sourceTranscript)
  const sourceTokens = sourceWords.map((word) => normalizeSpokenToken(word.text)).filter(Boolean)
  const captionTokens = textTokens(captionScript)
  let cursor = 0
  const matchedSourceIndexes = new Set<number>()
  for (const token of captionTokens) {
    while (cursor < sourceTokens.length && sourceTokens[cursor] !== token) cursor += 1
    if (cursor >= sourceTokens.length) return {
      exact_word_fidelity: false,
      source_token_count: sourceTokens.length,
      caption_token_count: captionTokens.length,
      removed_source_tokens: sourceTokens.filter((_, index) => !matchedSourceIndexes.has(index)),
    }
    matchedSourceIndexes.add(cursor)
    cursor += 1
  }
  return {
    exact_word_fidelity: true,
    source_token_count: sourceTokens.length,
    caption_token_count: captionTokens.length,
    removed_source_tokens: sourceTokens.filter((_, index) => !matchedSourceIndexes.has(index)),
  }
}

const SINGLE_FILLERS = new Set(['um', 'uh', 'erm', 'hmm'])
const PHRASE_FILLERS = ['you know', 'i mean', 'sort of', 'kind of']
const MEANING_CRITICAL: Record<'negation' | 'uncertainty' | 'condition' | 'contrast', Set<string>> = {
  negation: new Set(['not', 'no', 'never', 'neither', 'nor', 'without', 'cannot', "can't", "don't", "doesn't", "didn't", "won't", "wouldn't", "shouldn't", "couldn't"]),
  uncertainty: new Set(['may', 'might', 'could', 'probably', 'possibly', 'roughly', 'approximately', 'around', 'nearly', 'almost', 'sometimes', 'often', 'typically', 'generally', 'usually', 'perhaps', 'likely', 'unlikely', 'estimated']),
  condition: new Set(['if', 'unless', 'except', 'only', 'until', 'when', 'while']),
  contrast: new Set(['but', 'although', 'however', 'whereas', 'instead', 'rather']),
}

function meaningCategory(token: string): 'negation' | 'uncertainty' | 'condition' | 'contrast' | 'quantity' | undefined {
  if (/^(?:\d+(?:[.,]\d+)?%?|[£$€]\d+(?:[.,]\d+)?)$/.test(token)) return 'quantity'
  for (const [category, values] of Object.entries(MEANING_CRITICAL) as Array<[keyof typeof MEANING_CRITICAL, Set<string>]>) if (values.has(token)) return category
  return undefined
}

export function meaningCriticalRemovalIssues(removedTokens: string[], acknowledged: Array<{ removed_token: string; category: string; rationale: string }> = []): string[] {
  const recorded = new Map(acknowledged.map((item) => [normalizeSpokenToken(item.removed_token), item.category]))
  const issues: string[] = []
  for (const token of [...new Set(removedTokens.map(normalizeSpokenToken))]) {
    const category = meaningCategory(token)
    if (!category) continue
    if (recorded.get(token) !== category) issues.push(`removed meaning-critical ${category} token requires explicit preservation rationale: ${token}`)
  }
  for (const [token] of recorded) if (!removedTokens.map(normalizeSpokenToken).includes(token)) issues.push(`meaning-preservation record does not match a removed source token: ${token}`)
  return issues
}

export function captionTreatmentIssues(captionScript: string, retained: Array<{ phrase: string; rationale: string }> = []): string[] {
  const allowed = new Set(retained.map((item) => textTokens(item.phrase).join(' ')))
  const tokens = textTokens(captionScript)
  const issues: string[] = []
  for (const token of tokens) if (SINGLE_FILLERS.has(token) && !allowed.has(token)) issues.push(`unresolved filler word: ${token}`)
  const normalized = tokens.join(' ')
  for (const phrase of PHRASE_FILLERS) if (normalized.includes(phrase) && !allowed.has(phrase)) issues.push(`unresolved filler phrase: ${phrase}`)
  for (let index = 1; index < tokens.length; index += 1) {
    if (tokens[index] === tokens[index - 1] && !allowed.has(`${tokens[index]} ${tokens[index]}`)) issues.push(`unresolved duplicate word: ${tokens[index]}`)
  }
  return [...new Set(issues)]
}

export function suggestCaptionTreatment(source: string): string {
  const raw = source.split(/\s+/).filter(Boolean)
  const output: string[] = []
  for (let index = 0; index < raw.length; index += 1) {
    const token = normalizeSpokenToken(raw[index] || '')
    const pair = `${token} ${normalizeSpokenToken(raw[index + 1] || '')}`
    if (SINGLE_FILLERS.has(token)) continue
    if (PHRASE_FILLERS.includes(pair)) { index += 1; continue }
    if (output.length && normalizeSpokenToken(output.at(-1) || '') === token) continue
    output.push(raw[index] || '')
  }
  if (!output.length) return ''
  const joined = output.join(' ').replace(/^[a-z]/, (letter) => letter.toUpperCase())
  return /[.!?]$/.test(joined) ? joined : `${joined}.`
}

export function validateEditorialCandidate(candidate: CandidateV1, transcript: TranscriptDocument, job: JobManifestV1, thresholds: EditorialThresholds, preferences: PreferenceRuleV1[] = [], opening: OpeningContextV1 = {}): EditorialValidation {
  const hardBlocks: string[] = []
  const softBlocks: string[] = []
  if (candidate.job_id !== job.job_id || candidate.series !== job.series || candidate.mode !== job.mode) hardBlocks.push('candidate job, series, and mode must match the job manifest')
  if (!candidate.edit_plan || !candidate.editorial) return {
    hard_blocks: ['explicit Codex editorial assessment and edit plan are required before angle approval'],
    soft_blocks: [],
    exact_word_fidelity: false,
    source_token_count: 0,
    caption_token_count: 0,
    removed_source_tokens: [],
  }

  const { edit_plan: plan, editorial } = candidate
  const sumDuration = plan.segments.reduce((sum, segment) => sum + segment.end_ms - segment.start_ms, 0)
  const transcriptEnd = Math.max(0, ...transcript.segments.map((segment) => segment.end_ms))
  if (Math.abs(sumDuration - plan.total_duration_ms) > 50) hardBlocks.push('edit plan total duration does not equal its source segments')
  if (plan.structure === 'continuous' && plan.segments.length !== 1) hardBlocks.push('continuous edits must contain exactly one source segment')
  if (plan.structure === 'stitched' && plan.segments.length < 2) hardBlocks.push('stitched edits require at least two source segments')
  if (plan.continuous_baseline.end_ms <= plan.continuous_baseline.start_ms) hardBlocks.push('continuous baseline must end after it starts')
  if (plan.continuous_baseline.end_ms > transcriptEnd + 250) hardBlocks.push('continuous baseline falls outside the verified transcript timeline')
  if (plan.structure === 'continuous' && plan.continuous_baseline.verdict !== 'selected') hardBlocks.push('a continuous edit must identify its continuous baseline as selected')
  if (plan.structure === 'stitched' && plan.continuous_baseline.verdict !== 'rejected') hardBlocks.push('a stitched edit must explicitly reject the strongest continuous baseline')
  if (plan.segments.some((segment) => segment.end_ms <= segment.start_ms)) hardBlocks.push('every edit segment must end after it starts')
  if (plan.segments.some((segment) => segment.start_ms >= transcriptEnd || segment.end_ms > transcriptEnd + 250)) hardBlocks.push('edit segment falls outside the verified transcript timeline')
  if (plan.segments.some((segment) => segment.end_ms - segment.start_ms < thresholds.minimum_segment_ms)) hardBlocks.push('micro-cuts below the configured minimum duration are not allowed')
  if (plan.segments.at(-1)?.role !== 'ending') hardBlocks.push('the final source segment must be explicitly selected as the ending')
  const sourceStart = Math.min(...plan.segments.map((segment) => segment.start_ms))
  const sourceEnd = Math.max(...plan.segments.map((segment) => segment.end_ms))
  if (candidate.start_ms !== undefined && Math.abs(candidate.start_ms - sourceStart) > 50) hardBlocks.push('candidate start must equal the earliest selected source boundary')
  if (candidate.end_ms !== undefined && Math.abs(candidate.end_ms - sourceEnd) > 50) hardBlocks.push('candidate end must equal the latest selected source boundary')
  const continuousSegment = plan.segments[0]
  if (plan.structure === 'continuous' && continuousSegment && (Math.abs(plan.continuous_baseline.start_ms - continuousSegment.start_ms) > 50 || Math.abs(plan.continuous_baseline.end_ms - continuousSegment.end_ms) > 50)) hardBlocks.push('selected continuous baseline must match the final continuous segment')

  const chronological = [...plan.segments].sort((left, right) => left.start_ms - right.start_ms)
  for (let index = 1; index < chronological.length; index += 1) {
    if ((chronological[index]?.start_ms || 0) < (chronological[index - 1]?.end_ms || 0)) hardBlocks.push('source segments may not overlap or repeat material')
  }
  const sourceOrderChanged = plan.segments.some((segment, index) => segment.segment_id !== chronological[index]?.segment_id)
  if (sourceOrderChanged && plan.source_order.decision !== 'reordered') hardBlocks.push('edit segment order changed without an explicit source-order decision')
  if (!sourceOrderChanged && plan.source_order.decision !== 'preserved') hardBlocks.push('source-order decision says reordered but the edit remains chronological')
  if (sourceOrderChanged && plan.structure !== 'stitched') hardBlocks.push('source reordering requires a stitched edit plan')

  if (plan.cold_open.decision === 'used') {
    const first = plan.segments[0]
    if (!first || first.role !== 'hook') hardBlocks.push('a used cold open must be the first hook segment')
    if (first && first.end_ms - first.start_ms > thresholds.cold_open_max_ms) hardBlocks.push('cold open exceeds the configured maximum duration')
    if (plan.structure !== 'stitched') hardBlocks.push('a cold open requires a stitched edit plan')
  }
  if (plan.total_duration_ms > thresholds.long_video_ms && plan.cold_open.rationale.length < 24) hardBlocks.push('videos over 30 seconds require a specific cold-open decision rationale')

  const composed = composeEditTranscript(transcript, plan.segments)
  const fidelity = exactWordFidelity(plan.caption_script, composed)
  if (!fidelity.exact_word_fidelity) hardBlocks.push('caption treatment invented, changed, or reordered words outside the verified selected transcript')
  for (const segment of plan.segments) {
    const segmentFidelity = exactWordFidelity(segment.transcript, composeEditTranscript(transcript, [segment]))
    if (!segmentFidelity.exact_word_fidelity) hardBlocks.push(`edit segment ${segment.segment_id} transcript is not source-faithful`)
  }
  if (textTokens(plan.segments.map((segment) => segment.transcript).join(' ')).join(' ') !== textTokens(plan.caption_script).join(' ')) hardBlocks.push('caption script must equal the treated segment transcripts in final edit order')
  hardBlocks.push(...captionTreatmentIssues(plan.caption_script, plan.retained_disfluencies || []))
  hardBlocks.push(...meaningCriticalRemovalIssues(fidelity.removed_source_tokens, plan.meaning_preservation || []))
  if (textTokens(candidate.transcript).join(' ') !== textTokens(plan.caption_script).join(' ')) hardBlocks.push('candidate transcript must equal the cleaned caption script')
  const presenterMentions = candidate.identity_mentions.filter((mention) => mention.role === 'presenter')
  if (job.presenter_name && presenterMentions.some((mention) => normalizeSpokenToken(mention.name) !== normalizeSpokenToken(job.presenter_name || ''))) hardBlocks.push(`presenter identity violation: the verified presenter is ${job.presenter_name}`)
  const publicCandidateText = `${candidate.transcript} ${candidate.hook} ${candidate.payoff}`
  const declaredNonPresenterChris = candidate.identity_mentions.some((mention) => normalizeSpokenToken(mention.name) === 'chris' && mention.role !== 'presenter')
  if (job.presenter_name?.toLowerCase() === 'krish' && /\bchris\b/i.test(publicCandidateText) && !declaredNonPresenterChris) hardBlocks.push('unresolved identity mention: the verified presenter is Krish; declare a real guest or subject named Chris explicitly')

  if (editorial.disposition !== 'publishable') hardBlocks.push(`editorial disposition is ${editorial.disposition}; do not create a treatment`)
  for (const [name, passed] of Object.entries(editorial.semantic_checks)) if (!passed) hardBlocks.push(`semantic check failed: ${name.replaceAll('_', ' ')}`)
  if (Object.values(editorial.semantic_checks).some((passed) => !passed) && !editorial.semantic_failure_notes.length) hardBlocks.push('failed semantic checks require specific failure notes')
  const scoreThresholds: Array<[keyof typeof editorial.scores, number]> = [
    ['semantic_coherence', thresholds.semantic_coherence],
    ['impact', thresholds.impact],
    ['relevance', thresholds.relevance],
    ['insight', thresholds.insight],
    ['specificity', thresholds.specificity],
    ['audience_value', thresholds.audience_value],
    ['hook_strength', thresholds.hook_strength],
    ['ending_strength', thresholds.ending_strength],
  ]
  for (const [name, minimum] of scoreThresholds) if (editorial.scores[name] < minimum) hardBlocks.push(`${name.replaceAll('_', ' ')} is below the publishable threshold`)
  if (!/[.!?]["')\]]?$/.test(plan.caption_script.trim())) hardBlocks.push('cleaned caption script must end on a complete sentence')
  if (plan.structure === 'stitched' && plan.segments.length > 4) softBlocks.push('more than four stitched sections risks a choppy result; justify every additional cut at treatment review')
  const averageSegment = plan.total_duration_ms / plan.segments.length
  if (plan.structure === 'stitched' && averageSegment < 2500) softBlocks.push('average stitched section is under 2.5 seconds; check comprehension, jump cuts, and audio continuity')
  softBlocks.push(...editorialPreferenceIssues(candidate, preferences))
  const openingContract = openingContractIssues(candidate, thresholds, opening, true)
  hardBlocks.push(...openingContract.hard_blocks)
  softBlocks.push(...openingContract.soft_blocks)

  return { hard_blocks: [...new Set(hardBlocks)], soft_blocks: [...new Set(softBlocks)], ...fidelity }
}

export function validateShortNativeEditorialCandidate(candidate: CandidateV1, thresholds: EditorialThresholds, presenterName?: string, preferences: PreferenceRuleV1[] = [], opening: OpeningContextV1 = {}): { hard_blocks: string[]; soft_blocks: string[] } {
  const hardBlocks: string[] = []
  const softBlocks: string[] = []
  const editorial = candidate.editorial
  if (!editorial) return { hard_blocks: ['short-native script requires an explicit Codex editorial assessment'], soft_blocks: [] }
  if (editorial.disposition !== 'publishable') hardBlocks.push(`editorial disposition is ${editorial.disposition}; do not create a recording brief`)
  for (const [name, passed] of Object.entries(editorial.semantic_checks)) if (!passed) hardBlocks.push(`semantic check failed: ${name.replaceAll('_', ' ')}`)
  if (Object.values(editorial.semantic_checks).some((passed) => !passed) && !editorial.semantic_failure_notes.length) hardBlocks.push('failed semantic checks require specific failure notes')
  const scoreThresholds: Array<[keyof typeof editorial.scores, number]> = [
    ['semantic_coherence', thresholds.semantic_coherence],
    ['impact', thresholds.impact],
    ['relevance', thresholds.relevance],
    ['insight', thresholds.insight],
    ['specificity', thresholds.specificity],
    ['audience_value', thresholds.audience_value],
    ['hook_strength', thresholds.hook_strength],
    ['ending_strength', thresholds.ending_strength],
  ]
  for (const [name, minimum] of scoreThresholds) if (editorial.scores[name] < minimum) hardBlocks.push(`${name.replaceAll('_', ' ')} is below the publishable threshold`)
  hardBlocks.push(...captionTreatmentIssues(candidate.transcript))
  if (!/[.!?]["')\]]?$/.test(candidate.transcript.trim())) hardBlocks.push('short-native script must end on a complete sentence')
  const presenterMentions = candidate.identity_mentions.filter((mention) => mention.role === 'presenter')
  if (presenterName && presenterMentions.some((mention) => normalizeSpokenToken(mention.name) !== normalizeSpokenToken(presenterName))) hardBlocks.push(`presenter identity violation: the verified presenter is ${presenterName}`)
  const declaredNonPresenterChris = candidate.identity_mentions.some((mention) => normalizeSpokenToken(mention.name) === 'chris' && mention.role !== 'presenter')
  if (presenterName?.toLowerCase() === 'krish' && /\bchris\b/i.test(`${candidate.transcript} ${candidate.hook} ${candidate.payoff}`) && !declaredNonPresenterChris) hardBlocks.push('unresolved identity mention: the verified presenter is Krish; declare a real guest or subject named Chris explicitly')
  if (candidate.transcript.split(/\s+/).length > 180) softBlocks.push('short-native script may exceed the intended short-form duration; verify delivery time before recording')
  softBlocks.push(...editorialPreferenceIssues(candidate, preferences))
  const openingContract = openingContractIssues(candidate, thresholds, opening, false)
  hardBlocks.push(...openingContract.hard_blocks)
  softBlocks.push(...openingContract.soft_blocks)
  return { hard_blocks: [...new Set(hardBlocks)], soft_blocks: [...new Set(softBlocks)] }
}
