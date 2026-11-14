import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Where the engine's runtime folders are, found in Drive by the IDs in
// config/studio.json drive_ids (api/library/_runtimeFolders.ts). On 11 Nov a
// rename of a folder above them broke the library and music roots on both home
// computers, which found them by path. Drive is a fixture: no test reaches Google.

const google = vi.hoisted(() => ({ token: 'tok' as string | null, calls: 0 }))
vi.mock('../../apps/control-plane/api/_google.js', () => ({
  DRIVE_READONLY_SCOPE: 'https://www.googleapis.com/auth/drive.readonly',
  googleAccessToken: async (_scopes: string[], options: any) => {
    google.calls += 1
    if (!google.token) options?.onError?.('unauthorized_client')
    return google.token
  },
}))

import { resetDriveFolderCache, type DriveFolderMeta } from '../../apps/control-plane/api/library/_driveFolder.js'
import { RUNTIME_FOLDER_NAMES, resolveRuntimeFolders, runtimeFolderIds } from '../../apps/control-plane/api/library/_runtimeFolders.js'

const studio = JSON.parse(readFileSync(join(__dirname, '..', '..', 'config', 'studio.json'), 'utf8')) as { drive_ids: Record<string, string>; runtime: Record<string, string> }
const ROOT = 'root-id'
const FOLDER = 'application/vnd.google-apps.folder'

/** The runtime folders as config/studio.json runtime.* names them, built by ID. */
function drive(): Map<string, DriveFolderMeta> {
  const ids = studio.drive_ids
  return new Map<string, DriveFolderMeta>([
    ['ventures', { id: 'ventures', name: 'Ventures', mimeType: FOLDER, parents: [ROOT] }],
    ['active', { id: 'active', name: 'Active Ventures', mimeType: FOLDER, parents: ['ventures'] }],
    [ids.library_root, { id: ids.library_root, name: 'makeyourmindup', mimeType: FOLDER, parents: ['active'] }],
    ['kit', { id: 'kit', name: '1 Brand kit (permanent)', mimeType: FOLDER, parents: [ids.library_root] }],
    [ids.music_root, { id: ids.music_root, name: 'Music', mimeType: FOLDER, parents: ['kit'] }],
    [ids.drive_root, { id: ids.drive_root, name: 'Video Engine', mimeType: FOLDER, parents: [ids.library_root] }],
    [ids.media_inbox, { id: ids.media_inbox, name: 'Inbox', mimeType: FOLDER, parents: [ids.drive_root] }],
    [ids.archive_root, { id: ids.archive_root, name: 'Archive', mimeType: FOLDER, parents: [ids.drive_root] }],
  ])
}

const windowsPath = (segments: string[]) => 'H:\\' + segments.join('\\')

describe('the runtime folders by their Drive IDs', () => {
  const realFetch = globalThis.fetch
  let files: Map<string, DriveFolderMeta>
  let requests: string[]

  beforeEach(() => {
    resetDriveFolderCache()
    google.token = 'tok'
    google.calls = 0
    files = drive()
    requests = []
    globalThis.fetch = (async (input: string | URL, init?: RequestInit) => {
      expect(init?.method ?? 'GET').toBe('GET')
      const url = new URL(String(input))
      requests.push(url.pathname)
      const id = decodeURIComponent(url.pathname.split('/').pop()!)
      if (id === 'root') return new Response(JSON.stringify({ id: ROOT }), { status: 200 })
      const file = files.get(id)
      return file ? new Response(JSON.stringify(file), { status: 200 }) : new Response('{}', { status: 404 })
    }) as typeof fetch
  })
  afterEach(() => { globalThis.fetch = realFetch })

  it('takes every runtime folder\'s ID from config/studio.json, one per runtime.* path', () => {
    expect(runtimeFolderIds().map((f) => f.name)).toEqual([...RUNTIME_FOLDER_NAMES])
    for (const { name, id } of runtimeFolderIds()) {
      expect(id).toBe(studio.drive_ids[name])
      expect(studio.runtime[name]).toBeTruthy()
    }
    expect(runtimeFolderIds({ drive_ids: { library_root: 'x' } })).toEqual([])
  })

  it('finds each folder where config/studio.json says it is today, in one sign-in, reading a shared parent once', async () => {
    const answers = await resolveRuntimeFolders(1_000)
    for (const answer of answers) {
      expect(answer.state).toBe('found')
      if (answer.state === 'found') expect(windowsPath(answer.segments)).toBe(studio.runtime[answer.name])
    }
    expect(google.calls).toBe(1)
    expect(requests.filter((p) => p.endsWith('/ventures')).length).toBe(1)
  })

  it('follows the 11 Nov rename above the library and music roots with nothing changed in the repository', async () => {
    files.get('active')!.name = 'Active'
    const answers = await resolveRuntimeFolders(1_000)
    const library = answers.find((a) => a.name === 'library_root')!
    const music = answers.find((a) => a.name === 'music_root')!
    expect(library).toMatchObject({ state: 'found', path: 'My Drive/Ventures/Active/makeyourmindup' })
    expect(music).toMatchObject({ state: 'found', path: 'My Drive/Ventures/Active/makeyourmindup/1 Brand kit (permanent)/Music' })
  })

  it('names its own problem for a folder in the bin, and leaves the others found', async () => {
    files.get(studio.drive_ids.music_root)!.trashed = true
    const answers = await resolveRuntimeFolders(1_000)
    expect(answers.find((a) => a.name === 'music_root')).toMatchObject({ state: 'gone', problem: 'music_root_trashed' })
    expect(answers.find((a) => a.name === 'library_root')).toMatchObject({ state: 'found' })
  })

  it('says unknown for every folder, never a guessed path, when Drive cannot be asked, and asks again next time', async () => {
    google.token = null
    const down = await resolveRuntimeFolders(1_000)
    expect(down.every((a) => a.state === 'unknown')).toBe(true)
    expect(down[0]).toMatchObject({ reason: expect.stringContaining('unauthorized_client') })
    google.token = 'tok'
    expect((await resolveRuntimeFolders(1_001)).every((a) => a.state === 'found')).toBe(true)
  })
})
