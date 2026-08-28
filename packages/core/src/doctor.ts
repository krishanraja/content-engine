import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { windowsCredentialExists } from './credentials.js'
import { commandVersion } from './process.js'
import { studioPaths } from './paths.js'

export interface DoctorCheck { name: string; status: 'pass' | 'warn' | 'block'; detail: string }

export async function runDoctor(repoRoot?: string): Promise<{ ok: boolean; checks: DoctorCheck[] }> {
  const paths = studioPaths()
  let pythonCommand = process.env.MINDMAKE_PYTHON || 'python'
  if (!process.env.MINDMAKE_PYTHON && repoRoot && process.platform === 'win32') {
    const localPython = join(repoRoot, '.venv', 'Scripts', 'python.exe')
    try { await access(localPython); pythonCommand = localPython } catch { /* Global Python remains a setup fallback. */ }
  }
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
  const checks: DoctorCheck[] = names.map((name, index) => ({ name, status: versions[index] === 'missing' ? 'block' : 'pass', detail: versions[index] || 'missing' }))
  checks.push({
    name: 'remotion_license',
    status: /^(true|licensed|eligible)$/i.test(process.env.MINDMAKE_REMOTION_LICENSE_CONFIRMED || '') ? 'pass' : 'block',
    detail: 'Set MINDMAKE_REMOTION_LICENSE_CONFIRMED=true only after confirming eligibility or purchasing a licence.',
  })
  checks.push({ name: 'runtime_root', status: 'pass', detail: paths.runtimeRoot })
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
