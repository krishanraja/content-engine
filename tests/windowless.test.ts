import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

// No window, ever, from a scheduled task on a home computer (scripts/windowless.ps1, scripts/windowless/RunHidden.cs).
// Krish, 2026-10-28: "it flashes up black powershell-looking screens repeatedly for about 2 minutes, disabling me from
// doing anything on my machine", then "HIDE ALL CONSOLE POP UPS FOREVER FROM EVERY REPO AND LOCAL TASK".

const ROOT = join(__dirname, '..')
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8').replace(/\r\n/g, '\n')
const launcher = read('scripts/windowless/RunHidden.cs')
const helper = read('scripts/windowless.ps1')
const upload = read('scripts/recordings-upload.ps1')
const ps = (path: string) => join(ROOT, path).replace(/'/g, "''")
// Windows PowerShell from a script file: a long -Command with quotes in it does not survive the command line intact.
function powershell(dir: string, script: string): Record<string, any> {
  const file = join(dir, 'test.ps1')
  writeFileSync(file, '\ufeff' + script, 'utf8')
  const out = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file],
    { encoding: 'utf8', windowsHide: true, timeout: 150_000 })
  return JSON.parse(out.trim().split(/\r?\n/).pop()!)
}

describe('the windowless launcher and keeper', () => {
  it('starts the command with no window, waits for it, hands back its code, and ends it with the task', () => {
    expect(launcher).toContain('start.UseShellExecute = false;')
    expect(launcher).toContain('start.CreateNoWindow = true;')
    expect(launcher).toContain('child.WaitForExit();')
    expect(launcher).toContain('return child.ExitCode;')
    expect(launcher).toContain('const uint KillOnJobClose = 0x2000;')
    expect(launcher).not.toMatch(/\$"|\?\.|=>/)  // C# 5, the compiler every Windows carries
  })

  it('touches only his own signed-in tasks that would open a console, never Windows\' own, and logs every change', () => {
    expect(helper).toContain("-not $_.TaskPath.StartsWith('\\Microsoft\\'")
    expect(helper).toContain("@('Password', 'S4U', 'ServiceAccount') -contains [string]$principal.LogonType")
    expect(helper).toContain("Add-Content -LiteralPath (Join-Path $Root 'changed.log')")
    expect(helper).not.toMatch(/Unregister-ScheduledTask|Remove-Item -LiteralPath \$target|Stop-ScheduledTask/)
  })

  it('runs every pass outside a check, never stops a pass, and reports counts only', () => {
    const pass = upload.slice(upload.indexOf('  if (-not $Check) {\n'), upload.indexOf('function Publish-Music {'))
    expect(pass).toContain('try { Invoke-Windows } catch {')
    const block = upload.slice(upload.indexOf('function Get-WindowsBlock {'), upload.indexOf('function Send-LaneReport {'))
    expect([...block.matchAll(/^\s{4}([a-z]+) = /gm)].map(m => m[1])).toEqual(['launcher', 'hidden', 'wrapped', 'left'])
  })

  it('installs both loop tasks through the launcher, and falls back to a hidden PowerShell only when it cannot be built', () => {
    for (const installer of ['scripts/install-recordings-upload.ps1', 'scripts/install-library-sync.ps1']) {
      const source = read(installer)
      expect(source, installer).toContain('$action = New-WindowlessTaskAction $powershell $arguments $repoRoot')
      expect(source, installer).toContain('[System.IO.Path]::GetFullPath($expectedExecute)')
      expect(source, installer).toContain('[string]::Equals($installedActions[0].Arguments, $expectedArguments')
    }
  })

  // Real Windows, on the Windows CI machine only.
  it.runIf(process.platform === 'win32')('builds the launcher, which passes the command on exactly and opens no window', () => {
    const home = mkdtempSync(join(tmpdir(), 'rh-'))
    const argsJs = join(home, 'args.js')
    writeFileSync(argsJs, "require('fs').writeFileSync(process.argv[2], JSON.stringify(process.argv.slice(3)))")
    const out = join(home, 'args.json')
    const command = `
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$env:LOCALAPPDATA = '${home.replace(/'/g, "''")}'
. '${ps('scripts/windowless.ps1')}'
$launcher = Get-WindowlessLauncher
$code = Invoke-Windowless $launcher '${process.execPath.replace(/'/g, "''")}' '"${argsJs}" "${out}" "a b" c'
Add-Type @"
using System; using System.Collections.Generic; using System.Runtime.InteropServices; using System.Text;
public static class Probe {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  public static long[] Consoles() {
    List<long> found = new List<long>();
    EnumWindows(delegate(IntPtr h, IntPtr l) {
      if (IsWindowVisible(h)) {
        StringBuilder name = new StringBuilder(256);
        GetClassName(h, name, 256);
        string c = name.ToString();
        if (c == "ConsoleWindowClass" || c == "CASCADIA_HOSTING_WINDOW_CLASS") found.Add(h.ToInt64());
      }
      return true;
    }, IntPtr.Zero);
    return found.ToArray();
  }
}
"@
function Watch-Windows([System.Diagnostics.Process]$Process, [int]$Seconds) {
  $before = @([Probe]::Consoles())
  $seen = New-Object System.Collections.Generic.HashSet[long]
  $until = [DateTime]::UtcNow.AddSeconds($Seconds)
  while ([DateTime]::UtcNow -lt $until -and -not $Process.HasExited) {
    foreach ($w in [Probe]::Consoles()) { if ($before -notcontains $w) { [void]$seen.Add($w) } }
    Start-Sleep -Milliseconds 250
  }
  $Process.WaitForExit(20000) | Out-Null
  return $seen.Count
}
# The control: a console program started the way that opens a window. The probe has to see it.
$control = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32\\cmd.exe') -ArgumentList '/c ping -n 5 127.0.0.1 >nul' -PassThru
$controlSeen = Watch-Windows $control 8
# The real thing: PowerShell through the launcher, starting a console program of its own.
$start = New-Object System.Diagnostics.ProcessStartInfo
$start.FileName = $launcher
$start.Arguments = Format-WindowlessCommand (Join-Path $env:SystemRoot 'System32\\WindowsPowerShell\\v1.0\\powershell.exe') '-NoProfile -NonInteractive -Command "cmd.exe /c ping -n 5 127.0.0.1"'
$start.UseShellExecute = $false
$subject = [System.Diagnostics.Process]::Start($start)
$subjectSeen = Watch-Windows $subject 10
[ordered]@{ code = $code; launcher = (Split-Path -Leaf $launcher); control = $controlSeen; subject = $subjectSeen; exit = $subject.ExitCode } | ConvertTo-Json -Compress
`
    const result = powershell(home, command)
    expect(result.launcher).toMatch(/^run-hidden-[0-9a-f]{12}\.exe$/)
    expect(result.code).toBe(0)
    expect(JSON.parse(readFileSync(out, 'utf8'))).toEqual(['a b', 'c'])
    expect(result.control, 'the probe saw no window from the control, so it proves nothing').toBeGreaterThan(0)
    expect(result.subject).toBe(0)
    expect(result.exit).toBe(0)
  }, 180_000)

  it.runIf(process.platform === 'win32')('changes a real task of his to run through the launcher, once, and leaves it enabled as it was', () => {
    const home = mkdtempSync(join(tmpdir(), 'rh-'))
    const command = `
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$env:LOCALAPPDATA = '${home.replace(/'/g, "''")}'
. '${ps('scripts/windowless.ps1')}'
$path = '\\MindmakeWindowlessTest\\'
$user = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument '/c exit 0' -WorkingDirectory $env:TEMP
$gui = New-ScheduledTaskAction -Execute 'notepad.exe'
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
try {
  Register-ScheduledTask -TaskName 'console' -TaskPath $path -Action $action -Principal $principal -Force | Out-Null
  Register-ScheduledTask -TaskName 'gui' -TaskPath $path -Action $gui -Principal $principal -Force | Out-Null
  Disable-ScheduledTask -TaskName 'console' -TaskPath $path | Out-Null
  $first = Invoke-WindowKeeper -TaskPathPrefix $path
  $second = Invoke-WindowKeeper -TaskPathPrefix $path
  $task = Get-ScheduledTask -TaskName 'console' -TaskPath $path
  $a = @($task.Actions)[0]
  $g = @((Get-ScheduledTask -TaskName 'gui' -TaskPath $path).Actions)[0]
  [ordered]@{
    first = $first; second = $second; execute = (Split-Path -Leaf $a.Execute); arguments = $a.Arguments
    directory = $a.WorkingDirectory; enabled = $task.Settings.Enabled; gui = $g.Execute
    log = @(Get-Content -LiteralPath (Join-Path $env:LOCALAPPDATA 'Mindmake\\windowless\\changed.log')).Count
  } | ConvertTo-Json -Compress -Depth 4
} finally {
  Get-ScheduledTask -TaskPath $path -ErrorAction SilentlyContinue | Unregister-ScheduledTask -Confirm:$false
}
`
    const result = powershell(home, command)
    expect(result.first).toMatchObject({ launcher: 'ok', wrapped: 1, hidden: 0, left: 0 })
    expect(result.second).toMatchObject({ launcher: 'ok', wrapped: 0, hidden: 1, left: 0 })
    expect(result.execute).toMatch(/^run-hidden-[0-9a-f]{12}\.exe$/)
    expect(result.arguments).toBe('"cmd.exe" /c exit 0')
    expect(result.directory).toBeTruthy()
    expect(result.enabled).toBe(false)
    expect(result.gui).toBe('notepad.exe')
    expect(result.log).toBe(1)
  }, 180_000)
})
