#!/usr/bin/env node
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runRunnerDaemon, runRunnerOnce, runnerStatus } from '@mindmake/core'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

function output(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value)}\n`)
}

async function main(): Promise<void> {
  const command = process.argv[2] ?? 'daemon'
  if (command === 'once') {
    output(await runRunnerOnce(repoRoot))
    return
  }
  if (command === 'status') {
    output(await runnerStatus())
    return
  }
  if (command !== 'daemon') throw new Error('runner command must be once, daemon, or status')
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
