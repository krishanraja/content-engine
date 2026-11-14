import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  // _library.ts loads the Supabase client. A dead local address, so nothing
  // here can reach a real database whatever the shell holds.
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'not-a-key'
})

import {
  LIBRARY_BUCKET,
  LIBRARY_CONTENT_TYPES,
  LIBRARY_MAX_BYTES,
  LIBRARY_PART_MAX,
  LIBRARY_PATH_MAX,
  LIBRARY_POST_README,
  LIBRARY_POST_SECTIONS,
  LIBRARY_OFF_DAY,
  LIBRARY_SUBCHANNELS,
  LIBRARY_TOP_FOLDERS,
  HEARTSIDE_POSTS,
  HEARTSIDE_POST_ID,
  LIBRARY_NAMES,
  checkLibraryPath,
  isLibraryPostFolder,
  libraryMimeTypes,
  parseLibraryConfirmRequest,
  parseLibraryName,
  parseLibraryPendingQuery,
  parseLibraryUploadRequest,
  parseLibraryWrittenRequest,
} from '../../apps/control-plane/api/library/_library.js'

// The boundary that keeps the asset library to Krish's one Drive folder.
//
// Krish, 2026-10-06: "I want every single asset in there, permanent and for
// individual posts, categorized properly, clear what to use them for, and
// every new post gets its own new folder with all assets including the
// article HTML I can copy paste, video scripts, etc etc". The rule is written
// once as cases in config/library-paths.cases.json; scripts/post-pack/
// library.py is checked against the same cases by `build.py --self-test`.

interface Cases {
  top_folders: string[]
  post_sections: string[]
  post_readme: string
  subchannels: string[]
  off_day_label: string
  path_max: number
  part_max: number
  max_bytes: number
  content_types: Record<string, string>
  paths: Array<{ why: string; path: string; refused?: string }>
  post_folders: Array<{ why: string; folder?: string; error?: string }>
  library_names: string[]
  libraries: { heartside: { top_folders: string[]; post_id_pattern: string; paths: Array<{ why: string; path: string; refused?: string }> } }
}
const cases = JSON.parse(readFileSync('config/library-paths.cases.json', 'utf8')) as Cases
const migration = readFileSync('supabase/migrations/20261006120000_content_library.sql', 'utf8')
// The cap was raised to 2 GiB on 2026-10-18 (Krish: "Yes, raise to 2 GB"); the first migration keeps its 500 MiB.
const raised = readFileSync('supabase/migrations/20261018160000_library_files_up_to_2gib.sql', 'utf8')

describe('the library path rule, from the shared cases', () => {
  it('keeps the same constants as the cases', () => {
    expect([...LIBRARY_TOP_FOLDERS]).toEqual(cases.top_folders)
    expect([...LIBRARY_POST_SECTIONS]).toEqual(cases.post_sections)
    expect(LIBRARY_POST_README).toBe(cases.post_readme)
    expect([...LIBRARY_SUBCHANNELS].sort()).toEqual([...cases.subchannels].sort())
    expect(LIBRARY_OFF_DAY).toBe(cases.off_day_label)
    expect(LIBRARY_PATH_MAX).toBe(cases.path_max)
    expect(LIBRARY_PART_MAX).toBe(cases.part_max)
    expect(LIBRARY_MAX_BYTES).toBe(cases.max_bytes)
    expect({ ...LIBRARY_CONTENT_TYPES }).toEqual(cases.content_types)
  })

  it('has cases for every refusal the rule can give', () => {
    const refusals = new Set(cases.paths.map((item) => item.refused).filter(Boolean))
    for (const code of [
      'path_not_text', 'path_too_long', 'path_not_nfc', 'path_backslash', 'path_absolute', 'path_empty_part',
      'path_escapes_library', 'path_hidden_part', 'path_unsafe_character', 'path_part_edge', 'path_reserved_name',
      'path_part_too_long', 'path_wrong_top_folder', 'path_no_file', 'path_post_folder_invalid',
      'path_post_section_invalid', 'path_type_not_allowed',
    ]) expect(refusals.has(code), code).toBe(true)
  })

  it.each(cases.paths.map((item) => [item.why, item] as const))('path: %s', (_why, item) => {
    const checked = checkLibraryPath(item.path)
    if (item.refused) {
      expect(checked).toEqual({ ok: false, refusal: item.refused })
    } else {
      expect(checked.ok).toBe(true)
      if (checked.ok) {
        expect(checked.path).toBe(item.path)
        expect(checked.contentType).toBe(cases.content_types[checked.extension])
      }
    }
  })

  it.each(cases.post_folders.filter((item) => item.folder).map((item) => [item.why, item] as const))('a folder build.py names is one the engine takes: %s', (_why, item) => {
    expect(isLibraryPostFolder(item.folder!)).toBe(true)
    expect(checkLibraryPath(`3 Posts/${item.folder}/READ ME.txt`).ok).toBe(true)
    expect(checkLibraryPath(`3 Posts/${item.folder}/1 Article/substack-copy.html`).ok).toBe(true)
  })

  it('refuses anything that is not text', () => {
    for (const value of [undefined, null, 7, ['3 Posts'], { path: 'x' }]) {
      expect(checkLibraryPath(value)).toEqual({ ok: false, refusal: 'path_not_text' })
    }
  })

  it('knows the day each date fell on', () => {
    expect(isLibraryPostFolder('2026-10-05 Mon follow.the.money - Who gets paid')).toBe(true)
    expect(isLibraryPostFolder('2026-10-06 Tue follow.the.money - Who gets paid')).toBe(true)
    expect(isLibraryPostFolder('2026-10-06 Mon follow.the.money - Who gets paid')).toBe(false)
    expect(isLibraryPostFolder('2028-02-29 Tue mind.the.gap - Leap day')).toBe(true)
    expect(isLibraryPostFolder('2027-02-29 Mon mind.the.gap - Not a leap year')).toBe(false)
    expect(isLibraryPostFolder('2026-10-05 Launch - Launch hello')).toBe(true)
    expect(isLibraryPostFolder('2026-10-05 Mon Launch - Launch hello')).toBe(false)
  })
})

describe('the requests the routes take', () => {
  const path = '3 Posts/2026-10-05 Mon follow.the.money - Who gets paid/1 Article/substack-copy.html'
  const sha = 'a'.repeat(64)

  it('an upload names the path, both hashes, the size and a one-line purpose', () => {
    const good = parseLibraryUploadRequest({ path, sha256: sha, md5: 'b'.repeat(32), bytes: 12, purpose: "Paste into Substack's editor" })
    expect(good.ok).toBe(true)
    expect(parseLibraryUploadRequest({ path, sha256: sha, md5: 'b'.repeat(32), bytes: 12, purpose: 'two\nlines' })).toEqual({ ok: false, code: 'invalid_library_upload_request' })
    expect(parseLibraryUploadRequest({ path, sha256: sha, md5: 'b'.repeat(32), bytes: 0, purpose: 'x' })).toEqual({ ok: false, code: 'invalid_library_upload_request' })
    expect(parseLibraryUploadRequest({ path, sha256: sha.toUpperCase(), md5: 'b'.repeat(32), bytes: 1, purpose: 'x' })).toEqual({ ok: false, code: 'invalid_library_upload_request' })
    expect(parseLibraryUploadRequest({ path, sha256: sha, md5: 'b'.repeat(32), bytes: LIBRARY_MAX_BYTES + 1, purpose: 'x' })).toEqual({ ok: false, code: 'library_file_too_large' })
    expect(parseLibraryUploadRequest({ path: '3 Posts/../x.png', sha256: sha, md5: 'b'.repeat(32), bytes: 1, purpose: 'x' }))
      .toEqual({ ok: false, code: 'invalid_library_path', reason: 'path_escapes_library' })
  })

  it('pending names one machine and a limit up to 100', () => {
    expect(parseLibraryPendingQuery({ machine: 'library-0f3c' })).toEqual({ machine: 'library-0f3c', limit: 25, library: 'makeyourmindup', folders: false })
    expect(parseLibraryPendingQuery({ machine: 'library-0f3c', limit: '100' })).toEqual({ machine: 'library-0f3c', limit: 100, library: 'makeyourmindup', folders: false })
    expect(parseLibraryPendingQuery({ machine: 'library-0f3c', folders: '1' })).toMatchObject({ folders: true })
    expect(parseLibraryPendingQuery({ machine: 'library-0f3c', folders: 'yes' })).toBeNull()
    expect(parseLibraryPendingQuery({ machine: 'library-0f3c', limit: '101' })).toBeNull()
    expect(parseLibraryPendingQuery({ machine: 'library-0f3c', limit: '0' })).toBeNull()
    expect(parseLibraryPendingQuery({ machine: ['a', 'b'] })).toBeNull()
    expect(parseLibraryPendingQuery({ machine: 'has space' })).toBeNull()
    expect(parseLibraryPendingQuery({})).toBeNull()
  })

  it('a file kept beside one Krish changed stays in the same folder', () => {
    const base = { schema_version: 1, machine: 'library-0f3c' }
    expect(parseLibraryWrittenRequest({ ...base, items: [{ path, sha256: sha }] })?.items).toEqual([{ path, sha256: sha, written_as: null }])
    const beside = path.replace('substack-copy.html', 'substack-copy (2).html')
    expect(parseLibraryWrittenRequest({ ...base, items: [{ path, sha256: sha, written_as: beside }] })?.items[0]?.written_as).toBe(beside)
    expect(parseLibraryWrittenRequest({ ...base, items: [{ path, sha256: sha, written_as: '2 Channel art (permanent)/x.html' }] })).toBeNull()
    expect(parseLibraryWrittenRequest({ ...base, items: [{ path, sha256: sha, written_as: path.replace('1 Article', '4 Social') }] })).toBeNull()
    expect(parseLibraryWrittenRequest({ ...base, items: [] })).toBeNull()
    expect(parseLibraryWrittenRequest({ machine: base.machine, items: [{ path, sha256: sha }] })).toBeNull()
    expect(parseLibraryWrittenRequest({ ...base, items: [{ path: 'Video Engine/Inbox/x.mp4', sha256: sha }] })).toBeNull()
  })
})

describe('the migration matches the code', () => {
  it('makes the private bucket with exactly the size cap and the types the routes demand', () => {
    const bucket = /insert into storage\.buckets[\s\S]*?values \(\s*'([^']+)',\s*'([^']+)',\s*(true|false),\s*([0-9]+),\s*array\[([\s\S]*?)\]\s*\)/.exec(migration)
    expect(bucket).not.toBeNull()
    expect(bucket![1]).toBe(LIBRARY_BUCKET)
    expect(bucket![3]).toBe('false')
    expect(Number(bucket![4])).toBe(524288000)
    expect(raised).toContain(`set file_size_limit = ${LIBRARY_MAX_BYTES} where id = '${LIBRARY_BUCKET}'`)
    const types = [...bucket![5]!.matchAll(/'([^']+)'/g)].map((m) => m[1]).sort()
    expect(types).toEqual(libraryMimeTypes())
    expect(migration).toMatch(/on conflict \(id\) do update set\s+public = false,/)
    expect(migration).toContain('bytes bigint not null check (bytes between 1 and 524288000)')
    expect(raised).toContain(`check (bytes between 1 and ${LIBRARY_MAX_BYTES})`)
    expect(migration).toContain(`char_length(path) between 1 and ${LIBRARY_PATH_MAX}`)
  })

  it('is idempotent and closed to everyone but the service role', () => {
    expect(migration).toContain('create table if not exists public.content_library_files')
    expect(migration).toContain('create index if not exists content_library_files_ready_idx')
    expect(migration).toContain('alter table public.content_library_files enable row level security;')
    expect(migration).toContain('revoke all on public.content_library_files from anon, authenticated;')
    for (const fn of ['content_library_pending(text, integer)', 'content_library_record_written(text, jsonb)']) {
      expect(migration).toContain(`revoke all on function public.${fn} from public, anon, authenticated;`)
      expect(migration).toContain(`grant execute on function public.${fn} to service_role;`)
    }
    expect(migration.match(/create or replace function/g)?.length).toBe(2)
    expect(migration.match(/set search_path = ''/g)?.length).toBe(2)
    expect(migration).not.toMatch(/security definer/i)
    expect(migration).not.toMatch(/\bdrop table\b|\bdelete from\b|\btruncate\b/i)
  })

  it('keeps the database\'s own path check in step with the top folders', () => {
    expect(migration).toContain("path ~ '^(1 Brand kit \\(permanent\\)|2 Channel art \\(permanent\\)|3 Posts/[^/]+)/[^/]'")
  })
})

// Krish, 2026-11-03: "Why don't you duplicate that Python script for Heartside
// then? We're going to need to do a lot more of this type of stuff moving
// forward." Heartside is a second library in the same lane: its own folder
// rule, its own rows, and makeyourmindup stays the default for every request
// that names none.
describe('the Heartside library', () => {
  const heartside = cases.libraries.heartside
  const heartsideMigration = readFileSync('supabase/migrations/20261121090000_content_library_heartside.sql', 'utf8')
  const sha = 'a'.repeat(64)
  const md5 = 'b'.repeat(32)

  it('keeps the same rule as the cases', () => {
    expect([...LIBRARY_NAMES]).toEqual(cases.library_names)
    expect([HEARTSIDE_POSTS]).toEqual(heartside.top_folders)
    expect(HEARTSIDE_POST_ID.source).toBe(`^${heartside.post_id_pattern}$`)
    expect(heartside.paths.some((item) => item.refused === 'path_post_id_invalid')).toBe(true)
  })

  it.each(heartside.paths.map((item) => [item.why, item] as const))('heartside path: %s', (_why, item) => {
    const checked = checkLibraryPath(item.path, 'heartside')
    if (item.refused) {
      expect(checked).toEqual({ ok: false, refusal: item.refused })
    } else {
      expect(checked.ok).toBe(true)
      if (checked.ok) {
        expect(checked.library).toBe('heartside')
        expect(checked.top).toBe(HEARTSIDE_POSTS)
      }
      // A Heartside path is never a makeyourmindup path.
      expect(checkLibraryPath(item.path).ok).toBe(false)
    }
  })

  it('names makeyourmindup when a request names no library, and refuses one there is not', () => {
    expect(parseLibraryName(undefined)).toBe('makeyourmindup')
    expect(parseLibraryName(null)).toBe('makeyourmindup')
    expect(parseLibraryName('heartside')).toBe('heartside')
    for (const bad of ['Heartside', 'elsewhere', '', 7, ['heartside']]) expect(parseLibraryName(bad)).toBeNull()
  })

  it('reads the library from every request', () => {
    const upload = { path: 'Posts/F01/heartside_F01_reel.mp4', sha256: sha, md5, bytes: 10, purpose: 'The reel.' }
    expect(parseLibraryUploadRequest(upload)).toEqual({ ok: false, code: 'invalid_library_path', reason: 'path_wrong_top_folder' })
    const parsed = parseLibraryUploadRequest({ ...upload, library: 'heartside' })
    expect(parsed.ok && parsed.value.path.library).toBe('heartside')
    expect(parseLibraryUploadRequest({ ...upload, library: 'elsewhere' })).toEqual({ ok: false, code: 'invalid_library' })
    const confirmed = parseLibraryConfirmRequest({ path: upload.path, sha256: sha, library: 'heartside' })
    expect(confirmed.ok && confirmed.value.path.library).toBe('heartside')
    expect(parseLibraryPendingQuery({ machine: 'library-1' })).toEqual({ machine: 'library-1', limit: 25, library: 'makeyourmindup', folders: false })
    expect(parseLibraryPendingQuery({ machine: 'library-1', library: 'heartside' })).toEqual({ machine: 'library-1', limit: 25, library: 'heartside', folders: false })
    expect(parseLibraryPendingQuery({ machine: 'library-1', library: 'elsewhere' })).toBeNull()
    const written = { schema_version: 1, machine: 'library-1', items: [{ path: upload.path, sha256: sha }] }
    expect(parseLibraryWrittenRequest(written)).toBeNull()
    expect(parseLibraryWrittenRequest({ ...written, library: 'heartside' })?.library).toBe('heartside')
  })

  it('keeps the database in step: a library column, a per-library path check and per-library functions', () => {
    expect(heartsideMigration).toContain("add column if not exists library text not null default 'makeyourmindup'")
    expect(heartsideMigration).toContain("check (library in ('makeyourmindup', 'heartside'))")
    expect(heartsideMigration).toContain("path ~ '^(1 Brand kit \\(permanent\\)|2 Channel art \\(permanent\\)|3 Posts/[^/]+)/[^/]'")
    expect(heartsideMigration).toContain(`path ~ '^Posts/${heartside.post_id_pattern.replace('(?:', '(')}/[^/]+$'`)
    expect(heartsideMigration).toContain(`char_length(path) between 1 and ${LIBRARY_PATH_MAX}`)
    expect(heartsideMigration).toContain('unique (library, path, sha256)')
    for (const fn of ['content_library_pending(text, integer, text)', 'content_library_record_written(text, jsonb, text)']) {
      expect(heartsideMigration).toContain(`revoke all on function public.${fn} from public, anon, authenticated;`)
      expect(heartsideMigration).toContain(`grant execute on function public.${fn} to service_role;`)
    }
    expect(heartsideMigration.match(/f\.library = coalesce\(p_library, 'makeyourmindup'\)/g)?.length).toBe(3)
    expect(heartsideMigration.match(/set search_path = ''/g)?.length).toBe(2)
    expect(heartsideMigration).not.toMatch(/security definer/i)
    expect(heartsideMigration).not.toMatch(/\bdrop table\b|\bdelete from\b|\btruncate\b|\bdrop column\b/i)
  })
})
