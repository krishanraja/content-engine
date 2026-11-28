import { SaxesParser } from 'saxes'
import { decode } from 'html-entities'
import sources from '../../../../config/hub-sources.json' with { type: 'json' }
import { inFocusSector, keywordRegex, onAvoidList } from '../../api/_beat.js'
import { dayMs, isoDay, sectors, trendLanes } from './types.js'

export type Feed = { url: string; subsector: string; outlet: string; trend?: string }
export type Candidate = { title: string; url: string; summary: string; date: string; outlet: string; domain: string; sector: string; trend?: string }
export const feeds: Feed[] = [...sources.trades, ...sectors.map(s => ({
  subsector: s.key, outlet: 'Google News',
  url: 'https://news.google.com/rss/search?' + new URLSearchParams({ q: s.query + ' when:2d', hl: 'en-GB', gl: 'GB', ceid: 'GB:en' }),
})), ...trendLanes.map(t => ({
  subsector: '', trend: t.key, outlet: 'Google News',
  url: 'https://news.google.com/rss/search?' + new URLSearchParams({ q: t.query + ' when:2d', hl: 'en-GB', gl: 'GB', ceid: 'GB:en' }),
}))]
const aiWords = /\b(?:AI|artificial intelligence|machine learning|generative|ChatGPT|OpenAI|Anthropic|Gemini|LLMs?|chatbots?)\b/i
const sports = keywordRegex([{ keywords: sources.sport_keywords }])
const exceptions = keywordRegex([{ keywords: sources.sport_exceptions }], 'gi')
export function onBeat(row: Candidate) {
  const text = row.title + ' ' + row.summary
  // A trend lane is read outside the creative-sector filter: it is about AI itself, so it needs AI words, not a sector.
  if (row.trend) return !onAvoidList(row.title) && aiWords.test(text)
  return !onAvoidList(row.title) && (inFocusSector(text) || sports.test(text.replace(exceptions, ' ')))
}
export function plain(html: string) {
  return decode(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}
export function webUrl(raw: string, base?: string) {
  try {
    const u = new URL(raw, base)
    if (u.protocol === 'https:' && !u.username && !u.password && !u.port) return u
  } catch { /* skip a malformed feed link */ }
  return null
}

export function parseFeed(xml: string, feed: Feed, now: number): Candidate[] {
  const rows: Candidate[] = []
  const parser = new SaxesParser()
  const stack: string[] = []
  let fields: Record<string, string> = {}
  let depth = 0
  parser.on('doctype', () => { throw Error('unexpected_feed_doctype') })
  parser.on('opentag', tag => {
    stack.push(tag.name)
    if (!depth && ['item','entry'].includes(tag.name)) {
      depth = stack.length
      fields = {}
    } else if (depth && stack.length === depth + 1) {
      if (tag.name === 'link' && tag.attributes.href && (!tag.attributes.rel || tag.attributes.rel === 'alternate')) fields.link = String(tag.attributes.href)
      if (tag.name === 'source') fields.origin = String(tag.attributes.url || '')
    }
  })
  function append(value: string) {
    if (depth && stack.length > depth) {
      const field = stack[depth]
      fields[field] = ((fields[field] || '') + value).slice(0, 4000)
    }
  }
  parser.on('text', append)
  parser.on('cdata', append)
  parser.on('closetag', () => {
    if (depth && stack.length === depth) {
      depth = 0
      const at = Date.parse(fields.pubDate || fields.published || fields.updated || fields['dc:date'])
      const url = webUrl(fields.link?.trim())
      const google = feed.outlet === 'Google News'
      const outlet = google ? plain(fields.source || '') : feed.outlet
      const domain = (google ? webUrl(fields.origin)?.hostname : new URL(feed.url).hostname)?.replace(/^www\./, '')
      let title = plain(fields.title || '')
      if (google && title.endsWith(' - ' + outlet)) title = title.slice(0, -(outlet.length + 3))
      if (url && title && outlet && domain && at <= now && at >= now - 2 * dayMs) {
        rows.push({ title, url: url.href, date: new Date(at).toISOString(), summary: plain(fields.description || fields.summary || '').slice(0, 380),
          outlet, domain, sector: feed.subsector, ...(feed.trend ? { trend: feed.trend } : {}) })
      }
    }
    stack.pop()
  })
  parser.write(xml).close()
  return rows
}

export type Health = { url: string; empty_since: string | null; retry_on: string | null; checked_on: string }
export function feedHealth(url: string, today: string, hasStories: boolean, prior?: Health): Health {
  const continuous = prior && (prior.retry_on || Date.parse(today) - Date.parse(prior.checked_on) <= dayMs)
  const since = hasStories ? null : (continuous && prior.empty_since) || today
  const dead = since && Date.parse(today) - Date.parse(since) >= 6 * dayMs
  return { url, checked_on: today, empty_since: since, retry_on: dead ? isoDay(Date.parse(today) + 7 * dayMs) : null }
}
