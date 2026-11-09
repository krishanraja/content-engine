import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTROL_CENTER_RUNNER_CREDENTIAL } from '@mindmake/core'

// scripts/library-sync.ps1 and its installer, read as text: no PowerShell runs
// in this suite. The sync writes into Krish's Drive, so what it may and may
// not do is pinned here.
//
// Krish, 2026-10-06: "make sure the brand kit is always updated here [the
// library's Drive folder]", then "I want every single asset in there,
// permanent and for individual posts, categorized properly, clear what to use
// them for, and every new post gets its own new folder with all assets
// including the article HTML I can copy paste, video scripts, etc etc". The
// architecture doc's rule 0a.5 says agents never write into his Drive; this is
// his explicit instruction for this one folder, carried out by his own
// machine, and it covers that folder only.

const ROOT = join(__dirname, '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n')
const sync = read('scripts/library-sync.ps1')
const installer = read('scripts/install-library-sync.ps1')
const code = (source: string) => source.slice(source.indexOf('#>') + 2)
const cases = JSON.parse(read('config/library-paths.cases.json')) as { top_folders: string[] }
/** One function of the sync, from its `function` line to the closing brace at
 *  the start of a line. */
const fn = (name: string) => {
  const start = sync.indexOf(`function ${name}(`)
  if (start < 0) throw new Error(`no function ${name}`)
  return sync.slice(start, sync.indexOf('\n}\n', start) + 2)
}
/** A PowerShell to run the sync's own functions with: Windows PowerShell on
 *  Windows, pwsh where it is installed (GitHub's runners), else none and the
 *  run-it tests are skipped. */
const POWERSHELL = process.platform === 'win32' ? 'powershell.exe'
  : spawnSync('pwsh', ['-NoProfile', '-Command', '1'], { encoding: 'utf8' }).status === 0 ? 'pwsh' : null

describe('the library sync on Krish\'s machine', () => {
  it('is plain ASCII, as every PowerShell script here is, so Windows PowerShell reads it as written', () => {
    for (const source of [sync, installer]) expect([...source].filter((ch) => ch.charCodeAt(0) > 127)).toEqual([])
  })

  it('finds the library from runtime.library_root in config/studio.json, unless MINDMAKE_LIBRARY_ROOT names a folder that is there', () => {
    // Read from the registry each pass, so a setting changed or deleted after
    // the task started counts without a restart (2026-10-24).
    expect(sync).toContain("Get-Setting 'MINDMAKE_LIBRARY_ROOT'")
    expect(sync).toContain("'library_env_stale'")
    expect(sync).toContain("Get-Field $runtime 'library_root'")
  })

  it('refuses a library root that overlaps the Studio\'s Video Engine folders', () => {
    for (const name of ['drive_root', 'media_inbox', 'archive_root']) expect(sync).toContain(`Get-Field $runtime '${name}'`)
    for (const name of ['MINDMAKE_DRIVE_ROOT', 'MINDMAKE_MEDIA_INBOX', 'MINDMAKE_ARCHIVE_ROOT']) expect(sync).toContain(`$env:${name}`)
    expect(sync).toMatch(/Test-SamePath \$root \$folder\) -or \(Test-Inside \$root \$folder\) -or \$underWritten/)
    // Video Engine may sit inside the library folder, never inside a folder the sync writes to (2026-10-07).
    // One guard serves both libraries: each passes its own top folders.
    expect(sync).toMatch(/\$Tops \| Where-Object \{ \$top = Join-Path \$root \$_/)
    expect(sync).toContain('Assert-NoStudioOverlap $root $TopFolders $runtime')
    expect(sync).toContain('Assert-NoStudioOverlap $root $HeartsideTopFolders $runtime')
    expect(sync).not.toMatch(/\\Inbox|\\Archive/)
  })

  it('writes only under the three top folders, the same ones the engine allows', () => {
    const listed = /^\$TopFolders = @\((.*)\)$/m.exec(sync)
    expect(listed).not.toBeNull()
    expect([...listed![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual(cases.top_folders)
    expect(sync).toContain('$TopFolders -cnotcontains $parts[0]')
    expect(sync).toMatch(/\$part -eq '\.\.'/)
  })

  it('never deletes or renames anything in Drive: it removes only its own temporary files', () => {
    const body = code(sync)
    expect(body).not.toMatch(/Rename-Item|\[System\.IO\.File\]::(Delete|Move)|\[System\.IO\.Directory\]::(Delete|Move)|Clear-Content/)
    const removals = body.split('\n').filter((line) => /Remove-Item/.test(line))
    expect(removals.length).toBeGreaterThan(0)
    for (const line of removals) expect(line).toMatch(/Remove-Item -LiteralPath \$(temporary|workDir) /)
    for (const line of body.split('\n').filter((l) => /Move-Item/.test(l))) expect(line).toMatch(/Move-Item -LiteralPath \$(LogPath|temporary) /)
    // Overwriting in place happens in exactly two places: its own earlier copy
    // (or the brand kit) in the pending write, and the brand kit's unpacking.
    expect(body.match(/\[System\.IO\.File\]::Copy\([^)]*\$true\)/g)).toHaveLength(2)
    expect(body).toContain('($Previous -and $existing -eq $Previous) -or ($isBrandKit -and $candidate -eq $target)')
  })

  it('checks every file\'s size and sha256 before it reaches Drive, and again after', () => {
    expect(sync).toContain("throw 'the download does not match its sha256'")
    expect(sync).toContain("throw 'the download is the wrong size'")
    expect(sync).toContain('does not match its sha256" }')
  })

  it('takes the runner\'s own bearer the way the runner does, and never shows it', () => {
    expect(sync).toContain(`$RunnerCredential = '${CONTROL_CENTER_RUNNER_CREDENTIAL}'`)
    expect(sync).toMatch(/& powershell\.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \$reader -Target \$RunnerCredential/)
    expect(code(sync)).not.toMatch(/Write-(Host|Output|Log)[^\n]*\$(Token|token)\b/)
    expect(code(sync)).not.toMatch(/Set-Content|Out-File[^\n]*token/i)
  })

  it('logs with Write-Host, so no function returns its log lines by mistake', () => {
    const outputs = code(sync).split('\n').filter((line) => /Write-Output/.test(line) && !/^\s*#/.test(line))
    expect(outputs).toEqual(["  Write-Output 'Another library sync is running on this machine. Nothing to do.'"])
  })

  it('reads the engine\'s address from scripts/engine.py, the one place it is written', () => {
    const pattern = /\[regex\]::Match\(\$helper, "([^"]+)"\)/.exec(sync)
    expect(pattern).not.toBeNull()
    const found = new RegExp(pattern![1]!).exec(read('scripts/engine.py'))
    expect(found?.[1]).toMatch(/^https:\/\/[a-z0-9.-]+$/)
    expect(sync).not.toMatch(/vercel\.app|supabase\.co/)
  })

  it('downloads only from the library\'s signed storage, and the brand kit from the published zip', () => {
    expect(sync).toContain("$url.AbsolutePath.StartsWith('/storage/v1/object/sign/content-library/')")
    expect(sync).toContain("$BrandKitUrl = 'https://raw.githubusercontent.com/krishanraja/makeyourmindup/main/brand-kit/makeyourmindup-brand-kit.zip'")
    expect(sync).toContain('$handler.AllowAutoRedirect = $false')
  })
})

describe('the installer', () => {
  it('checks first, writing nothing, then registers one hidden sync every ten minutes for Krish\'s own session', () => {
    const check = installer.indexOf('-File $syncScript -Check -SkipBrandKit')
    const register = installer.indexOf('Register-ScheduledTask')
    expect(check).toBeGreaterThan(-1)
    expect(register).toBeGreaterThan(check)
    expect(installer).toContain("[string]$TaskName = 'Mindmake Library Sync'")
    expect(installer).toContain('[ValidateRange(5, 60)][int]$EveryMinutes = 10')
    expect(installer).toContain('-WindowStyle Hidden -File `"$syncScript`" -Loop -EveryMinutes $EveryMinutes')
    expect(installer).toContain('-LogonType Interactive -RunLevel Limited')
    expect(installer).toContain('-MultipleInstances IgnoreNew')
  })

  it('leaves the runner\'s task and checkout alone', () => {
    expect(installer).not.toContain('Mindmake Video Studio Runner')
    expect(code(installer)).not.toMatch(/runner-source|verify-runner-source|set-credential/)
  })
})

// Krish, 2026-11-03: "Why don't you duplicate that Python script for Heartside
// then?" The same sync files Heartside's social library, under Posts only, in a
// pass of its own that can never stop makeyourmindup's.
describe('the Heartside library in the same sync', () => {
  const heartside = (JSON.parse(read('config/library-paths.cases.json')) as { libraries: { heartside: { top_folders: string[]; post_id_pattern: string } } }).libraries.heartside
  const config = JSON.parse(read('config/heartside-library.json')) as { root: string; drive_id: string }

  it('writes only under Posts/<post id>, the same rule the engine holds', () => {
    const listed = /^\$HeartsideTopFolders = @\((.*)\)$/m.exec(sync)
    expect([...listed![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1])).toEqual(heartside.top_folders)
    expect(sync).toContain(`$HeartsidePostId = [regex]'^${heartside.post_id_pattern.replace('(?:', '(')}$'`)
    expect(sync).toContain('$parts.Count -ne 3')
  })

  it('finds its folder from config/heartside-library.json (never studio.json, which the media standard hashes), and skips it when none is set', () => {
    expect(config.root).toBe('H:\\My Drive\\Ventures\\Active Ventures\\Heartside\\03b_Social-Schedule')
    expect(config.drive_id).toBe('1AHZLgwj1nHemNJeP56fQU6iTpgIEALzZ')
    expect(sync).toContain("Join-Path $RepoRoot 'config\\heartside-library.json'")
    expect(read('config/studio.json')).not.toContain('heartside')
    expect(sync).toContain("Get-Setting 'MINDMAKE_HEARTSIDE_LIBRARY_ROOT'")
    expect(sync).toContain("'heartside_library_root_missing'")
  })

  // Krish, 2026-11-09: "ideally ID so if folders move it doesnt matter".
  it('asks the engine where the folder is by its Drive ID before it uses the configured path', () => {
    expect(sync).toContain('$heartside = Resolve-HeartsideRoot $config (Get-HeartsideFolder $client $base $token $machine)')
    expect(sync).toContain("'/api/library/pending?machine={0}&limit=1&library=heartside'")
    const resolver = fn('Resolve-HeartsideRoot')
    // Gone or in the bin stops the pass before any fallback to an old path.
    expect(resolver.indexOf("-eq 'gone'")).toBeLessThan(resolver.indexOf('$root = if ($configured)'))
    // Nothing on the way makes a folder.
    for (const name of ['Get-HeartsideFolder', 'Get-DriveForDesktopRoot', 'ConvertTo-HeartsidePath', 'Resolve-HeartsideRoot']) {
      expect(fn(name)).not.toMatch(/New-Item|CreateDirectory|mkdir/i)
    }
  })

  describe.runIf(POWERSHELL !== null)('run in PowerShell against a folder fixture', () => {
    const run = (folder: unknown, configuredRoot: string, setup: (base: string) => void, setting = '') => {
      // The long form: Windows hands out a short 8.3 temp path (RUNNER~1), and PowerShell gives back the long one.
      const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'heartside-folder-')))
      try {
        mkdirSync(join(base, 'repo', 'config'), { recursive: true })
        writeFileSync(join(base, 'repo', 'config', 'heartside-library.json'), JSON.stringify({ root: configuredRoot.replace('{base}', base), drive_id: config.drive_id }))
        setup(base)
        const script = [
          'Set-StrictMode -Version Latest',
          "$ErrorActionPreference = 'Stop'",
          `$RepoRoot = '${join(base, 'repo').replace(/'/g, "''")}'`,
          '$HeartsideTopFolders = @(\'Posts\')',
          '$script:Problems = New-Object System.Collections.Generic.List[string]',
          '$script:Log = New-Object System.Collections.Generic.List[string]',
          'function Write-Log([string]$Message) { $script:Log.Add($Message) }',
          `function Get-Setting([string]$Name) { return '${setting.replace('{base}', base)}' }`,
          ...['Read-JsonFile', 'Get-Field', 'Test-Inside', 'Test-SamePath', 'Assert-NoStudioOverlap', 'Get-DriveForDesktopRoot', 'ConvertTo-HeartsidePath', 'Resolve-HeartsideRoot'].map(fn),
          `$folder = '${JSON.stringify(folder).replace(/'/g, "''")}' | ConvertFrom-Json`,
          '$out = [ordered]@{ root = $null; error = $null; problems = $null; log = $null }',
          'try { $out.root = Resolve-HeartsideRoot ([pscustomobject]@{ runtime = [pscustomobject]@{} }) $folder } catch { $out.error = $_.Exception.Message }',
          '$out.problems = @($script:Problems); $out.log = @($script:Log)',
          '$out | ConvertTo-Json -Compress',
        ].join('\n')
        const file = join(base, 'resolve.ps1')
        writeFileSync(file, script)
        const ran = spawnSync(POWERSHELL!, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file], { encoding: 'utf8', env: { ...process.env, TERM: 'dumb' } })
        expect(ran.stderr).toBe('')
        const out = JSON.parse(ran.stdout.trim().split('\n').pop()!) as { root: string | null; error: string | null; problems: string[]; log: string[] }
        return { ...out, base }
      } finally {
        cleanup.push(base)
      }
    }
    const cleanup: string[] = []
    const sep = process.platform === 'win32' ? '\\' : '/'
    const at = (base: string, ...names: string[]) => [base, 'drive', 'My Drive', ...names].join(sep)
    const found = (...names: string[]) => ({ state: 'found', drive_id: config.drive_id, path: ['My Drive', ...names].join('/'), segments: ['My Drive', ...names] })
    const OLD = ['Ventures', 'Active Ventures', 'Heartside', '05_Social-Library']
    const NEW = ['Ventures', 'Active Ventures', 'Heartside', '03b_Social-Schedule']
    const old = `{base}${sep}drive${sep}My Drive${sep}${OLD.join(sep)}`

    it('follows a renamed folder that the configured path no longer names', () => {
      const out = run(found(...NEW), old, (base) => mkdirSync(at(base, ...NEW), { recursive: true }))
      try {
        expect(out.error).toBeNull()
        expect(out.root).toBe(at(out.base, ...NEW))
        expect(out.problems).toEqual([])
        expect(out.log.join(' ')).toContain('found by its Drive ID')
      } finally { for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true }) }
    })

    it('follows a folder moved to another parent', () => {
      const moved = ['Archive', 'Heartside library']
      const out = run(found(...moved), old, (base) => mkdirSync(at(base, ...moved), { recursive: true }))
      try {
        expect(out.root).toBe(at(out.base, ...moved))
      } finally { for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true }) }
    })

    it('stops on a folder in the bin or deleted, names the problem, and makes nothing, even where the old path is still there', () => {
      for (const [problem, state] of [['heartside_library_trashed', 'gone'], ['heartside_library_gone', 'gone']] as const) {
        const out = run({ state, problem, drive_id: config.drive_id, reason: 'it was thrown away' }, old, (base) => mkdirSync(at(base, ...OLD), { recursive: true }))
        try {
          expect(out.root).toBeNull()
          expect(out.error).toContain('gone from Drive')
          expect(out.problems).toEqual([problem])
        } finally { for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true }) }
      }
    })

    it('stops with heartside_library_root_missing, and creates nothing, when the found folder is not on this drive', () => {
      const out = run(found(...NEW), old, () => {})
      try {
        expect(out.root).toBeNull()
        expect(out.problems).toEqual(['heartside_library_root_missing'])
        expect(spawnSync(process.execPath, ['-e', `process.exit(require('fs').existsSync(${JSON.stringify(at(out.base, ...NEW))}) ? 1 : 0)`]).status).toBe(0)
      } finally { for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true }) }
    })

    it('falls back to the configured folder when the engine cannot say, or names a path it cannot map', () => {
      for (const folder of [null, { state: 'unknown', drive_id: config.drive_id, reason: 'no delegation' }, found('..', 'Elsewhere'), { state: 'found', segments: ['Shared drives', 'X'] }]) {
        const out = run(folder, old, (base) => mkdirSync(at(base, ...OLD), { recursive: true }))
        try {
          expect(out.error).toBeNull()
          expect(out.root).toBe(at(out.base, ...OLD))
        } finally { for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true }) }
      }
    })

    it('keeps a per-machine setting that names a folder that is there ahead of everything', () => {
      const own = ['Own', 'Heartside']
      const out = run(found(...NEW), old, (base) => { mkdirSync(at(base, ...own), { recursive: true }); mkdirSync(at(base, ...NEW), { recursive: true }) }, at('{base}', ...own))
      try {
        expect(out.root).toBe(at(out.base, ...own))
      } finally { for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true }) }
    })
  })

  it('asks for and reports Heartside files by name, and never treats them as the brand kit', () => {
    expect(sync).toContain("$query += '&library=' + [uri]::EscapeDataString($Library)")
    expect(sync).toContain('$report.library = $Library')
    expect(sync).toContain("$isBrandKit = $Library -ne 'heartside' -and")
    expect(sync).toMatch(/catch \{\n\s+Write-Log "the Heartside library pass stopped/)
  })

  it('keeps its own clone up to date, as the recordings lane does', () => {
    expect(sync).toContain("$SourceFolderName = 'library-source'")
    expect(sync).toContain('pull --ff-only --quiet')
  })
})
