import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export async function run(command: string, args: string[], options: { cwd?: string; timeoutMs?: number } = {}): Promise<{ stdout: string; stderr: string }> {
  const result = await execFileAsync(command, args, {
    cwd: options.cwd,
    timeout: options.timeoutMs ?? 120_000,
    windowsHide: true,
    maxBuffer: 32 * 1024 * 1024,
    encoding: 'utf8',
  })
  return { stdout: result.stdout, stderr: result.stderr }
}

export function runBuffer(command: string, args: string[], options: { cwd?: string; timeoutMs?: number } = {}): Promise<{ stdout: Buffer; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(command, args, {
      cwd: options.cwd,
      timeout: options.timeoutMs ?? 120_000,
      windowsHide: true,
      maxBuffer: 32 * 1024 * 1024,
      encoding: 'buffer',
    }, (error, stdout, stderr) => {
      if (error) {
        Object.assign(error, { stdout, stderr })
        reject(error)
        return
      }
      resolve({ stdout: Buffer.from(stdout), stderr: Buffer.from(stderr).toString('utf8') })
    })
  })
}

export function commandVersion(command: string, args = ['--version'], timeoutMs = 15_000): Promise<string> {
  return run(command, args, { timeoutMs })
    .then(({ stdout, stderr }) => (stdout || stderr).split(/\r?\n/)[0]?.trim() || 'unknown')
    .catch(() => 'missing')
}

/** Run an executable without a shell and provide sensitive input over stdin.
 * The input is never placed in the command line, environment, or diagnostics.
 */
export function runWithInput(command: string, args: string[], input: string, options: { cwd?: string; timeoutMs?: number } = {}): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let outputBytes = 0
    const maximumOutputBytes = 32 * 1024 * 1024
    const timer = setTimeout(() => child.kill(), options.timeoutMs ?? 120_000)

    child.stdout.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length
      if (outputBytes > maximumOutputBytes) child.kill()
      else stdout.push(chunk)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      outputBytes += chunk.length
      if (outputBytes > maximumOutputBytes) child.kill()
      else stderr.push(chunk)
    })
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      const diagnostic = Buffer.concat(stderr).toString('utf8')
      if (code !== 0) {
        reject(new Error(`process exited with ${code ?? signal ?? 'unknown'}${diagnostic.trim() ? `: ${diagnostic.trim()}` : ''}`))
        return
      }
      resolve({ stdout: Buffer.concat(stdout).toString('utf8'), stderr: diagnostic })
    })
    child.stdin.end(input)
  })
}
