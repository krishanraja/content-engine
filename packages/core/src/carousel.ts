import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, resolve } from 'node:path'
import { bundle } from '@remotion/bundler'
import { ensureBrowser, renderStill, selectComposition } from '@remotion/renderer'
import { PDFDocument } from 'pdf-lib'
import {
  BrandThemeV1Schema,
  CarouselDraftPackageV1Schema,
  CarouselStoryV1Schema,
  confirmationRefMatches,
  normalizeEditorialFormatV1,
  type BrandThemeV1,
  type CarouselApprovalV1,
  type CarouselDraftPackageV1,
  type CarouselStoryV1,
  type PreferenceRuleV1,
} from '@mindmake/contracts'
import { stageOfficialSeriesWordmarks, type StagedWordmarkAsset } from './brand-assets.js'
import { BUILT_WITH_AI_EDITORIAL_RULE_ID, MONEY_OF_AI_EDITORIAL_RULE_ID } from './editorial.js'
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

function parseCarouselStoryInput(input: unknown): CarouselStoryV1 {
  const normalized = input && typeof input === 'object' && !Array.isArray(input) && typeof (input as { source_format?: unknown }).source_format === 'string'
    ? { ...input, source_format: normalizeEditorialFormatV1((input as { source_format: string }).source_format) }
    : input
  return CarouselStoryV1Schema.parse(normalized)
}

function seriesPreferenceActive(story: CarouselStoryV1, preferences: PreferenceRuleV1[], ruleId: string): boolean {
  return preferences.some((rule) => rule.rule_id === ruleId && rule.status === 'active' && (
    rule.scope.level === 'global' || (rule.scope.level === 'series' && rule.scope.key === story.series)
  ))
}

export function carouselEditorialPreferenceIssues(input: CarouselStoryV1, preferences: PreferenceRuleV1[] = []): string[] {
  const story = CarouselStoryV1Schema.parse(input)
  const moneyEnabled = seriesPreferenceActive(story, preferences, MONEY_OF_AI_EDITORIAL_RULE_ID)
  const builtEnabled = seriesPreferenceActive(story, preferences, BUILT_WITH_AI_EDITORIAL_RULE_ID)
  if (!moneyEnabled && !builtEnabled) return []

  const text = story.slides.map((slide) => `${slide.headline} ${slide.body || ''}`).join(' ').toLowerCase()
  const issues: string[] = []
  const sensationalTerms = [...new Set(text.match(/\b(?:insane|unbelievable|shocking|mind[- ]?blowing|terrifying|crazy|game[- ]?changer)\b/g) || [])]
  if (sensationalTerms.length) issues.push(`confirmed editorial standard rejects unsupported sensational framing: ${sensationalTerms.join(', ')}`)
  if (/\b(?:follow (?:me|us|for)|subscribe|smash (?:the )?like|hit (?:the )?follow)\b/i.test(text)) issues.push('confirmed editorial standard rejects follow or subscribe requests inside the story')
  if (/\b(?:comment below|drop (?:a )?comment|let me know in the comments|what do you think\??)\b/i.test(text)) issues.push('confirmed editorial standard rejects empty comment prompts in place of an earned ending')

  const assets = new Map(story.assets.map((asset) => [asset.asset_id, asset]))
  const proofSlides = story.slides.filter((slide) => ['mechanism', 'proof'].includes(slide.role))
  for (const slide of proofSlides) {
    const placed = slide.asset_ids.map((id) => assets.get(id)).filter(Boolean)
    if (slide.claim_ids.length && placed.length && placed.every((asset) => ['illustration', 'decoration'].includes(asset!.truth_role))) {
      issues.push(`slide ${slide.position} uses illustration or decoration as the only visual support for a claim`)
    }
  }

  if (moneyEnabled) {
    if (!story.claims.length) issues.push('The Money of AI standard requires at least one explicit claim boundary')
    const earlyProof = story.slides.slice(0, 3).some((slide) => slide.role === 'proof' || slide.asset_ids.some((id) => ['evidence', 'owned_artifact'].includes(assets.get(id)?.truth_role || '')))
    if (!earlyProof) issues.push('The Money of AI standard expects a receipt, artifact, or proof beat in the first three slides')
  }

  if (builtEnabled && ['build_itself', 'first_version'].includes(story.source_format)) {
    const earlyArtifact = story.slides.slice(0, 3).some((slide) => slide.asset_ids.some((id) => ['evidence', 'owned_artifact'].includes(assets.get(id)?.truth_role || '')))
    if (!earlyArtifact) issues.push(`${story.source_format} expects a concrete build or artifact in the first three slides`)
  }

  return [...new Set(issues)]
}

export function carouselStoryContentHash(input: CarouselStoryV1): string {
  const story = CarouselStoryV1Schema.parse(input)
  return hashValue({ ...story, approvals: [] })
}

/**
 * An approval counts only when it names the gate, binds the exact story content hash, and carries a user
 * confirmation reference bound to that same gate and hash. Anything else is not an approval.
 */
export function carouselApprovalBinds(approval: CarouselApprovalV1, gate: CarouselApprovalV1['gate'], contentHash: string): boolean {
  return approval.gate === gate
    && approval.decision === 'approved'
    && approval.artifact_hash === contentHash
    && confirmationRefMatches(approval.confirmation_ref, gate, contentHash)
}

export function carouselProductionIssues(input: CarouselStoryV1): string[] {
  const story = CarouselStoryV1Schema.parse(input)
  const contentHash = carouselStoryContentHash(story)
  const issues: string[] = []
  if (story.editorial.disposition !== 'publishable') issues.push(`editorial disposition is ${story.editorial.disposition}`)
  for (const gate of ['story', 'visual_direction'] as const) {
    if (!story.approvals.some((approval) => carouselApprovalBinds(approval, gate, contentHash))) issues.push(`${gate} approval for the exact story is missing`)
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

async function runtimeWordmark(asset: StagedWordmarkAsset, stagingDirectory: string) {
  const mimeType = extname(asset.assetFile).toLowerCase() === '.svg' ? 'image/svg+xml' : 'image/png'
  const assetDataUrl = `data:${mimeType};base64,${(await readFile(join(stagingDirectory, asset.assetFile))).toString('base64')}`
  const cropDataUrl = (crop: StagedWordmarkAsset['alpha_crop']) => {
    const wrapper = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop.x} ${crop.y} ${crop.width} ${crop.height}"><image href="${assetDataUrl}" x="0" y="0" width="${asset.pixel_width}" height="${asset.pixel_height}"/></svg>`
    return `data:image/svg+xml;base64,${Buffer.from(wrapper).toString('base64')}`
  }
  return {
    assetFile: asset.assetFile,
    assetDataUrl,
    alphaCropDataUrl: cropDataUrl(asset.alpha_crop),
    letterCropDataUrl: cropDataUrl(asset.letter_region),
    pixelWidth: asset.pixel_width,
    pixelHeight: asset.pixel_height,
    alphaCrop: { x: asset.alpha_crop.x, y: asset.alpha_crop.y, width: asset.alpha_crop.width, height: asset.alpha_crop.height },
    letterRegion: { x: asset.letter_region.x, y: asset.letter_region.y, width: asset.letter_region.width, height: asset.letter_region.height },
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
  const story = parseCarouselStoryInput(storyInput)
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
  const runtimeWordmarks = {
    mindmake: await runtimeWordmark(wordmarks.mindmake, staging),
    series: await runtimeWordmark(wordmarks.series, staging),
  }
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
        scene: slide.scene,
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
        wordmarks: runtimeWordmarks,
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
  const story = parseCarouselStoryInput(storyInput)
  const storyHash = carouselStoryContentHash(story)
  if (!story.approvals.some((approval) => carouselApprovalBinds(approval, 'final', storyHash))) throw new Error('final approval for the exact carousel story is missing')
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
