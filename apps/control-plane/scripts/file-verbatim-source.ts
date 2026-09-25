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
// "Verbatim" means that text, copied exactly. Env: ENGINE_OPERATOR_TOKEN, and
// ENGINE_URL (defaults to production).

const ENGINE = process.env.ENGINE_URL || 'https://content-engine-flame-nu.vercel.app'

/** The lines to keep, in page order: the title and date lines, every line
 *  matching a pattern, and for each match the nearest heading above it and
 *  the first heading above that which carries a year. Pure, so it is tested. */
export function excerpt(text: string, patterns: RegExp[]): { content: string; unmatched: string[] } {
  const lines = String(text || '').split('\n')
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
  const r = await fetch(`https://r.jina.ai/${a.url}`)
  const text = await r.text()
  if (!r.ok || text.length < 200) throw new Error(`could not read ${a.url}: ${r.status}`)
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
