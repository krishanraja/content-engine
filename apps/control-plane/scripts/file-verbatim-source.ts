// File a source's own words on a piece, so the fact gate can check against them.
//
//   npx tsx apps/control-plane/scripts/file-verbatim-source.ts \
//     --idea <content_ideas id> --url <page> --match "<regex>" [--match ...] \
//     [--title "<label>"] [--dry-run]
//
// Why this exists. The fact gate (api/_factGate.ts) lets a claim pass on one
// source only when that source is the source's own words. On 2026-09-25 the
// engine's research listed GPT-6 Luna's Batch price as its standard price, and
// a summary like that would have carried the error into print. So facts are
// checked against verbatim excerpts, and this is how an agent session files
// one: fetch the page, keep the title, the date lines, and each passage that
// matches, with the dated heading above it, and file it with the URL.
//
// It refuses to file when a pattern matches nothing, so a filer never believes
// a passage is on file when it is not. It prints the excerpt first; read it.
//
// The page is read through the r.jina.ai reader, which returns the rendered
// text of pages that refuse plain fetches (CNBC and OpenAI's help centre did).
// When the reader itself refuses, the page is read directly and its HTML
// turned into the lines a reader sees (htmlToText).
// "Verbatim" means that text, copied exactly. Env: ENGINE_OPERATOR_TOKEN, and
// ENGINE_URL (defaults to production).

import { stripMarkdownLinks } from '../api/_text.js'

const ENGINE = process.env.ENGINE_URL || 'https://content-engine-flame-nu.vercel.app'

/** The lines to keep, in page order: the title and date lines, every line
 *  matching a pattern, and for each match the nearest heading above it and
 *  the first heading above that which carries a year. Pure, so it is tested.
 *
 *  Links are filed as their words: "[2025 filing](https://...)" is filed as
 *  "2025 filing", and a pattern is matched against the words a reader sees.
 *  The reader keeps the page's markdown links, and a checker quoting the
 *  visible words then failed "word for word" (walk log F34). The page's own
 *  address is filed with the excerpt, so nothing is lost. */
export function excerpt(text: string, patterns: RegExp[]): { content: string; unmatched: string[] } {
  const lines = String(text || '').split('\n').map(stripMarkdownLinks)
  const keep = new Set<number>()
  lines.forEach((l, i) => { if (/^(Title|Published( Time)?|Updated)\b/i.test(l.trim())) keep.add(i) })
  const unmatched: string[] = []
  for (const p of patterns) {
    let hit = false
    lines.forEach((l, i) => {
      if (!p.test(l)) return
      hit = true
      keep.add(i)
      let nearest = true
      for (let j = i - 1; j >= 0; j--) {
        const h = lines[j]
        if (!/^\s*#{1,6}\s/.test(h)) continue
        const dated = /\b(19|20)\d{2}\b/.test(h)
        if (nearest || dated) keep.add(j)
        nearest = false
        if (dated) break
      }
    })
    if (!hit) unmatched.push(String(p))
  }
  const content = [...keep].sort((a, b) => a - b).map(i => lines[i].trim()).filter(Boolean).join('\n\n')
  return { content, unmatched }
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c', ndash: '\u2013', hellip: '\u2026' }

function decode(t: string): string {
  return t
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
}

/** A page's HTML as the lines a reader sees: no scripts or styles, headings
 *  kept as markdown headings (the excerpt walks up to them), one line per
 *  block, entities decoded, and the page title first. Pure, so it is tested.
 *  Used only when the reader service refuses the page: on 2026-10-06 it
 *  refused higgsfield.ai for "too many requests", and higgsfield.ai answered
 *  a plain request. Some sites refuse both (Forbes did); cite another. */
export function htmlToText(html: string): string {
  const title = decode((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] || '').replace(/\s+/g, ' ').trim())
  const body = String(html || '')
    .replace(/<(script|style|noscript|svg|template|title)\b[\s\S]*?<\/\1>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<h([1-6])\b[^>]*>/gi, (_, n) => `\n${'#'.repeat(Number(n))} `)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|tr|td|th|section|article|header|footer|blockquote|pre|dd|dt)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  const lines = decode(body).split('\n').map(l => l.replace(/[ \t\u00a0]+/g, ' ').trim()).filter(Boolean)
  return [title ? `Title: ${title}` : '', ...lines].filter(Boolean).join('\n')
}

async function readPage(url: string): Promise<{ text: string; via: 'reader' | 'direct' }> {
  try {
    const r = await fetch(`https://r.jina.ai/${url}`)
    const text = await r.text()
    if (r.ok && text.length >= 200 && !/^\s*\{"data":null/.test(text)) return { text, via: 'reader' }
  } catch { /* fall through to a direct read */ }
  const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (makeyourmindup fact gate filer)', Accept: 'text/html' } })
  const html = await r.text()
  if (!r.ok || html.length < 200) throw new Error(`could not read ${url}: ${r.status}`)
  return { text: htmlToText(html), via: 'direct' }
}

function args(argv: string[]) {
  const out: { idea?: string; url?: string; title?: string; match: string[]; dry: boolean } = { match: [], dry: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--idea') out.idea = argv[++i]
    else if (a === '--url') out.url = argv[++i]
    else if (a === '--title') out.title = argv[++i]
    else if (a === '--match') out.match.push(argv[++i])
    else if (a === '--dry-run') out.dry = true
  }
  return out
}

async function main() {
  const a = args(process.argv.slice(2))
  if (!a.idea || !a.url || !a.match.length) {
    console.error('usage: --idea <id> --url <page> --match "<regex>" [--match ...] [--title "..."] [--dry-run]')
    process.exit(2)
  }
  const { text, via } = await readPage(a.url)
  if (via === 'direct') console.log('The reader refused this page; read it directly instead.')
  const { content, unmatched } = excerpt(text, a.match.map(m => new RegExp(m, 'i')))
  if (unmatched.length) {
    console.error(`Nothing on the page matches ${unmatched.join(', ')}. Nothing filed.`)
    process.exit(1)
  }
  const title = a.title || (text.match(/^Title:\s*(.+)$/m)?.[1] || a.url).trim()
  console.log(`--- ${title} (verbatim, ${a.url}) ---\n${content}\n---`)
  if (a.dry) return
  const token = process.env.ENGINE_OPERATOR_TOKEN
  if (!token) throw new Error('ENGINE_OPERATOR_TOKEN is not set')
  const res = await fetch(`${ENGINE}/api/content-ideas/${a.idea}/materials`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'paste', verbatim: true, url: a.url, title: `${title} (verbatim)`, content, client: 'claude_code' }),
  })
  const j: any = await res.json().catch(() => ({}))
  if (!res.ok || !j.ok) throw new Error(`filing failed: ${res.status} ${j.error || ''}`)
  console.log(`Filed as material ${j.material?.id} on ${a.idea}.`)
}

if (process.argv[1] && /file-verbatim-source\.ts$/.test(process.argv[1])) {
  main().catch(e => { console.error(e.message); process.exit(1) })
}
