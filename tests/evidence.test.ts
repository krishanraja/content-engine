import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { AssetsStagePayloadV2Schema, type OrchestratedEvidenceOverlayV1 } from '@mindmake/contracts'
import { evidenceContactSheetFilter, hashFile, prepareEvidenceApprovalPacket, validateEvidenceEditorialQuality, validateEvidenceOrchestration, verifyEvidenceApprovalPacket } from '@mindmake/core'

function overlay(overrides: Partial<OrchestratedEvidenceOverlayV1> = {}): OrchestratedEvidenceOverlayV1 {
  return {
    overlay_id: 'proof',
    start_ms: 2_000,
    end_ms: 5_000,
    kind: 'screenshot',
    asset_path: 'proof.png',
    title: 'Publishers are taking control',
    source_label: 'Industry source',
    source_url: 'https://example.com/source',
    editorial_assessment: {
      published_at: '2026-08-18',
      source_class: 'tier_one_news',
      editorial_form: 'reported_news',
      source_role: 'claim_evidence',
      temporality: 'fresh_news',
      headline_form: 'reported_event',
      scores: { source_authority: 0.9, headline_specificity: 0.9, consequence: 0.8, spoken_claim_match: 0.9, visual_legibility: 0.9 },
      claim_supported: 'A major publisher is restructuring the technology used to sell its advertising inventory.',
      why_screenworthy: 'It names the publisher, the platform decision, and the commercial mechanism.',
      strongest_objection: 'The deal delegates technology rather than bringing every capability in-house.',
      corroborating_urls: [],
    },
    viewer_intent: 'verify_claim',
    presentation: 'evidence_cutaway',
    anchor: 'center',
    face_policy: 'intentional_substitution',
    placement: 'upper',
    fit: 'contain',
    attribution: 'Example source',
    rights_rationale: 'Brief transformative excerpt used to verify the spoken editorial claim.',
    approved: false,
    ...overrides,
  }
}

describe('evidence orchestration', () => {
  it('renders a single strong source without passing one input to xstack', () => {
    const filter = evidenceContactSheetFilter(1)
    expect(filter).toContain('[v0]null[out]')
    expect(filter).not.toContain('xstack')
  })

  it('accepts deliberate proof cutaways that return to Krish for the ending', () => {
    expect(validateEvidenceOrchestration([overlay()], { durationMs: 8_000, endingReturnToPresenter: true })).toEqual([])
  })

  it('accepts a centered evidence ribbon that preserves the presenter', () => {
    expect(validateEvidenceOrchestration([
      overlay({ presentation: 'evidence_ribbon', anchor: 'center', face_policy: 'avoid' }),
    ], { durationMs: 8_000, endingReturnToPresenter: true })).toEqual([])
  })

  it('rejects accidental face coverage and evidence endings', () => {
    const issues = validateEvidenceOrchestration([
      overlay({ presentation: 'presenter_primary', anchor: 'center', face_policy: 'avoid', end_ms: 7_500 }),
    ], { durationMs: 8_000, endingReturnToPresenter: true })
    expect(issues).toEqual(expect.arrayContaining([
      expect.stringContaining('corner anchor'),
      expect.stringContaining('final second must return to Krish'),
    ]))
  })

  it('rejects overlapping visual demands', () => {
    const issues = validateEvidenceOrchestration([
      overlay(),
      overlay({ overlay_id: 'second', start_ms: 4_500, end_ms: 6_500 }),
    ], { durationMs: 8_000, endingReturnToPresenter: true })
    expect(issues).toContain('second: evidence beats may not overlap')
  })

  it('accepts fresh, authoritative, specific headline evidence', () => {
    const issues = validateEvidenceEditorialQuality([
      overlay({ title: 'NBC News strikes ad sales deal with Taboola for programmatic display ads', start_ms: 7_200, end_ms: 11_000 }),
    ], new Date('2026-08-29T00:00:00.000Z'))
    expect(issues).toEqual([])
  })

  it('rejects stale listicles and weak sources even when they are topically relevant', () => {
    const issues = validateEvidenceEditorialQuality([
      overlay({
        title: 'Seven strategies for publishers looking to take control of their first-party data',
        editorial_assessment: {
          published_at: '2021-10-08',
          source_class: 'secondary_blog',
          editorial_form: 'guide',
          source_role: 'claim_evidence',
          temporality: 'fresh_news',
          headline_form: 'generic_service',
          scores: { source_authority: 0.5, headline_specificity: 0.4, consequence: 0.2, spoken_claim_match: 0.8, visual_legibility: 0.6 },
          claim_supported: 'Publishers have strategies for using first-party data with more control.',
          why_screenworthy: 'It contains words related to the claim, but lacks a newsworthy event.',
          strongest_objection: 'It is an old SEO-style service headline without a reported development.',
          corroborating_urls: [],
        },
      }),
    ], new Date('2026-08-29T00:00:00.000Z'))
    expect(issues).toEqual(expect.arrayContaining([
      expect.stringContaining('secondary blogs do not earn'),
      expect.stringContaining('guides and marketing pages'),
      expect.stringContaining('generic service'),
      expect.stringContaining('listicle-style'),
      expect.stringContaining('days old; fresh_news allows 60'),
    ]))
  })

  it('requires corroboration for specialist trade claims', () => {
    const issues = validateEvidenceEditorialQuality([
      overlay({ editorial_assessment: { ...overlay().editorial_assessment!, source_class: 'specialist_trade', corroborating_urls: [] } }),
    ], new Date('2026-08-29T00:00:00.000Z'))
    expect(issues).toContain('proof: specialist trade reporting needs at least one independent corroborating source')
  })

  it('pins the exact V2 evidence screenshot packet, contact sheet and source bytes against post-approval mutation', async () => {
    const runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-evidence-v2-'))
    const previousRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = runtimeRoot
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64')
    const sourcePath = join(runtimeRoot, 'headline-proof.png')
    try {
      await writeFile(sourcePath, png)
      const proposed = overlay({
        asset_path: sourcePath,
        title: 'Regulator changes AI reporting rules',
        editorial_assessment: {
          ...overlay().editorial_assessment!,
          source_class: 'primary_authority',
          editorial_form: 'official_announcement',
          source_role: 'claim_evidence',
          temporality: 'live_artifact',
          headline_form: 'reported_event',
          corroborating_urls: [],
        },
      })
      const prepared = await prepareEvidenceApprovalPacket({
        jobId: 'job-evidence-v2',
        candidateHash: 'a'.repeat(64),
        overlays: [proposed],
        durationMs: 8_000,
        strategySummary: 'Show the exact authoritative headline briefly, then return to Krish.',
      })
      const pinned = AssetsStagePayloadV2Schema.parse({
        visual_plan_artifact_hash: 'b'.repeat(64),
        assets: [],
        generated_shots: [],
        editorial_evidence: {
          packet_path: prepared.packetPath,
          packet_hash: prepared.packetHash,
          contact_sheet_path: prepared.packet.contact_sheet_path,
          contact_sheet_hash: prepared.packet.contact_sheet_sha256,
        },
      }).editorial_evidence!
      await expect(verifyEvidenceApprovalPacket(pinned.packet_path, pinned.packet_hash)).resolves.toMatchObject({ packet_id: prepared.packet.packet_id, candidate_hash: 'a'.repeat(64) })

      const stagedScreenshotPath = prepared.packet.items[0]!.overlay.asset_path
      await writeFile(stagedScreenshotPath, Buffer.concat([png, Buffer.from('mutated')]))
      await expect(verifyEvidenceApprovalPacket(pinned.packet_path, pinned.packet_hash)).rejects.toThrow('approved evidence asset changed after approval')
      await writeFile(stagedScreenshotPath, png)

      const contactSheetBytes = await readFile(pinned.contact_sheet_path)
      await writeFile(pinned.contact_sheet_path, Buffer.concat([contactSheetBytes, Buffer.from('mutated')]))
      await expect(verifyEvidenceApprovalPacket(pinned.packet_path, pinned.packet_hash)).rejects.toThrow('evidence contact sheet changed after packet preparation')
      await writeFile(pinned.contact_sheet_path, contactSheetBytes)

      const packet = JSON.parse(await readFile(pinned.packet_path, 'utf8')) as { strategy_summary: string }
      packet.strategy_summary = 'A mutated strategy that was never approved by Krish.'
      await writeFile(pinned.packet_path, `${JSON.stringify(packet, null, 2)}\n`, 'utf8')
      expect(await hashFile(pinned.packet_path)).not.toBe(pinned.packet_hash)
      await expect(verifyEvidenceApprovalPacket(pinned.packet_path, pinned.packet_hash)).rejects.toThrow('evidence approval packet changed after exact approval')
    } finally {
      if (previousRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
      else process.env.MINDMAKE_RUNTIME_ROOT = previousRuntimeRoot
      await rm(runtimeRoot, { recursive: true, force: true })
    }
  }, 30_000)
})
