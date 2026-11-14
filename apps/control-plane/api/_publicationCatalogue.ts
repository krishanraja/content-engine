// The public publication catalogue: for every published piece, the public addresses it went out at.
//
// Krish, 2026-11-11: makeyourmindup.ai showed no thumbnails or videos, and "moving forward ... everything is done
// automatically". The cover site reads the article and its cover from Substack itself; what Substack does not hold is
// where the piece's videos went (YouTube for the full cut, YouTube Shorts for the vertical one). Those arrive on the
// piece's making record through the existing receipts (Growth's POST /api/board/<Monday>/posted, or
// making.py <piece> posted <channel> <url>), and the hourly publish watcher records the Substack address. This reads
// that record and nothing else: no second catalogue, no hand mapping.
//
// Only public facts leave: the piece id, its series, title, publication date and the live https addresses. Never a
// score, a draft, a Drive link, a token or a private video. A video address the record holds but that does not parse
// as YouTube is left out and counted, never guessed. Pure, so the tests need no database.

/** The first piece the engine published went out on 5 October 2026. */
export const CATALOGUE_FROM = '2026-10-05T00:00:00Z'
const SERIES = ['follow_the_money', 'under_the_hood', 'mind_the_gap'] as const

export interface CataloguePiece {
  id: string
  idea: string | null
  lane_slot: string | null
  published_at: string | null
  published_url: string | null
  meta: Record<string, any> | null
  transformed_outputs: Record<string, any> | null
}

export interface CatalogueVideo { url: string; id: string; posted_at: string | null }
export interface CatalogueEntry {
  piece_id: string
  series: string | null
  title: string
  published_at: string
  /** The Substack post, as the watcher or a receipt recorded it. */
  article_url: string | null
  /** The 16:9 cut on YouTube. */
  video: CatalogueVideo | null
  /** The 9:16 cut on YouTube Shorts: kept apart from the full video, always. */
  short: CatalogueVideo | null
}
export interface Catalogue { version: 1; from: string; entries: CatalogueEntry[]; held: { piece_id: string; channel: string; reason: string }[] }

const https = (u: unknown): u is string => typeof u === 'string' && /^https:\/\/[^\s"<>]+$/.test(u) && u.length <= 2048
const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null)

/** The 11-character video id of a YouTube address (watch, youtu.be, shorts, embed, live), or null. */
export function youtubeId(url: string): string | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  const host = u.hostname.replace(/^(www|m|music)\./, '')
  const ok = (s: string | null | undefined) => (s && /^[\w-]{11}$/.test(s) ? s : null)
  if (host === 'youtu.be') return ok(u.pathname.split('/')[1])
  if (host !== 'youtube.com') return null
  if (u.pathname === '/watch') return ok(u.searchParams.get('v'))
  const m = /^\/(?:shorts|embed|live|v)\/([^/?#]+)/.exec(u.pathname)
  return m ? ok(m[1]) : null
}

/** Canonical addresses, so a Shorts id reads as a Short and a full video as a watch link, whatever form was recorded. */
const watchUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`
const shortUrl = (id: string) => `https://www.youtube.com/shorts/${id}`

export function catalogue(pieces: readonly CataloguePiece[]): Catalogue {
  const entries: CatalogueEntry[] = []
  const held: Catalogue['held'] = []
  for (const p of pieces) {
    const at = iso(p.published_at)
    if (!at || at < CATALOGUE_FROM) continue
    const channels = p.meta?.making?.channels && typeof p.meta.making.channels === 'object' ? p.meta.making.channels : {}
    const video = (channel: 'youtube' | 'shorts'): CatalogueVideo | null => {
      const rec = channels[channel]
      if (!rec || rec.url == null) return null
      const id = https(rec.url) ? youtubeId(rec.url) : null
      if (!id) { held.push({ piece_id: p.id, channel, reason: 'recorded address is not a YouTube video address' }); return null }
      return { url: channel === 'shorts' ? shortUrl(id) : watchUrl(id), id, posted_at: iso(rec.posted_at) }
    }
    const v = video('youtube'), s = video('shorts')
    if (v && s && v.id === s.id) {
      // One upload recorded as both cuts: keep it where its address says it is, never in both slots.
      held.push({ piece_id: p.id, channel: 'youtube', reason: 'the same video id is recorded as the full cut and the Short' })
    }
    const article = [p.published_url, channels.substack?.url].find(https) ?? null
    const title = [p.meta?.making?.pack?.headline, p.transformed_outputs?.youtube_package?.substack_title, p.idea]
      .find(t => typeof t === 'string' && t.trim()) as string | undefined
    entries.push({
      piece_id: p.id,
      series: (SERIES as readonly string[]).includes(String(p.lane_slot)) ? String(p.lane_slot) : null,
      title: (title || 'Untitled').trim().slice(0, 300),
      published_at: at,
      article_url: article,
      video: v && s && v.id === s.id ? (/\/shorts\//.test(String(channels.youtube?.url)) ? null : v) : v,
      short: v && s && v.id === s.id ? (/\/shorts\//.test(String(channels.youtube?.url)) ? s : null) : s,
    })
  }
  entries.sort((a, b) => b.published_at.localeCompare(a.published_at) || a.piece_id.localeCompare(b.piece_id))
  return { version: 1, from: CATALOGUE_FROM, entries, held }
}
