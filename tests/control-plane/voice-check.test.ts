import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'vitest'
import { askVoiceCheck } from '../../apps/control-plane/api/_controlCenter.js'

// Ruling (Krish, 2026-11-09): every word written for Krish, Jonny or the
// publication passes the one voice check. Control Center owns it; this engine
// asks it at the approve and publish gate, from its sessions through its own
// route, and reads the voice itself from Control Center's rules route.

const ROOT = join(__dirname, '..', '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'
const src = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

describe('the one voice check (Krish, 2026-11-09)', () => {
  test('the Python gate passes its tests', () => {
    const r = spawnSync(PY, ['tests/voice_gate_test.py'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
    assert.equal(r.status, 0, r.stdout + r.stderr)
  }, 120_000)

  test('asks Control Center with the access cookie and reads its verdict', async () => {
    const seen: Array<{ url: string; cookie: string; body: any }> = []
    const fetchImpl = (async (url: string, init: any) => {
      seen.push({ url, cookie: init.headers.cookie, body: JSON.parse(init.body) })
      return { status: 200, json: async () => ({ ok: true, check: { hard: [{ rule: 'words', match: 'seamless', message: 'kill list' }], distance: 0.2, source: { kill_list: 'live' } } }) }
    }) as unknown as typeof fetch
    const v = await askVoiceCheck('A seamless piece.', 'article', { env: { ACCESS_CODE: 'x', CONTROL_CENTER_URL: 'https://cc.example.org/' }, fetchImpl })
    assert.equal(v?.hard[0].rule, 'words')
    assert.equal(seen[0].url, 'https://cc.example.org/api/voice/check')
    assert.match(seen[0].cookie, /^cc_access=[0-9a-f]{64}$/)
    assert.deepEqual(seen[0].body, { text: 'A seamless piece.', channel: 'article' })
  })

  test('no access code, a failed call or a bad reply is no answer, never a pass', async () => {
    assert.equal(await askVoiceCheck('Words.', 'article', { env: {} }), null)
    const down = (async () => { throw new Error('down') }) as unknown as typeof fetch
    assert.equal(await askVoiceCheck('Words.', 'article', { env: { ACCESS_CODE: 'x' }, fetchImpl: down }), null)
    const bad = (async () => ({ status: 200, json: async () => ({ ok: false }) })) as unknown as typeof fetch
    assert.equal(await askVoiceCheck('Words.', 'article', { env: { ACCESS_CODE: 'x' }, fetchImpl: bad }), null)
  })

  test('the approve and publish gate asks it for every lane, and a hard fail blocks', () => {
    const gate = src('apps/control-plane/api/content-ideas.ts')
    assert.match(gate, /askVoiceCheck\(effective, channel\)/)
    assert.match(gate, /reason: 'voice_gate'/)
    assert.match(gate, /updates\.state === 'approved' \|\| updates\.state === 'published'\)\) \{\n\s+const effective/)
  })

  test('the writers read the voice live from Control Center before any hand-kept copy', () => {
    assert.match(src('apps/control-plane/api/_content.ts'), /loadLiveVoice\('article'\)/)
  })
})
