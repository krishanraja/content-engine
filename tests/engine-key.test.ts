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
