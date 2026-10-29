<#
Sends every finished recording in the Video Engine Inbox to the engine's
private storage, so any cloud session can fetch it with
scripts/post-pack/recording.py.

Krish, 2026-10-06, after a session told him it could not reach his file:
"figure out how to never make that error again". The Drive connector caps a
download at 10 MB and a recording runs 100 to 500 MB, and he must never have to
move a file by hand. Then: "How can you do this automatically in the future,
and just use whichever machine is online at the time? the runner exists on
both".

So this runs on both runner machines at once, as the scheduled task "Mindmake
Recordings Upload". Whichever machine is online does the work. Both may send
the same recording: the engine keys it by sha256, so the second finds it
already there (or its upload is refused as a duplicate and its confirm finds
the first one's bytes), and storage ends with one copy. The library sync
(scripts/library-sync.ps1) stays on one machine, because two machines writing
one Drive folder would leave "name (2)" copies; this writes nothing to Drive.

It only reads the Inbox: it never writes, moves, renames or deletes anything
there. Its log and state (recordings.json: name, size and time to sha256, for
what this machine has sent; placing.json: the takes a piece holds and when to
look again at the others) are in Documents\MindmakeVideoStudio\recordings-upload.

At the end of every pass it also places the takes, on either machine (Krish,
2026-10-12: each recording "goes to the right place when recorded"). When the
engine holds a take that no piece claims and that the answered book
(.cache\recordings\answered.json in this copy, kept by the matcher) does not
hold, it runs, with the pinned Python that scripts\bootstrap-python.ps1 builds:

  scripts\post-pack\recording_match.py --record --board --by "Recordings lane" --json

which hears each new take, records each sure match on its piece and cut,
stamped with the hash of the script it was read from, and asks Krish once on
the board about each take it is unsure of. Which takes a piece claims, it learns
from the matcher's own answer; a take no piece was waiting for is looked at
again an hour later, and one the matcher left alone as older than every
waiting piece six hours later (a piece may start waiting for it). A problem
placing takes never stops the sending. It needs the engine key
(scripts\engine-key.ps1) and faster_whisper in the pinned Python, able to
decode sound (recording_match.py --check-transcriber); -Check proves both.

-Check exits 0 when this machine sends and places, 1 when it cannot send
(no Inbox, the runner key refused, the engine down), and 3 when it sends but
cannot place takes yet (no pinned Python, a transcriber that cannot decode,
no ffmpeg, no engine key), naming which. install-recordings-upload.ps1
installs on 3 and says so, since the other machine places takes meanwhile.

The Inbox is runtime.media_inbox in config/studio.json, unless
MINDMAKE_MEDIA_INBOX is set and names a folder that is there; a setting that
names a missing folder is reported and studio.json's is used. Settings are
read fresh from the registry every pass, so a changed one takes effect
without a restart. The engine also reads the Inbox from Google by its folder
ID (api/library/recordings/drive-inbox.ts); this upload is the fallback.

Every pass ends by telling the engine what it found (POST
/api/library/recordings/lane): an unreachable Inbox, a stale setting, no
pinned Python, a recording or a publish that
failed. The engine's Inbox job fails with this machine named while its last
report holds a problem, so Control Center shows it (Krish, 2026-10-24, after
two days of "cannot be reached" in this log alone). The engine's address is
ENGINE_BASE_URL, else the one scripts/engine.py uses. It authenticates with the
runner's own bearer, read from Windows Credential Manager through
scripts/get-credential.ps1 exactly as the runner reads it, and never shows it.

Once each Saturday after 18:00 local, a pass also runs the overnight preflight
(scripts\overnight\preflight.ps1, plan Wave 1: the clock's "Sat 18:00
Preflight" row), with no window. It only reads: whether this machine could run
the overnight production unattended (Claude Code installed, never started,
the Codex companion, login and allowance, the pinned ffmpeg and Tesseract, free
disk, Google Drive). Its result is kept as preflight.json beside this log, a
failed one is tried once more 20 minutes later, and every report after carries
its summary, so GET /api/library/recordings/lane reads it with no new key.

  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\recordings-upload.ps1 -Check   what it would send and place, sending and placing nothing
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\recordings-upload.ps1          one pass
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\recordings-upload.ps1 -Loop    a pass every five minutes (the scheduled task)

In -Loop it brings its own copy of the repository up to date (git pull
--ff-only) before each pass, when that copy is the dedicated recordings-source
clone, and ends when this script has changed so the task starts the new one.
A fix pushed to main reaches both machines without Krish doing anything.
scripts/install-recordings-upload.ps1 registers the task.
#>
param(
  [string]$EngineUrl = '',
  [string]$StateRoot = '',
  [switch]$Check,
  [switch]$Loop,
  [ValidateRange(1, 1440)][int]$EveryMinutes = 5
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# Every scheduled task of his that would open a console window runs through run-hidden.exe, checked each pass
# (scripts\windowless.ps1, Invoke-WindowKeeper). Krish, 2026-10-28: "HIDE ALL CONSOLE POP UPS FOREVER FROM EVERY REPO
# AND LOCAL TASK". A copy from before that file has no keeper, and the pass goes on without it.
$WindowlessScript = Join-Path $PSScriptRoot 'windowless.ps1'
if (Test-Path -LiteralPath $WindowlessScript -PathType Leaf) { . $WindowlessScript }
$script:Windows = $null

$RepoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$SourceFolderName = 'recordings-source'
$RunnerCredential = 'MindmakeVideoStudio/control-center-runner-token-v3'
$RecordingExtensions = @('.mp4', '.mov', '.m4a', '.wav', '.mp3', '.mkv', '.webm')
$RecordingMaxBytes = 2147483648  # 2 GiB, the bucket's cap since 2026-10-18 (a deep-cut take runs about 1.1 GB)
$RecordingSettleSeconds = 120
$PassBudget = [TimeSpan]::FromMinutes(25)
# Placing takes: the pinned Python scripts\bootstrap-python.ps1 builds (it
# holds faster_whisper), the matcher, who it writes as, and the book of takes
# it has asked about or left alone (recording_match.py, ANSWERED).
$StudioPython = Join-Path $env:USERPROFILE 'Documents\MindmakeVideoStudio\runtime\python\Scripts\python.exe'
$Matcher = Join-Path $RepoRoot 'scripts\post-pack\recording_match.py'
$Lister = Join-Path $RepoRoot 'scripts\post-pack\recording.py'
$MatchBy = 'Recordings lane'
$AnsweredPath = Join-Path $RepoRoot '.cache\recordings\answered.json'
$NoPieceRetryMinutes = 60   # a take no piece was waiting for: looked at again an hour later
$FailedRetryMinutes = 15    # a take the matcher could not hear or record: tried again after a quarter of an hour
$OldRetryMinutes = 360      # a take older than every waiting piece: looked at again six hours later, never booked for good

if (-not $StateRoot) { $StateRoot = Join-Path $env:USERPROFILE 'Documents\MindmakeVideoStudio\recordings-upload' }
$StateRoot = [System.IO.Path]::GetFullPath($StateRoot)
$LogPath = Join-Path $StateRoot 'recordings-upload.log'
$StatePath = Join-Path $StateRoot 'recordings.json'
$PlacingStatePath = Join-Path $StateRoot 'placing.json'
# The Saturday overnight preflight: its script, where its last result is kept, from when it runs, when a failed one is
# tried once more (a machine miss re-fires once, the plan's clock), and how long a failed one is reported as a problem.
$PreflightScript = Join-Path $RepoRoot 'scripts\overnight\preflight.ps1'
$PreflightStatePath = Join-Path $StateRoot 'preflight.json'
$PreflightHour = 18
$PreflightRetryMinutes = 20
$PreflightFailedHours = 48
$script:Preflight = $null
# The overnight run (scripts\overnight\overnight.py, plan Wave 2, W2.6): started by his Titles press, once a week, as this
# machine's role (MINDMAKE_OVERNIGHT_ROLE: primary or standby); what this machine last started is kept here.
$OvernightScript = Join-Path $RepoRoot 'scripts\overnight\overnight.py'
$OvernightStatePath = Join-Path $StateRoot 'overnight.json'
$script:Overnight = $null
$script:LastPlacingNote = ''
$script:PlacingNotReady = ''
$script:PassSent = $true
$script:Problems = New-Object System.Collections.Generic.List[string]
$script:FirstPass = $true
$script:Watch = $null
$script:WatchStartedAt = $null
$script:WatchRepairAt = $null
$script:WatchRepairOutcome = $null

[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Net.Http

function Write-Log([string]$Message) {
  # Write-Host, never Write-Output: a function's output is its return value.
  $line = '{0}  {1}' -f (Get-Date).ToString('yyyy-MM-dd HH:mm:ss'), $Message
  Write-Host $line
  try {
    [void][System.IO.Directory]::CreateDirectory($StateRoot)
    if ((Test-Path -LiteralPath $LogPath) -and (Get-Item -LiteralPath $LogPath).Length -gt 1MB) {
      Move-Item -LiteralPath $LogPath -Destination "$LogPath.old" -Force
    }
    Add-Content -LiteralPath $LogPath -Value $line -Encoding UTF8
  } catch { }
}

function Read-JsonFile([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
  try { return (Get-Content -LiteralPath $Path -Raw -Encoding UTF8 | ConvertFrom-Json) } catch { return $null }
}

function Get-Field($Object, [string]$Name) {
  # A property that may be missing, without tripping strict mode.
  if ($null -eq $Object) { return $null }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { return $null }
  return $property.Value
}

function Save-JsonFile([string]$Path, $Value) {
  # Only ever called with $StatePath, $PlacingStatePath or $PreflightStatePath,
  # beside the log: never anywhere in Drive.
  [void][System.IO.Directory]::CreateDirectory($StateRoot)
  $temporary = "$Path.tmp"
  [System.IO.File]::WriteAllText($temporary, ($Value | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
  Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Get-Sha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

# ---- where things are --------------------------------------------------------

function Get-StudioConfig {
  $config = Read-JsonFile (Join-Path $RepoRoot 'config\studio.json')
  if ($null -eq $config) { throw "config\studio.json could not be read from $RepoRoot." }
  return $config
}

function Add-Problem([string]$Code) {
  # One of the codes the engine takes (api/library/_lanes.ts LANE_PROBLEMS).
  if (-not $script:Problems.Contains($Code)) { $script:Problems.Add($Code) }
}

function Get-Setting([string]$Name) {
  # A user or machine environment setting as the registry holds it now, so a
  # setting changed or deleted after this long-running task started counts on
  # the next pass. On 2026-10-24 a corrected MINDMAKE_MEDIA_INBOX was ignored
  # until the machine restarted, because the task kept the old environment.
  foreach ($scope in @('User', 'Machine')) {
    $value = [Environment]::GetEnvironmentVariable($Name, $scope)
    if ($value) { return $value }
  }
  return [Environment]::GetEnvironmentVariable($Name, 'Process')
}

$MindmakeSettings = @('MINDMAKE_DRIVE_ROOT', 'MINDMAKE_MEDIA_INBOX', 'MINDMAKE_ARCHIVE_ROOT', 'MINDMAKE_POSTS_ROOT', 'MINDMAKE_INSPIRATION', 'MINDMAKE_MUSIC_ROOT', 'MINDMAKE_OVERNIGHT_ROLE')

function Sync-Settings {
  # This process's copy of each MINDMAKE_* setting, made equal to the
  # registry's, so the Python this pass starts (the matcher, music, working
  # files) sees a setting changed or deleted since the task started.
  foreach ($name in $MindmakeSettings) {
    $value = $null
    foreach ($scope in @('User', 'Machine')) {
      $found = [Environment]::GetEnvironmentVariable($name, $scope)
      if ($found) { $value = $found; break }
    }
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

function Test-StaleSetting([string]$Name, [string]$Code) {
  # A setting that names a folder that is not there. Only judged while H: is
  # up (the caller checks), so Google Drive starting late is not a stale path.
  $value = Get-Setting $Name
  if ($value -and [System.IO.Path]::IsPathRooted($value) -and -not (Test-Path -LiteralPath $value -PathType Container)) {
    Write-Log "the $Name setting on this machine names $value, which is not there. Delete the setting; config\studio.json says where things are."
    Add-Problem $Code
    return $true
  }
  return $false
}

function Resolve-MediaInbox($Config) {
  # runtime.media_inbox in config\studio.json (else the Drive root's Inbox),
  # unless MINDMAKE_MEDIA_INBOX names a folder that is there. A setting that
  # names a missing folder while studio.json's Inbox is there is stale: it is
  # reported and studio.json's is used. Null when nothing is set.
  $runtime = Get-Field $Config 'runtime'
  $configured = [string](Get-Field $runtime 'media_inbox')
  if (-not $configured) {
    $drive = Get-Setting 'MINDMAKE_DRIVE_ROOT'
    if (-not $drive) { $drive = [string](Get-Field $runtime 'drive_root') }
    if ($drive) { $configured = Join-Path $drive 'Inbox' }
  }
  $inbox = $configured
  $setting = Get-Setting 'MINDMAKE_MEDIA_INBOX'
  if ($setting) {
    if ((Test-Path -LiteralPath $setting -PathType Container) -or -not $configured -or -not (Test-Path -LiteralPath $configured -PathType Container)) {
      $inbox = $setting
    } else {
      Write-Log "MINDMAKE_MEDIA_INBOX on this machine names $setting, which is not there; using config\studio.json's Inbox $configured. Delete the setting."
      Add-Problem 'inbox_env_stale'
    }
  }
  if (-not $inbox -or -not [System.IO.Path]::IsPathRooted($inbox)) { return $null }
  return [System.IO.Path]::GetFullPath($inbox).TrimEnd('\')
}

function Resolve-EngineUrl {
  $url = $EngineUrl
  if (-not $url) { $url = $env:ENGINE_BASE_URL }
  if (-not $url) {
    # The one place the engine's address is written: scripts/engine.py.
    $helper = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'engine.py') -Raw -Encoding UTF8
    $match = [regex]::Match($helper, "os\.environ\.get\('ENGINE_BASE_URL',\s*'(https://[^']+)'\)")
    if (-not $match.Success) { throw 'The engine address could not be read from scripts\engine.py.' }
    $url = $match.Groups[1].Value
  }
  $uri = [System.Uri]$url.TrimEnd('/')
  if ($uri.Scheme -ne 'https' -or $uri.UserInfo -or ($uri.AbsolutePath -ne '/' -and $uri.AbsolutePath -ne '') -or $uri.Query) {
    throw 'The engine address must be https:// and nothing else.'
  }
  return $uri.GetLeftPart([System.UriPartial]::Authority)
}

function Get-RunnerToken {
  # The runner's own bearer, read the way the runner reads it: get-credential.ps1
  # in a separate process, its output captured and never shown.
  $reader = Join-Path $PSScriptRoot 'get-credential.ps1'
  $output = @(& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $reader -Target $RunnerCredential 2>$null)
  $token = ($output -join '').Trim()
  if ($LASTEXITCODE -ne 0 -or [System.Text.Encoding]::UTF8.GetByteCount($token) -lt 32) {
    throw "This machine has no runner key ($RunnerCredential) in Windows Credential Manager. The recordings upload runs on a runner machine (docs\ENGINE_SECRETS_HANDOVER.md)."
  }
  return $token
}

# ---- talking to the engine ---------------------------------------------------

function New-HttpClient([TimeSpan]$Timeout) {
  $handler = New-Object System.Net.Http.HttpClientHandler
  $handler.AllowAutoRedirect = $false
  $client = New-Object System.Net.Http.HttpClient($handler)
  $client.Timeout = $Timeout
  return $client
}

function Get-ErrorCode([string]$Body) {
  try {
    $parsed = $Body | ConvertFrom-Json
    $problem = Get-Field $parsed 'error'
    if ($problem -is [string]) { return $problem }
    $code = Get-Field $problem 'code'
    if ($code) { return [string]$code }
  } catch { }
  return ''
}

function Send-Engine($Client, [string]$Base, [string]$Token, [string]$Path, $Body) {
  # One POST on the runner bearer. Returns @{ status; body; code }.
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Post, "$Base$Path")
  $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token)
  $request.Headers.Accept.ParseAdd('application/json')
  $json = ConvertTo-Json -InputObject $Body -Depth 6 -Compress
  $request.Content = [System.Net.Http.StringContent]::new($json, [System.Text.Encoding]::UTF8, 'application/json')
  $response = $Client.SendAsync($request).GetAwaiter().GetResult()
  try {
    $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $parsed = $null
    try { $parsed = $text | ConvertFrom-Json } catch { }
    return @{ status = [int]$response.StatusCode; body = $parsed; code = (Get-ErrorCode $text) }
  } finally { $response.Dispose() }
}

function Invoke-Engine($Client, [string]$Base, [string]$Token, [string]$Path, $Body) {
  $answer = Send-Engine $Client $Base $Token $Path $Body
  if ($answer.status -ge 200 -and $answer.status -lt 300) { return $answer.body }
  $plain = switch ($answer.code) {
    'unauthorized' { "the engine refused this machine's runner key" }
    'runner_auth_unconfigured' { 'the engine has no runner key set' }
    'library_store_unavailable' { "the engine's storage cannot be reached, or its bucket is missing" }
    'library_store_misconfigured' { "the engine's library bucket is not set up as its migrations set it" }
    'recording_type_not_enabled' { "the engine's bucket does not take this type yet (an .mkv needs the recordings migration)" }
    'recording_object_conflict' { 'the engine holds different bytes under this sha256' }
    'recording_object_missing' { 'the upload did not arrive' }
    'recording_too_large' { 'the recording is over the 2 GiB the engine takes' }
    'invalid_recording_name' { 'the engine does not take a recording with this name' }
    'rate_limited' { 'the engine asked to slow down' }
    default { "the engine answered $($answer.status)" }
  }
  throw "POST $Path failed: $plain ($($answer.code))."
}

function Test-Engine($Client, [string]$Base, [string]$Token) {
  # Proves the key and the route without sending anything: the runner guard
  # answers before the body is read, so an empty body comes back 400 with an
  # invalid_recording_* code only when the key is accepted and the route is
  # deployed. The engine names the first field it finds missing (the name,
  # today), so any invalid_recording_* code proves it: on 2026-10-06 the check
  # expected only invalid_recording_request and refused a working machine.
  $answer = Send-Engine $Client $Base $Token '/api/library/recordings/upload-url' @{}
  if ($answer.status -eq 400 -and "$($answer.code)" -like 'invalid_recording*') { return }
  if ($answer.status -eq 404) { throw 'the engine has no recordings route yet: the recordings lane is not deployed.' }
  if ($answer.status -eq 401) { throw "the engine refused this machine's runner key." }
  throw "the engine answered $($answer.status) ($($answer.code))."
}

function Send-Upload($Client, [string]$Url, [string]$Path, [string]$ContentType) {
  # Streams one file to a signed upload URL. The file is opened to read only,
  # sharing it, so Google Drive and the Studio are never locked out of it.
  if (-not $ContentType) { throw 'the engine gave no content type for the upload' }
  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::ReadWrite)
  try {
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Put, $Url)
    $content = [System.Net.Http.StreamContent]::new($stream, 1048576)
    $content.Headers.ContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new($ContentType)
    $content.Headers.ContentLength = $stream.Length
    $request.Content = $content
    $response = $Client.SendAsync($request).GetAwaiter().GetResult()
    try { return [int]$response.StatusCode } finally { $response.Dispose() }
  } finally { $stream.Dispose() }
}

# ---- the recordings ----------------------------------------------------------

function Read-RecordingState {
  $saved = Read-JsonFile $StatePath
  $state = @{ sent = @{}; seen = @{}; too_large = @{} }
  foreach ($section in @('sent', 'seen', 'too_large')) {
    $value = Get-Field $saved $section
    if ($null -eq $value) { continue }
    foreach ($property in $value.PSObject.Properties) { $state[$section][$property.Name] = $property.Value }
  }
  return $state
}

function Sync-Recordings([string]$Inbox, [string]$Base, [string]$Token) {
  # Every finished recording in the Inbox, sent to the engine once. Reads the
  # Inbox and never writes there. A failure on one file never stops the rest.
  $result = @{ sent = 0; failed = 0 }
  $state = Read-RecordingState
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $started = Get-Date
  $seen = @{}
  $tooLarge = @{}
  # The newest first, so the one Krish has just dropped goes before any backlog.
  $files = @(Get-ChildItem -LiteralPath $Inbox -File -ErrorAction Stop |
    Where-Object { $RecordingExtensions -contains $_.Extension.ToLowerInvariant() -and -not $_.Name.StartsWith('.') -and -not ($_.Attributes -band [System.IO.FileAttributes]::Hidden) } |
    Sort-Object LastWriteTimeUtc -Descending)
  # Uploads get their own client: a 500 MiB file on a slow line takes a while.
  $uploader = New-HttpClient ([TimeSpan]::FromHours(2))
  $client = New-HttpClient ([TimeSpan]::FromMinutes(5))
  try {
    foreach ($file in $files) {
      $name = $file.Name.Normalize([System.Text.NormalizationForm]::FormC)
      $bytes = [int64]$file.Length
      $ticks = [string]$file.LastWriteTimeUtc.Ticks
      $key = '{0}|{1}|{2}' -f $name, $bytes, $ticks
      $seen[$name] = [ordered]@{ bytes = $bytes; ticks = $ticks }
      if ($state.sent.ContainsKey($key) -or $bytes -le 0) { continue }
      if ($bytes -gt $RecordingMaxBytes) {
        if (-not $state.too_large.ContainsKey($key)) { Write-Log "skipped $name : it is $bytes bytes, over the 2 GiB the engine takes" }
        $tooLarge[$key] = $now
        continue
      }
      # Finished: the same size and time as on the last pass, or untouched for two minutes.
      $before = $state.seen[$name]
      $steady = ($null -ne $before) -and ([int64](Get-Field $before 'bytes') -eq $bytes) -and ([string](Get-Field $before 'ticks') -eq $ticks)
      $age = ([DateTime]::UtcNow - $file.LastWriteTimeUtc).TotalSeconds
      if (-not $steady -and $age -lt $RecordingSettleSeconds) { continue }
      if (((Get-Date) - $started) -gt $PassBudget) {
        Write-Log 'this pass has run its time; the rest go on the next pass'
        break
      }
      if ($Check) { Write-Log "would send  $name  ($bytes bytes)"; continue }
      try {
        $sha = Get-Sha256 $file.FullName
        $md5 = (Get-FileHash -LiteralPath $file.FullName -Algorithm MD5).Hash.ToLowerInvariant()
        $file.Refresh()
        if ([int64]$file.Length -ne $bytes -or [string]$file.LastWriteTimeUtc.Ticks -ne $ticks) {
          Write-Log "$name changed while it was read; it is tried again on the next pass"
          continue
        }
        $request = [ordered]@{ name = $name; sha256 = $sha; md5 = $md5; bytes = $bytes }
        $answer = Invoke-Engine $client $Base $Token '/api/library/recordings/upload-url' $request
        $how = 'already there'
        if (-not (Get-Field $answer 'already_there')) {
          $upload = Get-Field $answer 'upload'
          $how = 'listed (the engine held these bytes already)'
          if ($null -ne $upload) {
            $address = [string](Get-Field $upload 'url')
            $url = [System.Uri]$address
            if ($url.Scheme -ne 'https' -or $url.UserInfo -or -not $url.AbsolutePath.StartsWith('/storage/v1/object/upload/sign/content-library/recordings/')) {
              throw 'the upload address is not the library storage'
            }
            $status = Send-Upload $uploader $address $file.FullName ([string](Get-Field (Get-Field $upload 'headers') 'Content-Type'))
            # 400 or 409: storage already holds these bytes, most likely sent by
            # the other runner machine a moment earlier. The confirm below
            # checks them; if they are still arriving, the next pass finds them.
            if (($status -lt 200 -or $status -ge 300) -and $status -ne 400 -and $status -ne 409) { throw "the upload answered $status" }
            $how = if ($status -ge 200 -and $status -lt 300) { 'sent' } else { 'listed (the other machine sent these bytes)' }
          }
          [void](Invoke-Engine $client $Base $Token '/api/library/recordings/confirm' $request)
        }
        $state.sent[$key] = [ordered]@{ sha256 = $sha; sent_at = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() }
        Save-JsonFile $StatePath ([ordered]@{ sent = $state.sent; seen = $state.seen; too_large = $state.too_large })
        Write-Log "$how  $name  ($bytes bytes, sha256 $sha)"
        $result.sent++
      } catch {
        $result.failed++
        Write-Log "could not send $name : $($_.Exception.Message). It is tried again on the next pass."
      }
    }
  } finally {
    $uploader.Dispose()
    $client.Dispose()
  }
  if (-not $Check) { Save-JsonFile $StatePath ([ordered]@{ sent = $state.sent; seen = $seen; too_large = $tooLarge }) }
  return $result
}

# ---- placing each take on its piece and cut ----------------------------------

function Invoke-StudioPython([string[]]$Arguments) {
  # The pinned Python, with these arguments. Returns @{ code; out; err }: what
  # it printed, and what it said on stderr apart. Under Continue, because
  # Windows PowerShell turns a line on stderr into an error under Stop. The
  # engine key never passes through here: scripts\engine.py reads it itself.
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $lines = @(& $StudioPython @Arguments 2>&1)
    $code = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previous }
  $out = @($lines | Where-Object { $_ -isnot [System.Management.Automation.ErrorRecord] } | ForEach-Object { [string]$_ })
  $err = @($lines | Where-Object { $_ -is [System.Management.Automation.ErrorRecord] } | ForEach-Object { $_.Exception.Message })
  return @{ code = $code; out = ($out -join "`n"); err = (($err -join ' ').Trim()) }
}

function Write-PlacingNote([string]$Message) {
  # A problem placing takes, logged once until it changes, so a machine
  # without the engine key does not log the same line every five minutes.
  if ($Message -eq $script:LastPlacingNote) { return }
  $script:LastPlacingNote = $Message
  Write-Log $Message
}

function Test-TakePlacing {
  # For -Check: what placing takes needs on this machine. The pinned Python,
  # faster_whisper inside it decoding a second of sound (an import alone
  # proves nothing: an unpinned pair imports and then fails on every take),
  # ffmpeg, and the engine key, proved by listing the engine's recordings
  # with it. Throws, naming which one is missing.
  if (-not (Test-Path -LiteralPath $StudioPython -PathType Leaf)) {
    throw "the pinned Python is not on this machine ($StudioPython), so takes cannot be placed here. Run npm run bootstrap:python in a copy of the repository (docs\OPERATIONS.md)."
  }
  $whisper = Invoke-StudioPython @($Matcher, '--check-transcriber')
  if ($whisper.code -ne 0) {
    throw "the pinned Python's faster_whisper cannot hear takes here ($($whisper.out)). Run npm run bootstrap:python in a copy of the repository (docs\OPERATIONS.md)."
  }
  if ($null -eq (Get-Command ffmpeg.exe -ErrorAction SilentlyContinue)) {
    throw 'ffmpeg is not on the PATH, so takes cannot be heard here.'
  }
  $listing = Invoke-StudioPython @($Lister, 'list', '--json')
  if ($listing.code -ne 0) {
    throw "the engine key could not list the recordings ($($listing.err)). Run scripts\engine-key.ps1 once on this machine (WORKBENCH.md, Pick up from any tool)."
  }
}

function Get-EngineTakes {
  # The sha256 of every take the engine holds, on the engine key
  # (recording.py list --json). Throws with the reason when it cannot.
  $listing = Invoke-StudioPython @($Lister, 'list', '--json')
  if ($listing.code -ne 0) { throw "the recordings could not be listed: $($listing.err)" }
  $parsed = $listing.out | ConvertFrom-Json
  $takes = @{}
  foreach ($item in @($parsed)) {
    $sha = [string](Get-Field $item 'sha256')
    if ($sha -match '^[0-9a-f]{64}$') { $takes[$sha] = $true }
  }
  return $takes
}

function Read-PlacingState {
  # claimed: the takes a piece holds, as the matcher last showed. later: when
  # to look again at a take no piece was waiting for, or one that failed.
  $saved = Read-JsonFile $PlacingStatePath
  $state = @{ claimed = @{}; later = @{} }
  foreach ($section in @('claimed', 'later')) {
    $value = Get-Field $saved $section
    if ($null -eq $value) { continue }
    foreach ($property in $value.PSObject.Properties) { $state[$section][$property.Name] = [int64]$property.Value }
  }
  return $state
}

function Invoke-TakePlacing {
  # Runs the matcher only when the engine holds a take that no piece claims,
  # that the answered book does not hold, and that is not waiting for a later
  # look. Returns $true when nothing failed.
  if (-not (Test-Path -LiteralPath $StudioPython -PathType Leaf)) {
    Write-PlacingNote "takes are not placed from this machine: the pinned Python is not at $StudioPython (npm run bootstrap:python). The other machine still places them."
    return $false
  }
  $takes = Get-EngineTakes
  $answered = @{}
  $book = Read-JsonFile $AnsweredPath
  if ($null -ne $book) { foreach ($property in $book.PSObject.Properties) { $answered[$property.Name] = $true } }
  $state = Read-PlacingState
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $unknown = @($takes.Keys | Where-Object { -not $answered.ContainsKey($_) -and -not $state.claimed.ContainsKey($_) })
  $due = @($unknown | Where-Object { -not $state.later.ContainsKey($_) -or $state.later[$_] -le $now })
  if ($due.Count -eq 0) { return $true }
  if ($Check) {
    Write-Log "Checking only: nothing is placed. $($due.Count) take(s) the engine holds are on no piece and in no answer yet; a pass would run the matcher on them."
    return $true
  }
  $run = Invoke-StudioPython @($Matcher, '--record', '--board', '--by', $MatchBy, '--json')
  $report = $null
  try { $report = $run.out | ConvertFrom-Json } catch { }
  # Get-Field would give an empty list back as nothing, so ask for the property itself.
  if ($null -eq $report -or $null -eq $report.PSObject.Properties['files']) {
    Write-PlacingNote "takes were not placed: the matcher stopped ($($run.code)): $($run.err)"
    return $false
  }
  $script:LastPlacingNote = ''
  foreach ($line in @(Get-Field $report 'lines')) { if ($line) { Write-Log "match: $line" } }
  # What the matcher said about each take it looked at, by sha256.
  $looked = @{}
  foreach ($file in @(Get-Field $report 'files')) {
    $sha = [string](Get-Field $file 'sha256')
    if ($sha) { $looked[$sha] = [string](Get-Field $file 'status') }
  }
  $claimed = @{}
  $later = @{}
  if (@(Get-Field $report 'waiting').Count -gt 0) {
    # A piece was waiting, so the matcher looked at every take no piece holds:
    # a take it did not look at is one a piece holds.
    foreach ($sha in $takes.Keys) { if (-not $looked.ContainsKey($sha)) { $claimed[$sha] = $now } }
  } else {
    foreach ($sha in $unknown) { $later[$sha] = $now + 60 * $NoPieceRetryMinutes }
  }
  foreach ($recorded in @(Get-Field $report 'recorded')) {
    $match = [regex]::Match([string](Get-Field $recorded 'path'), '[0-9a-f]{64}')
    if ($match.Success) { $claimed[$match.Value] = $now }
  }
  foreach ($sha in $looked.Keys) {
    if ($looked[$sha] -eq 'failed') { $later[$sha] = $now + 60 * $FailedRetryMinutes }
    elseif ($looked[$sha] -eq 'old') { $later[$sha] = $now + 60 * $OldRetryMinutes }
  }
  # Only the takes the engine still holds are kept, so the state stays small.
  foreach ($sha in $state.claimed.Keys) { if ($takes.ContainsKey($sha) -and -not $claimed.ContainsKey($sha)) { $claimed[$sha] = $state.claimed[$sha] } }
  Save-JsonFile $PlacingStatePath ([ordered]@{ claimed = $claimed; later = $later })
  $placed = @(Get-Field $report 'recorded').Count
  $asked = @(Get-Field $report 'asked').Count
  $ended = @(Get-Field $report 'closed').Count
  Write-Log "placed and recorded $placed take(s) on their piece; held $asked question(s) on the board for a session and closed $ended (the matcher answered $($run.code))"
  return ($run.code -ne 1)
}

# ---- a pass: send, then place --------------------------------------------------

function Invoke-Pass {
  # One pass: every finished recording sent to the engine, then every take no
  # piece holds yet placed on its piece and cut. A problem with one never
  # stops the other. Returns $true when both went through.
  $sent = $true
  $script:Problems.Clear()
  if ($Loop) { Sync-Settings }
  $config = Get-StudioConfig
  $inbox = Resolve-MediaInbox $config
  if ($inbox -and $script:FirstPass -and -not (Test-Path -LiteralPath $inbox -PathType Container)) {
    # Right after a restart the first pass can run before Google Drive has
    # mounted H:. One wait, then the pass goes on either way.
    Write-Log "the Inbox $inbox is not there yet; waiting a minute for Google Drive to start"
    Start-Sleep -Seconds 60
    $script:Problems.Clear()
    $inbox = Resolve-MediaInbox $config
  }
  $script:FirstPass = $false
  if (-not $inbox) {
    Write-Log 'no Inbox is set (MINDMAKE_MEDIA_INBOX, or runtime.media_inbox or drive_root in config\studio.json); nothing to send'
    $sent = (-not $Check)
  } elseif (-not (Test-Path -LiteralPath $inbox -PathType Container)) {
    Write-Log "the Inbox $inbox cannot be reached. Check that Google Drive is running and signed in, and that config\studio.json runtime.media_inbox is the Inbox's path."
    Add-Problem 'inbox_unreachable'
    $sent = $false
  } else {
    # H: is up, so a setting or a folder that is not there is a real fault.
    [void](Test-StaleSetting 'MINDMAKE_DRIVE_ROOT' 'drive_root_env_stale')
    [void](Test-StaleSetting 'MINDMAKE_ARCHIVE_ROOT' 'archive_env_stale')
    $base = Resolve-EngineUrl
    $token = Get-RunnerToken
    if ($Check) {
      $probe = New-HttpClient ([TimeSpan]::FromMinutes(2))
      try { Test-Engine $probe $base $token } finally { $probe.Dispose() }
      Write-Log "Checking only: nothing is sent. Inbox: $inbox. The engine accepts this machine's runner key."
    }
    $result = Sync-Recordings $inbox $base $token
    if ($result.sent -gt 0 -or $result.failed -gt 0) { Write-Log "sent or listed $($result.sent) recording(s); $($result.failed) could not be sent and will be tried again" }
    if ($result.failed -gt 0) { Add-Problem 'sending_failed' }
    $sent = ($result.failed -eq 0)
  }
  $script:PassSent = $sent
  if ($Check) {
    # Placing is checked on its own: a machine that cannot place takes yet
    # still sends (exit 3, which the installer installs past).
    try {
      Test-TakePlacing
      Write-Log 'The pinned Python hears takes and the engine key lists them: this machine places takes on their piece and cut.'
    } catch {
      $script:PlacingNotReady = $_.Exception.Message
      Write-Log "Placing takes is not ready on this machine: $($script:PlacingNotReady) Sending is not affected."
    }
  }
  $placed = $true
  if ($Check -and $script:PlacingNotReady) { $placed = $false }
  else {
    try { $placed = Invoke-TakePlacing }
    catch {
      Write-PlacingNote "takes were not placed this pass: $($_.Exception.Message)"
      $placed = $false
    }
  }
  if (-not (Test-Path -LiteralPath $StudioPython -PathType Leaf)) { Add-Problem 'pinned_python_missing' }
  elseif (-not $placed) { Add-Problem 'placing_failed' }
  if (-not $Check) {
    # The licensed music goes to the engine's library too, so any machine
    # that renders (GitHub's, a cloud session) has it without H: (Krish,
    # 2026-10-12: "the audio is literally in the drive"). A file the library
    # holds already is left alone; a problem here never stops a pass.
    try { Publish-Music } catch { Write-Log "the music was not published this pass: $($_.Exception.Message)"; Add-Problem 'music_publish_failed' }
    # The style references Krish drops in Ventures > Inspiration > Production Inspo go to
    # the library too, so any session can study them (docs/STYLE_REFERENCES.md;
    # Krish, 2026-10-14: "a folder where I can put videos that I really like
    # ... so that you can learn from them"). Never a reason to fail a pass.
    try { Publish-References } catch { Write-Log "the style references were not published this pass: $($_.Exception.Message)"; Add-Problem 'references_publish_failed' }
    try { Publish-Working } catch { Write-Log "the working files were not published this pass: $($_.Exception.Message)"; Add-Problem 'working_publish_failed' }
    try { Invoke-WatchKeeper } catch { Write-Log "the content watcher was not checked this pass: $($_.Exception.Message)" }
    try { Invoke-Windows } catch { Write-Log "the scheduled tasks' windows were not checked this pass: $($_.Exception.Message)" }
    try { Invoke-Preflight } catch { Write-Log "the Saturday overnight preflight did not run this pass: $($_.Exception.Message)" }
    try { Invoke-Overnight } catch { Write-Log "the overnight run was not checked this pass: $($_.Exception.Message)" }
    Send-LaneReport
  }
  return ($sent -and $placed)
}

function Publish-Music {
  if (-not (Test-Path -LiteralPath $StudioPython -PathType Leaf)) { return }
  $music = Join-Path $RepoRoot 'scripts\quick-edit\music.py'
  $run = Invoke-StudioPython @($music, 'publish')
  if ($run.code -ne 0) { Write-Log "music publish: $($run.err) $($run.out)"; Add-Problem 'music_publish_failed'; return }
  if ($run.out -match 'sent\s+1 Brand kit' -or $run.out -match '[1-9]\d* sent') { Write-Log "music published: $($run.out -replace "`n", ' | ')" }
}

function Publish-References {
  if (-not (Test-Path -LiteralPath $StudioPython -PathType Leaf)) { return }
  $references = Join-Path $RepoRoot 'scripts\quick-edit\references.py'
  $run = Invoke-StudioPython @($references, 'publish')
  if ($run.code -ne 0) { Write-Log "style references publish: $($run.err) $($run.out)"; Add-Problem 'references_publish_failed'; return }
  if ($run.out -match '"sent":\s*[1-9]') { Write-Log "style references published: $($run.out -replace "`n", ' | ')" }
}

function Publish-Working {
  # A post's "working <date>" folders on Drive go to the library, so a cloud
  # session fetches a session's saved work (scripts/post-pack/working.py).
  if (-not (Test-Path -LiteralPath $StudioPython -PathType Leaf)) { return }
  $working = Join-Path $RepoRoot 'scripts\post-pack\working.py'
  $run = Invoke-StudioPython @($working, 'publish')
  if ($run.code -ne 0) { Write-Log "working files publish: $($run.err) $($run.out)"; Add-Problem 'working_publish_failed'; return }
  if ($run.out -match '"sent":\s*[1-9]') { Write-Log "working files published: $($run.out -replace "`n", ' | ')" }
}

# ---- the content watcher on this machine --------------------------------------
# krishanraja/content-watcher fetches and reads the links Krish pastes on the
# Inspiration board, from its own scheduled task. On 25 and 26 October 2026 that
# task stopped on both machines and nothing outside them could see it: Krish was
# asked to open Task Scheduler and paste its log. Krish, 2026-10-28: "i should
# never really need to copy and paste log files to you like this, ever, this is
# ridiculous". So this pass, which runs every five minutes and updates itself,
# keeps the watcher up to date, starts a run when none has logged lately, stops
# a run that is stuck, and sends the watcher's health with its own report
# (api/library/_lanes.ts, watch). A session reads it back with
# GET /api/library/recordings/lane on the engine key. Nothing here ever stops a
# recordings pass.
$WatchTaskName = 'Mindmake Content Watcher'
$WatchQuietMinutes = 6    # no log line for this long and no run under way: start one (its own trigger runs every minute)
$WatchStuckMinutes = 25   # one stage held this long: the run is stuck (a run ends itself after 20)
$WatchDownMinutes = 15    # still no log line this long after this pass first started it: report it
$WatchTimeLimit = 'PT30M'
$WatchRepairEveryMinutes = 60
# 0x8007010B, "The directory name is invalid": the task's Start in folder is not there. Both machines answered this
# on 28 October 2026, after the watcher had been silent since 25 and 26 October.
$WatchBadDirectory = 2147942667

function ConvertTo-UtcTime([string]$Text) {
  if (-not $Text) { return $null }
  $styles = [System.Globalization.DateTimeStyles]::AssumeUniversal -bor [System.Globalization.DateTimeStyles]::AdjustToUniversal
  $value = [DateTime]::MinValue
  if ([DateTime]::TryParse($Text, [System.Globalization.CultureInfo]::InvariantCulture, $styles, [ref]$value)) { return $value }
  return $null
}

function Read-WatchLogLine {
  # The watcher's last log line: its time and its counts (class names only).
  $path = Join-Path $env:LOCALAPPDATA 'content-watcher\watch.log'
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $null }
  $last = @(Get-Content -LiteralPath $path -Tail 1 -Encoding UTF8 -ErrorAction SilentlyContinue)
  if ($last.Count -eq 0 -or -not $last[0]) { return $null }
  $line = [string]$last[0]
  $space = $line.IndexOf(' ')
  if ($space -lt 10) { return $null }
  $counts = [ordered]@{}
  try {
    $parsed = $line.Substring($space + 1) | ConvertFrom-Json
    foreach ($property in $parsed.PSObject.Properties) {
      if ($property.Value -is [int] -or $property.Value -is [long]) { $counts[$property.Name] = [int]$property.Value }
    }
  } catch { }
  return @{ at = $line.Substring(0, $space); time = (ConvertTo-UtcTime $line.Substring(0, $space)); counts = $counts }
}

function Read-WatchRecent([int]$Hours = 6) {
  # Every log line of the last few hours, summed by key (class names only). The last line alone hides a failure:
  # on 28 October an Instagram post spent its three tries in five minutes and the next minute's run said claimed 0.
  $path = Join-Path $env:LOCALAPPDATA 'content-watcher\watch.log'
  $sum = [ordered]@{}
  if (-not (Test-Path -LiteralPath $path -PathType Leaf)) { return $sum }
  $since = [DateTime]::UtcNow.AddHours(-$Hours)
  foreach ($line in @(Get-Content -LiteralPath $path -Tail (60 * $Hours + 30) -Encoding UTF8 -ErrorAction SilentlyContinue)) {
    $text = [string]$line
    $space = $text.IndexOf(' ')
    if ($space -lt 10) { continue }
    $time = ConvertTo-UtcTime $text.Substring(0, $space)
    if ($null -eq $time -or $time -lt $since) { continue }
    try { $parsed = $text.Substring($space + 1) | ConvertFrom-Json } catch { continue }
    foreach ($property in $parsed.PSObject.Properties) {
      if ($property.Name -eq 'seconds') { continue }
      if ($property.Value -is [int] -or $property.Value -is [long]) {
        if ($sum.Contains($property.Name)) { $sum[$property.Name] = [int]$sum[$property.Name] + [int]$property.Value }
        else { $sum[$property.Name] = [int]$property.Value }
      }
    }
  }
  return $sum
}

function Update-Watcher([string]$Repo, [string]$Python) {
  # Brings the watcher's own clone up to date (it is installed editable, so new
  # code runs at once) and installs its dependencies again when they changed.
  # Returns the short HEAD, or $null when this is not a git clone.
  $git = Get-Command git.exe -ErrorAction SilentlyContinue
  if ($null -eq $git -or -not (Test-Path -LiteralPath (Join-Path $Repo '.git'))) { return $null }
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $before = (& $git.Source -C $Repo rev-parse HEAD 2>$null | Select-Object -First 1)
    $output = @(& $git.Source -C $Repo pull --ff-only --quiet 2>&1)
    $pulled = ($LASTEXITCODE -eq 0)
    $after = (& $git.Source -C $Repo rev-parse HEAD 2>$null | Select-Object -First 1)
    if (-not $pulled) {
      Write-Log "the content watcher was not updated: git pull did not finish ($($output -join ' '))"
      Add-Problem 'watch_update_failed'
    } elseif ($before -and $after -and $before -ne $after) {
      $changed = @(& $git.Source -C $Repo diff --name-only $before $after -- pyproject.toml 2>$null)
      if ($changed.Count -gt 0) {
        $pip = @(& $Python -m pip install --quiet --upgrade -e "$($Repo)[watch]" 2>&1)
        if ($LASTEXITCODE -ne 0) {
          Write-Log "the content watcher's dependencies were not installed: $(($pip | Select-Object -Last 3) -join ' ')"
          Add-Problem 'watch_update_failed'
        } else { [void]$script:Watch.repaired.Add('installed_dependencies') }
      }
      Write-Log "the content watcher was updated to $($after.Substring(0, 7))"
      [void]$script:Watch.repaired.Add('updated')
    }
    if ($after) { return $after.Substring(0, 7) }
    return $null
  } finally { $ErrorActionPreference = $previous }
}

function Test-WatcherClone([string]$Path) {
  if (-not $Path) { return $false }
  return ((Test-Path -LiteralPath (Join-Path $Path 'content_watcher\watch.py') -PathType Leaf) -and
    (Test-Path -LiteralPath (Join-Path $Path 'scripts\install-content-watch.ps1') -PathType Leaf))
}

function Find-WatcherClone([string]$Was) {
  # Where the watcher's clone is now. The repository was renamed from video-compression to content-watcher on
  # 24 October 2026, and a folder can move with a rename: look beside where the task pointed, beside this clone,
  # and in the dev folder and each folder in it.
  $bases = New-Object System.Collections.Generic.List[string]
  if ($Was) { $bases.Add((Split-Path -Parent $Was)) }
  $bases.Add((Split-Path -Parent $RepoRoot))
  $bases.Add((Split-Path -Parent (Split-Path -Parent $RepoRoot)))
  $dev = Join-Path $env:USERPROFILE 'dev'
  if (Test-Path -LiteralPath $dev -PathType Container) {
    $bases.Add($dev)
    foreach ($child in @(Get-ChildItem -LiteralPath $dev -Directory -ErrorAction SilentlyContinue)) { $bases.Add($child.FullName) }
  }
  foreach ($base in $bases) {
    if (-not $base) { continue }
    foreach ($name in @('content-watcher', 'video-compression')) {
      $candidate = Join-Path $base $name
      if (Test-WatcherClone $candidate) { return $candidate }
    }
  }
  return $null
}

function Repair-WatchTask([string]$Was) {
  # The task cannot start: its folder is gone, or Windows says the folder is invalid. Runs the watcher's own
  # installer from wherever its clone is now, which installs the package from there and registers the task again
  # (krishanraja/content-watcher scripts/install-content-watch.ps1). With no clone on this machine, the public
  # repository is cloned where the old one was. At most once an hour; the report says how it went either way.
  if ($script:WatchRepairAt -and ([DateTime]::UtcNow - $script:WatchRepairAt).TotalMinutes -lt $WatchRepairEveryMinutes) {
    if ($script:WatchRepairOutcome -ne 'ok') { Add-Problem 'watch_task_broken' }
    return
  }
  $script:WatchRepairAt = [DateTime]::UtcNow
  $script:WatchRepairOutcome = 'failed'
  $clone = Find-WatcherClone $Was
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    if (-not $clone) {
      $git = Get-Command git.exe -ErrorAction SilentlyContinue
      $parent = if ($Was) { Split-Path -Parent $Was } else { $null }
      if (-not $parent -or -not (Test-Path -LiteralPath $parent -PathType Container)) { $parent = Join-Path $env:USERPROFILE 'dev' }
      $target = Join-Path $parent 'content-watcher'
      if ($null -ne $git -and -not (Test-Path -LiteralPath $target)) {
        $output = @(& $git.Source clone --quiet https://github.com/krishanraja/content-watcher.git $target 2>&1)
        if ($LASTEXITCODE -eq 0 -and (Test-WatcherClone $target)) {
          $clone = $target
          [void]$script:Watch.repaired.Add('cloned_watcher')
          Write-Log "the content watcher was cloned to $target"
        } else { Write-Log "the content watcher could not be cloned: $($output -join ' ')" }
      }
    }
    if ($clone) {
      $installer = Join-Path $clone 'scripts\install-content-watch.ps1'
      $output = @(& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $installer 2>&1)
      if ($LASTEXITCODE -eq 0) {
        $script:WatchRepairOutcome = 'ok'
        [void]$script:Watch.repaired.Add('reinstalled_task')
        Write-Log "the content watcher's task was registered again from $clone"
      } else { Write-Log "the content watcher could not be installed again from ${clone}: $(($output | Select-Object -Last 3) -join ' ')" }
    } else { Write-Log "the content watcher's clone is not on this machine" }
  } finally { $ErrorActionPreference = $previous }
  if ($script:WatchRepairOutcome -ne 'ok') { Add-Problem 'watch_task_broken' }
}

function Invoke-WatchKeeper {
  $script:Watch = @{ repaired = (New-Object System.Collections.Generic.List[string]) }
  $task = Get-ScheduledTask -TaskName $WatchTaskName -ErrorAction SilentlyContinue
  if ($null -eq $task) { Add-Problem 'watch_not_installed'; return }
  $action = @($task.Actions)[0]
  $repo = ([string](Get-Field $action 'WorkingDirectory')).Trim('"')
  $info = Get-ScheduledTaskInfo -TaskName $WatchTaskName -ErrorAction SilentlyContinue
  if (-not (Test-WatcherClone $repo) -or ($info -and [int64]$info.LastTaskResult -eq $WatchBadDirectory)) {
    Repair-WatchTask $repo
    $task = Get-ScheduledTask -TaskName $WatchTaskName -ErrorAction SilentlyContinue
    if ($null -eq $task) { Add-Problem 'watch_not_installed'; return }
    $action = @($task.Actions)[0]
    $repo = ([string](Get-Field $action 'WorkingDirectory')).Trim('"')
  }
  $pythonw = [string](Get-Field $action 'Execute')
  $python = Join-Path (Split-Path -Parent $pythonw) 'python.exe'
  if (-not (Test-Path -LiteralPath $python -PathType Leaf)) { $python = $pythonw }
  if ($repo -and (Test-Path -LiteralPath $repo -PathType Container)) { $script:Watch.head = Update-Watcher $repo $python }

  # The task itself: on, and never allowed to hold a run for hours.
  try {
    if ($task.State -eq 'Disabled') {
      [void](Enable-ScheduledTask -TaskName $WatchTaskName -ErrorAction Stop)
      [void]$script:Watch.repaired.Add('enabled_task')
      $task = Get-ScheduledTask -TaskName $WatchTaskName
    }
    if ($task.Settings.ExecutionTimeLimit -ne $WatchTimeLimit) {
      $settings = $task.Settings
      $settings.ExecutionTimeLimit = $WatchTimeLimit
      [void](Set-ScheduledTask -TaskName $WatchTaskName -Settings $settings -ErrorAction Stop)
      [void]$script:Watch.repaired.Add('shortened_time_limit')
      $task = Get-ScheduledTask -TaskName $WatchTaskName
    }
  } catch { Write-Log "the content watcher's task settings were not changed: $($_.Exception.Message)" }

  $now = [DateTime]::UtcNow
  $log = Read-WatchLogLine
  $beat = Read-JsonFile (Join-Path $env:LOCALAPPDATA 'content-watcher\watch.heartbeat')
  $beatAt = ConvertTo-UtcTime ([string](Get-Field $beat 'at'))
  $quiet = ($null -eq $log -or $null -eq $log.time -or ($now - $log.time).TotalMinutes -ge $WatchQuietMinutes)
  # A run under way says so in its heartbeat: a stage other than done, written within the stuck limit. A long read
  # (a video heard by whisper) holds one stage for minutes and is left alone.
  $underWay = ([string](Get-Field $beat 'stage') -ne 'done' -and $null -ne $beatAt -and ($now - $beatAt).TotalMinutes -lt $WatchStuckMinutes)
  try {
    if ($quiet -and -not $underWay) {
      if ($task.State -eq 'Running') {
        Stop-ScheduledTask -TaskName $WatchTaskName -ErrorAction Stop
        [void]$script:Watch.repaired.Add('stopped_stuck_run')
        Write-Log 'the content watcher had a run that was not moving; it was stopped'
      }
      if ($script:WatchStartedAt -and ($now - $script:WatchStartedAt).TotalMinutes -ge $WatchDownMinutes) { Add-Problem 'watch_not_running' }
      Start-ScheduledTask -TaskName $WatchTaskName -ErrorAction Stop
      if (-not $script:WatchStartedAt) { $script:WatchStartedAt = $now }
      [void]$script:Watch.repaired.Add('started_run')
    } elseif (-not $quiet) { $script:WatchStartedAt = $null }
  } catch { Write-Log "the content watcher could not be started: $($_.Exception.Message)"; Add-Problem 'watch_run_failed' }

  # What its last run said, as a problem Control Center names.
  if ($null -ne $log) {
    $keys = @($log.counts.Keys)
    if ($keys | Where-Object { $_ -in @('engine.no_engine_key', 'engine.engine_refused_key') }) { Add-Problem 'watch_key_problem' }
    elseif ($keys | Where-Object { $_ -like 'engine.*' }) { Add-Problem 'watch_cannot_reach_engine' }
    if ($keys | Where-Object { $_ -like 'run.error.*' -or $_ -eq 'killed.over_time' }) { Add-Problem 'watch_run_failed' }
  }
  $info = Get-ScheduledTaskInfo -TaskName $WatchTaskName -ErrorAction SilentlyContinue
  $script:Watch.last_run_at = if ($log) { $log.at } else { $null }
  $script:Watch.counts = if ($log) { $log.counts } else { @{} }
  $script:Watch.recent = Read-WatchRecent
  $script:Watch.stage = [string](Get-Field $beat 'stage')
  $script:Watch.stage_at = [string](Get-Field $beat 'at')
  $script:Watch.task_state = [string]$task.State
  $script:Watch.task_result = if ($info) { [int64]$info.LastTaskResult } else { $null }
}

function Get-WatchBlock {
  if ($null -eq $script:Watch) { return $null }
  $block = [ordered]@{}
  foreach ($name in @('last_run_at', 'counts', 'recent', 'stage', 'stage_at', 'task_state', 'task_result', 'head')) {
    if ($script:Watch.ContainsKey($name) -and $null -ne $script:Watch[$name] -and $script:Watch[$name] -ne '') { $block[$name] = $script:Watch[$name] }
  }
  $block['repaired'] = @($script:Watch.repaired)
  return $block
}

function Invoke-Windows {
  # Each pass: no task of his opens a window. Counts reach the engine in the report's windows block; what changed is
  # in changed.log beside run-hidden.exe on this machine.
  $script:Windows = $null
  if (-not (Get-Command Invoke-WindowKeeper -ErrorAction SilentlyContinue)) { return }
  $result = Invoke-WindowKeeper
  $script:Windows = $result
  if ($result.launcher -ne 'ok') { Write-Log "run-hidden.exe is not ready on this machine: $($result['error'])"; return }
  if ($result.wrapped) { Write-Log "$($result.wrapped) scheduled task(s) now run with no window" }
  if ($result.left) { Write-Log "$($result.left) scheduled task(s) still open a window and could not be changed: $($result['error'])" }
}

function Get-WindowsBlock {
  if ($null -eq $script:Windows) { return $null }
  return [ordered]@{
    launcher = [string]$script:Windows.launcher
    hidden = [int]$script:Windows.hidden
    wrapped = [int]$script:Windows.wrapped
    left = [int]$script:Windows.left
    left_by = $script:Windows['left_by']
    left_names = @($script:Windows['left_names'])
  }
}

function Send-LaneReport {
  # What this pass found, to the engine, so a problem here reaches Control
  # Center (api/library/_lanes.ts). An empty list says this machine is well.
  # A report that cannot be sent is logged and never stops the pass.
  try {
    $base = Resolve-EngineUrl
    $token = Get-RunnerToken
    $machine = ($env:COMPUTERNAME -replace '[^A-Za-z0-9_-]', '-')
    $client = New-HttpClient ([TimeSpan]::FromMinutes(2))
    try {
      $report = [ordered]@{ machine = $machine; problems = @($script:Problems) }
      $watch = Get-WatchBlock
      if ($null -ne $watch) { $report['watch'] = $watch }
      $windows = Get-WindowsBlock
      if ($null -ne $windows) { $report['windows'] = $windows }
      $preflight = Get-PreflightBlock
      if ($null -ne $preflight) { $report['preflight'] = $preflight }
      if ($null -ne $script:Overnight) { $report['overnight'] = $script:Overnight }
      [void](Invoke-Engine $client $base $token '/api/library/recordings/lane' $report)
    } finally { $client.Dispose() }
  } catch {
    Write-Log "this pass's report did not reach the engine: $($_.Exception.Message)"
  }
}

# ---- the Saturday overnight preflight ------------------------------------------
# Plan Wave 1, the clock's "Sat 18:00 Preflight" row (checkpoint preflight_ok): Wave 2 builds the overnight runner, and
# this proves a week early whether this machine could run it unattended. scripts\overnight\preflight.ps1 only reads and
# runs version and help commands; it starts every program with no window, and this starts it from this hidden pass, so
# nothing shows on his screen (Krish, 2026-10-28: "HIDE ALL CONSOLE POP UPS FOREVER FROM EVERY REPO AND LOCAL TASK").
# Its result is kept beside this log and its report rides on every lane report after. Nothing here stops a pass.

function Test-PreflightDue($Last, [DateTime]$Now) {
  # Once each Saturday from $PreflightHour local. A run that failed is tried once more $PreflightRetryMinutes later,
  # then stands until the next Saturday.
  if ($Now.DayOfWeek -ne [DayOfWeek]::Saturday -or $Now.Hour -lt $PreflightHour) { return $false }
  $today = $Now.ToString('yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture)
  if ($null -eq $Last -or [string](Get-Field $Last 'local_date') -ne $today) { return $true }
  if ([bool](Get-Field $Last 'ok') -or [int](Get-Field $Last 'attempt') -ge 2) { return $false }
  $at = ConvertTo-UtcTime ([string](Get-Field $Last 'at'))
  return ($null -eq $at -or ($Now.ToUniversalTime() - $at).TotalMinutes -ge $PreflightRetryMinutes)
}

function Invoke-Preflight {
  $last = Read-JsonFile $PreflightStatePath
  $script:Preflight = $last
  if ((Test-PreflightDue $last (Get-Date)) -and (Test-Path -LiteralPath $PreflightScript -PathType Leaf)) {
    Write-Log 'the Saturday overnight preflight is running (scripts\overnight\preflight.ps1: it reads, and changes nothing)'
    # Under Continue, as every child here runs: Windows PowerShell turns a line on stderr into an error under Stop.
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
      $output = @(& powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $PreflightScript -RepoRoot $RepoRoot 2>$null)
    } finally { $ErrorActionPreference = $previous }
    # Its one JSON line, read whole even if a host wrapped it (a JSON string never holds a bare line break).
    $result = $null
    $text = (@($output | ForEach-Object { [string]$_ }) -join '').Trim()
    $start = $text.IndexOf('{')
    if ($start -ge 0) { try { $result = $text.Substring($start) | ConvertFrom-Json } catch { $result = $null } }
    $now = Get-Date
    if ($null -eq $result -or [string](Get-Field $result 'kind') -ne 'overnight_preflight') {
      # A preflight that did not finish is a failed one, so it is tried once more and reported.
      $at = $now.ToUniversalTime().ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [System.Globalization.CultureInfo]::InvariantCulture)
      $result = [pscustomobject][ordered]@{
        schema_version = 1; kind = 'overnight_preflight'; at = $at
        local_date = $now.ToString('yyyy-MM-dd', [System.Globalization.CultureInfo]::InvariantCulture)
        ok = $false; failed = @('preflight_stopped')
        report = [pscustomobject][ordered]@{ at = $at; ok = $false; failed = @('preflight_stopped') }
      }
    }
    $attempt = 1
    if ($null -ne $last -and [string](Get-Field $last 'local_date') -eq [string](Get-Field $result 'local_date')) { $attempt = 1 + [int](Get-Field $last 'attempt') }
    $result | Add-Member -NotePropertyName 'attempt' -NotePropertyValue $attempt -Force
    Save-JsonFile $PreflightStatePath $result
    $script:Preflight = $result
    if ([bool](Get-Field $result 'ok')) { Write-Log 'the Saturday overnight preflight passed: this machine could run the overnight production unattended' }
    else { Write-Log "the Saturday overnight preflight failed: $(@(Get-Field $result 'failed') -join ', ') (preflight.json beside this log says why)" }
  }
  if ($null -ne $script:Preflight -and -not [bool](Get-Field $script:Preflight 'ok')) {
    $at = ConvertTo-UtcTime ([string](Get-Field $script:Preflight 'at'))
    if ($null -ne $at -and ([DateTime]::UtcNow - $at).TotalHours -lt $PreflightFailedHours) { Add-Problem 'preflight_failed' }
  }
}

# ---- the overnight run ---------------------------------------------------------
# Plan Wave 2, W2.6: "His titles press tells the engine. The home runner starts the overnight run on the primary
# computer, and the standby computer takes the shorts." No Claude runs on a timer (Ruling, Krish, 2026-10-29: "FYI, I
# want zero Claude routines. No Claude schedules of any kind in this architecture"): this pass, already polling the
# engine every five minutes with no window, asks scripts\overnight\overnight.py due from Saturday to Monday noon, and
# once every picked day of the week has its Titles press it starts the run once, as this machine's role, with no window
# (Krish, 2026-10-28: "HIDE ALL CONSOLE POP UPS FOREVER"). A machine with no role set starts nothing. The run's own
# record rides on every lane report after, as codes and times only. Nothing here stops a pass.

function Get-OvernightRole {
  $role = ([string](Get-Setting 'MINDMAKE_OVERNIGHT_ROLE')).Trim().ToLowerInvariant()
  if (@('primary', 'standby') -contains $role) { return $role }
  return $null
}

function Test-OvernightWindow([DateTime]$Now) {
  # Saturday, Sunday, or Monday before noon: when a Titles press can start the night.
  if ($Now.DayOfWeek -eq [DayOfWeek]::Saturday -or $Now.DayOfWeek -eq [DayOfWeek]::Sunday) { return $true }
  return ($Now.DayOfWeek -eq [DayOfWeek]::Monday -and $Now.Hour -lt 12)
}

function Start-Hidden([string]$Program, [string]$Arguments) {
  # A long run, started with no window and left running when this pass ends; its own record says how it went.
  $start = New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName = $Program
  $start.Arguments = $Arguments
  $start.WorkingDirectory = $RepoRoot
  $start.UseShellExecute = $false
  $start.CreateNoWindow = $true
  $process = [System.Diagnostics.Process]::Start($start)
  try { return $process.Id } finally { $process.Dispose() }
}

function Read-LastJson([string]$Text) {
  $lines = @(([string]$Text).Trim() -split "`r?`n" | Where-Object { $_.Trim().StartsWith('{') })
  if (-not $lines.Count) { return $null }
  try { return ($lines[-1] | ConvertFrom-Json) } catch { return $null }
}

function Invoke-Overnight {
  $role = Get-OvernightRole
  if (-not $role -or -not (Test-Path -LiteralPath $OvernightScript -PathType Leaf) -or -not (Test-Path -LiteralPath $StudioPython -PathType Leaf)) { return }
  if (Test-OvernightWindow (Get-Date)) {
    $due = Invoke-StudioPython @($OvernightScript, 'due', '--json')
    $answer = Read-LastJson $due.out
    $week = [string](Get-Field $answer 'week')
    $last = Read-JsonFile $OvernightStatePath
    if ($due.code -eq 0 -and $week -match '^\d{4}-\d{2}-\d{2}$' -and [string](Get-Field $last 'week') -ne $week) {
      Write-Log "his Titles press is recorded for every picked day of the week of ${week}: the overnight run starts on this machine as the $role, with no window"
      $id = Start-Hidden $StudioPython ('"' + $OvernightScript + '" run --role ' + $role + ' --week ' + $week)
      $at = [DateTime]::UtcNow.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", [System.Globalization.CultureInfo]::InvariantCulture)
      Save-JsonFile $OvernightStatePath ([ordered]@{ week = $week; role = $role; started_at = $at; process = $id })
    }
  }
  $status = Invoke-StudioPython @($OvernightScript, 'status', '--role', $role)
  if ($status.code -eq 0) { $script:Overnight = Read-LastJson $status.out }
}

function Get-PreflightBlock {
  # The last preflight's report, by these names only (api/library/_lanes.ts, PreflightHealth): names, versions, counts
  # and times, never a path, a message or an account.
  if ($null -eq $script:Preflight) { return $null }
  $report = Get-Field $script:Preflight 'report'
  if ($null -eq $report) { return $null }
  $block = [ordered]@{}
  foreach ($name in @('at', 'ok', 'claude_version', 'codex_companion', 'codex_login', 'codex_profile', 'codex_flagged', 'role', 'codex_weekly_used_pct',
      'codex_resets_at', 'ffmpeg', 'tesseract', 'free_gb', 'drive_reachable', 'drive_folders')) {
    $value = Get-Field $report $name
    if ($null -ne $value) { $block[$name] = $value }
  }
  $block['failed'] = @(Get-Field $report 'failed' | Where-Object { $_ } | ForEach-Object { [string]$_ })
  return $block
}

function Update-Source {
  # Brings the dedicated clone up to date, so a fix on main reaches both
  # machines. Only the recordings-source clone: never the runner's pinned
  # checkout, and never a copy a session works in.
  if ((Split-Path -Leaf $RepoRoot) -ne $SourceFolderName) { return }
  $git = Get-Command git.exe -ErrorAction SilentlyContinue
  if ($null -eq $git) { Write-Log 'git is not on this machine; this copy is not updated'; return }
  # git writes progress to stderr; Windows PowerShell would treat that as an
  # error under Stop, so this one call runs under Continue.
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = @(& $git.Source -C $RepoRoot pull --ff-only --quiet 2>&1)
    $code = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previous }
  if ($code -ne 0) { Write-Log "git pull did not finish ($($output -join ' ')); this pass runs on the copy as it is" }
}

# ---- one pass, or a pass every few minutes -----------------------------------

$mutex = [System.Threading.Mutex]::new($false, 'Local\MindmakeRecordingsUpload')
$owned = $false
try { $owned = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $owned = $true }
if (-not $owned) {
  Write-Output 'Another recordings upload is running on this machine. Nothing to do.'
  exit 0
}
try {
  if (-not $Loop) {
    try {
      $ok = Invoke-Pass
      if ($Check -and $script:PlacingNotReady -and $script:PassSent) { exit 3 }
      if ($ok) { exit 0 } else { exit 1 }
    } catch {
      Write-Log "recordings upload stopped: $($_.Exception.Message)"
      if (-not $Check) { Add-Problem 'pass_stopped'; Send-LaneReport }
      exit 1
    }
  }
  # The scheduled task: a pass every few minutes in one hidden process. Before
  # each pass it pulls its own copy; when that changes this script, it ends,
  # and the task's next trigger starts the new one.
  # This script and the window keeper it loads at start (scripts\windowless.ps1): a change to either ends the loop, so
  # the next start runs both as they are now (28 October: a keeper change waited in memory behind an unchanged loop).
  $scriptPath = $PSCommandPath
  function Get-SourceStamp {
    $stamp = Get-Sha256 $scriptPath
    if (Test-Path -LiteralPath $WindowlessScript -PathType Leaf) { $stamp += Get-Sha256 $WindowlessScript }
    return $stamp
  }
  $scriptSha = Get-SourceStamp
  Write-Log "recordings upload started: a pass every $EveryMinutes minutes"
  while ($true) {
    try { Update-Source } catch { Write-Log "the update check failed: $($_.Exception.Message)" }
    if ((Get-SourceStamp) -ne $scriptSha) {
      Write-Log 'recordings-upload.ps1 or windowless.ps1 has changed; ending so the scheduled task starts the new version'
      exit 0
    }
    try { [void](Invoke-Pass) }
    catch {
      # A pass that stops before its own report still reports, so the
      # engine never reads a failing machine as well (Send-LaneReport).
      Write-Log "this pass stopped: $($_.Exception.Message). Trying again in $EveryMinutes minutes."
      Add-Problem 'pass_stopped'
      Send-LaneReport
    }
    Start-Sleep -Seconds ($EveryMinutes * 60)
  }
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
