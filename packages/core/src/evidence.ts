import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, extname, join, resolve } from 'node:path'
import {
  EvidenceApprovalPacketV1Schema,
  OrchestratedEvidenceOverlayV1Schema,
  SCHEMA_VERSION,
  type EvidenceApprovalPacketV1,
  type OrchestratedEvidenceOverlayV1,
} from '@mindmake/contracts'
import { hashFile, hashValue } from './hash.js'
import { jobPath } from './paths.js'
import { run } from './process.js'

export interface EvidenceOrchestrationOptions {
  durationMs: number
  endingReturnToPresenter: boolean
}

export function validateEvidenceOrchestration(
  overlays: OrchestratedEvidenceOverlayV1[],
  options: EvidenceOrchestrationOptions,
): string[] {
  const issues: string[] = []
  const ordered = [...overlays].sort((left, right) => left.start_ms - right.start_ms)
  for (const [index, overlay] of ordered.entries()) {
    if (overlay.end_ms > options.durationMs) issues.push(`${overlay.overlay_id}: evidence ends after the video`)
    if (index > 0 && ordered[index - 1]!.end_ms > overlay.start_ms) issues.push(`${overlay.overlay_id}: evidence beats may not overlap`)
    const duration = overlay.end_ms - overlay.start_ms
    if (overlay.presentation === 'evidence_cutaway' && (duration < 1_400 || duration > 5_000)) {
      issues.push(`${overlay.overlay_id}: evidence cutaways must last 1.4 to 5 seconds so the viewer can inspect them without losing the presenter for too long`)
    }
    if (overlay.presentation === 'presenter_primary' && !['top_left', 'top_right'].includes(overlay.anchor!)) {
      issues.push(`${overlay.overlay_id}: presenter-primary evidence must use a corner anchor`)
    }
    if (overlay.presentation === 'sidecar' && !['left', 'right'].includes(overlay.anchor!)) {
      issues.push(`${overlay.overlay_id}: sidecar evidence must use a left or right anchor`)
    }
    if (overlay.presentation === 'evidence_cutaway' && overlay.anchor !== 'center') {
      issues.push(`${overlay.overlay_id}: an evidence cutaway must be centered`)
    }
    const readingLoad = overlay.title.length + (overlay.excerpt?.length || 0)
    if (overlay.presentation === 'presenter_primary' && readingLoad > 105) {
      issues.push(`${overlay.overlay_id}: the reading load is too high for a presenter-primary card; use a sidecar or evidence cutaway`)
    }
  }
  if (options.endingReturnToPresenter && ordered.some((overlay) => overlay.end_ms > options.durationMs - 1_000)) {
    issues.push('the final second must return to Krish when ending_return_to_presenter is enabled')
  }
  return issues
}

async function imageDimensions(path: string): Promise<{ width: number; height: number }> {
  const { stdout } = await run('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', path,
  ])
  const parsed = JSON.parse(stdout) as { streams?: Array<{ width?: number; height?: number }> }
  const width = Number(parsed.streams?.[0]?.width)
  const height = Number(parsed.streams?.[0]?.height)
  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) throw new Error(`evidence asset is not a readable image: ${path}`)
  return { width, height }
}

export async function createEvidenceContactSheet(inputPaths: string[], outputPath: string): Promise<string> {
  if (inputPaths.length < 1 || inputPaths.length > 8) throw new Error('evidence contact sheets require one to eight images')
  await mkdir(dirname(outputPath), { recursive: true })
  const columns = inputPaths.length === 1 ? 1 : 2
  const cellWidth = columns === 1 ? 1080 : 540
  const cellHeight = Math.round(cellWidth * 1.25)
  const filters = inputPaths.map((_, index) => `[${index}:v]scale=${cellWidth}:${cellHeight}:force_original_aspect_ratio=decrease,pad=${cellWidth}:${cellHeight}:(ow-iw)/2:(oh-ih)/2:color=0x111111,setsar=1[v${index}]`)
  const layout = inputPaths.map((_, index) => `${index % columns * cellWidth}_${Math.floor(index / columns) * cellHeight}`).join('|')
  const stack = `${inputPaths.map((_, index) => `[v${index}]`).join('')}xstack=inputs=${inputPaths.length}:layout=${layout}:fill=0x111111[out]`
  await run('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    ...inputPaths.flatMap((path) => ['-i', resolve(path)]),
    '-filter_complex', [...filters, stack].join(';'), '-map', '[out]', '-frames:v', '1', outputPath,
  ], { timeoutMs: 300_000 })
  return outputPath
}

export async function prepareEvidenceApprovalPacket(input: {
  jobId: string
  candidateHash: string
  overlays: unknown[]
  durationMs: number
  strategySummary: string
  endingReturnToPresenter?: boolean
}): Promise<{ packet: EvidenceApprovalPacketV1; packetPath: string; packetHash: string }> {
  const endingReturnToPresenter = input.endingReturnToPresenter ?? true
  const parsed = input.overlays.map((overlay) => OrchestratedEvidenceOverlayV1Schema.parse(overlay))
  const issues = validateEvidenceOrchestration(parsed, { durationMs: input.durationMs, endingReturnToPresenter })
  if (issues.length) throw new Error(`evidence orchestration failed:\n- ${issues.join('\n- ')}`)

  const proposedDirectory = join(jobPath(input.jobId), 'evidence', 'proposed')
  await mkdir(proposedDirectory, { recursive: true })
  const items = []
  for (const overlay of parsed) {
    const assetSha256 = await hashFile(overlay.asset_path)
    const extension = extname(overlay.asset_path).toLowerCase() || '.png'
    const destination = join(proposedDirectory, `${overlay.overlay_id}-${assetSha256.slice(0, 16)}${extension}`)
    if (resolve(overlay.asset_path) !== resolve(destination)) await copyFile(overlay.asset_path, destination)
    const dimensions = await imageDimensions(destination)
    items.push({
      overlay: { ...overlay, asset_path: destination, approved: false },
      asset_sha256: assetSha256,
      pixel_width: dimensions.width,
      pixel_height: dimensions.height,
    })
  }

  const semanticHash = hashValue({
    job_id: input.jobId,
    candidate_hash: input.candidateHash,
    duration_ms: input.durationMs,
    strategy_summary: input.strategySummary,
    ending_return_to_presenter: endingReturnToPresenter,
    items: items.map((item) => ({ overlay: item.overlay, asset_sha256: item.asset_sha256, pixel_width: item.pixel_width, pixel_height: item.pixel_height })),
  })
  const packetId = `evidence-${semanticHash.slice(0, 16)}`
  const packetDirectory = join(jobPath(input.jobId), 'evidence', 'packets')
  const contactSheetPath = join(packetDirectory, `${packetId}.jpg`)
  await createEvidenceContactSheet(items.map((item) => item.overlay.asset_path), contactSheetPath)
  const contactSheetSha256 = await hashFile(contactSheetPath)
  const packet = EvidenceApprovalPacketV1Schema.parse({
    schema_version: SCHEMA_VERSION,
    packet_id: packetId,
    job_id: input.jobId,
    candidate_hash: input.candidateHash,
    duration_ms: input.durationMs,
    created_at: new Date().toISOString(),
    strategy_summary: input.strategySummary,
    ending_return_to_presenter: endingReturnToPresenter,
    contact_sheet_path: contactSheetPath,
    contact_sheet_sha256: contactSheetSha256,
    items,
  })
  const packetPath = join(packetDirectory, `${packetId}.json`)
  await mkdir(packetDirectory, { recursive: true })
  await writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`, 'utf8')
  return { packet, packetPath, packetHash: await hashFile(packetPath) }
}

export async function verifyEvidenceApprovalPacket(path: string): Promise<EvidenceApprovalPacketV1> {
  const packet = EvidenceApprovalPacketV1Schema.parse(JSON.parse(await readFile(path, 'utf8')))
  if (await hashFile(packet.contact_sheet_path) !== packet.contact_sheet_sha256) throw new Error('evidence contact sheet changed after packet preparation')
  for (const item of packet.items) {
    if (await hashFile(item.overlay.asset_path) !== item.asset_sha256) throw new Error(`approved evidence asset changed after approval: ${item.overlay.overlay_id}`)
  }
  const issues = validateEvidenceOrchestration(packet.items.map((item) => item.overlay), { durationMs: packet.duration_ms, endingReturnToPresenter: packet.ending_return_to_presenter })
  if (issues.length) throw new Error(`approved evidence orchestration is invalid:\n- ${issues.join('\n- ')}`)
  return packet
}
