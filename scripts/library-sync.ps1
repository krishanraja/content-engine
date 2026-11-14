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
# A second library (Krish, 2026-11-03: "Why don't you duplicate that Python
# script for Heartside then? We're going to need to do a lot more of this type
# of stuff moving forward"): Heartside's social library, Heartside\03b_Social-Schedule (named 05_Social-Library until 2026-11-09),
# where each post's media goes in Posts\<post id>\. It is found by its Drive ID
# through the engine, so a rename or a move needs nothing; "root" in
# config\heartside-library.json (or the setting MINDMAKE_HEARTSIDE_LIBRARY_ROOT)
# is the fallback; with neither, it is skipped (Resolve-HeartsideRoot). It is written
# only under Posts, by the same rules: never deleted, never renamed, every file
# checked against its sha256 first.
$HeartsideTopFolders = @('Posts')
$HeartsidePostId = [regex]'^[A-Z][0-9]{2,3}(-[a-z0-9]+)*$'
$SourceFolderName = 'library-source'
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

function Get-Setting([string]$Name) {
  # The setting as the registry holds it now, so a setting changed or deleted
  # after this long-running task started counts on the next pass.
  foreach ($scope in @('User', 'Machine')) {
    $value = [Environment]::GetEnvironmentVariable($Name, $scope)
    if ($value) { return $value }
  }
  return [Environment]::GetEnvironmentVariable($Name, 'Process')
}

function Resolve-LibraryRoot($Config, $Folders = $null) {
  # In order: -LibraryRoot; MINDMAKE_LIBRARY_ROOT when it names a folder that
  # is there; the folder the engine found by its Drive ID ($Folders, from
  # Get-RuntimeFolders: config\studio.json drive_ids.library_root), mapped onto
  # the drive runtime.library_root is on, so a rename or a move above it needs
  # nothing (11 Nov: "Active" became "Active Ventures" and the path broke);
  # else runtime.library_root itself. A setting naming a missing folder while
  # studio.json's is there is stale: it is reported to the engine (Krish,
  # 2026-10-24). A library the engine says is deleted or in the Drive bin
  # stops the pass, with no fallback to an old path. Nothing here makes a folder.
  $runtime = Get-Field $Config 'runtime'
  $configured = [string](Get-Field $runtime 'library_root')
  $root = $LibraryRoot
  if (-not $root) {
    $setting = Get-Setting 'MINDMAKE_LIBRARY_ROOT'
    $folder = Find-RuntimeFolder $Folders 'library_root'
    $state = [string](Get-Field $folder 'state')
    if ($setting -and (Test-Path -LiteralPath $setting -PathType Container)) { $root = $setting }
    elseif ($state -eq 'gone') {
      $problem = [string](Get-Field $folder 'problem')
      if ($problem -notin @('library_root_gone', 'library_root_trashed')) { $problem = 'library_root_gone' }
      $script:Problems.Add($problem)
      throw "The library folder is gone from Drive: $(Get-Field $folder 'reason'). Nothing is written and no folder is made; restore it from the bin, or put the new folder's ID in config\studio.json drive_ids.library_root."
    } else {
      if ($state -eq 'found') {
        $mapped = ConvertTo-LocalDrivePath $folder @($configured, $setting)
        if ($mapped -and (Test-Path -LiteralPath $mapped -PathType Container)) {
          $root = $mapped
          if ($configured -and -not (Test-SamePath $mapped $configured)) { Write-Log "the library was found by its Drive ID at $mapped; config\studio.json still names $configured" }
        } elseif ($mapped) {
          Write-Log "the engine found the library by its Drive ID at $mapped, which this machine cannot reach; using the configured folder"
        }
      } elseif ($null -ne $folder) {
        Write-Log "the engine could not find the library by its ID ($(Get-Field $folder 'reason')); using config\studio.json"
      }
      if (-not $root) {
        $root = $configured
        if ($setting) {
          if (-not $configured -or -not (Test-Path -LiteralPath $configured -PathType Container)) { $root = $setting }
          else {
            Write-Log "MINDMAKE_LIBRARY_ROOT on this machine names $setting, which is not there; using config\studio.json's $configured. Delete the setting."
            $script:Problems.Add('library_env_stale')
          }
        }
      }
    }
  }
  if (-not $root) { throw 'No library folder: set MINDMAKE_LIBRARY_ROOT, or runtime.library_root in config\studio.json.' }
  if (-not [System.IO.Path]::IsPathRooted($root)) { throw "The library folder must be a full path: $root" }
  $root = [System.IO.Path]::GetFullPath($root).TrimEnd('\')
  # The Studio's Drive folders are never the library, the library is never
  # inside them, and they are never inside a folder the sync writes to. Since
  # 2026-10-07 (Krish moved makeyourmindup to Ventures\Active, "the moves were
  # made on purpose") Video Engine sits inside the library folder beside the
  # three top folders; the sync writes only under those, so that is allowed.
  Assert-NoStudioOverlap $root $TopFolders $runtime
  if (-not (Test-Path -LiteralPath $root -PathType Container)) {
    $script:Problems.Add('library_root_missing')
    throw "The library folder $root cannot be reached. Check that Google Drive is running and signed in, and that config\studio.json runtime.library_root is its path."
  }
  return $root
}

function Assert-NoStudioOverlap([string]$root, [string[]]$Tops, $runtime) {
  $studio = @((Get-Field $runtime 'drive_root'), (Get-Field $runtime 'media_inbox'), (Get-Field $runtime 'archive_root'),
    $env:MINDMAKE_DRIVE_ROOT, $env:MINDMAKE_MEDIA_INBOX, $env:MINDMAKE_ARCHIVE_ROOT) | Where-Object { $_ }
  foreach ($folder in $studio) {
    $underWritten = @($Tops | Where-Object { $top = Join-Path $root $_; (Test-SamePath $folder $top) -or (Test-Inside $folder $top) -or (Test-Inside $top $folder) }).Count -gt 0
    if ((Test-SamePath $root $folder) -or (Test-Inside $root $folder) -or $underWritten) {
      throw "The library folder $root overlaps the Studio's Video Engine folder $folder. Refusing to write anything."
    }
  }
}

function Get-HeartsideFolder($Client, [string]$Base, [string]$Token, [string]$Machine) {
  # Where the engine says Heartside's library is now, found in Drive by its
  # folder ID (api/library/_heartsideFolder.ts; Krish, 2026-11-09: "ideally ID
  # so if folders move it doesnt matter"). The answer rides on the Heartside
  # pending list. $null when the engine cannot be asked; the configured folder
  # is used then.
  try {
    $query = '/api/library/pending?machine={0}&limit=1&library=heartside' -f [uri]::EscapeDataString($Machine)
    return Get-Field (Invoke-Engine $Client $Base $Token 'GET' $query $null) 'folder'
  } catch {
    Write-Log "the engine could not say where the Heartside library is ($($_.Exception.Message)); using config\heartside-library.json"
    return $null
  }
}

function Get-RuntimeFolders($Client, [string]$Base, [string]$Token, [string]$Machine) {
  # Where the engine says each runtime folder is now, found in Drive by the IDs
  # in config\studio.json drive_ids (api/library/_runtimeFolders.ts). Asked
  # once a pass. $null when the engine cannot be asked; each configured path
  # is used then.
  try {
    $query = '/api/library/pending?machine={0}&limit=1&folders=1' -f [uri]::EscapeDataString($Machine)
    $folders = Get-Field (Invoke-Engine $Client $Base $Token 'GET' $query $null) 'folders'
    if ($null -eq $folders) { return $null }
    return ,@($folders)
  } catch {
    Write-Log "the engine could not say where the runtime folders are ($($_.Exception.Message)); using config\studio.json"
    return $null
  }
}

function Find-RuntimeFolder($Folders, [string]$Name) {
  foreach ($folder in @($Folders)) {
    if ($null -ne $folder -and [string](Get-Field $folder 'name') -ceq $Name) { return $folder }
  }
  return $null
}

function ConvertTo-LocalDrivePath($Folder, [string[]]$Known) {
  # A found folder's path on this machine: its names under the Google Drive for
  # desktop drive that the first known full path is on. $null when none is.
  $driveRoot = $null
  foreach ($path in @($Known)) {
    if ($path -and [System.IO.Path]::IsPathRooted($path)) { $driveRoot = Get-DriveForDesktopRoot $path; break }
  }
  return ConvertTo-HeartsidePath $driveRoot (Get-Field $Folder 'segments')
}

function Get-DrivePathsFile($Config) {
  # %LOCALAPPDATA%\makeyourmindup\drive-paths.json: local_roots.runtime in
  # config\studio.json, the engine's runtime folder on this computer.
  $runtime = [string](Get-Field (Get-Field $Config 'local_roots') 'runtime')
  $folder = if ($runtime) { [Environment]::ExpandEnvironmentVariables($runtime) } else { '' }
  if (-not $folder -or $folder.Contains('%')) { $folder = Join-Path $env:LOCALAPPDATA 'makeyourmindup' }
  return Join-Path $folder 'drive-paths.json'
}

function Write-DrivePaths($Config, $Folders, $Heartside, [string]$Known) {
  # Where every folder the engine found by its Drive ID is on this computer,
  # for each other reader here: music and the archive (scripts/velib/
  # drive_paths.py), krish-clone, content-watcher and filearchives. Shape:
  #   { "schema_version": 1, "written_at", "written_by": "library-sync",
  #     "folders": [ { "name", "id", "state", "path", "drive_path", "reason" } ] }
  # Readers take only state "found": path is then a folder that is there on
  # this computer. "not_on_this_machine" is found in Drive with no folder here;
  # "gone" and "unknown" carry the engine's reason. Written only from an engine
  # answer, so a run that could not ask never replaces a good file.
  if ($null -eq $Folders) { return }
  $entries = New-Object System.Collections.Generic.List[object]
  $all = @(@($Folders) | Where-Object { $null -ne $_ })
  if ($null -ne $Heartside) { $all += [pscustomobject]@{ name = 'heartside_library'; state = (Get-Field $Heartside 'state'); drive_id = (Get-Field $Heartside 'drive_id'); path = (Get-Field $Heartside 'path'); segments = (Get-Field $Heartside 'segments'); reason = (Get-Field $Heartside 'reason') } }
  foreach ($folder in $all) {
    $name = [string](Get-Field $folder 'name')
    $id = [string](Get-Field $folder 'drive_id')
    if (-not $name -or -not $id) { continue }
    $state = [string](Get-Field $folder 'state')
    if ($state -notin @('found', 'gone', 'unknown')) { $state = 'unknown' }
    $local = $null
    if ($state -eq 'found') {
      $local = ConvertTo-LocalDrivePath $folder @($Known)
      if (-not $local -or -not (Test-Path -LiteralPath $local -PathType Container)) { $state = 'not_on_this_machine' }
    }
    $entries.Add([ordered]@{
      name = $name
      id = $id
      state = $state
      path = $local
      drive_path = (Get-Field $folder 'path')
      reason = (Get-Field $folder 'reason')
    })
  }
  $file = Get-DrivePathsFile $Config
  if ($Check) { Write-Log "Checking only: $file is not written ($($entries.Count) folder(s))"; return }
  [void][System.IO.Directory]::CreateDirectory([System.IO.Path]::GetDirectoryName($file))
  $temporary = "$file.tmp"
  $body = [ordered]@{ schema_version = 1; written_at = (Get-Date).ToUniversalTime().ToString('o'); written_by = 'library-sync'; folders = $entries.ToArray() }
  [System.IO.File]::WriteAllText($temporary, ($body | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))
  Move-Item -LiteralPath $temporary -Destination $file -Force
}

function Get-DriveForDesktopRoot([string]$Known) {
  # The folder that holds "My Drive" on this machine, read off a path known to
  # be in it ("H:\My Drive\Ventures\..." gives "H:\"); the path's own drive
  # when it names no "My Drive".
  $full = [System.IO.Path]::GetFullPath($Known)
  $parts = $full.Split([char[]]@('\', '/'))
  for ($i = 0; $i -lt $parts.Count; $i++) {
    if ($parts[$i] -ceq 'My Drive') {
      $head = ($parts[0..$i] -join [System.IO.Path]::DirectorySeparatorChar)
      return [System.IO.Path]::GetDirectoryName($head)
    }
  }
  return [System.IO.Path]::GetPathRoot($full)
}

function ConvertTo-HeartsidePath([string]$DriveRoot, $Segments) {
  # "My Drive/Ventures/.../03b_Social-Schedule" onto this machine's Google
  # Drive for desktop drive ("H:\" + "My Drive\Ventures\..."). $null for
  # anything that is not a plain path under My Drive.
  $names = @($Segments | ForEach-Object { [string]$_ })
  if ($names.Count -lt 2 -or $names[0] -cne 'My Drive' -or -not $DriveRoot) { return $null }
  foreach ($name in $names) {
    if (-not $name -or $name -ne $name.Trim() -or $name -match '[\\/:*?"<>|\x00-\x1f]' -or $name -match '^\.+$' -or $name.EndsWith('.')) { return $null }
  }
  return [System.IO.Path]::Combine([string[]](@($DriveRoot) + $names))
}

function Resolve-HeartsideRoot($Config, $Folder) {
  # In order: MINDMAKE_HEARTSIDE_LIBRARY_ROOT when it names a folder that is
  # there; else the folder the engine found by its Drive ID ($Folder, from
  # Get-HeartsideFolder), mapped onto the drive that "root" in
  # config\heartside-library.json is on, so a rename or a move needs nothing;
  # else that "root" itself (kept out of studio.json, whose contents are bound
  # into the media standard). None of them: no Heartside library on this
  # machine, and nothing is written for it. A folder the engine says is
  # deleted or in the Drive bin stops the pass, with no fallback to an old
  # path. A folder that is not there is never made.
  $runtime = Get-Field $Config 'runtime'
  $configured = [string](Get-Field (Read-JsonFile (Join-Path $RepoRoot 'config\heartside-library.json')) 'root')
  $setting = Get-Setting 'MINDMAKE_HEARTSIDE_LIBRARY_ROOT'
  $root = $null
  if ($setting -and (Test-Path -LiteralPath $setting -PathType Container)) { $root = $setting }
  elseif ((Get-Field $Folder 'state') -eq 'gone') {
    $problem = [string](Get-Field $Folder 'problem')
    if ($problem -notin @('heartside_library_gone', 'heartside_library_trashed')) { $problem = 'heartside_library_gone' }
    $script:Problems.Add($problem)
    throw "The Heartside library folder is gone from Drive: $(Get-Field $Folder 'reason'). Nothing is written and no folder is made; restore it from the bin, or put the new folder's ID in config\heartside-library.json drive_id and api/library/_heartsideFolder.ts."
  } elseif ((Get-Field $Folder 'state') -eq 'found') {
    $driveRoot = $null
    foreach ($known in @($configured, $setting)) {
      if ($known -and [System.IO.Path]::IsPathRooted($known)) { $driveRoot = Get-DriveForDesktopRoot $known; break }
    }
    $root = ConvertTo-HeartsidePath $driveRoot (Get-Field $Folder 'segments')
    if ($root -and $configured -and -not (Test-SamePath $root $configured)) {
      Write-Log "the Heartside library was found by its Drive ID at $root; config\heartside-library.json still names $configured"
    }
  } elseif ($null -ne $Folder) {
    Write-Log "the engine could not find the Heartside library by its ID ($(Get-Field $Folder 'reason')); using config\heartside-library.json"
  }
  if (-not $root) { $root = if ($configured) { $configured } else { $setting } }
  if (-not $root) { return $null }
  if (-not [System.IO.Path]::IsPathRooted($root)) { throw "The Heartside library folder must be a full path: $root" }
  $root = [System.IO.Path]::GetFullPath($root).TrimEnd('\')
  Assert-NoStudioOverlap $root $HeartsideTopFolders $runtime
  if (-not (Test-Path -LiteralPath $root -PathType Container)) {
    $script:Problems.Add('heartside_library_root_missing')
    throw "The Heartside library folder $root cannot be reached. Check that Google Drive is running and signed in, and that config\heartside-library.json names it."
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

function Get-LibraryTarget([string]$Root, [string]$Path, [string]$Library = 'makeyourmindup') {
  # The same boundary the engine holds (config/library-paths.cases.json), checked
  # again here: relative, forward slashes, a known top folder, nothing that climbs out.
  if (-not $Path -or $Path.Length -gt 180 -or $Path.Contains('\') -or $Path.StartsWith('/') -or $Path -match '^[A-Za-z]:') {
    throw "refused a path the library does not take: $Path"
  }
  $parts = $Path.Split('/')
  if ($TopFolders -cnotcontains $parts[0] -or $parts.Count -lt 2) {
    if ($Library -ne 'heartside') { throw "refused a path outside the library's folders: $Path" }
  }
  if ($Library -eq 'heartside' -and ($HeartsideTopFolders -cnotcontains $parts[0] -or $parts.Count -ne 3 -or -not $HeartsidePostId.IsMatch($parts[1]))) {
    throw "refused a path outside the Heartside library's Posts\<post id> folders: $Path"
  }
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

function Write-IntoLibrary([string]$Root, [string]$Path, [string]$Temporary, [string]$Sha256, $Previous, [string]$Library = 'makeyourmindup') {
  # Returns the library path the file is now at. Never deletes or renames a file.
  $target = Get-LibraryTarget $Root $Path $Library
  $isBrandKit = $Library -ne 'heartside' -and $Path.StartsWith("$BrandKitFolder/")
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

function Sync-Pending($Client, [string]$Base, [string]$Token, [string]$Root, [string]$Machine, [string]$WorkDir, [string]$Library = 'makeyourmindup') {
  $started = Get-Date
  $written = 0
  $failed = 0
  for ($round = 1; $round -le $RoundsPerPass; $round++) {
    $query = '/api/library/pending?machine={0}&limit={1}' -f [uri]::EscapeDataString($Machine), $PendingBatch
    if ($Library -ne 'makeyourmindup') { $query += '&library=' + [uri]::EscapeDataString($Library) }
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
          $as = Write-IntoLibrary $Root $path $temporary ([string]$file.sha256) ([string](Get-Field $file 'previous_sha256')) $Library
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
      $report = [ordered]@{ schema_version = 1; machine = $Machine; items = $done.ToArray() }
      if ($Library -ne 'makeyourmindup') { $report.library = $Library }
      $result = Invoke-Engine $Client $Base $Token 'POST' '/api/library/written' $report
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

function Send-LaneReport([bool]$Ok) {
  # What this pass found, to the engine, so a failing sync reaches Control
  # Center instead of only this log (api/library/_lanes.ts). Never stops a pass.
  if (-not $Ok -and -not $script:Problems.Contains('library_root_missing')) { $script:Problems.Add('library_sync_failed') }
  $client = New-HttpClient
  try {
    $machine = (($env:COMPUTERNAME -replace '[^A-Za-z0-9_-]', '-') + '-library')
    [void](Invoke-Engine $client (Resolve-EngineUrl) (Get-RunnerToken) 'POST' '/api/library/recordings/lane' ([ordered]@{ machine = $machine; problems = @(@($script:Problems) + @($script:PullProblems) | Select-Object -Unique) }))
  } catch {
    Write-Log "this pass's report did not reach the engine: $($_.Exception.Message)"
  } finally { $client.Dispose() }
}

function Invoke-Pass {
  $workDir = Join-Path ([System.IO.Path]::GetTempPath()) ('mindmake-library-sync-' + [guid]::NewGuid().ToString())
  [void][System.IO.Directory]::CreateDirectory($workDir)
  $client = New-HttpClient
  try {
    $config = Get-StudioConfig
    $base = Resolve-EngineUrl
    $token = Get-RunnerToken
    $machine = Get-MachineId
    # Where the runtime folders are now, by their Drive IDs, asked once a pass;
    # the library root comes from it, with studio.json's path as the fallback.
    $folders = Get-RuntimeFolders $client $base $token $machine
    $heartsideFolder = Get-HeartsideFolder $client $base $token $machine
    # Written before anything can stop the pass, so music, the archive and the
    # other repositories on this computer always have the newest answer.
    try { Write-DrivePaths $config $folders $heartsideFolder ([string](Get-Field (Get-Field $config 'runtime') 'library_root')) }
    catch { Write-Log "drive-paths.json could not be written: $($_.Exception.Message)" }
    $root = Resolve-LibraryRoot $config $folders
    if ($Check) { Write-Log "Checking only: nothing is written. Library: $root" }
    if (-not $SkipBrandKit) {
      try { $null = Sync-BrandKit $client $root $workDir }
      catch { Write-Log "the brand kit check failed: $($_.Exception.Message)" }
    }
    $result = Sync-Pending $client $base $token $root $machine $workDir
    if ($result.written -gt 0 -or $result.failed -gt 0) { Write-Log "wrote $($result.written) file(s); $($result.failed) could not be written and will be tried again" }
    # Heartside's library, after makeyourmindup's and apart from it: a problem
    # here is logged and reported, and never stops the makeyourmindup pass.
    $heartsideOk = $true
    try {
      $heartside = Resolve-HeartsideRoot $config $heartsideFolder
      if ($heartside) {
        if ($Check) { Write-Log "Checking only: nothing is written. Heartside library: $heartside" }
        $hs = Sync-Pending $client $base $token $heartside $machine $workDir 'heartside'
        if ($hs.written -gt 0 -or $hs.failed -gt 0) { Write-Log "Heartside: wrote $($hs.written) file(s); $($hs.failed) could not be written and will be tried again" }
        $heartsideOk = ($hs.failed -eq 0)
      }
    } catch {
      Write-Log "the Heartside library pass stopped: $($_.Exception.Message)"
      $heartsideOk = $false
    }
    return ($result.failed -eq 0 -and $heartsideOk)
  } finally {
    $client.Dispose()
    if (Test-Path -LiteralPath $workDir) { Remove-Item -LiteralPath $workDir -Recurse -Force }
  }
}

function Update-Source {
  # Brings the dedicated library-source clone up to date, so a fix on main
  # reaches the machine without anyone running git pull (as recordings-upload.ps1
  # does for its own clone). Never the runner's checkout, never a session's copy.
  if ((Split-Path -Leaf $RepoRoot) -ne $SourceFolderName) { return }
  $git = Get-Command git.exe -ErrorAction SilentlyContinue
  if ($null -eq $git) { Write-Log 'git is not on this machine; this copy is not updated'; return }
  $previous = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try {
    $output = @(& $git.Source -C $RepoRoot pull --ff-only --quiet 2>&1)
    $code = $LASTEXITCODE
  } finally { $ErrorActionPreference = $previous }
  if ($code -ne 0) { Write-Log "git pull did not finish ($($output -join ' ')); this pass runs on the copy as it is" }
  Set-PullProblem 'library_source_pull_failed' ($code -ne 0)
}

# ---- one pass, or a pass every few minutes -----------------------------------

$script:Problems = New-Object System.Collections.Generic.List[string]

# A failed pull of main is kept outside the per-pass problem list, which each pass clears before it runs: the pull
# happens outside the pass, and its result rides on every lane report until a pull succeeds (audit ve-11).
$script:PullProblems = New-Object System.Collections.Generic.List[string]
function Set-PullProblem([string]$Code, [bool]$Failed) {
  [void]$script:PullProblems.Remove($Code)
  if ($Failed) { $script:PullProblems.Add($Code) }
}

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
    $script:Problems.Clear()
    $ok = $false
    try { $ok = [bool](Invoke-Pass) }
    catch { Write-Log "this pass stopped: $($_.Exception.Message). Trying again in $EveryMinutes minutes." }
    Send-LaneReport $ok
    Start-Sleep -Seconds ($EveryMinutes * 60)
    try { Update-Source } catch { Write-Log "the update check failed: $($_.Exception.Message)" }
    if ((Get-Sha256 $scriptPath) -ne $scriptSha) {
      Write-Log 'library-sync.ps1 has changed; ending so the scheduled task starts the new version'
      exit 0
    }
  }
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
