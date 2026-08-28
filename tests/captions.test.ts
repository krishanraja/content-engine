import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, describe, expect, it } from 'vitest'
import { alignScriptToTranscript, captionTranscriptSimilarity, loadCaptionTranscript, verifiedTextCaptionCues, wordTimedCaptionCues } from '@mindmake/core'

describe('caption workflow', () => {
  let root = ''

  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true })
  })

  it('imports SRT for coarse search and creates bounded phrase cues', async () => {
    root = await mkdtemp(join(tmpdir(), 'mindmake-caption-'))
    const path = join(root, 'source.srt')
    await writeFile(path, '1\n00:00:00,000 --> 00:00:02,000\nThe proof should arrive first.\n\n2\n00:00:02,100 --> 00:00:04,000\nThen explain how it works.\n')
    const transcript = await loadCaptionTranscript(path)
    expect(transcript.source).toBe('captions')
    const cues = wordTimedCaptionCues(transcript, 4000)
    expect(cues.every((cue) => cue.text.length <= 38 && cue.text.split(/\s+/).length <= 5)).toBe(true)
    expect(cues.at(-1)?.end_ms).toBeLessThanOrEqual(4000)
  })

  it('aligns an approved short-native script to its recorded take', () => {
    const aligned = alignScriptToTranscript('The useful part is the workflow, not the model. Here is how it changes the handoff.', {
      language: 'en',
      source: 'manual',
      segments: [
        { start_ms: 0, end_ms: 2000, text: 'Take one was not right.' },
        { start_ms: 3000, end_ms: 6000, text: 'The useful part is the workflow, not the model.' },
        { start_ms: 6000, end_ms: 9000, text: 'Here is how it changes the handoff.' },
      ],
    })
    expect(aligned.start_ms).toBe(3000)
    expect(aligned.end_ms).toBe(9000)
    expect(aligned.similarity).toBeGreaterThan(0.8)
  })

  it('preserves approved wording while reusing existing word timings', () => {
    const transcript = {
      language: 'en',
      source: 'faster_whisper' as const,
      segments: [{
        start_ms: 0,
        end_ms: 4000,
        text: 'Chris built the workflow',
        words: [
          { start_ms: 0, end_ms: 800, text: 'Chris' },
          { start_ms: 900, end_ms: 1600, text: 'built' },
          { start_ms: 1700, end_ms: 2400, text: 'the' },
          { start_ms: 2500, end_ms: 4000, text: 'workflow' },
        ],
      }],
    }
    const cues = verifiedTextCaptionCues('Krish built the workflow.', transcript, 4000)
    expect(cues.map((cue) => cue.text).join(' ')).toBe('Krish built the workflow.')
    expect(captionTranscriptSimilarity(cues, 'Krish built the workflow.')).toBe(1)
  })
})
