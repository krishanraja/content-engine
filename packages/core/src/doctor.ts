import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { windowsCredentialExists } from './credentials.js'
import { commandVersion } from './process.js'
import { studioPaths } from './paths.js'
import { resolvePythonCommand } from './python-runtime.js'

export interface DoctorCheck { name: string; status: 'pass' | 'warn' | 'block'; detail: string }

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
    commandVersion(pythonCommand, ['-c', "import faster_whisper, mediapipe, scenedetect; print('available')"]),
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
  if (process.platform === 'win32' && repoRoot) {
    const radarTargets = ['MindmakeVideoStudio/mm-ctrl-radar-token', 'MindmakeVideoStudio/control-center-radar-token'] as const
    const [mmTarget, controlTarget] = radarTargets
    const [mmRadar, controlRadar, youtube] = await Promise.all([
      windowsCredentialExists(repoRoot, mmTarget),
      windowsCredentialExists(repoRoot, controlTarget),
      windowsCredentialExists(repoRoot, 'MindmakeVideoStudio/youtube-access-token'),
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
  } else {
    checks.push({ name: 'radar_credentials', status: 'warn', detail: 'Live provider credentials require Windows Credential Manager.' })
    checks.push({ name: 'youtube_credential', status: 'warn', detail: 'Private YouTube upload requires Windows Credential Manager.' })
  }
  return { ok: checks.every((check) => check.status !== 'block'), checks }
}
