import { randomUUID } from 'node:crypto'
import { AsyncLocalStorage } from 'node:async_hooks'
import { mkdir, open, readFile, stat, unlink, type FileHandle } from 'node:fs/promises'
import { dirname } from 'node:path'
import { run } from './process.js'

export interface DurableProcessInstance {
  alive: boolean
  instance_id?: string
  started_at_ms?: number
}

function processIsAlive(pid: number): boolean {
  if (!Number.isSafeInteger(pid) || pid <= 0) return false
  try { process.kill(pid, 0); return true }
  catch (error) { return (error as NodeJS.ErrnoException).code === 'EPERM' }
}

let currentProcessInstance: Promise<DurableProcessInstance> | undefined
const heldDurableLocks = new AsyncLocalStorage<Map<string, string>>()

export async function inspectDurableProcessInstance(pid: number): Promise<DurableProcessInstance> {
  if (!processIsAlive(pid)) return { alive: false }
  const inspect = async (): Promise<DurableProcessInstance> => {
    try {
      if (process.platform === 'win32') {
        const script = `$process = Get-Process -Id ${pid} -ErrorAction Stop; [Console]::Out.Write($process.StartTime.ToUniversalTime().Ticks.ToString([System.Globalization.CultureInfo]::InvariantCulture))`
        let stdout = ''
        try { stdout = (await run('pwsh.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { timeoutMs: 2_500 })).stdout.trim() }
        catch { stdout = (await run('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', script], { timeoutMs: 5_000 })).stdout.trim() }
        if (!/^\d{17,19}$/.test(stdout)) throw new Error('Windows process start identity is invalid')
        const ticks = BigInt(stdout)
        const normalizedTicks = ticks - ticks % 10n
        const startedAtMs = Number((normalizedTicks - 621_355_968_000_000_000n) / 10_000n)
        if (!Number.isFinite(startedAtMs) || startedAtMs <= 0) throw new Error('Windows process start time is invalid')
        return { alive: true, instance_id: `win32:${normalizedTicks}`, started_at_ms: startedAtMs }
      }
      if (process.platform === 'linux') {
        const [processStat, bootId] = await Promise.all([readFile(`/proc/${pid}/stat`, 'utf8'), readFile('/proc/sys/kernel/random/boot_id', 'utf8')])
        const closeParen = processStat.lastIndexOf(')')
        const startTicks = closeParen >= 0 ? processStat.slice(closeParen + 2).trim().split(/\s+/)[19] : undefined
        if (!startTicks || !/^\d+$/.test(startTicks)) throw new Error('Linux process start identity is invalid')
        return { alive: true, instance_id: `linux:${bootId.trim()}:${startTicks}` }
      }
      const stdout = (await run('ps', ['-o', 'lstart=', '-p', String(pid)], { timeoutMs: 5_000 })).stdout.trim()
      const startedAtMs = Date.parse(stdout)
      if (!Number.isFinite(startedAtMs)) throw new Error('process start identity is invalid')
      return { alive: true, instance_id: `${process.platform}:${startedAtMs}`, started_at_ms: startedAtMs }
    } catch {
      return processIsAlive(pid) ? { alive: true } : { alive: false }
    }
  }
  if (pid !== process.pid) return inspect()
  currentProcessInstance ??= inspect().then((value) => {
    if (!value.instance_id) currentProcessInstance = undefined
    return value
  })
  return currentProcessInstance
}

export async function durableLockOwnerIsActive(lock: Record<string, unknown>): Promise<boolean | 'unknown'> {
  const pid = typeof lock.pid === 'number' && Number.isSafeInteger(lock.pid) && lock.pid > 0 ? lock.pid : 0
  if (!pid) return 'unknown'
  const observed = await inspectDurableProcessInstance(pid)
  if (!observed.alive) return false
  if (typeof lock.process_instance_id === 'string' && lock.process_instance_id.length > 0) {
    if (!observed.instance_id) return 'unknown'
    return lock.process_instance_id === observed.instance_id
  }
  const acquiredAt = typeof lock.acquired_at === 'string' ? Date.parse(lock.acquired_at) : Number.NaN
  if (Number.isFinite(acquiredAt) && observed.started_at_ms !== undefined && observed.started_at_ms > acquiredAt + 1_000) return false
  return observed.instance_id ? true : 'unknown'
}

export async function withDurableFileLock<T>(
  path: string,
  callback: (token: string) => Promise<T>,
  options: {
    timeoutMs?: number
    incompleteGraceMs?: number
    persistMetadata?: (handle: FileHandle, content: string) => Promise<void>
  } = {},
): Promise<T> {
  const inherited = heldDurableLocks.getStore()
  const inheritedToken = inherited?.get(path)
  if (inheritedToken) return callback(inheritedToken)
  await mkdir(dirname(path), { recursive: true })
  const token = randomUUID()
  const owner = await inspectDurableProcessInstance(process.pid)
  if (!owner.alive || !owner.instance_id) throw new Error('durable lock could not establish a robust process identity')
  const deadline = Date.now() + (options.timeoutMs ?? 15_000)
  const incompleteGraceMs = options.incompleteGraceMs ?? 2_000
  let handle: Awaited<ReturnType<typeof open>> | undefined
  while (!handle) {
    let candidate: Awaited<ReturnType<typeof open>> | undefined
    try {
      candidate = await open(path, 'wx', 0o600)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (!['EEXIST', 'EACCES', 'EPERM'].includes(code ?? '')) throw error
      let observed = ''
      let stale = false
      try {
        observed = await readFile(path, 'utf8')
        const lock = JSON.parse(observed) as Record<string, unknown>
        const active = await durableLockOwnerIsActive(lock)
        const pid = typeof lock.pid === 'number' && Number.isSafeInteger(lock.pid) && lock.pid > 0 ? lock.pid : 0
        const acquiredAt = typeof lock.acquired_at === 'string' ? Date.parse(lock.acquired_at) : Number.NaN
        stale = active === false || active === 'unknown' && !pid && (Number.isFinite(acquiredAt)
          ? Date.now() - acquiredAt > incompleteGraceMs
          : Date.now() - (await stat(path)).mtimeMs > incompleteGraceMs)
      } catch {
        try { stale = Date.now() - (await stat(path)).mtimeMs > incompleteGraceMs }
        catch { stale = true }
      }
      if (stale) {
        try { if (await readFile(path, 'utf8') === observed) await unlink(path) }
        catch (unlinkError) { if ((unlinkError as NodeJS.ErrnoException).code !== 'ENOENT') throw unlinkError }
        continue
      }
      if (Date.now() >= deadline) throw new Error('durable lock timed out')
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 20))
      continue
    }
    const metadata = `${JSON.stringify({ schema_version: 2, pid: process.pid, token, acquired_at: new Date().toISOString(), process_instance_id: owner.instance_id })}\n`
    let candidateIdentity: { dev: number | bigint; ino: number | bigint } | undefined
    try {
      const info = await candidate.stat({ bigint: true })
      candidateIdentity = { dev: info.dev, ino: info.ino }
      if (options.persistMetadata) await options.persistMetadata(candidate, metadata)
      else {
        await candidate.writeFile(metadata, 'utf8')
        await candidate.sync()
      }
      handle = candidate
    } catch (error) {
      try { await candidate.close() } catch { /* The original persistence failure is authoritative. */ }
      try {
        const current = await stat(path, { bigint: true })
        if (candidateIdentity && current.dev === candidateIdentity.dev && current.ino === candidateIdentity.ino) await unlink(path)
      } catch (cleanupError) {
        if ((cleanupError as NodeJS.ErrnoException).code !== 'ENOENT') throw new AggregateError([error, cleanupError], 'durable lock persistence and cleanup failed')
      }
      throw error
    }
  }
  const context = new Map(inherited ?? [])
  context.set(path, token)
  try { return await heldDurableLocks.run(context, () => callback(token)) }
  finally {
    await handle.close()
    try {
      const current = JSON.parse(await readFile(path, 'utf8')) as { token?: unknown }
      if (current.token === token) await unlink(path)
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
}
