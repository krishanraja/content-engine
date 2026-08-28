import { access } from 'node:fs/promises'
import { join } from 'node:path'
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
  checks.push({
    name: 'radar_credentials',
    status: process.platform === 'win32' ? 'pass' : 'warn',
    detail: process.platform === 'win32' ? 'Windows Credential Manager supported.' : 'Live provider credentials require Windows Credential Manager.',
  })
  return { ok: checks.every((check) => check.status !== 'block'), checks }
}
