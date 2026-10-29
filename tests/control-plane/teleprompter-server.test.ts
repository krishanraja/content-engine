import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { parseMakingPatch, mergeMaking } from '../../apps/control-plane/api/_making.js'
import {
  ALLOWED_TOOLS, APPROVAL_WRITER, TeleprompterRefusal, approvedHashes, assertAllowedCall, createTeleprompterClient, durationSeconds, scriptHash,
  sendApprovedScripts, spokenText, teleprompterPatch, WORDS_PER_MINUTE, type BoardApproval, type SendApprovedInput,
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

/** His Approve scripts press, as the board's approvals store returns it: a document Krish wrote naming the piece and each cut's hash. */
function approval(scripts: Record<string, string> | Array<{ cut: string; sha256: string }> = { long: scriptHash(LONG), short: scriptHash(SHORT) }, over: Partial<BoardApproval> = {}, body: Record<string, unknown> = {}): BoardApproval {
  return { id: 'mon-scripts', updated_by: 'Krish', updated_at: '2026-11-01T12:30:00Z', body: { piece_id: PIECE, scripts, approved: true, ...body }, ...over }
}

function input(over: Partial<SendApprovedInput> = {}): SendApprovedInput {
  return {
    piece_id: PIECE, day: 'mon', folder_title: FOLDER_NAME,
    scripts: [
      { cut: 'long', title: 'Mon 2 Nov - 5-minute - Who gets paid for AI songs', text: LONG, sha256: scriptHash(LONG) },
      { cut: 'short', title: 'Mon 2 Nov - 90-second - Who gets paid for AI songs', text: SHORT, sha256: scriptHash(SHORT) },
    ],
    approval: approval(),
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
    expect([cfg.approval.collection, cfg.approval.writer]).toEqual(['approvals', APPROVAL_WRITER])
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

  it('refuses words whose hash is not their own, and a key that is not a Teleprompter key, before any request', async () => {
    const fake = standIn()
    const changed = input()
    changed.scripts[1] = { ...changed.scripts[1], text: `${SHORT} And one more line.` }
    expect(await sendApprovedScripts(changed, { env: ENV, fetchImpl: fake.fetchImpl })).toMatchObject({ status: 'refused', error: expect.stringMatching(/90-second cut's sha256 is not the hash of its text/) })
    expect(await sendApprovedScripts(input(), { env: { TELEPROMPTER_API_KEY: 'sk-not-teleprompter' }, fetchImpl: fake.fetchImpl })).toMatchObject({ status: 'refused' })
    expect(await sendApprovedScripts(input(), { env: { ...ENV, TELEPROMPTER_MCP_URL: 'http://plain.invalid/mcp' }, fetchImpl: fake.fetchImpl })).toMatchObject({ status: 'refused' })
    expect(await sendApprovedScripts(input({ day: 'tue' as any }), { env: ENV, fetchImpl: fake.fetchImpl })).toMatchObject({ status: 'refused' })
    expect(await sendApprovedScripts(input({ scripts: [input().scripts[0], input().scripts[0]] }), { env: ENV, fetchImpl: fake.fetchImpl })).toMatchObject({ status: 'refused' })
    expect(fake.fetchImpl).not.toHaveBeenCalled()
  })
})

describe('his approval is checked here, not trusted to the caller', () => {
  // Krish, 2026-10-28: "Once I approve, the two scripts will go to teleprompter".
  const refusedWith = async (inp: SendApprovedInput, words: RegExp) => {
    const fake = standIn()
    const result = await sendApprovedScripts(inp, { env: ENV, fetchImpl: fake.fetchImpl })
    expect(result).toMatchObject({ status: 'refused', error: expect.stringMatching(words) })
    expect(fake.fetchImpl).not.toHaveBeenCalled()
  }

  it('words hashed by the caller, with no approval Krish wrote, are refused and nothing is requested', async () => {
    const OTHER = 'Words Krish never saw.'
    const unapproved = input({ scripts: [{ ...input().scripts[0], text: OTHER, sha256: scriptHash(OTHER) }] })
    await refusedWith({ ...unapproved, approval: undefined as any }, /there is no approval/)
    await refusedWith({ ...unapproved, approval: approval({ long: scriptHash(OTHER) }, { updated_by: 'engine_operator' }) }, /written by engine_operator, and only Krish's press counts/)
    await refusedWith(unapproved, /he approved other words for the 5-minute script/)
  })

  it('an approval of another piece, a withdrawn one, or one that leaves a cut out does not count', async () => {
    await refusedWith(input({ approval: approval(undefined, {}, { piece_id: '904658db-4df2-4537-a0ed-ebe93e081db7' }) }), /names another piece/)
    await refusedWith(input({ approval: approval(undefined, {}, { approved: false }) }), /withdrew his approval/)
    await refusedWith(input({ approval: approval({ long: scriptHash(LONG) }) }), /holds no hash for the 90-second script/)
    await refusedWith(input({ approval: approval(undefined, { id: '' }) }), /there is no approval/)
  })

  it('reads his approval as teleprompter_send.py does: {cut: sha256}, [{cut, sha256}], or hashes', async () => {
    const both = { long: scriptHash(LONG), short: scriptHash(SHORT) }
    expect(approvedHashes({ scripts: [{ cut: 'long', sha256: both.long }, { cut: 'short', sha256: both.short }, { cut: 'other', sha256: both.long }] })).toEqual(both)
    expect(approvedHashes({ hashes: { ...both, short: 'not a hash' } })).toEqual({ long: both.long })
    expect((await sendApprovedScripts(input({ approval: approval([{ cut: 'long', sha256: both.long }, { cut: 'short', sha256: both.short }]) }), { env: ENV, fetchImpl: standIn().fetchImpl })).status).toBe('sent')
  })

  it('an approval of the script file binds its spoken words, when the file is given; never without it', async () => {
    const FILE = '# Hook\n\nWarner **sued** Suno.\nNow it takes [a cut](https://example.org) of every song.\n'
    const words = spokenText(FILE)
    expect(words).toBe('Hook\n\nWarner sued Suno. Now it takes a cut of every song.')
    const long = { cut: 'long' as const, title: input().scripts[0].title, text: words, sha256: scriptHash(words) }
    const byFile = approval({ long: scriptHash(FILE), short: scriptHash(SHORT) })
    expect((await sendApprovedScripts(input({ scripts: [{ ...long, source: FILE }, input().scripts[1]], approval: byFile }), { env: ENV, fetchImpl: standIn().fetchImpl })).status).toBe('sent')
    await refusedWith(input({ scripts: [long, input().scripts[1]], approval: byFile }), /he approved other words for the 5-minute script/)
    await refusedWith(input({ scripts: [{ ...long, source: `${FILE}\nOne more line.\n` }, input().scripts[1]], approval: byFile }), /text is not the spoken words of its script file/)
  })

  it('the 15-minute feature goes only for a piece Krish called one for, and only on his approval of its words', async () => {
    const FEATURE = 'The fifteen minute feature.'
    const feature = { cut: 'feature' as const, title: 'Mon 2 Nov - 15-minute feature - Who gets paid for AI songs', text: FEATURE, sha256: scriptHash(FEATURE) }
    const three = input({ scripts: [...input().scripts, feature], approval: approval({ long: scriptHash(LONG), short: scriptHash(SHORT), feature: scriptHash(FEATURE) }) })
    await refusedWith(three, /only for a piece Krish called one for/)
    const features = { [PIECE]: { said: 'Krish, 2026-10-21: a feature for this one' } }
    const fake = standIn()
    const result = await sendApprovedScripts(three, { env: ENV, fetchImpl: fake.fetchImpl, features })
    expect(result.status).toBe('sent')
    expect(result.scripts!.map(s => s.cut)).toEqual(['long', 'short', 'feature'])
    const noFeatureYes = { ...three, approval: approval() }
    expect(await sendApprovedScripts(noFeatureYes, { env: ENV, fetchImpl: standIn().fetchImpl, features })).toMatchObject({ status: 'refused', error: expect.stringMatching(/no hash for the 15-minute feature script/) })
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
  it('scriptHash is making.py script_hash, and spokenText is teleprompter_send.py spoken_text, on every shape of words', () => {
    const samples = ['plain words', 'Line one  \r\nLine two\t\r\n\r\n\r\n', '\ufeff\n\nCafé au lait\n', 'Paragraph one.\n\nParagraph two.', '', '   \n\t\n',
      '# Heading\n\n> A quote\n- a list item\n* another\n1. first\n12) twelfth\n\n---\n\nWords **bold** and __bold__ and *it* and _it_ and `code`.',
      'snake_case_word and 2*3*4 and a_b_c stay, [a link](https://x.invalid) goes to its words', 'Über *naïve* _café_ ２ items\u00a0here\u2003and\u3000there',
      '   ### Three spaces in\n    #### Four is not a heading', '***\n___\n\nAfter rules', 'Odd\x1cspaces\x85between\ufeffwords']
    const out = spawnSync(PY, ['-c', `import json, sys, making, teleprompter_send as t\nsamples = json.loads(sys.stdin.read())\nprint(json.dumps([[making.script_hash(x), t.spoken_text(x)] for x in samples]))`],
      { input: JSON.stringify(samples), encoding: 'utf8', cwd: join(ROOT, 'scripts', 'post-pack'), env: { ...process.env, PYTHONIOENCODING: 'utf-8' } })
    expect(out.status, out.stderr).toBe(0)
    expect(samples.map(x => [scriptHash(x), spokenText(x)])).toEqual(JSON.parse(out.stdout))
    expect(durationSeconds(Array(474).fill('word').join(' '))).toBe(190)
    expect(durationSeconds(Array(206).fill('word').join(' '))).toBe(82)
    expect(durationSeconds('')).toBe(0)
  })

  it('a send that read back becomes the making record\'s teleprompter field, which the engine takes and counts as in', async () => {
    const fake = standIn()
    const result = await sendApprovedScripts(input(), { env: ENV, fetchImpl: fake.fetchImpl })
    const fileHashes = { long: scriptHash(LONG), short: scriptHash(SHORT) }
    const patch = teleprompterPatch(input(), result, { by: 'Engine', now: '2026-11-01T12:31:00Z', fileHashes })!
    const { patch: parsed, problems } = parseMakingPatch({ ...patch, by: 'Engine' }, '2026-11-01T12:31:00Z')
    expect(problems).toEqual([])
    expect(parsed.teleprompter).toEqual(patch.teleprompter)
    const record = mergeMaking(null, { script_check: { passed: true, checked_at: 'x', problems: [], hashes: fileHashes } as any, teleprompter: parsed.teleprompter }, 'Engine', '2026-11-01T12:31:00Z')
    const states = spawnSync(PY, ['-c', `import json, sys, making\nr = json.loads(sys.stdin.read())\nprint(json.dumps([making.teleprompter_state(r, c)[0] for c in making.CUTS]))`],
      { input: JSON.stringify(record), encoding: 'utf8', cwd: join(ROOT, 'scripts', 'post-pack') })
    expect(states.status, states.stderr).toBe(0)
    expect(JSON.parse(states.stdout)).toEqual(['in', 'in'])
    expect(teleprompterPatch(input(), { status: 'no_key' }, { by: 'Engine', now: 'x', fileHashes })).toBeNull()
  })

  it('records a cut only when the record\'s scripts are the words sent: never after they changed, never without the record\'s hashes', async () => {
    const result = await sendApprovedScripts(input(), { env: ENV, fetchImpl: standIn().fetchImpl })
    expect(result.status).toBe('sent')
    const opts = { by: 'Engine', now: '2026-11-01T12:31:00Z' }
    // The script file changed after he approved: Teleprompter holds the approved words, so the new ones are not "in".
    expect(teleprompterPatch(input(), result, { ...opts, fileHashes: { long: scriptHash(`${LONG}\nA new line.`), short: scriptHash(SHORT) } })).toBeNull()
    expect(teleprompterPatch(input(), result, { ...opts, fileHashes: { long: scriptHash(LONG) } })).toBeNull()
    expect(teleprompterPatch(input(), result, { ...opts } as any)).toBeNull()
    // An input his approval does not bind is never recorded, whatever the send said.
    expect(teleprompterPatch({ ...input(), approval: approval(undefined, { updated_by: 'engine_operator' }) }, result, { ...opts, fileHashes: { long: scriptHash(LONG), short: scriptHash(SHORT) } })).toBeNull()
    // A script file with markdown: the file's own hash is recorded, proved against the words sent.
    const FILE = 'Warner **sued** Suno.\nNow it takes a cut of every song.\n'
    const words = spokenText(FILE)
    const md = input({ scripts: [{ ...input().scripts[0], text: words, sha256: scriptHash(words), source: FILE }, input().scripts[1]], approval: approval({ long: scriptHash(FILE), short: scriptHash(SHORT) }) })
    const sent = await sendApprovedScripts(md, { env: ENV, fetchImpl: standIn().fetchImpl })
    expect(sent.status).toBe('sent')
    expect(teleprompterPatch(md, sent, { ...opts, fileHashes: { long: scriptHash(FILE), short: scriptHash(SHORT) } })!.teleprompter!.cuts.long!.script_sha256).toBe(scriptHash(FILE))
  })
})
