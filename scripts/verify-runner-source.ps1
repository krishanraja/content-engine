[CmdletBinding()]
param(
  [string]$RepoRoot,
  [switch]$RequirePersistentLocation
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

function Get-NormalizedPath([string]$Path) {
  return [System.IO.Path]::GetFullPath($Path).TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
}

function Test-SamePath([string]$Left, [string]$Right) {
  return [string]::Equals((Get-NormalizedPath $Left), (Get-NormalizedPath $Right), [System.StringComparison]::OrdinalIgnoreCase)
}

function Test-PathWithin([string]$Path, [string]$Parent) {
  $normalizedPath = Get-NormalizedPath $Path
  $normalizedParent = Get-NormalizedPath $Parent
  if (Test-SamePath $normalizedPath $normalizedParent) { return $true }
  return $normalizedPath.StartsWith("$normalizedParent$([System.IO.Path]::DirectorySeparatorChar)", [System.StringComparison]::OrdinalIgnoreCase)
}

function Get-Sha256([string]$Path) {
  $stream = [System.IO.File]::Open($Path, [System.IO.FileMode]::Open, [System.IO.FileAccess]::Read, [System.IO.FileShare]::Read)
  $algorithm = [System.Security.Cryptography.SHA256]::Create()
  try {
    return (($algorithm.ComputeHash($stream) | ForEach-Object { $_.ToString('x2') }) -join '')
  } finally {
    $algorithm.Dispose()
    $stream.Dispose()
  }
}

if ($env:OS -ne 'Windows_NT') { throw 'The runner source preflight is supported only on Windows.' }

if ([string]::IsNullOrWhiteSpace($RepoRoot)) { $RepoRoot = Split-Path -Parent $PSScriptRoot }
$repoRoot = Get-NormalizedPath $RepoRoot
if (-not (Test-Path -LiteralPath (Join-Path $repoRoot 'package.json') -PathType Leaf)) {
  throw 'Runner source preflight requires the repository root.'
}

$localAppData = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::LocalApplicationData)
if (-not [string]::IsNullOrWhiteSpace($localAppData) -and (Test-PathWithin $repoRoot $localAppData)) {
  throw 'Runner source must not be installed under LocalAppData because packaged applications can virtualize that path and break npm workspace links.'
}

if ($RequirePersistentLocation) {
  $userProfile = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::UserProfile)
  if ([string]::IsNullOrWhiteSpace($userProfile)) { throw 'The current Windows user profile could not be resolved.' }
  $expectedRoot = Get-NormalizedPath (Join-Path $userProfile 'Documents\MindmakeVideoStudio\runner-source')
  if (-not (Test-SamePath $repoRoot $expectedRoot)) {
    throw "The scheduled runner must be installed from the dedicated persistent source at $expectedRoot."
  }
  $expectedRuntimeRoot = Get-NormalizedPath (Join-Path $userProfile 'Documents\MindmakeVideoStudio\runtime')
  $configuredRuntimeRoot = if ($env:MINDMAKE_RUNTIME_ROOT) { Get-NormalizedPath $env:MINDMAKE_RUNTIME_ROOT } else { $expectedRuntimeRoot }
  if (-not (Test-SamePath $configuredRuntimeRoot $expectedRuntimeRoot)) {
    throw "The scheduled runner runtime must remain at $expectedRuntimeRoot so interactive and background processes share one state root."
  }
  $runtimeMigration = Join-Path $PSScriptRoot 'migrate-runner-runtime.ps1'
  if (-not (Test-Path -LiteralPath $runtimeMigration -PathType Leaf)) { throw 'Runner runtime migration verifier is missing.' }
  & $runtimeMigration -CheckOnly | Out-Null
}

$git = Get-Command git.exe -ErrorAction Stop
function Invoke-Git([string[]]$Arguments) {
  $output = @(& $git.Source -C $repoRoot @Arguments 2>&1)
  if ($LASTEXITCODE -ne 0) { throw "Git source verification failed for: $($Arguments -join ' ')" }
  return ($output -join "`n").Trim()
}

$gitRoot = Invoke-Git @('rev-parse', '--show-toplevel')
if (-not (Test-SamePath $repoRoot $gitRoot)) { throw 'Runner source must be the exact Git repository root.' }

$commit = Invoke-Git @('rev-parse', 'HEAD')
if ($commit -notmatch '^[0-9a-fA-F]{40}$') { throw 'Runner source HEAD is not an exact Git commit.' }

$status = Invoke-Git @('status', '--porcelain=v1', '--untracked-files=all')
if (-not [string]::IsNullOrWhiteSpace($status)) { throw 'Runner source must be an exact clean checkout before task installation.' }

$nodeModules = Join-Path $repoRoot 'node_modules'
if (-not (Test-Path -LiteralPath $nodeModules -PathType Container)) {
  throw 'Runner dependencies are missing. Run npm ci from the persistent source checkout.'
}

$workspaceManifests = @()
foreach ($containerName in @('apps', 'packages')) {
  $container = Join-Path $repoRoot $containerName
  if (-not (Test-Path -LiteralPath $container -PathType Container)) { continue }
  foreach ($directory in Get-ChildItem -LiteralPath $container -Directory) {
    $manifest = Join-Path $directory.FullName 'package.json'
    if (Test-Path -LiteralPath $manifest -PathType Leaf) { $workspaceManifests += Get-Item -LiteralPath $manifest }
  }
}
if ($workspaceManifests.Count -eq 0) { throw 'No npm workspace packages were found.' }

$verifiedPackages = @()
foreach ($manifest in $workspaceManifests | Sort-Object FullName) {
  $workspace = Get-Content -Raw -LiteralPath $manifest.FullName | ConvertFrom-Json
  if ([string]::IsNullOrWhiteSpace($workspace.name)) { throw 'Every npm workspace requires a package name.' }

  $workspaceLink = $nodeModules
  foreach ($segment in $workspace.name.Split('/')) { $workspaceLink = Join-Path $workspaceLink $segment }
  $linkedManifest = Join-Path $workspaceLink 'package.json'
  if (-not (Test-Path -LiteralPath $linkedManifest -PathType Leaf)) {
    throw "The npm workspace link for $($workspace.name) is not traversable. This can indicate a virtualized source path or an incomplete npm ci."
  }

  $linkItem = Get-Item -LiteralPath $workspaceLink -Force
  if ($linkItem.LinkType -in @('Junction', 'SymbolicLink')) {
    $target = @($linkItem.Target)[0]
    if ([string]::IsNullOrWhiteSpace($target)) { throw "The npm workspace link for $($workspace.name) has no target." }
    if (-not [System.IO.Path]::IsPathRooted($target)) { $target = Join-Path (Split-Path -Parent $workspaceLink) $target }
    if (-not (Test-SamePath $target $manifest.DirectoryName)) {
      throw "The npm workspace link for $($workspace.name) points outside its checked-out package."
    }
  }

  $directHash = Get-Sha256 $manifest.FullName
  $linkedHash = Get-Sha256 $linkedManifest
  if ($directHash -ne $linkedHash) { throw "The npm workspace link for $($workspace.name) does not match its checked-out package." }
  $verifiedPackages += $workspace.name
}

$npm = Get-Command npm.cmd -ErrorAction Stop
Push-Location $repoRoot
try {
  $cliOutput = @(& $npm.Source run --silent studio -- --version 2>&1)
  if ($LASTEXITCODE -ne 0) { throw 'The packaged studio CLI import smoke failed from this source location.' }
} finally {
  Pop-Location
}
$expectedVersion = (Get-Content -Raw -LiteralPath (Join-Path $repoRoot 'package.json') | ConvertFrom-Json).version
if (($cliOutput -join "`n").Trim() -ne $expectedVersion) { throw 'The packaged studio CLI returned an unexpected version during source preflight.' }

[ordered]@{
  ok = $true
  commit = $commit.ToLowerInvariant()
  workspace_packages = @($verifiedPackages)
  cli_version = $expectedVersion
  persistent_location_required = [bool]$RequirePersistentLocation
} | ConvertTo-Json -Compress
