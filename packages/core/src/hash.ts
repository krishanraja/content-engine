import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, child]) => child !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, normalize(child)]),
    )
  }
  return value
}

export function stableJson(value: unknown): string {
  return JSON.stringify(normalize(value))
}

export function hashValue(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex')
}

export async function hashFile(path: string): Promise<string> {
  const hash = createHash('sha256')
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(path)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', resolve)
  })
  return hash.digest('hex')
}

export async function hashPath(path: string): Promise<string> {
  const info = await stat(path)
  if (info.isFile()) return hashFile(path)
  if (!info.isDirectory()) throw new Error(`cannot hash unsupported path: ${path}`)
  const files: string[] = []
  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const child = join(directory, entry.name)
      if (entry.isDirectory()) await walk(child)
      else if (entry.isFile()) files.push(child)
    }
  }
  await walk(path)
  const entries = []
  for (const file of files) entries.push({ path: relative(path, file).replaceAll('\\', '/'), hash: await hashFile(file) })
  return hashValue(entries)
}
