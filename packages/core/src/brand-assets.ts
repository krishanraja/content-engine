import { createHash } from 'node:crypto'
import { access, copyFile, mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join } from 'node:path'
import { SERIES_IDS, type BrandThemeV1, type BrandWordmarkAssetV1, type BrandWordmarkLockupV1, type RenderManifestV1, type Series } from '@mindmake/contracts'
import { hashFile } from './hash.js'
import { studioPaths } from './paths.js'

export interface StagedWordmarkAsset extends BrandWordmarkAssetV1 {
  assetFile: string
}

export interface StagedBrandWordmarks {
  mindmake: StagedWordmarkAsset
  series: StagedWordmarkAsset
  lockup: BrandWordmarkLockupV1
}

export type BrandLockupMode = 'stacked_identity' | 'series_only' | 'mindmake_only'

export interface BrandWordmarkLegibilityMetrics {
  mindmake_width_px: number
  mindmake_height_px: number
  series_width_px: number
  series_asset_height_px: number
  series_letter_height_px: number
  series_letter_height_at_375_css_px: number
  plate_width_px: number
  plate_height_px: number
}

/** Always the two retired series, whose marks every theme carries; a live
 *  subchannel only once its mark is approved and pinned. */
export type MarkedSeriesRecord<T> = Record<'money_of_ai' | 'built_with_ai', T> & Partial<Record<Series, T>>

export interface BrandWordmarkLegibilityReport {
  failures: string[]
  warnings: string[]
  // Keyed by the series whose official mark the theme carries. The two retired
  // series always have one; a live subchannel appears once Krish approves its
  // mark and it is pinned in studio.json.
  recommended_identity_mode: MarkedSeriesRecord<'stacked_identity' | 'series_only'>
  identity: MarkedSeriesRecord<BrandWordmarkLegibilityMetrics>
  series_only: MarkedSeriesRecord<BrandWordmarkLegibilityMetrics>
  anchor: BrandWordmarkLegibilityMetrics
}

const MAX_BRAND_ASSET_BYTES = 2_000_000

export function officialWordmarkUrl(theme: BrandThemeV1, asset: BrandWordmarkAssetV1): string {
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(theme.source.repository)) throw new Error('brand source repository must be an owner/name GitHub repository')
  const encodedPath = asset.source_path.split('/').map(encodeURIComponent).join('/')
  return `https://raw.githubusercontent.com/${theme.source.repository}/${theme.source.commit}/${encodedPath}`
}

function contentHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function wordmarkExtension(asset: BrandWordmarkAssetV1): '.png' | '.svg' {
  const extension = extname(asset.source_path).toLowerCase()
  if (extension !== '.png' && extension !== '.svg') throw new Error(`official wordmark has unsupported extension ${extension || 'none'}`)
  return extension
}

function assertSafeSvg(bytes: Uint8Array, sourcePath: string): void {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg\b/i.test(text) || !/<\/svg>\s*$/i.test(text)) throw new Error(`official SVG wordmark is not a complete SVG document: ${sourcePath}`)
  if (/<!DOCTYPE|<!ENTITY|<\s*(?:script|foreignObject|iframe|object|embed|link)\b|@import\b|\bon[a-z]+\s*=|javascript\s*:|(?:href|xlink:href)\s*=\s*["'](?!#)|url\(\s*["']?(?!#)/i.test(text)) throw new Error(`official SVG wordmark contains unsafe active or external content: ${sourcePath}`)
}

async function cachedOfficialAsset(theme: BrandThemeV1, asset: BrandWordmarkAssetV1, fetchImpl: typeof fetch): Promise<string> {
  const extension = wordmarkExtension(asset)
  const cachePath = join(studioPaths().cacheRoot, 'brand-wordmarks', `${asset.sha256}${extension}`)
  try {
    await access(cachePath)
    const cachedHash = await hashFile(cachePath)
    if (cachedHash !== asset.sha256) throw new Error(`cached official wordmark hash mismatch for ${asset.source_path}`)
    return cachePath
  } catch (error) {
    if (error instanceof Error && /hash mismatch/.test(error.message)) throw error
  }

  const expectedContentType = extension === '.svg' ? 'image/svg+xml' : 'image/png'
  const response = await fetchImpl(officialWordmarkUrl(theme, asset), { headers: { accept: expectedContentType } })
  if (!response.ok) throw new Error(`official wordmark download failed for ${asset.source_path}: HTTP ${response.status}`)
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  if (contentType !== expectedContentType && contentType !== 'application/octet-stream') throw new Error(`official wordmark returned unsupported content type ${contentType || 'unknown'}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!bytes.length || bytes.length > MAX_BRAND_ASSET_BYTES) throw new Error(`official wordmark size is outside the allowed range for ${asset.source_path}`)
  if (extension === '.svg') assertSafeSvg(bytes, asset.source_path)
  if (contentHash(bytes) !== asset.sha256) throw new Error(`official wordmark hash mismatch for ${asset.source_path}`)
  await mkdir(dirname(cachePath), { recursive: true })
  await writeFile(cachePath, bytes, { flag: 'wx' }).catch(async (error: NodeJS.ErrnoException) => {
    if (error.code !== 'EEXIST') throw error
    if (await hashFile(cachePath) !== asset.sha256) throw new Error(`concurrent official wordmark cache mismatch for ${asset.source_path}`)
  })
  return cachePath
}

async function stageAsset(theme: BrandThemeV1, asset: BrandWordmarkAssetV1, targetDirectory: string, label: string, fetchImpl: typeof fetch): Promise<StagedWordmarkAsset> {
  const cachedPath = await cachedOfficialAsset(theme, asset, fetchImpl)
  const destination = join(targetDirectory, `brand-${label}-${asset.sha256.slice(0, 16)}${wordmarkExtension(asset)}`)
  await mkdir(targetDirectory, { recursive: true })
  await copyFile(cachedPath, destination)
  if (await hashFile(destination) !== asset.sha256) throw new Error(`staged official wordmark hash mismatch for ${asset.source_path}`)
  return { ...asset, assetFile: basename(destination) }
}

function renderedHeight(asset: BrandWordmarkAssetV1, width: number): number {
  return width * asset.alpha_crop.height / asset.alpha_crop.width
}

function renderedLetterHeight(asset: BrandWordmarkAssetV1, width: number): number {
  return width * asset.letter_region.height / asset.alpha_crop.width
}


export function brandWordmarkLegibilityReport(theme: BrandThemeV1): BrandWordmarkLegibilityReport {
  const emptyMetrics = { mindmake_width_px: 0, mindmake_height_px: 0, series_width_px: 0, series_asset_height_px: 0, series_letter_height_px: 0, series_letter_height_at_375_css_px: 0, plate_width_px: 0, plate_height_px: 0 }
  if (!theme.wordmarks) return {
    failures: ['official wordmark mapping is missing'],
    warnings: [],
    recommended_identity_mode: { money_of_ai: 'series_only', built_with_ai: 'series_only' },
    identity: { money_of_ai: emptyMetrics, built_with_ai: emptyMetrics },
    series_only: { money_of_ai: emptyMetrics, built_with_ai: emptyMetrics },
    anchor: emptyMetrics,
  }
  const lockup = theme.wordmarks.lockup
  if (!lockup) return {
    failures: ['approved responsive wordmark lockup is missing'],
    warnings: [],
    recommended_identity_mode: { money_of_ai: 'series_only', built_with_ai: 'series_only' },
    identity: { money_of_ai: emptyMetrics, built_with_ai: emptyMetrics },
    series_only: { money_of_ai: emptyMetrics, built_with_ai: emptyMetrics },
    anchor: emptyMetrics,
  }

  const failures: string[] = []
  const warnings: string[] = []
  const recommendedMode = {} as MarkedSeriesRecord<'stacked_identity' | 'series_only'>
  const identity = {} as MarkedSeriesRecord<BrandWordmarkLegibilityMetrics>
  const seriesOnly = {} as MarkedSeriesRecord<BrandWordmarkLegibilityMetrics>
  const minimum = lockup.minimum_effective
  const anchorMindmakeHeight = renderedHeight(theme.wordmarks.mindmake, lockup.anchor.mindmake_width)
  const anchor = {
    mindmake_width_px: lockup.anchor.mindmake_width,
    mindmake_height_px: anchorMindmakeHeight,
    series_width_px: 0,
    series_asset_height_px: 0,
    series_letter_height_px: 0,
    series_letter_height_at_375_css_px: 0,
    plate_width_px: lockup.anchor.plate_width,
    plate_height_px: lockup.anchor.plate_height,
  }
  const anchorFits = lockup.anchor.mindmake_width <= lockup.anchor.plate_width - lockup.anchor.padding * 2
    && anchorMindmakeHeight <= lockup.anchor.plate_height - lockup.anchor.padding * 2
  if (lockup.anchor.mindmake_width < minimum.mindmake_width_px || anchorMindmakeHeight < minimum.mindmake_height_px || !anchorFits) failures.push('Mindmake-only anchor renders below the 1080x1920 legibility or fit floor')

  for (const series of SERIES_IDS) {
    const asset = theme.wordmarks.series[series]
    if (!asset) continue
    const mindmakeHeight = renderedHeight(theme.wordmarks.mindmake, lockup.identity.mindmake_width)
    const seriesHeight = renderedHeight(asset, lockup.identity.series_width)
    const seriesLetterHeight = renderedLetterHeight(asset, lockup.identity.series_width)
    const seriesLetterCss = seriesLetterHeight * minimum.preview_width_css_px / lockup.reference_canvas.width
    const fallbackHeight = renderedHeight(asset, lockup.series_only_fallback.series_width)
    const fallbackLetterHeight = renderedLetterHeight(asset, lockup.series_only_fallback.series_width)
    const fallbackLetterCss = fallbackLetterHeight * minimum.preview_width_css_px / lockup.reference_canvas.width
    const identityMetrics = {
      mindmake_width_px: lockup.identity.mindmake_width,
      mindmake_height_px: mindmakeHeight,
      series_width_px: lockup.identity.series_width,
      series_asset_height_px: seriesHeight,
      series_letter_height_px: seriesLetterHeight,
      series_letter_height_at_375_css_px: seriesLetterCss,
      plate_width_px: lockup.identity.plate_width,
      plate_height_px: lockup.identity.plate_height,
    }
    const fallbackMetrics = {
      mindmake_width_px: 0,
      mindmake_height_px: 0,
      series_width_px: lockup.series_only_fallback.series_width,
      series_asset_height_px: fallbackHeight,
      series_letter_height_px: fallbackLetterHeight,
      series_letter_height_at_375_css_px: fallbackLetterCss,
      plate_width_px: lockup.series_only_fallback.plate_width,
      plate_height_px: lockup.series_only_fallback.plate_height,
    }
    identity[series] = identityMetrics
    seriesOnly[series] = fallbackMetrics
    const identityFits = lockup.identity.mindmake_width <= lockup.identity.plate_width - lockup.identity.padding * 2
      && lockup.identity.series_width <= lockup.identity.plate_width - lockup.identity.padding * 2
      && mindmakeHeight + lockup.identity.gap + seriesHeight <= lockup.identity.plate_height - lockup.identity.padding * 2
    const identityLegible = lockup.identity.mindmake_width >= minimum.mindmake_width_px
      && mindmakeHeight >= minimum.mindmake_height_px
      && seriesLetterHeight >= minimum.series_letter_height_px
      && seriesLetterCss >= minimum.series_letter_height_css_px
      && identityFits
    const fallbackFits = lockup.series_only_fallback.series_width <= lockup.series_only_fallback.plate_width - lockup.series_only_fallback.padding * 2
      && fallbackHeight <= lockup.series_only_fallback.plate_height - lockup.series_only_fallback.padding * 2
    const fallbackLegible = fallbackLetterHeight >= minimum.series_letter_height_px
      && fallbackLetterCss >= minimum.series_letter_height_css_px
      && fallbackFits
    if (!fallbackLegible) failures.push(`${series} official series-only fallback renders below the ${minimum.series_letter_height_px} px or ${minimum.series_letter_height_css_px} CSS px lettering floor, or exceeds its plate`)
    if (identityLegible) recommendedMode[series] = 'stacked_identity'
    else if (fallbackLegible) {
      recommendedMode[series] = 'series_only'
      warnings.push(`${series} stacked identity is below its declared lettering or fit floor; use the official series-only identity moment`)
    } else {
      recommendedMode[series] = 'series_only'
      failures.push(`${series} has no legible identity mode at 1080x1920`)
    }
  }
  return { failures: [...new Set(failures)], warnings: [...new Set(warnings)], recommended_identity_mode: recommendedMode, identity, series_only: seriesOnly, anchor }
}

export function brandWordmarkLegibilityIssues(theme: BrandThemeV1): string[] {
  return brandWordmarkLegibilityReport(theme).failures
}

export async function stageOfficialWordmarks(manifest: RenderManifestV1, targetDirectory: string, fetchImpl: typeof fetch = fetch): Promise<StagedBrandWordmarks | undefined> {
  if (manifest.branding === 'none') return undefined
  const theme = manifest.brand_theme
  if (!theme) throw new Error('branded renders require a pinned brand theme with official wordmarks')
  if (!theme.rules.official_wordmarks_only || !theme.wordmarks) throw new Error('branded renders cannot use recreated or missing wordmarks')
  if (!theme.wordmarks.lockup) throw new Error('branded renders require the approved responsive wordmark lockup')
  const issues = brandWordmarkLegibilityIssues(theme)
  if (issues.length) throw new Error(`official wordmark legibility gate failed: ${issues.join('; ')}`)
  const seriesAsset = officialSeriesMark(theme, manifest.series as Series)
  return {
    mindmake: await stageAsset(theme, theme.wordmarks.mindmake, targetDirectory, 'mindmake', fetchImpl),
    series: await stageAsset(theme, seriesAsset, targetDirectory, manifest.series, fetchImpl),
    lockup: theme.wordmarks.lockup,
  }
}

/** The official mark for a series, or a plain refusal naming the missing
 *  approval. The live subchannels have no approved mark yet (walk log F21),
 *  and a mark is never recreated as text. */
export function officialSeriesMark(theme: BrandThemeV1, series: Series): BrandWordmarkAssetV1 {
  const asset = theme.wordmarks?.series[series]
  if (!asset) throw new Error(`${series} has no approved official wordmark yet; a branded render needs one pinned in studio.json`)
  return asset
}

export async function stageOfficialSeriesWordmarks(theme: BrandThemeV1, series: Series, targetDirectory: string, fetchImpl: typeof fetch = fetch): Promise<Pick<StagedBrandWordmarks, 'mindmake' | 'series'>> {
  if (!theme.rules.official_wordmarks_only || !theme.wordmarks) throw new Error('branded carousel renders require official wordmarks')
  return {
    mindmake: await stageAsset(theme, theme.wordmarks.mindmake, targetDirectory, 'mindmake', fetchImpl),
    series: await stageAsset(theme, officialSeriesMark(theme, series), targetDirectory, series, fetchImpl),
  }
}
