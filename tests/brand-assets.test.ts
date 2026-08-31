import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { TreatmentRegistryV1Schema, type BrandThemeV1, type RenderManifestV1 } from '@mindmake/contracts'
import { brandWordmarkLegibilityIssues, officialWordmarkUrl, stageOfficialWordmarks } from '@mindmake/core'
import studioConfig from '../config/studio.json'

function activeTheme(): BrandThemeV1 {
  const registry = TreatmentRegistryV1Schema.parse(studioConfig)
  return registry.brand_themes.find((theme) => theme.theme_id === registry.default_brand_theme)!
}

describe('official brand wordmarks', () => {
  it('pins the real GitHub assets and clears the deterministic legibility floor', () => {
    const theme = activeTheme()
    expect(theme.version).toBe(3)
    expect(theme.source.commit).toBe('e1d03892f8e8c52ad9f0d2d05275ab858fd151e5')
    const wordmarks = theme.wordmarks
    expect(wordmarks).toBeDefined()
    if (!wordmarks) throw new Error('active theme is missing official wordmarks')
    expect(wordmarks.approval).toEqual({ feedback_id: '448645f4-dadd-41fa-bfe7-53b630659eeb', approved_by: 'Krish', approved_at: '2026-08-31T09:56:33.097Z' })
    expect(wordmarks.lockup).toEqual({
      approval: { feedback_id: '2cecdb0b-efe0-400c-b39b-e843188932ee', approved_by: 'Krish', approved_at: '2026-08-31T10:47:20.970Z' },
      layout: 'stacked_square', corner: 'top_left', plate_size: 250, offset_x: 52, offset_y: 54, padding: 20, gap: 14, mindmake_width: 180, series_width: 210,
    })
    expect(wordmarks.mindmake.sha256).toBe('d2a0417df41119775d8f6c5c25134f2414ce2f5144b6e8b5433b2109d95645e1')
    expect(wordmarks.series.built_with_ai.sha256).toBe('271ab965dc51714be8c13c8a6bb8c7b2b60f4bf22caf51dda5a2928e295fd29f')
    expect(wordmarks.series.money_of_ai.sha256).toBe('1cdd6d7710c9970a1e86c8793b33acf6b3f63c81304aeb6efe84d392467322a6')
    expect(officialWordmarkUrl(theme, wordmarks.series.built_with_ai)).toBe('https://raw.githubusercontent.com/krishanraja/mindmake/e1d03892f8e8c52ad9f0d2d05275ab858fd151e5/src/assets/builtwithai-logo-wordmark.png')
    expect(brandWordmarkLegibilityIssues(theme)).toEqual([])
  })

  it('contains no live-text imitation fallback in the renderer', async () => {
    const shortSource = await readFile(join(fileURLToPath(new URL('..', import.meta.url)), 'apps', 'renderer', 'src', 'Short.tsx'), 'utf8')
    expect(shortSource).toContain('<BrandLockup wordmarks={props.brandWordmarks}')
    expect(shortSource).toContain('<OfficialWordmark asset={wordmarks.mindmake} displayWidth={layout.mindmake_width}')
    expect(shortSource).toContain('<OfficialWordmark asset={wordmarks.series} displayWidth={layout.series_width}')
    expect(shortSource).toContain('width: layout.plate_size')
    expect(shortSource).toContain("top: layout.offset_y, left: layout.offset_x")
    expect(shortSource).not.toContain("position: 'absolute', top: 54, right: 52")
    expect(shortSource).not.toContain('mind<span')
    expect(shortSource).not.toContain('>{props.seriesName}</')
  })

  it('downloads content-addressed assets, stages exact bytes and refuses a typed substitute', async () => {
    const bytes = Buffer.from('deterministic-official-png-fixture')
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const base = activeTheme()
    if (!base.wordmarks) throw new Error('active theme is missing official wordmarks')
    const fixtureMindmake = { ...base.wordmarks.mindmake, source_path: 'src/assets/fixture.png', sha256 }
    const fixtureSeries = { ...base.wordmarks.series.built_with_ai, source_path: 'src/assets/fixture.png', sha256 }
    const theme: BrandThemeV1 = { ...base, wordmarks: { ...base.wordmarks, mindmake: fixtureMindmake, series: { money_of_ai: fixtureSeries, built_with_ai: fixtureSeries } } }
    const manifest = { branding: 'series', brand_theme: theme, series: 'built_with_ai' } as RenderManifestV1
    const runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-brand-test-'))
    const previousRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = runtimeRoot
    try {
      const fetchImpl = async () => new Response(bytes, { status: 200, headers: { 'content-type': 'image/png' } })
      const staged = await stageOfficialWordmarks(manifest, join(runtimeRoot, 'job-media'), fetchImpl as typeof fetch)
      expect(staged?.mindmake.assetFile).toContain(sha256.slice(0, 16))
      expect(staged?.series.assetFile).toContain(sha256.slice(0, 16))
      expect(await readFile(join(runtimeRoot, 'job-media', staged!.mindmake.assetFile))).toEqual(bytes)
      expect(await readFile(join(runtimeRoot, 'job-media', staged!.series.assetFile))).toEqual(bytes)
    } finally {
      if (previousRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
      else process.env.MINDMAKE_RUNTIME_ROOT = previousRuntimeRoot
      await rm(runtimeRoot, { recursive: true, force: true })
    }
  })

  it('fails closed when GitHub bytes do not match the pinned asset hash', async () => {
    const theme = activeTheme()
    const manifest = { branding: 'series', brand_theme: theme, series: 'money_of_ai' } as RenderManifestV1
    const runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-brand-mismatch-'))
    const previousRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = runtimeRoot
    try {
      const fetchImpl = async () => new Response(Buffer.from('not-the-official-asset'), { status: 200, headers: { 'content-type': 'image/png' } })
      await expect(stageOfficialWordmarks(manifest, join(runtimeRoot, 'job-media'), fetchImpl as typeof fetch)).rejects.toThrow('official wordmark hash mismatch')
    } finally {
      if (previousRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
      else process.env.MINDMAKE_RUNTIME_ROOT = previousRuntimeRoot
      await rm(runtimeRoot, { recursive: true, force: true })
    }
  })

  it('keeps the prior split-layout theme readable but blocks it from branded rendering', async () => {
    const legacyConfig = structuredClone(studioConfig) as unknown as { brand_themes: Array<{ wordmarks?: { lockup?: unknown }; rules: Record<string, unknown> }> }
    const legacyTheme = legacyConfig.brand_themes[0]!
    if (!legacyTheme.wordmarks) throw new Error('fixture is missing wordmarks')
    delete legacyTheme.wordmarks.lockup
    const parsed = TreatmentRegistryV1Schema.parse(legacyConfig)
    const theme = parsed.brand_themes[0]!
    expect(brandWordmarkLegibilityIssues(theme)).toEqual(['approved compact wordmark lockup is missing'])
    const manifest = { branding: 'series', brand_theme: theme, series: 'built_with_ai' } as RenderManifestV1
    await expect(stageOfficialWordmarks(manifest, tmpdir())).rejects.toThrow('branded renders require the approved compact wordmark lockup')
  })
})
