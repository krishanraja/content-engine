// Apify runs for the cloud backup, made by the engine so its key never leaves it.
//
// Krish, 2026-10-28: "Do not stop until this is functional." The cloud backup (content-watcher on GitHub's machine)
// needs Apify for Instagram and YouTube, which refuse GitHub's machines on every free route. GitHub Actions secrets
// cannot be written from a session, and a second copy of the key is a second place to leak it, so the engine runs the
// actor with its own key (APIFY_TOKEN) and hands back the dataset. Only for a cloud machine holding the request's
// claim, only the actors content-watcher uses, only with an input that names that request's post, and each run under
// a hard charge cap Apify enforces.
//
// Pure, so the tests run with no Apify and no database.

import { isCloudMachine, type Parsed, type WatchStore } from './_watch.js'

/** content-watcher's paid actors (content_watcher/fetch/apify.py ACTORS), each with Apify's hard per-run cap. */
export const WATCH_ACTORS: Record<string, { maxUsd: number; timeoutSec: number }> = {
  'apify~instagram-reel-scraper': { maxUsd: 0.05, timeoutSec: 120 },
  'apify~instagram-scraper': { maxUsd: 0.05, timeoutSec: 120 },
  'snapinsta~instagram-downloader-api': { maxUsd: 0.02, timeoutSec: 120 },
  'clockworks~tiktok-video-scraper': { maxUsd: 0.05, timeoutSec: 240 },
  'johnvc~YoutubeTranscripts': { maxUsd: 0.05, timeoutSec: 120 },
  'marielise.dev~youtube-video-downloader': { maxUsd: 0.15, timeoutSec: 240 },
  'harvestapi~linkedin-profile-posts': { maxUsd: 0.05, timeoutSec: 120 },
  'supreme_coder~linkedin-post': { maxUsd: 0.05, timeoutSec: 120 },
}
export const MAX_INPUT_CHARS = 2000
export const MAX_ITEMS = 5

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MACHINE_RE = /^[A-Za-z0-9._-]{1,80}$/

export interface PaidRunBody { id: string; machine: string; actor: string; input: Record<string, unknown> }

function obj(body: unknown): Record<string, unknown> | null {
  if (typeof body === 'string') {
    try { body = JSON.parse(body) } catch { return null }
  }
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : null
}

export function parsePaidRun(body: unknown): Parsed<PaidRunBody> {
  const b = obj(body)
  if (!b) return { ok: false, error: 'invalid_body' }
  if (typeof b.id !== 'string' || !UUID_RE.test(b.id)) return { ok: false, error: 'invalid_id' }
  if (typeof b.machine !== 'string' || !MACHINE_RE.test(b.machine)) return { ok: false, error: 'invalid_machine' }
  if (typeof b.actor !== 'string' || !Object.prototype.hasOwnProperty.call(WATCH_ACTORS, b.actor)) return { ok: false, error: 'actor_not_allowed' }
  const input = obj(b.input)
  if (!input || JSON.stringify(input).length > MAX_INPUT_CHARS) return { ok: false, error: 'invalid_input' }
  return { ok: true, value: { id: b.id, machine: b.machine, actor: b.actor, input } }
}

/** The post's own id in a link: the last path segment, such as DfAY9PWFuEX or 7olCmqWw9Wk. */
export function postToken(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean)
    const last = parts[parts.length - 1]
    return last && last.length >= 5 ? last : null
  } catch {
    return null
  }
}

/** Whether this run is one the engine makes: a cloud machine, holding the claim, on an input naming that post. */
export async function checkPaidRun(store: WatchStore, body: PaidRunBody): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!isCloudMachine(body.machine)) return { ok: false, status: 403, error: 'cloud_machines_only' }
  const row = await store.get(body.id)
  if (!row) return { ok: false, status: 404, error: 'not_found' }
  if (row.status !== 'claimed' || row.claimed_by !== body.machine) return { ok: false, status: 409, error: 'not_claimed_by_machine' }
  const text = JSON.stringify(body.input)
  const names = [row.url, row.url_key, postToken(row.url_key), postToken(row.url)].filter((s): s is string => !!s)
  if (!names.some(name => text.includes(name))) return { ok: false, status: 400, error: 'input_not_this_post' }
  return { ok: true }
}
