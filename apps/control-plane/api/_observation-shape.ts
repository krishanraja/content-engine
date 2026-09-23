import { createHash } from 'node:crypto'

// The permanent record underneath the disposable feed.
//
// Content Engine v2 spec R10 says nothing news-shaped survives its week, and
// that rule is right about the WORKING SURFACE. content_ideas is a desk, not
// an archive, and a desk that keeps its own noise makes every reader
// responsible for filtering it. What R10 never intended, and what the
// 2026-09-22 audit found, is that the desk was the only copy. The Monday purge
// has been the end of the line for every story that did not become a shift,
// and the feed ingest was dropping off-beat stories at the door without
// writing down that they had ever arrived.
//
// That costs the one thing time cannot give back. "How long did agentic
// orchestration take to reach a second outlet", "which publisher led this
// theme and which followed", "what share of what we fetched did our own gate
// reject, and was the gate right" are all answerable from what we already
// fetched. None of them is answerable from the twenty cards that survived.
//
// So every collector now writes what it saw to trend_observations before it
// applies any judgement, and writes the judgement as a column on the same row.
// The desk still clears every Monday. The record does not.
//
// The three rules, enforced in the database by
// supabase/migrations/20260922100000_nothing_observed_is_ever_lost.sql:
//   1. Rows are never updated and never deleted. A trigger refuses both.
//   2. A row with surfaced=false must say why in drop_reason.
//   3. Identity is (origin, observed_on, url_hash, content_hash), so an
//      identical re-gather collapses and a CHANGED one is kept as a new row.
//
// This file holds the pure half: the identity rules and the row shaping, with
// no client and no I/O, so it can be tested without a Supabase environment.
// The writer lives in _observations.ts beside it.
//
// This file is the reference implementation of the hashing. Three codebases in
// two Supabase projects write to this table and a hash computed differently in
// any of them silently splits one story into two, so if this changes, change
// mm-ctrl/supabase/functions/_shared/trend-memory.ts with it.

export type ObservationOrigin =
  | 'pool_headline' | 'newsletter' | 'exa_lens' | 'creator' | 'zara'
  | 'investigation' | 'gdelt' | 'hn' | 'rss' | 'brave' | 'newsapi' | 'exa'
  | 'control_center' | 'build_signal' | 'purge'

/** Why an observation never reached a human. A surfaced row carries none. */
export type DropReason =
  | 'off_beat' | 'below_trust_floor' | 'not_ai_native' | 'too_old'
  | 'lane_full' | 'damage' | 'duplicate' | 'purged_unused' | 'gathered_not_selected'
  // The relevance classifier's two enforced verdicts, so a story refused by a
  // model is distinguishable in the archive from one refused by the regex gate.
  // `not_interesting` is deliberately absent: it is recorded on the row it kept
  // and never acted on, until its false positive rate is known.
  | 'off_vertical' | 'too_technical'

export interface ObservationInput {
  observedOn?: string          // 'YYYY-MM-DD'; defaults to today UTC
  origin: ObservationOrigin
  collector: string            // the job that saw it, e.g. 'feed/ingest'
  title: string
  snippet?: string | null
  url?: string | null
  sourceHost?: string | null
  sourceTier?: number | null
  publishedAt?: string | null  // absolute ISO, or null when the source is silent
  category?: string | null
  stance?: string | null
  affects?: string[] | null
  score?: number | null
  sourceCount?: number | null
  sourceUrls?: string[] | null
  storyKey?: string | null
  surfaced: boolean
  dropReason?: DropReason | null
  raw?: Record<string, unknown>
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/**
 * Canonical URL for identity purposes: lowercase host, no www, no tracking
 * parameters, no trailing slash, no fragment. Deliberately does NOT drop every
 * query string, because for plenty of publishers the query string IS the
 * article. Returns null for anything that is not an http(s) URL, and the
 * caller then keys on content alone.
 */
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') return null
  try {
    const u = new URL(url.trim())
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    u.hash = ''
    u.host = u.host.toLowerCase().replace(/^www\./, '')
    u.protocol = 'https:'
    for (const p of [...u.searchParams.keys()]) {
      if (/^(utm_|fbclid|gclid|mc_cid|mc_eid|ref|ref_src|source|cmpid|ito)/i.test(p)) u.searchParams.delete(p)
    }
    u.searchParams.sort()
    let out = u.toString()
    if (out.endsWith('/')) out = out.slice(0, -1)
    return out
  } catch {
    return null
  }
}

/** Host of a URL, bare and lowercased. Null when unparseable. */
export function hostOf(url: string | null | undefined): string | null {
  const n = normalizeUrl(url)
  if (!n) return null
  try { return new URL(n).host } catch { return null }
}

/** The text-identity of an observation: title plus snippet, whitespace and
 *  case normalised so a reflowed snippet is not a new story. */
export function contentHash(title: string, snippet?: string | null): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim()
  return sha256(`${norm(title)}\u0000${norm(snippet || '')}`)
}

export function todayUtc(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/** Shape one input into the row the table expects. Pure, so it is testable. */
export function toObservationRow(input: ObservationInput): Record<string, unknown> {
  const normalizedUrl = normalizeUrl(input.url)
  const title = (input.title || '').trim()
  return {
    observed_on: input.observedOn || todayUtc(),
    origin: input.origin,
    collector: input.collector,
    title,
    title_norm: title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 160),
    snippet: input.snippet ?? null,
    url: normalizedUrl ?? input.url ?? null,
    source_host: input.sourceHost ?? hostOf(input.url),
    source_tier: input.sourceTier ?? null,
    published_at: input.publishedAt ?? null,
    category: input.category ?? null,
    stance: input.stance ?? null,
    affects: input.affects ?? null,
    score: input.score ?? null,
    source_count: input.sourceCount ?? null,
    source_urls: input.sourceUrls ?? null,
    story_key: input.storyKey ?? null,
    surfaced: input.surfaced,
    drop_reason: input.surfaced ? null : (input.dropReason ?? 'gathered_not_selected'),
    url_hash: normalizedUrl ? sha256(normalizedUrl) : null,
    content_hash: contentHash(title, input.snippet),
    raw: input.raw ?? {},
  }
}

