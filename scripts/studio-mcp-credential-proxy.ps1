param(
  [string]$Endpoint = 'https://controlcenter.krishraja.com/api/video-studio/mcp',
  [string]$CredentialTarget = 'MindmakeVideoStudio/studio-mcp-token'
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

if ($Endpoint -ne 'https://controlcenter.krishraja.com/api/video-studio/mcp') {
  throw 'The Studio MCP proxy is pinned to the production gateway.'
}
if ($CredentialTarget -ne 'MindmakeVideoStudio/studio-mcp-token') {
  throw 'The Studio MCP proxy only accepts the dedicated Studio credential target.'
}

$readerPath = Join-Path $PSScriptRoot 'get-credential.ps1'
$reader = [Diagnostics.ProcessStartInfo]::new()
$reader.FileName = 'pwsh'
$reader.UseShellExecute = $false
$reader.CreateNoWindow = $true
$reader.RedirectStandardOutput = $true
$reader.RedirectStandardError = $true
foreach ($argument in @(
  '-NoProfile',
  '-NonInteractive',
  '-ExecutionPolicy',
  'Bypass',
  '-File',
  $readerPath,
  '-Target',
  $CredentialTarget
)) {
  [void]$reader.ArgumentList.Add($argument)
}

$readerProcess = [Diagnostics.Process]::Start($reader)
$token = $readerProcess.StandardOutput.ReadToEnd().Trim()
$readerError = $readerProcess.StandardError.ReadToEnd()
$readerProcess.WaitForExit()
if ($readerProcess.ExitCode -ne 0 -or $token.Length -lt 32) {
  $token = $null
  throw "The dedicated Studio credential could not be loaded. $readerError"
}
if (-not $token.StartsWith('vst_mcp_', [StringComparison]::Ordinal)) {
  $token = $null
  throw 'The dedicated Studio credential has the wrong family prefix.'
}

$client = [Net.Http.HttpClient]::new()
$client.DefaultRequestHeaders.Authorization = [Net.Http.Headers.AuthenticationHeaderValue]::new('Bearer', $token)
$token = $null

try {
  while ($null -ne ($line = [Console]::In.ReadLine())) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }

    $requestId = $null
    $hasResponse = $true
    try {
      $request = $line | ConvertFrom-Json
      if ($request.PSObject.Properties.Name -contains 'id') {
        $requestId = $request.id
      } else {
        $hasResponse = $false
      }
    } catch {
      $errorResponse = @{ jsonrpc = '2.0'; id = $null; error = @{ code = -32700; message = 'Parse error' } } | ConvertTo-Json -Compress
      [Console]::Out.WriteLine($errorResponse)
      [Console]::Out.Flush()
      continue
    }

    try {
      $content = [Net.Http.StringContent]::new($line, [Text.Encoding]::UTF8, 'application/json')
      $response = $client.PostAsync($Endpoint, $content).GetAwaiter().GetResult()
      $responseBody = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
      if ($response.StatusCode -eq [Net.HttpStatusCode]::Accepted -or -not $hasResponse) { continue }
      if (-not $response.IsSuccessStatusCode) {
        throw "Gateway returned HTTP $([int]$response.StatusCode)."
      }
      [Console]::Out.WriteLine($responseBody)
      [Console]::Out.Flush()
    } catch {
      if (-not $hasResponse) {
        [Console]::Error.WriteLine('Studio MCP notification forwarding failed.')
        continue
      }
      $errorResponse = @{
        jsonrpc = '2.0'
        id = $requestId
        error = @{ code = -32000; message = 'Studio MCP gateway unavailable' }
      } | ConvertTo-Json -Compress -Depth 5
      [Console]::Out.WriteLine($errorResponse)
      [Console]::Out.Flush()
    }
  }
} finally {
  $client.Dispose()
}
