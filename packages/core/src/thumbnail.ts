import { access, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'
import { PUBLIC_SERIES_NAMES, RenderManifestV2Schema, isLiveSeries, type BrandThemeV1, type RenderManifestV2 } from '@mindmake/contracts'
import { ThumbnailPropsSchema, type ThumbnailProps } from '../../../apps/renderer/src/thumbnail/props.js'
import { brandThemeRefusal, stagePublicationMarks, type StagedPublicationMarks } from './brand-assets.js'
import { hashFile, hashPath, hashValue } from './hash.js'
import { jobPath } from './paths.js'
import { loadPinnedRenderRegistryV2, sharedBrowserExecutableV2 } from './render-v2.js'

// The Short's thumbnail in the makeyourmindup house style (the mock Krish
// approved on 2026-09-28, frame 5): the section's colour block, its day and
// pill, the mark on its tile, the headline in Anton, the dek in Fraunces
// italic and a sticker, all inside the middle 1080 x 1440 that Instagram's
// grid shows. It is the Short's package cover. It carries no photograph: the
// composition has no field for one.

const COMPOSITION_ID = 'MakeyourmindupThumbnail'

export interface ThumbnailCopyV1 {
  /** The piece's title, as the headline (Anton, uppercase). */
  headline: string
  /** The human line under it (Fraunces italic). */
  dek: string
}

export interface RenderedThumbnailV1 {
  path: string
  sha256: string
}

/** The thumbnail's props: pure, from the theme, the staged mark and the
 *  copy. A piece with a call says so on its sticker; any other carries its
 *  channel's sticker. */
export function thumbnailInputProps(theme: BrandThemeV1, marks: Pick<StagedPublicationMarks, 'mark' | 'channelLabel' | 'channelColor' | 'channelCopy'>, series: RenderManifestV2['series'], copy: ThumbnailCopyV1, options: { hasCall: boolean; reviewMode?: boolean; markDataUrl?: string }): ThumbnailProps {
  const house = theme.publication?.house_style
  if (!house || !marks.channelCopy) throw new Error(`${theme.theme_id} has no makeyourmindup house style; the thumbnail is drawn only in it`)
  if (!isLiveSeries(series)) throw new Error(`the thumbnail is for the live subchannels; ${series} keeps the theme it was approved under`)
  return ThumbnailPropsSchema.parse({
    reviewMode: options.reviewMode ?? false,
    series,
    channelLabel: PUBLIC_SERIES_NAMES[series],
    day: marks.channelCopy.day,
    headline: copy.headline.trim(),
    dek: copy.dek.trim(),
    sticker: options.hasCall ? house.copy.thumbnail_call_sticker : marks.channelCopy.sticker,
    mark: { assetFile: marks.mark.assetFile, ...(options.markDataUrl ? { assetDataUrl: options.markDataUrl } : {}), pixelWidth: marks.mark.pixel_width, pixelHeight: marks.mark.pixel_height },
    tokens: { ink: house.tokens.ink, inkDeep: house.tokens.ink_deep, inkSoft: house.tokens.ink_soft, cream: house.tokens.cream, mint: house.tokens.mint, section: marks.channelColor },
  })
}

/** The house style theme a branded manifest pins, from the job's own pinned
 *  configuration, or undefined for a manifest the house style does not draw. */
export async function houseThemeForManifestV2(manifest: RenderManifestV2): Promise<BrandThemeV1 | undefined> {
  if (manifest.branding.mode !== 'series') return undefined
  const registry = await loadPinnedRenderRegistryV2(manifest)
  const theme = registry.brand_themes.find((candidate) => candidate.theme_id === manifest.branding.theme_id && candidate.version === manifest.branding.theme_version && hashValue(candidate) === manifest.branding.theme_hash)
  return theme?.publication?.house_style ? theme : undefined
}

/** Renders the thumbnail for a Short to a JPEG in the job, content addressed,
 *  and returns it with its hash. Refused while the theme is a candidate. */
export async function renderThumbnailV2(repoRoot: string, manifestInput: RenderManifestV2, copy: ThumbnailCopyV1): Promise<RenderedThumbnailV1> {
  const manifest = RenderManifestV2Schema.parse(manifestInput)
  const theme = await houseThemeForManifestV2(manifest)
  if (!theme) throw new Error('the thumbnail is drawn only for a manifest branded in the makeyourmindup house style')
  const refusal = brandThemeRefusal(theme, manifest.series)
  if (refusal) throw new Error(refusal)
  const rendererHash = hashValue({
    house: await hashPath(join(repoRoot, 'apps', 'renderer', 'src', 'house')),
    thumbnail: await hashPath(join(repoRoot, 'apps', 'renderer', 'src', 'thumbnail')),
    root: await hashFile(join(repoRoot, 'apps', 'renderer', 'src', 'Root.tsx')),
    dependencies: await hashFile(join(repoRoot, 'package-lock.json')),
  })
  const key = hashValue({ theme: hashValue(theme), series: manifest.series, copy, call: Boolean(manifest.call), renderer: rendererHash }).slice(0, 20)
  const directory = join(jobPath(manifest.job_id), 'thumbnails', key)
  const output = join(directory, 'thumbnail.jpg')
  await mkdir(directory, { recursive: true })
  try {
    await access(output)
    return { path: output, sha256: await hashFile(output) }
  } catch { /* Render a missing content-addressed thumbnail. */ }
  const staging = join(directory, 'staging')
  const marks = await stagePublicationMarks(theme, manifest.series, staging)
  const inputProps = thumbnailInputProps(theme, marks, manifest.series, copy, { hasCall: Boolean(manifest.call) })
  const browserExecutable = await sharedBrowserExecutableV2()
  const serveUrl = await bundle({ entryPoint: join(repoRoot, 'apps', 'renderer', 'src', 'index.ts'), publicDir: staging })
  const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, browserExecutable })
  await renderStill({ composition, serveUrl, output, frame: 0, inputProps, browserExecutable, imageFormat: 'jpeg', jpegQuality: 92, overwrite: false, logLevel: 'warn' })
  return { path: output, sha256: await hashFile(output) }
}
