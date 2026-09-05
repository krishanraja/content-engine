import { randomUUID } from 'node:crypto'
import { lstat, mkdir, open, readdir, rename, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { studioPaths } from './paths.js'

const STAGED_AUTHORITY_FILE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.tmp$/

export function runnerAuthorityStagingRoot(runtimeRoot = studioPaths().runtimeRoot): string {
  return join(runtimeRoot, 'runner-staging')
}

export async function ensureRunnerAuthorityStagingRoot(runtimeRoot?: string): Promise<void> {
  const root = runnerAuthorityStagingRoot(runtimeRoot)
  await mkdir(root, { recursive: true })
  const info = await lstat(root)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('runner authority staging root has an invalid type')
}

export async function clearRunnerAuthorityStaging(runtimeRoot?: string): Promise<void> {
  const root = runnerAuthorityStagingRoot(runtimeRoot)
  const info = await lstat(root)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('runner authority staging root has an invalid type')
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink() || !STAGED_AUTHORITY_FILE.test(entry.name)) throw new Error('runner authority staging root contains an unexpected entry')
  }
  for (const entry of entries) await unlink(join(root, entry.name))
}

export async function writeRunnerAuthorityJsonAtomic(path: string, value: unknown, runtimeRoot?: string): Promise<void> {
  await ensureRunnerAuthorityStagingRoot(runtimeRoot)
  await mkdir(dirname(path), { recursive: true })
  const temporary = join(runnerAuthorityStagingRoot(runtimeRoot), `${randomUUID()}.tmp`)
  const handle = await open(temporary, 'wx', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`, 'utf8')
    await handle.sync()
  } catch (error) {
    try { await handle.close() } catch { /* The write failure is authoritative. */ }
    try { await unlink(temporary) } catch { /* A remaining exact staging file is safely retired on restart. */ }
    throw error
  }
  await handle.close()
  await rename(temporary, path)
}
