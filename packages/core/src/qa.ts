import { readFile } from 'node:fs/promises'
import type { RenderManifestV1 } from '@mindmake/contracts'
import { analyzeLoudness, framePerceptualHashes, probeMedia } from './media.js'

export interface QaCheck { name: string; status: 'pass' | 'warn' | 'fail'; detail: string }
export interface QaVerdict {
  passed: boolean
  checks: QaCheck[]
  functional_fingerprint: { frame_ahashes: string[]; integrated_lufs: number | null; true_peak_dbtp: number | null }
  checked_at: string
}

export function publicCopyChecks(text: string): QaCheck[] {
  const checks: QaCheck[] = []
  if (/\bPaid\b/.test(text)) checks.push({ name: 'canonical_naming', status: 'fail', detail: 'Legacy public series name Paid found.' })
  if (/\bseries["']?\s*[:=]\s*["']built["']/i.test(text)) checks.push({ name: 'canonical_naming', status: 'fail', detail: 'Legacy Built series identifier found in public copy.' })
  if (/—/.test(text)) checks.push({ name: 'voice', status: 'fail', detail: 'Em dash found in public copy.' })
  if (!checks.length) checks.push({ name: 'public_copy', status: 'pass', detail: 'Canonical naming and punctuation checks passed.' })
  return checks
}

export async function qaVideo(path: string, publicTextPaths: string[] = [], manifest?: RenderManifestV1): Promise<QaVerdict> {
  const media = await probeMedia(path)
  const loudness = await analyzeLoudness(path)
  const frameHashes = await framePerceptualHashes(path)
  const checks: QaCheck[] = [
    { name: 'dimensions', status: media.width === 1080 && media.height === 1920 ? 'pass' : 'fail', detail: `${media.width}x${media.height}` },
    { name: 'frame_rate', status: Math.abs(media.average_fps - 30) < 0.01 ? 'pass' : 'fail', detail: `${media.average_fps.toFixed(3)} fps` },
    { name: 'audio_rate', status: media.audio_hz === 48000 ? 'pass' : 'fail', detail: `${media.audio_hz ?? 'missing'} Hz` },
    { name: 'duration', status: media.duration_seconds > 0 && media.duration_seconds <= 180 ? 'pass' : 'warn', detail: `${media.duration_seconds.toFixed(3)} seconds` },
    { name: 'integrated_loudness', status: loudness.integrated_lufs !== null && Math.abs(loudness.integrated_lufs + 14) <= 1 ? 'pass' : 'fail', detail: `${loudness.integrated_lufs ?? 'unmeasured'} LUFS` },
    { name: 'true_peak', status: loudness.true_peak_dbtp !== null && loudness.true_peak_dbtp <= -0.8 ? 'pass' : 'fail', detail: `${loudness.true_peak_dbtp ?? 'unmeasured'} dBTP` },
  ]
  if (manifest) {
    const captionsValid = manifest.captions.every((cue) => cue.text.length <= 42 && cue.text.split(/\s+/).length <= 6 && cue.start_ms >= 0 && cue.end_ms <= manifest.duration_ms && cue.end_ms > cue.start_ms)
    checks.push({ name: 'caption_safe_zone', status: captionsValid ? 'pass' : 'fail', detail: captionsValid ? 'Phrase captions fit the two-line safe-zone budget.' : 'At least one caption exceeds timing or two-line safe-zone limits.' })
    const provenance = manifest.caption_provenance
    checks.push({
      name: 'caption_alignment',
      status: provenance && provenance.alignment_similarity >= 0.9 ? 'pass' : 'fail',
      detail: provenance ? `Caption text alignment similarity is ${provenance.alignment_similarity.toFixed(3)}.` : 'Caption provenance and semantic alignment are missing.',
    })
    checks.push({
      name: 'caption_verification',
      status: provenance?.verified ? 'pass' : 'fail',
      detail: provenance?.verified ? `Caption wording is tied to the approved transcript artifact (${provenance.source}).` : 'Caption wording has not been verified against an approved transcript artifact.',
    })
    checks.push({
      name: 'caption_word_fidelity',
      status: provenance?.exact_word_fidelity ? 'pass' : 'fail',
      detail: provenance?.exact_word_fidelity ? `All ${provenance.caption_token_count} caption tokens are drawn from ${provenance.source_token_count} verified source tokens in edit order.` : 'Captions contain changed, invented, or reordered words.',
    })
  }
  for (const textPath of publicTextPaths) checks.push(...publicCopyChecks(await readFile(textPath, 'utf8')))
  return {
    passed: checks.every((check) => check.status !== 'fail'),
    checks,
    functional_fingerprint: { frame_ahashes: frameHashes, ...loudness },
    checked_at: new Date().toISOString(),
  }
}
