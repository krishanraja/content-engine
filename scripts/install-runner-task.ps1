param(
  [string]$TaskName = 'Mindmake Video Studio Runner'
)

$ErrorActionPreference = 'Stop'
$repoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$runnerScript = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'runner.ps1'))
$sourcePreflight = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'verify-runner-source.ps1'))
if (-not $runnerScript.StartsWith($repoRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'Runner entry point must remain inside the repository.'
}
if (-not (Test-Path -LiteralPath $runnerScript -PathType Leaf)) {
  throw 'Runner entry point is missing.'
}
if (-not (Test-Path -LiteralPath $sourcePreflight -PathType Leaf)) {
  throw 'Runner source preflight is missing.'
}

& $sourcePreflight -RepoRoot $repoRoot -RequirePersistentLocation | Out-Null

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$userId = $identity.Name
if ([string]::IsNullOrWhiteSpace($userId)) { throw 'Current Windows user could not be resolved.' }

$powerShell = (Get-Command powershell.exe -ErrorAction Stop).Source
$arguments = "-NoLogo -NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$runnerScript`" -Mode daemon"
$action = New-ScheduledTaskAction -Execute $powerShell -Argument $arguments -WorkingDirectory $repoRoot
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

$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Runs the local Mindmake Video Studio control-plane worker without requiring Codex.'
Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null
$installed = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
if ($installed.Settings.DisallowStartIfOnBatteries -ne $false) {
  Disable-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null
  throw 'Runner task must be allowed to start while the device is on battery power.'
}
if ($installed.Settings.StopIfGoingOnBatteries -ne $false) {
  Disable-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue | Out-Null
  throw 'Runner task must continue running when the device switches to battery power.'
}
Write-Output "Installed scheduled task: $TaskName"
