import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CONTROL_CENTER_RUNNER_CREDENTIAL } from '@mindmake/core'

// scripts/recordings-upload.ps1 and its installer, read as text: no PowerShell
// runs in this suite. It reads the Video Engine Inbox on Krish's runner
// machines, so what it may and may not do is pinned here.
//
// Krish, 2026-10-06, after a session told him it could not reach his file:
// "figure out how to never make that error again". Then: "How can you do this
// automatically in the future, and just use whichever machine is online at the
// time? the runner exists on both".

const ROOT = join(__dirname, '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n')
const upload = read('scripts/recordings-upload.ps1')
const installer = read('scripts/install-recordings-upload.ps1')
const code = (source: string) => source.slice(source.indexOf('#>') + 2)
const fn = (name: string) => {
  const start = upload.indexOf(`function ${name}(`) === -1 ? upload.indexOf(`function ${name} {`) : upload.indexOf(`function ${name}(`)
  expect(start, name).toBeGreaterThan(-1)
  const next = upload.indexOf('\nfunction ', start + 1)
  const end = upload.indexOf('\n# ---- one pass', start)
  return upload.slice(start, next === -1 ? end : Math.min(next, end === -1 ? Infinity : end))
}

describe('the recordings upload on Krish\'s runner machines', () => {
  it('is plain ASCII, as every PowerShell script here is, so Windows PowerShell reads it as written', () => {
    for (const source of [upload, installer]) expect([...source].filter((ch) => ch.charCodeAt(0) > 127)).toEqual([])
  })

  it('finds the Inbox from MINDMAKE_MEDIA_INBOX, else config/studio.json, else says so', () => {
    const resolve = fn('Resolve-MediaInbox')
    expect(resolve.indexOf('$env:MINDMAKE_MEDIA_INBOX')).toBeLessThan(resolve.indexOf("Get-Field $runtime 'media_inbox'"))
    expect(resolve).toContain("Get-Field $runtime 'drive_root'")
    expect(resolve).toContain("Join-Path $drive 'Inbox'")
    expect(fn('Invoke-Pass')).toContain("Write-Log 'no Inbox is set")
  })

  it('only reads the Inbox: nothing in it writes, moves, renames or deletes there', () => {
    const body = code(upload)
    expect(body).not.toMatch(/Rename-Item|Copy-Item|New-Item|Set-Content|Out-File|Clear-Content|Remove-Item|\[System\.IO\.(File|Directory)\]::(Copy|Move|Delete|Create\(|Replace|Append|SetAttributes)/)
    expect(body).not.toMatch(/FileAccess\]::(Write|ReadWrite)|FileMode\]::(Create|Append|Truncate|OpenOrCreate|CreateNew)/)
    expect(fn('Send-Upload')).toContain('[System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite')
    // What it writes: its log and its state, both under $StateRoot, beside the runner's folders.
    for (const line of body.split('\n').filter((l) => /Move-Item|Add-Content|WriteAllText/.test(l))) {
      expect(line).toMatch(/-LiteralPath \$(LogPath|temporary) |WriteAllText\(\$temporary,/)
    }
    for (const line of body.split('\n').filter((l) => /Save-JsonFile \$/.test(l))) expect(line).toMatch(/Save-JsonFile \$StatePath /)
    expect(upload).toContain("$StateRoot = Join-Path $env:USERPROFILE 'Documents\\MindmakeVideoStudio\\recordings-upload'")
  })

  it('never touches the library or Drive beyond reading the Inbox', () => {
    expect(code(upload)).not.toMatch(/library_root|MINDMAKE_LIBRARY_ROOT|\/api\/library\/(pending|written)/)
  })

  it('takes the recording types up to 500 MiB once they have settled, and logs and skips anything larger', () => {
    expect(upload).toContain("$RecordingExtensions = @('.mp4', '.mov', '.m4a', '.wav', '.mp3', '.mkv', '.webm')")
    expect(upload).toContain('$RecordingMaxBytes = 524288000')
    expect(upload).toContain('$RecordingSettleSeconds = 120')
    const lane = fn('Sync-Recordings')
    expect(lane).toContain("$key = '{0}|{1}|{2}' -f $name, $bytes, $ticks")
    expect(lane).toContain('if (-not $steady -and $age -lt $RecordingSettleSeconds) { continue }')
    expect(lane).toContain('over the 500 MiB the engine takes')
    expect(lane).toContain('changed while it was read')
  })

  it('asks for an upload URL, puts the bytes only to the library storage, then confirms', () => {
    const lane = fn('Sync-Recordings')
    const ask = lane.indexOf("'/api/library/recordings/upload-url'")
    const put = lane.indexOf('Send-Upload $uploader')
    const confirm = lane.indexOf("'/api/library/recordings/confirm'")
    expect(ask).toBeGreaterThan(-1)
    expect(put).toBeGreaterThan(ask)
    expect(confirm).toBeGreaterThan(put)
    expect(lane).toContain("$url.AbsolutePath.StartsWith('/storage/v1/object/upload/sign/content-library/recordings/')")
  })

  it('with both machines running, a duplicate refused by storage goes on to the confirm instead of failing', () => {
    expect(fn('Sync-Recordings')).toContain('-and $status -ne 400 -and $status -ne 409) { throw "the upload answered $status" }')
  })

  it('a failure on one file never stops the pass', () => {
    expect(fn('Sync-Recordings')).toMatch(/\} catch \{\n\s+\$result\.failed\+\+\n\s+Write-Log "could not send \$name/)
  })

  it('in -Check, proves the key and the route and sends nothing', () => {
    const lane = fn('Sync-Recordings')
    const check = lane.indexOf('if ($Check) { Write-Log "would send')
    expect(check).toBeGreaterThan(-1)
    expect(check).toBeLessThan(lane.indexOf('Get-Sha256'))
    expect(lane).toContain('if (-not $Check) { Save-JsonFile $StatePath')
    expect(fn('Test-Engine')).toContain("$answer.code -eq 'invalid_recording_request'")
  })

  it('takes the runner\'s own bearer the way the runner does, and never shows it', () => {
    expect(upload).toContain(`$RunnerCredential = '${CONTROL_CENTER_RUNNER_CREDENTIAL}'`)
    expect(upload).toMatch(/& powershell\.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File \$reader -Target \$RunnerCredential/)
    expect(code(upload)).not.toMatch(/Write-(Host|Output|Log)[^\n]*\$(Token|token)\b/)
  })

  it('reads the engine\'s address from scripts/engine.py, the one place it is written', () => {
    const pattern = /\[regex\]::Match\(\$helper, "([^"]+)"\)/.exec(upload)
    expect(pattern).not.toBeNull()
    expect(new RegExp(pattern![1]!).exec(read('scripts/engine.py'))?.[1]).toMatch(/^https:\/\/[a-z0-9.-]+$/)
    expect(upload).not.toMatch(/vercel\.app|supabase\.co/)
  })

  it('pulls its own clone before each pass, only when it is recordings-source, and ends when it has changed', () => {
    const update = fn('Update-Source')
    expect(update).toContain("if ((Split-Path -Leaf $RepoRoot) -ne $SourceFolderName) { return }")
    expect(upload).toContain("$SourceFolderName = 'recordings-source'")
    expect(update).toContain('pull --ff-only --quiet')
    const loop = upload.slice(upload.indexOf('while ($true) {'))
    expect(loop.indexOf('Update-Source')).toBeLessThan(loop.indexOf('Invoke-Pass'))
    expect(loop.indexOf("(Get-Sha256 $scriptPath) -ne $scriptSha")).toBeLessThan(loop.indexOf('Invoke-Pass'))
  })

  it('runs one at a time on a machine', () => {
    expect(upload).toContain("[System.Threading.Mutex]::new($false, 'Local\\MindmakeRecordingsUpload')")
  })
})

describe('its installer, for both runner machines', () => {
  it('runs only from the dedicated recordings-source clone, pulls it, checks, then registers a task every five minutes', () => {
    expect(installer).toContain("$sourceFolder = 'recordings-source'")
    const pull = installer.indexOf('pull --ff-only', installer.indexOf('#>'))
    const check = installer.indexOf('-File $uploadScript -Check')
    const register = installer.indexOf('Register-ScheduledTask')
    expect(pull).toBeGreaterThan(installer.indexOf('#>'))
    expect(check).toBeGreaterThan(pull)
    expect(register).toBeGreaterThan(check)
    expect(installer).toContain("[string]$TaskName = 'Mindmake Recordings Upload'")
    expect(installer).toContain('[ValidateRange(2, 60)][int]$EveryMinutes = 5')
    expect(installer).toContain('-WindowStyle Hidden -File `"$uploadScript`" -Loop -EveryMinutes $EveryMinutes')
    expect(installer).toContain('-LogonType Interactive -RunLevel Limited')
    expect(installer).toContain('-MultipleInstances IgnoreNew')
  })

  it('leaves the runner\'s task, its checkout and the library sync alone', () => {
    for (const name of ['Mindmake Video Studio Runner', 'Mindmake Library Sync']) expect(installer).not.toContain(name)
    expect(code(installer)).not.toMatch(/runner-source|verify-runner-source|set-credential|library-sync/)
  })
})
