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
    for (const line of body.split('\n').filter((l) => /Save-JsonFile \$/.test(l))) expect(line).toMatch(/Save-JsonFile \$(StatePath|PlacingStatePath) /)
    expect(upload).toContain("$PlacingStatePath = Join-Path $StateRoot 'placing.json'")
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
    expect(fn('Test-Engine')).toContain("-like 'invalid_recording*'")
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

// The recordings lane's stage 1a (settled 2026-10-12): the home computers place
// every take on its piece and cut by themselves, at the end of every pass, on
// either machine. Krish, 2026-10-12: each recording "goes to the right place
// when recorded".
describe('it places each take on its piece and cut, at the end of every pass', () => {
  it('runs the matcher with the pinned Python bootstrap-python.ps1 builds, never the bare python', () => {
    expect(upload).toContain("$StudioPython = Join-Path $env:USERPROFILE 'Documents\\MindmakeVideoStudio\\runtime\\python\\Scripts\\python.exe'")
    const bootstrap = read('scripts/bootstrap-python.ps1')
    expect(bootstrap).toContain("Join-Path $env:USERPROFILE 'Documents\\MindmakeVideoStudio\\runtime'")
    expect(bootstrap).toContain("Join-Path $runtimeRoot 'python'")
    expect(bootstrap).toContain("Join-Path $venvPath 'Scripts\\python.exe'")
    expect(bootstrap).toMatch(/import faster_whisper/)
    expect(code(upload)).not.toMatch(/& python(\.exe)? /)
    expect(fn('Invoke-StudioPython')).toContain('& $StudioPython @Arguments 2>&1')
  })

  it('runs exactly recording_match.py --record --board --by "Recordings lane" --json', () => {
    expect(upload).toContain("$Matcher = Join-Path $RepoRoot 'scripts\\post-pack\\recording_match.py'")
    expect(upload).toContain("$MatchBy = 'Recordings lane'")
    expect(fn('Invoke-TakePlacing')).toContain("Invoke-StudioPython @($Matcher, '--record', '--board', '--by', $MatchBy, '--json')")
  })

  it('runs it only when the engine holds a take no piece claims and the answered book does not hold', () => {
    const match = read('scripts/post-pack/recording_match.py')
    expect(match).toContain("CACHE = REPO / '.cache' / 'recordings'")
    expect(match).toContain("ANSWERED = 'answered.json'")
    expect(upload).toContain("$AnsweredPath = Join-Path $RepoRoot '.cache\\recordings\\answered.json'")
    const place = fn('Invoke-TakePlacing')
    const listed = place.indexOf('Get-EngineTakes')
    const book = place.indexOf('Read-JsonFile $AnsweredPath')
    const gate = place.indexOf('if ($due.Count -eq 0) { return $true }')
    const run = place.indexOf('Invoke-StudioPython @($Matcher')
    expect(listed).toBeGreaterThan(-1)
    expect(book).toBeGreaterThan(listed)
    expect(gate).toBeGreaterThan(book)
    expect(run).toBeGreaterThan(gate)
    expect(place).toContain('-not $answered.ContainsKey($_) -and -not $state.claimed.ContainsKey($_)')
    expect(fn('Get-EngineTakes')).toContain("Invoke-StudioPython @($Lister, 'list', '--json')")
  })

  it('places after sending, and a problem placing never stops the sending', () => {
    const pass = fn('Invoke-Pass')
    const send = pass.indexOf('Sync-Recordings $inbox $base $token')
    const place = pass.indexOf('try { $placed = Invoke-TakePlacing }')
    expect(send).toBeGreaterThan(-1)
    expect(place).toBeGreaterThan(send)
    expect(pass).toContain('return ($sent -and $placed)')
  })

  it('in -Check, proves the pinned Python hears (faster_whisper, ffmpeg) and the engine key lists, and places nothing', () => {
    const test = fn('Test-TakePlacing')
    // A real decode, never an import alone: an unpinned pair imports and then fails on every take.
    expect(test).toContain("Invoke-StudioPython @($Matcher, '--check-transcriber')")
    expect(test).not.toContain("'import faster_whisper'")
    expect(test).toContain('Get-Command ffmpeg.exe')
    expect(test).toContain("Invoke-StudioPython @($Lister, 'list', '--json')")
    expect(test).toContain('scripts\\engine-key.ps1')
    expect(fn('Invoke-Pass')).toMatch(/if \(\$Check\) \{[\s\S]*?try \{\n\s+Test-TakePlacing/)
    const place = fn('Invoke-TakePlacing')
    expect(place.indexOf('if ($Check) {')).toBeGreaterThan(-1)
    expect(place.indexOf('if ($Check) {')).toBeLessThan(place.indexOf('Invoke-StudioPython @($Matcher'))
    expect(place.indexOf('Save-JsonFile $PlacingStatePath')).toBeGreaterThan(place.indexOf('Invoke-StudioPython @($Matcher'))
  })

  it('in -Check, a machine that sends but cannot place yet exits 3, never 1, so the sending is installed', () => {
    const pass = fn('Invoke-Pass')
    expect(pass).toContain('$script:PlacingNotReady = $_.Exception.Message')
    expect(pass).toContain('Sending is not affected.')
    expect(upload).toContain('if ($Check -and $script:PlacingNotReady -and $script:PassSent) { exit 3 }')
    expect(installer).toContain('[switch]$RequirePlacing')
    expect(installer).toMatch(/if \(\$checked -eq 3\) \{[\s\S]*?if \(\$RequirePlacing\) \{ throw[\s\S]*?\} elseif \(\$checked -ne 0\) \{\n\s+throw 'The check failed/)
  })

  it('a take the matcher left alone as old is looked at again six hours later, never booked for good', () => {
    expect(upload).toContain('$OldRetryMinutes = 360')
    expect(fn('Invoke-TakePlacing')).toContain("elseif ($looked[$sha] -eq 'old') { $later[$sha] = $now + 60 * $OldRetryMinutes }")
    const match = read('scripts/post-pack/recording_match.py')
    expect(match).toContain('A take left alone as "old" is not booked')
  })

  it('logs a problem placing once until it changes, and never shows a key', () => {
    expect(fn('Write-PlacingNote')).toContain('if ($Message -eq $script:LastPlacingNote) { return }')
    expect(code(upload)).not.toMatch(/ENGINE_OPERATOR_TOKEN|engine-operator-token/)
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

  it('says its check proves the engine key and the transcriber, as the upload\'s -Check does', () => {
    const intro = installer.slice(0, installer.indexOf('#>'))
    expect(intro).toContain('faster_whisper')
    expect(intro).toContain('scripts\\engine-key.ps1')
    expect(intro).toContain('recording_match.py')
  })

  it('leaves the runner\'s task, its checkout and the library sync alone', () => {
    for (const name of ['Mindmake Video Studio Runner', 'Mindmake Library Sync']) expect(installer).not.toContain(name)
    expect(code(installer)).not.toMatch(/runner-source|verify-runner-source|set-credential|library-sync/)
  })
})
