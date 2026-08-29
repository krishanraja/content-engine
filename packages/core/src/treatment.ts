import { basename, extname, join, resolve } from 'node:path'
import { copyFile, mkdir, readFile } from 'node:fs/promises'
import {
  CandidateV1Schema,
  PUBLIC_SERIES_NAMES,
  RenderManifestV1Schema,
  SCHEMA_VERSION,
  type ApprovedTreatmentPresetV1,
  type BrandThemeV1,
  type EvidenceOverlayV1,
  type RenderManifestV1,
  type Series,
  type SourceMode,
} from '@mindmake/contracts'
import { hashFile, hashValue } from './hash.js'
import { assembleClip, probeMedia } from './media.js'
import { jobPath } from './paths.js'
import { alignScriptToTranscript, type TranscriptDocument } from './candidates.js'
import { captionTranscriptSimilarity, sliceTranscript, verifiedTextCaptionCues } from './captions.js'
import { composeEditTranscript, exactWordFidelity } from './editorial.js'

function captionCues(text: string, durationMs: number): RenderManifestV1['captions'] {
  const words = text.split(/\s+/).filter(Boolean)
  const groups: string[][] = []
  let group: string[] = []
  for (const word of words) {
    const next = [...group, word]
    if (group.length && (next.length > 5 || next.join(' ').length > 38)) {
      groups.push(group)
      group = [word]
    } else group = next
  }
  if (group.length) groups.push(group)
  const perGroup = durationMs / Math.max(1, groups.length)
  return groups.map((group, index) => ({
    start_ms: Math.round(index * perGroup),
    end_ms: Math.max(Math.round((index + 1) * perGroup), Math.round(index * perGroup) + 1),
    text: group.join(' '),
    emphasis: group.filter((word) => /\b(not|but|cost|proof|build|risk|why|how|actually)\b/i.test(word.replace(/[^a-z]/gi, ''))).map((word) => word.replace(/[^a-z0-9]/gi, '')),
  }))
}

function cropFor(width: number, height: number, treatmentId: string): RenderManifestV1['crop'] {
  const target = 9 / 16
  const input = width / height
  if (input > target) {
    const cropWidth = height * target
    const x = /left/i.test(treatmentId) ? 0 : /right/i.test(treatmentId) ? width - cropWidth : (width - cropWidth) / 2
    return { x: Math.round(x), y: 0, width: Math.round(cropWidth), height }
  }
  const cropHeight = width / target
  return { x: 0, y: Math.round((height - cropHeight) / 2), width, height: Math.round(cropHeight) }
}

function styleFor(treatmentId: string): RenderManifestV1['style'] {
  if (/evidence-kinetic/i.test(treatmentId)) return { caption_position: 'lower', caption_scale: 1.02, hook_card_ms: 0, proof_motif: 'evidence', caption_personality: 'kinetic' }
  if (/caption-led/i.test(treatmentId)) return { caption_position: 'middle', caption_scale: 1.12, hook_card_ms: 0, proof_motif: 'mechanism', caption_personality: 'kinetic' }
  if (/proof-first/i.test(treatmentId)) return { caption_position: 'lower', caption_scale: 0.95, hook_card_ms: 1200, proof_motif: 'evidence', caption_personality: 'clean' }
  if (/conversation/i.test(treatmentId)) return { caption_position: 'lower', caption_scale: 0.92, hook_card_ms: 0, proof_motif: 'evidence', caption_personality: 'clean' }
  return { caption_position: 'lower', caption_scale: 1, hook_card_ms: 0, proof_motif: 'artifact', caption_personality: 'clean' }
}

export function treatmentPresetMatchesScope(preset: ApprovedTreatmentPresetV1, series: Series, mode: SourceMode): boolean {
  return preset.status === 'approved' && preset.scope.series.includes(series) && preset.scope.modes.includes(mode)
}

export function resolveApprovedTreatmentPreset(
  presets: ApprovedTreatmentPresetV1[],
  series: Series,
  mode: SourceMode,
  requestedTreatmentId?: string,
  approvedEvidenceAvailable = false,
): ApprovedTreatmentPresetV1 | undefined {
  if (requestedTreatmentId) {
    const requested = presets.find((preset) => preset.treatment_id === requestedTreatmentId)
    if (!requested) return undefined
    if (!treatmentPresetMatchesScope(requested, series, mode)) throw new Error(`approved treatment ${requestedTreatmentId} is outside its ${series}/${mode} scope`)
    return requested
  }
  const eligible = presets
    .filter((preset) => treatmentPresetMatchesScope(preset, series, mode))
    .filter((preset) => !preset.evidence_policy.requires_approved_packet || approvedEvidenceAvailable)
    .sort((left, right) => right.priority - left.priority || left.treatment_id.localeCompare(right.treatment_id))
  if (eligible.length > 1 && eligible[0]?.priority === eligible[1]?.priority) throw new Error(`multiple approved treatments share priority ${eligible[0]?.priority} for ${series}/${mode}`)
  return eligible[0]
}

export function resolveBrandTheme(themes: BrandThemeV1[], defaultThemeId?: string, requestedThemeId?: string): BrandThemeV1 | undefined {
  const themeId = requestedThemeId || defaultThemeId
  if (!themeId) return undefined
  const theme = themes.find((item) => item.theme_id === themeId)
  if (!theme) throw new Error(`brand theme ${themeId} is not present in the pinned configuration`)
  if (theme.status !== 'active') throw new Error(`brand theme ${themeId} is not active`)
  return theme
}

export function validateApprovedTreatmentPolicy(preset: ApprovedTreatmentPresetV1, manifest: RenderManifestV1): string[] {
  const errors: string[] = []
  if (manifest.treatment_id !== preset.treatment_id) errors.push('render manifest treatment ID does not match the approved preset')
  if (hashValue(manifest.style) !== hashValue(preset.style)) errors.push('render manifest style differs from the approved preset')
  if (preset.evidence_policy.requires_approved_packet && !manifest.evidence_overlays.length) errors.push('approved treatment requires an approved evidence packet')
  for (const overlay of manifest.evidence_overlays) {
    if (!overlay.presentation || !preset.evidence_policy.allowed_presentations.includes(overlay.presentation)) errors.push(`evidence overlay ${overlay.overlay_id} uses an unapproved presentation`)
    if (overlay.face_policy !== preset.evidence_policy.face_policy) errors.push(`evidence overlay ${overlay.overlay_id} violates the approved face policy`)
    if (!overlay.approved) errors.push(`evidence overlay ${overlay.overlay_id} does not have exact asset approval`)
    if (overlay.end_ms > manifest.duration_ms - preset.evidence_policy.minimum_clear_ending_ms) errors.push(`evidence overlay ${overlay.overlay_id} does not leave the approved clear ending`)
  }
  if (preset.evidence_policy.captions_below_evidence && manifest.style.caption_position !== 'lower') errors.push('approved treatment requires lower captions beneath evidence')
  if (preset.invariants.includes('presenter_remains_primary') && manifest.evidence_overlays.some((overlay) => overlay.presentation === 'evidence_cutaway')) errors.push('approved treatment does not permit presenter replacement')
  if (preset.invariants.includes('transcript_word_fidelity') && (!manifest.caption_provenance?.verified || !manifest.caption_provenance.exact_word_fidelity)) errors.push('approved treatment requires verified transcript-word caption fidelity')
  if (preset.invariants.includes('exact_evidence_asset_approval') && manifest.assets.some((asset) => /third[_ -]?party/i.test(asset.rights) && !asset.approved)) errors.push('approved treatment contains an unapproved third-party evidence asset')
  return [...new Set(errors)]
}

export function validateApprovedTreatmentReuse(preset: ApprovedTreatmentPresetV1, manifest: RenderManifestV1): string[] {
  const errors = validateApprovedTreatmentPolicy(preset, manifest)
  if (!manifest.treatment_preset) errors.push('render manifest is missing approved preset provenance')
  else {
    if (manifest.treatment_preset.treatment_id !== preset.treatment_id || manifest.treatment_preset.version !== preset.version) errors.push('render manifest preset identity differs from the approved preset')
    if (manifest.treatment_preset.preset_hash !== hashValue(preset)) errors.push('render manifest preset hash differs from the pinned approved preset')
    if (manifest.treatment_preset.source_manifest_sha256 !== preset.source_manifest_sha256) errors.push('render manifest source approval hash differs from the approved preset')
  }
  const manifestBrandHash = manifest.brand_theme ? hashValue(manifest.brand_theme) : undefined
  if (preset.approved_brand_theme_sha256 !== manifestBrandHash) errors.push('render manifest brand theme was not part of the approved treatment')
  if (preset.evidence_policy.requires_per_job_layout_review) errors.push('approved treatment requires per-job layout review for the current presenter composition')
  return [...new Set(errors)]
}

export function isApprovedTreatmentReuse(preset: ApprovedTreatmentPresetV1 | undefined, manifest: RenderManifestV1): boolean {
  return Boolean(preset && validateApprovedTreatmentReuse(preset, manifest).length === 0)
}

async function stageEvidenceAssets(jobId: string, overlays: EvidenceOverlayV1[]): Promise<EvidenceOverlayV1[]> {
  const mediaDirectory = join(jobPath(jobId), 'media')
  await mkdir(mediaDirectory, { recursive: true })
  return Promise.all(overlays.map(async (overlay) => {
    const assetHash = await hashFile(overlay.asset_path)
    const destination = join(mediaDirectory, `evidence-${assetHash.slice(0, 16)}${extname(overlay.asset_path) || '.png'}`)
    if (resolve(overlay.asset_path) !== resolve(destination)) await copyFile(overlay.asset_path, destination)
    return { ...overlay, asset_path: destination }
  }))
}

export async function createTreatment(
  jobId: string,
  candidatePath: string,
  normalizedPath: string,
  treatmentId: string,
  accent: string,
  sourceTranscript?: TranscriptDocument,
  branding: 'series' | 'none' = 'series',
  evidenceOverlays: EvidenceOverlayV1[] = [],
  approvedPreset?: ApprovedTreatmentPresetV1,
  brandTheme?: BrandThemeV1,
): Promise<RenderManifestV1> {
  const candidate = CandidateV1Schema.parse(JSON.parse(await readFile(candidatePath, 'utf8')))
  if (candidate.challenge.hard_blocks.length) throw new Error(`candidate has hard blocks: ${candidate.challenge.hard_blocks.join('; ')}`)
  if (branding !== 'none' && candidate.editorial?.disposition !== 'publishable') throw new Error('production treatment requires a publishable editorial disposition')
  const aligned = candidate.start_ms === undefined && candidate.end_ms === undefined && sourceTranscript
    ? alignScriptToTranscript(candidate.transcript, sourceTranscript)
    : undefined
  const startMs = candidate.start_ms ?? aligned?.start_ms ?? 0
  const endMs = candidate.end_ms ?? aligned?.end_ms ?? Math.min(60_000, Math.max(1_000, candidate.transcript.split(/\s+/).length / 2.5 * 1000))
  const editSegments = candidate.edit_plan?.segments || [{
    segment_id: 'legacy-continuous',
    start_ms: startMs,
    end_ms: endMs,
    role: 'ending' as const,
    transcript: candidate.transcript,
    selection_reason: 'Legacy continuous candidate retained for backward-compatible calibration.',
  }]
  const clipPath = join(jobPath(jobId), 'media', `clip-${candidate.candidate_id}.mp4`)
  await assembleClip(normalizedPath, clipPath, editSegments)
  const probe = await probeMedia(clipPath)
  const durationMs = Math.round(probe.duration_seconds * 1000)
  const timedTranscript = sourceTranscript
    ? candidate.edit_plan ? composeEditTranscript(sourceTranscript, editSegments) : sliceTranscript(sourceTranscript, startMs, endMs)
    : undefined
  const captionScript = candidate.edit_plan?.caption_script || candidate.transcript
  const captions = timedTranscript?.segments.length
    ? verifiedTextCaptionCues(captionScript, timedTranscript, durationMs)
    : captionCues(captionScript, durationMs)
  const fidelity = timedTranscript ? exactWordFidelity(captionScript, timedTranscript) : undefined
  const stagedOverlays = await stageEvidenceAssets(jobId, evidenceOverlays)
  const manifest = RenderManifestV1Schema.parse({
    schema_version: SCHEMA_VERSION,
    job_id: jobId,
    candidate_id: candidate.candidate_id,
    hook: candidate.hook,
    series: candidate.series,
    branding,
    treatment_id: treatmentId,
    source_path: clipPath,
    source_hash: await hashFile(clipPath),
    source_width: probe.width,
    source_height: probe.height,
    output: { width: 1080, height: 1920, fps: 30, audio_hz: 48000 },
    duration_ms: durationMs,
    crop: cropFor(probe.width, probe.height, treatmentId),
    crop_keyframes: [],
    style: approvedPreset?.style || styleFor(treatmentId),
    ...(brandTheme ? { brand_theme: brandTheme } : {}),
    ...(approvedPreset ? {
      treatment_preset: {
        treatment_id: approvedPreset.treatment_id,
        version: approvedPreset.version,
        preset_hash: hashValue(approvedPreset),
        source_manifest_sha256: approvedPreset.source_manifest_sha256,
      },
    } : {}),
    captions,
    evidence_overlays: stagedOverlays,
    edit_segments: editSegments,
    ...(sourceTranscript ? {
      caption_provenance: {
        source: sourceTranscript.source,
        transcript_hash: hashValue(sourceTranscript),
        verified: fidelity?.exact_word_fidelity === true,
        alignment_similarity: fidelity?.exact_word_fidelity ? 1 : captionTranscriptSimilarity(captions, captionScript),
        exact_word_fidelity: fidelity?.exact_word_fidelity === true,
        source_token_count: fidelity?.source_token_count || 0,
        caption_token_count: fidelity?.caption_token_count || 0,
      },
    } : {}),
    accent,
    fixed_seed: hashValue({ jobId, candidate: candidate.candidate_id, treatmentId }).slice(0, 32),
    assets: [
      { path: basename(clipPath), rights: 'inherited_from_source', purpose: 'presenter footage', generated: false, approved: false },
      ...stagedOverlays.map((overlay) => ({
        path: basename(overlay.asset_path),
        rights: overlay.kind === 'diagram' ? 'generated_illustration' : 'third_party_commentary_excerpt',
        purpose: `supporting ${overlay.kind}: ${overlay.title}`,
        generated: overlay.kind === 'diagram',
        ...(overlay.kind === 'diagram' ? { label: 'Illustration' } : {}),
        attribution: overlay.attribution,
        rights_rationale: overlay.rights_rationale,
        approved: overlay.approved,
      })),
    ],
  })
  if (approvedPreset) {
    const errors = validateApprovedTreatmentPolicy(approvedPreset, manifest)
    if (errors.length) throw new Error(`treatment preset application failed: ${errors.join('; ')}`)
  }
  return manifest
}

export function rendererProps(manifest: RenderManifestV1) {
  return {
    sourceFile: basename(manifest.source_path),
    sourceWidth: manifest.source_width,
    sourceHeight: manifest.source_height,
    crop: manifest.crop,
    cropKeyframes: manifest.crop_keyframes,
    hook: manifest.hook,
    treatmentStyle: manifest.style,
    durationMs: manifest.duration_ms,
    seriesName: manifest.branding === 'none' ? '' : PUBLIC_SERIES_NAMES[manifest.series],
    accent: manifest.accent,
    brandTheme: manifest.brand_theme,
    captions: manifest.captions,
    evidenceOverlays: manifest.evidence_overlays.map((overlay) => ({
      ...overlay,
      presentation: overlay.presentation || 'legacy_overlay' as const,
      assetFile: basename(overlay.asset_path),
      source_role: overlay.editorial_assessment?.source_role,
      temporality: overlay.editorial_assessment?.temporality,
      published_at: overlay.editorial_assessment?.published_at,
    })),
  }
}
