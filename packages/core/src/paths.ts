import { homedir } from 'node:os'
import { join, resolve } from 'node:path'

export interface StudioPaths {
  runtimeRoot: string
  jobsRoot: string
  cacheRoot: string
  indexPath: string
  mediaInbox: string | null
  archiveRoot: string | null
}

const WINDOWS_MEDIA_BASE = 'G:\\My Drive\\Ventures\\Active\\Mindmaker\\04_Content\\Video Engine'

export function studioPaths(): StudioPaths {
  const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
  const runtimeRoot = resolve(process.env.MINDMAKE_RUNTIME_ROOT || join(localAppData, 'MindmakeVideoStudio'))
  const mediaInbox = process.env.MINDMAKE_MEDIA_INBOX?.trim() || (process.platform === 'win32' ? WINDOWS_MEDIA_BASE : '')
  const archive = process.env.MINDMAKE_ARCHIVE_ROOT?.trim() || (mediaInbox ? join(mediaInbox, 'Archive') : '')
  return {
    runtimeRoot,
    jobsRoot: join(runtimeRoot, 'jobs'),
    cacheRoot: join(runtimeRoot, 'cache'),
    indexPath: join(runtimeRoot, 'studio.sqlite'),
    mediaInbox: mediaInbox ? resolve(mediaInbox) : null,
    archiveRoot: archive ? resolve(archive) : null,
  }
}

export function jobPath(jobId: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{5,80}$/i.test(jobId)) throw new Error('invalid job id')
  return join(studioPaths().jobsRoot, jobId)
}
