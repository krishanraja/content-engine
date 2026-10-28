import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { parseMakingPatch, mergeMaking } from '../../apps/control-plane/api/_making.js'
import {
  ALLOWED_TOOLS, TeleprompterRefusal, assertAllowedCall, createTeleprompterClient, durationSeconds, scriptHash, sendApprovedScripts,
  teleprompterPatch, WORDS_PER_MINUTE, type SendApprovedInput,
} from '../../apps/control-plane/api/_teleprompter.js'

// apps/control-plane/api/_teleprompter.ts: the server's own Teleprompter
// send. Krish, 2026-10-28: "Once I approve, the two scripts will go to
// teleprompter", and "Server sends directly". Every request here goes to a
// stand-in Teleprompter; nothing reaches teleprompter.com.

const ROOT = join(__dirname, '..', '..')
const PY = process.platform === 'win32' ? 'python' : 'python3'
const KEY = 'ttp_stand-in'
const ENV = { TELEPROMPTER_API_KEY: KEY }
const PIECE = 'f328382d-71b3-41a7-a221-d8615826f12e'
const FOLDER_NAME = 'Mon 2 Nov follow.the.money - Who gets paid for AI songs'
const LONG = 'Warner sued Suno.\n\nNow it takes a cut of every song.'
const SHORT = 'Who gets paid when a machine sings?'

function input(over: Partial<SendApprovedInput> = {}): SendApprovedInput {
  return {
    piece_id: PIECE, day: 'mon', folder_title: FOLDER_NAME,
    scripts: [
      { cut: 'long', title: 'Mon 2 Nov - 5-minute - Who gets paid for AI songs', text: LONG, sha256: scriptHash(LONG) },
      { cut: 'short', title: 'Mon 2 Nov - 90-second - Who gets paid for AI songs', text: SHORT, sha256: scriptHash(SHORT) },
    ],
    ...over,
  }
}

type Folder = { id: string; name: string }
type Script = { id: string; title: string; folderId: string; text: string; duration?: number }

/** A stand-in Teleprompter MCP server: JSON-RPC over one POST, as app.teleprompter.com/mcp answers. */
function standIn(opts: { folders?: Folder[]; scripts?: Script[]; stream?: boolean; store?: (text: string) => string; refuse?: string; pageSize?: number } = {}) {
  const folders = [...(opts.folders || [])]
  const scripts = [...(opts.scripts || [])]
  const calls: Array<{ tool: string; args: Record<string, unknown> }> = []
  const headers: Array<Record<string, string>> = []
  let made = 0
  const newId = () => `${String(++made).padStart(8, '0')}-ABCD-4EF0-8123-${'A'.repeat(12)}`
  const page = <T>(list: T[], args: Record<string, unknown>) => {
    const size = opts.pageSize ?? Number(args.limit ?? 50)
    const from = Number(args.cursor ?? 0)
    return { data: list.slice(from, from + size), nextCursor: from + size < list.length ? String(from + size) : null }
  }
  const fetchImpl = vi.fn(async (_url: string, init: { method: string; headers: Record<string, string>; body: string }) => {
    const msg = JSON.parse(init.body)
    headers.push(init.headers)
    const reply = (status: number, body: unknown) => ({
      status,
      headers: { get: (k: string) => ({ 'content-type': opts.stream ? 'text/event-stream' : 'application/json', 'mcp-session-id': 'session-1' } as Record<string, string>)[k.toLowerCase()] ?? null },
      text: async () => body === null ? '' : opts.stream ? `event: message\ndata: ${JSON.stringify(body)}\n\n` : JSON.stringify(body),
    })
    if (msg.method === 'initialize') return reply(200, { jsonrpc: '2.0', id: msg.id, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} } } })
    if (msg.method === 'notifications/initialized') return reply(202, null)
    const { name, arguments: a } = msg.params
    calls.push({ tool: name, args: a })
    if (name === opts.refuse) return reply(200, { jsonrpc: '2.0', id: msg.id, result: { isError: true, content: [{ type: 'text', text: `missing scope folders:write (key ${KEY})` }] } })
    let value: unknown
    if (name === 'list_folders') value = page(folders, a)
    else if (name === 'create_folder') { const f = { id: newId(), name: a.name }; folders.unshift(f); value = f }
    else if (name === 'list_scripts_in_folder') value = page(scripts.filter(s => s.folderId === a.folderId).map(({ text: _t, ...s }) => s), a)
    else if (name === 'create_script') { const s = { id: newId(), title: a.title, folderId: a.folderId, text: (opts.store ?? (x => x))(a.text), duration: a.duration }; scripts.push(s); value = s }
    else if (name === 'update_script') { const s = scripts.find(x => x.id === a.id)!; s.text = (opts.store ?? (x => x))(a.text); s.duration = a.duration; value = s }
    else if (name === 'get_script') value = scripts.find(x => x.id === a.id)
    else return reply(200, { jsonrpc: '2.0', id: msg.id, error: { code: -32602, message: `unknown tool ${name}` } })
    return reply(200, { jsonrpc: '2.0', id: msg.id, result: { content: [{ type: 'text', text: JSON.stringify(value) }] } })
  })
  return { fetchImpl, calls, headers, folders, scripts, tools: () => calls.map(c => c.tool) }
}

describe('the allowlist is code, and it holds before any request', () => {
  it('move_script, update_folder and any delete are refused, and nothing is sent, not even the handshake', async () => {
    const fake = standIn()
    const client = createTeleprompterClient({ url: 'https://teleprompter.invalid/mcp', key: KEY, fetchImpl: fake.fetchImpl })
    for (const [tool, args] of [['move_script', { id: 'X', folderId: 'Y' }], ['update_folder', { id: 'Y', name: 'Renamed' }], ['delete_script', { id: 'X' }],
      ['delete_folder', { id: 'Y' }], ['list_scripts', {}], ['constructor', {}], ['toString', {}]] as const) {
      await expect(client.call(tool, args)).rejects.toBeInstanceOf(TeleprompterRefusal)
    }
    expect(fake.fetchImpl).not.toHaveBeenCalled()
  })

  it('an update carries only its id, text and duration; a create never his font, speed or alignment', async () => {
    const fake = standIn()
    const client = createTeleprompterClient({ url: 'https://teleprompter.invalid/mcp', key: KEY, fetchImpl: fake.fetchImpl })
    for (const args of [{ id: 'X', text: 't', title: 'Renamed' }, { id: 'X', folderId: 'Y' }, { id: 'X', fontSize: 60 }, { id: 'X', speed: 1 }, { id: 'X', alignment: 'center' }, { id: 'X', timedSpeed: true }]) {
      await expect(client.call('update_script', args)).rejects.toThrow(/may carry only id, text, duration/)
    }
    await expect(client.call('create_script', { title: 't', text: 'x', folderId: 'Y', duration: 1, fontSize: 60 })).rejects.toThrow(/never fontSize/)
    expect(() => assertAllowedCall('create_folder', { name: 'n', parentId: 'p' })).toThrow(TeleprompterRefusal)
    expect(fake.fetchImpl).not.toHaveBeenCalled()
    expect(Object.keys(ALLOWED_TOOLS).sort()).toEqual(['create_folder', 'create_script', 'get_script', 'list_folders', 'list_scripts_in_folder', 'update_script'])
    expect(ALLOWED_TOOLS.update_script).toEqual(['id', 'text', 'duration'])
    expect(Object.isFrozen(ALLOWED_TOOLS) && Object.isFrozen(ALLOWED_TOOLS.update_script)).toBe(true)
  })

  it('is no wider than his config, which names the key and never holds it', () => {
    const cfg = JSON.parse(readFileSync(join(ROOT, 'config', 'teleprompter.json'), 'utf8'))
    for (const tool of Object.keys(ALLOWED_TOOLS)) expect(cfg.allowed_tools).toContain(tool)
    expect([...cfg.server.tools].sort()).toEqual(Object.keys(ALLOWED_TOOLS).sort())
    expect(cfg.server.secret).toBe('TELEPROMPTER_API_KEY')
    expect(cfg.words_per_minute).toBe(WORDS_PER_MINUTE)
    expect([...ALLOWED_TOOLS.update_script].filter(k => k !== 'id').sort()).toEqual([...cfg.update_fields].sort())
  })
})

describe('no key, no request', () => {
  it('answers no_key, says the session route is the fallback, and calls nothing', async () => {
    const fake = standIn()
    for (const env of [{}, { TELEPROMPTER_API_KEY: '' }, { TELEPROMPTER_API_KEY: '   ' }]) {
      const result = await sendApprovedScripts(input(), { env, fetchImpl: fake.fetchImpl })
      expect(result.status).toBe('no_key')
      expect(result.error).toMatch(/teleprompter_send\.py plan/)
    }
    expect(fake.fetchImpl).not.toHaveBeenCalled()
  })

  it('refuses words that are not the ones he approved, and a key that is not a Teleprompter key, before any request', async () => {
    const fake = standIn()
    const changed = input()
    changed.scripts[1] = { ...changed.scripts[1], text: `${SHORT} And one more line.` }
    expect(await sendApprovedScripts(changed, { env: ENV, fetchImpl: fake.fetchImpl })).toMatchObject({ status: 'refused', error: expect.stringMatching(/90-second cut's text is not the words Krish approved/) })
    expect(await sendApprovedScripts(input(), { env: { TELEPROMPTER_API_KEY: 'sk-not-teleprompter' }, fetchImpl: fake.fetchImpl })).toMatchObject({ status: 'refused' })
    expect(await sendApprovedScripts(input(), { env: { ...ENV, TELEPROMPTER_MCP_URL: 'http://plain.invalid/mcp' }, fetchImpl: fake.fetchImpl })).toMatchObject({ status: 'refused' })
    expect(await sendApprovedScripts(input({ day: 'tue' as any }), { env: ENV, fetchImpl: fake.fetchImpl })).toMatchObject({ status: 'refused' })
    expect(await sendApprovedScripts(input({ scripts: [input().scripts[0], input().scripts[0]] }), { env: ENV, fetchImpl: fake.fetchImpl })).toMatchObject({ status: 'refused' })
    expect(fake.fetchImpl).not.toHaveBeenCalled()
  })
})

describe('the send', () => {
  it('first time: makes the piece\'s folder and one script per cut, then reads each back', async () => {
    const fake = standIn()
    const result = await sendApprovedScripts(input(), { env: ENV, fetchImpl: fake.fetchImpl })
    expect(result.status).toBe('sent')
    expect(fake.tools()).toEqual(['list_folders', 'create_folder', 'list_scripts_in_folder', 'create_script', 'list_scripts_in_folder', 'create_script', 'get_script', 'get_script'])
    expect(result.folder_id).toBe(fake.folders[0].id)
    expect(result.scripts).toEqual([
      { cut: 'long', script_id: fake.scripts[0].id, readback_ok: true, action: 'create' },
      { cut: 'short', script_id: fake.scripts[1].id, readback_ok: true, action: 'create' },
    ])
    const create = fake.calls.find(c => c.tool === 'create_script')!.args
    expect(Object.keys(create).sort()).toEqual(['duration', 'folderId', 'text', 'title'])
    expect(create).toMatchObject({ title: 'Mon 2 Nov - 5-minute - Who gets paid for AI songs', text: LONG, folderId: result.folder_id, duration: durationSeconds(LONG) })
    expect(fake.calls.find(c => c.tool === 'create_folder')!.args).toEqual({ name: FOLDER_NAME })
    // His key travels as a bearer, and the session the server gave is carried on every later request.
    expect(fake.headers.every(h => h.authorization === `Bearer ${KEY}`)).toBe(true)
    expect(fake.headers[0]['mcp-session-id']).toBeUndefined()
    expect(fake.headers.slice(1).every(h => h['mcp-session-id'] === 'session-1')).toBe(true)
  })

  it('again: the folder and scripts already there are updated in place, text and duration only, never made twice', async () => {
    const folder = { id: '0000000F-ABCD-4EF0-8123-AAAAAAAAAAAA', name: FOLDER_NAME }
    const fake = standIn({
      folders: [{ id: '0000000E-ABCD-4EF0-8123-AAAAAAAAAAAA', name: 'Fri 30 Oct mind.the.gap - Something else' }, folder],
      scripts: [
        { id: '0000000A-ABCD-4EF0-8123-AAAAAAAAAAAA', title: input().scripts[0].title, folderId: folder.id, text: 'older words' },
        { id: '0000000B-ABCD-4EF0-8123-AAAAAAAAAAAA', title: input().scripts[1].title, folderId: folder.id, text: 'older words' },
      ],
      pageSize: 1,
    })
    const result = await sendApprovedScripts(input(), { env: ENV, fetchImpl: fake.fetchImpl })
    expect(result).toMatchObject({ status: 'sent', folder_id: folder.id })
    expect(fake.tools()).not.toContain('create_folder')
    expect(fake.tools()).not.toContain('create_script')
    expect(fake.calls.filter(c => c.tool === 'list_folders').map(c => c.args)).toEqual([{ limit: 100 }, { limit: 100, cursor: '1' }])
    const updates = fake.calls.filter(c => c.tool === 'update_script').map(c => c.args)
    expect(updates).toEqual([
      { id: '0000000A-ABCD-4EF0-8123-AAAAAAAAAAAA', text: LONG, duration: durationSeconds(LONG) },
      { id: '0000000B-ABCD-4EF0-8123-AAAAAAAAAAAA', text: SHORT, duration: durationSeconds(SHORT) },
    ])
    expect(result.scripts!.map(s => [s.action, s.readback_ok])).toEqual([['update', true], ['update', true]])
  })

  it('the folder and scripts the making record holds are used directly, with no lookup', async () => {
    const folder = '0000000F-ABCD-4EF0-8123-AAAAAAAAAAAA'
    const fake = standIn({ scripts: [{ id: '0000000A-ABCD-4EF0-8123-AAAAAAAAAAAA', title: 'kept', folderId: folder, text: 'old' }] })
    const one = input({ folder_id: folder, scripts: [{ ...input().scripts[0], script_id: '0000000A-ABCD-4EF0-8123-AAAAAAAAAAAA' }] })
    const result = await sendApprovedScripts(one, { env: ENV, fetchImpl: fake.fetchImpl, })
    expect(result).toMatchObject({ status: 'sent', folder_id: folder })
    expect(fake.tools()).toEqual(['update_script', 'get_script'])
  })

  it('a read-back of other words is an error naming the cut, never sent', async () => {
    const fake = standIn({ store: text => text.replace('a cut', 'the cut') })
    const result = await sendApprovedScripts(input(), { env: ENV, fetchImpl: fake.fetchImpl })
    expect(result.status).toBe('error')
    expect(result.error).toMatch(/the 5-minute cut read back from Teleprompter with words other than the ones Krish approved/)
    expect(result.scripts!.map(s => [s.cut, s.readback_ok])).toEqual([['long', false], ['short', true]])
    expect(teleprompterPatch(input(), result, { by: 'Engine', now: '2026-11-01T12:31:00Z' })).toBeNull()
  })

  it('reads a streamed answer, and a refusal comes back as an error without the key in it', async () => {
    expect((await sendApprovedScripts(input(), { env: ENV, fetchImpl: standIn({ stream: true }).fetchImpl })).status).toBe('sent')
    const refused = await sendApprovedScripts(input(), { env: ENV, fetchImpl: standIn({ refuse: 'create_folder' }).fetchImpl })
    expect(refused.status).toBe('error')
    expect(refused.error).toMatch(/Teleprompter refused create_folder: missing scope folders:write/)
    expect(refused.error).not.toContain(KEY)
    const locked = await sendApprovedScripts(input(), { env: ENV, fetchImpl: async () => ({ status: 401, headers: { get: () => null }, text: async () => '' }) })
    expect(locked).toMatchObject({ status: 'error', error: expect.stringMatching(/refused the key on initialize \(HTTP 401\)/) })
  })
})

describe('what the server sends is what the engine records and counts', () => {
  it('scriptHash is making.py script_hash, on every shape of words', () => {
    const samples = ['plain words', 'Line one  \r\nLine two\t\r\n\r\n\r\n', '﻿\n\nCafé au lait\n', 'Paragraph one.\n\nParagraph two.', '', '   \n\t\n']
    const out = spawnSync(PY, ['-c', `import json, sys, making\nprint(json.dumps([making.script_hash(t) for t in json.loads(sys.stdin.read())]))`],
      { input: JSON.stringify(samples), encoding: 'utf8', cwd: join(ROOT, 'scripts', 'post-pack'), env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
    expect(out.status, out.stderr).toBe(0)
    expect(samples.map(scriptHash)).toEqual(JSON.parse(out.stdout))
    expect(durationSeconds(Array(474).fill('word').join(' '))).toBe(190)
    expect(durationSeconds(Array(206).fill('word').join(' '))).toBe(82)
    expect(durationSeconds('')).toBe(0)
  })

  it('a send that read back becomes the making record\'s teleprompter field, which the engine takes and counts as in', async () => {
    const fake = standIn()
    const result = await sendApprovedScripts(input(), { env: ENV, fetchImpl: fake.fetchImpl })
    const fileHashes = { long: 'a'.repeat(64), short: 'b'.repeat(64) }
    const patch = teleprompterPatch(input(), result, { by: 'Engine', now: '2026-11-01T12:31:00Z', fileHashes })!
    const { patch: parsed, problems } = parseMakingPatch({ ...patch, by: 'Engine' }, '2026-11-01T12:31:00Z')
    expect(problems).toEqual([])
    expect(parsed.teleprompter).toEqual(patch.teleprompter)
    const record = mergeMaking(null, { script_check: { passed: true, checked_at: 'x', problems: [], hashes: fileHashes } as any, teleprompter: parsed.teleprompter }, 'Engine', '2026-11-01T12:31:00Z')
    const states = spawnSync(PY, ['-c', `import json, sys, making\nr = json.loads(sys.stdin.read())\nprint(json.dumps([making.teleprompter_state(r, c)[0] for c in making.CUTS]))`],
      { input: JSON.stringify(record), encoding: 'utf8', cwd: join(ROOT, 'scripts', 'post-pack') })
    expect(states.status, states.stderr).toBe(0)
    expect(JSON.parse(states.stdout)).toEqual(['in', 'in'])
    expect(teleprompterPatch(input(), { status: 'no_key' }, { by: 'Engine', now: 'x' })).toBeNull()
  })
})
