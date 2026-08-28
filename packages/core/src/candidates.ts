import { randomUUID } from 'node:crypto'
import { CandidateV1Schema, SCHEMA_VERSION, type CandidateV1, type JobManifestV1 } from '@mindmake/contracts'

export interface TranscriptSegment {
  start_ms: number
  end_ms: number
  text: string
  speaker?: string
  words?: Array<{ start_ms: number; end_ms: number; text: string }>
}

export interface TranscriptDocument {
  language: string
  source: 'captions' | 'faster_whisper' | 'manual'
  segments: TranscriptSegment[]
}

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((word) => word.length > 2))
}

export function alignScriptToTranscript(script: string, transcript: TranscriptDocument): { start_ms: number; end_ms: number; similarity: number } {
  const wanted = tokens(script)
  if (!wanted.size || !transcript.segments.length) throw new Error('cannot align an empty script or transcript')
  const targetWords = Math.max(8, script.split(/\s+/).filter(Boolean).length)
  let best = { start_ms: 0, end_ms: 0, similarity: 0 }
  for (let startIndex = 0; startIndex < transcript.segments.length; startIndex += 1) {
    let text = ''
    for (let endIndex = startIndex; endIndex < transcript.segments.length; endIndex += 1) {
      const segment = transcript.segments[endIndex]
      if (!segment) continue
      text = `${text} ${segment.text}`.trim()
      const count = text.split(/\s+/).filter(Boolean).length
      if (count < targetWords * 0.65) continue
      const found = tokens(text)
      const overlap = [...wanted].filter((word) => found.has(word)).length
      const similarity = (2 * overlap) / (wanted.size + found.size)
      if (similarity > best.similarity) best = { start_ms: transcript.segments[startIndex]?.start_ms ?? 0, end_ms: segment.end_ms, similarity }
      if (count > targetWords * 1.45) break
    }
  }
  if (best.similarity < 0.5) throw new Error(`recorded take could not be matched confidently to the approved script (${best.similarity.toFixed(2)})`)
  return best
}

function scoreText(text: string): CandidateV1['scores'] {
  const words = text.split(/\s+/).filter(Boolean)
  const lengthFit = Math.max(0, 1 - Math.abs(words.length - 105) / 105)
  const tension = /\b(but|wrong|fail|instead|problem|cost|risk|never|actually)\b/i.test(text) ? 0.9 : 0.55
  const evidence = /\b(\d+(?:\.\d+)?%?|because|for example|we built|we tested|the data)\b/i.test(text) ? 0.8 : 0.45
  const clarity = words.length > 40 && words.length < 180 ? 0.8 : 0.55
  const novelty = /\b(counterintuitive|opposite|not the|instead of|turns out)\b/i.test(text) ? 0.85 : 0.55
  return { truth: 0.6, evidence, clarity, tension, payoff: lengthFit, visual_proof: evidence, qualified_fit: 0.78, novelty }
}

function extractHook(text: string): string {
  const first = text.split(/(?<=[.!?])\s+/)[0]?.trim() || text.trim()
  return first.split(/\s+/).slice(0, 18).join(' ')
}

function extractPayoff(text: string): string {
  const sentences = text.split(/(?<=[.!?])\s+/).filter(Boolean)
  return (sentences.at(-1) || text).trim()
}

function extractClaims(text: string, sourceRef: string): CandidateV1['claims'] {
  const sourceUrls = /^https?:\/\//i.test(sourceRef) ? [sourceRef] : []
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => /(?:\b\d+(?:\.\d+)?%?\b|[£$€]|\b(?:increased|decreased|reduced|grew|costs?|revenue|margin|faster|slower|replaced)\b)/i.test(sentence))
    .slice(0, 6)
    .map((sentence) => ({ text: sentence, kind: 'fact' as const, evidence_urls: sourceUrls, verification: 'needs_review' as const }))
}

export function generateCandidates(job: JobManifestV1, transcript: TranscriptDocument, max = 8): CandidateV1[] {
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
      if (end - start >= 25_000 || text.split(/\s+/).length >= 75) break
    }
    const duration = end - start
    if (duration >= 18_000 && duration <= 75_000) windows.push({ start_ms: start, end_ms: end, text })
  }

  return windows
    .map((window) => {
      const scores = scoreText(window.text)
      const hardBlocks = job.source.rights === 'unverified' ? ['source rights are unverified'] : []
      const claims = extractClaims(window.text, job.source.ref)
      if (claims.length) hardBlocks.push('proper nouns, numbers, products, and consequential claims require human verification')
      const softBlocks = [] as string[]
      if (scores.clarity < 0.65) softBlocks.push('the excerpt needs a clearer standalone setup')
      if (scores.tension < 0.65) softBlocks.push('the opening lacks a strong first-beat tension')
      const candidate = {
        schema_version: SCHEMA_VERSION,
        candidate_id: randomUUID(),
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
          strongest_objection: softBlocks[0] || 'The excerpt may be sound but still need earlier proof to earn attention.',
          safer_version: `Open directly on the verified mechanism: ${extractHook(window.text)}`,
          stretch_version: `State the strongest defensible consequence first, then prove it with the source excerpt.`,
          recommendation: hardBlocks.length ? 'Do not proceed until the hard block is cleared.' : 'Keep the speaker primary and move the first concrete proof into the opening third.',
          hard_blocks: hardBlocks,
          soft_blocks: softBlocks,
        },
        source_refs: [job.source.ref],
      }
      return CandidateV1Schema.parse(candidate)
    })
    .sort((a, b) => Object.values(b.scores).reduce((x, y) => x + y, 0) - Object.values(a.scores).reduce((x, y) => x + y, 0))
    .slice(0, max)
}
