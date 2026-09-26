import { createHash } from 'node:crypto'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { BrandWordmarkAssetV1Schema, TreatmentRegistryV1Schema, type BrandThemeV1, type RenderManifestV1 } from '@mindmake/contracts'
import { brandWordmarkLegibilityIssues, brandWordmarkLegibilityReport, officialWordmarkUrl, stageOfficialWordmarks } from '@mindmake/core'
import studioConfig from '../config/studio.json'

function activeTheme(): BrandThemeV1 {
  const registry = TreatmentRegistryV1Schema.parse(studioConfig)
  return registry.brand_themes.find((theme) => theme.theme_id === registry.default_brand_theme)!
}

describe('official brand wordmarks', () => {
  it('pins the real GitHub assets and clears the deterministic legibility floor', () => {
    const theme = activeTheme()
    expect(theme.version).toBe(6)
    expect(theme.source.commit).toBe('2d24032681e41ef12ec46ce49780408d5c4eb405')
    expect(studioConfig.visual_story_director.design_authority.main_commit_verified).toBe(theme.source.commit)
    const wordmarks = theme.wordmarks
    expect(wordmarks).toBeDefined()
    if (!wordmarks) throw new Error('active theme is missing official wordmarks')
    expect(wordmarks.approval).toEqual({ feedback_id: '448645f4-dadd-41fa-bfe7-53b630659eeb', approved_by: 'Krish', approved_at: '2026-08-31T09:56:33.097Z' })
    expect(wordmarks.lockup).toEqual({
      approval: { feedback_id: 'fc37225c-d396-4447-9343-680038c7e3d8', approved_by: 'Krish', approved_at: '2026-09-04T14:03:15.556Z' },
      layout: 'responsive_identity_anchor',
      corner: 'top_left',
      reference_canvas: { width: 1080, height: 1920 },
      offset_x: 80,
      offset_y: 140,
      minimum_effective: { mindmake_width_px: 200, mindmake_height_px: 32, series_letter_height_px: 50, preview_width_css_px: 375, series_letter_height_css_px: 17 },
      identity: { mode: 'stacked_official', duration_ms: 1200, plate_width: 700, plate_height: 520, padding: 20, gap: 16, mindmake_width: 230, series_width: 650 },
      series_only_fallback: { mode: 'official_series_only', plate_width: 700, plate_height: 470, padding: 20, series_width: 650 },
      anchor: { mode: 'official_mindmake_only', plate_width: 280, plate_height: 90, padding: 16, mindmake_width: 230 },
      placement: { allowed_corners: ['top_left', 'top_right'], identity_priority: ['opening', 'ending', 'safe_beat'], collision_policy: 'alternate_corner_then_series_only_then_block', dense_story_mode: 'official_mindmake_only' },
    })
    expect(wordmarks.mindmake.source_path).toBe('src/assets/mindmake-wordmark.svg')
    expect(wordmarks.mindmake.sha256).toBe('57fd2cdef929de2035baf5b0405a152878b26f7eba39b17b1d4c03f2470b9737')
    expect(wordmarks.mindmake.letter_region).toEqual(wordmarks.mindmake.alpha_crop)
    expect(wordmarks.series.built_with_ai.sha256).toBe('271ab965dc51714be8c13c8a6bb8c7b2b60f4bf22caf51dda5a2928e295fd29f')
    expect(wordmarks.series.money_of_ai.sha256).toBe('1cdd6d7710c9970a1e86c8793b33acf6b3f63c81304aeb6efe84d392467322a6')
    expect(wordmarks.series.money_of_ai.alpha_crop).toEqual({ x: 254, y: 89, width: 689, height: 402 })
    expect(wordmarks.series.money_of_ai.letter_region).toEqual({ x: 254, y: 438, width: 689, height: 53 })
    expect(wordmarks.series.built_with_ai.alpha_crop).toEqual({ x: 287, y: 114, width: 626, height: 395 })
    expect(wordmarks.series.built_with_ai.letter_region).toEqual({ x: 287, y: 452, width: 626, height: 57 })
    const lockup = wordmarks.lockup
    if (!lockup) throw new Error('active theme is missing its approved wordmark lockup')
    // Every mark the theme carries; a live subchannel has none until approved.
    for (const asset of Object.values(wordmarks.series).filter((mark): mark is NonNullable<typeof mark> => Boolean(mark))) {
      // The complete official lettering, not a convenient middle slice, must
      // survive the crop and fit inside both approved series plates.
      expect(asset.letter_region.x).toBe(asset.alpha_crop.x)
      expect(asset.letter_region.width).toBe(asset.alpha_crop.width)
      expect(lockup.identity.series_width).toBeLessThanOrEqual(lockup.identity.plate_width - lockup.identity.padding * 2)
      expect(lockup.series_only_fallback.series_width).toBeLessThanOrEqual(lockup.series_only_fallback.plate_width - lockup.series_only_fallback.padding * 2)
    }
    expect(officialWordmarkUrl(theme, wordmarks.series.built_with_ai)).toBe('https://raw.githubusercontent.com/krishanraja/mindmake/2d24032681e41ef12ec46ce49780408d5c4eb405/src/assets/builtwithai-logo-wordmark.png')
    expect(brandWordmarkLegibilityIssues(theme)).toEqual([])
    const report = brandWordmarkLegibilityReport(theme)
    expect(report.recommended_identity_mode).toEqual({ money_of_ai: 'stacked_identity', built_with_ai: 'stacked_identity' })
    expect(report.identity.money_of_ai).toMatchObject({ mindmake_width_px: 230, series_width_px: 650, plate_width_px: 700, plate_height_px: 520 })
    expect(report.identity.money_of_ai.mindmake_height_px).toBeGreaterThanOrEqual(32)
    expect(report.identity.money_of_ai.series_letter_height_px).toBeGreaterThanOrEqual(50)
    expect(report.identity.money_of_ai.series_letter_height_at_375_css_px).toBeGreaterThanOrEqual(17)
    expect(report.identity.built_with_ai.series_letter_height_px).toBeGreaterThanOrEqual(50)
    expect(report.identity.built_with_ai.series_letter_height_at_375_css_px).toBeGreaterThanOrEqual(17)
    expect(report.series_only.money_of_ai.series_letter_height_px).toBeGreaterThanOrEqual(50)
    expect(report.series_only.money_of_ai.series_letter_height_at_375_css_px).toBeGreaterThanOrEqual(17)
    expect(report.series_only.built_with_ai.series_letter_height_px).toBeGreaterThanOrEqual(50)
    expect(report.series_only.built_with_ai.series_letter_height_at_375_css_px).toBeGreaterThanOrEqual(17)
    expect(report.anchor).toMatchObject({ mindmake_width_px: 230, plate_width_px: 280, plate_height_px: 90 })
  })

  it('uses the official series-only plate instead of rendering an illegible double stack', () => {
    const theme = activeTheme()
    if (!theme.wordmarks?.lockup) throw new Error('active theme is missing official wordmarks')
    const compact = {
      ...theme,
      wordmarks: {
        ...theme.wordmarks,
        lockup: { ...theme.wordmarks.lockup, identity: { ...theme.wordmarks.lockup.identity, series_width: 430 } },
      },
    } as BrandThemeV1
    const report = brandWordmarkLegibilityReport(compact)
    expect(report.failures).toEqual([])
    expect(report.recommended_identity_mode.money_of_ai).toBe('series_only')
    expect(report.warnings).toContain('money_of_ai stacked identity is below its declared lettering or fit floor; use the official series-only identity moment')
  })

  it('rejects lettering geometry outside the pixels rendered by the alpha crop', () => {
    const asset = activeTheme().wordmarks!.series.money_of_ai
    expect(BrandWordmarkAssetV1Schema.safeParse({
      ...asset,
      letter_region: { ...asset.letter_region, y: asset.alpha_crop.y + asset.alpha_crop.height },
    }).success).toBe(false)
  })

  it('contains no live-text imitation fallback in the renderer', async () => {
    const shortSource = await readFile(join(fileURLToPath(new URL('..', import.meta.url)), 'apps', 'renderer', 'src', 'Short.tsx'), 'utf8')
    const storySource = await readFile(join(fileURLToPath(new URL('..', import.meta.url)), 'apps', 'renderer', 'src', 'v2', 'MindmakeStory.tsx'), 'utf8')
    expect(shortSource).toContain('<BrandLockup wordmarks={props.brandWordmarks}')
    expect(shortSource).toContain('<OfficialWordmark asset={wordmarks.mindmake} displayWidth={identity ? layout.identity.mindmake_width : layout.anchor.mindmake_width}')
    expect(shortSource).toContain('<OfficialWordmark asset={wordmarks.series} displayWidth={layout.identity.series_width}')
    expect(shortSource).toContain('width: plate.plate_width')
    expect(shortSource).toContain("top: layout.offset_y, left: layout.offset_x")
    expect(shortSource).not.toContain("position: 'absolute', top: 54, right: 52")
    expect(shortSource).not.toContain('mind<span')
    expect(shortSource).not.toContain('>{props.seriesName}</')
    expect(storySource).toContain("<OfficialWordmark key={wordmark.role} asset={wordmark.asset} displayWidth={wordmark.displayWidth} />")
    expect(storySource).not.toContain('>{branding.seriesName}</')
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
      const fetchImpl = async (input: string | URL | Request) => new Response(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2 1"><path d="M0 0h2v1H0z"/></svg>'), { status: 200, headers: { 'content-type': String(input).endsWith('.svg') ? 'image/svg+xml' : 'image/png' } })
      await expect(stageOfficialWordmarks(manifest, join(runtimeRoot, 'job-media'), fetchImpl as typeof fetch)).rejects.toThrow('official wordmark hash mismatch')
    } finally {
      if (previousRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
      else process.env.MINDMAKE_RUNTIME_ROOT = previousRuntimeRoot
      await rm(runtimeRoot, { recursive: true, force: true })
    }
  })

  it('accepts only inert hash-pinned SVG bytes and preserves the SVG extension', async () => {
    const bytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 2"><path d="M0 0h10v2H0z"/></svg>')
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const base = activeTheme()
    if (!base.wordmarks) throw new Error('active theme is missing official wordmarks')
    const svg = { ...base.wordmarks.mindmake, source_path: 'src/assets/fixture.svg', sha256, pixel_width: 10, pixel_height: 2, alpha_crop: { x: 0, y: 0, width: 10, height: 2 } }
    const png = { ...base.wordmarks.series.built_with_ai, source_path: 'src/assets/fixture.png', sha256 }
    const theme: BrandThemeV1 = { ...base, wordmarks: { ...base.wordmarks, mindmake: svg, series: { money_of_ai: png, built_with_ai: png } } }
    const runtimeRoot = await mkdtemp(join(tmpdir(), 'mindmake-brand-svg-'))
    const previousRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = runtimeRoot
    try {
      const fetchImpl = async (input: string | URL | Request) => new Response(bytes, { status: 200, headers: { 'content-type': String(input).endsWith('.svg') ? 'image/svg+xml' : 'image/png' } })
      const staged = await stageOfficialWordmarks({ branding: 'series', brand_theme: theme, series: 'built_with_ai' } as RenderManifestV1, join(runtimeRoot, 'media'), fetchImpl as typeof fetch)
      expect(staged?.mindmake.assetFile).toMatch(/\.svg$/)
      const unsafeBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')
      const unsafeHash = createHash('sha256').update(unsafeBytes).digest('hex')
      const unsafeTheme: BrandThemeV1 = { ...theme, wordmarks: { ...theme.wordmarks!, mindmake: { ...svg, sha256: unsafeHash } } }
      const unsafeFetch = async () => new Response(unsafeBytes, { status: 200, headers: { 'content-type': 'image/svg+xml' } })
      await expect(stageOfficialWordmarks({ branding: 'series', brand_theme: unsafeTheme, series: 'built_with_ai' } as RenderManifestV1, join(runtimeRoot, 'unsafe'), unsafeFetch as typeof fetch)).rejects.toThrow('unsafe active or external content')
      const importBytes = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><style>@import "https://example.com/tracker.css";</style><path d="M0 0h1v1z"/></svg>')
      const importTheme: BrandThemeV1 = { ...theme, wordmarks: { ...theme.wordmarks!, mindmake: { ...svg, sha256: createHash('sha256').update(importBytes).digest('hex') } } }
      const importFetch = async () => new Response(importBytes, { status: 200, headers: { 'content-type': 'image/svg+xml' } })
      await expect(stageOfficialWordmarks({ branding: 'series', brand_theme: importTheme, series: 'built_with_ai' } as RenderManifestV1, join(runtimeRoot, 'import'), importFetch as typeof fetch)).rejects.toThrow('unsafe active or external content')
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
    expect(brandWordmarkLegibilityIssues(theme)).toEqual(['approved responsive wordmark lockup is missing'])
    const manifest = { branding: 'series', brand_theme: theme, series: 'built_with_ai' } as RenderManifestV1
    await expect(stageOfficialWordmarks(manifest, tmpdir())).rejects.toThrow('branded renders require the approved responsive wordmark lockup')
  })
})
