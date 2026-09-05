[CmdletBinding()]
param(
  [switch]$CheckOnly,
  [string]$FixtureLegacyRoot,
  [string]$FixtureTargetRoot
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$userProfile = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::UserProfile)
$localAppData = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::LocalApplicationData)
if ([string]::IsNullOrWhiteSpace($userProfile) -or [string]::IsNullOrWhiteSpace($localAppData)) {
  throw 'The current Windows profile paths could not be resolved.'
}

$productionLegacyRoot = [System.IO.Path]::GetFullPath((Join-Path $localAppData 'MindmakeVideoStudio'))
$productionTargetRoot = [System.IO.Path]::GetFullPath((Join-Path $userProfile 'Documents\MindmakeVideoStudio\runtime'))
if ([string]::IsNullOrWhiteSpace($FixtureLegacyRoot) -xor [string]::IsNullOrWhiteSpace($FixtureTargetRoot)) {
  throw 'Runtime migration fixtures require both source and target roots.'
}
$legacyRoot = if ($FixtureLegacyRoot) { [System.IO.Path]::GetFullPath($FixtureLegacyRoot) } else { $productionLegacyRoot }
$targetRoot = if ($FixtureTargetRoot) { [System.IO.Path]::GetFullPath($FixtureTargetRoot) } else { $productionTargetRoot }
if ($FixtureLegacyRoot) {
  $legacyPrefix = "$($legacyRoot.TrimEnd('\'))\"
  $targetPrefix = "$($targetRoot.TrimEnd('\'))\"
  if ([string]::Equals($legacyRoot, $targetRoot, [System.StringComparison]::OrdinalIgnoreCase) -or $legacyRoot.StartsWith($targetPrefix, [System.StringComparison]::OrdinalIgnoreCase) -or $targetRoot.StartsWith($legacyPrefix, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Runtime migration fixture roots must not overlap.'
  }
  foreach ($fixtureRoot in @($legacyRoot, $targetRoot)) {
    foreach ($productionRoot in @($productionLegacyRoot, $productionTargetRoot)) {
      if ([string]::Equals($fixtureRoot, $productionRoot, [System.StringComparison]::OrdinalIgnoreCase) -or $fixtureRoot.StartsWith("$($productionRoot.TrimEnd('\'))\", [System.StringComparison]::OrdinalIgnoreCase)) {
        throw 'Runtime migration fixture roots must remain outside production roots.'
      }
    }
  }
}
$excludedTopLevel = @('browser', 'cache', 'python', 'runner-source', 'studio.sqlite', 'studio.sqlite-shm', 'studio.sqlite-wal')

function Test-ExcludedTopLevel([string]$Name) {
  return $excludedTopLevel -contains $Name.ToLowerInvariant()
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

function Get-DirectoryFiles([string]$Root) {
  $files = New-Object 'System.Collections.Generic.List[System.IO.FileInfo]'
  $pending = New-Object 'System.Collections.Generic.Stack[string]'
  $pending.Push($Root)
  while ($pending.Count -gt 0) {
    $directory = $pending.Pop()
    foreach ($entry in Get-ChildItem -LiteralPath $directory -Force) {
      if (($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
        throw "Legacy runtime entry $($entry.Name) is a reparse point and requires manual review."
      }
      if ($entry.PSIsContainer) { $pending.Push($entry.FullName) }
      elseif ($entry -is [System.IO.FileInfo]) { $files.Add($entry) }
      else { throw "Legacy runtime entry $($entry.Name) has an unsupported filesystem type." }
    }
  }
  return @($files)
}

function Get-LegacyFiles {
  if (-not (Test-Path -LiteralPath $legacyRoot -PathType Container)) { return @() }
  $files = @()
  foreach ($entry in Get-ChildItem -LiteralPath $legacyRoot -Force) {
    if (Test-ExcludedTopLevel $entry.Name) { continue }
    if (($entry.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0) {
      throw "Legacy runtime entry $($entry.Name) is a reparse point and requires manual review."
    }
    if ($entry.PSIsContainer) {
      $files += @(Get-DirectoryFiles $entry.FullName)
    } else {
      $files += $entry
    }
  }
  return @($files | Sort-Object FullName)
}

function Get-TargetPath([System.IO.FileInfo]$Source) {
  $relativePath = $Source.FullName.Substring($legacyRoot.Length).TrimStart('\', '/')
  if ([string]::IsNullOrWhiteSpace($relativePath) -or $relativePath.StartsWith('..')) {
    throw 'Legacy runtime file escaped its expected root.'
  }
  $target = [System.IO.Path]::GetFullPath((Join-Path $targetRoot $relativePath))
  if (-not $target.StartsWith("$($targetRoot.TrimEnd('\'))\", [System.StringComparison]::OrdinalIgnoreCase)) {
    throw 'Legacy runtime target escaped the canonical runtime root.'
  }
  return [pscustomobject]@{ RelativePath = $relativePath.Replace('\', '/'); TargetPath = $target }
}

$legacyFiles = @(Get-LegacyFiles)
$copied = 0
$identical = 0
foreach ($source in $legacyFiles) {
  $target = Get-TargetPath $source
  $sourceHash = Get-Sha256 $source.FullName
  if (Test-Path -LiteralPath $target.TargetPath -PathType Leaf) {
    $targetFile = Get-Item -LiteralPath $target.TargetPath -Force
    if ($targetFile.Length -ne $source.Length -or (Get-Sha256 $target.TargetPath) -ne $sourceHash) {
      throw "Legacy runtime migration found a conflicting target at $($target.RelativePath). No file was overwritten."
    }
    $identical += 1
    continue
  }
  if ($CheckOnly) {
    throw "Legacy runtime state is not present in the canonical runtime at $($target.RelativePath). Run scripts/migrate-runner-runtime.ps1 before installing the task."
  }

  $targetDirectory = Split-Path -Parent $target.TargetPath
  New-Item -ItemType Directory -Force -Path $targetDirectory | Out-Null
  $stagingRoot = Join-Path $targetRoot '.migration-staging'
  New-Item -ItemType Directory -Force -Path $stagingRoot | Out-Null
  $staged = Join-Path $stagingRoot "$([guid]::NewGuid().ToString('N')).tmp"
  [System.IO.File]::Copy($source.FullName, $staged, $false)
  if ((Get-Sha256 $staged) -ne $sourceHash) {
    throw "Legacy runtime copy verification failed for $($target.RelativePath)."
  }
  [System.IO.File]::Move($staged, $target.TargetPath)
  $copied += 1
}

[ordered]@{
  ok = $true
  mode = if ($CheckOnly) { 'check' } else { 'copy' }
  legacy_files = $legacyFiles.Count
  copied_files = $copied
  identical_files = $identical
  excluded_rebuildable_entries = @($excludedTopLevel)
} | ConvertTo-Json -Compress
