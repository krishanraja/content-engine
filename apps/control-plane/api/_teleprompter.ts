import { createHash } from 'node:crypto'
import { TELEPROMPTER_ID, type MakingPatch } from './_making.js'

// The server's own Teleprompter send: the scripts Krish approved go into his
// teleprompter.com account, one folder per piece and one script per cut, and
// each one is read back to prove it holds the words he approved.
//
// Krish, 2026-10-28: "Once I approve, the two scripts will go to
// teleprompter", and, asked how, "Server sends directly". That replaced his
// standing yes of 2026-10-12. His terms of that day still hold: "One script
// per cut, in a folder per piece (e.g. "Mon 12 Oct follow.the.money"). When
// the words change, the same script is updated in place. Nothing is ever
// deleted." All of it is in config/teleprompter.json.
//
// Teleprompter is an MCP server. A direct client sends Krish's personal API
// key as "Authorization: Bearer ttp_...". He makes that key and stores it as
// the Vercel secret TELEPROMPTER_API_KEY himself; it never passes through a
// chat or a file. With no key this file makes no request at all and answers
// no_key, and a Claude Code session sends through its Teleprompter connector
// instead (scripts/post-pack/teleprompter_send.py plan, which refuses until
// the board holds his approval of those exact words).
//
// What may be called is fixed here in code, not trusted to a caller:
// ALLOWED_TOOLS names every tool and every argument each may carry.
// move_script, update_folder, any delete, and his font size, speed,
// alignment or timed speed are refused before a request is made. An update
// sends only the script's text and duration.
//
// The caller is the board's Approve scripts press, so the input is his
// approval: each script's sha256 is scriptHash of the exact text he approved,
// and a text whose hash differs is refused. Readback compares scriptHash of
// the stored text with that sha256. teleprompterPatch turns a send that read
// back into the making record's teleprompter field.

/** Teleprompter's MCP address (teleprompter.com/mcp); TELEPROMPTER_MCP_URL overrides it. */
export const DEFAULT_TELEPROMPTER_MCP_URL = 'https://app.teleprompter.com/mcp'
/** The pace a script's duration is timed at (config/teleprompter.json words_per_minute). */
export const WORDS_PER_MINUTE = 150
const PROTOCOL_VERSION = '2025-06-18'
const MAX_NAME = 200 // Teleprompter's limit on a folder name and a script title
const MAX_TEXT = 1_000_000 // and on a script's text
const PAGE = 100 // the most items Teleprompter lists at once
const MAX_PAGES = 50 // past 5,000 a folder or script cannot be proved absent, so none is made
const TIMEOUT_MS = 20_000
const CUT_NAME = { long: '5-minute', short: '90-second' } as const

/** Every tool this sender may call, and every argument each may carry. Nothing else is ever sent. */
export const ALLOWED_TOOLS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  list_folders: Object.freeze(['limit', 'cursor']),
  list_scripts_in_folder: Object.freeze(['folderId', 'limit', 'cursor']),
  get_script: Object.freeze(['id']),
  create_folder: Object.freeze(['name']),
  create_script: Object.freeze(['title', 'text', 'folderId', 'duration']),
  update_script: Object.freeze(['id', 'text', 'duration']),
})

/** A call this sender will not make, or an input it will not send. */
export class TeleprompterRefusal extends Error {}
/** Teleprompter, or the way to it, did not do what was asked. */
export class TeleprompterError extends Error {}

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v)

/** Throws, before any request, unless the tool and every argument are allowed. */
export function assertAllowedCall(tool: string, args: unknown): void {
  if (typeof tool !== 'string' || !Object.hasOwn(ALLOWED_TOOLS, tool)) {
    throw new TeleprompterRefusal(`${String(tool)} is not a Teleprompter tool this sender may call: only ${Object.keys(ALLOWED_TOOLS).join(', ')}. Nothing is ever deleted, moved or renamed`)
  }
  if (!isObj(args)) throw new TeleprompterRefusal(`${tool} takes an object of arguments`)
  const allowed = ALLOWED_TOOLS[tool]
  const extra = Object.keys(args).filter(k => !allowed.includes(k))
  if (extra.length) throw new TeleprompterRefusal(`${tool} may carry only ${allowed.join(', ')}, never ${extra.join(', ')}: Krish's settings are his to set`)
}

/** A script's words as they are hashed, the same as making.py script_hash:
 *  NFC, LF line endings, trailing spaces stripped from every line, blank
 *  lines trimmed at both ends, one final line ending. */
export function normalScript(text: string): string {
  const lines = String(text ?? '').normalize('NFC').replace(/^﻿+/, '').replace(/\r\n?/g, '\n').split('\n').map(line => line.replace(/\s+$/, ''))
  while (lines.length && !lines[0]) lines.shift()
  while (lines.length && !lines[lines.length - 1]) lines.pop()
  return lines.length ? `${lines.join('\n')}\n` : ''
}

/** The sha256 of a script's words (normalScript), as making.py script_hash gives it. */
export function scriptHash(text: string): string {
  return createHash('sha256').update(normalScript(text), 'utf8').digest('hex')
}

/** Its words at 150 a minute, in whole seconds (teleprompter_send.py duration_seconds). */
export function durationSeconds(text: string): number {
  const words = String(text ?? '').split(/\s+/).filter(Boolean).length
  return words ? Math.max(1, Math.round(words * 60 / WORDS_PER_MINUTE)) : 0
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) =>
  Promise<{ status: number; headers?: { get(name: string): string | null }; text(): Promise<string> }>

export interface TeleprompterClient { call(tool: string, args: Record<string, unknown>): Promise<unknown> }

/** The JSON-RPC messages in a text/event-stream answer. */
function streamMessages(body: string): unknown[] {
  const out: unknown[] = []
  for (const event of body.split(/\r?\n\r?\n/)) {
    const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n')
    if (!data.trim()) continue
    try { out.push(JSON.parse(data)) } catch { /* not a message */ }
  }
  return out
}

/** The value a tool answered with: its structured content, else its text read as JSON, else the text. */
function toolValue(result: unknown): unknown {
  if (!isObj(result)) return result
  if (isObj(result.structuredContent)) return result.structuredContent
  const text = Array.isArray(result.content) ? result.content.find(c => isObj(c) && c.type === 'text' && typeof c.text === 'string') as { text: string } | undefined : undefined
  if (!text) return result
  try { return JSON.parse(text.text) } catch { return { text: text.text } }
}

function toolText(result: Record<string, unknown>): string {
  const parts = Array.isArray(result.content) ? result.content.filter(c => isObj(c) && typeof c.text === 'string').map(c => String((c as { text: string }).text)) : []
  return parts.join(' ').trim() || 'no reason given'
}

/** A minimal MCP client over HTTP: initialize once, then tools/call, each call
 *  checked against ALLOWED_TOOLS before anything is sent, the handshake included. */
export function createTeleprompterClient(opts: { url: string; key: string; fetchImpl?: FetchLike; timeoutMs?: number }): TeleprompterClient {
  const fetchImpl = opts.fetchImpl ?? (fetch as unknown as FetchLike)
  let session: string | null = null
  let protocol: string | null = null
  let ready: Promise<void> | null = null
  let next = 0

  async function post(message: { id?: number; method: string; params?: unknown }, label: string): Promise<unknown> {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${opts.key}`,
    }
    if (session) headers['mcp-session-id'] = session
    if (protocol) headers['mcp-protocol-version'] = protocol
    const r = await fetchImpl(opts.url, { method: 'POST', headers, body: JSON.stringify({ jsonrpc: '2.0', ...message }), signal: AbortSignal.timeout(opts.timeoutMs ?? TIMEOUT_MS) })
    const sid = r.headers?.get('mcp-session-id')
    if (sid) session = sid
    if (r.status === 401 || r.status === 403) throw new TeleprompterError(`Teleprompter refused the key on ${label} (HTTP ${r.status}): it needs scripts:read, scripts:write, folders:read and folders:write`)
    if (r.status < 200 || r.status >= 300) throw new TeleprompterError(`Teleprompter answered HTTP ${r.status} to ${label}`)
    if (message.id === undefined) return null
    const body = await r.text()
    let messages: unknown[]
    if ((r.headers?.get('content-type') || '').includes('text/event-stream')) messages = streamMessages(body)
    else {
      try { const parsed = JSON.parse(body); messages = Array.isArray(parsed) ? parsed : [parsed] } catch { throw new TeleprompterError(`Teleprompter answered ${label} with something that is not JSON`) }
    }
    const reply = messages.find(m => isObj(m) && m.id === message.id) as Record<string, unknown> | undefined
    if (!reply) throw new TeleprompterError(`Teleprompter gave no answer to ${label}`)
    if (isObj(reply.error)) throw new TeleprompterError(`Teleprompter answered ${label} with error ${String(reply.error.code ?? '')}: ${String(reply.error.message ?? '').slice(0, 200)}`)
    return reply.result
  }

  async function start() {
    const result = await post({ id: ++next, method: 'initialize', params: { protocolVersion: PROTOCOL_VERSION, capabilities: {}, clientInfo: { name: 'content-engine', version: '1' } } }, 'initialize')
    protocol = isObj(result) && typeof result.protocolVersion === 'string' ? result.protocolVersion : PROTOCOL_VERSION
    await post({ method: 'notifications/initialized' }, 'notifications/initialized')
  }

  return {
    async call(tool, args) {
      assertAllowedCall(tool, args)
      ready ??= start()
      await ready
      const result = await post({ id: ++next, method: 'tools/call', params: { name: tool, arguments: args } }, tool)
      if (isObj(result) && result.isError) throw new TeleprompterError(`Teleprompter refused ${tool}: ${toolText(result).slice(0, 200)}`)
      return toolValue(result)
    },
  }
}

// What Teleprompter answers is read loosely: a field may sit on the item or one level in.
function field(v: unknown, key: string): unknown {
  if (!isObj(v)) return undefined
  if (key in v) return v[key]
  for (const wrap of ['data', 'script', 'folder', 'result']) if (isObj(v[wrap]) && key in (v[wrap] as Record<string, unknown>)) return (v[wrap] as Record<string, unknown>)[key]
  return undefined
}
function items(v: unknown): unknown[] {
  if (Array.isArray(v)) return v
  for (const key of ['data', 'items', 'folders', 'scripts']) if (isObj(v) && Array.isArray(v[key])) return v[key] as unknown[]
  return []
}
function idOf(v: unknown, what: string): string {
  const id = String(field(v, 'id') ?? '').trim().toUpperCase()
  if (!TELEPROMPTER_ID.test(id)) throw new TeleprompterError(`${what} has no id Teleprompter gave as a UUID`)
  return id
}

/** The id of the first listed item whose name is exactly `name`, or null once every page is read. */
async function findListed(client: TeleprompterClient, tool: 'list_folders' | 'list_scripts_in_folder', base: Record<string, unknown>, nameKeys: string[], name: string): Promise<string | null> {
  let cursor: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    const answer = await client.call(tool, { ...base, limit: PAGE, ...(cursor ? { cursor } : {}) })
    const hit = items(answer).find(item => nameKeys.some(k => field(item, k) === name))
    if (hit) return idOf(hit, `the listed "${name}"`)
    const more = field(answer, 'nextCursor')
    if (typeof more !== 'string' || !more || more === cursor) return null
    cursor = more
  }
  throw new TeleprompterError(`${tool} ran past ${MAX_PAGES * PAGE} items, so "${name}" cannot be proved absent and nothing new is made`)
}

export type ApprovedCut = 'long' | 'short'
export interface ApprovedScript {
  cut: ApprovedCut
  title: string
  /** The exact words Krish approved, as Teleprompter will show them. */
  text: string
  /** scriptHash(text): the hash his approval holds. */
  sha256: string
  /** The cut's script already in Teleprompter, from the making record: updated in place. */
  script_id?: string
  /** Seconds; by default the words at 150 a minute. */
  duration?: number
}
export interface SendApprovedInput {
  piece_id: string
  day: 'mon' | 'wed' | 'fri'
  folder_title: string
  /** The piece's folder from the making record, when it has one: never a second folder. */
  folder_id?: string
  scripts: ApprovedScript[]
}
export interface SentScript { cut: string; script_id?: string; readback_ok: boolean; action?: 'create' | 'update' }
export interface SendResult { status: 'sent' | 'no_key' | 'refused' | 'error'; folder_id?: string; scripts?: SentScript[]; error?: string }
export interface SendDeps { env?: Record<string, string | undefined>; fetchImpl?: FetchLike; timeoutMs?: number }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const oneLine = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && v.length <= MAX_NAME && !/[\x00-\x1f\x7f]/.test(v)

/** Why this input is not sent, or null. */
function inputProblem(input: SendApprovedInput): string | null {
  if (!isObj(input)) return 'the input is an object'
  if (typeof input.piece_id !== 'string' || !UUID.test(input.piece_id)) return 'piece_id is the content_ideas uuid'
  if (!['mon', 'wed', 'fri'].includes(String(input.day))) return 'day is mon, wed or fri'
  if (!oneLine(input.folder_title)) return `folder_title is one line of 1 to ${MAX_NAME} characters`
  if (input.folder_id !== undefined && !(typeof input.folder_id === 'string' && TELEPROMPTER_ID.test(input.folder_id))) return 'folder_id is the folder\'s id, an uppercase UUID'
  if (!Array.isArray(input.scripts) || !input.scripts.length || input.scripts.length > 2) return 'scripts holds the long cut, the short cut, or both'
  const seen = new Set<string>()
  for (const s of input.scripts) {
    if (!isObj(s) || !(s.cut === 'long' || s.cut === 'short') || seen.has(s.cut)) return 'each script is the long or the short cut, once'
    seen.add(s.cut)
    const cut = `the ${CUT_NAME[s.cut]} cut`
    if (!oneLine(s.title)) return `${cut}'s title is one line of 1 to ${MAX_NAME} characters`
    if (typeof s.text !== 'string' || !s.text.trim() || s.text.length > MAX_TEXT) return `${cut}'s text is its words, 1 to ${MAX_TEXT} characters`
    if (typeof s.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(s.sha256)) return `${cut}'s sha256 is the approved hash, 64 lowercase hex characters`
    if (scriptHash(s.text) !== s.sha256) return `${cut}'s text is not the words Krish approved (its hash ${scriptHash(s.text).slice(0, 12)}, his approval ${s.sha256.slice(0, 12)}), so nothing is sent`
    if (s.script_id !== undefined && !(typeof s.script_id === 'string' && TELEPROMPTER_ID.test(s.script_id))) return `${cut}'s script_id is an uppercase UUID`
    if (s.duration !== undefined && !(typeof s.duration === 'number' && Number.isFinite(s.duration) && s.duration >= 0 && s.duration <= 86_400)) return `${cut}'s duration is seconds, 0 to 86400`
  }
  return null
}

function clean(error: unknown, key: string): string {
  const text = String((error as Error)?.message || error || 'unknown error')
  return text.split(key).join('[TELEPROMPTER_API_KEY]').replace(/\s+/g, ' ').trim().slice(0, 300)
}

/** Sends the scripts Krish approved: finds or makes the piece's folder,
 *  creates or updates one script per cut in place, then reads each back and
 *  compares the hash of the stored text with the approved hash. No key: no
 *  request at all, status no_key. Never throws. */
export async function sendApprovedScripts(input: SendApprovedInput, deps: SendDeps = {}): Promise<SendResult> {
  const env = deps.env ?? { TELEPROMPTER_API_KEY: process.env.TELEPROMPTER_API_KEY, TELEPROMPTER_MCP_URL: process.env.TELEPROMPTER_MCP_URL }
  const problem = inputProblem(input)
  if (problem) return { status: 'refused', error: problem }
  const key = String(env.TELEPROMPTER_API_KEY ?? '').trim()
  if (!key) return { status: 'no_key', error: 'TELEPROMPTER_API_KEY is not set, so nothing was sent: a Claude Code session sends these scripts through its Teleprompter connector (teleprompter_send.py plan)' }
  if (!/^ttp_\S+$/.test(key)) return { status: 'refused', error: 'TELEPROMPTER_API_KEY is not a Teleprompter personal key (ttp_...), so it is sent nowhere' }
  const url = String(env.TELEPROMPTER_MCP_URL || DEFAULT_TELEPROMPTER_MCP_URL).trim()
  if (!/^https:\/\/[^\s/]+(\/\S*)?$/.test(url)) return { status: 'refused', error: 'TELEPROMPTER_MCP_URL is an https address' }

  const client = createTeleprompterClient({ url, key, fetchImpl: deps.fetchImpl, timeoutMs: deps.timeoutMs })
  const done: SentScript[] = []
  let folderId: string | undefined = input.folder_id
  try {
    folderId ??= (await findListed(client, 'list_folders', {}, ['name', 'title'], input.folder_title))
      ?? idOf(await client.call('create_folder', { name: input.folder_title }), 'the folder create_folder made')
    for (const s of input.scripts) {
      const duration = s.duration ?? durationSeconds(s.text)
      const existing = s.script_id ?? await findListed(client, 'list_scripts_in_folder', { folderId }, ['title', 'name'], s.title)
      if (existing) {
        await client.call('update_script', { id: existing, text: s.text, duration })
        done.push({ cut: s.cut, script_id: existing, readback_ok: false, action: 'update' })
      } else {
        const id = idOf(await client.call('create_script', { title: s.title, text: s.text, folderId, duration }), `the ${CUT_NAME[s.cut]} script create_script made`)
        done.push({ cut: s.cut, script_id: id, readback_ok: false, action: 'create' })
      }
    }
    const wrong: string[] = []
    for (const [i, s] of input.scripts.entries()) {
      const stored = field(await client.call('get_script', { id: done[i].script_id }), 'text')
      done[i].readback_ok = typeof stored === 'string' && scriptHash(stored) === s.sha256
      if (!done[i].readback_ok) wrong.push(`the ${CUT_NAME[s.cut]} cut`)
    }
    if (wrong.length) return { status: 'error', folder_id: folderId, scripts: done, error: `${wrong.join(' and ')} read back from Teleprompter with words other than the ones Krish approved` }
    return { status: 'sent', folder_id: folderId, scripts: done }
  } catch (error) {
    return { status: error instanceof TeleprompterRefusal ? 'refused' : 'error', folder_id: folderId, scripts: done, error: clean(error, key) }
  }
}

/** The making record's teleprompter field for a send that read back, or
 *  null. fileHashes are the making record's script hashes (script_check.hashes,
 *  the script files), so making.py teleprompter_state says "in"; without them
 *  the approved hash is recorded. */
export function teleprompterPatch(input: SendApprovedInput, result: SendResult, opts: { by: string; now: string; fileHashes?: Partial<Record<ApprovedCut, string>> }): MakingPatch | null {
  if (result.status !== 'sent' || !result.folder_id) return null
  const cuts: NonNullable<MakingPatch['teleprompter']>['cuts'] = {}
  for (const s of input.scripts) {
    const sent = result.scripts?.find(x => x.cut === s.cut)
    if (!sent?.script_id || !sent.readback_ok) return null
    cuts[s.cut] = { script_id: sent.script_id, title: s.title, script_sha256: opts.fileHashes?.[s.cut] ?? s.sha256, sent_at: opts.now, by: opts.by }
  }
  return { teleprompter: { folder_id: result.folder_id, folder_name: input.folder_title, cuts } }
}
