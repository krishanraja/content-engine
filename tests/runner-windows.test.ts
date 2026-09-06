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
})
