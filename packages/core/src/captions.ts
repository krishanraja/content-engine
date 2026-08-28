import { readFile } from 'node:fs/promises'
import type { RenderManifestV1 } from '@mindmake/contracts'
import type { TranscriptDocument, TranscriptSegment } from './candidates.js'

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
