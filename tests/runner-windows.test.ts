import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

describe('Windows runner entry point', () => {
  it('installs a hidden current-user singleton task with bounded restart settings', async () => {
    const source = await readFile(join(ROOT, 'scripts', 'install-runner-task.ps1'), 'utf8')
    expect(source).toContain('New-ScheduledTaskTrigger -AtLogOn -User $userId')
    expect(source).toContain('-LogonType Interactive')
    expect(source).toContain('-StartWhenAvailable')
    expect(source).toContain('-AllowStartIfOnBatteries')
    expect(source).toContain('-DontStopIfGoingOnBatteries')
    expect(source).toContain('-RestartCount 12')
    expect(source).toContain('-RestartInterval (New-TimeSpan -Minutes 1)')
    expect(source).toContain('-MultipleInstances IgnoreNew')
    expect(source).toContain('-Hidden')
    expect(source).toContain('-NonInteractive -WindowStyle Hidden')
    expect(source).toContain('Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop')
    expect(source).toContain('$installed.Settings.DisallowStartIfOnBatteries -ne $false')
    expect(source).toContain('$installed.Settings.StopIfGoingOnBatteries -ne $false')
    expect(source).not.toMatch(/-Password|-RunOnlyIfNetworkAvailable|-NetworkId/)
  })

  it('uses the repository runner app without embedding a credential or path to media', async () => {
    const source = await readFile(join(ROOT, 'scripts', 'runner.ps1'), 'utf8')
    expect(source).toContain('npm.cmd')
    expect(source).toContain('run --silent runner -- $Mode')
    expect(source).not.toMatch(/Bearer|signing-key|My Drive|VIDEO_STUDIO_RUNNER_SIGNING_KEY/)
  })
})
