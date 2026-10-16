<#
Keeps Krish's makeyourmindup asset library on Drive up to date, from his
always-on Windows machine.

Krish, 2026-10-06: "make sure the brand kit is always updated here [the
library's Drive folder]", then "I want every single asset in there, permanent
and for individual posts, categorized properly, clear what to use them for,
and every new post gets its own new folder with all assets including the
article HTML I can copy paste, video scripts, etc etc".

The pieces and their artwork are made in cloud sessions, which cannot write
into Drive. A session sends each file to the engine's private library
(scripts/post-pack/send.py); this script takes them from there and writes them
into the library folder that Google Drive for desktop mirrors. It also keeps
"1 Brand kit (permanent)" in step with the brand kit published in
krishanraja/makeyourmindup.

The architecture doc's rule 0a.5 says agents never write into Krish's Drive.
This is his explicit instruction for this one folder, carried out by his own
machine, and it covers that folder only. So this script:

  - writes only inside the library root, and only under "1 Brand kit
    (permanent)", "2 Channel art (permanent)" and "3 Posts";
  - never deletes or renames anything in Drive. A file it wrote before is
    replaced in place by a newer version; a file someone else put there or
    changed is kept, and the new version goes beside it as "name (2).ext";
  - refuses to run when the library root is the Studio's Video Engine folder
    or inside it, and never reads or writes the Video Engine Inbox or Archive;
  - checks every file's sha256 before it reaches Drive.

The library root is MINDMAKE_LIBRARY_ROOT, else `runtime.library_root` in
config/studio.json. The engine's address is ENGINE_BASE_URL, else the one
scripts/engine.py uses. It authenticates with the runner's own bearer, read
from Windows Credential Manager through scripts/get-credential.ps1, exactly as
the runner reads it, and never shows it.

  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\library-sync.ps1 -Check   what it would do, writing nothing
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\library-sync.ps1          one pass
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts\library-sync.ps1 -Loop    a pass every ten minutes (the scheduled task)

scripts/install-library-sync.ps1 registers the scheduled task. Its log and
state are in Documents\MindmakeVideoStudio\library-sync, beside the runner's
folders and outside them.
#>
param(
  [string]$LibraryRoot = '',
  [string]$EngineUrl = '',
  [string]$StateRoot = '',
  [switch]$Check,
  [switch]$Loop,
  [switch]$SkipBrandKit,
  [ValidateRange(1, 1440)][int]$EveryMinutes = 10,
  [ValidateRange(10, 1440)][int]$BrandKitEveryMinutes = 60
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$RepoRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$TopFolders = @('1 Brand kit (permanent)', '2 Channel art (permanent)', '3 Posts')
$BrandKitFolder = '1 Brand kit (permanent)'
$BrandKitUrl = 'https://raw.githubusercontent.com/krishanraja/makeyourmindup/main/brand-kit/makeyourmindup-brand-kit.zip'
$RunnerCredential = 'MindmakeVideoStudio/control-center-runner-token-v3'
$PendingBatch = 25
$RoundsPerPass = 20
$PassBudget = [TimeSpan]::FromMinutes(8)
$Unsafe = [regex]'[<>:"\\|?*\x00-\x1f\x7f]'

if (-not $StateRoot) { $StateRoot = Join-Path $env:USERPROFILE 'Documents\MindmakeVideoStudio\library-sync' }
$StateRoot = [System.IO.Path]::GetFullPath($StateRoot)
$LogPath = Join-Path $StateRoot 'library-sync.log'

[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Net.Http
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

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
  [void][System.IO.Directory]::CreateDirectory($StateRoot)
  $temporary = "$Path.tmp"
  [System.IO.File]::WriteAllText($temporary, ($Value | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
  Move-Item -LiteralPath $temporary -Destination $Path -Force
}

function Get-Sha256([string]$Path) {
  return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Test-Inside([string]$Child, [string]$Parent) {
  $parentFull = [System.IO.Path]::GetFullPath($Parent).TrimEnd('\') + '\'
  $childFull = [System.IO.Path]::GetFullPath($Child)
  return $childFull.StartsWith($parentFull, [System.StringComparison]::OrdinalIgnoreCase)
}

function Test-SamePath([string]$Left, [string]$Right) {
  return [string]::Equals([System.IO.Path]::GetFullPath($Left).TrimEnd('\'), [System.IO.Path]::GetFullPath($Right).TrimEnd('\'), [System.StringComparison]::OrdinalIgnoreCase)
}

# ---- where things are --------------------------------------------------------

function Get-StudioConfig {
  $path = Join-Path $RepoRoot 'config\studio.json'
  $config = Read-JsonFile $path
  if ($null -eq $config) { throw "config\studio.json could not be read from $RepoRoot." }
  return $config
}

function Resolve-LibraryRoot($Config) {
  $root = $LibraryRoot
  if (-not $root) { $root = $env:MINDMAKE_LIBRARY_ROOT }
  $runtime = Get-Field $Config 'runtime'
  if (-not $root) { $root = [string](Get-Field $runtime 'library_root') }
  if (-not $root) { throw 'No library folder: set MINDMAKE_LIBRARY_ROOT, or runtime.library_root in config\studio.json.' }
  if (-not [System.IO.Path]::IsPathRooted($root)) { throw "The library folder must be a full path: $root" }
  $root = [System.IO.Path]::GetFullPath($root).TrimEnd('\')
  # The Studio's Drive folders are never the library, the library is never
  # inside them, and they are never inside a folder the sync writes to. Since
  # 2026-10-07 (Krish moved makeyourmindup to Ventures\Active, "the moves were
  # made on purpose") Video Engine sits inside the library folder beside the
  # three top folders; the sync writes only under those, so that is allowed.
  $studio = @((Get-Field $runtime 'drive_root'), (Get-Field $runtime 'media_inbox'), (Get-Field $runtime 'archive_root'),
    $env:MINDMAKE_DRIVE_ROOT, $env:MINDMAKE_MEDIA_INBOX, $env:MINDMAKE_ARCHIVE_ROOT) | Where-Object { $_ }
  foreach ($folder in $studio) {
    $underWritten = @($TopFolders | Where-Object { $top = Join-Path $root $_; (Test-SamePath $folder $top) -or (Test-Inside $folder $top) -or (Test-Inside $top $folder) }).Count -gt 0
    if ((Test-SamePath $root $folder) -or (Test-Inside $root $folder) -or $underWritten) {
      throw "The library folder $root overlaps the Studio's Video Engine folder $folder. Refusing to write anything."
    }
  }
  if (-not (Test-Path -LiteralPath $root -PathType Container)) {
    throw "The library folder $root cannot be reached. Check that Google Drive is running and signed in."
  }
  return $root
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
    throw "This machine has no runner key ($RunnerCredential) in Windows Credential Manager. The library sync runs on a runner machine (docs\ENGINE_SECRETS_HANDOVER.md)."
  }
  return $token
}

function Get-MachineId {
  $path = Join-Path $StateRoot 'machine.json'
  $saved = Read-JsonFile $path
  $saved = [string](Get-Field $saved 'machine')
  if ($saved -match '^library-[0-9a-f-]{36}$') { return $saved }
  $machine = 'library-' + [guid]::NewGuid().ToString()
  Save-JsonFile $path ([ordered]@{ machine = $machine; created_at = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() })
  return $machine
}

# ---- talking to the engine ---------------------------------------------------

function New-HttpClient {
  $handler = New-Object System.Net.Http.HttpClientHandler
  $handler.AllowAutoRedirect = $false
  $client = New-Object System.Net.Http.HttpClient($handler)
  $client.Timeout = [TimeSpan]::FromMinutes(30)
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

function Invoke-Engine($Client, [string]$Base, [string]$Token, [string]$Method, [string]$Path, $Body) {
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($Method), "$Base$Path")
  $request.Headers.Authorization = [System.Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $Token)
  $request.Headers.Accept.ParseAdd('application/json')
  if ($null -ne $Body) {
    $json = ConvertTo-Json -InputObject $Body -Depth 6 -Compress
    $request.Content = [System.Net.Http.StringContent]::new($json, [System.Text.Encoding]::UTF8, 'application/json')
  }
  $response = $Client.SendAsync($request).GetAwaiter().GetResult()
  try {
    $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $status = [int]$response.StatusCode
    if ($status -lt 200 -or $status -ge 300) {
      $code = Get-ErrorCode $text
      $plain = switch ($code) {
        'unauthorized' { "the engine refused this machine's runner key" }
        'runner_auth_unconfigured' { 'the engine has no runner key set' }
        'library_store_unavailable' { "the engine's library storage cannot be reached, or its bucket is missing" }
        'library_store_misconfigured' { "the engine's library bucket is not set up as its migration sets it" }
        'library_index_unavailable' { "the engine's library list cannot be read" }
        'rate_limited' { 'the engine asked to slow down' }
        default { "the engine answered $status" }
      }
      throw "$Method $Path failed: $plain ($code)."
    }
    return ($text | ConvertFrom-Json)
  } finally { $response.Dispose() }
}

function Save-Download($Client, [string]$Url, [string]$Destination, [hashtable]$Headers = @{}) {
  $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::Get, $Url)
  foreach ($name in $Headers.Keys) { [void]$request.Headers.TryAddWithoutValidation($name, $Headers[$name]) }
  $response = $Client.SendAsync($request, [System.Net.Http.HttpCompletionOption]::ResponseHeadersRead).GetAwaiter().GetResult()
  try {
    $status = [int]$response.StatusCode
    if ($status -eq 304) { return @{ status = 304; etag = '' } }
    if ($status -lt 200 -or $status -ge 300) { throw "the download answered $status" }
    $stream = $response.Content.ReadAsStreamAsync().GetAwaiter().GetResult()
    $file = [System.IO.File]::Create($Destination)
    try { $stream.CopyTo($file) } finally { $file.Dispose(); $stream.Dispose() }
    $etag = ''
    if ($null -ne $response.Headers.ETag) { $etag = $response.Headers.ETag.ToString() }
    return @{ status = $status; etag = $etag }
  } finally { $response.Dispose() }
}

# ---- writing into the library ------------------------------------------------

function Get-LibraryTarget([string]$Root, [string]$Path) {
  # The same boundary the engine holds (config/library-paths.cases.json), checked
  # again here: relative, forward slashes, a known top folder, nothing that climbs out.
  if (-not $Path -or $Path.Length -gt 180 -or $Path.Contains('\') -or $Path.StartsWith('/') -or $Path -match '^[A-Za-z]:') {
    throw "refused a path the library does not take: $Path"
  }
  $parts = $Path.Split('/')
  if ($TopFolders -cnotcontains $parts[0] -or $parts.Count -lt 2) { throw "refused a path outside the library's folders: $Path" }
  foreach ($part in $parts) {
    if (-not $part -or $part -eq '.' -or $part -eq '..' -or $part.StartsWith('.') -or $Unsafe.IsMatch($part) -or $part.EndsWith('.') -or $part.EndsWith(' ') -or $part.StartsWith(' ')) {
      throw "refused a path the library does not take: $Path"
    }
  }
  $target = [System.IO.Path]::GetFullPath((Join-Path $Root ($parts -join '\')))
  if (-not (Test-Inside $target (Join-Path $Root $parts[0]))) { throw "refused a path outside the library's folders: $Path" }
  return $target
}

function Get-BesideName([string]$Target, [int]$Copy) {
  $folder = [System.IO.Path]::GetDirectoryName($Target)
  $stem = [System.IO.Path]::GetFileNameWithoutExtension($Target)
  $extension = [System.IO.Path]::GetExtension($Target)
  return Join-Path $folder ("{0} ({1}){2}" -f $stem, $Copy, $extension)
}

function Write-IntoLibrary([string]$Root, [string]$Path, [string]$Temporary, [string]$Sha256, $Previous) {
  # Returns the library path the file is now at. Never deletes or renames a file.
  $target = Get-LibraryTarget $Root $Path
  $isBrandKit = $Path.StartsWith("$BrandKitFolder/")
  $candidates = @($target) + @(2..99 | ForEach-Object { Get-BesideName $target $_ })
  foreach ($candidate in $candidates) {
    if (-not (Test-Path -LiteralPath $candidate)) {
      if (-not $Check) {
        [void][System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($candidate))
        [System.IO.File]::Copy($Temporary, $candidate, $false)
      }
      break
    }
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
    $existing = Get-Sha256 $candidate
    if ($existing -eq $Sha256) { break }
    # Its own earlier copy, or the brand kit (kept in step in place): replaced in place.
    if (($Previous -and $existing -eq $Previous) -or ($isBrandKit -and $candidate -eq $target)) {
      if (-not $Check) { [System.IO.File]::Copy($Temporary, $candidate, $true) }
      break
    }
    # Someone else's file, or one Krish changed: kept. The new version goes beside it.
  }
  if ($candidate -eq $candidates[-1] -and (Test-Path -LiteralPath $candidate)) {
    if ((Get-Sha256 $candidate) -ne $Sha256) { throw "no free name beside $Path" }
  }
  if (-not $Check -and (Get-Sha256 $candidate) -ne $Sha256) { throw "what reached Drive for $Path does not match its sha256" }
  $relative = $candidate.Substring($Root.Length + 1).Replace('\', '/')
  return $relative
}

function Sync-Pending($Client, [string]$Base, [string]$Token, [string]$Root, [string]$Machine, [string]$WorkDir) {
  $started = Get-Date
  $written = 0
  $failed = 0
  for ($round = 1; $round -le $RoundsPerPass; $round++) {
    $query = '/api/library/pending?machine={0}&limit={1}' -f [uri]::EscapeDataString($Machine), $PendingBatch
    $answer = Invoke-Engine $Client $Base $Token 'GET' $query $null
    if ($round -eq 1 -and $Check) { Write-Log "The engine knows this machine as $(Get-Field $answer 'machine')." }
    if ([int](Get-Field $answer 'skipped') -gt 0) { Write-Log "The engine held back $(Get-Field $answer 'skipped') file(s) that break the library's rule or have no stored copy." }
    $files = @(Get-Field $answer 'files' | Where-Object { $null -ne $_ })
    if ($files.Count -eq 0) { break }
    $done = New-Object System.Collections.ArrayList
    foreach ($file in $files) {
      $path = [string]$file.path
      try {
        $address = [string](Get-Field (Get-Field $file 'download') 'url')
        $url = [System.Uri]$address
        if ($url.Scheme -ne 'https' -or $url.UserInfo -or -not $url.AbsolutePath.StartsWith('/storage/v1/object/sign/content-library/')) {
          throw 'the download address is not the library storage'
        }
        if ($Check) {
          Write-Log "would write  $path  ($([int64]$file.bytes) bytes)  $($file.purpose)"
          continue
        }
        $temporary = Join-Path $WorkDir ([guid]::NewGuid().ToString() + '.part')
        try {
          [void](Save-Download $Client $address $temporary)
          if ((Get-Item -LiteralPath $temporary).Length -ne [int64]$file.bytes) { throw 'the download is the wrong size' }
          if ((Get-Sha256 $temporary) -ne [string]$file.sha256) { throw 'the download does not match its sha256' }
          $as = Write-IntoLibrary $Root $path $temporary ([string]$file.sha256) ([string](Get-Field $file 'previous_sha256'))
        } finally {
          if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
        }
        $item = [ordered]@{ path = $path; sha256 = [string]$file.sha256 }
        if ($as -ne $path) { $item.written_as = $as; Write-Log "kept the file already at $path; the new version is beside it as $as" }
        else { Write-Log "wrote  $path" }
        [void]$done.Add($item)
        $written++
      } catch {
        $failed++
        Write-Log "could not write $path : $($_.Exception.Message)"
      }
    }
    if ($done.Count -gt 0) {
      $result = Invoke-Engine $Client $Base $Token 'POST' '/api/library/written' ([ordered]@{ schema_version = 1; machine = $Machine; items = $done.ToArray() })
      foreach ($unknown in @(Get-Field $result 'unknown')) { if ($unknown) { Write-Log "the engine does not hold $(Get-Field $unknown 'path') as ready" } }
    }
    if ($Check -or -not (Get-Field $answer 'more') -or $done.Count -eq 0 -or ((Get-Date) - $started) -gt $PassBudget) { break }
  }
  return @{ written = $written; failed = $failed }
}

function Sync-BrandKit($Client, [string]$Root, [string]$WorkDir) {
  $statePath = Join-Path $StateRoot 'brand-kit.json'
  $state = Read-JsonFile $statePath
  # Times are seconds since 1970: PowerShell 7 reads a written date back in the
  # machine's own format, which differs from one culture to another.
  $now = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
  $checked = [int64](Get-Field $state 'checked_at')
  if ($checked -gt 0 -and ($now - $checked) -lt ($BrandKitEveryMinutes * 60)) { return }
  $headers = @{}
  $etag = [string](Get-Field $state 'etag')
  if ($etag -and (Test-Path -LiteralPath (Join-Path $Root $BrandKitFolder))) { $headers['If-None-Match'] = $etag }
  $zip = Join-Path $WorkDir 'brand-kit.zip'
  $download = Save-Download $Client $BrandKitUrl $zip $headers
  $record = [ordered]@{
    sha256 = [string](Get-Field $state 'sha256')
    etag = $etag
    unpacked_at = [int64](Get-Field $state 'unpacked_at')
    files_written = [int](Get-Field $state 'files_written')
    checked_at = $now
    source = $BrandKitUrl
  }
  if ($download.status -eq 304) {
    if (-not $Check) { Save-JsonFile $statePath $record }
    return
  }
  $sha = Get-Sha256 $zip
  if ($sha -eq $record.sha256) {
    $record.etag = $download.etag
    if (-not $Check) { Save-JsonFile $statePath $record }
    return
  }
  if ($Check) { Write-Log "would unpack a new brand kit ($sha) into $BrandKitFolder"; return }

  # Unpacked into the brand kit folder: files overwritten in place when they
  # changed, nothing else touched, nothing deleted.
  $kitRoot = Join-Path $Root $BrandKitFolder
  $archive = [System.IO.Compression.ZipFile]::OpenRead($zip)
  $written = 0
  $same = 0
  try {
    $entries = @($archive.Entries | Where-Object { $_.FullName -and -not $_.FullName.EndsWith('/') })
    $firsts = @($entries | ForEach-Object { $_.FullName.Split('/')[0] } | Select-Object -Unique)
    $strip = ($firsts.Count -eq 1 -and @($entries | Where-Object { $_.FullName -notlike '*/*' }).Count -eq 0)
    foreach ($entry in $entries) {
      $name = $entry.FullName
      if ($strip) { $name = $name.Substring($name.IndexOf('/') + 1) }
      $parts = $name.Split('/')
      if (@($parts | Where-Object { $_.StartsWith('.') }).Count -gt 0) { continue }
      $path = "$BrandKitFolder/$name"
      $target = Get-LibraryTarget $Root $path
      if (-not (Test-Inside $target $kitRoot)) { throw "the brand kit holds $($entry.FullName), which would land outside its folder" }
      $temporary = Join-Path $WorkDir ([guid]::NewGuid().ToString() + '.part')
      try {
        $source = $entry.Open()
        $file = [System.IO.File]::Create($temporary)
        try { $source.CopyTo($file) } finally { $file.Dispose(); $source.Dispose() }
        $entrySha = Get-Sha256 $temporary
        if ((Test-Path -LiteralPath $target -PathType Leaf) -and (Get-Sha256 $target) -eq $entrySha) { $same++; continue }
        [void][System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($target))
        [System.IO.File]::Copy($temporary, $target, $true)
        $written++
      } finally {
        if (Test-Path -LiteralPath $temporary) { Remove-Item -LiteralPath $temporary -Force }
      }
    }
  } finally { $archive.Dispose() }
  $record.sha256 = $sha
  $record.etag = $download.etag
  $record.unpacked_at = $now
  $record.files_written = $written
  Save-JsonFile $statePath $record
  Write-Log "unpacked the published brand kit into $BrandKitFolder : $written file(s) new or changed, $same already the same"
}

function Invoke-Pass {
  $workDir = Join-Path ([System.IO.Path]::GetTempPath()) ('mindmake-library-sync-' + [guid]::NewGuid().ToString())
  [void][System.IO.Directory]::CreateDirectory($workDir)
  $client = New-HttpClient
  try {
    $config = Get-StudioConfig
    $root = Resolve-LibraryRoot $config
    $base = Resolve-EngineUrl
    if ($Check) { Write-Log "Checking only: nothing is written. Library: $root" }
    if (-not $SkipBrandKit) {
      try { $null = Sync-BrandKit $client $root $workDir }
      catch { Write-Log "the brand kit check failed: $($_.Exception.Message)" }
    }
    $token = Get-RunnerToken
    $machine = Get-MachineId
    $result = Sync-Pending $client $base $token $root $machine $workDir
    if ($result.written -gt 0 -or $result.failed -gt 0) { Write-Log "wrote $($result.written) file(s); $($result.failed) could not be written and will be tried again" }
    return ($result.failed -eq 0)
  } finally {
    $client.Dispose()
    if (Test-Path -LiteralPath $workDir) { Remove-Item -LiteralPath $workDir -Recurse -Force }
  }
}

# ---- one pass, or a pass every few minutes -----------------------------------

$mutex = [System.Threading.Mutex]::new($false, 'Local\MindmakeLibrarySync')
$owned = $false
try { $owned = $mutex.WaitOne(0) } catch [System.Threading.AbandonedMutexException] { $owned = $true }
if (-not $owned) {
  Write-Output 'Another library sync is running on this machine. Nothing to do.'
  exit 0
}
try {
  if (-not $Loop) {
    try {
      if (Invoke-Pass) { exit 0 } else { exit 1 }
    } catch {
      Write-Log "library sync stopped: $($_.Exception.Message)"
      exit 1
    }
  }
  # The scheduled task: a pass every few minutes in one hidden process, so no
  # window opens each time. When this script changes (a git pull), it ends, and
  # the task's next trigger starts the new one.
  $scriptPath = $PSCommandPath
  $scriptSha = Get-Sha256 $scriptPath
  Write-Log "library sync started: a pass every $EveryMinutes minutes"
  while ($true) {
    try { [void](Invoke-Pass) }
    catch { Write-Log "this pass stopped: $($_.Exception.Message). Trying again in $EveryMinutes minutes." }
    Start-Sleep -Seconds ($EveryMinutes * 60)
    if ((Get-Sha256 $scriptPath) -ne $scriptSha) {
      Write-Log 'library-sync.ps1 has changed; ending so the scheduled task starts the new version'
      exit 0
    }
  }
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
