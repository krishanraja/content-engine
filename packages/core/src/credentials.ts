import { join } from 'node:path'
import { run } from './process.js'

export async function readWindowsCredential(repoRoot: string, target: string): Promise<string> {
  if (process.platform !== 'win32') throw new Error('Windows Credential Manager is only available on Windows')
  const { stdout } = await run('powershell', ['-NoProfile', '-NonInteractive', '-File', join(repoRoot, 'scripts', 'get-credential.ps1'), '-Target', target], { timeoutMs: 15_000 })
  const secret = stdout.trim()
  if (!secret) throw new Error(`credential ${target} is empty`)
  return secret
}
