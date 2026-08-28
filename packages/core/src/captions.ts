import { readFile } from 'node:fs/promises'
import type { RenderManifestV1 } from '@mindmake/contracts'
import type { TranscriptDocument, TranscriptSegment } from './candidates.js'

function normalizedWords(value: string): string[] {
  return value.toLowerCase().match(/[a-z0-9]+(?:['’-][a-z0-9]+)*/g) || []
}

function timestampMs(value: string): number {
  const normalized = value.trim().replace(',', '.')
  const parts = normalized.split(':').map(Number)
  if (parts.some((part) => !Number.isFinite(part))) throw new Error(`invalid caption timestamp: ${value}`)
  return Math.round(parts.reduce((total, part) => total * 60 + part, 0) * 1000)
}

export async function loadCaptionTranscript(path: string): Promise<TranscriptDocument> {
  const body = (await readFile(path, 'utf8')).replace(/^\uFEFF/, '').replace(/^WEBVTT[^\n]*\n+/i, '')
  const blocks = body.split(/\r?\n\s*\r?\n/)
  const segments: TranscriptSegment[] = []
  for (const block of blocks) {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    const timingIndex = lines.findIndex((line) => line.includes('-->'))
    if (timingIndex < 0) continue
    const [start, endWithSettings] = (lines[timingIndex] as string).split('-->').map((value) => value.trim())
    const end = endWithSettings?.split(/\s+/)[0]
    if (!start || !end) continue
    const text = lines.slice(timingIndex + 1).join(' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (!text) continue
    segments.push({ start_ms: timestampMs(start), end_ms: timestampMs(end), text })
  }
  if (!segments.length) throw new Error('caption file contains no timed cues')
  return { language: 'unknown', source: 'captions', segments }
}

export function wordTimedCaptionCues(transcript: TranscriptDocument, durationMs: number): RenderManifestV1['captions'] {
  const words = transcript.segments.flatMap((segment) => segment.words?.length
    ? segment.words
    : segment.text.split(/\s+/).filter(Boolean).map((text, index, values) => ({
      start_ms: Math.round(segment.start_ms + (segment.end_ms - segment.start_ms) * index / values.length),
      end_ms: Math.round(segment.start_ms + (segment.end_ms - segment.start_ms) * (index + 1) / values.length),
      text,
    })))
  const cues: RenderManifestV1['captions'] = []
  let group: typeof words = []
  const flush = () => {
    if (!group.length) return
    cues.push({
      start_ms: Math.max(0, group[0]?.start_ms ?? 0),
      end_ms: Math.min(durationMs, group.at(-1)?.end_ms ?? durationMs),
      text: group.map((word) => word.text).join(' '),
      emphasis: group.map((word) => word.text.replace(/[^a-z0-9]/gi, '')).filter((word) => /^(not|but|cost|proof|build|risk|why|how|actually)$/i.test(word)),
    })
    group = []
  }
  for (const word of words) {
    const nextText = [...group, word].map((item) => item.text).join(' ')
    const gap = group.length ? word.start_ms - (group.at(-1)?.end_ms ?? word.start_ms) : 0
    if (group.length && (group.length >= 5 || nextText.length > 38 || gap > 320)) flush()
    group.push(word)
  }
  flush()
  return cues.filter((cue) => cue.end_ms > cue.start_ms)
}

export function sliceTranscript(transcript: TranscriptDocument, startMs: number, endMs: number): TranscriptDocument {
  const segments = transcript.segments
    .filter((segment) => segment.end_ms > startMs && segment.start_ms < endMs)
    .map((segment) => ({
      ...segment,
      start_ms: Math.max(0, segment.start_ms - startMs),
      end_ms: Math.min(endMs - startMs, segment.end_ms - startMs),
      ...(segment.words ? {
        words: segment.words
          .filter((word) => word.end_ms > startMs && word.start_ms < endMs)
          .map((word) => ({
            ...word,
            start_ms: Math.max(0, word.start_ms - startMs),
            end_ms: Math.min(endMs - startMs, word.end_ms - startMs),
          }))
          .filter((word) => word.end_ms > word.start_ms),
      } : {}),
    }))
    .filter((segment) => segment.end_ms > segment.start_ms)
  return { ...transcript, segments }
}

export function captionTranscriptSimilarity(captions: RenderManifestV1['captions'], expectedText: string): number {
  const actual = normalizedWords(captions.map((cue) => cue.text).join(' '))
  const expected = normalizedWords(expectedText)
  if (!actual.length || !expected.length) return 0
  const rows = new Array<number>(expected.length + 1).fill(0)
  for (const word of actual) {
    let diagonal = 0
    for (let index = 1; index <= expected.length; index += 1) {
      const above = rows[index] || 0
      rows[index] = word === expected[index - 1] ? diagonal + 1 : Math.max(rows[index - 1] || 0, above)
      diagonal = above
    }
  }
  return (2 * (rows.at(-1) || 0)) / (actual.length + expected.length)
}

export function verifiedTextCaptionCues(text: string, timedTranscript: TranscriptDocument, durationMs: number): RenderManifestV1['captions'] {
  const targetWords = text.split(/\s+/).filter(Boolean)
  if (!targetWords.length) return []
  const sourceWords = timedTranscript.segments.flatMap((segment) => segment.words?.length
    ? segment.words
    : segment.text.split(/\s+/).filter(Boolean).map((word, index, values) => ({
      text: word,
      start_ms: Math.round(segment.start_ms + (segment.end_ms - segment.start_ms) * index / values.length),
      end_ms: Math.round(segment.start_ms + (segment.end_ms - segment.start_ms) * (index + 1) / values.length),
    })))
  const first = sourceWords[0]?.start_ms ?? 0
  const last = sourceWords.at(-1)?.end_ms ?? durationMs
  const span = Math.max(targetWords.length, last - first)
  const aligned: TranscriptDocument = {
    language: timedTranscript.language,
    source: timedTranscript.source,
    verified: true,
    segments: [{
      start_ms: first,
      end_ms: last,
      text,
      words: targetWords.map((word, index) => ({
        text: word,
        start_ms: Math.round(first + span * index / targetWords.length),
        end_ms: Math.max(Math.round(first + span * (index + 1) / targetWords.length), Math.round(first + span * index / targetWords.length) + 1),
      })),
    }],
  }
  return wordTimedCaptionCues(aligned, durationMs)
}
