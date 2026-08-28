param([Parameter(ValueFromRemainingArguments = $true)][string[]]$StudioArgs)
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..\..\..')
& (Join-Path $repoRoot 'scripts\studio.ps1') @StudioArgs
exit $LASTEXITCODE
