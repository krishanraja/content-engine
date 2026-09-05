#!/usr/bin/env node
import { dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'
import { runRunnerDaemon, runRunnerOnce, runnerStatus, runnerStopPreflight } from '@mindmake/core'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function pinWindowsRuntimeRoot(): void {
  if (process.platform !== 'win32') return
  const expected = resolve(homedir(), 'Documents', 'MindmakeVideoStudio', 'runtime')
  const configured = resolve(process.env.MINDMAKE_RUNTIME_ROOT || expected)
  if (configured.toLocaleLowerCase('en-US') !== expected.toLocaleLowerCase('en-US')) {
    throw new Error(`The Windows runner runtime must remain at ${expected}.`)
  }
  process.env.MINDMAKE_RUNTIME_ROOT = expected
}

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

async function main(): Promise<void> {
  pinWindowsRuntimeRoot()
  const command = process.argv[2] ?? 'daemon'
  if (command === 'stop-preflight') {
    output(await runnerStopPreflight())
    return
  }
  if (command === 'once') {
    output(await runRunnerOnce(repoRoot))
    return
  }
  if (command === 'status') {
    output(await runnerStatus())
    return
  }
  if (command !== 'daemon') throw new Error('runner command must be daemon, once, status, or stop-preflight')
  const controller = new AbortController()
  const stop = () => controller.abort()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
  try { await runRunnerDaemon({ repoRoot, signal: controller.signal, onStatus: output }) }
  finally {
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
  }
}

main().catch(() => {
  process.stderr.write(`${JSON.stringify({ ok: false, safe_code: 'runner_start_failed' })}\n`)
  process.exitCode = 1
})
