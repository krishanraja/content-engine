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
what this machine has sent) are in Documents\MindmakeVideoStudio\recordings-upload.

The Inbox is MINDMAKE_MEDIA_INBOX, else runtime.media_inbox in
config/studio.json, else the Drive root's Inbox folder. The engine's address is
ENGINE_BASE_URL, else the one scripts/engine.py uses. It authenticates with the
runner's own bearer, read from Windows Credential Manager through
scripts/get-credential.ps1 exactly as the runner reads it, and never shows it.

  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\recordings-upload.ps1 -Check   what it would send, sending nothing
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

$RepoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$SourceFolderName = 'recordings-source'
$RunnerCredential = 'MindmakeVideoStudio/control-center-runner-token-v3'
$RecordingExtensions = @('.mp4', '.mov', '.m4a', '.wav', '.mp3', '.mkv', '.webm')
$RecordingMaxBytes = 524288000  # 500 MiB, the bucket's cap
$RecordingSettleSeconds = 120
$PassBudget = [TimeSpan]::FromMinutes(25)

if (-not $StateRoot) { $StateRoot = Join-Path $env:USERPROFILE 'Documents\MindmakeVideoStudio\recordings-upload' }
$StateRoot = [System.IO.Path]::GetFullPath($StateRoot)
$LogPath = Join-Path $StateRoot 'recordings-upload.log'
$StatePath = Join-Path $StateRoot 'recordings.json'

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
  # Only ever called with $StatePath, beside the log: never anywhere in Drive.
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

function Resolve-MediaInbox($Config) {
  # MINDMAKE_MEDIA_INBOX, else runtime.media_inbox in config\studio.json, else
  # the Drive root's Inbox folder. Null when none is set.
  $runtime = Get-Field $Config 'runtime'
  $inbox = $env:MINDMAKE_MEDIA_INBOX
  if (-not $inbox) { $inbox = [string](Get-Field $runtime 'media_inbox') }
  if (-not $inbox) {
    $drive = $env:MINDMAKE_DRIVE_ROOT
    if (-not $drive) { $drive = [string](Get-Field $runtime 'drive_root') }
    if ($drive) { $inbox = Join-Path $drive 'Inbox' }
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
    'recording_too_large' { 'the recording is over the 500 MiB the engine takes' }
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
        if (-not $state.too_large.ContainsKey($key)) { Write-Log "skipped $name : it is $bytes bytes, over the 500 MiB the engine takes" }
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

function Invoke-Pass {
  $config = Get-StudioConfig
  $inbox = Resolve-MediaInbox $config
  if (-not $inbox) {
    Write-Log 'no Inbox is set (MINDMAKE_MEDIA_INBOX, or runtime.media_inbox or drive_root in config\studio.json); nothing to send'
    return (-not $Check)
  }
  if (-not (Test-Path -LiteralPath $inbox -PathType Container)) {
    Write-Log "the Inbox $inbox cannot be reached. Check that Google Drive is running and signed in."
    return $false
  }
  $base = Resolve-EngineUrl
  $token = Get-RunnerToken
  if ($Check) {
    $probe = New-HttpClient ([TimeSpan]::FromMinutes(2))
    try { Test-Engine $probe $base $token } finally { $probe.Dispose() }
    Write-Log "Checking only: nothing is sent. Inbox: $inbox. The engine accepts this machine's runner key."
  }
  $result = Sync-Recordings $inbox $base $token
  if ($result.sent -gt 0 -or $result.failed -gt 0) { Write-Log "sent or listed $($result.sent) recording(s); $($result.failed) could not be sent and will be tried again" }
  return ($result.failed -eq 0)
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
      if (Invoke-Pass) { exit 0 } else { exit 1 }
    } catch {
      Write-Log "recordings upload stopped: $($_.Exception.Message)"
      exit 1
    }
  }
  # The scheduled task: a pass every few minutes in one hidden process. Before
  # each pass it pulls its own copy; when that changes this script, it ends,
  # and the task's next trigger starts the new one.
  $scriptPath = $PSCommandPath
  $scriptSha = Get-Sha256 $scriptPath
  Write-Log "recordings upload started: a pass every $EveryMinutes minutes"
  while ($true) {
    try { Update-Source } catch { Write-Log "the update check failed: $($_.Exception.Message)" }
    if ((Get-Sha256 $scriptPath) -ne $scriptSha) {
      Write-Log 'recordings-upload.ps1 has changed; ending so the scheduled task starts the new version'
      exit 0
    }
    try { [void](Invoke-Pass) }
    catch { Write-Log "this pass stopped: $($_.Exception.Message). Trying again in $EveryMinutes minutes." }
    Start-Sleep -Seconds ($EveryMinutes * 60)
  }
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
