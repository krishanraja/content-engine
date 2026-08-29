import { execFile } from 'node:child_process'
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
