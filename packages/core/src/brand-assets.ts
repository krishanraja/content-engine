import { createHash } from 'node:crypto'
import { access, copyFile, mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'
import type { BrandThemeV1, BrandWordmarkAssetV1, BrandWordmarkLockupV1, RenderManifestV1, Series } from '@mindmake/contracts'
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

const MAX_BRAND_ASSET_BYTES = 2_000_000

export function officialWordmarkUrl(theme: BrandThemeV1, asset: BrandWordmarkAssetV1): string {
  if (!/^[a-z0-9_.-]+\/[a-z0-9_.-]+$/i.test(theme.source.repository)) throw new Error('brand source repository must be an owner/name GitHub repository')
  const encodedPath = asset.source_path.split('/').map(encodeURIComponent).join('/')
  return `https://raw.githubusercontent.com/${theme.source.repository}/${theme.source.commit}/${encodedPath}`
}

function contentHash(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex')
}

async function cachedOfficialAsset(theme: BrandThemeV1, asset: BrandWordmarkAssetV1, fetchImpl: typeof fetch): Promise<string> {
  const cachePath = join(studioPaths().cacheRoot, 'brand-wordmarks', `${asset.sha256}.png`)
  try {
    await access(cachePath)
    const cachedHash = await hashFile(cachePath)
    if (cachedHash !== asset.sha256) throw new Error(`cached official wordmark hash mismatch for ${asset.source_path}`)
    return cachePath
  } catch (error) {
    if (error instanceof Error && /hash mismatch/.test(error.message)) throw error
  }

  const response = await fetchImpl(officialWordmarkUrl(theme, asset), { headers: { accept: 'image/png' } })
  if (!response.ok) throw new Error(`official wordmark download failed for ${asset.source_path}: HTTP ${response.status}`)
  const contentType = response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
  if (contentType !== 'image/png' && contentType !== 'application/octet-stream') throw new Error(`official wordmark returned unsupported content type ${contentType || 'unknown'}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (!bytes.length || bytes.length > MAX_BRAND_ASSET_BYTES) throw new Error(`official wordmark size is outside the allowed range for ${asset.source_path}`)
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
  const destination = join(targetDirectory, `brand-${label}-${asset.sha256.slice(0, 16)}.png`)
  await mkdir(targetDirectory, { recursive: true })
  await copyFile(cachedPath, destination)
  if (await hashFile(destination) !== asset.sha256) throw new Error(`staged official wordmark hash mismatch for ${asset.source_path}`)
  return { ...asset, assetFile: basename(destination) }
}

export function brandWordmarkLegibilityIssues(theme: BrandThemeV1): string[] {
  if (!theme.wordmarks) return ['official wordmark mapping is missing']
  const issues: string[] = []
  const mindmakeHeight = theme.wordmarks.mindmake.display_width * theme.wordmarks.mindmake.alpha_crop.height / theme.wordmarks.mindmake.alpha_crop.width
  if (mindmakeHeight < 32) issues.push('Mindmake wordmark renders below the 32 px minimum content height')
  for (const [series, asset] of Object.entries(theme.wordmarks.series)) {
    const renderedHeight = asset.display_width * asset.alpha_crop.height / asset.alpha_crop.width
    if (asset.display_width < 250 || renderedHeight < 145) issues.push(`${series} wordmark renders below the series legibility floor`)
  }
  const lockup = theme.wordmarks.lockup
  if (!lockup) return [...issues, 'approved compact wordmark lockup is missing']
  const innerSize = lockup.plate_size - lockup.padding * 2
  const mindmakeLockupHeight = lockup.mindmake_width * theme.wordmarks.mindmake.alpha_crop.height / theme.wordmarks.mindmake.alpha_crop.width
  if (lockup.mindmake_width < 180 || mindmakeLockupHeight < 29) issues.push('Mindmake lockup wordmark renders below the approved legibility floor')
  for (const [series, asset] of Object.entries(theme.wordmarks.series)) {
    const renderedHeight = lockup.series_width * asset.alpha_crop.height / asset.alpha_crop.width
    if (lockup.series_width < 210 || renderedHeight < 122) issues.push(`${series} lockup wordmark renders below the approved legibility floor`)
    if (mindmakeLockupHeight + lockup.gap + renderedHeight > innerSize) issues.push(`${series} lockup exceeds the approved square plate height`)
  }
  return issues
}

export async function stageOfficialWordmarks(manifest: RenderManifestV1, targetDirectory: string, fetchImpl: typeof fetch = fetch): Promise<StagedBrandWordmarks | undefined> {
  if (manifest.branding === 'none') return undefined
  const theme = manifest.brand_theme
  if (!theme) throw new Error('branded renders require a pinned brand theme with official wordmarks')
  if (!theme.rules.official_wordmarks_only || !theme.wordmarks) throw new Error('branded renders cannot use recreated or missing wordmarks')
  if (!theme.wordmarks.lockup) throw new Error('branded renders require the approved compact wordmark lockup')
  const issues = brandWordmarkLegibilityIssues(theme)
  if (issues.length) throw new Error(`official wordmark legibility gate failed: ${issues.join('; ')}`)
  const seriesAsset = theme.wordmarks.series[manifest.series as Series]
  return {
    mindmake: await stageAsset(theme, theme.wordmarks.mindmake, targetDirectory, 'mindmake', fetchImpl),
    series: await stageAsset(theme, seriesAsset, targetDirectory, manifest.series, fetchImpl),
    lockup: theme.wordmarks.lockup,
  }
}
