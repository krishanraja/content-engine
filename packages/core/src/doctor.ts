import { access, readFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { TreatmentRegistryV1Schema } from '@mindmake/contracts'
import { APPROVAL_SIGNING_CREDENTIAL, RUNNER_RECEIPT_SIGNING_CREDENTIAL, approvalSigningCredentialReady, runnerReceiptSigningCredentialReady } from './approval-signing.js'
import { CONTROL_CENTER_RUNNER_CREDENTIAL } from './control-plane-client.js'
import { readWindowsCredential, windowsCredentialExists } from './credentials.js'
import { commandVersion } from './process.js'
import { studioPaths } from './paths.js'
import { resolvePythonCommand } from './python-runtime.js'
import { KRISH_IDENTITY_CREDENTIAL, krishIdentityStatus } from './identity.js'

export interface DoctorCheck { name: string; status: 'pass' | 'warn' | 'block'; detail: string }

export function credentialHasMinimumBytes(value: string, minimumBytes = 32): boolean {
  return Buffer.byteLength(value, 'utf8') >= minimumBytes
}

function configuredFoldersOverlap(left: string, right: string): boolean {
  const canonicalLeft = resolve(left).toLocaleLowerCase('en-GB')
  const canonicalRight = resolve(right).toLocaleLowerCase('en-GB')
  return canonicalLeft === canonicalRight
    || canonicalLeft.startsWith(`${canonicalRight}${sep}`)
    || canonicalRight.startsWith(`${canonicalLeft}${sep}`)
}

export async function remotionLicenceEligible(repoRoot?: string): Promise<boolean> {
  if (/^(true|licensed|eligible)$/i.test(process.env.MINDMAKE_REMOTION_LICENSE_CONFIRMED || '')) return true
  if (!repoRoot) return false
  try {
    const config = JSON.parse(await readFile(join(repoRoot, 'config', 'studio.json'), 'utf8')) as {
      licensing?: { remotion?: { eligible?: boolean; basis?: string; confirmed_by?: string } }
    }
    const record = config.licensing?.remotion
    return record?.eligible === true && Boolean(record.basis && record.confirmed_by)
  } catch {
    return false
  }
}

export async function runDoctor(repoRoot?: string): Promise<{ ok: boolean; checks: DoctorCheck[] }> {
  const paths = studioPaths()
  const pythonCommand = repoRoot ? await resolvePythonCommand(repoRoot) : process.env.MINDMAKE_PYTHON || 'python'
  const npmVersion = process.env.npm_execpath
    ? commandVersion(process.execPath, [process.env.npm_execpath, '--version'])
    : commandVersion(process.platform === 'win32' ? 'cmd.exe' : 'npm', process.platform === 'win32' ? ['/d', '/s', '/c', 'npm --version'] : ['--version'])
  const versions = await Promise.all([
    commandVersion('node', ['--version']),
    npmVersion,
    commandVersion('git', ['--version']),
    commandVersion('ffmpeg', ['-version']),
    commandVersion('ffprobe', ['-version']),
    commandVersion(pythonCommand, ['--version']),
    commandVersion(pythonCommand, ['-c', "import faster_whisper, mediapipe, scenedetect; print('available')"], 60_000),
  ])
  const names = ['node', 'npm', 'git', 'ffmpeg', 'ffprobe', 'python', 'python_media_runtime']
  const checks: DoctorCheck[] = names.map((name, index) => ({
    name,
    status: versions[index] === 'missing' ? 'block' : 'pass',
    detail: versions[index] || (name === 'python_media_runtime' ? 'missing; run npm run bootstrap:python once to create the shared runtime' : 'missing'),
  }))
  const remotionEligible = await remotionLicenceEligible(repoRoot)
  checks.push({
    name: 'remotion_license',
    status: remotionEligible ? 'pass' : 'block',
    detail: remotionEligible ? 'Eligibility is explicitly recorded.' : 'Confirm eligibility or purchase a licence, then record that approval.',
  })
  checks.push({ name: 'runtime_root', status: 'pass', detail: paths.runtimeRoot })
  if (repoRoot) {
    try {
      const config = TreatmentRegistryV1Schema.parse(JSON.parse(await readFile(join(repoRoot, 'config', 'studio.json'), 'utf8')))
      const activeTheme = config.default_brand_theme ? config.brand_themes.find((theme) => theme.theme_id === config.default_brand_theme && theme.status === 'active') : undefined
      if (config.default_brand_theme && !activeTheme) throw new Error(`default brand theme ${config.default_brand_theme} is missing or inactive`)
      checks.push({ name: 'treatment_registry', status: 'pass', detail: `${config.approved_treatments.length} approved treatment; ${config.active_preferences.length} active preferences; theme ${activeTheme?.theme_id || 'none'}.` })
    } catch (error) {
      checks.push({ name: 'treatment_registry', status: 'block', detail: error instanceof Error ? error.message : 'invalid treatment registry' })
    }
  }
  if (!paths.mediaInbox) checks.push({ name: 'media_inbox', status: 'warn', detail: 'MINDMAKE_MEDIA_INBOX is not configured.' })
  else {
    try { await access(paths.mediaInbox); checks.push({ name: 'media_inbox', status: 'pass', detail: paths.mediaInbox }) }
    catch { checks.push({ name: 'media_inbox', status: 'warn', detail: `${paths.mediaInbox} is not currently reachable.` }) }
  }
  if (!paths.archiveRoot) checks.push({ name: 'archive_root', status: 'warn', detail: 'MINDMAKE_ARCHIVE_ROOT is not configured.' })
  else {
    try { await access(paths.archiveRoot); checks.push({ name: 'archive_root', status: 'pass', detail: paths.archiveRoot }) }
    catch { checks.push({ name: 'archive_root', status: 'warn', detail: `${paths.archiveRoot} is not currently reachable.` }) }
  }
  if (paths.mediaInbox && paths.archiveRoot) {
    checks.push({
      name: 'inbox_archive_boundary',
      status: configuredFoldersOverlap(paths.mediaInbox, paths.archiveRoot) ? 'block' : 'pass',
      detail: configuredFoldersOverlap(paths.mediaInbox, paths.archiveRoot)
        ? 'Inbox and Archive must be separate, non-overlapping folders.'
        : 'Inbox and Archive use separate configured folders.',
    })
  }
  if (process.platform === 'win32' && repoRoot) {
    const radarTargets = ['MindmakeVideoStudio/mm-ctrl-radar-token', 'MindmakeVideoStudio/control-center-radar-token-v2'] as const
    const [mmTarget, controlTarget] = radarTargets
    const [mmRadar, controlRadar, youtube, approvalSigning, runnerBearer, runnerSigning, identityKey, identityProfile] = await Promise.all([
      windowsCredentialExists(repoRoot, mmTarget),
      windowsCredentialExists(repoRoot, controlTarget),
      windowsCredentialExists(repoRoot, 'MindmakeVideoStudio/youtube-access-token'),
      approvalSigningCredentialReady(repoRoot),
      readWindowsCredential(repoRoot, CONTROL_CENTER_RUNNER_CREDENTIAL).then((value) => credentialHasMinimumBytes(value)).catch(() => false),
      runnerReceiptSigningCredentialReady(repoRoot),
      windowsCredentialExists(repoRoot, KRISH_IDENTITY_CREDENTIAL),
      krishIdentityStatus(),
    ])
    const missingRadar = radarTargets.filter((_, index) => ![mmRadar, controlRadar][index])
    checks.push({
      name: 'radar_credentials',
      status: missingRadar.length === 0 ? 'pass' : 'warn',
      detail: missingRadar.length === 0 ? 'Both provider credentials are present.' : `Missing: ${missingRadar.join(', ')}`,
    })
    checks.push({
      name: 'youtube_credential',
      status: youtube ? 'pass' : 'warn',
      detail: youtube ? 'Private-upload credential is present.' : 'MindmakeVideoStudio/youtube-access-token is missing.',
    })
    checks.push({
      name: 'approval_signing_credential',
      status: approvalSigning ? 'pass' : 'block',
      detail: approvalSigning ? 'Approval receipts can be authenticated.' : `${APPROVAL_SIGNING_CREDENTIAL} is missing or shorter than 32 bytes; approval recording is disabled.`,
    })
    checks.push({
      name: 'control_plane_runner_credentials',
      status: runnerBearer && runnerSigning ? 'pass' : 'block',
      detail: runnerBearer && runnerSigning
        ? 'Dedicated bearer and receipt-signing credentials are present.'
        : `Missing or invalid: ${[!runnerBearer ? CONTROL_CENTER_RUNNER_CREDENTIAL : '', !runnerSigning ? RUNNER_RECEIPT_SIGNING_CREDENTIAL : ''].filter(Boolean).join(', ')}.`,
    })
    checks.push({
      name: 'krish_identity',
      status: identityKey && identityProfile.enrolled ? 'pass' : 'warn',
      detail: identityKey && identityProfile.enrolled
        ? `Encrypted ${identityProfile.profile_id} profile is available.`
        : `Optional Krish recognition is unavailable. ${identityKey ? 'Enroll the local profile.' : `Store ${KRISH_IDENTITY_CREDENTIAL}, then enroll the local profile.`} Subject tracking will remain job-local.`,
    })
  } else {
    checks.push({ name: 'radar_credentials', status: 'warn', detail: 'Live provider credentials require Windows Credential Manager.' })
    checks.push({ name: 'youtube_credential', status: 'warn', detail: 'Private YouTube upload requires Windows Credential Manager.' })
    checks.push({ name: 'approval_signing_credential', status: 'block', detail: 'Authenticated approval recording requires the Windows runner credential.' })
    checks.push({ name: 'control_plane_runner_credentials', status: 'block', detail: 'The independent control-plane runner requires two dedicated Windows Credential Manager entries.' })
    checks.push({ name: 'krish_identity', status: 'warn', detail: 'Persistent Krish recognition requires the encrypted Windows runner profile; subject tracking will remain job-local.' })
  }
  return { ok: checks.every((check) => check.status !== 'block'), checks }
}
