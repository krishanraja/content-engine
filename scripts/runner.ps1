param(
  [ValidateSet('daemon', 'once', 'status')][string]$Mode = 'daemon'
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
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
