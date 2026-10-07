import { readFileSync } from 'node:fs'
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

describe('the library sync on Krish\'s machine', () => {
  it('is plain ASCII, as every PowerShell script here is, so Windows PowerShell reads it as written', () => {
    for (const source of [sync, installer]) expect([...source].filter((ch) => ch.charCodeAt(0) > 127)).toEqual([])
  })

  it('finds the library from MINDMAKE_LIBRARY_ROOT, else runtime.library_root in config/studio.json', () => {
    expect(sync).toContain('$env:MINDMAKE_LIBRARY_ROOT')
    expect(sync).toContain("Get-Field $runtime 'library_root'")
  })

  it('refuses a library root that overlaps the Studio\'s Video Engine folders', () => {
    for (const name of ['drive_root', 'media_inbox', 'archive_root']) expect(sync).toContain(`Get-Field $runtime '${name}'`)
    for (const name of ['MINDMAKE_DRIVE_ROOT', 'MINDMAKE_MEDIA_INBOX', 'MINDMAKE_ARCHIVE_ROOT']) expect(sync).toContain(`$env:${name}`)
    expect(sync).toMatch(/Test-SamePath \$root \$folder\) -or \(Test-Inside \$root \$folder\) -or \$underWritten/)
    // Video Engine may sit inside the library folder, never inside a folder the sync writes to (2026-10-07).
    expect(sync).toMatch(/\$TopFolders \| Where-Object \{ \$top = Join-Path \$root \$_/)
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
