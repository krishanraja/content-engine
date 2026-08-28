import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export interface StudioPaths {
  runtimeRoot: string
  jobsRoot: string
  cacheRoot: string
  indexPath: string
  archiveRoot: string | null
}

export function studioPaths(): StudioPaths {
  const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
  const runtimeRoot = resolve(process.env.MINDMAKE_RUNTIME_ROOT || join(localAppData, 'MindmakeVideoStudio'))
  const archive = process.env.MINDMAKE_ARCHIVE_ROOT?.trim()
  return {
    runtimeRoot,
    jobsRoot: join(runtimeRoot, 'jobs'),
    cacheRoot: join(runtimeRoot, 'cache'),
    indexPath: join(runtimeRoot, 'studio.sqlite'),
    archiveRoot: archive ? resolve(archive) : null,
  }
}

export function jobPath(jobId: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{5,80}$/i.test(jobId)) throw new Error('invalid job id')
  return join(studioPaths().jobsRoot, jobId)
}
