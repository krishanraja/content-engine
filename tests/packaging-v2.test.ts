import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { CandidateV1Schema, DraftPackageV2Schema } from '@mindmake/contracts'
import { VIDEO_PACKAGE_PLATFORMS, draftPackageFileIssuesV2, hashFile, platformCopyV2 } from '@mindmake/core'

const candidate = CandidateV1Schema.parse({
  schema_version: 1,
  candidate_id: 'candidate-platform-copy',
  job_id: 'job-platform-copy',
  series: 'money_of_ai',
  mode: 'solo',
  transcript: 'The proof matters before the announcement.',
  hook: 'The announcement is not the story \u2014 the mechanism is',
  payoff: 'Look for the operating change before you believe the headline.',
  scores: {
    truth: 0.9,
    evidence: 0.9,
    clarity: 0.9,
    tension: 0.8,
    payoff: 0.8,
    visual_proof: 0.9,
    qualified_fit: 0.9,
    novelty: 0.8,
  },
  claims: [],
  challenge: {
    strongest_objection: 'The opening may sound abstract without the named mechanism.',
    safer_version: 'Name the mechanism in the first line.',
    stretch_version: 'Show the mechanism before naming the announcement.',
    recommendation: 'Lead with the proof.',
    hard_blocks: [],
    soft_blocks: [],
  },
  source_refs: [],
})

describe('four-platform V2 packages', () => {
  const temporaryRoots: string[] = []
  let previousRuntimeRoot: string | undefined

  afterEach(async () => {
    if (previousRuntimeRoot === undefined) delete process.env.MINDMAKE_RUNTIME_ROOT
    else process.env.MINDMAKE_RUNTIME_ROOT = previousRuntimeRoot
    await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
  })

  it('defines every approved local delivery target', () => {
    expect(VIDEO_PACKAGE_PLATFORMS).toEqual(['youtube_shorts', 'linkedin', 'tiktok', 'instagram_reels'])
  })

  it('adapts copy and delivery metadata for each platform without public em dashes', () => {
    const packages = Object.fromEntries(VIDEO_PACKAGE_PLATFORMS.map((platform) => [platform, platformCopyV2(candidate, platform)]))
    expect(packages.youtube_shorts!.metadata.delivery.destination).toBe('youtube_private')
    expect(packages.linkedin!.metadata.delivery.destination).toBe('local_draft')
    expect(packages.tiktok!.metadata.audio.manual_rights_check_required).toBe(true)
    expect(packages.instagram_reels!.metadata.copy.opening_strategy).toContain('cover headline')
    expect(packages.linkedin!.post).not.toBe(packages.tiktok!.post)
    expect(JSON.stringify(packages)).not.toContain('\u2014')
    expect(Object.values(packages).every((item) => item.metadata.delivery.public_publish_action === 'human_only')).toBe(true)
  })

  it('binds every reviewable package file and detects a post-package edit', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'mindmake-package-files-'))
    temporaryRoots.push(temporaryRoot)
    previousRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = join(temporaryRoot, 'runtime')
    const packageKey = 'd'.repeat(64)
    const root = join(process.env.MINDMAKE_RUNTIME_ROOT, 'jobs', 'job-package-files', 'packages', 'v2', 'linkedin', packageKey)
    await mkdir(root, { recursive: true })
    const names = ['captions.srt', 'cover.jpg', 'platform-metadata.json', 'titles.txt', 'post.txt', 'claims.json', 'assets.json', 'provenance.json'] as const
    const paths = Object.fromEntries(names.map((name) => [name, join(root, name)])) as Record<typeof names[number], string>
    await Promise.all(names.map((name) => writeFile(paths[name], `exact ${name}\n`, 'utf8')))
    const stagedMaster = join(root, 'staged-master.mp4')
    await writeFile(stagedMaster, 'exact master.mp4\n', 'utf8')
    const masterHash = await hashFile(stagedMaster)
    const masterPath = join(root, `master-${masterHash.slice(0, 16)}.mp4`)
    await rename(stagedMaster, masterPath)
    const hashes = Object.fromEntries(await Promise.all(names.map(async (name) => [name, await hashFile(paths[name])])) ) as Record<typeof names[number], string>
    const draft = DraftPackageV2Schema.parse({
      schema_version: 2, package_id: `package-linkedin-${packageKey.slice(0, 16)}`, job_id: 'job-package-files', platform: 'linkedin', render_manifest_hash: hashes['provenance.json'],
      master_path: masterPath, master_hash: masterHash, captions_path: paths['captions.srt'], captions_hash: hashes['captions.srt'], cover_path: paths['cover.jpg'], cover_hash: hashes['cover.jpg'],
      platform_metadata_path: paths['platform-metadata.json'], platform_metadata_hash: hashes['platform-metadata.json'], titles_path: paths['titles.txt'], titles_hash: hashes['titles.txt'], post_path: paths['post.txt'], post_hash: hashes['post.txt'],
      titles: ['Exact title'], description: 'Exact description', post_copy: 'Exact post copy', claim_ledger_path: paths['claims.json'], claim_ledger_hash: hashes['claims.json'], asset_ledger_path: paths['assets.json'], asset_ledger_hash: hashes['assets.json'], provenance_path: paths['provenance.json'], provenance_hash: hashes['provenance.json'],
      disclosure: { platform: 'linkedin', decision: 'not_required', rationale: 'No altered or synthetic content is used.' }, delivery: { mode: 'local_package', privacy: 'not_applicable', public_publish_allowed: false }, created_at: '2026-09-04T10:00:00.000Z',
    })
    expect(await draftPackageFileIssuesV2(draft, { job_id: draft.job_id, platform: draft.platform, render_manifest_hash: draft.render_manifest_hash, master_hash: draft.master_hash, package_root: root })).toEqual([])
    await writeFile(paths['post.txt'], 'silently changed after package review\n', 'utf8')
    expect(await draftPackageFileIssuesV2(draft)).toContain('post copy file changed after package creation')
  })

  it('rejects cached package metadata forged across jobs, platforms, masters, manifests, and paths', async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'mindmake-package-binding-'))
    temporaryRoots.push(temporaryRoot)
    previousRuntimeRoot = process.env.MINDMAKE_RUNTIME_ROOT
    process.env.MINDMAKE_RUNTIME_ROOT = join(temporaryRoot, 'runtime')
    const packageKey = 'e'.repeat(64)
    const root = join(process.env.MINDMAKE_RUNTIME_ROOT, 'jobs', 'job-package-cache', 'packages', 'v2', 'linkedin', packageKey)
    await mkdir(root, { recursive: true })
    const manifestHash = '2'.repeat(64)
    const fileNames = ['captions.srt', 'cover.jpg', 'platform-metadata.json', 'titles.txt', 'post.txt', 'claims.json', 'assets.json', 'provenance.json'] as const
    const stagedMasterPath = join(root, 'staged-master.mp4')
    await writeFile(stagedMasterPath, 'approved master\n', 'utf8')
    const masterHash = await hashFile(stagedMasterPath)
    const masterPath = join(root, `master-${masterHash.slice(0, 16)}.mp4`)
    await rename(stagedMasterPath, masterPath)
    await Promise.all(fileNames.map((name) => writeFile(join(root, name), `${name}\n`, 'utf8')))
    const h = async (name: typeof fileNames[number]) => hashFile(join(root, name))
    const draft = DraftPackageV2Schema.parse({
      schema_version: 2, package_id: `package-linkedin-${packageKey.slice(0, 16)}`, job_id: 'job-package-cache', platform: 'linkedin', render_manifest_hash: manifestHash,
      master_path: masterPath, master_hash: await hashFile(masterPath), captions_path: join(root, 'captions.srt'), captions_hash: await h('captions.srt'), cover_path: join(root, 'cover.jpg'), cover_hash: await h('cover.jpg'),
      platform_metadata_path: join(root, 'platform-metadata.json'), platform_metadata_hash: await h('platform-metadata.json'), titles_path: join(root, 'titles.txt'), titles_hash: await h('titles.txt'), post_path: join(root, 'post.txt'), post_hash: await h('post.txt'),
      titles: ['Exact title'], description: 'Exact description', post_copy: 'Exact post', claim_ledger_path: join(root, 'claims.json'), claim_ledger_hash: await h('claims.json'), asset_ledger_path: join(root, 'assets.json'), asset_ledger_hash: await h('assets.json'), provenance_path: join(root, 'provenance.json'), provenance_hash: await h('provenance.json'),
      disclosure: { platform: 'linkedin', decision: 'not_required', rationale: 'No altered or synthetic content is used.' }, delivery: { mode: 'local_package', privacy: 'not_applicable', public_publish_allowed: false }, created_at: '2026-09-04T10:00:00.000Z',
    })
    const expected = { job_id: draft.job_id, platform: draft.platform, render_manifest_hash: manifestHash, master_hash: draft.master_hash, package_root: root } as const
    expect(await draftPackageFileIssuesV2(draft, expected)).toEqual([])
    expect(await draftPackageFileIssuesV2({ ...draft, job_id: 'forged-job' }, expected)).toContain('package job binding does not match the current job')
    expect(await draftPackageFileIssuesV2({ ...draft, platform: 'tiktok', disclosure: { ...draft.disclosure, platform: 'tiktok' } }, expected)).toContain('package platform binding does not match the target platform')
    expect(await draftPackageFileIssuesV2({ ...draft, render_manifest_hash: '3'.repeat(64) }, expected)).toContain('package render manifest binding is stale or forged')
    expect(await draftPackageFileIssuesV2({ ...draft, master_hash: '4'.repeat(64) }, expected)).toContain('package master binding is stale or forged')
    const outsidePath = join(temporaryRoot, 'outside-captions.srt')
    await writeFile(outsidePath, 'captions.srt\n', 'utf8')
    expect(await draftPackageFileIssuesV2({ ...draft, captions_path: outsidePath }, expected)).toContain('captions path is outside the current job package')
  })
})
