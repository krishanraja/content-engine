import { access } from 'node:fs/promises'
import { join } from 'node:path'
import { studioPaths } from './paths.js'

export async function resolvePythonCommand(repoRoot: string): Promise<string> {
  if (process.env.MINDMAKE_PYTHON) return process.env.MINDMAKE_PYTHON
  if (process.platform !== 'win32') return 'python'
  const candidates = [
    join(studioPaths().runtimeRoot, 'python', 'Scripts', 'python.exe'),
    join(repoRoot, '.venv', 'Scripts', 'python.exe'),
  ]
  for (const candidate of candidates) {
    try { await access(candidate); return candidate } catch { /* Try the next safe location. */ }
  }
  return 'python'
}
