import { cp, lstat, mkdir, readdir, readFile, realpath, writeFile } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import {
  DraftPackageV1Schema,
  DraftPackageV2Schema,
  PUBLIC_SERIES_NAMES,
  SCHEMA_VERSION,
  type CandidateV1,
  type DraftPackageV1,
  type DraftPackageV2,
  type JobManifestV2,
  type RenderManifestV1,
  type RenderManifestV2,
  type VideoPlatformV1,
  SERIES_LINE,
} from '@mindmake/contracts'
import {
  ARCHIVE_COPY_MAX,
  ARCHIVE_PLACE_FOR_PLATFORM,
  ARCHIVE_PLACES,
  archiveFileName,
  archiveLocalDate,
  archivePlacesForPlatforms,
  archiveSafeText,
  assertArchiveDate,
  nextArchiveFolder,
  type ArchiveFolderInput,
  type ArchivePlace,
} from './archive-naming.js'
import { hashFile, hashValue } from './hash.js'
import { jobPath, studioPaths } from './paths.js'
import { run } from './process.js'
import { loadBoundProductionBriefV2 } from './production-brief.js'
import { publicCopyChecks } from './qa.js'

function srtTimestamp(milliseconds: number): string {
  const hours = Math.floor(milliseconds / 3_600_000)
  const minutes = Math.floor(milliseconds % 3_600_000 / 60_000)
  const seconds = Math.floor(milliseconds % 60_000 / 1000)
  const millis = Math.floor(milliseconds % 1000)
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':') + `,${String(millis).padStart(3, '0')}`
}

type CaptionTrack = { captions: Array<{ start_ms: number; end_ms: number; text: string }> }

function captionsAsSrt(manifest: CaptionTrack): string {
  return manifest.captions.map((cue, index) => `${index + 1}\n${srtTimestamp(cue.start_ms)} --> ${srtTimestamp(cue.end_ms)}\n${cue.text}\n`).join('\n')
}

export const VIDEO_PACKAGE_PLATFORMS = ['youtube_shorts', 'linkedin', 'tiktok', 'instagram_reels'] as const satisfies readonly VideoPlatformV1[]
export const V2_PACKAGER_VERSION = 'mindmake-platform-package-v2.1.0'

export interface DraftPackageBindingV2 {
  job_id: string
  platform: VideoPlatformV1
  render_manifest_hash: string
  master_hash: string
  package_root?: string
}

function pathIsWithin(root: string, candidate: string): boolean {
  const rel = relative(resolve(root), resolve(candidate))
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

async function realPathIsWithin(root: string, candidate: string): Promise<boolean> {
  try {
    return pathIsWithin(await realpath(root), await realpath(candidate))
  } catch {
    return false
  }
}

export async function draftPackageFileIssuesV2(draft: DraftPackageV2, expected?: DraftPackageBindingV2): Promise<string[]> {
  const files = [
    ['master', draft.master_path, draft.master_hash],
    ['captions', draft.captions_path, draft.captions_hash],
    ['cover', draft.cover_path, draft.cover_hash],
    ['platform metadata', draft.platform_metadata_path, draft.platform_metadata_hash],
    ['titles', draft.titles_path, draft.titles_hash],
    ['post copy', draft.post_path, draft.post_hash],
    ['claim ledger', draft.claim_ledger_path, draft.claim_ledger_hash],
    ['asset ledger', draft.asset_ledger_path, draft.asset_ledger_hash],
    ['provenance', draft.provenance_path, draft.provenance_hash],
  ] as const
  const issues: string[] = []

  const expectedJobId = expected?.job_id ?? draft.job_id
  const expectedPlatform = expected?.platform ?? draft.platform
  const expectedJobRoot = jobPath(expectedJobId)
  const expectedPlatformRoot = join(expectedJobRoot, 'packages', 'v2', expectedPlatform)
  const declaredPackageRoot = dirname(resolve(draft.master_path))
  const expectedPackageRoot = expected?.package_root ? resolve(expected.package_root) : declaredPackageRoot

  if (draft.job_id !== expectedJobId) issues.push('package job binding does not match the current job')
  if (draft.platform !== expectedPlatform) issues.push('package platform binding does not match the target platform')
  if (expected && draft.render_manifest_hash !== expected.render_manifest_hash) issues.push('package render manifest binding is stale or forged')
  if (expected && draft.master_hash !== expected.master_hash) issues.push('package master binding is stale or forged')
  if (!pathIsWithin(expectedPlatformRoot, expectedPackageRoot) || dirname(expectedPackageRoot) !== resolve(expectedPlatformRoot)) {
    issues.push('package root is outside the current job and target platform')
  }
  if (!/^[a-f0-9]{64}$/.test(basename(expectedPackageRoot))) issues.push('package root is not a content-addressed package key')
  if (!draft.package_id.endsWith(basename(expectedPackageRoot).slice(0, 16))) issues.push('package ID does not match its content-addressed package root')
  if (expected?.package_root && declaredPackageRoot !== expectedPackageRoot) issues.push('package master path does not use the expected content-addressed package root')

  const exactPaths = new Map<string, string>([
    ['captions', join(expectedPackageRoot, 'captions.srt')],
    ['cover', join(expectedPackageRoot, 'cover.jpg')],
    ['platform metadata', join(expectedPackageRoot, 'platform-metadata.json')],
    ['titles', join(expectedPackageRoot, 'titles.txt')],
    ['post copy', join(expectedPackageRoot, 'post.txt')],
    ['claim ledger', join(expectedPackageRoot, 'claims.json')],
    ['asset ledger', join(expectedPackageRoot, 'assets.json')],
    ['provenance', join(expectedPackageRoot, 'provenance.json')],
  ])
  const expectedMasterName = `master-${draft.master_hash.slice(0, 16)}.mp4`
  if (basename(draft.master_path) !== expectedMasterName) issues.push('package master filename does not match its approved hash')

  for (const [label, path, expectedHash] of files) {
    const resolvedPath = resolve(path)
    if (!pathIsWithin(expectedJobRoot, resolvedPath) || !pathIsWithin(expectedPackageRoot, resolvedPath)) {
      issues.push(`${label} path is outside the current job package`)
      continue
    }
    const exactPath = label === 'master' ? join(expectedPackageRoot, expectedMasterName) : exactPaths.get(label)
    if (!exactPath || resolvedPath !== resolve(exactPath)) {
      issues.push(`${label} path is not the canonical package path`)
      continue
    }
    try {
      if (!await realPathIsWithin(expectedJobRoot, resolvedPath) || !await realPathIsWithin(expectedPackageRoot, resolvedPath)) {
        issues.push(`${label} path resolves outside the current job package`)
        continue
      }
      if (await hashFile(path) !== expectedHash) issues.push(`${label} file changed after package creation`)
    } catch {
      issues.push(`${label} file is missing or unreadable`)
    }
  }
  return issues
}

export interface PlatformPackageMetadataV2 {
  platform: VideoPlatformV1
  format: 'vertical_short'
  aspect_ratio: '9:16'
  copy: {
    opening_strategy: string
    cover_headline: string
    hashtags: string[]
    search_phrases: string[]
    alt_text: string
  }
  audio: {
    master: 'cleared_mix'
    native_audio_suggestions: string[]
    manual_rights_check_required: boolean
  }
  delivery: {
    destination: 'youtube_private' | 'local_draft'
    public_publish_action: 'human_only'
  }
}

export interface PlatformCopyV2 {
  titles: string[]
  description: string
  post: string
  pinned?: string
  metadata: PlatformPackageMetadataV2
}

function publicText(value: string): string {
  return value.replaceAll('\u2014', ':').trim()
}

function seriesTags(candidate: CandidateV1): string[] {
  // Jobs made under the retired names keep the tags they were drafted with.
  if (candidate.series === 'money_of_ai') return ['#Mindmake', '#TheMoneyOfAI', '#BusinessAI']
  if (candidate.series === 'built_with_ai') return ['#Mindmake', '#BuiltWithAI', '#AIForOperators']
  const line = SERIES_LINE[candidate.series]
  return ['#makeyourmindup', line === 'follow_the_money' ? '#FollowTheMoney' : line === 'mind_the_gap' ? '#MindTheGap' : '#UnderTheHood', '#AI']
}

export function platformCopyV2(candidate: CandidateV1, platform: VideoPlatformV1): PlatformCopyV2 {
  const hook = publicText(candidate.hook)
  const payoff = publicText(candidate.payoff)
  const series = PUBLIC_SERIES_NAMES[candidate.series]
  const hashtags = seriesTags(candidate)
  const common = {
    platform,
    format: 'vertical_short' as const,
    aspect_ratio: '9:16' as const,
    copy: {
      opening_strategy: 'Lead with the specific value or tension. Do not add an unsupported curiosity gap.',
      cover_headline: hook,
      hashtags,
      search_phrases: [hook, payoff, series],
      alt_text: `${series} vertical video. ${hook}`,
    },
    audio: {
      master: 'cleared_mix' as const,
      native_audio_suggestions: [] as string[],
      manual_rights_check_required: false,
    },
    delivery: {
      destination: platform === 'youtube_shorts' ? 'youtube_private' as const : 'local_draft' as const,
      public_publish_action: 'human_only' as const,
    },
  }

  if (platform === 'youtube_shorts') return {
    titles: [hook, `${hook} | ${series}`, payoff],
    description: `${payoff}\n\n${series}. Sources, claims and disclosures are retained in the production package.`,
    post: '',
    pinned: 'What does this change in practice for you?',
    metadata: { ...common, copy: { ...common.copy, opening_strategy: 'Use a direct, searchable title that pays off the first spoken beat.' } },
  }
  if (platform === 'linkedin') return {
    titles: [hook, payoff],
    description: payoff,
    post: `${hook}\n\n${payoff}\n\nThe practical question: what would you change this week?`,
    metadata: { ...common, copy: { ...common.copy, opening_strategy: 'Open with the business implication before adding context.' } },
  }
  if (platform === 'tiktok') return {
    titles: [hook, payoff],
    description: payoff,
    post: `${hook}\n\n${payoff}\n\n${hashtags.join(' ')}`,
    pinned: 'What would you test first?',
    metadata: {
      ...common,
      copy: { ...common.copy, opening_strategy: 'Make the first line match the spoken hook and use natural search language.' },
      audio: {
        master: 'cleared_mix',
        native_audio_suggestions: ['Optional low rhythmic bed selected natively only when it strengthens the beat without obscuring speech.'],
        manual_rights_check_required: true,
      },
    },
  }
  return {
    titles: [hook, payoff],
    description: payoff,
    post: `${hook}\n\n${payoff}\n\n${hashtags.join(' ')}`,
    pinned: 'Save this for the next time you make this decision.',
    metadata: {
      ...common,
      copy: { ...common.copy, opening_strategy: 'Use a value-specific first line and a cover headline that still works without audio.' },
      audio: {
        master: 'cleared_mix',
        native_audio_suggestions: ['Optional restrained native track chosen after rights review and mixed below clear speech.'],
        manual_rights_check_required: true,
      },
    },
  }
}

function v2Assets(manifest: RenderManifestV1 | RenderManifestV2): unknown[] {
  return manifest.assets
}

function hasGeneratedMedia(manifest: RenderManifestV1 | RenderManifestV2): boolean {
  return manifest.assets.some((asset) => asset.generated)
}

export async function createDraftPackageV2(
  jobId: string,
  platform: VideoPlatformV1,
  masterPath: string,
  candidate: CandidateV1,
  manifest: RenderManifestV1 | RenderManifestV2,
  qa: unknown,
  approvedHashes?: { render_manifest_hash?: string; master_path?: string; master_hash?: string },
  // A rendered cover, for a Short in the makeyourmindup house style: its
  // thumbnail (renderThumbnailV2). Without one, the cover is the master's
  // frame at half a second, as it always was.
  cover?: { path: string; sha256: string },
): Promise<DraftPackageV2> {
  if (manifest.schema_version === 2 && manifest.target_platform !== platform) {
    throw new Error(`render manifest targets ${manifest.target_platform}, not ${platform}`)
  }
  if (manifest.schema_version === 1 && (!manifest.caption_provenance?.verified || !manifest.caption_provenance.exact_word_fidelity)) {
    throw new Error('V2 packages require captions verified against the transcript with exact word fidelity')
  }
  if (manifest.schema_version === 2) {
    if (!approvedHashes?.render_manifest_hash || !approvedHashes.master_path || !approvedHashes.master_hash) throw new Error('V2 packages require exact current render manifest, master path, and master hash bindings')
    if (manifest.assets.some((asset) => asset.approval.state !== 'approved')) throw new Error('V2 packages require exact approval for every visual asset')
    if (manifest.generated_shots.some((shot) => shot.exact_approval.state !== 'approved')) throw new Error('V2 packages require exact approval for every generated shot')
  }
  const sourceMasterPath = resolve(masterPath)
  if (approvedHashes?.master_path && sourceMasterPath !== resolve(approvedHashes.master_path)) throw new Error('master path does not match the approved current render target')
  const actualMasterHash = await hashFile(masterPath)
  if (approvedHashes?.master_hash && approvedHashes.master_hash !== actualMasterHash) throw new Error('master file does not match the approved hash')
  const masterHash = approvedHashes?.master_hash || actualMasterHash
  const renderManifestHash = approvedHashes?.render_manifest_hash || hashValue(manifest)
  const copy = platformCopyV2(candidate, platform)
  if (cover && (!/\.jpe?g$/i.test(cover.path) || await hashFile(cover.path) !== cover.sha256)) throw new Error('the rendered cover must be the exact JPEG it was hashed as')
  const packageKey = hashValue({ schema_version: 2, packager_version: V2_PACKAGER_VERSION, job_id: jobId, platform, source_master_path: sourceMasterPath, master_hash: masterHash, candidate, render_manifest_hash: renderManifestHash, qa, platform_copy: copy, ...(cover ? { cover_hash: cover.sha256 } : {}) })
  const root = join(jobPath(jobId), 'packages', 'v2', platform, packageKey)
  await mkdir(root, { recursive: true })
  const masterTarget = join(root, `master-${masterHash.slice(0, 16)}.mp4`)
  const claimsPath = join(root, 'claims.json')
  const assetsPath = join(root, 'assets.json')
  const provenancePath = join(root, 'provenance.json')
  const captionsPath = join(root, 'captions.srt')
  const coverPath = join(root, 'cover.jpg')
  const metadataPath = join(root, 'platform-metadata.json')
  const postPath = join(root, 'post.txt')
  const titlesPath = join(root, 'titles.txt')
  const packagePath = join(root, 'package.json')
  try {
    const cacheStat = await lstat(packagePath)
    if (!cacheStat.isFile() || cacheStat.isSymbolicLink()) throw new Error('cached package manifest is not a regular job-contained file')
    if (!await realPathIsWithin(root, packagePath)) throw new Error('cached package manifest resolves outside its content-addressed package root')
    const existing = DraftPackageV2Schema.parse(JSON.parse(await readFile(packagePath, 'utf8')))
    const cacheIssues = await draftPackageFileIssuesV2(existing, {
      job_id: jobId,
      platform,
      render_manifest_hash: renderManifestHash,
      master_hash: masterHash,
      package_root: root,
    })
    if (cacheIssues.length) throw new Error(`cached package failed integrity verification: ${cacheIssues.join('; ')}`)
    return existing
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    // A package absent from this content address is built below.
  }
  for (const target of [masterTarget, claimsPath, assetsPath, provenancePath, captionsPath, coverPath, metadataPath, postPath, titlesPath]) {
    try {
      await lstat(target)
      throw new Error(`incomplete package target already exists at ${basename(target)}; refusing to overwrite unverified cache content`)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
  const publicCopy = [...copy.titles, copy.description, copy.post, copy.pinned || '', JSON.stringify(copy.metadata)].join('\n')
  const failedCopy = publicCopyChecks(publicCopy).filter((check) => check.status === 'fail')
  if (failedCopy.length) throw new Error(`public copy failed QA: ${failedCopy.map((check) => check.detail).join('; ')}`)

  await cp(masterPath, masterTarget, { force: true })
  await writeFile(captionsPath, captionsAsSrt(manifest), 'utf8')
  if (cover) await cp(cover.path, coverPath, { force: true })
  else await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '0.500', '-i', masterTarget, '-frames:v', '1', '-q:v', '2', coverPath], { timeoutMs: 120_000 })
  await writeFile(claimsPath, `${JSON.stringify(candidate.claims, null, 2)}\n`, 'utf8')
  await writeFile(assetsPath, `${JSON.stringify(v2Assets(manifest), null, 2)}\n`, 'utf8')
  await writeFile(metadataPath, `${JSON.stringify(copy.metadata, null, 2)}\n`, 'utf8')
  await writeFile(provenancePath, `${JSON.stringify({ job_id: jobId, candidate_id: candidate.candidate_id, packager_version: V2_PACKAGER_VERSION, source_master_path: sourceMasterPath, master_hash: masterHash, render_manifest_hash: renderManifestHash, render_manifest: manifest, qa, platform_metadata_path: metadataPath }, null, 2)}\n`, 'utf8')
  await writeFile(postPath, `${copy.post || copy.description}\n`, 'utf8')
  await writeFile(titlesPath, `${copy.titles.join('\n')}\n`, 'utf8')

  const generated = hasGeneratedMedia(manifest)
  const disclosure = manifest.schema_version === 2
    ? manifest.disclosures.find((item) => item.platform === platform)
    : undefined
  const draft = DraftPackageV2Schema.parse({
    schema_version: 2,
    package_id: `package-${platform}-${packageKey.slice(0, 16)}`,
    job_id: jobId,
    platform,
    render_manifest_hash: renderManifestHash,
    master_path: masterTarget,
    master_hash: masterHash,
    captions_path: captionsPath,
    captions_hash: await hashFile(captionsPath),
    cover_path: coverPath,
    cover_hash: await hashFile(coverPath),
    platform_metadata_path: metadataPath,
    platform_metadata_hash: await hashFile(metadataPath),
    titles_path: titlesPath,
    titles_hash: await hashFile(titlesPath),
    post_path: postPath,
    post_hash: await hashFile(postPath),
    titles: copy.titles,
    description: copy.description,
    post_copy: copy.post,
    ...(copy.pinned ? { pinned_comment: copy.pinned } : {}),
    claim_ledger_path: claimsPath,
    claim_ledger_hash: await hashFile(claimsPath),
    asset_ledger_path: assetsPath,
    asset_ledger_hash: await hashFile(assetsPath),
    provenance_path: provenancePath,
    provenance_hash: await hashFile(provenancePath),
    disclosure: disclosure || {
      platform,
      decision: generated ? 'pending' : 'not_required',
      rationale: generated
        ? 'Generated illustration is present. Krish must confirm the platform disclosure before publication.'
        : 'The package contains no generated visual asset according to the approved render manifest.',
    },
    delivery: platform === 'youtube_shorts'
      ? { mode: 'private_upload', privacy: 'private', public_publish_allowed: false }
      : { mode: 'local_package', privacy: 'not_applicable', public_publish_allowed: false },
    created_at: new Date().toISOString(),
  })
  await writeFile(packagePath, `${JSON.stringify(draft, null, 2)}\n`, 'utf8')
  return draft
}

export async function createDraftPackageSetV2(
  jobId: string,
  masterPath: string,
  candidate: CandidateV1,
  manifests: RenderManifestV1 | Partial<Record<VideoPlatformV1, RenderManifestV2>>,
  qa: unknown,
  platforms: readonly VideoPlatformV1[] = VIDEO_PACKAGE_PLATFORMS,
  approvedHashes?: Partial<Record<VideoPlatformV1, { render_manifest_hash?: string; master_path?: string; master_hash?: string }>>,
): Promise<Partial<Record<VideoPlatformV1, DraftPackageV2>>> {
  const unique = [...new Set(platforms)]
  const created: Array<readonly [VideoPlatformV1, DraftPackageV2]> = []
  for (const platform of unique) {
    const manifest = 'schema_version' in manifests ? manifests : manifests[platform]
    if (!manifest) throw new Error(`no render manifest is available for ${platform}`)
    created.push([platform, await createDraftPackageV2(jobId, platform, masterPath, candidate, manifest, qa, approvedHashes?.[platform])] as const)
  }
  return Object.fromEntries(created) as Partial<Record<VideoPlatformV1, DraftPackageV2>>
}

function platformCopy(candidate: CandidateV1, platform: 'youtube' | 'linkedin'): { titles: string[]; description: string; post: string; pinned?: string } {
  const series = PUBLIC_SERIES_NAMES[candidate.series]
  const titles = [candidate.hook, `${candidate.hook} | ${series}`, candidate.payoff].map((value) => value.replace(/\u2014/g, ':').trim()).filter(Boolean)
  if (platform === 'youtube') {
    return {
      titles,
      description: `${candidate.payoff}\n\n${series}. Evidence and source notes are retained in the production manifest.`,
      post: '',
      pinned: `The useful question is what this changes in practice. What would you test next?`,
    }
  }
  return {
    titles,
    description: candidate.payoff,
    post: `${candidate.hook}\n\n${candidate.payoff}\n\nThe mechanism matters more than the announcement.`,
  }
}

export async function createDraftPackage(
  jobId: string,
  platform: 'youtube' | 'linkedin',
  masterPath: string,
  candidate: CandidateV1,
  manifest: RenderManifestV1,
  qa: unknown,
): Promise<DraftPackageV1> {
  const root = join(jobPath(jobId), 'packages', platform)
  await mkdir(root, { recursive: true })
  const masterTarget = join(root, `master-${jobId}.mp4`)
  const claimsPath = join(root, 'claims.json')
  const assetsPath = join(root, 'assets.json')
  const provenancePath = join(root, 'provenance.json')
  const captionsPath = join(root, 'captions.srt')
  const coverPath = join(root, 'cover.jpg')
  const copy = platformCopy(candidate, platform)
  const publicCopy = [...copy.titles, copy.description, copy.post, copy.pinned || ''].join('\n')
  const failedCopy = publicCopyChecks(publicCopy).filter((check) => check.status === 'fail')
  if (failedCopy.length) throw new Error(`public copy failed QA: ${failedCopy.map((check) => check.detail).join('; ')}`)
  await cp(masterPath, masterTarget, { force: true })
  await writeFile(captionsPath, captionsAsSrt(manifest), 'utf8')
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', '0.500', '-i', masterTarget, '-frames:v', '1', '-q:v', '2', coverPath], { timeoutMs: 120_000 })
  await writeFile(claimsPath, `${JSON.stringify(candidate.claims, null, 2)}\n`, 'utf8')
  await writeFile(assetsPath, `${JSON.stringify(manifest.assets, null, 2)}\n`, 'utf8')
  await writeFile(provenancePath, `${JSON.stringify({ job_id: jobId, candidate_id: candidate.candidate_id, render_manifest: manifest, qa }, null, 2)}\n`, 'utf8')
  await writeFile(join(root, 'post.txt'), `${copy.post || copy.description}\n`, 'utf8')
  await writeFile(join(root, 'titles.txt'), `${copy.titles.join('\n')}\n`, 'utf8')
  const draft = DraftPackageV1Schema.parse({
    schema_version: SCHEMA_VERSION,
    job_id: jobId,
    platform,
    master_path: masterTarget,
    captions_path: captionsPath,
    cover_path: coverPath,
    titles: copy.titles,
    description: copy.description,
    post_copy: copy.post,
    ...(copy.pinned ? { pinned_comment: copy.pinned } : {}),
    claim_ledger_path: claimsPath,
    asset_ledger_path: assetsPath,
    provenance_path: provenancePath,
    created_at: new Date().toISOString(),
  })
  await writeFile(join(root, 'package.json'), `${JSON.stringify(draft, null, 2)}\n`, 'utf8')
  return draft
}

/** What the archive needs from one approved platform package. A
 *  DraftPackageV2 is one; a V1 package is mapped onto it. */
export interface ArchivePackageInput {
  platform: VideoPlatformV1
  master_path: string
  master_hash?: string | undefined
  titles: readonly string[]
  description: string
  post_copy: string
  pinned_comment?: string | undefined
  cover_path?: string | undefined
  captions_path?: string | undefined
}

/** Where an archive folder's subject came from: the approved title of the
 *  production brief bound to the job, or, for a job made without one, the
 *  approved package's first title. */
export type ArchiveSubjectSource = 'production_brief' | 'package_title'

export interface ArchiveJobInput {
  /** The piece's short title, as given. Never the job id. */
  subject: string
  subject_from: ArchiveSubjectSource
  /** The piece's publish date, YYYY-MM-DD, when known. Without it the
   *  folder carries the day it was archived, on Krish's clock. */
  publish_date?: string | undefined
  packages: readonly ArchivePackageInput[]
  package_artifact_hash?: string | undefined
  now?: Date | undefined
}

export interface ArchiveJobResult {
  archive_path: string
  folder: string
  subject: string
  date: string
  date_from: 'publish_date' | 'archive_day'
  post_to: ArchivePlace[]
  files: Array<{ file: string; post_to: ArchivePlace[]; platforms: VideoPlatformV1[]; sha256: string }>
}

/** The subject an archive folder is named by: the production brief's
 *  approved title when one is bound to the job, else the approved package's
 *  first title. With neither it refuses: a folder is never named by a job id. */
export async function archiveSubjectV2(job: JobManifestV2, packages: readonly { titles: readonly string[] }[]): Promise<{ subject: string; subject_from: ArchiveSubjectSource }> {
  const title = (await loadBoundProductionBriefV2(job))?.content.title
  if (title && archiveSafeText(title)) return { subject: title, subject_from: 'production_brief' }
  const first = packages.flatMap((item) => item.titles).find((item) => archiveSafeText(item))
  if (first) return { subject: first, subject_from: 'package_title' }
  throw new Error(`job ${job.job_id} has no subject to name its archive folder: no production brief is bound to it and its package has no title`)
}

const placeOrder = (place: ArchivePlace): number => ARCHIVE_PLACES.indexOf(place)
const platformOrder = (platform: VideoPlatformV1): number => placeOrder(ARCHIVE_PLACE_FOR_PLATFORM[platform])
const PLACE_IN_FULL: Readonly<Partial<Record<ArchivePlace, string>>> = Object.freeze({ Shorts: 'Shorts (YouTube Shorts)', Reels: 'Reels (Instagram Reels)' })
const inFull = (place: ArchivePlace): string => PLACE_IN_FULL[place] ?? place

/** Claims the first free folder name by creating it. Creating fails when the
 *  folder exists, so a second run, or two at once, can never write into an
 *  earlier folder: it moves on to " (2)", " (3)" and so on. */
async function claimArchiveFolder(root: string, input: ArchiveFolderInput): Promise<{ name: string; subject: string }> {
  const raced = new Set<string>()
  for (let attempt = 0; attempt <= ARCHIVE_COPY_MAX; attempt += 1) {
    const folder = nextArchiveFolder(input, [...await readdir(root), ...raced])
    try {
      await mkdir(join(root, folder.name))
      return folder
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      raced.add(folder.name)
    }
  }
  throw new Error(`the archive already has ${ARCHIVE_COPY_MAX} folders named for this piece`)
}

/** A package file as a path inside the archived job copy, or nothing when
 *  it lies outside the job folder. */
function pathInJobCopy(jobRoot: string, path: string | undefined): string | undefined {
  if (!path || !pathIsWithin(jobRoot, path)) return undefined
  return join('job', relative(resolve(jobRoot), resolve(path)))
}

function whereToPostText(input: {
  subject: string
  date: string
  dateFrom: ArchiveJobResult['date_from']
  postTo: readonly ArchivePlace[]
  files: ArchiveJobResult['files']
  packages: readonly ArchivePackageInput[]
  jobRoot: string
}): string {
  const lines = [
    input.subject,
    `Date: ${input.date} (${input.dateFrom === 'publish_date' ? 'the publish date' : 'the day it was archived, London time'})`,
    `Post to: ${input.postTo.join(', ')}`,
    '',
    'Nothing in this folder has been posted. Each video is posted by hand, with the words below.',
    '',
    'THE VIDEOS',
  ]
  for (const file of input.files) lines.push(`- ${file.file}`, `  Post to ${file.post_to.map(inFull).join(', ')}.`)
  const fileFor = new Map(input.files.flatMap((file) => file.platforms.map((platform) => [platform, file.file] as const)))
  for (const item of [...input.packages].sort((a, b) => platformOrder(a.platform) - platformOrder(b.platform))) {
    lines.push('', inFull(ARCHIVE_PLACE_FOR_PLATFORM[item.platform]).toUpperCase(), `Video: ${fileFor.get(item.platform) ?? ''}`)
    const [title, ...others] = item.titles
    if (title) lines.push(`Title: ${title}`)
    if (others.length) lines.push('Other titles:', ...others.map((other) => `- ${other}`))
    if (item.description.trim()) lines.push('Description:', item.description.trim())
    if (item.post_copy.trim()) lines.push('Post:', item.post_copy.trim())
    if (item.pinned_comment?.trim()) lines.push(`Pinned comment: ${item.pinned_comment.trim()}`)
    const cover = pathInJobCopy(input.jobRoot, item.cover_path)
    const captions = pathInJobCopy(input.jobRoot, item.captions_path)
    if (cover) lines.push(`Cover: ${cover}`)
    if (captions) lines.push(`Captions: ${captions}`)
  }
  return `${lines.join('\n')}\n`
}

/** Files an approved package in the archive: one folder named by the date,
 *  the subject and where to post it, holding each approved master under a
 *  name that says where it goes, a where-to-post.txt with the approved
 *  words for each platform, a job.txt naming the Studio job, and, in `job`,
 *  an exact copy of the job folder as the archive always held. It never
 *  writes into a folder that exists and never touches the job folder. */
export async function archiveJob(jobId: string, input: ArchiveJobInput): Promise<ArchiveJobResult> {
  const archiveRoot = studioPaths().archiveRoot
  if (!archiveRoot) throw new Error('MINDMAKE_ARCHIVE_ROOT is not configured')
  const jobRoot = jobPath(jobId)
  if (!(await lstat(jobRoot)).isDirectory()) throw new Error(`job ${jobId} has no job folder to archive`)
  if (!input.packages.length) throw new Error('there is no approved package to archive')
  const now = input.now ?? new Date()
  const date = input.publish_date ? assertArchiveDate(input.publish_date) : archiveLocalDate(now)
  const dateFrom = input.publish_date ? 'publish_date' as const : 'archive_day' as const

  // One file per exact master: platforms that share a master share its file.
  const groups = new Map<string, { master_path: string; platforms: VideoPlatformV1[] }>()
  for (const item of input.packages) {
    const sha256 = item.master_hash ?? await hashFile(item.master_path)
    const group = groups.get(sha256) ?? { master_path: item.master_path, platforms: [] }
    if (!group.platforms.includes(item.platform)) group.platforms.push(item.platform)
    groups.set(sha256, group)
  }
  const postTo = archivePlacesForPlatforms(input.packages.map((item) => item.platform))

  await mkdir(archiveRoot, { recursive: true })
  const folder = await claimArchiveFolder(archiveRoot, { date, subject: input.subject, places: postTo })
  const destination = join(archiveRoot, folder.name)
  const files: ArchiveJobResult['files'] = []
  const sorted = [...groups.entries()].sort(([, a], [, b]) => Math.min(...a.platforms.map(platformOrder)) - Math.min(...b.platforms.map(platformOrder)))
  for (const [sha256, group] of sorted) {
    const places = archivePlacesForPlatforms(group.platforms)
    const file = archiveFileName({ subject: folder.subject, shape: 'tall', places })
    const target = join(destination, file)
    await cp(group.master_path, target, { force: false, errorOnExist: true })
    if (await hashFile(target) !== sha256) throw new Error(`the archived copy of ${file} does not match the approved master`)
    const platforms = [...group.platforms].sort((a, b) => platformOrder(a) - platformOrder(b))
    files.push({ file, post_to: places, platforms, sha256 })
  }
  await cp(jobRoot, join(destination, 'job'), { recursive: true, force: false, errorOnExist: true })
  const subject = input.subject.replace(/\s+/g, ' ').trim()
  const subjectFrom = input.subject_from === 'production_brief'
    ? 'the approved title of the production brief bound to the job'
    : 'the approved package\'s first title, because no production brief is bound to the job'
  const jobText = [
    `Studio job: ${jobId}`,
    ...(input.package_artifact_hash ? [`Approved package: ${input.package_artifact_hash}`] : []),
    `Archived: ${now.toISOString()}`,
    `Subject: ${subject} (from ${subjectFrom})`,
    '',
    'The job folder beside this file is an exact copy of the Studio\'s job folder: its approvals, its history and every file the package was made from.',
  ].join('\n')
  await writeFile(join(destination, 'job.txt'), `${jobText}\n`, { encoding: 'utf8', flag: 'wx' })
  await writeFile(join(destination, 'where-to-post.txt'), whereToPostText({ subject, date, dateFrom, postTo, files, packages: input.packages, jobRoot }), { encoding: 'utf8', flag: 'wx' })
  return { archive_path: destination, folder: folder.name, subject: folder.subject, date, date_from: dateFrom, post_to: postTo, files }
}
