param(
  [ValidateSet('daemon', 'once', 'status')][string]$Mode = 'daemon'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$defaultRuntimeRoot = Join-Path $env:USERPROFILE 'Documents\MindmakeVideoStudio\runtime'
if (-not $env:MINDMAKE_RUNTIME_ROOT) { $env:MINDMAKE_RUNTIME_ROOT = $defaultRuntimeRoot }
if (-not [string]::Equals([System.IO.Path]::GetFullPath($env:MINDMAKE_RUNTIME_ROOT), [System.IO.Path]::GetFullPath($defaultRuntimeRoot), [System.StringComparison]::OrdinalIgnoreCase)) {
  throw "The Windows runner runtime must remain at $defaultRuntimeRoot."
}
Push-Location $repoRoot
try {
  $venvScripts = Join-Path $repoRoot '.venv\Scripts'
  if (Test-Path -LiteralPath $venvScripts) { $env:Path = "$venvScripts;$env:Path" }
  $npm = Get-Command npm.cmd -ErrorAction Stop
  & $npm.Source run --silent runner -- $Mode
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
