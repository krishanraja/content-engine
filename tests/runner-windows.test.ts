import { execFile, spawn } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const execFileAsync = promisify(execFile)

describe('Windows runner entry point', () => {
  it('installs a hidden current-user singleton task with bounded restart settings', async () => {
    const source = await readFile(join(ROOT, 'scripts', 'install-runner-task.ps1'), 'utf8')
    expect(source).toContain("verify-runner-source.ps1")
    expect(source).toContain('-RequirePersistentLocation')
    expect(source.indexOf('-RequirePersistentLocation')).toBeLessThan(source.indexOf('Register-ScheduledTask'))
    expect(source).toContain('$logonTrigger = New-ScheduledTaskTrigger -AtLogOn -User $userId')
    expect(source).toContain('$recoveryTrigger = New-ScheduledTaskTrigger')
    expect(source).toContain('-RepetitionInterval (New-TimeSpan -Minutes 5)')
    expect(source).toContain('-RepetitionDuration (New-TimeSpan -Days 3650)')
    expect(source).toContain('-Trigger @($logonTrigger, $recoveryTrigger)')
    expect(source).toContain('-LogonType Interactive')
    expect(source).toContain('-StartWhenAvailable')
    expect(source).toContain('-AllowStartIfOnBatteries')
    expect(source).toContain('-DontStopIfGoingOnBatteries')
    expect(source).toContain('-DontStopOnIdleEnd')
    expect(source).toContain('-RestartCount 12')
    expect(source).toContain('-RestartInterval (New-TimeSpan -Minutes 1)')
    expect(source).toContain('-MultipleInstances IgnoreNew')
    expect(source).toContain('-Hidden')
    expect(source).toContain('(Get-Command node.exe -ErrorAction Stop).Source')
    expect(source).toContain("node_modules\\tsx\\dist\\loader.mjs")
    expect(source).toContain("apps\\runner\\src\\index.ts")
    expect(source).toContain('[System.Uri]::new($tsxLoader).AbsoluteUri')
    expect(source).toContain('$arguments = "--import `"$loaderUri`" `"$runnerEntry`" daemon"')
    expect(source).toContain('$action = New-ScheduledTaskAction -Execute $node -Argument $arguments -WorkingDirectory $repoRoot')
    expect(source).not.toContain('New-ScheduledTaskAction -Execute $powerShell')
    expect(source).not.toContain('tsx\\dist\\cli.mjs')
    expect(source).toContain("$runnerStatus.active -ne $false")
    expect(source.indexOf('$runnerStatus.active -ne $false')).toBeLessThan(source.indexOf('Register-ScheduledTask'))
    expect(source).toContain('$stopPreflight.active -ne $false')
    expect(source.indexOf('$stopPreflight.active -ne $false')).toBeLessThan(source.indexOf('$statusOutput = @('))
    const inactiveChecks = [...source.matchAll(/Assert-RunnerInactive/g)].map((match) => match.index)
    expect(inactiveChecks).toHaveLength(3)
    const disableBeforeMigration = source.indexOf('Disable-ScheduledTask -TaskName $TaskName -ErrorAction Stop')
    expect(inactiveChecks[1]).toBeLessThan(disableBeforeMigration)
    expect(disableBeforeMigration).toBeLessThan(inactiveChecks[2]!)
    expect(inactiveChecks[2]).toBeLessThan(source.indexOf('$statusOutput = @('))
    expect(source).toContain("$disabledTask.State -ne 'Disabled'")
    expect(source).toContain('Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop')
    expect(source).toContain('$installedActions = @($installed.Actions)')
    expect(source).toContain("Runner task action readback does not match the direct Node daemon contract")
    expect(source).toContain("Runner task triggers do not match the logon plus five-minute recovery contract")
    expect(source).toContain('$installed.Settings.IdleSettings.StopOnIdleEnd -ne $false')
    expect(source).toContain('$installed.Settings.DisallowStartIfOnBatteries -ne $false')
    expect(source).toContain('$installed.Settings.StopIfGoingOnBatteries -ne $false')
    expect(source).toContain('$installed.Settings.AllowHardTerminate -ne $true')
    expect(source).toContain('$installed.Settings.Enabled -ne $true')
    expect(source).toContain("$installed.State -eq 'Disabled'")
    expect(source).toContain('The replacement runner task was not re-enabled after registration')
    expect(source.match(/Disable-ScheduledTask -TaskName \$TaskName/g)).toHaveLength(2)
    expect(source).not.toMatch(/-Password|-RunOnlyIfNetworkAvailable|-NetworkId/)
  })

  it.skipIf(process.platform !== 'win32')('keeps the in-process TypeScript runner in the directly owned Node process and stops cleanly', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'mindmake-runner-direct-node-'))
    const probe = join(fixtureRoot, 'probe.ts')
    const loader = pathToFileURL(join(ROOT, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href
    await writeFile(probe, "process.stdout.write(`${JSON.stringify({ pid: process.pid })}\\n`); setInterval(() => {}, 1_000)\n")
    const child = spawn(process.execPath, ['--import', loader, probe], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    })
    const childPid = child.pid
    if (!childPid) throw new Error('direct Node probe did not start')
    try {
      const firstLine = await new Promise<string>((resolveLine, rejectLine) => {
        let stdout = ''
        const timer = setTimeout(() => rejectLine(new Error('direct Node probe did not become ready')), 10_000)
        child.stdout.on('data', (chunk) => {
          stdout += chunk.toString()
          const newline = stdout.indexOf('\n')
          if (newline < 0) return
          clearTimeout(timer)
          resolveLine(stdout.slice(0, newline))
        })
        child.once('error', (error) => { clearTimeout(timer); rejectLine(error) })
        child.once('exit', (code) => { clearTimeout(timer); rejectLine(new Error(`direct Node probe exited early with ${code}`)) })
      })
      expect(JSON.parse(firstLine)).toEqual({ pid: childPid })
      const descendantScript = [
        `$all = @(Get-CimInstance Win32_Process | Select-Object ProcessId, ParentProcessId, Name)`,
        `$frontier = @(${childPid})`,
        '$descendants = @()',
        'while ($frontier.Count -gt 0) {',
        '  $next = @($all | Where-Object { $frontier -contains $_.ParentProcessId })',
        '  $descendants += $next',
        '  $frontier = @($next | ForEach-Object { $_.ProcessId })',
        '}',
        '$owned = @($descendants | Where-Object { $_.Name -match "^(?:cmd|npm|node|powershell|pwsh)\\.exe$" } | Select-Object ProcessId, ParentProcessId, Name)',
        '[Console]::Out.Write((ConvertTo-Json -Compress -InputObject $owned))',
      ].join('; ')
      const descendants = JSON.parse((await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', descendantScript])).stdout || '[]')
      expect(descendants).toEqual([])

      const exited = new Promise<void>((resolveExit) => child.once('exit', () => resolveExit()))
      expect(child.kill()).toBe(true)
      await expect(Promise.race([exited, new Promise((_, reject) => setTimeout(() => reject(new Error('direct Node probe did not stop')), 10_000))])).resolves.toBeUndefined()
      await expect(execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Get-Process -Id ${childPid} -ErrorAction Stop | Out-Null`])).rejects.toBeTruthy()
    } finally {
      if (child.exitCode === null) await execFileAsync('taskkill.exe', ['/PID', String(childPid), '/T', '/F']).catch(() => undefined)
      await rm(fixtureRoot, { recursive: true, force: true })
    }
  }, 30_000)

  it('uses the repository runner app without embedding a credential or path to media', async () => {
    const source = await readFile(join(ROOT, 'scripts', 'runner.ps1'), 'utf8')
    const app = await readFile(join(ROOT, 'apps', 'runner', 'src', 'index.ts'), 'utf8')
    expect(source).toContain('npm.cmd')
    expect(source).toContain('run --silent runner -- $Mode')
    expect(source).toContain("'stop-preflight'")
    expect(source).toContain("Documents\\MindmakeVideoStudio\\runtime")
    expect(source).toContain('MINDMAKE_RUNTIME_ROOT')
    expect(source).not.toMatch(/Bearer|signing-key|My Drive|VIDEO_STUDIO_RUNNER_SIGNING_KEY/)
    expect(app).toContain("resolve(homedir(), 'Documents', 'MindmakeVideoStudio', 'runtime')")
    expect(app).toContain('process.env.MINDMAKE_RUNTIME_ROOT = expected')
    expect(app).toContain('configured.toLocaleLowerCase')
    expect(app).toContain("command === 'stop-preflight'")
    expect(app).toContain('runnerStopPreflight()')
  })

  it('rejects virtualized sources and verifies every workspace before CLI startup', async () => {
    const source = await readFile(join(ROOT, 'scripts', 'verify-runner-source.ps1'), 'utf8')
    expect(source).toContain('LocalApplicationData')
    expect(source).toContain("Documents\\MindmakeVideoStudio\\runner-source")
    expect(source).toContain("Documents\\MindmakeVideoStudio\\runtime")
    expect(source).toContain('migrate-runner-runtime.ps1')
    expect(source).toContain('-CheckOnly')
    expect(source).toContain("status', '--porcelain=v1', '--untracked-files=all")
    expect(source).toContain('is not traversable')
    expect(source).toContain('[System.Security.Cryptography.SHA256]::Create()')
    expect(source).toContain('run --silent studio -- --version')
  })

  it('uses the same non-virtualized runtime for interactive setup and background execution', async () => {
    const bootstrap = await readFile(join(ROOT, 'scripts', 'bootstrap-python.ps1'), 'utf8')
    const studio = await readFile(join(ROOT, 'scripts', 'studio.ps1'), 'utf8')
    const paths = await readFile(join(ROOT, 'packages', 'core', 'src', 'paths.ts'), 'utf8')
    for (const source of [bootstrap, studio]) {
      expect(source).toContain("Documents\\MindmakeVideoStudio\\runtime")
      expect(source).toContain('MINDMAKE_RUNTIME_ROOT')
    }
    expect(paths).toContain("join(homedir(), 'Documents', 'MindmakeVideoStudio', 'runtime')")
    expect(paths).toContain('MINDMAKE_RUNTIME_ROOT')
  })

  it('migrates legacy durable state without deleting or overwriting either root', async () => {
    const source = await readFile(join(ROOT, 'scripts', 'migrate-runner-runtime.ps1'), 'utf8')
    expect(source).toContain("'browser', 'cache', 'python', 'runner-source', 'studio.sqlite', 'studio.sqlite-shm', 'studio.sqlite-wal'")
    expect(source).toContain('[System.IO.File]::Copy')
    expect(source).toContain('[System.IO.File]::Move')
    expect(source).toContain('[System.Security.Cryptography.SHA256]::Create()')
    expect(source).toContain('No file was overwritten')
    expect(source).not.toMatch(/Remove-Item|\bdel\b|\brm\b/)
  })

  it.skipIf(process.platform !== 'win32')('executes copy, retry, exclusion, conflict, check-only, and nested-reparse guards', async () => {
    const fixtureRoot = await mkdtemp(join(tmpdir(), 'mindmake-runtime-migration-'))
    const legacyRoot = join(fixtureRoot, 'legacy')
    const targetRoot = join(fixtureRoot, 'target')
    const reparseLegacyRoot = join(fixtureRoot, 'legacy-reparse')
    const reparseTargetRoot = join(fixtureRoot, 'target-reparse')
    const script = join(ROOT, 'scripts', 'migrate-runner-runtime.ps1')
    const run = (legacy: string, target: string, checkOnly = false) => execFileAsync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', script,
      '-FixtureLegacyRoot', legacy, '-FixtureTargetRoot', target, ...(checkOnly ? ['-CheckOnly'] : []),
    ])
    try {
      await Promise.all([
        mkdir(join(legacyRoot, 'jobs'), { recursive: true }),
        mkdir(join(legacyRoot, 'learning'), { recursive: true }),
        mkdir(join(legacyRoot, 'cache'), { recursive: true }),
      ])
      await Promise.all([
        writeFile(join(legacyRoot, 'jobs', 'job.json'), '{"job":"legacy"}\n'),
        writeFile(join(legacyRoot, 'learning', 'rules.json'), '[]\n'),
        writeFile(join(legacyRoot, 'cache', 'replaceable.bin'), 'skip me'),
      ])

      await expect(run(legacyRoot, targetRoot, true)).rejects.toMatchObject({ stderr: expect.stringContaining('Run scripts/migrate-runner-runtime.ps1') })
      const copied = JSON.parse((await run(legacyRoot, targetRoot)).stdout)
      expect(copied).toMatchObject({ ok: true, mode: 'copy', legacy_files: 2, copied_files: 2, identical_files: 0 })
      await expect(readFile(join(targetRoot, 'jobs', 'job.json'), 'utf8')).resolves.toBe('{"job":"legacy"}\n')
      await expect(readFile(join(targetRoot, 'cache', 'replaceable.bin'), 'utf8')).rejects.toMatchObject({ code: 'ENOENT' })

      const retry = JSON.parse((await run(legacyRoot, targetRoot)).stdout)
      expect(retry).toMatchObject({ copied_files: 0, identical_files: 2 })
      await expect(run(legacyRoot, targetRoot, true)).resolves.toMatchObject({ stdout: expect.stringContaining('"mode":"check"') })

      await writeFile(join(targetRoot, 'jobs', 'job.json'), '{"job":"conflict"}\n')
      await expect(run(legacyRoot, targetRoot)).rejects.toMatchObject({ stderr: expect.stringContaining('No file was overwritten') })
      await expect(readFile(join(targetRoot, 'jobs', 'job.json'), 'utf8')).resolves.toBe('{"job":"conflict"}\n')

      const external = join(fixtureRoot, 'external')
      await Promise.all([mkdir(join(reparseLegacyRoot, 'jobs'), { recursive: true }), mkdir(external, { recursive: true })])
      await writeFile(join(external, 'escaped.json'), '{}\n')
      await symlink(external, join(reparseLegacyRoot, 'jobs', 'nested'), 'junction')
      await expect(run(reparseLegacyRoot, reparseTargetRoot)).rejects.toMatchObject({ stderr: expect.stringContaining('reparse point and requires manual review') })
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true })
    }
  }, 30_000)

  it('reports on credentials without ever emitting one', async () => {
    const source = await readFile(join(ROOT, 'scripts', 'inspect-credentials.ps1'), 'utf8')

    // The script exists to be run when a credential has gone wrong, which is
    // exactly when someone is most likely to paste its output somewhere. The
    // decoded blob must reach a hash and nothing else.
    expect(source).toContain('Substring(0, 12)')
    expect(source).toMatch(/Chars\s*=\s*value\.Length/)
    expect(source).not.toMatch(/=\s*value\s*[,;}]/)
    for (const sink of ['Write-Output $value', 'Write-Host', '$entry.Value', 'Value =']) {
      expect(source).not.toContain(sink)
    }

    // Persist 3 can be overwritten from outside the machine and Comment is the
    // only marker distinguishing our writes from a foreign tool's. Both are the
    // reason the script exists, so neither may be quietly dropped.
    expect(source).toContain('Enterprise (roams)')
    expect(source).toContain('Mindmake Video Studio')
    expect(source).toContain('CredEnumerateW')
    expect(source).toContain('[switch]$EnforceActiveContract')
    expect(source).toContain('control-center-runner-token-v3')
    expect(source).toContain('control-center-runner-signing-key-v3')
    expect(source).toContain('control-center-radar-token-v3')
    expect(source).toContain('studio-mcp-token')
    expect(source).toContain("$entry.Persist -ne 'LocalMachine'")
  })

  it('writes a credential onto nothing and refuses to claim success without a readback', async () => {
    const source = await readFile(join(ROOT, 'scripts', 'set-credential.ps1'), 'utf8')

    // A roaming-persisted entry under the same name survived a write once and
    // reverted it hours later. The delete has to happen before the write, and the
    // write has to be checked, or the script reports success for a value the store
    // will not be holding by the time anything reads it.
    const removed = source.indexOf('DeleteExisting($Target)')
    const written = source.indexOf('::Write($Target, $secret,')
    const readback = source.indexOf('Readback($Target)')
    const success = source.indexOf('Stored credential:')
    expect(removed).toBeGreaterThan(-1)
    expect(removed).toBeLessThan(written)
    expect(written).toBeLessThan(readback)
    expect(readback).toBeLessThan(success)

    expect(source).toMatch(/if \(\$persist -ne \$expectedPersist\)/)
    expect(source).toMatch(/if \(\$length -ne \$secret\.Length\)/)

    // LocalMachine unless -Roaming is asked for explicitly, and an Enterprise
    // readback without it is an error rather than a shrug. Enterprise means the
    // entry can be replaced from off the machine, which is how two verified
    // writes were rolled back; it is a deliberate choice, never a default.
    expect(source).toContain('$expectedPersist = if ($Roaming) { 3 } else { 2 }')
    expect(source).toMatch(/if \(-not \$Roaming -and \$persist -eq 3\)/)
    expect(source).toContain('$quarantinedTargets')
    expect(source).toContain('$localOnlyTargets')
    expect(source).toContain('studio-mcp-token')
    expect(source).toContain('$isVersionedRuntimeTarget')
    expect(source).toMatch(/if \(\$Roaming -and \(\(\$localOnlyTargets -contains \$Target\) -or \$isVersionedRuntimeTarget\)\)/)

    // -Generate stays available to packages/core/src/credentials.ts, which runs
    // this script -NonInteractive, and -FromStdin gives a caller with no console a
    // way in that is not a -Value parameter landing in shell history.
    expect(source).toContain('[switch]$Generate')
    expect(source).toContain('[switch]$FromStdin')
    expect(source).not.toMatch(/\[string\]\$Value/)
    expect(source).toContain('[Console]::In.ReadLine()')
  })

  // Krish's Windows session, 2026-09-28: "studio.session.open is unavailable
  // because the credential stored under MindmakeVideoStudio/studio-mcp-token-v2
  // has the wrong token-family prefix." The proxy accepts only vst_mcp_ values,
  // and -Generate had written base64 with no prefix for every target.
  it('generates and accepts only vst_mcp_ family values for the Studio MCP target', async () => {
    const source = (await readFile(join(ROOT, 'scripts', 'set-credential.ps1'), 'utf8')).replace(/\r\n/g, '\n')
    const proxy = await readFile(join(ROOT, 'scripts', 'studio-mcp-credential-proxy.ps1'), 'utf8')

    expect(proxy).toContain("StartsWith('vst_mcp_', [StringComparison]::Ordinal)")
    expect(source).toContain("$mcpTokenTarget = 'MindmakeVideoStudio/studio-mcp-token-v2'")
    expect(source).toContain("$mcpTokenPattern = '^vst_mcp_[a-f0-9]{64,}\\z'")
    expect(source).toContain('$isMcpTokenTarget = $Target -eq $mcpTokenTarget')

    // -Generate: 48 bytes from the cryptographic generator, written as 96
    // lowercase hex after the prefix for the MCP target, base64 for the rest.
    expect(source).toContain('$bytes = New-Object byte[] 48')
    expect(source).toContain('[System.Security.Cryptography.RandomNumberGenerator]::Create()')
    expect(source).toContain("'vst_mcp_' + (-join ($bytes | ForEach-Object { $_.ToString('x2') }))")
    expect(source).toContain('[Convert]::ToBase64String($bytes)')
    expect(source).not.toMatch(/Get-Random|System\.Random\b/)

    // -FromStdin refuses a wrong-family value before it becomes a SecureString,
    // and every source, the interactive prompt included, is checked before the
    // existing entry is deleted or anything is written.
    const stdinCheck = source.indexOf('if ($isMcpTokenTarget -and -not ($line -cmatch $mcpTokenPattern))')
    const stdinConvert = source.indexOf('ConvertTo-SecureString -String $line -AsPlainText -Force')
    expect(stdinCheck).toBeGreaterThan(-1)
    expect(stdinCheck).toBeLessThan(stdinConvert)
    const everySourceCheck = source.indexOf('PtrToStringBSTR($pointer) -cmatch $mcpTokenPattern')
    expect(everySourceCheck).toBeGreaterThan(source.indexOf("Read-Host -Prompt \"Secret for $Target\" -AsSecureString"))
    expect(everySourceCheck).toBeLessThan(source.indexOf('DeleteExisting($Target)'))
    expect(source).toContain('ZeroFreeBSTR($pointer)')

    // The refusal names the target and the family, never the value.
    expect(source).toContain('$mcpTokenFamilyMessage = "Credential target $Target needs a value in the Studio MCP token family')
    const refusals = source.match(/throw \$mcpTokenFamilyMessage/g) ?? []
    expect(refusals).toHaveLength(2)
    expect(source).not.toMatch(/throw[^\n]*\$line\b/)
    expect(source).not.toMatch(/Write-(?:Output|Host)[^\n]*\$(?:line|generated)\b/)
  })

  it('fails the active contract when the MCP target is outside the vst_mcp_ family', async () => {
    // A Windows checkout carries CRLF line endings; compare the text itself.
    const source = (await readFile(join(ROOT, 'scripts', 'inspect-credentials.ps1'), 'utf8')).replace(/\r\n/g, '\n')

    expect(source).toContain('using System.Text.RegularExpressions;')
    expect(source).toContain('McpTokenFamily = Regex.IsMatch(value, "^vst_mcp_[a-f0-9]{64,}\\\\z", RegexOptions.CultureInvariant)')
    expect(source).toContain('public bool McpTokenFamily;')
    expect(source).toContain("$mcpTokenTarget = 'MindmakeVideoStudio/studio-mcp-token-v2'")
    expect(source).toContain("TokenFamily = if ($entry.Target -eq $mcpTokenTarget) { if ($entry.McpTokenFamily) { 'vst_mcp' } else { 'wrong family prefix' } } else { $null }")
    const enforcement = source.slice(source.indexOf('if ($EnforceActiveContract) {\n  $failures'))
    expect(enforcement).toContain(`if ($target -eq $mcpTokenTarget -and $entry.TokenFamily -ne 'vst_mcp') { $failures += "$target has the wrong family prefix" }`)
    // Only a yes or no crosses from the C# reader into PowerShell.
    expect(source).not.toMatch(/public string (?:Value|Prefix)\b/)
  })

  it.skipIf(process.platform !== 'win32')('parses the credential scripts without a PowerShell syntax error', async () => {
    for (const script of ['set-credential.ps1', 'inspect-credentials.ps1', 'standby-studio-mcp-token.ps1']) {
      const path = join(ROOT, 'scripts', script).replace(/'/g, "''")
      const command = [
        '$tokens = $null; $errors = $null',
        `[void][System.Management.Automation.Language.Parser]::ParseFile('${path}', [ref]$tokens, [ref]$errors)`,
        '[Console]::Out.Write($errors.Count)',
      ].join('; ')
      const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command])
      expect(stdout.trim(), script).toBe('0')
    }
  }, 30_000)

  it("the standby's token script never handles the value itself and never touches an enabled runner task", async () => {
    // Krish, 2026-10-02, on the work board: "can you give me the script to run
    // on this machine, fully self contained script". It wraps the checkout's own
    // writer and inspector, so the family check and the LocalMachine readback
    // stay in one place.
    const source = (await readFile(join(ROOT, 'scripts', 'standby-studio-mcp-token.ps1'), 'utf8')).replace(/\r\n/g, '\n')
    expect(source).toContain("$target = 'MindmakeVideoStudio/studio-mcp-token-v2'")
    expect(source).toContain('& powershell -NoProfile -ExecutionPolicy Bypass -File $writer -Target $target\n')
    expect(source).toContain('& powershell -NoProfile -ExecutionPolicy Bypass -File $inspector -EnforceActiveContract')
    // No value on a command line, from stdin or a variable, and nothing that
    // could enable, start or register a runner task. The header's how-to (the
    // primary's clipboard routine) is prose for Krish, not code this runs.
    const code = source.slice(source.indexOf('#>') + 2)
    expect(code).not.toMatch(/-FromStdin|-Generate\b|-Value\b|ConvertTo-SecureString|Read-Host/)
    expect(code).not.toMatch(/Enable-ScheduledTask|Start-ScheduledTask|Register-ScheduledTask|install-runner-task/)
    // A runner task that is not disabled stops the script before the writer.
    const stop = source.indexOf("[string]$task.State -ne 'Disabled'")
    expect(stop).toBeGreaterThan(-1)
    expect(stop).toBeLessThan(source.indexOf('-File $writer'))
    // It must live outside the checkout, or the runner's clean-checkout rule fails.
    expect(source).toContain('Keep this file outside the runner checkout.')
  })

  it.skipIf(process.platform !== 'win32')('matches the MCP family exactly as the writer and the inspector do', async () => {
    // The pattern the two scripts share, exercised in PowerShell itself with
    // synthetic values that are never credentials.
    const command = [
      "$pattern = '^vst_mcp_[a-f0-9]{64,}\\z'",
      "$good = 'vst_mcp_' + ('0' * 96)",
      "$results = @(($good -cmatch $pattern), (('vst_mcp_' + ('A' * 96)) -cmatch $pattern), (('0' * 104) -cmatch $pattern), (('vst_mcp_' + ('0' * 63)) -cmatch $pattern), (($good + [char]10) -cmatch $pattern))",
      '[Console]::Out.Write(($results | ForEach-Object { $_.ToString() }) -join ",")',
    ].join('; ')
    const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command])
    expect(stdout.trim()).toBe('True,False,False,False,False')
  }, 30_000)
})
