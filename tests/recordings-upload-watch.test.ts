import { execFileSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
    expect(keeper).toContain("foreach ($name in @('last_run_at', 'counts', 'stage', 'stage_at', 'task_state', 'task_result', 'head'))")
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
$wanted = @('Get-Field', 'Read-JsonFile', 'ConvertTo-UtcTime', 'Read-WatchLogLine', 'Update-Watcher', 'Invoke-WatchKeeper', 'Get-WatchBlock')
foreach ($f in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)) {
  if ($wanted -contains $f.Name) { . ([ScriptBlock]::Create($f.Extent.Text)) }
}
$WatchTaskName = 'Mindmake Content Watcher (not installed on CI)'
$WatchQuietMinutes = 6; $WatchStuckMinutes = 25; $WatchDownMinutes = 15; $WatchTimeLimit = 'PT30M'
$script:Watch = $null; $script:WatchStartedAt = $null
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
})
