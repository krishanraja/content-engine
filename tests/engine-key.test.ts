import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = join(__dirname, '..')

// Krish, 2026-10-03: "I will use codex on one of the two machines set up as the
// video runner, either or. sort the engine key." and "feel free to use KeePass
// in the H drive which stores all the other creds for the video runner".
describe('the engine key script for the Windows machines', () => {
  it('stores the key in Credential Manager, LocalMachine only, under the name engine.py reads', async () => {
    const script = (await readFile(join(ROOT, 'scripts', 'engine-key.ps1'), 'utf8')).replace(/\r\n/g, '\n')
    const helper = await readFile(join(ROOT, 'scripts', 'engine.py'), 'utf8')
    expect(script).toContain("$target = 'Mindmake/engine-operator-token'")
    expect(helper).toContain("WINDOWS_TARGET = 'Mindmake/engine-operator-token'")
    expect(script).toContain('Persist = 2,')
    // Never a MindmakeVideoStudio/ name: the runner's credential contract owns those.
    expect(script).not.toMatch(/MindmakeVideoStudio\//)
  })

  it('never shows, logs or saves the value, and clears the clipboard it used', async () => {
    const script = (await readFile(join(ROOT, 'scripts', 'engine-key.ps1'), 'utf8')).replace(/\r\n/g, '\n')
    const code = script.slice(script.indexOf('#>') + 2)
    // No output of the value, no file, no command-line parameter carrying it.
    expect(code).not.toMatch(/Write-(Host|Output)[^\n]*\$(plain|value|stored|secret)\b/)
    expect(code).not.toMatch(/Out-File|Set-Content|Add-Content|\[IO\.File\]|>\s*\$/)
    expect(code).not.toMatch(/param\([\s\S]*?\$(Value|Key|Token)\b[\s\S]*?\)\n/)
    // The clipboard holds the new key only until Krish has pasted it.
    const put = code.indexOf('Set-Clipboard -Value $plain')
    const wait = code.indexOf('Read-Host -Prompt', put)
    const clear = code.indexOf("Set-Clipboard -Value ' '", wait)
    expect(put).toBeGreaterThan(-1)
    expect(wait).toBeGreaterThan(put)
    expect(clear).toBeGreaterThan(wait)
    // Pasted keys arrive at a hidden prompt.
    expect(code).toContain('-AsSecureString')
    expect(script).toContain('Keep this file outside the runner checkout.')
  })

  it('the helper prints the response, never the key', async () => {
    const helper = await readFile(join(ROOT, 'scripts', 'engine.py'), 'utf8')
    expect(helper).not.toMatch(/print\([^)]*token/)
  })
})

// Krish, 2026-10-03, relaying Codex on a home computer: "The board read is
// blocked because this machine's engine key is not currently available to the
// helper." Codex's Windows sandbox runs commands as a separate Windows user
// that cannot read his Credential Manager and has no internet. The helper has
// to say which cause it is, so the session asks Krish to approve running it
// outside the sandbox instead of working blind.
describe('the engine helper says why it has no key', () => {
  const PY = process.platform === 'win32' ? 'python' : 'python3'
  const HELPER = join(ROOT, 'scripts', 'engine.py')
  const message = (osName: string, user: string, error: number) => {
    const code = [
      'import importlib.util, sys',
      `spec = importlib.util.spec_from_file_location('engine', sys.argv[1])`,
      'm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
      'print(m.no_key_message(sys.argv[2], sys.argv[3], int(sys.argv[4])))',
    ].join('\n')
    const run = spawnSync(PY, ['-c', code, HELPER, osName, user, String(error)], { encoding: 'utf8' })
    expect(run.status, run.stderr).toBe(0)
    return run.stdout
  }

  it('inside Codex\'s sandbox: run it outside, never ask for the key', () => {
    for (const user of ['CodexSandboxOffline', 'CodexSandboxOnline']) {
      const text = message('nt', user, 1312)
      expect(text).toContain("inside Codex's sandbox")
      expect(text).toContain('escalated permissions')
      expect(text).toContain('Never ask Krish for the key itself')
    }
  })

  it('on a home computer with no key stored: run the key script, paste from KeePass', () => {
    const text = message('nt', 'krish', 1168)
    expect(text).toContain('This computer has no engine key for the Windows user krish')
    expect(text).toContain('scripts/engine-key.ps1')
    expect(text).toContain('Mindmake engine key')
  })

  it('any other Windows failure names the user and the error and points to -Check', () => {
    const text = message('nt', 'krish', 5)
    expect(text).toContain('Windows user krish, error 5')
    expect(text).toContain('engine-key.ps1 -Check')
  })

  it('runs the no-key path: exit 2, a reason, and no request sent', () => {
    const env: NodeJS.ProcessEnv = { ...process.env, ENGINE_BASE_URL: 'https://engine.invalid' }
    delete env.ENGINE_OPERATOR_TOKEN
    const code = [
      'import importlib.util, sys',
      `spec = importlib.util.spec_from_file_location('engine', sys.argv[1])`,
      'm = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)',
      "m.windows_key = lambda: ('', m.ERROR_NOT_FOUND)",
      "m.urllib.request.urlopen = lambda *args, **kwargs: (_ for _ in ()).throw(AssertionError('request sent'))",
      "sys.argv = [sys.argv[1], 'GET', '/api/workbench']",
      'raise SystemExit(m.main())',
    ].join('\n')
    const run = spawnSync(PY, ['-c', code, HELPER], { encoding: 'utf8', env })
    expect(run.status, run.stderr).toBe(2)
    if (process.platform === 'win32') {
      // The real user lookup ran without crashing while the key lookup was
      // isolated from any credential already stored on the test machine.
      expect(run.stderr).toMatch(/no engine key for the Windows user \S+|Windows user \S+, error \d+/)
    } else {
      expect(run.stderr).toContain('Set ENGINE_OPERATOR_TOKEN')
    }
    expect(run.stderr).not.toContain('Could not reach the engine')
  })
})
