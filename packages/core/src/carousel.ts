import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { bundle } from '@remotion/bundler'
import { ensureBrowser, renderStill, selectComposition } from '@remotion/renderer'
import { PDFDocument } from 'pdf-lib'
import {
  BrandThemeV1Schema,
  CarouselDraftPackageV1Schema,
  CarouselStoryV1Schema,
  type BrandThemeV1,
  type CarouselDraftPackageV1,
  type CarouselStoryV1,
} from '@mindmake/contracts'
import { stageOfficialSeriesWordmarks, type StagedWordmarkAsset } from './brand-assets.js'
import { hashFile, hashValue } from './hash.js'

const COMPOSITION_ID = 'MindmakeCarouselSlide'
const SERIES_NAMES = { money_of_ai: 'The Money of AI', built_with_ai: 'Built With AI' } as const

export interface CarouselRenderResult {
  story_id: string
  story_hash: string
  review_mode: boolean
  slides: Array<{ position: number; path: string; sha256: string }>
}

interface StudioBrandConfig {
  default_brand_theme?: string
  brand_themes?: unknown[]
}

export function carouselStoryContentHash(input: CarouselStoryV1): string {
  const story = CarouselStoryV1Schema.parse(input)
  return hashValue({ ...story, approvals: [] })
}

export function carouselProductionIssues(input: CarouselStoryV1): string[] {
  const story = CarouselStoryV1Schema.parse(input)
  const contentHash = carouselStoryContentHash(story)
  const issues: string[] = []
  if (story.editorial.disposition !== 'publishable') issues.push(`editorial disposition is ${story.editorial.disposition}`)
  for (const gate of ['story', 'visual_direction'] as const) {
    if (!story.approvals.some((approval) => approval.gate === gate && approval.artifact_hash === contentHash)) issues.push(`${gate} approval for the exact story is missing`)
  }
  return issues
}

async function loadPinnedTheme(configPath: string, story: CarouselStoryV1): Promise<BrandThemeV1> {
  const config = JSON.parse(await readFile(configPath, 'utf8')) as StudioBrandConfig
  const themes = (config.brand_themes || []).map((theme) => BrandThemeV1Schema.parse(theme))
  const theme = themes.find((candidate) => candidate.theme_id === story.brand_theme.theme_id)
  if (!theme || theme.status !== 'active') throw new Error(`active brand theme ${story.brand_theme.theme_id} is unavailable`)
  if (hashValue(theme) !== story.brand_theme.theme_hash) throw new Error('carousel story brand theme hash does not match the pinned configuration')
  if (theme.source.repository !== story.brand_theme.design_repository || theme.source.commit !== story.brand_theme.design_commit || theme.source.contract_path !== story.brand_theme.design_contract_path) throw new Error('carousel story design authority does not match the pinned theme')
  return theme
}

function runtimeWordmark(asset: StagedWordmarkAsset) {
  return {
    assetFile: asset.assetFile,
    pixelWidth: asset.pixel_width,
    pixelHeight: asset.pixel_height,
    alphaCrop: { x: asset.alpha_crop.x, y: asset.alpha_crop.y, width: asset.alpha_crop.width, height: asset.alpha_crop.height },
  }
}

async function stageStoryAssets(story: CarouselStoryV1, directory: string) {
  const staged = []
  for (const asset of story.assets) {
    if (await hashFile(asset.source_path) !== asset.sha256) throw new Error(`carousel asset hash mismatch for ${asset.asset_id}`)
    const output = join(directory, `asset-${asset.asset_id}${extname(asset.source_path).toLowerCase()}`)
    await copyFile(asset.source_path, output)
    staged.push({ assetId: asset.asset_id, assetFile: basename(output), truthRole: asset.truth_role, ...(asset.attribution ? { attribution: asset.attribution } : {}), ...(asset.illustration_label ? { illustrationLabel: asset.illustration_label } : {}) })
  }
  return staged
}

export async function renderCarousel(repoRoot: string, configPath: string, storyInput: unknown, outputDirectory: string, reviewMode = false): Promise<CarouselRenderResult> {
  const story = CarouselStoryV1Schema.parse(storyInput)
  if (!reviewMode) {
    const issues = carouselProductionIssues(story)
    if (issues.length) throw new Error(`carousel production gate failed: ${issues.join('; ')}`)
  }
  const theme = await loadPinnedTheme(configPath, story)
  if (!theme.wordmarks) throw new Error('carousel brand theme has no official wordmarks')
  const storyHash = carouselStoryContentHash(story)
  const target = resolve(outputDirectory, `${story.story_id}-${storyHash.slice(0, 16)}${reviewMode ? '-review' : ''}`)
  const staging = join(target, 'staging')
  const slidesDirectory = join(target, 'slides')
  await Promise.all([mkdir(staging, { recursive: true }), mkdir(slidesDirectory, { recursive: true })])
  const wordmarks = await stageOfficialSeriesWordmarks(theme, story.series, staging)
  const assets = await stageStoryAssets(story, staging)
  const browser = await ensureBrowser({ chromeMode: 'headless-shell', logLevel: 'warn' })
  if (browser.type !== 'local-puppeteer-browser' && browser.type !== 'user-defined-path') throw new Error('Remotion browser could not be installed')
  const browserExecutable = browser.path
  const serveUrl = await bundle({ entryPoint: join(repoRoot, 'apps', 'renderer', 'src', 'index.ts'), publicDir: staging })
  const slides: CarouselRenderResult['slides'] = []
  for (const slide of story.slides) {
    const inputProps = {
      reviewMode,
      storyId: story.story_id,
      series: story.series,
      seriesName: SERIES_NAMES[story.series],
      slideCount: story.slides.length,
      slide: {
        position: slide.position,
        role: slide.role,
        layout: slide.layout,
        headline: slide.headline,
        ...(slide.body ? { body: slide.body } : {}),
        ...(slide.data_label ? { dataLabel: slide.data_label } : {}),
        visualItems: slide.visual_items,
        assetIds: slide.asset_ids,
        accent: slide.accent,
      },
      branding: {
        colors: { ink: theme.colors.ink, surface: theme.colors.surface, raised: theme.colors.raised, line: theme.colors.line, text: theme.colors.text, secondaryText: theme.colors.secondary_text, mutedText: theme.colors.muted_text, paper: theme.colors.paper, mint: theme.colors.mint, mintInk: theme.colors.mint_ink, amber: theme.colors.amber },
        typography: theme.typography,
        wordmarks: { mindmake: runtimeWordmark(wordmarks.mindmake), series: runtimeWordmark(wordmarks.series) },
        assets,
      },
    }
    const composition = await selectComposition({ serveUrl, id: COMPOSITION_ID, inputProps, browserExecutable })
    const output = join(slidesDirectory, `${String(slide.position).padStart(2, '0')}.png`)
    await renderStill({ composition, serveUrl, output, frame: 0, inputProps, browserExecutable, imageFormat: 'png', overwrite: true, logLevel: 'warn' })
    slides.push({ position: slide.position, path: output, sha256: await hashFile(output) })
  }
  await writeFile(join(target, 'render.json'), `${JSON.stringify({ story_id: story.story_id, story_hash: storyHash, review_mode: reviewMode, slides }, null, 2)}\n`, 'utf8')
  return { story_id: story.story_id, story_hash: storyHash, review_mode: reviewMode, slides }
}

async function writeLinkedInPdf(slides: CarouselRenderResult['slides'], outputPath: string): Promise<void> {
  const pdf = await PDFDocument.create()
  pdf.setTitle('Mindmake carousel')
  pdf.setProducer('Mindmake Carousel Engine')
  pdf.setCreator('Mindmake Carousel Engine')
  const fixedDate = new Date('2000-01-01T00:00:00.000Z')
  pdf.setCreationDate(fixedDate)
  pdf.setModificationDate(fixedDate)
  for (const slide of slides) {
    const image = await pdf.embedPng(await readFile(slide.path))
    const page = pdf.addPage([1080, 1350])
    page.drawImage(image, { x: 0, y: 0, width: 1080, height: 1350 })
  }
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, await pdf.save({ useObjectStreams: false, addDefaultPage: false }))
}

export async function packageCarousel(repoRoot: string, configPath: string, storyInput: unknown, outputDirectory: string): Promise<CarouselDraftPackageV1> {
  const story = CarouselStoryV1Schema.parse(storyInput)
  const storyHash = carouselStoryContentHash(story)
  if (!story.approvals.some((approval) => approval.gate === 'final' && approval.artifact_hash === storyHash)) throw new Error('final approval for the exact carousel story is missing')
  const rendered = await renderCarousel(repoRoot, configPath, story, outputDirectory, false)
  const target = dirname(dirname(rendered.slides[0]!.path))
  const pdfPath = join(target, `${story.story_id}-linkedin.pdf`)
  let linkedinPdf: CarouselDraftPackageV1['linkedin_pdf']
  if (story.platforms.includes('linkedin_document')) {
    await writeLinkedInPdf(rendered.slides, pdfPath)
    linkedinPdf = { path: pdfPath, sha256: await hashFile(pdfPath) }
  }
  const manifest = CarouselDraftPackageV1Schema.parse({
    schema_version: 1,
    package_id: `carousel-${storyHash.slice(0, 20)}`,
    story_id: story.story_id,
    story_hash: storyHash,
    created_at: new Date().toISOString(),
    slide_pngs: rendered.slides,
    ...(linkedinPdf ? { linkedin_pdf: linkedinPdf } : {}),
    platforms: story.platforms,
    public_posting_authorised: false,
  })
  await writeFile(join(target, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  return manifest
}
