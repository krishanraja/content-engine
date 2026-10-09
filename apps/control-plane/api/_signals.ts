// Signals: the free public sources and the keyed readers the engine reads on
// a timer or on demand. Pure fetchers with no database access, so the crons
// in api/signals/*, the scoreboard routes and a test can all call them.
//
// Krish, 2026-10-09: "Prepare and harden the entire engine as though all of
// this exists permanently and can be used thoughtfully, ingeniously, and
// creatively as needed for any future piece ... practically everything
// actually wires in and logically works."
//
// What lives here, and why each one is additive (docs/ENGINE_100X.md):
//
// - Prediction markets (Polymarket, Kalshi; keyless). Every piece ends on a
//   dated Call with a confidence. These read what traders pay for the same
//   outcome, so the scoreboard shows our call beside the market's and tracks
//   both to the due date. Nobody else in this lane does it.
// - GDELT (keyless). The world's news by subject and hour: how fast a story is
//   moving, and the headlines behind the news-wall picture. GDELT allows one
//   request every five seconds per IP and answers a burst with a plain-text
//   notice, so every call here is spaced and retried.
// - Hacker News (Algolia index, keyless). What builders said the hour a story
//   landed.
// - X (X_BEARER_TOKEN, pay-per-use reads). What a lab's own staff and its
//   critics posted the hour it happened.
//
// Exa and Brave are not here: api/_enrich.ts already reads EXA_API_KEY and
// BRAVE_API_KEY inside webResearch, as the fallbacks behind Perplexity.
//
// Everything a reader returns is data, never a claim. A number from here still
// goes through the fact gate before a piece uses it, and the market's odds are
// shown as the market's, never as ours.

const UA = 'Mindmake content engine (krish@krishraja.com)'
const TIMEOUT_MS = 20_000

async function getText(url: string, headers: Record<string, string> = {}): Promise<{ status: number; text: string }> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json', ...headers }, signal: ctl.signal })
    return { status: r.status, text: await r.text() }
  } finally {
    clearTimeout(timer)
  }
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<any> {
  const { status, text } = await getText(url, headers)
  if (status < 200 || status >= 300) throw new Error(`${status} from ${new URL(url).host}: ${text.slice(0, 140)}`)
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`${new URL(url).host} did not return JSON: ${text.slice(0, 140)}`)
  }
}

function num(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

// ── Prediction markets ───────────────────────────────────────────────────

export type MarketSource = 'polymarket' | 'kalshi'

export interface MarketOdds {
  source: MarketSource
  /** The Polymarket slug or the Kalshi ticker. */
  key: string
  question: string | null
  /** The market's implied probability of "Yes", 0 to 1, or null when unreadable. */
  probability: number | null
  volume_usd: number | null
  end_date: string | null
  url: string | null
}

/** Polymarket's Gamma API returns `outcomes` and `outcomePrices` as JSON
 *  strings inside JSON. The probability is the price of the "Yes" outcome
 *  (or the first, when the outcomes are not Yes/No). */
export function polymarketProbability(market: { outcomes?: unknown; outcomePrices?: unknown }): number | null {
  const parse = (v: unknown): unknown[] => {
    if (Array.isArray(v)) return v
    if (typeof v === 'string') { try { const j = JSON.parse(v); return Array.isArray(j) ? j : [] } catch { return [] } }
    return []
  }
  const outcomes = parse(market.outcomes).map(o => String(o).toLowerCase())
  const prices = parse(market.outcomePrices)
  if (!prices.length) return null
  const yes = outcomes.indexOf('yes')
  const p = num(prices[yes >= 0 ? yes : 0])
  if (p === null || p < 0 || p > 1) return null
  return Math.round(p * 10_000) / 10_000
}

function polymarketRow(m: any): MarketOdds {
  return {
    source: 'polymarket',
    key: String(m?.slug || ''),
    question: m?.question ? String(m.question) : null,
    probability: polymarketProbability(m || {}),
    volume_usd: num(m?.volume),
    end_date: m?.endDate ? String(m.endDate) : null,
    url: m?.slug ? `https://polymarket.com/market/${m.slug}` : null,
  }
}

export async function polymarketBySlug(slug: string): Promise<MarketOdds | null> {
  const rows = await getJson(`https://gamma-api.polymarket.com/markets?slug=${encodeURIComponent(slug)}`)
  const m = Array.isArray(rows) ? rows[0] : null
  return m ? polymarketRow(m) : null
}

/** A rough finder: Polymarket's search is loose and can return unrelated
 *  markets, so a real Call is pinned by slug, never by search. */
export async function polymarketSearch(query: string, limit = 6): Promise<MarketOdds[]> {
  const q = new URLSearchParams({ closed: 'false', limit: String(limit), order: 'volume', ascending: 'false', search: query })
  const rows = await getJson(`https://gamma-api.polymarket.com/markets?${q}`)
  return (Array.isArray(rows) ? rows : []).map(polymarketRow)
}

/** Kalshi quotes in cents. The midpoint of the yes bid and ask when both are
 *  there, else the last traded price. */
export function kalshiProbability(market: { yes_bid?: unknown; yes_ask?: unknown; last_price?: unknown }): number | null {
  const bid = num(market.yes_bid)
  const ask = num(market.yes_ask)
  const last = num(market.last_price)
  const cents = bid !== null && ask !== null && bid > 0 && ask > 0 ? (bid + ask) / 2 : last
  if (cents === null || cents < 0 || cents > 100) return null
  return Math.round(cents * 100) / 10_000
}

export async function kalshiByTicker(ticker: string): Promise<MarketOdds | null> {
  const j = await getJson(`https://api.elections.kalshi.com/trade-api/v2/markets/${encodeURIComponent(ticker)}`)
  const m = j?.market
  if (!m) return null
  return {
    source: 'kalshi',
    key: String(m.ticker || ticker),
    question: m.title ? String(m.title) : null,
    probability: kalshiProbability(m),
    volume_usd: num(m.volume_fp ?? m.volume),
    end_date: m.close_time ? String(m.close_time) : null,
    url: m.ticker ? `https://kalshi.com/markets/${String(m.ticker).toLowerCase()}` : null,
  }
}

export async function marketOdds(source: MarketSource, key: string): Promise<MarketOdds | null> {
  if (source === 'polymarket') return polymarketBySlug(key)
  if (source === 'kalshi') return kalshiByTicker(key)
  return null
}

/** The record a piece keeps beside its Call, in content_ideas.meta.call_market. */
export interface CallMarketRecord {
  source: MarketSource
  key: string
  question: string | null
  url: string | null
  probability: number | null
  read_at: string
  set_at: string
  /** At most ninety daily readings, oldest first. */
  history: Array<{ at: string; p: number | null }>
}

export function nextCallMarket(prev: Partial<CallMarketRecord> | null | undefined, odds: MarketOdds, now = new Date()): CallMarketRecord {
  const at = now.toISOString()
  const history = [...(Array.isArray(prev?.history) ? prev!.history : []), { at, p: odds.probability }].slice(-90)
  return {
    source: odds.source,
    key: odds.key,
    question: odds.question,
    url: odds.url,
    probability: odds.probability,
    read_at: at,
    set_at: prev?.set_at || at,
    history,
  }
}

// ── GDELT: news velocity ─────────────────────────────────────────────────

export interface NewsArticle {
  title: string
  url: string
  domain: string
  /** When GDELT first saw it, ISO. */
  seen: string
}

const GDELT_GAP_MS = 5_500
let gdeltLastCall = 0

/** "20261008T053000Z" → "2026-10-08T05:30:00Z". */
export function gdeltSeenToIso(seen: string): string {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(String(seen || ''))
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z` : String(seen || '')
}

function gdeltStamp(daysAgo: number): string {
  const t = new Date(Date.now() - daysAgo * 86_400_000)
  return t.toISOString().replace(/[-:]/g, '').slice(0, 15) // YYYYMMDDTHHMMSS
}

async function gdeltGet(url: string, tries = 3): Promise<any> {
  for (let attempt = 0; attempt < tries; attempt++) {
    const wait = GDELT_GAP_MS - (Date.now() - gdeltLastCall)
    if (wait > 0) await new Promise(r => setTimeout(r, wait))
    const { status, text } = await getText(url)
    gdeltLastCall = Date.now()
    if (status === 429 || status === 503 || /limit requests/i.test(text)) {
      if (attempt < tries - 1) { await new Promise(r => setTimeout(r, GDELT_GAP_MS * (attempt + 1))); continue }
      throw new Error('GDELT rate-limited this IP (one call every five seconds)')
    }
    if (status < 200 || status >= 300) throw new Error(`${status} from GDELT: ${text.slice(0, 120)}`)
    try { return JSON.parse(text) } catch { throw new Error(`GDELT did not return JSON: ${text.slice(0, 120)}`) }
  }
  throw new Error('GDELT stayed rate-limited')
}

/** The latest articles GDELT saw for a subject inside the window. */
export async function gdeltArticles(query: string, days = 2, max = 25): Promise<NewsArticle[]> {
  const q = new URLSearchParams({
    query, mode: 'artlist', maxrecords: String(max), sort: 'datedesc', format: 'json',
    startdatetime: gdeltStamp(days), enddatetime: gdeltStamp(0),
  })
  const j = await gdeltGet(`https://api.gdeltproject.org/api/v2/doc/doc?${q}`)
  const arts = Array.isArray(j?.articles) ? j.articles : []
  return arts
    .filter((a: any) => a?.title && a?.url)
    .map((a: any) => ({ title: String(a.title), url: String(a.url), domain: String(a.domain || ''), seen: gdeltSeenToIso(a.seendate) }))
}

/** How fast a subject is moving: today's count against yesterday's. A subject
 *  is "spiking" when today has at least five articles and at least twice
 *  yesterday's, which is the news-wall's "pile-on" bar (three or more outlets
 *  inside 72 hours is one article; a doubling day is velocity). */
export function velocity(articles: NewsArticle[], now = new Date()): { today: number; yesterday: number; outlets: number; spiking: boolean } {
  const day = (iso: string) => iso.slice(0, 10)
  const today = day(now.toISOString())
  const yesterday = day(new Date(now.getTime() - 86_400_000).toISOString())
  let t = 0, y = 0
  const outlets = new Set<string>()
  for (const a of articles) {
    const d = day(a.seen)
    if (d === today) { t++; outlets.add(a.domain) }
    else if (d === yesterday) y++
  }
  return { today: t, yesterday: y, outlets: outlets.size, spiking: t >= 5 && t >= 2 * Math.max(y, 1) }
}

// ── Hacker News ──────────────────────────────────────────────────────────

export interface HnStory {
  title: string
  url: string | null
  discussion: string
  points: number | null
  comments: number | null
  created: string
}

export async function hnStories(query: string, hits = 10): Promise<HnStory[]> {
  const q = new URLSearchParams({ query, tags: 'story', hitsPerPage: String(hits) })
  const j = await getJson(`https://hn.algolia.com/api/v1/search_by_date?${q}`)
  return (Array.isArray(j?.hits) ? j.hits : [])
    .filter((h: any) => h?.title)
    .map((h: any) => ({
      title: String(h.title),
      url: h.url ? String(h.url) : null,
      discussion: `https://news.ycombinator.com/item?id=${h.objectID}`,
      points: num(h.points),
      comments: num(h.num_comments),
      created: String(h.created_at || ''),
    }))
}

// ── X: recent posts ──────────────────────────────────────────────────────

export interface XPost {
  id: string
  text: string
  created_at: string | null
  author_id: string | null
  likes: number | null
  reposts: number | null
  url: string
}

/** Recent public posts matching a query. Pay-per-use reads on the X API; the
 *  token is X_BEARER_TOKEN. With no token this says so and returns nothing,
 *  so a caller can carry on without X. */
export async function xRecentSearch(query: string, max = 10): Promise<{ configured: boolean; posts: XPost[] }> {
  const token = process.env.X_BEARER_TOKEN
  if (!token) return { configured: false, posts: [] }
  const q = new URLSearchParams({
    query, max_results: String(Math.min(Math.max(max, 10), 100)),
    'tweet.fields': 'created_at,public_metrics,author_id',
  })
  const j = await getJson(`https://api.x.com/2/tweets/search/recent?${q}`, { Authorization: `Bearer ${token}` })
  const posts = (Array.isArray(j?.data) ? j.data : []).map((t: any) => ({
    id: String(t.id),
    text: String(t.text || ''),
    created_at: t.created_at ? String(t.created_at) : null,
    author_id: t.author_id ? String(t.author_id) : null,
    likes: num(t.public_metrics?.like_count),
    reposts: num(t.public_metrics?.retweet_count),
    url: `https://x.com/i/web/status/${t.id}`,
  }))
  return { configured: true, posts }
}

// ── The subject a piece is swept for ─────────────────────────────────────

/** What the news and odds sweeps search for on a piece's behalf: the query a
 *  session set in meta.signals.query, else the piece's own title with the
 *  punctuation a search engine trips on taken out. */
export function signalsQueryFor(idea: { idea?: string | null; meta?: unknown }): string {
  const meta = (idea.meta && typeof idea.meta === 'object' ? idea.meta : {}) as { signals?: { query?: unknown } }
  const set = typeof meta.signals?.query === 'string' ? meta.signals.query.trim() : ''
  if (set) return set.slice(0, 120)
  return String(idea.idea || '').replace(/[?"'“”‘’:;!]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120)
}
