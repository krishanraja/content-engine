import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))
const { LANE_PROBLEMS } = await import('../apps/control-plane/api/library/_lanes.js')

// The recordings pass keeps the content watcher on the same machine running and up to date, and sends its health
// with its own report (scripts/recordings-upload.ps1, Invoke-WatchKeeper). Krish, 2026-10-28:
// "i should never really need to copy and paste log files to you like this, ever, this is ridiculous".

const ROOT = join(__dirname, '..')
const SCRIPT = join(ROOT, 'scripts', 'recordings-upload.ps1')
const upload = readFileSync(SCRIPT, 'utf8').replace(/\r\n/g, '\n')

describe('the content watcher keeper in the recordings pass', () => {
  it('reports only problems the engine knows, or the engine refuses the whole report', () => {
    const codes = [...upload.matchAll(/Add-Problem '([a-z_]+)'/g)].map(m => m[1]!)
    expect(codes).toContain('watch_not_installed')
    for (const code of codes) expect(Object.keys(LANE_PROBLEMS), code).toContain(code)
  })

  it('never stops a recordings pass, and sends counts and class names only', () => {
    expect(upload).toContain('try { Invoke-WatchKeeper } catch { Write-Log "the content watcher was not checked this pass')
    const keeper = upload.slice(upload.indexOf('# ---- the content watcher on this machine'), upload.indexOf('function Send-LaneReport {'))
    expect(keeper).not.toMatch(/Remove-Item|Rename-Item|Copy-Item|Set-Content|Out-File|Unregister-ScheduledTask/)
    expect(keeper).toContain("foreach ($name in @('last_run_at', 'counts', 'recent', 'stage', 'stage_at', 'task_state', 'task_result', 'head'))")
  })

  // Real Windows PowerShell, on the Windows CI machine only: the whole script parses, and the keeper runs.
  it.runIf(process.platform === 'win32')('parses in Windows PowerShell, and reads the watcher and its log as the engine expects', () => {
    const home = mkdtempSync(join(tmpdir(), 'cw-'))
    mkdirSync(join(home, 'content-watcher'))
    writeFileSync(join(home, 'content-watcher', 'watch.log'),
      '2026-10-26T07:58:23Z {"claimed":0,"seconds":0}\n2026-10-26T07:59:23Z {"claimed":0,"engine.engine_tls_untrusted":1,"seconds":0}\n')
    writeFileSync(join(home, 'content-watcher', 'watch.heartbeat'), '{"at":"2026-10-26T07:59:23Z","stage":"done","pid":1}')
    const command = `
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile('${SCRIPT.replace(/'/g, "''")}', [ref]$tokens, [ref]$errors)
if ($errors.Count) { foreach ($e in $errors) { Write-Output ('PARSE ' + $e.Message) }; exit 2 }
$wanted = @('Get-Field', 'Read-JsonFile', 'ConvertTo-UtcTime', 'Read-WatchLogLine', 'Read-WatchRecent', 'Update-Watcher', 'Invoke-WatchKeeper', 'Get-WatchBlock',
  'Test-WatcherClone', 'Find-WatcherClone', 'Repair-WatchTask')
foreach ($f in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)) {
  if ($wanted -contains $f.Name) { . ([ScriptBlock]::Create($f.Extent.Text)) }
}
$WatchTaskName = 'Mindmake Content Watcher (not installed on CI)'
$WatchQuietMinutes = 6; $WatchStuckMinutes = 25; $WatchDownMinutes = 15; $WatchTimeLimit = 'PT30M'
$WatchRepairEveryMinutes = 60; $WatchBadDirectory = 2147942667
$script:Watch = $null; $script:WatchStartedAt = $null; $script:WatchRepairAt = $null; $script:WatchRepairOutcome = $null
$script:Problems = New-Object System.Collections.Generic.List[string]
function Add-Problem([string]$Code) { if (-not $script:Problems.Contains($Code)) { $script:Problems.Add($Code) } }
function Write-Log([string]$Message) { }
$env:LOCALAPPDATA = '${home.replace(/'/g, "''")}'
Invoke-WatchKeeper
$line = Read-WatchLogLine
[ordered]@{ problems = @($script:Problems); at = $line.at; counts = $line.counts; utc = (ConvertTo-UtcTime $line.at).ToString('s'); block = (Get-WatchBlock) } | ConvertTo-Json -Depth 5 -Compress
`
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8' })
    const result = JSON.parse(out.trim().split(/\r?\n/).pop()!)
    expect(result.problems).toEqual(['watch_not_installed'])
    expect(result.at).toBe('2026-10-26T07:59:23Z')
    expect(result.counts).toEqual({ claimed: 0, 'engine.engine_tls_untrusted': 1, seconds: 0 })
    expect(result.utc).toBe('2026-10-26T07:59:23')
    expect(result.block).toEqual({ repaired: [] })
  })

  it.runIf(process.platform === 'win32')('sums the last six hours of runs, by class, and leaves older runs out', () => {
    const home = mkdtempSync(join(tmpdir(), 'cwr-'))
    mkdirSync(join(home, 'content-watcher'))
    const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString().slice(0, 19) + 'Z'
    writeFileSync(join(home, 'content-watcher', 'watch.log'), [
      `${at(600)} {"claimed":1,"failed.other":1,"seconds":3}`,
      `${at(30)} {"claimed":2,"failed.other":1,"method.instagram_embed.blocked":1,"read":1,"seconds":40}`,
      `${at(29)} {"claimed":1,"failed.other":1,"seconds":2}`,
      `${at(1)} {"claimed":0,"seconds":0}`,
      'not a log line',
    ].join('\n') + '\n')
    const command = `
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile('${SCRIPT.replace(/'/g, "''")}', [ref]$tokens, [ref]$errors)
foreach ($f in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)) {
  if (@('ConvertTo-UtcTime', 'Read-WatchRecent') -contains $f.Name) { . ([ScriptBlock]::Create($f.Extent.Text)) }
}
$env:LOCALAPPDATA = '${home.replace(/'/g, "''")}'
Read-WatchRecent | ConvertTo-Json -Compress
`
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8' })
    expect(JSON.parse(out.trim().split(/\r?\n/).pop()!)).toEqual({ claimed: 3, 'failed.other': 2, 'method.instagram_embed.blocked': 1, read: 1 })
  })

  // Both machines, 28 October 2026: the task answered 0x8007010B, "The directory name is invalid", after the
  // repository was renamed from video-compression to content-watcher. The keeper finds the clone where it is now.
  it.runIf(process.platform === 'win32')('finds the watcher clone after its folder was renamed, and only a real clone', () => {
    const root = mkdtempSync(join(tmpdir(), 'cwdev-'))
    const dev = join(root, 'dev')
    const moved = join(dev, 'mindmake', 'content-watcher')
    for (const dir of [join(moved, 'content_watcher'), join(moved, 'scripts'), join(dev, 'other', 'video-compression')]) mkdirSync(dir, { recursive: true })
    writeFileSync(join(moved, 'content_watcher', 'watch.py'), '')
    writeFileSync(join(moved, 'scripts', 'install-content-watch.ps1'), '')
    const command = `
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile('${SCRIPT.replace(/'/g, "''")}', [ref]$tokens, [ref]$errors)
foreach ($f in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)) {
  if (@('Test-WatcherClone', 'Find-WatcherClone') -contains $f.Name) { . ([ScriptBlock]::Create($f.Extent.Text)) }
}
$env:USERPROFILE = '${root.replace(/'/g, "''")}'
$RepoRoot = '${join(root, 'elsewhere', 'recordings-source').replace(/'/g, "''")}'
[ordered]@{
  moved = Find-WatcherClone '${join(dev, 'mindmake', 'video-compression').replace(/'/g, "''")}'
  unknown = Find-WatcherClone ''
  empty = Test-WatcherClone '${join(dev, 'other', 'video-compression').replace(/'/g, "''")}'
} | ConvertTo-Json -Compress
`
    const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command], { encoding: 'utf8' })
    const result = JSON.parse(out.trim().split(/\r?\n/).pop()!)
    // The temp folder can come back in its short 8.3 form (RUNNER~1) and PowerShell answers the long one: same folder.
    const real = (p: string) => realpathSync.native(p).toLowerCase()
    expect(real(result.moved)).toBe(real(moved))
    expect(real(result.unknown)).toBe(real(moved))
    expect(result.empty).toBe(false)
  })
})
