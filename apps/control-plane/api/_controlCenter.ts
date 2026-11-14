import { createHash } from 'node:crypto'
import { mintAccessValue } from './_accessCookie.js'
import { supabase } from './_supabase.js'

// The engine asks Control Center's done-check sweep to look at a piece's
// board items now, after a step lands on the piece (step 4, ADR-036 there).
//
// Krish, 2026-10-11: "I am happy to Clear(complete)/Bump/Purge things off my
// lists as I go but the rest should be automatically done." One sweep in
// Control Center (api/_doneChecks.ts) ends every board item by its kind; the
// engine closes nothing itself. So a making write only asks for a look:
// POST /api/done-checks { keys } with the keys of the open items tied to
// the piece, and the sweep reads the piece's steps back from this engine.
// Both apps derive the same access cookie from the same ACCESS_CODE, which
// is how Control Center speaks to the board here too (its api/_slate.ts).
//
// The ask is not fire-and-forget: the write that made it waits for it, up to
// ASK_MS (3 seconds), before it answers, because a serverless function may
// be frozen once it has answered and an ask left running would then never
// be sent. Control Center runs the checks before it answers, so the ask
// often takes the full 3 seconds, and every making write, Krish's channel
// ticks included, answers up to 3 seconds later. It never fails the write:
// when Control Center is slow or down, its cron looks within 15 minutes.

export const DEFAULT_CONTROL_CENTER_URL = 'https://controlcenter.krishraja.com'
/** How long a making write (and the publish watcher) waits for the ask before it answers. */
export const ASK_MS = 3_000
/** The most keys one ask may carry (Control Center's route takes 1 to 10). */
const MAX_KEYS = 10

export function controlCenterUrl(env: Record<string, string | undefined> = process.env): string {
  return (env.CONTROL_CENTER_URL || DEFAULT_CONTROL_CENTER_URL).replace(/\/+$/, '')
}

/** The cookie Control Center's edge gate issues for the access code (v2 when ACCESS_COOKIE_V2=1), or null when there is none. */
export function accessCookie(env: Record<string, string | undefined> = process.env): string | null {
  const code = (env.ACCESS_CODE || '').trim()
  return code ? `cc_access=${mintAccessValue(code, env)}` : null
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Promise<{ status: number }>

export interface Look { keys: string[]; status: number | null; note?: string }

/** Asks the sweep to look at these board items now. Never throws. */
export async function askChecksToLook(itemIds: string[], deps: { env?: Record<string, string | undefined>; fetchImpl?: FetchLike; timeoutMs?: number } = {}): Promise<Look> {
  const keys = [...new Set(itemIds)].slice(0, MAX_KEYS).map(id => `board-${id}`)
  if (!keys.length) return { keys, status: null }
  const cookie = accessCookie(deps.env)
  if (!cookie) return { keys: [], status: null, note: 'no access code, so the cron looks within 15 minutes' }
  try {
    const r = await (deps.fetchImpl ?? (fetch as unknown as FetchLike))(`${controlCenterUrl(deps.env)}/api/done-checks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ keys }),
      signal: AbortSignal.timeout(deps.timeoutMs ?? ASK_MS),
    })
    return { keys, status: r.status }
  } catch (e) {
    return { keys, status: null, note: `not asked (${String((e as Error)?.message || e).slice(0, 80)}), so the cron looks within 15 minutes` }
  }
}

/** The open board items tied to a piece, then asks the sweep to look at them. Never throws. */
export async function askChecksForPiece(ideaId: string, deps: Parameters<typeof askChecksToLook>[1] = {}): Promise<Look> {
  try {
    const { data, error } = await supabase.from('work_board_items').select('id').eq('idea_id', ideaId).in('lane', ['on_you', 'in_progress']).limit(MAX_KEYS)
    if (error) return { keys: [], status: null, note: 'the board could not be read, so the cron looks within 15 minutes' }
    return askChecksToLook(((data || []) as Array<{ id: string }>).map(r => r.id), deps)
  } catch {
    return { keys: [], status: null, note: 'the board could not be read, so the cron looks within 15 minutes' }
  }
}

// ── The one voice check (Ruling, Krish, 2026-11-09) ──────────────────────────
// "we need to make sure everything goes through the same voice system.
// Absolutely everything." Control Center owns the check (its api/_voiceCheck.ts,
// krish-voice's kill list in ai-harness, and Make Your Mind Up's canon for the
// publication's channels). This engine keeps no list of its own and asks.

/** The channels the voice check takes for this engine's words. */
export type VoiceChannel = 'article' | 'script' | 'caption' | 'carousel' | 'substack' | 'linkedin' | 'x' | 'threads' | 'substack_note' | 'instagram' | 'comment' | 'email'

export interface VoiceHard { rule: string; match: string; message: string }
export interface VoiceAnswer { hard: VoiceHard[]; distance: number | null; source: string | null }

/** Control Center's verdict on these words, or null when it could not be asked (no access code, unreachable, a bad reply). */
export async function askVoiceCheck(text: string, channel: VoiceChannel, deps: { env?: Record<string, string | undefined>; fetchImpl?: typeof fetch; timeoutMs?: number } = {}): Promise<VoiceAnswer | null> {
  const cookie = accessCookie(deps.env)
  if (!cookie || !text.trim()) return null
  try {
    const r = await (deps.fetchImpl ?? fetch)(`${controlCenterUrl(deps.env)}/api/voice/check`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ text: text.slice(0, 60_000), channel }),
      signal: AbortSignal.timeout(deps.timeoutMs ?? 15_000),
    })
    if (r.status !== 200) return null
    const j = await r.json() as { ok?: boolean; check?: { hard?: VoiceHard[]; distance?: number; source?: { kill_list?: string } } }
    if (j?.ok !== true || !Array.isArray(j.check?.hard)) return null
    return { hard: j.check!.hard!, distance: typeof j.check!.distance === 'number' ? j.check!.distance : null, source: j.check!.source?.kill_list ?? null }
  } catch {
    return null
  }
}

