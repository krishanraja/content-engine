import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export interface StudioPaths {
  runtimeRoot: string
  jobsRoot: string
  cacheRoot: string
  indexPath: string
  driveRoot: string | null
  mediaInbox: string | null
  archiveRoot: string | null
  /** The MINDMAKE_* settings that named a folder that is not there while the
   *  default is, so the default was used. doctor reports them. */
  staleSettings: string[]
}

export const DEFAULT_WINDOWS_DRIVE_ROOT = 'H:\\My Drive\\Ventures\\Active Ventures\\makeyourmindup\\Video Engine'
const INVALID_WINDOWS_DRIVE_ROOT = 'G:\\My Drive\\Ventures\\Active\\Mindmaker\\04\\_Content\\Video Engine'

export function canonicalWindowsDrivePath(value: string | undefined, fallback: string): string {
  const configured = value?.trim()
  if (!configured) return fallback
  const lower = configured.toLowerCase()
  const invalid = INVALID_WINDOWS_DRIVE_ROOT.toLowerCase()
  if (lower === invalid || lower.startsWith(`${invalid}\\`)) return fallback
  return configured
}

/** A configured path, unless it is not there and the fallback is: then the
 *  fallback, and the setting is stale. Krish renamed `Active` to `Active
 *  Ventures` in October 2026; settings on both home computers kept the old
 *  path and were obeyed for two days. A setting that names a real folder is
 *  still obeyed, and so is one whose fallback is missing too (Google Drive not
 *  started yet), so nothing here guesses. */
export function resolveWindowsDrivePath(
  value: string | undefined,
  fallback: string,
  exists: (path: string) => boolean = existsSync,
): { path: string; stale: boolean } {
  const configured = canonicalWindowsDrivePath(value, fallback)
  if (configured === fallback || exists(configured) || !exists(fallback)) return { path: configured, stale: false }
  return { path: fallback, stale: true }
}

export function studioPaths(): StudioPaths {
  const localAppData = process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local')
  const defaultRuntimeRoot = process.platform === 'win32'
    ? join(homedir(), 'Documents', 'MindmakeVideoStudio', 'runtime')
    : join(localAppData, 'MindmakeVideoStudio')
  const runtimeRoot = resolve(process.env.MINDMAKE_RUNTIME_ROOT || defaultRuntimeRoot)
  const staleSettings: string[] = []
  const windows = (name: string, fallback: string) => {
    const resolved = resolveWindowsDrivePath(process.env[name], fallback)
    if (resolved.stale) staleSettings.push(name)
    return resolved.path
  }
  const driveRoot = process.platform === 'win32'
    ? windows('MINDMAKE_DRIVE_ROOT', DEFAULT_WINDOWS_DRIVE_ROOT)
    : process.env.MINDMAKE_DRIVE_ROOT?.trim() || ''
  const mediaInbox = process.platform === 'win32'
    ? windows('MINDMAKE_MEDIA_INBOX', join(driveRoot, 'Inbox'))
    : process.env.MINDMAKE_MEDIA_INBOX?.trim() || ''
  const archive = process.platform === 'win32'
    ? windows('MINDMAKE_ARCHIVE_ROOT', join(driveRoot, 'Archive'))
    : process.env.MINDMAKE_ARCHIVE_ROOT?.trim() || (driveRoot ? join(driveRoot, 'Archive') : '')
  return {
    runtimeRoot,
    jobsRoot: join(runtimeRoot, 'jobs'),
    cacheRoot: join(runtimeRoot, 'cache'),
    indexPath: join(runtimeRoot, 'studio.sqlite'),
    driveRoot: driveRoot ? resolve(driveRoot) : null,
    mediaInbox: mediaInbox ? resolve(mediaInbox) : null,
    archiveRoot: archive ? resolve(archive) : null,
    staleSettings,
  }
}

export function jobPath(jobId: string): string {
  if (!/^[a-z0-9][a-z0-9_-]{5,80}$/i.test(jobId)) throw new Error('invalid job id')
  return join(studioPaths().jobsRoot, jobId)
}

// One local layout (W2.11): config/studio.json local_roots names where the repositories, their worktrees and the
// engine's runtime live on a home computer, with %NAME% for the computer's environment variables and {repo} and
// {branch} filled in here. Every reader takes them from config; npm run check:local-paths refuses a hard-coded path.
export interface LocalRoots { repos: string; worktrees: string; runtime: string; engineRuntime: string[] }

const STUDIO_CONFIG = resolve(dirname(fileURLToPath(import.meta.url)), '../../..', 'config', 'studio.json')
const SEGMENT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/

/** %NAME% expanded from env; a name the computer does not set is an error, never a guess. */
export function expandWindowsVars(value: string, env: NodeJS.ProcessEnv = process.env): string {
  return value.replace(/%([A-Z_][A-Z0-9_]*)%/gi, (_, name: string) => {
    const v = env[name] ?? env[name.toUpperCase()]
    if (!v) throw new Error(`local_roots: %${name}% is not set on this computer`)
    return v
  })
}

export function readLocalRoots(config: unknown): LocalRoots {
  const roots = (config as { local_roots?: Record<string, unknown> } | null)?.local_roots
  const text = (k: string) => typeof roots?.[k] === 'string' && (roots[k] as string).trim() ? roots[k] as string : null
  const repos = text('repos'), worktrees = text('worktrees'), runtime = text('runtime')
  const engineRuntime = roots?.engine_runtime
  if (!repos?.includes('{repo}') || !worktrees?.includes('{repo}') || !worktrees.includes('{branch}') || !runtime
    || !Array.isArray(engineRuntime) || !engineRuntime.every(x => typeof x === 'string' && SEGMENT.test(x))) {
    throw new Error('config/studio.json local_roots needs repos ({repo}), worktrees ({repo}, {branch}), runtime and engine_runtime')
  }
  return { repos, worktrees, runtime, engineRuntime: engineRuntime as string[] }
}

export function localRoots(configPath: string = STUDIO_CONFIG): LocalRoots {
  return readLocalRoots(JSON.parse(readFileSync(configPath, 'utf8')))
}

const fill = (template: string, values: Record<string, string>, env: NodeJS.ProcessEnv) => {
  for (const [k, v] of Object.entries(values)) {
    if (!SEGMENT.test(v.replace(/\//g, '-'))) throw new Error(`local_roots: ${k} ${JSON.stringify(v)} is not a folder name`)
  }
  return expandWindowsVars(template.replace(/\{(repo|branch)\}/g, (_, k: string) => (values[k] ?? '').replace(/\//g, '-')), env)
}

/** Where a repository lives on a home computer, from config/studio.json local_roots. */
export function repoPath(repo: string, roots: LocalRoots = localRoots(), env: NodeJS.ProcessEnv = process.env): string {
  return fill(roots.repos, { repo }, env)
}

/** Where a worktree of a repository's branch lives (a branch's slashes become dashes). */
export function worktreePath(repo: string, branch: string, roots: LocalRoots = localRoots(), env: NodeJS.ProcessEnv = process.env): string {
  return fill(roots.worktrees, { repo, branch }, env)
}

/** The engine's own runtime root on a home computer. */
export function engineRuntimeRoot(roots: LocalRoots = localRoots(), env: NodeJS.ProcessEnv = process.env): string {
  return expandWindowsVars(roots.runtime, env)
}

/** The folders a pruner may empty: only engine-made runtime listed in local_roots.engine_runtime, under the runtime
 *  root. Anything else asked for is refused by name, and nothing here deletes: a pruner deletes only after Krish's yes. */
export function pruneTargets(asked: string[], roots: LocalRoots = localRoots(), env: NodeJS.ProcessEnv = process.env): { allowed: string[]; refused: string[] } {
  const root = engineRuntimeRoot(roots, env)
  const allowed: string[] = [], refused: string[] = []
  for (const name of asked) (roots.engineRuntime.includes(name) ? allowed : refused).push(name)
  return { allowed: allowed.map(name => `${root}\\${name}`), refused }
}
