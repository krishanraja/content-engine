<#
Studio MCP token for the cold standby, in one run.

Run this on the standby machine (runner e4e562cc) in Windows PowerShell:

  powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Downloads\standby-studio-mcp-token.ps1"

Keep this file outside the runner checkout. Downloads is fine. An extra file
inside runner-source makes the checkout unclean, and the runner refuses work
from an unclean checkout.

What it does, in order:
  1. Finds this machine's runner checkout and its credential scripts.
  2. Checks the runner task on this machine is disabled. Only the primary's task
     may be enabled (Protocol v1 is single-runner). If it is enabled here, the
     script stops and changes nothing.
  3. Asks for the token at a hidden prompt and stores it under
     MindmakeVideoStudio/studio-mcp-token-v2, using the checkout's own writer.
     The writer refuses a value outside the vst_mcp_ family before it deletes
     or writes anything.
  4. Runs the credential check and prints the 12-character fingerprint. The
     value itself is never shown, logged, written to a file or put on a
     command line.

Where the value comes from: it must be the same token that is on the primary
and in Vercel. Paste it from your password manager. If it is not in one yet,
run this on the primary, save the clipboard into the password manager, then
clear the clipboard:

  pwsh -NoProfile -File "$env:USERPROFILE\Documents\MindmakeVideoStudio\runner-source\scripts\get-credential.ps1" -Target MindmakeVideoStudio/studio-mcp-token-v2 | Set-Clipboard
  Set-Clipboard -Value ' '

Done means: this script ends with "Done.", and the fingerprint it prints
matches the primary's. To see the primary's, run on the primary:

  powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\Documents\MindmakeVideoStudio\runner-source\scripts\inspect-credentials.ps1" -Filter MindmakeVideoStudio/studio-mcp-token-v2
#>
param(
  [string]$Checkout = (Join-Path $env:USERPROFILE 'Documents\MindmakeVideoStudio\runner-source')
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$target = 'MindmakeVideoStudio/studio-mcp-token-v2'
$taskName = 'Mindmake Video Studio Runner'

# 1. The checkout and its two scripts.
$writer = Join-Path $Checkout 'scripts\set-credential.ps1'
$inspector = Join-Path $Checkout 'scripts\inspect-credentials.ps1'
foreach ($path in @($writer, $inspector)) {
  if (-not (Test-Path -LiteralPath $path)) {
    throw "Not found: $path. Run again with -Checkout set to this machine's runner-source folder. Nothing was changed."
  }
}
Write-Host "Runner checkout: $Checkout"

# 2. A standby's runner task stays disabled until a failover.
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($null -eq $task) {
  Write-Host "The runner task is not installed on this machine. Storing the token is still fine."
} elseif ([string]$task.State -ne 'Disabled') {
  throw "The runner task on this machine is $($task.State), not Disabled. A standby stays disabled until a failover, and only one runner task may ever be enabled. Nothing was changed."
} else {
  Write-Host 'The runner task is disabled, as a standby should be.'
}

# 3. Store the token. The writer prompts with hidden input.
Write-Host ''
Write-Host 'Paste the Studio MCP token at the next prompt and press Enter. Nothing you paste is shown.'
& powershell -NoProfile -ExecutionPolicy Bypass -File $writer -Target $target
if ($LASTEXITCODE -ne 0) {
  throw "Storing the token did not complete (exit $LASTEXITCODE). Read the message above; nothing else was changed."
}

# 4. Check the whole credential contract, including the token's family.
Write-Host ''
& powershell -NoProfile -ExecutionPolicy Bypass -File $inspector -EnforceActiveContract
if ($LASTEXITCODE -ne 0) {
  throw "The token is stored, but the credential check did not pass (exit $LASTEXITCODE). Read the message above."
}

Write-Host ''
Write-Host "Done. Compare the fingerprint shown for $target with the primary's. They must be identical."
