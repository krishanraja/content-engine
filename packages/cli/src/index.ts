#!/usr/bin/env node
import { access, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Command } from 'commander'
import {
  ApprovalGateSchema,
  CandidateV1Schema,
  EvidenceOverlayV1Schema,
  JobPurposeSchema,
  RenderManifestV1Schema,
  SourceModeSchema,
  StageNameSchema,
  normalizeSeries,
  type FeedbackEventV1,
  type StageName,
} from '@mindmake/contracts'
import {
  archiveJob,
  analyzeMediaArtifactForFeedback,
  applyPresenterIdentityCorrections,
  assessTranscriptQuality,
  applyCorpusNovelty,
  benchmarkTranscription,
  broadenRule,
  captureFeedback,
  classifyError,
  completeStage,
  confirmFeedback,
  createDraftPackage,
  createContactSheet,
  prepareEvidenceApprovalPacket,
  createExperiment,
  createJob,
  createTreatment,
  ensureRuntime,
  evaluateExperiment,
  fetchRadarFeed,
  generateCandidates,
  hashFile,
  hasApproval,
  importAnalytics,
  jobPath,
  loadJob,
  loadRadarFeed,
  listRules,
  listExperiments,
  loadCaptionTranscript,
  mergeRadarFeeds,
  normalizeMedia,
  probeMedia,
  pinnedConfigPath,
  proposeRule,
  promoteRule,
  qaVideo,
  rankRadarOpportunities,
  readStageArtifact,
  readReusableStage,
  readWindowsCredential,
  rebuildIndex,
  recordApproval,
  renderShort,
  runDoctor,
  selectWeeklyBrief,
  sourceReferenceHash,
  studioPaths,
  transcribeMedia,
  trackFaceCrops,
  uploadPrivateYoutubeVideo,
  verifyFinalForAnalytics,
  verifyEvidenceApprovalPacket,
  validateEditorialCandidate,
  validateShortNativeEditorialCandidate,
} from '@mindmake/core'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const configPath = join(repoRoot, 'config', 'studio.json')
const skillPaths = ['mindmake-video', 'krish-voice', 'content-corpus', 'video-engine'].map((name) => join(repoRoot, '.agents', 'skills', name))

function out(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`)
}

async function readJson<T = unknown>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, 'utf8')) as T
}

async function readArtifactForFeedback(path: string, jobId: string, label: string): Promise<unknown> {
  const extension = extname(path).toLowerCase()
  if (['.mp4', '.mov', '.mkv'].includes(extension)) {
    const manifest = await loadJob(jobId)
    const config = await readJson<{ transcription: { local_model: string; vocabulary?: string[] } }>(pinnedConfigPath(manifest))
    return analyzeMediaArtifactForFeedback(repoRoot, path, join(jobPath(jobId), 'feedback'), label, config.transcription.local_model, config.transcription.vocabulary || [])
  }
  const body = await readFile(path, 'utf8')
  if (extension === '.json') return JSON.parse(body)
  return body
}

async function existingFileHashOrValue(value: string): Promise<string> {
  try { await access(value); return hashFile(value) } catch { return value }
}

const program = new Command()
program.name('studio').description('Mindmaker deterministic video production engine').version('0.1.0')

program.command('doctor').action(async () => {
  const result = await runDoctor(repoRoot)
  out(result)
  if (!result.ok) process.exitCode = 20
})

const job = program.command('job')
job.command('create')
  .requiredOption('--series <series>')
  .requiredOption('--mode <mode>')
  .requiredOption('--source <ref>')
  .option('--purpose <purpose>', 'production or calibration', 'production')
  .option('--presenter <name>', 'known primary presenter identity')
  .option('--source-kind <kind>')
  .option('--rights <rights>', 'owned, permissioned, commentary_exception, or unverified', 'unverified')
  .option('--consent-note <note>')
  .action(async (options) => {
    await ensureRuntime()
    const mode = SourceModeSchema.parse(options.mode)
    const studioConfig = await readJson<{ identity?: { presenter_name: string; default_presenter_modes: string[] } }>(configPath)
    const presenterName = options.presenter || (studioConfig.identity?.default_presenter_modes.includes(mode) ? studioConfig.identity.presenter_name : undefined)
    out(await createJob({
      series: normalizeSeries(options.series),
      mode,
      sourceRef: options.source,
      purpose: JobPurposeSchema.parse(options.purpose),
      presenterName,
      sourceKind: options.sourceKind,
      rights: options.rights,
      consentNote: options.consentNote,
      configPath,
      skillPaths,
    }))
  })

program.command('ingest')
  .requiredOption('--job <jobId>')
  .option('--input <path>')
  .action(async (options) => {
    const manifest = await loadJob(options.job)
    const input = resolve(options.input || manifest.source.ref)
    const probe = await probeMedia(input)
    const reusable = await readReusableStage<{ output_path: string; source_path?: string; probe: unknown }>(manifest.job_id, 'normalize', { ingest: probe.file_hash }, { normalizer: 'vertical-v2' })
    if (reusable) {
      const expectedHash = (reusable.payload.probe as { file_hash?: string }).file_hash
      try {
        if (!expectedHash || await hashFile(reusable.payload.output_path) === expectedHash) {
          out({ job_id: manifest.job_id, normalized: reusable.payload.output_path, mezzanine: reusable.payload.source_path || reusable.payload.output_path, artifact_hash: reusable.artifact_hash, probe: reusable.payload.probe, reused: true })
          return
        }
      } catch { /* Rebuild a missing or corrupted derived media file. */ }
    }
    await completeStage(manifest.job_id, 'ingest', { input_path: input, probe }, { source: probe.file_hash }, { ffprobe: 'system' })
    const normalized = await normalizeMedia(manifest.job_id, input)
    const artifact = await completeStage(manifest.job_id, 'normalize', { output_path: normalized.outputPath, source_path: normalized.sourcePath, probe: normalized.probe, source_probe: normalized.sourceProbe }, { ingest: probe.file_hash }, { ffmpeg: normalized.ffmpegVersion, normalizer: 'vertical-v2' })
    out({ job_id: manifest.job_id, normalized: normalized.outputPath, mezzanine: normalized.sourcePath, artifact_hash: artifact.artifact_hash, probe: normalized.probe })
  })

program.command('transcribe')
  .requiredOption('--job <jobId>')
  .option('--model <model>', 'faster-whisper model; defaults to the job-pinned configuration')
  .option('--captions <path>', 'existing SRT or VTT for coarse long-form search')
  .option('--verified <path>', 'human-verified TranscriptDocument JSON')
  .action(async (options) => {
    if (options.captions && options.verified) throw new Error('choose either --captions or --verified, not both')
    const manifest = await loadJob(options.job)
    const config = await readJson<{ transcription: { local_model: string; vocabulary?: string[] }; identity?: { presenter_name: string; asr_aliases: string[] } }>(pinnedConfigPath(manifest))
    const model = options.model || config.transcription.local_model
    const normalized = await readStageArtifact<{ output_path: string; source_path?: string; probe: { file_hash: string } }>(options.job, 'normalize')
    const outputPath = join(jobPath(options.job), 'transcript', 'transcript.json')
    const transcriptTool = options.verified
      ? { verified_transcript_hash: await hashFile(options.verified), transcript_pipeline: 'verified-v2' }
      : options.captions
        ? { caption_import: extname(options.captions).slice(1).toLowerCase(), transcript_pipeline: 'caption-import-v2' }
        : { faster_whisper_model: model, vocabulary: (config.transcription.vocabulary || []).join('|'), transcript_pipeline: 'faster-whisper-v2' }
    const reusable = await readReusableStage(options.job, 'transcript', { normalize: normalized.artifact_hash }, transcriptTool)
    if (reusable) {
      try { await access(outputPath) } catch { await mkdir(dirname(outputPath), { recursive: true }); await writeFile(outputPath, `${JSON.stringify(reusable.payload, null, 2)}\n`, 'utf8') }
      out({ job_id: options.job, transcript_path: outputPath, artifact_hash: reusable.artifact_hash, reused: true })
      return
    }
    let transcript = options.verified
      ? { ...await readJson<Parameters<typeof assessTranscriptQuality>[0]>(options.verified), source: 'manual' as const, verified: true }
      : options.captions ? await loadCaptionTranscript(options.captions) : await transcribeMedia(repoRoot, normalized.payload.source_path || normalized.payload.output_path, outputPath, model, config.transcription.vocabulary || []) as Parameters<typeof assessTranscriptQuality>[0]
    if (manifest.presenter_name && config.identity && manifest.presenter_name.toLowerCase() === config.identity.presenter_name.toLowerCase()) {
      transcript = applyPresenterIdentityCorrections(transcript, config.identity.presenter_name, config.identity.asr_aliases)
    }
    transcript.quality = assessTranscriptQuality(transcript)
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, `${JSON.stringify(transcript, null, 2)}\n`, 'utf8')
    const artifact = await completeStage(options.job, 'transcript', transcript, { normalize: normalized.artifact_hash }, transcriptTool)
    out({ job_id: options.job, transcript_path: outputPath, artifact_hash: artifact.artifact_hash })
  })

program.command('candidates')
  .requiredOption('--job <jobId>')
  .option('--limit <number>', 'maximum candidates', '8')
  .option('--input <path>', 'Codex-authored CandidateV1 JSON or array with editorial judgement')
  .action(async (options) => {
    const manifest = await loadJob(options.job)
    if (manifest.mode === 'short_native') {
      if (!options.input) throw new Error('short-native candidates require --input with Codex-authored CandidateV1 JSON')
      const parsed = await readJson(options.input)
      const config = await readJson<{ editorial_thresholds: Parameters<typeof validateShortNativeEditorialCandidate>[1] }>(pinnedConfigPath(manifest))
      const candidates = (Array.isArray(parsed) ? parsed : [parsed]).map((value) => {
        const candidate = CandidateV1Schema.parse(value)
        if (candidate.job_id !== manifest.job_id || candidate.series !== manifest.series || candidate.mode !== manifest.mode) throw new Error('short-native candidate job, series, and mode must match the job manifest')
        const validation = validateShortNativeEditorialCandidate(candidate, config.editorial_thresholds, manifest.presenter_name)
        return CandidateV1Schema.parse({
          ...candidate,
          challenge: {
            ...candidate.challenge,
            hard_blocks: [...new Set([...candidate.challenge.hard_blocks, ...validation.hard_blocks])],
            soft_blocks: [...new Set([...candidate.challenge.soft_blocks, ...validation.soft_blocks])],
            recommendation: validation.hard_blocks.length ? 'Do not record. Revise or reject this script before creating a recording brief.' : candidate.challenge.recommendation,
          },
        })
      })
      const briefHash = await existingFileHashOrValue(manifest.source.ref)
      const briefArtifact = await completeStage(manifest.job_id, 'brief', { source_ref: manifest.source.ref, source_ref_hash: sourceReferenceHash(manifest.source.ref) }, { source: briefHash }, { author: 'codex' })
      const scriptArtifact = await completeStage(manifest.job_id, 'script', { candidates }, { brief: briefArtifact.artifact_hash }, { author: 'codex' })
      const directory = join(jobPath(manifest.job_id), 'candidates')
      await mkdir(directory, { recursive: true })
      const saved = []
      for (const candidate of candidates) {
        const path = join(directory, `${candidate.candidate_id}.json`)
        await writeFile(path, `${JSON.stringify(candidate, null, 2)}\n`, 'utf8')
        saved.push({ path, hash: await hashFile(path), candidate })
      }
      const candidatesArtifact = await completeStage(manifest.job_id, 'candidates', { candidates: saved }, { script: scriptArtifact.artifact_hash }, { validator: 'candidate-v1' })
      const claims = candidates.flatMap((candidate) => candidate.claims.map((claim) => ({ candidate_id: candidate.candidate_id, ...claim })))
      const claimsArtifact = await completeStage(manifest.job_id, 'claims', { claims }, { candidates: candidatesArtifact.artifact_hash }, { extractor: 'mindmake-claims-v1' })
      const recordable = candidates.filter((candidate) => !candidate.challenge.hard_blocks.length)
      if (!recordable.length) {
        out({
          job_id: manifest.job_id,
          candidates_artifact_hash: candidatesArtifact.artifact_hash,
          claims_artifact_hash: claimsArtifact.artifact_hash,
          candidates: saved,
          recording_brief: null,
          next_action: 'No script passed the editorial floor. Revise it using the candidate blocks or explicit rerecord guidance; do not record for content cadence.',
        })
        return
      }
      const recordingBrief = {
        setup: 'Record 30 to 45 minutes in the approved presenter setup at constant framing and clean 48 kHz audio.',
        takes: recordable.map((candidate) => ({ candidate_id: candidate.candidate_id, hook: candidate.hook, script: candidate.transcript, delivery: 'Land the hook in the first beat, pause before the mechanism, and finish on the concrete implication.' })),
      }
      const recordingArtifact = await completeStage(manifest.job_id, 'recording_brief', recordingBrief, { script: scriptArtifact.artifact_hash }, { generator: 'recording-brief-v2' })
      out({ job_id: manifest.job_id, recording_brief: recordingBrief, recording_artifact_hash: recordingArtifact.artifact_hash, candidates_artifact_hash: candidatesArtifact.artifact_hash, claims_artifact_hash: claimsArtifact.artifact_hash, candidates: saved })
      return
    }
    const transcript = await readStageArtifact<Parameters<typeof generateCandidates>[1]>(options.job, 'transcript')
    if (options.input) {
      const config = await readJson<{ editorial_thresholds: Parameters<typeof validateEditorialCandidate>[3] }>(pinnedConfigPath(manifest))
      const parsed = await readJson(options.input)
      const authored = (Array.isArray(parsed) ? parsed : [parsed]).map((value) => CandidateV1Schema.parse(value))
      const candidates = authored.map((candidate) => {
        const validation = validateEditorialCandidate(candidate, transcript.payload, manifest, config.editorial_thresholds)
        return CandidateV1Schema.parse({
          ...candidate,
          challenge: {
            ...candidate.challenge,
            hard_blocks: [...new Set([...candidate.challenge.hard_blocks, ...validation.hard_blocks])],
            soft_blocks: [...new Set([...candidate.challenge.soft_blocks, ...validation.soft_blocks])],
            recommendation: validation.hard_blocks.length ? 'Do not proceed. Revise, reject, or request a specific rerecord.' : candidate.challenge.recommendation,
          },
        })
      })
      const directory = join(jobPath(options.job), 'candidates')
      await mkdir(directory, { recursive: true })
      const saved = []
      for (const candidate of candidates) {
        const path = join(directory, `${candidate.candidate_id}.json`)
        await writeFile(path, `${JSON.stringify(candidate, null, 2)}\n`, 'utf8')
        saved.push({ path, hash: await hashFile(path), candidate })
      }
      const artifact = await completeStage(options.job, 'candidates', { candidates: saved }, { transcript: transcript.artifact_hash }, { generator: 'codex-editorial-v1' })
      const claims = candidates.flatMap((candidate) => candidate.claims.map((claim) => ({ candidate_id: candidate.candidate_id, ...claim })))
      const claimsArtifact = await completeStage(options.job, 'claims', { claims }, { candidates: artifact.artifact_hash }, { extractor: 'mindmake-claims-v2' })
      out({ job_id: options.job, artifact_hash: artifact.artifact_hash, claims_artifact_hash: claimsArtifact.artifact_hash, candidates: saved })
      return
    }
    const reusable = await readReusableStage<{ candidates: Array<{ candidate: ReturnType<typeof CandidateV1Schema.parse> }> }>(options.job, 'candidates', { transcript: transcript.artifact_hash }, { generator: 'mindmake-heuristic-v2' })
    if (reusable) {
      const claims = reusable.payload.candidates.flatMap((item) => item.candidate.claims.map((claim) => ({ candidate_id: item.candidate.candidate_id, ...claim })))
      const claimsArtifact = await readReusableStage(options.job, 'claims', { candidates: reusable.artifact_hash }, { extractor: 'mindmake-claims-v2' })
        || await completeStage(options.job, 'claims', { claims }, { candidates: reusable.artifact_hash }, { extractor: 'mindmake-claims-v2' })
      out({ job_id: options.job, artifact_hash: reusable.artifact_hash, claims_artifact_hash: claimsArtifact.artifact_hash, candidates: reusable.payload.candidates, reused: true })
      return
    }
    const candidates = generateCandidates(manifest, transcript.payload, Number(options.limit))
    const directory = join(jobPath(options.job), 'candidates')
    await mkdir(directory, { recursive: true })
    const saved = []
    for (const candidate of candidates) {
      const path = join(directory, `${candidate.candidate_id}.json`)
      await writeFile(path, `${JSON.stringify(candidate, null, 2)}\n`, 'utf8')
      saved.push({ path, hash: await hashFile(path), candidate })
    }
    const artifact = await completeStage(options.job, 'candidates', { candidates: saved }, { transcript: transcript.artifact_hash }, { generator: 'mindmake-heuristic-v2' })
    const claims = candidates.flatMap((candidate) => candidate.claims.map((claim) => ({ candidate_id: candidate.candidate_id, ...claim })))
    const claimsArtifact = await completeStage(options.job, 'claims', { claims }, { candidates: artifact.artifact_hash }, { extractor: 'mindmake-claims-v2' })
    out({ job_id: options.job, artifact_hash: artifact.artifact_hash, claims_artifact_hash: claimsArtifact.artifact_hash, candidates: saved })
  })

program.command('approve')
  .requiredOption('--job <jobId>')
  .requiredOption('--gate <gate>')
  .requiredOption('--artifact <hashOrPath>')
  .option('--decision <decision>', 'approved, rejected, or override', 'approved')
  .option('--reason <reason>')
  .option('--actor <actor>', 'krish, codex, or system', 'krish')
  .action(async (options) => {
    const gate = ApprovalGateSchema.parse(options.gate)
    const actor = options.actor as 'krish' | 'codex' | 'system'
    if (!['krish', 'codex', 'system'].includes(actor)) throw new Error('actor must be krish, codex, or system')
    if (gate === 'angle') {
      let candidate: ReturnType<typeof CandidateV1Schema.parse>
      try { candidate = CandidateV1Schema.parse(await readJson(options.artifact)) }
      catch { throw new Error('angle approval requires the path to a valid CandidateV1 JSON artifact') }
      const jobManifest = await loadJob(options.job)
      const independentHardBlocks = [
        ...(jobManifest.source.rights === 'unverified' ? ['source rights are unverified'] : []),
        ...(candidate.claims.some((claim) => claim.kind === 'fact' && claim.verification !== 'verified') ? ['factual claims remain unverified'] : []),
      ]
      if (jobManifest.mode !== 'short_native') {
        const transcript = await readStageArtifact<Parameters<typeof generateCandidates>[1]>(options.job, 'transcript')
        const config = await readJson<{ editorial_thresholds: Parameters<typeof validateEditorialCandidate>[3] }>(pinnedConfigPath(jobManifest))
        const validation = validateEditorialCandidate(candidate, transcript.payload, jobManifest, config.editorial_thresholds)
        independentHardBlocks.push(...validation.hard_blocks)
      } else {
        const config = await readJson<{ editorial_thresholds: Parameters<typeof validateShortNativeEditorialCandidate>[1] }>(pinnedConfigPath(jobManifest))
        independentHardBlocks.push(...validateShortNativeEditorialCandidate(candidate, config.editorial_thresholds, jobManifest.presenter_name).hard_blocks)
      }
      const hardBlocks = [...new Set([...candidate.challenge.hard_blocks, ...independentHardBlocks])]
      if (hardBlocks.length && options.decision !== 'rejected') throw new Error(`hard editorial block cannot be overridden: ${hardBlocks.join('; ')}`)
      if (candidate.challenge.soft_blocks.length && options.decision === 'approved') throw new Error('soft editorial blocks require --decision override and a recorded --reason')
    }
    if (gate === 'evidence') {
      let packet: Awaited<ReturnType<typeof verifyEvidenceApprovalPacket>>
      try { packet = await verifyEvidenceApprovalPacket(options.artifact) }
      catch (error) { throw new Error(`evidence approval requires an intact EvidenceApprovalPacketV1: ${error instanceof Error ? error.message : String(error)}`) }
      if (packet.job_id !== options.job) throw new Error('evidence packet belongs to a different job')
      if (options.decision !== 'rejected' && packet.quality_gate_version !== 'editorial_v2') throw new Error('legacy evidence packets may be resumed only when they were already approved; new approval requires editorial quality gate v2')
      if (options.decision !== 'rejected' && actor !== 'krish') throw new Error('evidence screenshots require Krish approval')
    }
    const artifactHash = await existingFileHashOrValue(options.artifact)
    const manifest = await recordApproval(options.job, gate, options.decision, artifactHash, options.reason, actor)
    const stage = gate === 'angle' ? 'candidates' : gate === 'final' ? 'render' : 'treatment'
    const feedbackEvent = await captureFeedback({
      jobId: options.job,
      artifactId: artifactHash,
      stage,
      action: options.decision === 'rejected' ? 'reject' : 'accept',
      origin: actor === 'krish' ? 'user' : actor,
      before: { artifact_hash: artifactHash },
      ...(options.reason ? { note: options.reason } : {}),
      scope: { level: 'job', key: options.job },
    })
    out({ job: manifest, feedback: feedbackEvent })
  })

const evidence = program.command('evidence')
evidence.command('prepare')
  .requiredOption('--job <jobId>')
  .requiredOption('--candidate <path>')
  .requiredOption('--overlays <path>', 'orchestrated evidence overlay JSON object or array')
  .requiredOption('--strategy <summary>', 'plain-language account of what the viewer should see and why')
  .option('--allow-evidence-ending', 'allow the video to end on evidence rather than returning to Krish')
  .action(async (options) => {
    const manifest = await loadJob(options.job)
    const candidate = CandidateV1Schema.parse(await readJson(options.candidate))
    const candidateHash = await hashFile(options.candidate)
    if (!hasApproval(manifest, 'angle', candidateHash)) throw new Error('the selected candidate does not have angle approval')
    const overlayInput = await readJson(options.overlays)
    const overlays = Array.isArray(overlayInput) ? overlayInput : [overlayInput]
    const durationMs = candidate.edit_plan?.total_duration_ms
      ?? (candidate.start_ms !== undefined && candidate.end_ms !== undefined ? candidate.end_ms - candidate.start_ms : 0)
    if (durationMs <= 0) throw new Error('the selected candidate needs an exact duration before evidence can be orchestrated')
    const prepared = await prepareEvidenceApprovalPacket({
      jobId: options.job,
      candidateHash,
      overlays,
      durationMs,
      strategySummary: options.strategy,
      endingReturnToPresenter: !options.allowEvidenceEnding,
    })
    out({
      job_id: options.job,
      packet_path: prepared.packetPath,
      packet_hash: prepared.packetHash,
      contact_sheet_path: prepared.packet.contact_sheet_path,
      quality_gate_version: prepared.packet.quality_gate_version,
      screenshots: prepared.packet.items.map((item, index) => ({ order: index + 1, overlay_id: item.overlay.overlay_id, path: item.overlay.asset_path, sha256: item.asset_sha256, source_url: item.overlay.source_url })),
      next_gate: `studio approve --job ${options.job} --gate evidence --artifact ${prepared.packetPath}`,
    })
  })

program.command('treatment')
  .requiredOption('--job <jobId>')
  .requiredOption('--candidate <path>')
  .option('--treatment <id>', 'named treatment', 'presenter-evidence-v1')
  .option('--evidence-packet <path>', 'an exact EvidenceApprovalPacketV1 approved at the evidence gate')
  .option('--overlays <path>', 'deprecated; prepare and approve an evidence packet instead')
  .option('--face-track', 'use optional local presenter face tracking')
  .action(async (options) => {
    const manifest = await loadJob(options.job)
    const candidateHash = await hashFile(options.candidate)
    if (!hasApproval(manifest, 'angle', candidateHash)) throw new Error('the selected candidate does not have angle approval')
    const normalized = await readStageArtifact<{ output_path: string; source_path?: string }>(options.job, 'normalize')
    const config = await readJson<{ series: Record<string, { accent: string }>; transcription: { local_model: string } }>(pinnedConfigPath(manifest))
    const sourceTranscript = (await readStageArtifact<Parameters<typeof generateCandidates>[1]>(options.job, 'transcript')).payload
    if (options.overlays) throw new Error('direct evidence overlays are not accepted; run studio evidence prepare and approve the exact packet first')
    let evidenceOverlays: Array<ReturnType<typeof EvidenceOverlayV1Schema.parse>> = []
    let evidencePacketHash: string | undefined
    if (options.evidencePacket) {
      const packet = await verifyEvidenceApprovalPacket(options.evidencePacket)
      evidencePacketHash = await hashFile(options.evidencePacket)
      if (packet.job_id !== options.job) throw new Error('evidence packet belongs to a different job')
      if (packet.candidate_hash !== candidateHash) throw new Error('evidence packet belongs to a different candidate revision')
      if (!hasApproval(manifest, 'evidence', evidencePacketHash, 'krish')) throw new Error('the exact evidence packet does not have Krish approval')
      evidenceOverlays = packet.items.map((item) => EvidenceOverlayV1Schema.parse({ ...item.overlay, approved: true }))
    }
    const treatment = await createTreatment(
      options.job,
      options.candidate,
      normalized.payload.source_path || normalized.payload.output_path,
      options.treatment,
      config.series[manifest.series]?.accent || '#D7FF3F',
      sourceTranscript,
      manifest.purpose === 'calibration' ? 'none' : 'series',
      evidenceOverlays,
    )
    if (options.faceTrack) treatment.crop_keyframes = await trackFaceCrops(repoRoot, treatment.source_path)
    const path = join(jobPath(options.job), 'treatments', `${options.treatment}.json`)
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(treatment, null, 2)}\n`, 'utf8')
    const manifestHash = await hashFile(path)
    const artifact = await completeStage(options.job, 'treatment', { manifest_path: path, manifest_hash: manifestHash, candidate_path: resolve(options.candidate), evidence_overlay_count: evidenceOverlays.length, ...(options.evidencePacket ? { evidence_packet_path: resolve(options.evidencePacket) } : {}) }, { candidate: candidateHash, normalize: normalized.artifact_hash, ...(evidencePacketHash ? { evidence_packet: evidencePacketHash } : {}) }, { treatment: options.treatment })
    out({ job_id: options.job, manifest_path: path, manifest_hash: manifestHash, artifact_hash: artifact.artifact_hash })
  })

program.command('render')
  .requiredOption('--job <jobId>')
  .option('--preview', 'render a low-resolution treatment preview without completing the render stage')
  .option('--preview-seconds <number>', 'representative preview duration', '6')
  .option('--full-preview', 'render the full treatment at preview resolution')
  .option('--high-quality-preview', 'render a full-resolution 1080x1920 review without completing the render stage')
  .action(async (options) => {
    const jobManifest = await loadJob(options.job)
    if (options.highQualityPreview && !options.preview) throw new Error('--high-quality-preview requires --preview')
    if (jobManifest.purpose === 'calibration' && !options.preview) throw new Error('calibration jobs are analysis-only and cannot create a final render')
    const stage = await readStageArtifact<{ manifest_path: string; manifest_hash: string }>(options.job, 'treatment')
    const renderManifest = RenderManifestV1Schema.parse(await readJson(stage.payload.manifest_path))
    const unapprovedThirdParty = renderManifest.assets.filter((asset) => /third[_ -]?party/i.test(asset.rights) && !asset.approved)
    if (unapprovedThirdParty.length) throw new Error('hard rights block: every third-party excerpt requires explicit asset approval')
    if (renderManifest.assets.some((asset) => asset.generated && /evidence|proof/i.test(asset.purpose))) throw new Error('hard truth block: generated illustration cannot be treated as evidence or proof')
    const config = await readJson<{ approved_treatments: string[] }>(pinnedConfigPath(jobManifest))
    if (!options.preview && !config.approved_treatments.includes(renderManifest.treatment_id) && !hasApproval(jobManifest, 'treatment', stage.payload.manifest_hash)) throw new Error('new visual treatment requires treatment approval')
    const reusable = !options.preview ? await readReusableStage<{ master_path: string; master_hash: string }>(options.job, 'render', { treatment: stage.payload.manifest_hash }, { remotion: '4.0.518' }) : null
    if (reusable) {
      try {
        if (await hashFile(reusable.payload.master_path) === reusable.payload.master_hash) {
          out({ job_id: options.job, ...reusable.payload, artifact_hash: reusable.artifact_hash, reused: true })
          return
        }
      } catch { /* Re-render a missing or corrupted master. */ }
    }
    const previewDurationMs = options.fullPreview ? renderManifest.duration_ms : Number(options.previewSeconds) * 1000
    if (!Number.isFinite(previewDurationMs) || previewDurationMs <= 0) throw new Error('--preview-seconds must be a positive number')
    const masterPath = await renderShort(repoRoot, renderManifest, Boolean(options.preview), previewDurationMs, options.highQualityPreview ? 1 : 0.25)
    const masterHash = await hashFile(masterPath)
    if (options.preview) {
      out({ job_id: options.job, preview_path: masterPath, preview_hash: masterHash, treatment_manifest_hash: stage.payload.manifest_hash, next_gate: 'approve treatment manifest after pairwise review' })
      return
    }
    const artifact = await completeStage(options.job, 'render', { master_path: masterPath, master_hash: masterHash, manifest_path: stage.payload.manifest_path }, { treatment: stage.payload.manifest_hash }, { remotion: '4.0.518' })
    out({ job_id: options.job, master_path: masterPath, master_hash: masterHash, artifact_hash: artifact.artifact_hash })
  })

program.command('qa')
  .requiredOption('--job <jobId>')
  .action(async (options) => {
    const render = await readStageArtifact<{ master_path: string; master_hash: string }>(options.job, 'render')
    const reusable = await readReusableStage(options.job, 'qa', { render: render.payload.master_hash }, { qa: 'mindmake-qa-v2' })
    if (reusable) { out({ job_id: options.job, artifact_hash: reusable.artifact_hash, ...reusable.payload as Record<string, unknown>, reused: true }); return }
    const treatment = await readStageArtifact<{ manifest_path: string }>(options.job, 'treatment')
    const renderManifest = RenderManifestV1Schema.parse(await readJson(treatment.payload.manifest_path))
    const verdict = await qaVideo(render.payload.master_path, [], renderManifest)
    const artifact = await completeStage(options.job, 'qa', verdict, { render: render.payload.master_hash }, { qa: 'mindmake-qa-v2' })
    out({ job_id: options.job, artifact_hash: artifact.artifact_hash, ...verdict })
  })

const packageCommand = program.command('package')
packageCommand.command('linkedin')
  .requiredOption('--job <jobId>')
  .option('--archive')
  .action(async (options) => {
    const manifest = await loadJob(options.job)
    if (manifest.purpose === 'calibration') throw new Error('calibration jobs are analysis-only and cannot create platform packages')
    const render = await readStageArtifact<{ master_path: string; master_hash: string; manifest_path: string }>(options.job, 'render')
    if (!hasApproval(manifest, 'final', render.payload.master_hash)) throw new Error('final render approval is required')
    const qa = await readStageArtifact<{ passed: boolean }>(options.job, 'qa')
    if (!qa.payload.passed) throw new Error('QA did not pass')
    const treatment = await readStageArtifact<{ candidate_path: string }>(options.job, 'treatment')
    const candidate = CandidateV1Schema.parse(await readJson(treatment.payload.candidate_path))
    const renderManifest = RenderManifestV1Schema.parse(await readJson(render.payload.manifest_path))
    const draft = await createDraftPackage(options.job, 'linkedin', render.payload.master_path, candidate, renderManifest, qa.payload)
    const artifact = await completeStage(options.job, 'package', draft, { render: render.payload.master_hash, qa: qa.artifact_hash }, { package: 'linkedin-v1' })
    const archivePath = options.archive ? await archiveJob(options.job) : undefined
    out({ job_id: options.job, artifact_hash: artifact.artifact_hash, draft, ...(archivePath ? { archive_path: archivePath } : {}) })
  })

const publish = program.command('publish')
publish.command('youtube')
  .requiredOption('--job <jobId>')
  .requiredOption('--privacy <privacy>')
  .action(async (options) => {
    if (options.privacy !== 'private') throw new Error('the engine only permits private YouTube uploads')
    const manifest = await loadJob(options.job)
    if (manifest.purpose === 'calibration') throw new Error('calibration jobs are analysis-only and cannot be uploaded')
    const render = await readStageArtifact<{ master_path: string; master_hash: string; manifest_path: string }>(options.job, 'render')
    if (!hasApproval(manifest, 'final', render.payload.master_hash)) throw new Error('final render approval is required')
    const qa = await readStageArtifact<{ passed: boolean }>(options.job, 'qa')
    if (!qa.payload.passed) throw new Error('QA did not pass')
    const treatment = await readStageArtifact<{ candidate_path: string }>(options.job, 'treatment')
    const candidate = CandidateV1Schema.parse(await readJson(treatment.payload.candidate_path))
    const renderManifest = RenderManifestV1Schema.parse(await readJson(render.payload.manifest_path))
    const draft = await createDraftPackage(options.job, 'youtube', render.payload.master_path, candidate, renderManifest, qa.payload)
    const accessToken = await readWindowsCredential(repoRoot, 'MindmakeVideoStudio/youtube-access-token')
    const result = await uploadPrivateYoutubeVideo({ accessToken, videoPath: draft.master_path, title: draft.titles[0] || candidate.hook, description: draft.description })
    out({ job_id: options.job, privacy: 'private', result })
  })

const radar = program.command('radar')
radar.command('pull')
  .option('--file <paths...>', 'offline RadarFeedV1 JSON files')
  .action(async (options) => {
    await ensureRuntime()
    const feeds = []
    for (const path of options.file || []) feeds.push(await loadRadarFeed(path))
    const failures: Array<{ provider: string; error: string }> = []
    const studioConfig = await readJson<{ radar_providers?: { mm_ctrl_url?: string; control_center_url?: string } }>(configPath)
    const liveProviders = [
      { provider: 'mm_ctrl', url: process.env.MINDMAKE_MM_CTRL_URL || studioConfig.radar_providers?.mm_ctrl_url, credential: 'MindmakeVideoStudio/mm-ctrl-radar-token' },
      { provider: 'control_center', url: process.env.MINDMAKE_CONTROL_CENTER_URL || studioConfig.radar_providers?.control_center_url, credential: 'MindmakeVideoStudio/control-center-radar-token' },
    ]
    for (const provider of liveProviders) {
      if (!provider.url) continue
      try { feeds.push(await fetchRadarFeed(provider.url, await readWindowsCredential(repoRoot, provider.credential))) }
      catch (error) { failures.push({ provider: provider.provider, error: error instanceof Error ? error.message : String(error) }) }
    }
    if (!feeds.length) throw new Error(`no radar feeds available${failures.length ? `: ${failures.map((item) => `${item.provider} ${item.error}`).join('; ')}` : ''}`)
    await rebuildIndex()
    const ranked = await applyCorpusNovelty(rankRadarOpportunities(mergeRadarFeeds(feeds)))
    const brief = selectWeeklyBrief(ranked)
    const outputPath = join(studioPaths().runtimeRoot, 'radar', `${new Date().toISOString().slice(0, 10)}.json`)
    await mkdir(dirname(outputPath), { recursive: true })
    const feedStatus = feeds.map((feed) => ({ provider: feed.provider, provider_version: feed.provider_version, source_age: feed.source_age, stale: feed.source_age > 7 * 24 * 60 * 60 }))
    await writeFile(outputPath, `${JSON.stringify({ generated_at: new Date().toISOString(), feeds: feedStatus, failures, opportunities: brief }, null, 2)}\n`, 'utf8')
    out({ output_path: outputPath, feeds: feedStatus, failures, opportunities: brief })
  })

const feedback = program.command('feedback')
feedback.command('import')
  .requiredOption('--job <jobId>')
  .requiredOption('--artifact-id <id>')
  .requiredOption('--stage <stage>')
  .requiredOption('--action <action>')
  .requiredOption('--before <path>')
  .option('--after <path>')
  .option('--note <note>')
  .option('--srt <path>', 'accepted-final caption sidecar')
  .option('--edl <path>', 'accepted-final edit decision list')
  .option('--fcpxml <path>', 'accepted-final Final Cut XML')
  .option('--scope-level <level>', 'global, series, mode, treatment, platform, or job', 'job')
  .option('--scope-key <key>')
  .action(async (options) => {
    const before = await readArtifactForFeedback(options.before, options.job, 'before')
    const after = options.after ? await readArtifactForFeedback(options.after, options.job, 'after') : undefined
    const sidecars: Record<string, string> = {}
    for (const kind of ['srt', 'edl', 'fcpxml'] as const) if (options[kind]) sidecars[kind] = await readFile(options[kind], 'utf8')
    const event = await captureFeedback({
      jobId: options.job,
      artifactId: options.artifactId,
      stage: StageNameSchema.parse(options.stage),
      action: options.action,
      before,
      ...(after === undefined ? {} : { after: Object.keys(sidecars).length ? { artifact: after, sidecars } : after }),
      ...(options.note ? { note: options.note } : {}),
      scope: { level: options.scopeLevel, key: options.scopeKey || options.job },
    })
    out(event)
  })

feedback.command('confirm')
  .requiredOption('--event <path>')
  .option('--correction <text>')
  .option('--propose-rule')
  .action(async (options) => {
    const event = (await readJson(options.event)) as FeedbackEventV1
    const confirmed = await confirmFeedback(event, options.correction)
    const rule = options.proposeRule ? await proposeRule(confirmed) : undefined
    out({ feedback: confirmed, ...(rule ? { proposed_rule: rule } : {}) })
  })

feedback.command('rules').action(async () => out(await listRules()))

feedback.command('broaden')
  .requiredOption('--rule <ruleId>')
  .requiredOption('--scope-level <level>')
  .requiredOption('--scope-key <key>')
  .action(async (options) => out(await broadenRule(options.rule, { level: options.scopeLevel, key: options.scopeKey })))

feedback.command('promote')
  .requiredOption('--rule <ruleId>')
  .requiredOption('--status <status>')
  .option('--approved-by <actor>')
  .action(async (options) => out(await promoteRule(options.rule, options.status, configPath, options.approvedBy)))

const analytics = program.command('analytics')
analytics.command('import')
  .requiredOption('--platform <platform>')
  .requiredOption('--file <path>')
  .requiredOption('--job <jobId>')
  .requiredOption('--final <path>', 'the exact published video file')
  .action(async (options) => {
    const publishedHash = await verifyFinalForAnalytics(options.job, options.final)
    out(await importAnalytics(options.file, options.platform, options.job, publishedHash))
  })

const benchmark = program.command('benchmark')
benchmark.command('transcription')
  .requiredOption('--fixture <mediaEqualsTranscript...>', 'repeatable MEDIA=VERIFIED_TRANSCRIPT fixture')
  .option('--models <models...>', 'ordered local model candidates', ['tiny.en', 'base.en', 'small.en'])
  .option('--maximum-wer <number>', 'maximum word error rate', '0.12')
  .option('--maximum-realtime-factor <number>', 'maximum elapsed/media duration', '1.5')
  .action(async (options) => out(await benchmarkTranscription(repoRoot, options.fixture, options.models, Number(options.maximumWer), Number(options.maximumRealtimeFactor))))

const calibration = program.command('calibration')
calibration.command('contact-sheet')
  .requiredOption('--job <jobId>')
  .requiredOption('--previews <paths...>')
  .option('--output <path>')
  .action(async (options) => {
    const outputPath = options.output || join(jobPath(options.job), 'calibration', 'contact-sheet.jpg')
    out({ job_id: options.job, contact_sheet: await createContactSheet(options.previews, outputPath), previews: options.previews })
  })

const experiment = program.command('experiment')
experiment.command('create')
  .requiredOption('--hypothesis <text>')
  .requiredOption('--variable <name>')
  .requiredOption('--control <jobIds...>')
  .requiredOption('--treatment <jobIds...>')
  .requiredOption('--platform <platform>')
  .requiredOption('--metric <metric>')
  .option('--confound <items...>')
  .action(async (options) => out(await createExperiment({
    hypothesis: options.hypothesis,
    primary_variable: options.variable,
    control_job_ids: options.control,
    treatment_job_ids: options.treatment,
    platform: options.platform,
    target_metric: options.metric,
    confounds: options.confound || [],
  })))

experiment.command('evaluate')
  .requiredOption('--id <experimentId>')
  .action(async (options) => out(await evaluateExperiment(options.id)))

experiment.command('list').action(async () => out(await listExperiments()))

program.command('status').option('--job <jobId>').action(async (options) => {
  if (options.job) {
    out(await loadJob(options.job))
    return
  }
  const paths = studioPaths()
  try {
    const jobIds = (await readdir(paths.jobsRoot, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    const jobs = await Promise.all(jobIds.map(async (jobId) => {
      try {
        const manifest = await loadJob(jobId)
        return { job_id: manifest.job_id, series: manifest.series, mode: manifest.mode, stages: manifest.stages }
      } catch {
        return { job_id: jobId, invalid: true }
      }
    }))
    out({ runtime_root: paths.runtimeRoot, jobs })
  } catch {
    out({ runtime_root: paths.runtimeRoot, jobs: [] })
  }
})

program.command('resume').requiredOption('--job <jobId>').action(async (options) => {
  const manifest = await loadJob(options.job)
  const order: StageName[] = manifest.mode === 'short_native'
    ? ['brief', 'script', 'recording_brief', 'ingest', 'normalize', 'transcript', 'candidates', 'claims', 'treatment', 'render', 'qa', 'package']
    : ['ingest', 'normalize', 'transcript', 'candidates', 'claims', 'treatment', 'render', 'qa', 'package']
  const nextStage = order.find((stage) => manifest.stages[stage].status === 'pending' || manifest.stages[stage].status === 'invalidated')
  out({ job_id: manifest.job_id, next_stage: nextStage || null, state: nextStage ? manifest.stages[nextStage] : null })
})

const index = program.command('index')
index.command('rebuild').action(async () => out(await rebuildIndex()))

program.parseAsync(process.argv).catch((error: unknown) => {
  const classified = classifyError(error)
  process.stderr.write(`${JSON.stringify({ ok: false, code: classified.code, error: classified.message })}\n`)
  process.exitCode = classified.exitCode
})
