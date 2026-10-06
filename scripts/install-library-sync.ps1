<#
Registers the scheduled task that keeps Krish's makeyourmindup asset library on
Drive up to date (scripts/library-sync.ps1). Run it once, on the active runner
machine, from the sync's own copy of this repository, library-source beside
the runner's folders, never the runner's pinned checkout. From any folder:

  $dir = "$env:USERPROFILE\Documents\MindmakeVideoStudio\library-source"
  if (Test-Path "$dir\.git") { git -C $dir pull --ff-only } else { git clone https://github.com/krishanraja/content-engine.git $dir }
  powershell -NoProfile -ExecutionPolicy Bypass -File "$dir\scripts\install-library-sync.ps1"

Krish, 2026-10-06: "make sure the brand kit is always updated here [the
library's Drive folder]", then "I want every single asset in there, permanent
and for individual posts, categorized properly, clear what to use them for,
and every new post gets its own new folder with all assets including the
article HTML I can copy paste, video scripts, etc etc". The architecture doc's
rule 0a.5 says agents never write into his Drive; this is his explicit
instruction for this one folder, carried out by his own machine, and it covers
that folder only.

Before it registers anything it runs the sync once with -Check, which writes
nothing: the library folder must be reachable, the runner key must be in
Windows Credential Manager and the engine must answer. Then it registers
"Mindmake Library Sync": one hidden PowerShell process started at logon that
syncs every ten minutes, and a trigger every ten minutes that starts it again
if it has stopped (Windows ignores that trigger while it runs). The task runs
as Krish, in his own session, because Google Drive for desktop mounts the
drive there. It never touches the runner's task, folders or credentials.

To stop it: Disable-ScheduledTask -TaskName "Mindmake Library Sync"
#>
param(
  [string]$TaskName = 'Mindmake Library Sync',
  [ValidateRange(5, 60)][int]$EveryMinutes = 10,
  [switch]$SkipCheck
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$syncScript = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'library-sync.ps1'))
if (-not $syncScript.StartsWith("$repoRoot$([System.IO.Path]::DirectorySeparatorChar)", [System.StringComparison]::OrdinalIgnoreCase)) {
  throw 'The library sync script must remain inside the repository.'
}
if (-not (Test-Path -LiteralPath $syncScript -PathType Leaf)) { throw 'scripts\library-sync.ps1 is missing. Run git pull first.' }
foreach ($needed in @('scripts\get-credential.ps1', 'scripts\engine.py', 'config\studio.json')) {
  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $needed) -PathType Leaf)) { throw "$needed is missing from $repoRoot." }
}

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$userId = $identity.Name
if ([string]::IsNullOrWhiteSpace($userId)) { throw 'Current Windows user could not be resolved.' }
$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source

if (-not $SkipCheck) {
  Write-Output 'Checking the library folder, the runner key and the engine (nothing is written)...'
  & $powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $syncScript -Check -SkipBrandKit
  if ($LASTEXITCODE -ne 0) {
    throw 'The check failed (the reason is above). Nothing was installed.'
  }
}

$arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$syncScript`" -Loop -EveryMinutes $EveryMinutes"
$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $repoRoot
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
# A trigger every few minutes for ten years: while the sync runs, IgnoreNew
# leaves it alone; after sleep, an update or a crash, it starts the sync again.
# Reinstalling refreshes the horizon.
$repeatTrigger = New-ScheduledTaskTrigger `
  -Once `
  -At ((Get-Date).AddMinutes(1)) `
  -RepetitionInterval (New-TimeSpan -Minutes $EveryMinutes) `
  -RepetitionDuration (New-TimeSpan -Days 3650)
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet `
  -StartWhenAvailable `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -DontStopOnIdleEnd `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit ([TimeSpan]::Zero)

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($null -ne $existing -and $existing.State -eq 'Running') {
  Stop-ScheduledTask -TaskName $TaskName
}

$task = New-ScheduledTask -Action $action -Trigger @($logonTrigger, $repeatTrigger) -Principal $principal -Settings $settings -Description "Writes the files sent to the engine's library into Krish's makeyourmindup asset library on Drive, and keeps its brand kit in step. scripts/library-sync.ps1."
Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null

$installed = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
$installedActions = @($installed.Actions)
$actionMatches = $installedActions.Count -eq 1 `
  -and [string]::Equals([System.IO.Path]::GetFullPath($installedActions[0].Execute), [System.IO.Path]::GetFullPath($powershell), [System.StringComparison]::OrdinalIgnoreCase) `
  -and [string]::Equals($installedActions[0].Arguments, $arguments, [System.StringComparison]::Ordinal)
if (-not $actionMatches) { throw 'The installed task does not run library-sync.ps1 as intended.' }
$installedTriggers = @($installed.Triggers)
$hasLogon = @($installedTriggers | Where-Object { $_.CimClass.CimClassName -eq 'MSFT_TaskLogonTrigger' }).Count -eq 1
$hasRepeat = @($installedTriggers | Where-Object {
  $_.CimClass.CimClassName -eq 'MSFT_TaskTimeTrigger' -and $_.Repetition.Interval -eq "PT$($EveryMinutes)M"
}).Count -eq 1
if (-not $hasLogon -or -not $hasRepeat -or $installedTriggers.Count -ne 2) { throw 'The installed task triggers are not the logon and repeat pair.' }
if ($installed.Settings.MultipleInstances -ne 'IgnoreNew') { throw 'The installed task must run one sync at a time.' }

Start-ScheduledTask -TaskName $TaskName
Write-Output "Installed scheduled task: $TaskName (every $EveryMinutes minutes). Its log: $env:USERPROFILE\Documents\MindmakeVideoStudio\library-sync\library-sync.log"
