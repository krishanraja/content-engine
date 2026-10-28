# No window, ever, from a scheduled task on a home computer. Krish, 2026-10-28: "it flashes up black
# powershell-looking screens repeatedly for about 2 minutes, disabling me from doing anything on my machine", then
# "HIDE ALL CONSOLE POP UPS FOREVER FROM EVERY REPO AND LOCAL TASK".
#
# A task that starts powershell.exe, node.exe, python.exe or cmd.exe in his session gets a console window, even with
# -WindowStyle Hidden: Windows draws the window before PowerShell can hide it. So every such task runs through
# run-hidden.exe instead (windowless\RunHidden.cs): a program with no window of its own that starts the same command
# line with no window and hands back its exit code. It is built on the machine the first time it is needed, by the C#
# compiler Windows carries, copied to one fixed path (run-hidden.exe) and proved to run a command before any task is
# pointed at it.
#
# Dot-source this file; it only defines functions. Invoke-WindowKeeper is what the recordings pass runs each pass
# (scripts\recordings-upload.ps1): every task of his that would open a console window is changed to run through
# run-hidden.exe, and nothing else about the task is touched. Each change is written to changed.log beside the
# launcher, with what the task ran before.

$script:WindowlessSource = Join-Path $PSScriptRoot 'windowless\RunHidden.cs'
$script:WindowlessLauncher = $null
# Programs that open a console window when a task starts them. A program with no console of its own (pythonw.exe,
# wscript.exe, any app) is left as it is.
$script:WindowlessConsolePrograms = @('powershell.exe', 'pwsh.exe', 'cmd.exe', 'node.exe', 'python.exe', 'py.exe',
  'bash.exe', 'sh.exe', 'git.exe', 'npm.cmd', 'npx.cmd')

function Get-WindowlessRoot { Join-Path $env:LOCALAPPDATA 'Mindmake\windowless' }

function Format-WindowlessCommand([string]$Execute, [string]$Arguments) {
  $program = '"' + $Execute.Trim().Trim('"') + '"'
  if ([string]::IsNullOrWhiteSpace($Arguments)) { return $program }
  return "$program $($Arguments.Trim())"
}

function Split-WindowlessCommand([string]$Command) {
  # The program and the rest, read the way Windows reads a program's name (RunHidden.AfterFirst).
  $line = $Command.TrimStart(' ', "`t")
  if ($line.StartsWith('"')) {
    $close = $line.IndexOf('"', 1)
    $end = if ($close -lt 0) { $line.Length } else { $close + 1 }
  } else {
    $end = $line.IndexOfAny([char[]]@(' ', "`t"))
    if ($end -lt 0) { $end = $line.Length }
  }
  return @($line.Substring(0, $end).Trim('"'), $line.Substring($end).TrimStart(' ', "`t"))
}

function Test-WindowlessLauncher([string]$Execute) {
  return [System.IO.Path]::GetFileName($Execute.Trim().Trim('"')) -match '^run-hidden(-[0-9a-f]+)?\.exe$'
}

function Test-ConsoleProgram([string]$Execute) {
  $path = [Environment]::ExpandEnvironmentVariables($Execute.Trim().Trim('"'))
  $leaf = [System.IO.Path]::GetFileName($path).ToLowerInvariant()
  if ($leaf -notmatch '\.[a-z0-9]+$') { $leaf = "$leaf.exe" }
  return ($script:WindowlessConsolePrograms -contains $leaf) -or $leaf.EndsWith('.bat') -or $leaf.EndsWith('.cmd')
}

function Invoke-Windowless([string]$Launcher, [string]$Execute, [string]$Arguments, [int]$TimeoutMs = 30000) {
  # Runs a command through the launcher and returns its exit code; a GUI program is not waited for by PowerShell's
  # own call operator, so the process is started and waited for here.
  $start = New-Object System.Diagnostics.ProcessStartInfo
  $start.FileName = $Launcher
  $start.Arguments = Format-WindowlessCommand $Execute $Arguments
  $start.UseShellExecute = $false
  $process = [System.Diagnostics.Process]::Start($start)
  try {
    if (-not $process.WaitForExit($TimeoutMs)) { $process.Kill(); return -1 }
    return $process.ExitCode
  } finally { $process.Dispose() }
}

function Get-WindowlessLauncher {
  param([string]$Root = (Get-WindowlessRoot))
  if ($script:WindowlessLauncher -and (Test-Path -LiteralPath $script:WindowlessLauncher -PathType Leaf)) { return $script:WindowlessLauncher }
  $source = [System.IO.File]::ReadAllText($script:WindowlessSource)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { $digest = $sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($source)) } finally { $sha.Dispose() }
  $hash = -join ($digest[0..5] | ForEach-Object { $_.ToString('x2') })
  $target = Join-Path $Root "run-hidden-$hash.exe"
  if (-not (Test-Path -LiteralPath $target -PathType Leaf)) {
    [void](New-Item -ItemType Directory -Force -Path $Root)
    $building = Join-Path $Root ('building-' + [guid]::NewGuid().ToString('N') + '.exe')
    try {
      if ($PSVersionTable.PSEdition -eq 'Core') {
        # PowerShell 7 cannot write a program; Windows PowerShell, which every Windows carries, can.
        $command = "Add-Type -TypeDefinition ([IO.File]::ReadAllText('$($script:WindowlessSource -replace "'", "''")')) -OutputAssembly '$($building -replace "'", "''")' -OutputType WindowsApplication"
        $output = @(& (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -NoProfile -NonInteractive -Command $command 2>&1)
        if ($LASTEXITCODE -ne 0) { throw "run-hidden.exe could not be built: $($output -join ' ')" }
      } else {
        Add-Type -TypeDefinition $source -OutputAssembly $building -OutputType WindowsApplication
      }
      if (-not (Test-Path -LiteralPath $target -PathType Leaf)) { Move-Item -LiteralPath $building -Destination $target }
    } finally {
      if (Test-Path -LiteralPath $building) { Remove-Item -LiteralPath $building -Force -ErrorAction SilentlyContinue }
    }
  }
  # Tasks point at one fixed path, run-hidden.exe, refreshed here from this source's build. A task an admin installed
  # is pointed at it once with admin rights, and every later build reaches it with none (28 October: three such tasks
  # on Surface). A copy in use is renamed aside, which Windows allows for a running program, and swept once free.
  $stable = Join-Path $Root 'run-hidden.exe'
  if (-not (Test-Path -LiteralPath $stable -PathType Leaf) -or (Get-FileHash -LiteralPath $stable).Hash -ne (Get-FileHash -LiteralPath $target).Hash) {
    if (Test-Path -LiteralPath $stable) { Move-Item -LiteralPath $stable -Destination (Join-Path $Root ('run-hidden.' + [guid]::NewGuid().ToString('N') + '.old')) }
    Copy-Item -LiteralPath $target -Destination $stable
  }
  foreach ($old in @(Get-ChildItem -LiteralPath $Root -Filter 'run-hidden.*.old' -File -ErrorAction SilentlyContinue)) {
    Remove-Item -LiteralPath $old.FullName -Force -ErrorAction SilentlyContinue
  }
  $code = Invoke-Windowless $stable (Join-Path $env:SystemRoot 'System32\cmd.exe') '/c exit 7'
  if ($code -ne 7) { throw "run-hidden.exe did not run a command (exit $code)" }
  $script:WindowlessLauncher = $stable
  return $stable
}

function New-WindowlessTaskAction([string]$Execute, [string]$Argument, [string]$WorkingDirectory) {
  # The action a task registers: the same command, through run-hidden.exe.
  $launcher = Get-WindowlessLauncher
  $action = @{ Execute = $launcher; Argument = (Format-WindowlessCommand $Execute $Argument) }
  if (-not [string]::IsNullOrWhiteSpace($WorkingDirectory)) { $action.WorkingDirectory = $WorkingDirectory }
  return New-ScheduledTaskAction @action
}

function Test-TaskRunsAsMe($Task, $Me) {
  # A task in his session: his account, signed in (a task that runs whether he is signed in or not runs where no
  # window can show, and is left alone).
  $principal = $Task.Principal
  if ($null -eq $principal) { return $false }
  if (@('Password', 'S4U', 'ServiceAccount') -contains [string]$principal.LogonType) { return $false }
  $id = [string]$principal.UserId
  if ([string]::IsNullOrWhiteSpace($id)) { return $false }
  if ($id -match '^S-1-') { return $id -eq $Me.Value }
  try { return ([System.Security.Principal.NTAccount]$id).Translate([System.Security.Principal.SecurityIdentifier]).Value -eq $Me.Value }
  catch { return ($id -split '\\')[-1] -ieq $env:USERNAME }
}

function Invoke-WindowKeeper {
  # Every task of his that would open a console window runs through run-hidden.exe after this. Returns counts only:
  # launcher ok or failed, tasks already hidden, tasks changed now, and tasks that could not be changed.
  param([string]$TaskPathPrefix = '\', [string]$Root = (Get-WindowlessRoot))
  $result = [ordered]@{ launcher = 'failed'; hidden = 0; wrapped = 0; left = 0; left_by = [ordered]@{}; left_names = @() }
  try { $launcher = Get-WindowlessLauncher -Root $Root } catch { $result['error'] = $_.Exception.Message; return $result }
  $result.launcher = 'ok'
  $me = [System.Security.Principal.WindowsIdentity]::GetCurrent().User
  $tasks = @(Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object {
    $_.TaskPath.StartsWith($TaskPathPrefix, [System.StringComparison]::OrdinalIgnoreCase) -and -not $_.TaskPath.StartsWith('\Microsoft\', [System.StringComparison]::OrdinalIgnoreCase)
  })
  foreach ($task in $tasks) {
    if (-not (Test-TaskRunsAsMe $task $me)) { continue }
    $console = $false
    $changed = $false
    $before = New-Object System.Collections.Generic.List[string]
    $actions = New-Object System.Collections.Generic.List[object]
    foreach ($action in @($task.Actions)) {
      $execute = [string](Get-WindowlessField $action 'Execute')
      if ([string]::IsNullOrWhiteSpace($execute)) { $actions.Add($action); continue }
      $arguments = [string](Get-WindowlessField $action 'Arguments')
      $directory = [string](Get-WindowlessField $action 'WorkingDirectory')
      if (Test-WindowlessLauncher $execute) {
        $console = $true
        if ([string]::Equals($execute.Trim('"'), $launcher, [System.StringComparison]::OrdinalIgnoreCase)) { $actions.Add($action); continue }
        $inner = Split-WindowlessCommand $arguments  # an older build of the launcher: the same command, this build
        $actions.Add((New-WindowlessTaskAction $inner[0] $inner[1] $directory))
      } elseif (Test-ConsoleProgram $execute) {
        $console = $true
        $actions.Add((New-WindowlessTaskAction $execute $arguments $directory))
      } else { $actions.Add($action); continue }
      $changed = $true
      $before.Add((Format-WindowlessCommand $execute $arguments))
    }
    if (-not $console) { continue }
    if (-not $changed) { $result.hidden++; continue }
    try {
      $enabled = [bool]$task.Settings.Enabled
      [void](Set-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath -Action $actions.ToArray() -ErrorAction Stop)
      $after = Get-ScheduledTask -TaskName $task.TaskName -TaskPath $task.TaskPath -ErrorAction Stop
      if ([bool]$after.Settings.Enabled -ne $enabled) {
        if ($enabled) { [void](Enable-ScheduledTask -InputObject $after) } else { [void](Disable-ScheduledTask -InputObject $after) }
      }
      $still = @($after.Actions | Where-Object {
        $e = [string](Get-WindowlessField $_ 'Execute'); $e -and -not (Test-WindowlessLauncher $e) -and (Test-ConsoleProgram $e)
      })
      if ($still.Count) { throw 'the task still starts a console program directly' }
      $result.wrapped++
      $line = [ordered]@{ at = [DateTime]::UtcNow.ToString('o'); task = "$($task.TaskPath)$($task.TaskName)"; before = @($before); launcher = $launcher }
      Add-Content -LiteralPath (Join-Path $Root 'changed.log') -Value ($line | ConvertTo-Json -Compress) -Encoding UTF8
    } catch {
      $result.left++
      $result['error'] = "$($task.TaskName): $($_.Exception.Message)"
      $why = Get-WindowlessReason $task $_.Exception
      $result.left_by[$why] = 1 + [int]$result.left_by[$why]
      # A task still opening windows is named, at most five, in plain characters: which program it belongs to decides
      # what fixes it (28 October: Surface left three, refused, none of them ours). Never its command or its folder.
      if (@($result.left_names).Count -lt 5) { $result.left_names += (($task.TaskName -replace '[^A-Za-z0-9 ._()-]', '_') -replace '^(.{0,80}).*$', '$1') }
    }
  }
  return $result
}

function Get-WindowlessReason($Task, $Exception) {
  # Why a task could not be changed, as a class the engine can carry (never the task's name or command):
  # elevated (it runs with highest privileges, which a pass without them cannot change), access_denied, or other.
  if ([string](Get-WindowlessField $Task.Principal 'RunLevel') -eq 'Highest') { return 'elevated' }
  for ($e = $Exception; $null -ne $e; $e = $e.InnerException) {
    if ($e.HResult -eq -2147024891 -or $e.Message -match 'Access is denied') { return 'access_denied' }
  }
  return 'other'
}

function Get-WindowlessField($Object, [string]$Name) {
  if ($null -eq $Object) { return $null }
  $property = $Object.PSObject.Properties[$Name]
  if ($null -eq $property) { return $null }
  return $property.Value
}
