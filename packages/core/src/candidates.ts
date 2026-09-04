import { CandidateV1Schema, SCHEMA_VERSION, type CandidateV1, type JobManifestV1 } from '@mindmake/contracts'
import { hashValue } from './hash.js'

export interface TranscriptWord {
  start_ms: number
  end_ms: number
  text: string
  probability?: number
}

export interface TranscriptSegment {
  start_ms: number
  end_ms: number
  text: string
  speaker?: string
  words?: TranscriptWord[]
}

export interface TranscriptQuality {
  score: number
  acceptable: boolean
  issues: string[]
  mean_word_probability: number | null
  complete_ending: boolean
}

export interface TranscriptDocument {
  language: string
  source: 'captions' | 'faster_whisper' | 'manual'
  model?: string
  verified?: boolean
  segments: TranscriptSegment[]
  quality?: TranscriptQuality
  corrections?: Array<{ from: string; to: string; reason: string; segment_index: number; word_index?: number }>
}

function words(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+(?:['’-][a-z0-9]+)*/g) || []
}

function orderedSimilarity(left: string[], right: string[]): number {
  if (!left.length || !right.length) return 0
  const row = new Array<number>(right.length + 1).fill(0)
  for (const token of left) {
    let diagonal = 0
    for (let index = 1; index <= right.length; index += 1) {
      const above = row[index] || 0
      row[index] = token === right[index - 1] ? diagonal + 1 : Math.max(row[index - 1] || 0, above)
      diagonal = above
    }
  }
  return (2 * (row.at(-1) || 0)) / (left.length + right.length)
}

export function transcriptText(transcript: TranscriptDocument): string {
  return transcript.segments.map((segment) => segment.text.trim()).filter(Boolean).join(' ')
}

export function assessTranscriptQuality(transcript: TranscriptDocument): TranscriptQuality {
  const text = transcriptText(transcript)
  const allWords = words(text)
  const timedWords = transcript.segments.flatMap((segment) => segment.words || [])
  const probabilities = timedWords.map((word) => word.probability).filter((value): value is number => Number.isFinite(value))
  const meanProbability = probabilities.length ? probabilities.reduce((sum, value) => sum + value, 0) / probabilities.length : null
  const issues: string[] = []
  const completeEnding = /[.!?]["')\]]?\s*$/.test(text)
  const fillerCount = allWords.filter((word) => ['um', 'uh', 'erm', 'hmm'].includes(word)).length
  const uniqueRatio = new Set(allWords).size / Math.max(1, allWords.length)
  const emptySegments = transcript.segments.filter((segment) => !segment.text.trim() || segment.end_ms <= segment.start_ms).length

  if (allWords.length < 8) issues.push('transcript contains too little speech to assess')
  if (!completeEnding) issues.push('recording or excerpt ends without a complete sentence')
  if (fillerCount / Math.max(1, allWords.length) > 0.08) issues.push('transcript contains unusually dense hesitation markers')
  if (allWords.length >= 20 && uniqueRatio < 0.35) issues.push('transcript contains suspicious repetition')
  if (emptySegments) issues.push('transcript contains empty or invalid timed segments')
  if (meanProbability !== null && meanProbability < 0.72) issues.push('automatic word confidence is below the safe threshold')

  const score = Math.max(0, Math.min(1, 1
    - (!completeEnding ? 0.22 : 0)
    - (fillerCount / Math.max(1, allWords.length) > 0.08 ? 0.2 : 0)
    - (allWords.length >= 20 && uniqueRatio < 0.35 ? 0.25 : 0)
    - (emptySegments ? 0.3 : 0)
    - (meanProbability !== null && meanProbability < 0.72 ? 0.35 : 0)
    - (allWords.length < 8 ? 0.5 : 0)))
  return { score, acceptable: score >= 0.72 && !emptySegments, issues, mean_word_probability: meanProbability, complete_ending: completeEnding }
}

export function alignScriptToTranscript(script: string, transcript: TranscriptDocument): { start_ms: number; end_ms: number; similarity: number } {
  const wanted = words(script)
  if (!wanted.length || !transcript.segments.length) throw new Error('cannot align an empty script or transcript')
  const targetWords = Math.max(8, wanted.length)
  let best = { start_ms: 0, end_ms: 0, similarity: 0 }
  for (let startIndex = 0; startIndex < transcript.segments.length; startIndex += 1) {
    let text = ''
    for (let endIndex = startIndex; endIndex < transcript.segments.length; endIndex += 1) {
      const segment = transcript.segments[endIndex]
      if (!segment) continue
      text = `${text} ${segment.text}`.trim()
      const count = words(text).length
      if (count < targetWords * 0.65) continue
      const found = words(text)
      const similarity = orderedSimilarity(wanted, found)
      if (similarity > best.similarity) best = { start_ms: transcript.segments[startIndex]?.start_ms ?? 0, end_ms: segment.end_ms, similarity }
      if (count > targetWords * 1.45) break
    }
  }
  if (best.similarity < 0.5) throw new Error(`recorded take could not be matched confidently to the approved script (${best.similarity.toFixed(2)})`)
  return best
}

const AI_CONTEXT = /\b(ai|artificial intelligence|llm|large language model|language model|machine learning|agentic?|copilot|chatgpt|claude|gemini|foundation model|model inference)\b/i
const MONEY_MECHANISM = /\b(cost|revenue|margin|profit|budget|roi|return|commercial|enterprise|buyer|customer|market|pricing|spend|deal|productivity|risk|governance|strategy|advantage)\b/i
const BUILD_MECHANISM = /\b(build|built|workflow|implementation|api|prompt|agent|tool|code|interface|stack|system|test|deploy|automation|handoff|prototype|artifact|integration)\b/i

export function seriesFit(text: string, series: JobManifestV1['series']): number {
  const ai = AI_CONTEXT.test(text)
  const mechanism = (series === 'money_of_ai' ? MONEY_MECHANISM : BUILD_MECHANISM).test(text)
  if (!ai && !mechanism) return 0.1
  if (!ai) return 0.3
  if (!mechanism) return 0.45
  return 0.86
}

function clarityScore(text: string): number {
  const allWords = words(text)
  const sentenceCount = Math.max(1, text.split(/[.!?]+/).filter((part) => words(part).length).length)
  const complete = /[.!?]["')\]]?\s*$/.test(text)
  const fillerRatio = allWords.filter((word) => ['um', 'uh', 'erm', 'hmm'].includes(word)).length / Math.max(1, allWords.length)
  const discourseFillers = [...text.matchAll(/\b(?:you know|i mean|sort of|kind of)\b/gi)].length / Math.max(1, allWords.length)
  const averageSentence = allWords.length / sentenceCount
  const sentenceShape = averageSentence >= 5 && averageSentence <= 35 ? 1 : 0.55
  const raw = 0.35 + (complete ? 0.25 : 0) + sentenceShape * 0.2 + Math.max(0, 0.2 - fillerRatio * 2 - discourseFillers * 3)
  return Math.max(0.15, Math.min(complete ? 0.9 : 0.6, raw))
}

function extractHook(text: string): string {
  const first = text.split(/(?<=[.!?])\s+/)[0]?.trim() || text.trim()
  return first.split(/\s+/).slice(0, 18).join(' ')
}

function extractPayoff(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  return (sentences.at(-1) || text).trim()
}

function claimLike(sentence: string): boolean {
  const properNoun = /\b[A-Z][a-z]+(?:\s+[A-Z][A-Za-z]+)+\b/.test(sentence) || /\b(?:Meta|Google|Microsoft|OpenAI|Anthropic|LinkedIn|YouTube)\b/.test(sentence)
  const quantified = /(?:\b\d+(?:\.\d+)?%?\b|[£$€])/i.test(sentence)
  const consequential = /\b(?:increased|decreased|reduced|grew|costs?|revenue|margin|faster|slower|replaced|requires?|prohibits?|allows?|law|legal|guidance|policy|compliance|proof|guarantee|best|first|only)\b/i.test(sentence)
  return properNoun || quantified || consequential
}

export function detectClaimLikeSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0 && claimLike(sentence))
}

function extractClaims(text: string, sourceRef: string): CandidateV1['claims'] {
  const sourceUrls = /^https?:\/\//i.test(sourceRef) ? [sourceRef] : []
  return detectClaimLikeSentences(text)
    .slice(0, 8)
    .map((sentence) => ({ text: sentence, kind: 'fact' as const, evidence_urls: sourceUrls, verification: 'needs_review' as const }))
}

function scoreText(text: string, job: JobManifestV1, claims: CandidateV1['claims']): CandidateV1['scores'] {
  const count = words(text).length
  const lengthFit = Math.max(0, 1 - Math.abs(count - 105) / 105)
  const tension = /\b(but|wrong|fail|instead|problem|cost|risk|never|actually)\b/i.test(text) ? 0.9 : 0.5
  const evidence = /\b(\d+(?:\.\d+)?%?|because|for example|we built|we tested|the data|here is|this shows)\b/i.test(text) ? 0.78 : 0.38
  const novelty = /\b(counterintuitive|opposite|not the|instead of|turns out)\b/i.test(text) ? 0.82 : 0.5
  return {
    truth: claims.length ? 0.45 : 0.65,
    evidence,
    clarity: clarityScore(text),
    tension,
    payoff: /[.!?]["')\]]?\s*$/.test(text) ? lengthFit : Math.min(0.4, lengthFit),
    visual_proof: evidence,
    qualified_fit: seriesFit(text, job.series),
    novelty,
  }
}

export function generateCandidates(job: JobManifestV1, transcript: TranscriptDocument, max = 8): CandidateV1[] {
  const transcriptQuality = transcript.quality || assessTranscriptQuality(transcript)
  const windows: TranscriptSegment[] = []
  for (let index = 0; index < transcript.segments.length; index += 1) {
    let text = ''
    const start = transcript.segments[index]?.start_ms ?? 0
    let end = start
    for (let cursor = index; cursor < transcript.segments.length; cursor += 1) {
      const segment = transcript.segments[cursor]
      if (!segment) continue
      text = `${text} ${segment.text}`.trim()
      end = segment.end_ms
      if (end - start >= 25_000 || words(text).length >= 75) break
    }
    const duration = end - start
    if (duration >= 18_000 && duration <= 75_000) windows.push({ start_ms: start, end_ms: end, text })
  }

  return windows
    .map((window, index) => {
      const claims = extractClaims(window.text, job.source.ref)
      const scores = scoreText(window.text, job, claims)
      const hardBlocks = job.source.rights === 'unverified' ? ['source rights are unverified'] : []
      hardBlocks.push('discovery candidate requires an authored editorial assessment and exact edit plan before angle approval')
      if (!transcriptQuality.acceptable) hardBlocks.push(`transcript quality gate failed: ${transcriptQuality.issues.join('; ') || 'manual verification required'}`)
      if (claims.length && transcript.source !== 'manual' && transcript.verified !== true) hardBlocks.push('proper nouns, numbers, products, legal wording, and consequential claims require human verification')
      const softBlocks: string[] = []
      if (scores.clarity < 0.65) softBlocks.push('the excerpt needs a clearer standalone setup')
      if (scores.tension < 0.65) softBlocks.push('the opening lacks a strong first-beat tension')
      if (scores.qualified_fit < 0.65) softBlocks.push(`the excerpt does not yet demonstrate a credible ${job.series === 'money_of_ai' ? 'AI business mechanism' : 'AI build, workflow, or implementation mechanism'}`)
      if (!/[.!?]["')\]]?\s*$/.test(window.text)) softBlocks.push('the excerpt ends before a complete payoff')
      if (job.purpose === 'calibration') softBlocks.push('calibration jobs are analysis-only and cannot create publishable packages')
      const candidate = {
        schema_version: SCHEMA_VERSION,
        candidate_id: hashValue({ job_id: job.job_id, start_ms: window.start_ms, end_ms: window.end_ms, text: window.text, index }).slice(0, 24),
        job_id: job.job_id,
        series: job.series,
        mode: job.mode,
        start_ms: window.start_ms,
        end_ms: window.end_ms,
        transcript: window.text,
        hook: extractHook(window.text),
        payoff: extractPayoff(window.text),
        scores,
        claims,
        challenge: {
          strongest_objection: hardBlocks[0] || softBlocks[0] || 'No credible contradiction found. The excerpt may still need earlier proof to earn attention.',
          safer_version: `Open directly on the verified mechanism: ${extractHook(window.text)}`,
          stretch_version: 'State the strongest defensible consequence first, then prove it with the source excerpt.',
          recommendation: hardBlocks.length ? 'Do not proceed until the hard block is cleared.' : softBlocks.length ? 'Resolve the soft blocks or record a narrow override reason.' : 'Keep the speaker primary and move the first concrete proof into the opening third.',
          hard_blocks: [...new Set(hardBlocks)],
          soft_blocks: [...new Set(softBlocks)],
        },
        source_refs: [job.source.ref],
      }
      return CandidateV1Schema.parse(candidate)
    })
    .sort((a, b) => Object.values(b.scores).reduce((x, y) => x + y, 0) - Object.values(a.scores).reduce((x, y) => x + y, 0))
    .slice(0, max)
}
