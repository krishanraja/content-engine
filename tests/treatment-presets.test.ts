import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { RenderManifestV1Schema, TreatmentRegistryV1Schema } from '@mindmake/contracts'
import {
  hashValue,
  isApprovedTreatmentReuse,
  resolveApprovedTreatmentPreset,
  resolveBrandTheme,
  validateApprovedTreatmentPolicy,
  validateApprovedTreatmentReuse,
} from '@mindmake/core'

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

async function registry() {
  return TreatmentRegistryV1Schema.parse(JSON.parse(await readFile(join(repoRoot, 'config', 'studio.json'), 'utf8')))
}

describe('approved treatment registry', () => {
  it('selects the approved evidence ribbon only inside its Built With AI solo scope', async () => {
    const config = await registry()
    const selected = resolveApprovedTreatmentPreset(config.approved_treatments, 'built_with_ai', 'solo', undefined, true)
    expect(selected?.treatment_id).toBe('evidence-kinetic-ribbon-v1')
    expect(resolveApprovedTreatmentPreset(config.approved_treatments, 'money_of_ai', 'solo', undefined, true)).toBeUndefined()
    expect(resolveApprovedTreatmentPreset(config.approved_treatments, 'built_with_ai', 'short_native', undefined, true)).toBeUndefined()
    expect(() => resolveApprovedTreatmentPreset(config.approved_treatments, 'built_with_ai', 'short_native', 'evidence-kinetic-ribbon-v1', true)).toThrow('outside its built_with_ai/short_native scope')
  })

  it('does not silently apply an evidence treatment when no evidence packet exists', async () => {
    const config = await registry()
    expect(resolveApprovedTreatmentPreset(config.approved_treatments, 'built_with_ai', 'solo', undefined, false)).toBeUndefined()
  })

  it('pins the current Mindmake design contract as the active video theme', async () => {
    const config = await registry()
    const theme = resolveBrandTheme(config.brand_themes, config.default_brand_theme)
    expect(theme?.theme_id).toBe('mindmake-video-v1')
    expect(theme?.version).toBe(6)
    expect(theme?.source).toEqual({
      repository: 'krishanraja/mindmake',
      commit: '2d24032681e41ef12ec46ce49780408d5c4eb405',
      contract_path: 'project-documentation/03_DESIGN_CONTRACT.md',
    })
    expect(theme?.colors.mint).toBe('#7FE3B4')
    expect(theme?.typography).toEqual({ structure: 'Archivo Variable', claim: 'Newsreader Variable', body: 'Source Serif 4 Variable', data: 'IBM Plex Mono' })
    expect(theme?.rules.progress_bar).toBe('hidden')
    expect(theme?.rules.official_wordmarks_only).toBe(true)
    expect(theme?.wordmarks?.mindmake.source_path).toBe('src/assets/mindmake-wordmark.svg')
    expect(theme?.wordmarks?.series.built_with_ai.source_path).toBe('src/assets/builtwithai-logo-wordmark.png')
    expect(theme?.wordmarks?.series.money_of_ai.source_path).toBe('src/assets/moneyofai-logo-wordmark.png')
    expect(theme?.wordmarks?.lockup?.layout).toBe('responsive_identity_anchor')
    expect(theme?.wordmarks?.lockup?.minimum_effective).toEqual({ mindmake_width_px: 200, mindmake_height_px: 32, series_letter_height_px: 50, preview_width_css_px: 375, series_letter_height_css_px: 17 })
    expect(theme?.wordmarks?.lockup?.approval.feedback_id).toBe('fc37225c-d396-4447-9343-680038c7e3d8')
  })

  it('keeps explicit taste memory approved and correctly scoped', async () => {
    const config = await registry()
    expect(config.active_preferences).toHaveLength(5)
    expect(config.active_preferences.every((rule) => rule.status === 'active')).toBe(true)
    expect(config.active_preferences.filter((rule) => rule.scope.level === 'treatment' && rule.scope.key === 'evidence-kinetic-ribbon-v1')).toHaveLength(2)
    expect(config.active_preferences.find((rule) => rule.scope.level === 'global' && rule.scope.key === 'brand-lockup')?.evidence_feedback_ids).toEqual(['2cecdb0b-efe0-400c-b39b-e843188932ee', 'fc37225c-d396-4447-9343-680038c7e3d8'])
    expect(config.active_preferences.find((rule) => rule.rule_id === 'pref-money-investigative-receipts-v1')).toMatchObject({ scope: { level: 'series', key: 'money_of_ai' }, evidence_feedback_ids: ['feedback-reference-videos-20260908-01', 'feedback-cross-series-format-expansion-20260908-01'] })
    expect(config.active_preferences.find((rule) => rule.rule_id === 'pref-built-concrete-story-v1')).toMatchObject({ scope: { level: 'series', key: 'built_with_ai' }, evidence_feedback_ids: ['feedback-reference-videos-20260908-01', 'feedback-cross-series-format-expansion-20260908-01'] })
    expect(config.active_preferences.every((rule) => rule.approved_by === 'Krish')).toBe(true)
  })

  it('links the investigative rule to a path-free reference calibration record', async () => {
    const config = await registry()
    const raw = await readFile(join(repoRoot, 'fixtures', 'feedback', 'reference-video-preference-20260908.json'), 'utf8')
    const evidence = JSON.parse(raw) as { feedback_id: string; decision: string; owner: string; references: Array<{ sha256: string; analysis_only: boolean }> }
    const rule = config.active_preferences.find((item) => item.rule_id === 'pref-money-investigative-receipts-v1')
    expect(evidence).toMatchObject({ feedback_id: 'feedback-reference-videos-20260908-01', decision: 'confirmed', owner: 'Krish' })
    expect(evidence.references).toHaveLength(2)
    expect(evidence.references.every((item) => /^[a-f0-9]{64}$/.test(item.sha256) && item.analysis_only)).toBe(true)
    expect(raw).not.toMatch(/[A-Z]:\\|\/Users\//)
    expect(rule?.evidence_feedback_ids).toContain(evidence.feedback_id)
  })

  it('links both series rules to the canonical format expansion', async () => {
    const config = await registry()
    const raw = await readFile(join(repoRoot, 'fixtures', 'feedback', 'cross-series-format-expansion-20260908.json'), 'utf8')
    const evidence = JSON.parse(raw) as { feedback_id: string; decision: string; owner: string; scope: { formats: string[] }; canon: { retired_import_alias: Record<string, string> } }
    expect(evidence).toMatchObject({ feedback_id: 'feedback-cross-series-format-expansion-20260908-01', decision: 'confirmed', owner: 'Krish', canon: { retired_import_alias: { teardown: 'artifact' } } })
    expect(evidence.scope.formats).toHaveLength(8)
    expect(raw).not.toMatch(/[A-Z]:\\|\/Users\//)
    for (const ruleId of ['pref-money-investigative-receipts-v1', 'pref-built-concrete-story-v1']) {
      expect(config.active_preferences.find((item) => item.rule_id === ruleId)?.evidence_feedback_ids).toContain(evidence.feedback_id)
    }
  })

  it('accepts the locked layout and rejects cutaways, late evidence and unverified captions', async () => {
    const config = await registry()
    const preset = config.approved_treatments[0]!
    const overlay = {
      overlay_id: 'approved-headline',
      start_ms: 5000,
      end_ms: 10000,
      kind: 'screenshot' as const,
      asset_path: 'approved-headline.png',
      title: 'A consequence-led reported headline',
      source_label: 'Reported source',
      source_url: 'https://example.com/report',
      viewer_intent: 'maintain_connection' as const,
      presentation: 'evidence_ribbon' as const,
      anchor: 'center' as const,
      face_policy: 'avoid' as const,
      placement: 'center' as const,
      fit: 'contain' as const,
      attribution: 'Reported source headline',
      rights_rationale: 'A short attributed excerpt supports commentary on the exact spoken point.',
      approved: true,
    }
    const manifest = RenderManifestV1Schema.parse({
      schema_version: 1,
      job_id: 'job-built-solo',
      candidate_id: 'candidate-1',
      hook: 'A precise opening',
      series: 'built_with_ai',
      branding: 'series',
      treatment_id: preset.treatment_id,
      source_path: 'clip.mp4',
      source_hash: 'source-hash',
      source_width: 1080,
      source_height: 1920,
      output: { width: 1080, height: 1920, fps: 30, audio_hz: 48000 },
      duration_ms: 12000,
      crop: { x: 0, y: 0, width: 1080, height: 1920 },
      crop_keyframes: [],
      style: preset.style,
      treatment_preset: { treatment_id: preset.treatment_id, version: preset.version, preset_hash: hashValue(preset), source_manifest_sha256: preset.source_manifest_sha256 },
      captions: [{ start_ms: 0, end_ms: 12000, text: 'Only verified transcribed words remain', emphasis: ['verified'] }],
      evidence_overlays: [overlay],
      edit_segments: [],
      caption_provenance: { source: 'manual', transcript_hash: 'transcript-hash', verified: true, alignment_similarity: 1, exact_word_fidelity: true, source_token_count: 6, caption_token_count: 5 },
      accent: '#7FE3B4',
      fixed_seed: 'fixed-seed',
      assets: [{ path: 'approved-headline.png', rights: 'third_party_commentary_excerpt', purpose: 'supporting screenshot', generated: false, attribution: overlay.attribution, rights_rationale: overlay.rights_rationale, approved: true }],
    })

    expect(validateApprovedTreatmentPolicy(preset, manifest)).toEqual([])
    expect(validateApprovedTreatmentReuse(preset, manifest)).toContain('approved treatment requires per-job layout review for the current presenter composition')
    expect(isApprovedTreatmentReuse(preset, manifest)).toBe(false)

    const cutaway = RenderManifestV1Schema.parse({ ...manifest, evidence_overlays: [{ ...overlay, presentation: 'evidence_cutaway', face_policy: 'intentional_substitution' }] })
    expect(validateApprovedTreatmentPolicy(preset, cutaway)).toEqual(expect.arrayContaining(['evidence overlay approved-headline uses an unapproved presentation', 'approved treatment does not permit presenter replacement']))

    const lateEvidence = RenderManifestV1Schema.parse({ ...manifest, evidence_overlays: [{ ...overlay, end_ms: 11500 }] })
    expect(validateApprovedTreatmentPolicy(preset, lateEvidence)).toContain('evidence overlay approved-headline does not leave the approved clear ending')

    const unverified = RenderManifestV1Schema.parse({ ...manifest, caption_provenance: { ...manifest.caption_provenance!, verified: false, exact_word_fidelity: false } })
    expect(validateApprovedTreatmentPolicy(preset, unverified)).toContain('approved treatment requires verified transcript-word caption fidelity')

    const branded = RenderManifestV1Schema.parse({ ...manifest, brand_theme: resolveBrandTheme(config.brand_themes, config.default_brand_theme) })
    expect(validateApprovedTreatmentReuse(preset, branded)).toContain('render manifest brand theme was not part of the approved treatment')
    expect(isApprovedTreatmentReuse(preset, branded)).toBe(false)
  })
})
