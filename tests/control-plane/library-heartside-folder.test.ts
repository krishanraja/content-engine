import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Where Heartside's social library is, found in Drive by its folder ID
// (api/library/_heartsideFolder.ts). Krish, 2026-11-09, after renaming
// 05_Social-Library to 03b_Social-Schedule: "ideally ID so if folders move it
// doesnt matter". Drive is a fixture here: no test reaches Google.

const google = vi.hoisted(() => ({ token: 'tok' as string | null, why: '', calls: [] as Array<{ scopes: string[]; options: any }> }))
vi.mock('../../apps/control-plane/api/_google.js', () => ({
  DRIVE_READONLY_SCOPE: 'https://www.googleapis.com/auth/drive.readonly',
  googleAccessToken: async (scopes: string[], options: any) => {
    google.calls.push({ scopes, options })
    if (!google.token) options?.onError?.(google.why)
    return google.token
  },
}))

import {
  HEARTSIDE_LIBRARY_FOLDER_ID,
  isPathSafeName,
  resetHeartsideFolderCache,
  resolveHeartsideFolder,
  walkFolderPath,
  type DriveFolderMeta,
} from '../../apps/control-plane/api/library/_heartsideFolder.js'

const ID = HEARTSIDE_LIBRARY_FOLDER_ID
const ROOT = 'root-id'
const FOLDER = 'application/vnd.google-apps.folder'

/** Krish's Drive as it was on 2026-11-09, by ID. */
function drive(): Map<string, DriveFolderMeta> {
  return new Map<string, DriveFolderMeta>([
    ['ventures', { id: 'ventures', name: 'Ventures', mimeType: FOLDER, parents: [ROOT] }],
    ['active', { id: 'active', name: 'Active Ventures', mimeType: FOLDER, parents: ['ventures'] }],
    ['heartside', { id: 'heartside', name: 'Heartside', mimeType: FOLDER, parents: ['active'] }],
    ['archive', { id: 'archive', name: 'Archive', mimeType: FOLDER, parents: [ROOT] }],
    [ID, { id: ID, name: '03b_Social-Schedule', mimeType: FOLDER, parents: ['heartside'] }],
  ])
}
const lookupIn = (files: Map<string, DriveFolderMeta>) => async (id: string) => files.get(id) ?? 'missing' as const

describe('walking the folder up to My Drive', () => {
  it('keeps the ID in step with config/heartside-library.json', () => {
    const config = JSON.parse(readFileSync(join(__dirname, '..', '..', 'config', 'heartside-library.json'), 'utf8')) as { drive_id: string }
    expect(ID).toBe(config.drive_id)
  })

  it('gives the folder\'s path as it is now', async () => {
    expect(await walkFolderPath(ID, ROOT, lookupIn(drive()))).toEqual({
      state: 'found',
      drive_id: ID,
      path: 'My Drive/Ventures/Active Ventures/Heartside/03b_Social-Schedule',
      segments: ['My Drive', 'Ventures', 'Active Ventures', 'Heartside', '03b_Social-Schedule'],
    })
  })

  it('follows a rename of the folder, or of a folder above it, with nothing changed in the repository', async () => {
    const files = drive()
    files.get(ID)!.name = '05_Social-Library'
    expect(await walkFolderPath(ID, ROOT, lookupIn(files))).toMatchObject({ state: 'found', path: 'My Drive/Ventures/Active Ventures/Heartside/05_Social-Library' })
    files.get('active')!.name = 'Live'
    expect(await walkFolderPath(ID, ROOT, lookupIn(files))).toMatchObject({ state: 'found', path: 'My Drive/Ventures/Live/Heartside/05_Social-Library' })
  })

  it('follows a move to another parent', async () => {
    const files = drive()
    files.get(ID)!.parents = ['archive']
    expect(await walkFolderPath(ID, ROOT, lookupIn(files))).toMatchObject({ state: 'found', path: 'My Drive/Archive/03b_Social-Schedule' })
  })

  it('says the folder is gone when it is deleted, no longer a folder, or in the bin, itself or above', async () => {
    const files = drive()
    files.delete(ID)
    expect(await walkFolderPath(ID, ROOT, lookupIn(files))).toMatchObject({ state: 'gone', problem: 'heartside_library_gone' })

    const notFolder = drive()
    notFolder.get(ID)!.mimeType = 'application/pdf'
    expect(await walkFolderPath(ID, ROOT, lookupIn(notFolder))).toMatchObject({ state: 'gone', problem: 'heartside_library_gone' })

    const binned = drive()
    binned.get(ID)!.trashed = true
    expect(await walkFolderPath(ID, ROOT, lookupIn(binned))).toMatchObject({ state: 'gone', problem: 'heartside_library_trashed' })

    const aboveBinned = drive()
    aboveBinned.get('heartside')!.trashed = true
    expect(await walkFolderPath(ID, ROOT, lookupIn(aboveBinned))).toMatchObject({ state: 'gone', problem: 'heartside_library_trashed' })
  })

  it('says unknown, never a guessed path, when the way up cannot be read or mapped', async () => {
    const error = await walkFolderPath(ID, ROOT, async () => 'error')
    expect(error.state).toBe('unknown')

    const unreadable = drive()
    unreadable.delete('active')
    expect((await walkFolderPath(ID, ROOT, lookupIn(unreadable))).state).toBe('unknown')

    const outside = drive()
    outside.get('ventures')!.parents = []
    expect((await walkFolderPath(ID, ROOT, lookupIn(outside))).state).toBe('unknown')

    const loop = drive()
    loop.get('ventures')!.parents = ['heartside']
    expect((await walkFolderPath(ID, ROOT, lookupIn(loop))).state).toBe('unknown')

    for (const name of ['a/b', 'a\\b', '..', 'x:', 'name.', ' padded', '']) {
      const bad = drive()
      bad.get('heartside')!.name = name
      expect((await walkFolderPath(ID, ROOT, lookupIn(bad))).state).toBe('unknown')
    }
  })

  it('takes only names that are one Windows folder', () => {
    expect(isPathSafeName('03b_Social-Schedule')).toBe(true)
    expect(isPathSafeName('Active Ventures')).toBe(true)
    for (const name of ['..', '.', 'a<b', 'a|b', 'a"b', 'a?b', 'a*b', 'tab\tname', 42, null]) expect(isPathSafeName(name)).toBe(false)
  })
})

describe('asking Google', () => {
  const realFetch = globalThis.fetch
  let files: Map<string, DriveFolderMeta>
  let requests: string[]

  beforeEach(() => {
    resetHeartsideFolderCache()
    google.token = 'tok'
    google.calls = []
    files = drive()
    requests = []
    globalThis.fetch = (async (input: string | URL) => {
      const url = new URL(String(input))
      requests.push(url.pathname + url.search)
      const id = decodeURIComponent(url.pathname.split('/').pop()!)
      if (id === 'root') return new Response(JSON.stringify({ id: ROOT }), { status: 200 })
      const file = files.get(id)
      return file ? new Response(JSON.stringify(file), { status: 200 }) : new Response('{}', { status: 404 })
    }) as typeof fetch
  })
  afterEach(() => { globalThis.fetch = realFetch })

  it('reads as the folder\'s owner, read only, and only with GET', async () => {
    const answer = await resolveHeartsideFolder(1_000)
    expect(answer).toMatchObject({ state: 'found', path: 'My Drive/Ventures/Active Ventures/Heartside/03b_Social-Schedule' })
    expect(google.calls[0]).toMatchObject({ scopes: ['https://www.googleapis.com/auth/drive.readonly'], options: { subject: 'krish@mindmake.co' } })
    expect(requests.every((r) => r.startsWith('/drive/v3/files/'))).toBe(true)
  })

  it('reuses an answer for a few minutes, then asks again and sees a rename', async () => {
    await resolveHeartsideFolder(1_000)
    const asked = requests.length
    files.get(ID)!.name = 'Renamed'
    expect(await resolveHeartsideFolder(2_000)).toMatchObject({ path: expect.stringMatching(/03b_Social-Schedule$/) })
    expect(requests.length).toBe(asked)
    expect(await resolveHeartsideFolder(1_000 + 5 * 60 * 1000)).toMatchObject({ path: expect.stringMatching(/\/Renamed$/) })
  })

  it('says unknown, with Google\'s reason, when it cannot sign in as the owner, and does not keep that answer', async () => {
    google.token = null
    google.why = 'unauthorized_client'
    expect(await resolveHeartsideFolder(1_000)).toMatchObject({ state: 'unknown', reason: expect.stringContaining('unauthorized_client') })
    google.token = 'tok'
    expect(await resolveHeartsideFolder(1_001)).toMatchObject({ state: 'found' })
  })

  it('says gone for a folder deleted from Drive', async () => {
    files.delete(ID)
    expect(await resolveHeartsideFolder(1_000)).toMatchObject({ state: 'gone', problem: 'heartside_library_gone' })
  })
})
