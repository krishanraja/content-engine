param([Parameter(ValueFromRemainingArguments = $true)][string[]]$StudioArgs)
$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot
try {
  $venvScripts = Join-Path $repoRoot '.venv\Scripts'
  if (Test-Path -LiteralPath $venvScripts) { $env:Path = "$venvScripts;$env:Path" }
  & npm run --silent studio -- @StudioArgs
  exit $LASTEXITCODE
} finally {
  Pop-Location
}
