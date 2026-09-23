// Read-only client for the CTRL shared headlines pool (portfolio hive mind).
//
// mm-ctrl's `live-headlines` edge function gathers + cross-verifies a daily
// corroborated AI-news pool into `live_headlines_cache` (one row per day) in the
// CTRL Supabase project. Per spec R5 we READ that pool and never write to it:
// all Content Engine v2 state lives in the OS DB.
//
// Env (Vercel): CTRL_SUPABASE_URL, CTRL_SUPABASE_SERVICE_KEY.

export interface PoolStory {
  day: string           // 'YYYY-MM-DD' (briefing_date)
  headline: string
  say: string | null    // the pool's own "why it matters" line
  source: string | null
  url: string | null
  sourceUrls: string[]
  category: string | null   // one of the nine AI-native lanes
  sourceCount: number | null
}

const CATEGORIES = new Set([
  'model', 'economics', 'tools', 'orchestration', 'product',
  'governance', 'security', 'org', 'proof',
])

/**
 * Feed text, as text.
 *
 * Some of the pool's sources hand back a raw RSS <description>, which is markup,
 * not a sentence. It went into content_ideas.thesis verbatim, so the Feed
 * carried rows reading `<p>Yesterday was <a href="https://x.ai/news/grok-4-7">`,
 * cut off mid-attribute at the column limit. Krish, 2026-09-23, looking at one:
 * "why can't we stop garbage characters and sentences from coming in".
 *
 * Cleaned here rather than at the one caller, because this is where a pool card
 * becomes a typed PoolStory and every reader downstream is entitled to assume a
 * string field holds prose. Returns null for text that was ONLY markup: an
 * absent thesis is honest, an empty-looking one is not.
 */
const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  hellip: '…', mdash: '—', ndash: '–', rsquo: '’', lsquo: '‘',
  rdquo: '”', ldquo: '“', middot: '·', bull: '•',
}
export function plainText(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const text = raw
    // Script and style carry content that is not prose at all, so the whole
    // block goes, not just its tags.
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    // Block boundaries are sentence boundaries. Without this, stripping tags
    // glues the last word of one paragraph to the first of the next.
    .replace(/<\/?(p|div|br|li|tr|h[1-6]|blockquote)\b[^>]*>/gi, ' ')
    // Every other tag, then one the feed truncated mid-attribute.
    .replace(/<[^>]*>/g, '')
    .replace(/<[^>]*$/, '')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[String(name).toLowerCase()] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
  return text || null
}

function normalizeCard(day: string, card: any): PoolStory | null {
  const headline = plainText(card?.headline) || plainText(card?.title) || ''
  if (!headline) return null
  const category = typeof card?.category === 'string' && CATEGORIES.has(card.category) ? card.category : null
  const representativeUrl = typeof card?.url === 'string' && /^https?:\/\//.test(card.url) ? card.url : null
  const sourceUrls = [...new Set([
    representativeUrl,
    ...(Array.isArray(card?.sourceUrls) ? card.sourceUrls : []),
  ].filter((value): value is string => typeof value === 'string' && /^https?:\/\//.test(value)))]
  return {
    day,
    headline,
    say: plainText(card?.say),
    source: typeof card?.source === 'string' ? card.source : null,
    url: representativeUrl,
    sourceUrls,
    category,
    sourceCount: Number.isFinite(card?.sourceCount) ? Number(card.sourceCount) : null,
  }
}

export function poolConfigured(): boolean {
  return Boolean(process.env.CTRL_SUPABASE_URL && process.env.CTRL_SUPABASE_SERVICE_KEY)
}

// Fetch pool days since a date (inclusive), oldest first. Tolerates the payload
// being either an array of cards or an envelope with a cards/headlines array.
export async function fetchPoolDays(sinceDate: string): Promise<{ days: number; stories: PoolStory[] }> {
  const url = process.env.CTRL_SUPABASE_URL
  const key = process.env.CTRL_SUPABASE_SERVICE_KEY
  if (!url || !key) return { days: 0, stories: [] }

  const r = await fetch(
    `${url}/rest/v1/live_headlines_cache?select=briefing_date,payload&briefing_date=gte.${sinceDate}&order=briefing_date.asc&limit=40`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
  if (!r.ok) throw new Error(`pool_read_${r.status}`)
  const rows = (await r.json()) as Array<{ briefing_date: string; payload: any }>

  const stories: PoolStory[] = []
  for (const row of rows) {
    const p = row.payload
    const cards: any[] = Array.isArray(p) ? p
      : Array.isArray(p?.cards) ? p.cards
      : Array.isArray(p?.headlines) ? p.headlines
      : []
    for (const c of cards) {
      const s = normalizeCard(row.briefing_date, c)
      if (s) stories.push(s)
    }
  }
  return { days: rows.length, stories }
}
