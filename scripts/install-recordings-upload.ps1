<#
Registers the scheduled task that sends every finished recording in the Video
Engine Inbox to the engine (scripts/recordings-upload.ps1). Run it once on EACH
runner machine, the primary and the standby, from the upload's own copy of
this repository, recordings-source beside the runner's folders. From any
folder:

  $dir = "$env:USERPROFILE\Documents\MindmakeVideoStudio\recordings-source"
  if (-not (Test-Path "$dir\.git")) { if (Test-Path $dir) { Remove-Item $dir -Recurse -Force }; git clone https://github.com/krishanraja/content-engine.git $dir }
  git -C $dir fetch origin main
  git -C $dir checkout -B main origin/main
  git -C $dir log --oneline -1
  powershell -NoProfile -ExecutionPolicy Bypass -File "$dir\scripts\install-recordings-upload.ps1"

Krish, 2026-10-06: "figure out how to never make that error again", after a
session told him it could not reach his file, then "How can you do this
automatically in the future, and just use whichever machine is online at the
time? the runner exists on both". Both machines run it; whichever is online
sends the recording, and the engine keeps one copy by its sha256.

It brings recordings-source up to date first. Then it runs the upload once
with -Check, which sends and places nothing. Sending: the Inbox must be
reachable, the runner key must be in Windows Credential Manager and the
engine must accept it on the recordings route; if any of that fails it says
which and installs nothing. Placing, because every pass also places each
take on its piece and cut (scripts\post-pack\recording_match.py): the pinned
Python (npm run bootstrap:python) must have a faster_whisper that decodes
sound (recording_match.py --check-transcriber), ffmpeg must be on the PATH,
and the engine key (scripts\engine-key.ps1, once per machine) must list the
engine's recordings. If only placing fails (the check's exit 3), it says
which and installs anyway, so this machine still sends; the other machine
places takes until this one is set up. -RequirePlacing makes that a stop.
Then it registers "Mindmake Recordings Upload": one hidden PowerShell
process started at logon that pulls recordings-source and sends and places
every five minutes, and a trigger every five minutes that starts it again if
it has stopped (Windows ignores that trigger while it runs). It runs as Krish,
in his own session, because Google Drive for desktop mounts the drive there and
Credential Manager holds his keys there. It never touches the runner's task,
folders or credentials, or the library sync.

To stop it on a machine: Disable-ScheduledTask -TaskName "Mindmake Recordings Upload"
#>
param(
  [string]$TaskName = 'Mindmake Recordings Upload',
  [ValidateRange(2, 60)][int]$EveryMinutes = 5,
  [switch]$SkipCheck,
  [switch]$RequirePlacing
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$repoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$uploadScript = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot 'recordings-upload.ps1'))
$sourceFolder = 'recordings-source'
if ((Split-Path -Leaf $repoRoot) -ne $sourceFolder) {
  throw "Run this from the upload's own copy, $env:USERPROFILE\Documents\MindmakeVideoStudio\$sourceFolder (the three lines at the top of this file make it). It keeps itself up to date, so it must never be the runner's checkout or a copy a session works in."
}
if (-not (Test-Path -LiteralPath $uploadScript -PathType Leaf)) { throw 'scripts\recordings-upload.ps1 is missing. Run git pull first.' }

$git = Get-Command git.exe -ErrorAction SilentlyContinue
if ($null -eq $git) { throw 'git is not on this machine. The upload pulls its own fixes with git, so install Git for Windows first.' }
Write-Output "Bringing $repoRoot up to date..."
& $git.Source -C $repoRoot pull --ff-only
if ($LASTEXITCODE -ne 0) { throw "git pull in $repoRoot did not finish (the reason is above). Nothing was installed." }
foreach ($needed in @('scripts\get-credential.ps1', 'scripts\engine.py', 'config\studio.json')) {
  if (-not (Test-Path -LiteralPath (Join-Path $repoRoot $needed) -PathType Leaf)) { throw "$needed is missing from $repoRoot." }
}

$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$userId = $identity.Name
if ([string]::IsNullOrWhiteSpace($userId)) { throw 'Current Windows user could not be resolved.' }
$powershell = (Get-Command powershell.exe -ErrorAction Stop).Source

if (-not $SkipCheck) {
  Write-Output 'Checking the Inbox, the runner key, the engine key, the transcriber and the engine (nothing is sent or placed)...'
  & $powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $uploadScript -Check
  $checked = $LASTEXITCODE
  if ($checked -eq 3) {
    # Sending works; placing takes does not yet. A problem placing never stops the sending.
    if ($RequirePlacing) { throw 'Sending is ready, but placing takes is not (the reason is above). Nothing was installed, as -RequirePlacing asks.' }
    Write-Output 'Sending is ready; placing takes is not ready on this machine yet (the reason is above). The task is installed so this machine sends; the other machine places takes until this one is set up, and the next check here says when it is.'
  } elseif ($checked -ne 0) {
    throw 'The check failed (the reason is above). Nothing was installed.'
  }
}

$arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$uploadScript`" -Loop -EveryMinutes $EveryMinutes"
$action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $repoRoot
$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $userId
# A trigger every few minutes for ten years: while the upload runs, IgnoreNew
# leaves it alone; after sleep, an update or a crash, it starts it again.
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

$task = New-ScheduledTask -Action $action -Trigger @($logonTrigger, $repeatTrigger) -Principal $principal -Settings $settings -Description "Sends every finished recording in the Video Engine Inbox to the engine, for cloud sessions to fetch, and places each take on its piece and cut. Reads the Inbox only. Runs on both runner machines. scripts/recordings-upload.ps1."
Register-ScheduledTask -TaskName $TaskName -InputObject $task -Force | Out-Null

$installed = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
$installedActions = @($installed.Actions)
$actionMatches = $installedActions.Count -eq 1 `
  -and [string]::Equals([System.IO.Path]::GetFullPath($installedActions[0].Execute), [System.IO.Path]::GetFullPath($powershell), [System.StringComparison]::OrdinalIgnoreCase) `
  -and [string]::Equals($installedActions[0].Arguments, $arguments, [System.StringComparison]::Ordinal)
if (-not $actionMatches) { throw 'The installed task does not run recordings-upload.ps1 as intended.' }
$installedTriggers = @($installed.Triggers)
$hasLogon = @($installedTriggers | Where-Object { $_.CimClass.CimClassName -eq 'MSFT_TaskLogonTrigger' }).Count -eq 1
$hasRepeat = @($installedTriggers | Where-Object {
  $_.CimClass.CimClassName -eq 'MSFT_TaskTimeTrigger' -and $_.Repetition.Interval -eq "PT$($EveryMinutes)M"
}).Count -eq 1
if (-not $hasLogon -or -not $hasRepeat -or $installedTriggers.Count -ne 2) { throw 'The installed task triggers are not the logon and repeat pair.' }
if ($installed.Settings.MultipleInstances -ne 'IgnoreNew') { throw 'The installed task must run one upload at a time.' }

Start-ScheduledTask -TaskName $TaskName
Write-Output "Installed scheduled task: $TaskName (every $EveryMinutes minutes). Its log: $env:USERPROFILE\Documents\MindmakeVideoStudio\recordings-upload\recordings-upload.log"
Write-Output 'Run the same three lines on the other runner machine too.'
