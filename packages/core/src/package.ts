import { cp, mkdir, writeFile } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { DraftPackageV1Schema, PUBLIC_SERIES_NAMES, SCHEMA_VERSION, type CandidateV1, type DraftPackageV1, type RenderManifestV1 } from '@mindmake/contracts'
import { jobPath, studioPaths } from './paths.js'
import { run } from './process.js'
import { publicCopyChecks } from './qa.js'

function srtTimestamp(milliseconds: number): string {
  const hours = Math.floor(milliseconds / 3_600_000)
  const minutes = Math.floor(milliseconds % 3_600_000 / 60_000)
  const seconds = Math.floor(milliseconds % 60_000 / 1000)
  const millis = Math.floor(milliseconds % 1000)
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, '0')).join(':') + `,${String(millis).padStart(3, '0')}`
}

function captionsAsSrt(manifest: RenderManifestV1): string {
  return manifest.captions.map((cue, index) => `${index + 1}\n${srtTimestamp(cue.start_ms)} --> ${srtTimestamp(cue.end_ms)}\n${cue.text}\n`).join('\n')
}

function platformCopy(candidate: CandidateV1, platform: 'youtube' | 'linkedin'): { titles: string[]; description: string; post: string; pinned?: string } {
  const series = PUBLIC_SERIES_NAMES[candidate.series]
  const titles = [candidate.hook, `${candidate.hook} | ${series}`, candidate.payoff].map((value) => value.replace(/—/g, ':').trim()).filter(Boolean)
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

export async function archiveJob(jobId: string): Promise<string> {
  const archiveRoot = studioPaths().archiveRoot
  if (!archiveRoot) throw new Error('MINDMAKE_ARCHIVE_ROOT is not configured')
  const destination = join(archiveRoot, jobId)
  await mkdir(archiveRoot, { recursive: true })
  await cp(jobPath(jobId), destination, { recursive: true, force: false, errorOnExist: true })
  return destination
}
