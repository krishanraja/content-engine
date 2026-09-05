param(
  [string]$TaskName = 'Mindmake Video Studio Runner'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$sourcePreflight = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'verify-runner-source.ps1'))
$runnerEntry = [System.IO.Path]::GetFullPath((Join-Path $repoRoot 'apps\runner\src\index.ts'))
$tsxLoader = [System.IO.Path]::GetFullPath((Join-Path $repoRoot 'node_modules\tsx\dist\loader.mjs'))
if (-not $runnerEntry.StartsWith("$repoRoot$([System.IO.Path]::DirectorySeparatorChar)", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Runner entry point must remain inside the repository.'
}
if (-not (Test-Path -LiteralPath $runnerEntry -PathType Leaf)) {
  throw 'Runner entry point is missing.'
}
if (-not $tsxLoader.StartsWith("$repoRoot$([System.IO.Path]::DirectorySeparatorChar)", [System.StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path -LiteralPath $tsxLoader -PathType Leaf)) {
  throw 'The pinned in-process TypeScript loader is missing from this repository installation.'
}
if (-not (Test-Path -LiteralPath $sourcePreflight -PathType Leaf)) {
  throw 'Runner source preflight is missing.'
}

& $sourcePreflight -RepoRoot $repoRoot -RequirePersistentLocation | Out-Null

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$userId = $identity.Name
if ([string]::IsNullOrWhiteSpace($userId)) { throw 'Current Windows user could not be resolved.' }

$node = (Get-Command node.exe -ErrorAction Stop).Source
$nodeVersion = @(& $node --version 2>&1)
if ($LASTEXITCODE -ne 0 -or ($nodeVersion -join '').Trim() -notmatch '^v24\.') { throw 'The scheduled runner requires Node 24.' }
$loaderUri = [System.Uri]::new($tsxLoader).AbsoluteUri
$arguments = "--import `"$loaderUri`" `"$runnerEntry`" daemon"

function Assert-RunnerInactive {
  $stopPreflightOutput = @(& $node --import $loaderUri $runnerEntry stop-preflight 2>&1)
  if ($LASTEXITCODE -ne 0) { throw 'Read-only runner stop preflight failed before task registration.' }
  try { $stopPreflight = ($stopPreflightOutput -join "`n") | ConvertFrom-Json -ErrorAction Stop }
  catch { throw 'Read-only runner stop preflight did not return valid JSON.' }
  if ($stopPreflight.active -ne $false) {
    throw 'A runner process is still active or cannot be identified safely. No authority migration or task replacement was attempted.'
  }
}

$existingTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($null -ne $existingTask -and $existingTask.State -eq 'Running') {
  throw 'The existing runner task is still running. Stop it and verify runner status is inactive before installing this revision.'
}
Assert-RunnerInactive
if ($null -ne $existingTask) {
  Disable-ScheduledTask -TaskName $TaskName -ErrorAction Stop | Out-Null
  $disabledTask = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  if ($disabledTask.State -ne 'Disabled') { throw 'The existing runner task could not be disabled before authority migration.' }
  Assert-RunnerInactive
}
$statusOutput = @(& $node --import $loaderUri $runnerEntry status 2>&1)
if ($LASTEXITCODE -ne 0) { throw 'Runner status preflight failed before task registration.' }
try { $runnerStatus = ($statusOutput -join "`n") | ConvertFrom-Json -ErrorAction Stop }
catch { throw 'Runner status preflight did not return valid JSON.' }
if ($runnerStatus.active -ne $false) {
  throw 'A runner process is still active or cannot be identified safely. Do not replace or start the task until runner status is explicitly inactive.'
}

# The registered process must be the daemon itself. npm.cmd, the tsx CLI, and a
# PowerShell wrapper all create child process chains that Task Scheduler can
# leave running after Stop-ScheduledTask.
$action = New-ScheduledTaskAction -Execute $node -Argument $arguments -WorkingDirectory $repoRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -RestartCount 12 `
  -RestartInterval (New-TimeSpan -Minutes 1) `
  -MultipleInstances IgnoreNew `
  -Hidden `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

try {
  $task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Runs the local Mindmake Video Studio control-plane worker without requiring Codex.'
  Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
  $installed = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
  $installedActions = @($installed.Actions)
  $actionMatches = $false
  try {
    if ($installedActions.Count -eq 1) {
      $actionMatches = [string]::Equals([System.IO.Path]::GetFullPath($installedActions[0].Execute), [System.IO.Path]::GetFullPath($node), [System.StringComparison]::OrdinalIgnoreCase) `
        -and [string]::Equals($installedActions[0].Arguments, $arguments, [System.StringComparison]::Ordinal) `
        -and [string]::Equals([System.IO.Path]::GetFullPath($installedActions[0].WorkingDirectory), $repoRoot, [System.StringComparison]::OrdinalIgnoreCase)
    }
  } catch { $actionMatches = $false }
  if (-not $actionMatches) {
    throw 'Runner task action readback does not match the direct Node daemon contract.'
  }
  if ($installed.Settings.DisallowStartIfOnBatteries -ne $false) {
    throw 'Runner task must be allowed to start while the device is on battery power.'
  }
  if ($installed.Settings.StopIfGoingOnBatteries -ne $false) {
    throw 'Runner task must continue running when the device switches to battery power.'
  }
  if ($installed.Settings.AllowHardTerminate -ne $true) {
    throw 'Runner task must allow Task Scheduler to terminate its directly owned daemon process.'
  }
  if ($installed.Settings.Enabled -ne $true -or $installed.State -eq 'Disabled') {
    throw 'The replacement runner task was not re-enabled after registration.'
  }
} catch {
  Disable-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null
  throw
}
Write-Output "Installed scheduled task: $TaskName"
