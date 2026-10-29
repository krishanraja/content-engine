import { spawnSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../apps/control-plane/api/_supabase.js', () => ({ supabase: {} }))
const { LANE_PROBLEMS, PREFLIGHT_CHECKS, parseLaneReport } = await import('../apps/control-plane/api/library/_lanes.js')

// The Saturday overnight preflight on a home computer (scripts/overnight/preflight.ps1), run by the recordings pass
// once each Saturday after 18:00 local (plan Wave 1, the clock's "Sat 18:00 Preflight" row). It proves, a week before
// the overnight runner exists, whether a machine could run it unattended, and it must never edit, send or spend.
// Krish, 2026-10-28: "HIDE ALL CONSOLE POP UPS FOREVER FROM EVERY REPO AND LOCAL TASK".

const ROOT = join(__dirname, '..')
const SCRIPT = join(ROOT, 'scripts', 'overnight', 'preflight.ps1')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n')
const preflight = read('scripts/overnight/preflight.ps1')
const upload = read('scripts/recordings-upload.ps1')
const profile = JSON.parse(read('scripts/overnight/preflight-profile.json'))
// What the script runs, with its help block and its comment lines taken out.
const code = preflight.slice(preflight.indexOf('#>') + 2).split('\n').filter((line) => !/^\s*#/.test(line)).join('\n')
const fn = (source: string, name: string) => {
  const start = source.search(new RegExp(`\\nfunction ${name}\\b`))
  expect(start, name).toBeGreaterThan(-1)
  const next = source.indexOf('\nfunction ', start + 1)
  const section = source.indexOf('\n# ----', start + 1)
  const ends = [next, section].filter((n) => n > -1)
  return source.slice(start, ends.length ? Math.min(...ends) : undefined)
}
const ps = (path: string) => path.replace(/'/g, "''")
function powershell(dir: string, script: string): Record<string, any> {
  const file = join(dir, 'test.ps1')
  writeFileSync(file, '\ufeff' + script, 'utf8')
  const run = spawnSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file],
    { encoding: 'utf8', windowsHide: true, timeout: 240_000 })
  return JSON.parse(String(run.stdout).trim().split(/\r?\n/).pop()!)
}

// Every program the preflight starts, exactly. A new one is added here on purpose, after reading what it does.
const RUNS = [
  "Invoke-Quiet $Claude @('--version') 30",
  'Invoke-Quiet $Claude $arguments $ClaudeTimeoutSeconds',
  "Invoke-Quiet $node @($companion, 'help') 30",
  "Invoke-Quiet $codex @('login', 'status') 30",
  "Invoke-Quiet $python ($prefix + @($audit, '--codex', '--json')) 120 @{ PYTHONUTF8 = '1'; PYTHONIOENCODING = 'utf-8' }",
  "Invoke-Quiet $ffmpeg @('-version') 30",
  "Invoke-Quiet $tesseract @('--version') 30",
]
const CHECKS = ['claude_cli', 'claude_headless', 'codex_companion', 'codex_login', 'codex_allowance', 'ffmpeg', 'tesseract', 'disk', 'drive']
const WRITES = /\b(Set-Content|Add-Content|Out-File|New-Item|Remove-Item|Move-Item|Copy-Item|Rename-Item|Clear-Content|Set-Item|Set-ItemProperty|New-ItemProperty|Remove-ItemProperty|Tee-Object|Export-[A-Za-z]+|Start-Process|Stop-Process|Invoke-Expression|Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|Send-MailMessage|Register-ScheduledTask|Set-ScheduledTask|Unregister-ScheduledTask|Start-ScheduledTask|Stop-ScheduledTask|Enable-ScheduledTask|Disable-ScheduledTask|Save-JsonFile|Send-Engine|Invoke-Engine|Send-LaneReport)\b/i
// File and Directory only for reading; no environment setting kept, no network client, no process ended by .Kill.
const NET_WRITES = /\[(System\.IO\.)?(File|Directory|FileInfo|DirectoryInfo)\]::(?!(ReadAllText|ReadAllLines|Exists)\b)\w+|::SetEnvironmentVariable\b|\b(HttpClient|WebClient|WebRequest|TcpClient|UploadString|UploadFile|SendAsync|PostAsync|PutAsync)\b|FileMode\]::|FileAccess\]::(Write|ReadWrite)|\$env:[A-Za-z_]+\s*=(?!=)|\.Kill\(/
const FORBIDDEN_ARGUMENTS = /dangerously|bypassPermissions'|'task'|'exec'|'push'|'send'|'publish'|'post'|'deploy'|'upload'|'login', '(?!status)/

describe('the overnight preflight on a home computer', () => {
  it('is plain ASCII, as every PowerShell script here is, so Windows PowerShell reads it as written', () => {
    for (const source of [preflight, read('scripts/overnight/preflight-profile.json')]) {
      expect([...source].filter((ch) => ch.charCodeAt(0) > 127)).toEqual([])
    }
  })

  it('calls no command that writes, sends, schedules or spends', () => {
    expect(code).not.toMatch(WRITES)
    expect(code).not.toMatch(NET_WRITES)
    // The only call operator runs a check's own script block; every program starts through Invoke-Quiet.
    expect([...code.matchAll(/(?:^|[\s(;{])&\s*(\S+)/gm)].map((m) => m[1])).toEqual(['$Body'])
    expect(code.match(/\[System\.Diagnostics\.Process\]::Start\(/g)).toHaveLength(2)
    const quiet = fn(preflight, 'Invoke-Quiet')
    expect(quiet.match(/\[System\.Diagnostics\.Process\]::Start\(/g)).toHaveLength(2)
    // A program still running at its time limit is ended by its own process id, with what it started, and nothing else.
    expect(quiet).toContain('"/PID $($process.Id) /T /F"')
  })

  it('starts exactly these programs, with these arguments, and never the Codex companion\'s task route', () => {
    const runs = [...code.matchAll(/\$run = (Invoke-Quiet .+)$/gm)].map((m) => m[1])
    expect(runs).toEqual(RUNS)
    expect(code.match(/Invoke-Quiet /g)).toHaveLength(RUNS.length)
    for (const run of runs) expect(run).not.toMatch(FORBIDDEN_ARGUMENTS)
    // The companion reads help only as its first word: "task --help" would start a real Codex task and spend.
    expect(code).not.toMatch(/\$companion,\s*'task'/)
    expect(preflight).toContain('Never "task --help"')
  })

  it('runs every program with no window, its input closed and its output read here', () => {
    const quiet = fn(preflight, 'Invoke-Quiet')
    for (const line of ['$start.UseShellExecute = $false', '$start.CreateNoWindow = $true', '$start.RedirectStandardInput = $true',
      '$start.RedirectStandardOutput = $true', '$start.RedirectStandardError = $true', '$process.StandardInput.Close()',
      '$end.CreateNoWindow = $true']) expect(quiet).toContain(line)
    // Never the Store's stand-in python.exe under WindowsApps, which opens a window when Python is missing.
    expect(fn(preflight, 'Find-Program')).toContain("if ($folder -match '\\\\WindowsApps\\\\?$') { continue }")
  })

  it('runs one headless Claude turn with the preflight profile: no tools, dontAsk, bypass disabled, no session kept', () => {
    const headless = code.slice(code.indexOf("Invoke-Check 'claude_headless'"), code.indexOf("Invoke-Check 'codex_companion'"))
    const args = /\$arguments = @\(([\s\S]+?)\)\n/.exec(headless)![1]!
    for (const part of ["'-p'", "'--output-format', 'stream-json', '--verbose'", "'--model', $Model", "'--permission-mode', 'dontAsk'",
      "'--settings', $ProfilePath", "'--tools', ''", "'--no-session-persistence'"]) expect(args).toContain(part)
    expect(args).not.toMatch(/dangerously|bypass|--allowedTools|--add-dir|--mcp-config/i)
    expect(preflight).toContain("[string]$Model = 'haiku'")
    expect(headless).toContain("if ($result.permission_mode -eq 'bypassPermissions' -or -not $result.permission_mode)")
    expect(headless).toContain("[string](Get-Field $init 'permissionMode')")
    expect(headless).toContain("@(Get-Field $init 'mcp_servers')")
    expect(profile).toEqual({
      permissions: {
        defaultMode: 'dontAsk',
        disableBypassPermissionsMode: 'disable',
        deny: ['Bash', 'Edit', 'Write', 'NotebookEdit', 'WebFetch', 'WebSearch'],
      },
    })
  })

  it('reads the pinned tools and the allowance ceiling from the one place each is written', () => {
    const pinned = fn(preflight, 'Get-PinnedTools')
    const pattern = (name: string) => new RegExp(/\[regex\]::Match\(\$text, '([^']+)'\)/g.exec(pinned.slice(pinned.indexOf(`$${name} = `)))![1]!)
    const env = read('scripts/ve-env.sh')
    expect(pattern('default').exec(env)?.[1]).toBe('/c/Users/krish/dev/mindmake/toolchain')
    const path = pattern('path').exec(env)?.[1]
    expect(path).toBeTruthy()
    const build = /ffmpeg-(n[0-9.]+-[0-9]+-g[0-9a-f]+)/.exec(path!)?.[1]
    expect(build).toBe('n8.1.2-53-g1005b294ff')
    expect(pinned).toContain("'ffmpeg-(n[0-9.]+-[0-9]+-g[0-9a-f]+)'")
    expect(path!.split(':').some((entry) => /Tesseract/.test(entry))).toBe(true)
    const ceiling = /'\(\?m\)\^ALLOWANCE_CEILING = \(\\d\+\)'/.test(code)
    expect(ceiling).toBe(true)
    expect(/^ALLOWANCE_CEILING = (\d+)/m.exec(read('scripts/velib/cards.py'))?.[1]).toBe('80')
    // The companion ve dispatch picks, and the flags it passes.
    expect(read('scripts/velib/cards.py')).toContain("'openai-codex' / 'codex' / '*' / 'scripts' / 'codex-companion.mjs'")
    expect(preflight).toContain("$CompanionRoot = Join-Path $env:USERPROFILE '.claude\\plugins\\cache\\openai-codex\\codex'")
    expect(read('scripts/velib/cards.py')).toMatch(/'task', '--fresh', '--write', '--model', .+, '--effort'/)
  })

  it('runs these checks, and its report carries the fields the engine keeps and nothing else', () => {
    expect([...code.matchAll(/^Invoke-Check '([a-z_]+)'/gm)].map((m) => m[1])).toEqual(CHECKS)
    expect([...PREFLIGHT_CHECKS]).toEqual([...CHECKS, 'preflight_stopped'])
    const report = code.slice(code.indexOf('$report = [ordered]@{'), code.indexOf('$result = [ordered]@{', code.indexOf('$report = [ordered]@{')))
    const fields = [...report.matchAll(/^ {2}([a-z_]+) = /gm)].map((m) => m[1]).sort()
    const block = fn(upload, 'Get-PreflightBlock')
    const forwarded = [...block.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).filter((name) => !['report', 'name', 'status'].includes(name!))
    expect([...new Set(forwarded)].sort()).toEqual(fields)
    const parsed = parseLaneReport({ machine: 'SURFACE', problems: [], preflight: Object.fromEntries(fields.map((f) => [f!, null])) }, new Date(0).toISOString())
    expect(parsed).not.toHaveProperty('preflight')  // no ok, no block
    const kept = parseLaneReport({ machine: 'SURFACE', problems: [], preflight: { ok: true } }, new Date(0).toISOString())!.preflight!
    expect(Object.keys(kept).sort()).toEqual(fields)
  })

  it('never gives the engine a path, a message or an account', () => {
    const report = code.slice(code.indexOf('$report = [ordered]@{'), code.indexOf('$result = [ordered]@{', code.indexOf('$report = [ordered]@{')))
    expect(report).toContain('codex_weekly_used_pct = ')
    expect(report).not.toMatch(/detail|plan|credits|\$RepoRoot|\$ProfilePath|machine/)
    // codex login status can name the account; the check keeps only whether it says ChatGPT.
    const login = code.slice(code.indexOf("Invoke-Check 'codex_login'"), code.indexOf("Invoke-Check 'codex_allowance'"))
    expect(login).toContain('-match \'ChatGPT\'')
    expect(login).not.toMatch(/detail = "[^"]*\$\(\$run\.(out|err)\)/)
  })
})

describe('the preflight in the lane report', () => {
  it('keeps the preflight block by its shape and drops anything else', () => {
    const report = parseLaneReport({
      machine: 'SURFACE', problems: ['preflight_failed'],
      preflight: {
        at: '2026-10-31T18:02:11Z', ok: false, failed: ['codex_allowance', 'made_up', 'codex_allowance'],
        claude_version: '2.1.312', permission_mode: 'dontAsk', auth: 'none',
        mcp_servers: [{ name: 'mindmake-studio', status: 'connected' }, { name: 'claude.ai Gmail', status: 'needs-auth' },
          { name: 'C:\\Users\\krish\\x', status: 'connected' }, { name: 'ok', status: 'Has Spaces' }, 'stray'],
        codex_companion: '1.0.6', codex_login: true, codex_weekly_used_pct: 86.04, codex_resets_at: '2026-11-02T09:00:00Z',
        ffmpeg: 'n8.1.2-53-g1005b294ff', tesseract: '5.4.0.20240606', free_gb: 212.4, drive_reachable: 4, drive_folders: 4,
        detail: 'a whole message', path: 'C:\\Users\\krish',
      },
    }, new Date(0).toISOString())!
    expect(report.problems).toEqual(['preflight_failed'])
    expect(report.preflight).toEqual({
      at: '2026-10-31T18:02:11Z', ok: false, failed: ['codex_allowance'],
      claude_version: '2.1.312', permission_mode: 'dontAsk', auth: 'none',
      mcp_servers: [{ name: 'mindmake-studio', status: 'connected' }, { name: 'claude.ai Gmail', status: 'needs-auth' }],
      codex_companion: '1.0.6', codex_login: true, codex_weekly_used_pct: 86, codex_resets_at: '2026-11-02T09:00:00Z',
      ffmpeg: 'n8.1.2-53-g1005b294ff', tesseract: '5.4.0.20240606', free_gb: 212.4, drive_reachable: 4, drive_folders: 4,
    })
    expect(LANE_PROBLEMS.preflight_failed).toMatch(/overnight preflight/)
  })

  it('keeps every MCP server a Claude Code with all its connectors loads (51 measured on 28 October 2026)', () => {
    const servers = Array.from({ length: 60 }, (_, i) => ({ name: `plugin:sales:server ${i}`, status: i % 2 ? 'needs-auth' : 'connected' }))
    const report = parseLaneReport({ machine: 'A', problems: [], preflight: { ok: true, mcp_servers: servers } }, new Date(0).toISOString())!
    expect(report.preflight?.mcp_servers).toEqual(servers)
  })

  it('never reads a block that names a failed check as passed', () => {
    const report = parseLaneReport({ machine: 'A', problems: [], preflight: { ok: true, failed: ['drive'] } }, new Date(0).toISOString())!
    expect(report.preflight?.ok).toBe(false)
    expect(parseLaneReport({ machine: 'A', problems: [], preflight: { ok: 'yes' } }, new Date(0).toISOString())).not.toHaveProperty('preflight')
  })

  it('is run by the recordings pass outside a check, never stops a pass, and is kept beside its log', () => {
    const pass = upload.slice(upload.indexOf('  if (-not $Check) {\n'), upload.indexOf('function Publish-Music {'))
    expect(pass).toContain('try { Invoke-Preflight } catch { Write-Log "the Saturday overnight preflight did not run this pass')
    expect(pass.indexOf('Invoke-Preflight')).toBeLessThan(pass.indexOf('Send-LaneReport'))
    expect(upload).toContain("$PreflightScript = Join-Path $RepoRoot 'scripts\\overnight\\preflight.ps1'")
    expect(upload).toContain("$PreflightStatePath = Join-Path $StateRoot 'preflight.json'")
    expect(upload).toContain('$PreflightHour = 18')
    expect(upload).toContain('$PreflightRetryMinutes = 20')
    const run = fn(upload, 'Invoke-Preflight')
    // From this hidden pass, in Windows PowerShell, the way the runner key is read: no window of its own.
    expect(run).toContain('& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $PreflightScript -RepoRoot $RepoRoot 2>$null')
    expect(run).toContain('Save-JsonFile $PreflightStatePath $result')
    expect(run).toContain("Add-Problem 'preflight_failed'")
    expect(fn(upload, 'Send-LaneReport')).toContain("if ($null -ne $preflight) { $report['preflight'] = $preflight }")
    const due = fn(upload, 'Test-PreflightDue')
    expect(due).toContain('if ($Now.DayOfWeek -ne [DayOfWeek]::Saturday -or $Now.Hour -lt $PreflightHour) { return $false }')
    expect(due).toContain("[int](Get-Field $Last 'attempt') -ge 2")
  })

  // Real Windows PowerShell, on the Windows CI machine only.
  it.runIf(process.platform === 'win32')('parses in Windows PowerShell, and calls only reading commands and its own functions', () => {
    const home = mkdtempSync(join(tmpdir(), 'pf-'))
    const result = powershell(home, `
$ErrorActionPreference = 'Stop'
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile('${ps(SCRIPT)}', [ref]$tokens, [ref]$errors)
$commands = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.CommandAst] }, $true) | ForEach-Object { $_.GetCommandName() } | Where-Object { $_ } | Sort-Object -Unique)
$members = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.InvokeMemberExpressionAst] }, $true) | ForEach-Object { $_.Member.Extent.Text } | Sort-Object -Unique)
$functions = @($ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true) | ForEach-Object { $_.Name })
[ordered]@{ errors = @($errors | ForEach-Object { $_.Message }); commands = $commands; members = $members; functions = $functions } | ConvertTo-Json -Compress
`)
    expect(result.errors).toEqual([])
    const allowed = new Set([...result.functions, 'Set-StrictMode', 'Split-Path', 'Join-Path', 'ForEach-Object', 'Where-Object', 'Select-Object',
      'New-Object', 'Test-Path', 'Get-ChildItem', 'ConvertFrom-Json', 'ConvertTo-Json', 'Write-Output'])
    expect(result.commands.filter((name: string) => !allowed.has(name))).toEqual([])
    expect(result.members.filter((name: string) => /^(WriteAll\w*|AppendAll\w*|CreateDirectory|CreateText|Delete|Move|Copy|SetEnvironmentVariable|OpenWrite|Kill|Upload\w*|SendAsync|PostAsync|PutAsync)$/.test(name))).toEqual([])
  }, 240_000)

  it.runIf(process.platform === 'win32')('runs on Saturdays from 18:00, once, and once more 20 minutes after a failure', () => {
    const home = mkdtempSync(join(tmpdir(), 'pf-'))
    const result = powershell(home, `
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$tokens = $null; $errors = $null
$ast = [System.Management.Automation.Language.Parser]::ParseFile('${ps(join(ROOT, 'scripts', 'recordings-upload.ps1'))}', [ref]$tokens, [ref]$errors)
if ($errors.Count) { foreach ($e in $errors) { Write-Output ('PARSE ' + $e.Message) }; exit 2 }
foreach ($f in $ast.FindAll({ param($n) $n -is [System.Management.Automation.Language.FunctionDefinitionAst] }, $true)) {
  if (@('Get-Field', 'ConvertTo-UtcTime', 'Test-PreflightDue') -contains $f.Name) { . ([ScriptBlock]::Create($f.Extent.Text)) }
}
$PreflightHour = 18; $PreflightRetryMinutes = 20
$sat = New-Object DateTime(2026, 10, 31, 18, 0, 0, [DateTimeKind]::Local)
function Stamp([DateTime]$t) { $t.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [System.Globalization.CultureInfo]::InvariantCulture) }
$failed = [pscustomobject]@{ local_date = '2026-10-31'; ok = $false; attempt = 1; at = (Stamp $sat.AddMinutes(5)) }
$passed = [pscustomobject]@{ local_date = '2026-10-31'; ok = $true; attempt = 1; at = (Stamp $sat.AddMinutes(5)) }
$twice = [pscustomobject]@{ local_date = '2026-10-31'; ok = $false; attempt = 2; at = (Stamp $sat.AddMinutes(5)) }
$lastWeek = [pscustomobject]@{ local_date = '2026-10-24'; ok = $true; attempt = 1; at = (Stamp $sat.AddDays(-7)) }
[ordered]@{
  before_six = (Test-PreflightDue $null $sat.AddMinutes(-1)); at_six = (Test-PreflightDue $null $sat)
  friday = (Test-PreflightDue $null $sat.AddDays(-1)); sunday = (Test-PreflightDue $null $sat.AddDays(1))
  passed = (Test-PreflightDue $passed $sat.AddHours(2)); failed_soon = (Test-PreflightDue $failed $sat.AddMinutes(15))
  failed_later = (Test-PreflightDue $failed $sat.AddMinutes(30)); twice = (Test-PreflightDue $twice $sat.AddHours(3))
  last_week = (Test-PreflightDue $lastWeek $sat.AddHours(1))
} | ConvertTo-Json -Compress
`)
    expect(result).toEqual({
      before_six: false, at_six: true, friday: false, sunday: false, passed: false,
      failed_soon: false, failed_later: true, twice: false, last_week: true,
    })
  }, 240_000)

  it.runIf(process.platform === 'win32')('runs end to end with no window, writes nothing, and reports what the engine keeps', () => {
    const home = mkdtempSync(join(tmpdir(), 'pf-'))
    // The CI machine's pinned ffmpeg (ci.yml) stands in for the toolchain, so the ffmpeg check runs for real.
    const bin = (process.env.PATH || '').split(';').find((p) => /ffmpeg-n8\.1\.2-[^\\]*-win64-gpl-8\.1\\bin\\?$/i.test(p))
    const toolchain = bin ? dirname(dirname(bin.replace(/\\$/, ''))) : ''
    const result = powershell(home, `
$ErrorActionPreference = 'Stop'
Add-Type @"
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public static class PreflightProbe {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  public static long[] Consoles() {
    List<long> found = new List<long>();
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (IsWindowVisible(h)) {
        StringBuilder name = new StringBuilder(256);
        GetClassName(h, name, 256);
        string c = name.ToString();
        if (c == "ConsoleWindowClass" || c == "CASCADIA_HOSTING_WINDOW_CLASS") found.Add(h.ToInt64());
      }
      return true;
    }, IntPtr.Zero);
    return found.ToArray();
  }
}
"@
function Watch-Run($Process, [int]$Seconds) {
  $seen = New-Object System.Collections.Generic.HashSet[long]
  $until = [DateTime]::UtcNow.AddSeconds($Seconds)
  while ([DateTime]::UtcNow -lt $until -and -not $Process.HasExited) {
    foreach ($w in [PreflightProbe]::Consoles()) { if ($before -notcontains $w) { [void]$seen.Add($w) } }
    Start-Sleep -Milliseconds 200
  }
  [void]$Process.WaitForExit(30000)
  return $seen.Count
}
# The control: a console program started the way that opens a window. The probe has to see it.
$before = @([PreflightProbe]::Consoles())
$control = Watch-Run (Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\\cmd.exe') -ArgumentList '/c ping -n 5 127.0.0.1 >nul' -WindowStyle Normal -PassThru) 8
# The preflight, started as the hidden recordings pass starts it, in a home with nothing installed.
$before = @([PreflightProbe]::Consoles())
$start = New-Object System.Diagnostics.ProcessStartInfo
$start.FileName = Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe'
$start.Arguments = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${SCRIPT}" -RepoRoot "${ROOT}" -ClaudeTimeoutSeconds 60'
$start.UseShellExecute = $false
$start.CreateNoWindow = $true
$start.RedirectStandardOutput = $true
foreach ($name in @('USERPROFILE', 'APPDATA', 'LOCALAPPDATA')) { $start.EnvironmentVariables[$name] = '${ps(home)}' }
$start.EnvironmentVariables['VE_TOOLCHAIN'] = '${ps(toolchain)}'
$process = [System.Diagnostics.Process]::Start($start)
$out = $process.StandardOutput.ReadToEndAsync()
$seen = Watch-Run $process 200
[ordered]@{ control = $control; seen = $seen; exit = $process.ExitCode; out = $out.Result } | ConvertTo-Json -Compress
`)
    expect(result.control, 'the probe saw no window from the control, so it proves nothing').toBeGreaterThan(0)
    expect(result.seen).toBe(0)
    expect(result.exit).toBe(1)  // no Google Drive and no Claude Code on the CI machine
    const run = JSON.parse(String(result.out).trim().split(/\r?\n/).pop()!)
    expect(run).toMatchObject({ schema_version: 1, kind: 'overnight_preflight', ok: false })
    expect(Object.keys(run.checks)).toEqual(CHECKS)
    expect(run.failed).toEqual(CHECKS.filter((name) => !run.checks[name].ok))
    expect(run.checks.drive).toMatchObject({ ok: false, folders: 4 })
    expect(run.checks.disk.free_gb).toBeGreaterThan(0)
    expect(run.checks.codex_companion.ok).toBe(false)
    // The audit ran and its totals were read: nothing in the empty home, so the allowance is unknown and passes.
    expect(run.checks.codex_allowance).toMatchObject({ ok: true, used_pct: null, limit_pct: 80 })
    if (toolchain) expect(run.checks.ffmpeg).toMatchObject({ ok: true, version: expect.stringMatching(/^n8\.1\.2-53-g1005b294ff/) })
    const kept = parseLaneReport({ machine: 'CI', problems: [], preflight: run.report }, new Date(0).toISOString())!.preflight!
    expect(kept.ok).toBe(false)
    expect(kept.failed).toEqual(run.failed)
    expect(kept.at).toBe(run.at)
    // It wrote nothing: the home it ran in holds only this test's own script.
    expect(readdirSync(home)).toEqual(['test.ps1'])
  }, 240_000)
})
