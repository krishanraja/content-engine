<#
The Saturday overnight preflight for one home computer (plan Wave 1, the clock's "Sat 18:00 Preflight" row, the
checkpoint preflight_ok). Wave 2 builds the overnight runner. This only proves, a week early, whether this machine
could run it unattended.

It reads and runs version and help commands only. It never starts Claude: no Claude runs on a timer in this
architecture (Ruling, Krish, 2026-10-29: "FYI, I want zero Claude routines. No Claude schedules of any kind in this
architecture"). The overnight production is Codex and scripts, started by his Titles press, so the headless Claude
turn this used to make was a check of something the run never does, and starting it from a Saturday timer was itself
a scheduled Claude run. It never edits, sends or spends, it writes no file of its own, and its one JSON result goes
to stdout. Every program it starts has no window, its input closed and its output read here (Krish,
2026-10-28: "HIDE ALL CONSOLE POP UPS FOREVER FROM EVERY REPO AND LOCAL TASK").

The checks, each { ok, detail, ... }:

  claude_cli       Claude Code is installed, and its version (claude --version only; no turn, no model call). The
                   sessions Krish opens on this machine use it.
  codex_companion  the Codex plugin companion that ve dispatch uses (scripts\velib\cards.py) is installed, and
                   "node <companion> help" runs and offers the task route with the flags dispatch passes. Never
                   "task --help": the companion reads help only as its first word, so "task --help" would start a
                   real Codex task with the prompt "--help" and spend the allowance.
  codex_login      "codex login status" says ChatGPT (the test ve doctor uses).
  codex_allowance  the weekly Codex allowance used, from python scripts\session_token_audit.py --codex --json. Above
                   the ceiling in scripts\velib\cards.py (ALLOWANCE_CEILING) dispatch refuses a card without Krish's
                   spend yes, so an overnight run could not send one alone. Unknown (no Codex thread on this machine in
                   the last 7 days) passes and says so.
  ffmpeg           the pinned build that scripts\ve-env.sh names runs from its path and is that build.
  tesseract        Tesseract at the path scripts\ve-env.sh names runs.
  disk             free space on the drive that holds the Studio runtime (takes and renders), at least -MinFreeGB.
  drive            the Video Engine, Inbox, Archive and library folders that config\studio.json names are reachable.

The result also carries "report": the same findings as names, versions and counts only (never a path, a message or
an account), which the recordings pass sends with its lane report. Exit 0 when every check passes, 1 when one fails.

  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\overnight\preflight.ps1

The recordings pass (scripts\recordings-upload.ps1) runs it once each Saturday after 18:00 local, keeps the result as
preflight.json beside its own log, and sends the report with every lane report (POST /api/library/recordings/lane, on
the runner key it already uses). A session reads it back with GET /api/library/recordings/lane on the engine key.
#>
param(
  [string]$RepoRoot = '',
  [ValidateRange(1, 4000)][int]$MinFreeGB = 40
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$Started = [DateTime]::UtcNow
$Invariant = [System.Globalization.CultureInfo]::InvariantCulture
if (-not $RepoRoot) { $RepoRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot) }
$RepoRoot = [System.IO.Path]::GetFullPath($RepoRoot)
$StudioRuntime = Join-Path $env:USERPROFILE 'Documents\MindmakeVideoStudio\runtime'
$StudioPython = Join-Path $StudioRuntime 'python\Scripts\python.exe'
$CompanionRoot = Join-Path $env:USERPROFILE '.claude\plugins\cache\openai-codex\codex'
$Checks = [ordered]@{}

# ---- reading, never writing ---------------------------------------------------------------------------------------

function Get-Field($Object, [string]$Name) {
  # A property that may be missing, without tripping strict mode.
  if ($null -eq $Object) { return $null }
  if ($Object -is [System.Collections.IDictionary]) { return $Object[$Name] }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { return $null }
  return $property.Value
}

function Get-Setting([string]$Name) {
  # A setting as the registry holds it now: a scheduled task keeps the environment it started with.
  foreach ($scope in @('User', 'Machine')) {
    $value = [Environment]::GetEnvironmentVariable($Name, $scope)
    if ($value) { return $value }
  }
  return [Environment]::GetEnvironmentVariable($Name, 'Process')
}

function Get-FreshPath {
  # PATH as the registry holds it now, then this process's own, so a Claude Code or Codex installed since the
  # recordings task started is found. Only the programs this starts are given it.
  $parts = New-Object System.Collections.Generic.List[string]
  foreach ($scope in @('Machine', 'User')) {
    $value = [Environment]::GetEnvironmentVariable('Path', $scope)
    if ($value) { foreach ($part in $value.Split(';')) { if ($part.Trim()) { $parts.Add([Environment]::ExpandEnvironmentVariables($part.Trim())) } } }
  }
  foreach ($part in ([string]$env:PATH).Split(';')) { if ($part.Trim()) { $parts.Add($part.Trim()) } }
  return (@($parts | Select-Object -Unique) -join ';')
}
$FreshPath = Get-FreshPath

function Find-Program([string[]]$Names, [string[]]$Also = @()) {
  # The first of $Also that is there, else the first of $Names on the fresh PATH. Never the Microsoft Store's
  # stand-ins under WindowsApps: python.exe there opens the Store window when Python is not installed.
  # A PATH entry Windows cannot read as a folder is passed over.
  foreach ($candidate in $Also) {
    try { if ($candidate -and (Test-Path -LiteralPath $candidate -PathType Leaf)) { return $candidate } } catch { }
  }
  foreach ($folder in $FreshPath.Split(';')) {
    if ($folder -match '\\WindowsApps\\?$') { continue }
    foreach ($name in $Names) {
      try {
        $path = Join-Path $folder $name
        if (Test-Path -LiteralPath $path -PathType Leaf) { return $path }
      } catch { }
    }
  }
  return $null
}

function ConvertTo-Argument([string]$Value) {
  # One argument as a Windows program reads its command line: quoted when it is empty or holds a space, a tab or a
  # quote, with the backslashes before a quote, and at the end, doubled.
  if ($Value -ne '' -and $Value -notmatch '[\s"]') { return $Value }
  $escaped = [regex]::Replace($Value, '(\\*)"', { param($m) $m.Groups[1].Value + $m.Groups[1].Value + '\"' })
  $escaped = [regex]::Replace($escaped, '(\\+)$', { param($m) $m.Groups[1].Value + $m.Groups[1].Value })
  return '"' + $escaped + '"'
}

function Read-Output($Task) {
  # What a program printed, waiting at most ten seconds once it has ended: a program it left running can hold the
  # pipe open.
  if ($Task.Wait(10000)) { return [string]$Task.Result }
  return ''
}

function Invoke-Quiet([string]$Program, [string[]]$Arguments, [int]$TimeoutSeconds, [hashtable]$Environment = @{}) {
  # Starts one program with no window and its input closed, from the repository, and waits at most $TimeoutSeconds.
  # Returns @{ code; out; err; timed_out; seconds }. A program still running then is ended, with what it started:
  # only that program, never anything else on the machine.
  $line = (@($Arguments) | ForEach-Object { ConvertTo-Argument ([string]$_) }) -join ' '
  $start = New-Object System.Diagnostics.ProcessStartInfo
  if ($Program -match '\.(cmd|bat)$') {
    # An npm shim (claude.cmd, codex.cmd) runs through cmd.exe, the whole line quoted once more.
    $start.FileName = $env:ComSpec
    $start.Arguments = '/d /s /c "' + (ConvertTo-Argument $Program) + ' ' + $line + '"'
  } else {
    $start.FileName = $Program
    $start.Arguments = $line
  }
  $start.WorkingDirectory = $RepoRoot
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $start.RedirectStandardInput = $true
  $start.RedirectStandardOutput = $true
  $start.RedirectStandardError = $true
  $start.StandardOutputEncoding = New-Object System.Text.UTF8Encoding($false)
  $start.StandardErrorEncoding = New-Object System.Text.UTF8Encoding($false)
  $start.EnvironmentVariables['PATH'] = $FreshPath
  foreach ($key in $Environment.Keys) { $start.EnvironmentVariables[$key] = [string]$Environment[$key] }
  $clock = [System.Diagnostics.Stopwatch]::StartNew()
  $process = [System.Diagnostics.Process]::Start($start)
  try {
    $process.StandardInput.Close()
    $out = $process.StandardOutput.ReadToEndAsync()
    $err = $process.StandardError.ReadToEndAsync()
    $timedOut = -not $process.WaitForExit($TimeoutSeconds * 1000)
    if ($timedOut) {
      $end = New-Object System.Diagnostics.ProcessStartInfo((Join-Path $env:SystemRoot 'System32\taskkill.exe'), "/PID $($process.Id) /T /F")
      $end.UseShellExecute = $false
      $end.CreateNoWindow = $true
      $ender = [System.Diagnostics.Process]::Start($end)
      try { [void]$ender.WaitForExit(15000) } finally { $ender.Dispose() }
      [void]$process.WaitForExit(5000)
    }
    $code = -1
    if (-not $timedOut) { $code = $process.ExitCode }
    return @{ code = $code; out = (Read-Output $out); err = (Read-Output $err); timed_out = $timedOut; seconds = [math]::Round($clock.Elapsed.TotalSeconds, 1) }
  } finally { $process.Dispose() }
}

function Get-Short($Run) {
  # The first line a program printed about a failure, short, for the local result only (the report never carries it).
  $text = ([string]$Run.err).Trim()
  if (-not $text) { $text = ([string]$Run.out).Trim() }
  if ($Run.timed_out) { return "it did not finish in $($Run.seconds) seconds" }
  if (-not $text) { return "it ended with code $($Run.code) and printed nothing" }
  $first = ($text -split "`r?`n")[0].Trim()
  if ($first.Length -gt 200) { $first = $first.Substring(0, 200) }
  return "exit $($Run.code): $first"
}

function ConvertTo-UtcTime([string]$Text) {
  if (-not $Text) { return $null }
  $styles = [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal
  $value = [DateTime]::MinValue
  if ([DateTime]::TryParse($Text, $Invariant, $styles, [ref]$value)) { return $value }
  return $null
}

function ConvertFrom-ShellPath([string]$Path) {
  # /c/Users/... as Bash writes it, as Windows does: C:\Users\...
  $match = [regex]::Match($Path, '^/([A-Za-z])/(.*)$')
  if ($match.Success) { return $match.Groups[1].Value.ToUpperInvariant() + ':\' + $match.Groups[2].Value.Replace('/', '\') }
  return $Path.Replace('/', '\')
}

function Get-PinnedTools {
  # The pinned ffmpeg and Tesseract folders, read from scripts\ve-env.sh, the one place they are written, with
  # VE_TOOLCHAIN in place of its default as the script itself does. The default is config\studio.json
  # local_roots.toolchain, else the toolchain folder beside this checkout, as scripts\velib\common.py local_root
  # resolves it for ve-env.sh (one local layout, W2.11).
  $text = [System.IO.File]::ReadAllText((Join-Path $RepoRoot 'scripts\ve-env.sh'))
  $default = [regex]::Match($text, 'TOOLCHAIN="\$\{VE_TOOLCHAIN:-\$_ve_toolchain\}"')
  $path = [regex]::Match($text, 'export PATH="([^"]+)"')
  if (-not $default.Success -or -not $path.Success) { throw 'scripts\ve-env.sh no longer names the toolchain and PATH the way this reads them' }
  $toolchain = Get-Setting 'VE_TOOLCHAIN'
  if (-not $toolchain) {
    $roots = ([System.IO.File]::ReadAllText((Join-Path $RepoRoot 'config\studio.json')) | ConvertFrom-Json).local_roots
    $toolchain = if ($roots -and $roots.toolchain) { [string]$roots.toolchain } else { Join-Path (Split-Path -Parent $RepoRoot) 'toolchain' }
  }
  $found = @{ ffmpeg = $null; build = $null; tesseract = $null }
  foreach ($entry in $path.Groups[1].Value.Split(':')) {
    if (-not $entry -or $entry -eq '$PATH') { continue }
    $build = [regex]::Match($entry, 'ffmpeg-(n[0-9.]+-[0-9]+-g[0-9a-f]+)')
    $folder = if ($entry.StartsWith('$TOOLCHAIN')) { (ConvertFrom-ShellPath $toolchain).TrimEnd('\') + (ConvertFrom-ShellPath $entry.Substring(10)) } else { ConvertFrom-ShellPath $entry }
    if ($build.Success) { $found.ffmpeg = $folder; $found.build = $build.Groups[1].Value }
    elseif ($entry -match 'Tesseract') { $found.tesseract = $folder }
  }
  return $found
}

function Invoke-Check([string]$Name, [scriptblock]$Body) {
  # One check; a check that stops is a failed check, never a stopped preflight.
  try { $result = & $Body }
  catch { $result = [ordered]@{ ok = $false; detail = "the check stopped: $($_.Exception.Message)" } }
  $Checks[$Name] = $result
}

# ---- the checks ---------------------------------------------------------------------------------------------------

$Claude = $null
try { $Claude = Find-Program @('claude.exe', 'claude.cmd') @((Join-Path $env:USERPROFILE '.local\bin\claude.exe'), (Join-Path $env:APPDATA 'npm\claude.cmd')) } catch { }

Invoke-Check 'claude_cli' {
  if (-not $Claude) { return [ordered]@{ ok = $false; version = $null; detail = 'Claude Code is not installed on this machine, or not on its PATH.' } }
  $run = Invoke-Quiet $Claude @('--version') 30
  $version = [regex]::Match($run.out, '(\d+\.\d+\.\d+)')
  if ($run.code -ne 0 -or -not $version.Success) { return [ordered]@{ ok = $false; version = $null; detail = "claude --version did not answer ($(Get-Short $run))." } }
  return [ordered]@{ ok = $true; version = $version.Groups[1].Value; detail = "Claude Code $($version.Groups[1].Value)." }
}

Invoke-Check 'codex_companion' {
  # The file ve dispatch picks (scripts\velib\cards.py, companion()): the last by name of every installed version.
  $found = [string[]]@(Get-ChildItem -LiteralPath $CompanionRoot -Directory -ErrorAction SilentlyContinue |
    ForEach-Object { Join-Path $_.FullName 'scripts\codex-companion.mjs' } | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf })
  if (-not $found.Count) { return [ordered]@{ ok = $false; version = $null; detail = 'The Codex plugin companion is not installed (ve doctor explains), so ve dispatch cannot send a Codex card.' } }
  [Array]::Sort($found, [StringComparer]::Ordinal)
  $companion = $found[-1]
  $version = Split-Path -Leaf (Split-Path -Parent (Split-Path -Parent $companion))
  $node = Find-Program @('node.exe')
  if (-not $node) { return [ordered]@{ ok = $false; version = $version; detail = 'Node is not on this machine, so the companion cannot run.' } }
  # "help" as the first word, which the companion answers with its usage and nothing else. Never "task --help".
  $run = Invoke-Quiet $node @($companion, 'help') 30
  $task = @(($run.out -split "`r?`n") | Where-Object { $_ -match 'codex-companion\.mjs task ' } | Select-Object -First 1)
  if ($run.code -ne 0 -or -not $task.Count) { return [ordered]@{ ok = $false; version = $version; detail = "node <companion> help did not offer the task route ($(Get-Short $run))." } }
  $missing = @(@('--write', '--fresh', '--model', '--effort', '--background') | Where-Object { $task[0].IndexOf($_) -lt 0 })
  if ($missing.Count) { return [ordered]@{ ok = $false; version = $version; detail = "the companion's task route no longer takes $($missing -join ', '), which ve dispatch passes." } }
  return [ordered]@{ ok = $true; version = $version; detail = "companion $version runs and offers the task route ve dispatch uses." }
}

Invoke-Check 'codex_login' {
  $codex = Find-Program @('codex.exe', 'codex.cmd') @((Join-Path $env:APPDATA 'npm\codex.cmd'))
  if (-not $codex) { return [ordered]@{ ok = $false; detail = 'The Codex CLI is not on this machine, so Codex cards cannot run.' } }
  $run = Invoke-Quiet $codex @('login', 'status') 30
  # Only whether it says ChatGPT: the status line can name the account, and it is never repeated here.
  if ("$($run.out) $($run.err)" -match 'ChatGPT') { return [ordered]@{ ok = $true; detail = 'Codex is signed in with ChatGPT.' } }
  return [ordered]@{ ok = $false; detail = "codex login status does not say ChatGPT (exit $($run.code)), so Codex cards cannot run until Codex is signed in." }
}

Invoke-Check 'codex_allowance' {
  $cards = [System.IO.File]::ReadAllText((Join-Path $RepoRoot 'scripts\velib\cards.py'))
  $ceiling = [regex]::Match($cards, '(?m)^ALLOWANCE_CEILING = (\d+)')
  if (-not $ceiling.Success) { throw 'scripts\velib\cards.py no longer names ALLOWANCE_CEILING' }
  $limit = [int]$ceiling.Groups[1].Value
  $python = $null
  $prefix = @()
  if (Test-Path -LiteralPath $StudioPython -PathType Leaf) { $python = $StudioPython }
  else {
    $python = Find-Program @('py.exe')
    if ($python) { $prefix = @('-3') } else { $python = Find-Program @('python.exe') }
  }
  if (-not $python) { return [ordered]@{ ok = $false; used_pct = $null; detail = 'No Python on this machine to read the Codex allowance with.' } }
  $audit = Join-Path $RepoRoot 'scripts\session_token_audit.py'
  $run = Invoke-Quiet $python ($prefix + @($audit, '--codex', '--json')) 120 @{ PYTHONUTF8 = '1'; PYTHONIOENCODING = 'utf-8' }
  # "totals" is the last key the audit prints, so it is read alone: the session list before it can run past what
  # Windows PowerShell's ConvertFrom-Json takes.
  $at = $run.out.LastIndexOf('"totals":')
  $close = $run.out.LastIndexOf('}')
  if ($run.code -ne 0 -or $at -lt 0 -or $close -le $at) { return [ordered]@{ ok = $false; used_pct = $null; detail = "the Codex audit did not answer ($(Get-Short $run))." } }
  $totals = $run.out.Substring($at + 9, $close - $at - 9) | ConvertFrom-Json
  $used = Get-Field (Get-Field $totals 'weekly_used_pct') 'end'
  $resets = [string](Get-Field $totals 'weekly_resets_at')
  $plan = [string](Get-Field $totals 'plan_type')
  $credits = Get-Field (Get-Field $totals 'credits') 'end'
  $result = [ordered]@{ ok = $true; used_pct = $null; limit_pct = $limit; resets_at = $null; plan = $plan; credits = $credits; detail = '' }
  if ($null -eq $used) {
    $result.detail = 'unknown: no Codex thread on this machine in the last 7 days to read the allowance from.'
    return $result
  }
  $used = [double]$used
  $resetAt = ConvertTo-UtcTime $resets
  if ($resetAt) { $result.resets_at = $resetAt.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", $Invariant) }
  if ($resetAt -and $resetAt -lt [DateTime]::UtcNow) {
    # The window has reset since the last reading (ve doctor reads it the same way).
    $used = 0
    $result.detail = 'the weekly window has reset since the last Codex thread, so 0% is used.'
  }
  $result.used_pct = [math]::Round($used, 1)
  $result.ok = ($used -le $limit)
  if (-not $result.detail) {
    if ($result.ok) { $result.detail = "$($result.used_pct)% of the weekly Codex allowance is used (ceiling $limit%)." }
    else { $result.detail = "$($result.used_pct)% of the weekly Codex allowance is used, over the $limit% ceiling: ve dispatch refuses a card without Krish's spend yes." }
  }
  return $result
}

$Pinned = $null
try { $Pinned = Get-PinnedTools } catch { $Pinned = $_.Exception.Message }

Invoke-Check 'ffmpeg' {
  if ($Pinned -is [string]) { throw $Pinned }
  $ffmpeg = Join-Path $Pinned.ffmpeg 'ffmpeg.exe'
  if (-not (Test-Path -LiteralPath $ffmpeg -PathType Leaf)) { return [ordered]@{ ok = $false; version = $null; detail = "the pinned ffmpeg $($Pinned.build) is not at the path scripts\ve-env.sh names." } }
  $run = Invoke-Quiet $ffmpeg @('-version') 30
  $version = [regex]::Match($run.out, 'ffmpeg version (\S+)')
  if ($run.code -ne 0 -or -not $version.Success) { return [ordered]@{ ok = $false; version = $null; detail = "the pinned ffmpeg did not run ($(Get-Short $run))." } }
  $ok = $version.Groups[1].Value.StartsWith($Pinned.build)
  $detail = if ($ok) { "ffmpeg $($version.Groups[1].Value), the pinned build." } else { "the ffmpeg at the pinned path is $($version.Groups[1].Value), not $($Pinned.build)." }
  return [ordered]@{ ok = $ok; version = $version.Groups[1].Value; detail = $detail }
}

Invoke-Check 'tesseract' {
  if ($Pinned -is [string]) { throw $Pinned }
  $tesseract = Join-Path $Pinned.tesseract 'tesseract.exe'
  if (-not (Test-Path -LiteralPath $tesseract -PathType Leaf)) { return [ordered]@{ ok = $false; version = $null; detail = 'Tesseract is not at the path scripts\ve-env.sh names, so captions cannot be read back.' } }
  $run = Invoke-Quiet $tesseract @('--version') 30
  $version = [regex]::Match("$($run.out)`n$($run.err)", 'tesseract v?(\d+\.\d+[0-9.]*)')
  if ($run.code -ne 0 -or -not $version.Success) { return [ordered]@{ ok = $false; version = $null; detail = "Tesseract did not run ($(Get-Short $run))." } }
  return [ordered]@{ ok = $true; version = $version.Groups[1].Value; detail = "Tesseract $($version.Groups[1].Value)." }
}

Invoke-Check 'disk' {
  $root = [System.IO.Path]::GetPathRoot($StudioRuntime)
  $drive = New-Object System.IO.DriveInfo($root)
  $free = [math]::Round($drive.AvailableFreeSpace / 1GB, 1)
  $ok = ($free -ge $MinFreeGB)
  $detail = if ($ok) { "$free GB free on $root, where the Studio keeps takes and renders (at least $MinFreeGB)." } else { "only $free GB free on $root, where the Studio keeps takes and renders; an overnight run needs at least $MinFreeGB." }
  return [ordered]@{ ok = $ok; free_gb = $free; min_gb = $MinFreeGB; detail = $detail }
}

Invoke-Check 'drive' {
  $config = [System.IO.File]::ReadAllText((Join-Path $RepoRoot 'config\studio.json')) | ConvertFrom-Json
  $runtime = Get-Field $config 'runtime'
  $folders = [ordered]@{}
  foreach ($key in @('drive_root', 'media_inbox', 'archive_root', 'library_root')) {
    $path = [string](Get-Field $runtime $key)
    $folders[$key] = [bool]($path -and (Test-Path -LiteralPath $path -PathType Container))
  }
  $missing = @($folders.Keys | Where-Object { -not $folders[$_] })
  $detail = if ($missing.Count) { "Google Drive is not reachable here for $($missing -join ', ') in config\studio.json: check Google Drive is running and signed in." } else { 'the Video Engine, Inbox, Archive and library folders are reachable.' }
  return [ordered]@{ ok = ($missing.Count -eq 0); reachable = ($folders.Count - $missing.Count); folders = $folders.Count; detail = $detail }
}

# ---- the result ---------------------------------------------------------------------------------------------------

$failed = @($Checks.Keys | Where-Object { -not [bool](Get-Field $Checks[$_] 'ok') })
$at = $Started.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", $Invariant)
$allowance = $Checks['codex_allowance']
$report = [ordered]@{
  at = $at
  ok = ($failed.Count -eq 0)
  failed = $failed
  claude_version = Get-Field $Checks['claude_cli'] 'version'
  codex_companion = Get-Field $Checks['codex_companion'] 'version'
  codex_login = [bool](Get-Field $Checks['codex_login'] 'ok')
  codex_weekly_used_pct = Get-Field $allowance 'used_pct'
  codex_resets_at = Get-Field $allowance 'resets_at'
  ffmpeg = Get-Field $Checks['ffmpeg'] 'version'
  tesseract = Get-Field $Checks['tesseract'] 'version'
  free_gb = Get-Field $Checks['disk'] 'free_gb'
  drive_reachable = Get-Field $Checks['drive'] 'reachable'
  drive_folders = Get-Field $Checks['drive'] 'folders'
}
$result = [ordered]@{
  schema_version = 1
  kind = 'overnight_preflight'
  machine = ($env:COMPUTERNAME -replace '[^A-Za-z0-9_-]', '-')
  at = $at
  local_date = $Started.ToLocalTime().ToString('yyyy-MM-dd', $Invariant)
  seconds = [math]::Round(([DateTime]::UtcNow - $Started).TotalSeconds, 1)
  ok = ($failed.Count -eq 0)
  failed = $failed
  checks = $Checks
  report = $report
}
Write-Output ($result | ConvertTo-Json -Depth 8 -Compress)
if ($failed.Count) { exit 1 }
exit 0
