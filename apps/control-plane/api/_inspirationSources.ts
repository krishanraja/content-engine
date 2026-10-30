// What Krish's Inspiration House holds, for Sunday's ideas (GET /api/week/options?include=sources, `inspiration`).
//
// Krish, 2026-10-24: "Double check my inspirationhouse gets read properly when ideas are being built, alongside all
// the other sources of content suggestions." Until this file, Sunday's gather read only the Drive scan's
// 'inspiration_sweep' rows, so a card he routed to "Make a piece" on the Inspiration page never reached the Ideas tab
// (three such cards on 2026-10-24 had no idea row at all). This reads the taste ledger's own tables
// (krishanraja/inspirationhouse, schema in supabase/migrations) and content-watcher's readings, read-only, no model:
//
//   routed       cards he routed to make_piece: his words (why_like, would_do). Every one must be on the board or
//                accounted for with a reason (must_cover; scripts/post-pack/board_feed.py cover).
//   study_style  cards he routed to study_style: production references for the style bank and the creative
//                direction (config/styles.json, docs/CREATIVE_DIRECTION.md), never topics.
//   liked        cards he answered with a why but did not route: what he likes, as evidence beside an idea.
//   fresh        cards he has not answered yet, newest first: seeds the session may research into ideas.
//   saved_why    on any card: the note he typed when he pasted its link (inspirationhouse src/tag/links.ts keeps it as
//                the card's why_here while it is still that note). His words, so a card that carries them is owed a
//                place on the board like a routed one (Krish, 2026-10-29, of a meme link he saved with "We should reskin
//                this as a hilarious video meme": "check this ... makes it through correctly to the ideas board").
//   corpora      content-watcher readings with no card: research he dropped in (a corpus, a long post).
//   creators     creator moves: why a peer's post worked and Krish's own angle on it.
//   claims       taste claims (form only, anti-echo), candidate or proposed: evidence of his taste, never a rule. A
//                claim becomes a rule only when he approves its proposal (taste_profile_form, read by _taste.ts).
//
// Nothing here ranks for the judges (they stay blind, scripts/check-judges.ts) and nothing writes.

export const INSPO_FRESH_DAYS = 21
export const EXCERPT = 280

type Row = Record<string, any>

const clip = (s: unknown, n = EXCERPT): string | null => {
  const t = String(s ?? '').replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length > n ? `${t.slice(0, n - 1)}…` : t
}

const routesOf = (r: Row): string[] => {
  const out = new Set<string>()
  if (r.route) out.add(String(r.route))
  for (const x of Array.isArray(r.routes) ? r.routes : []) if (x) out.add(String(x))
  return [...out]
}

/** Topic and form labels the tagger guessed for a card (auto_tags), and those he confirmed (confirmed_tags). */
function labels(r: Row) {
  const read = (v: unknown) => (Array.isArray(v) ? v : []).filter((t: any) => t && t.label)
    .map((t: any) => ({ kind: String(t.kind || ''), layer: t.layer ? String(t.layer) : null, label: String(t.label) }))
  const confirmed = read(r.confirmed_tags)
  return { confirmed, guessed: confirmed.length ? [] : read(r.auto_tags) }
}

export interface InspoCard {
  id: string
  name: string
  folder: string | null
  lane: string | null
  kind: string | null
  platform: string | null
  link: string | null
  routes: string[]
  /** His words on the card, verbatim (why_like_source 'typed'), or null. */
  why_like: string | null
  /** A suggested why he tapped (why_like_source 'picked'): his endorsement, never his words (inspirationhouse rule). */
  endorsed: string | null
  would_do: string | null
  /** The note he typed when he pasted the link, verbatim, while the card still holds it as its why_here; or null. */
  saved_why: string | null
  note_for_claude: string | null
  answered_at: string | null
  created_at: string | null
  piece_id: string | null
  tags: ReturnType<typeof labels>
  heard: string | null
}

/** His paste-time note (facets.link.note) while the card's why_here is still that note: an Undo on the page clears
 *  why_here, and a guess never writes there. */
export function savedWhy(r: Row): string | null {
  const note = typeof r.facets?.link?.note === 'string' ? r.facets.link.note.trim() : ''
  return note && typeof r.why_here === 'string' && r.why_here.trim() === note ? clip(note, 600) : null
}

export function card(r: Row): InspoCard {
  const f = r.facets || {}
  const link = typeof f.link === 'object' && f.link ? (f.link.url || f.link.link || null) : (typeof f.link === 'string' ? f.link : null)
  return {
    id: String(r.id), name: String(r.name || ''), folder: r.folder || null, lane: r.lane || null, kind: r.kind || null,
    platform: f.platform || null, link: link && /^https:\/\//.test(String(link)) ? String(link) : null,
    routes: routesOf(r),
    why_like: r.why_like_source === 'typed' ? clip(r.why_like, 600) : null,
    endorsed: r.why_like_source === 'picked' ? clip(r.why_like, 600) : null,
    would_do: clip(r.would_do, 600), saved_why: savedWhy(r), note_for_claude: clip(r.note_for_claude, 600),
    answered_at: r.answered_at || null, created_at: r.created_at || null, piece_id: r.piece_id || null,
    tags: labels(r), heard: clip(r.transcript),
  }
}

export interface InspirationBlock {
  routed: InspoCard[]
  study_style: InspoCard[]
  liked: InspoCard[]
  fresh: InspoCard[]
  corpora: Array<{ id: string; title: string; shape: string | null; platform: string | null; source_url: string | null; excerpt: string | null; created_at: string | null }>
  creators: Array<{ id: string; creator: string; post_url: string | null; why_it_works: string | null; krish_angle: string | null; idea_id: string | null; created_at: string | null }>
  claims: Array<{ id: string; layer: string | null; status: string; statement: string; his_words: string | null; support: number | null }>
  /** Ids the Ideas tab must carry (an idea's `covers`) or account for (ideas.json `accounted`), never drop silently. */
  must_cover: Array<{ id: string; what: string; his_words: string | null; endorsed: string | null }>
  counts: Record<string, number>
}

/** The title a content-watcher reading gives itself ("File: <name> (sha256 ...)"), else its first heading. */
function readingTitle(md: string): string {
  const file = /^File:\s*(.+?)\s*\(sha256/m.exec(md)
  if (file) return file[1]
  const h = /^#\s+(.+)$/m.exec(md)
  return h ? h[1] : 'reading'
}

/** A reading's own text after its header lines: the caption or the words heard, clipped. */
function readingExcerpt(md: string): string | null {
  const body = md.split('\n').filter(l => l.trim() && !/^(#|File:|Video:|Image:|Text post:|Heard:|First line:)/.test(l.trim())).join(' ')
  return clip(body)
}

/**
 * quotesStanding: the ids of taste_evidence rows that still stand, among those the claims quote (krish_source_id). A
 * claim keeps its quote while the answer it quotes is withdrawn (migration 20261112090000_taste_quote_holds.sql), so a
 * quote counts as his words only while that row stands; with no list, no quote is shown.
 */
export function buildInspiration(input: { weekStart: string; items: Row[]; reads?: Row[]; moves?: Row[]; claims?: Row[];
  quotesStanding?: string[]; listedIdeas?: string[] }): InspirationBlock {
  const freshSince = new Date(Date.parse(`${input.weekStart}T00:00:00Z`) - INSPO_FRESH_DAYS * 86_400_000).toISOString()
  // A said idea's card whose content idea is already on the board (listedIdeas) is the same idea twice; it is left
  // out unless he has answered or routed the card itself, which keeps his press.
  const listed = new Set(input.listedIdeas || [])
  const twice = (r: Row) => r.facets?.said?.landed_table === 'content_ideas' && listed.has(String(r.facets.said.landed_id))
    && !r.answered_at && !routesOf(r).length
  const live = input.items.filter(r => !r.dismissed_at && !r.facets?.part_of && !twice(r))
  const cards = live.map(card)
  const byNewest = (a: InspoCard, b: InspoCard) => String(b.answered_at || b.created_at || '').localeCompare(String(a.answered_at || a.created_at || ''))
  // A routed card that already became a piece (piece_id) is done; the rest are owed a place on the board.
  const routed = cards.filter(c => c.routes.includes('make_piece') && !c.piece_id).sort(byNewest)
  const studyStyle = cards.filter(c => c.routes.includes('study_style')).sort(byNewest)
  const liked = cards.filter(c => (c.why_like || c.endorsed) && !c.routes.length).sort(byNewest)
  const fresh = cards.filter(c => !c.answered_at && !c.routes.length && String(c.created_at || '') >= freshSince).sort(byNewest)

  // A reading that already became a card is the card's (its words are the card's transcript); the rest are research
  // he dropped in. Cards carry the reading's sha256 in facets (read_from), so match on that, then on the file name.
  const carded = new Set<string>()
  for (const r of live) {
    const f = r.facets || {}
    for (const v of [f.sha256, f.read_from?.sha256, f.read_sha256]) if (v) carded.add(String(v).toLowerCase())
  }
  // content-watcher writes a file's name as the file system had it ("https   claude..txt" for "https://claude..txt"),
  // so names are compared on their letters and digits only.
  const key = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '')
  const names = new Set(live.map(r => key(String(r.name || ''))))
  const corpora = (input.reads || [])
    .filter(r => !carded.has(String(r.sha256 || '').toLowerCase()))
    .map(r => ({ r, title: readingTitle(String(r.read_md || '')) }))
    .filter(({ title }) => !names.has(key(title)))
    .sort((a, b) => String(b.r.created_at || '').localeCompare(String(a.r.created_at || '')))
    .map(({ r, title }) => ({ id: String(r.id), title, shape: r.shape || null, platform: r.platform || null,
      source_url: r.source_url && /^https:\/\//.test(r.source_url) ? r.source_url : null,
      excerpt: readingExcerpt(String(r.read_md || '')), created_at: r.created_at || null }))

  const creators = (input.moves || [])
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .map(m => ({ id: String(m.id), creator: String(m.creator_slug || ''), post_url: m.post_url || null,
      why_it_works: clip(m.why_it_works, 400), krish_angle: clip(m.krish_angle, 400), idea_id: m.content_idea_id || null,
      created_at: m.created_at || null }))

  // Form only (anti-echo: taste shapes form, never subject), and never a retired or superseded claim. Proposed (put
  // to him) before candidate.
  const standing = new Set(input.quotesStanding || [])
  const claims = (input.claims || [])
    .filter(c => c.kind === 'form' && ['candidate', 'proposed'].includes(String(c.status)))
    .map(c => ({ id: String(c.id), layer: c.layer || null, status: String(c.status), statement: String(c.statement || ''),
      // Words he took back (the answer it quotes withdrawn) are never handed on as his.
      his_words: c.krish_source_id && standing.has(String(c.krish_source_id)) ? clip(c.krish, 300) : null,
      support: typeof c.support_n === 'number' ? c.support_n : null }))
    .sort((a, b) => (a.status === 'proposed' ? 0 : 1) - (b.status === 'proposed' ? 0 : 1))

  const must_cover = [
    ...routed.map(c => ({ id: c.id, what: `Inspiration card "${c.name}" you routed to Make a piece`, his_words: c.why_like || c.would_do || c.saved_why || null, endorsed: c.endorsed })),
    // A link he saved with his own words, not routed and not yet a piece: those words ask for something too.
    ...cards.filter(c => c.saved_why && !c.piece_id && !c.routes.includes('make_piece') && !c.routes.includes('study_style'))
      .sort(byNewest).map(c => ({ id: c.id, what: `Inspiration card "${c.name}" you saved with your words`, his_words: c.saved_why, endorsed: null })),
  ]
  return {
    routed, study_style: studyStyle, liked, fresh, corpora, creators, claims, must_cover,
    counts: { routed: routed.length, study_style: studyStyle.length, liked: liked.length, fresh: fresh.length,
      corpora: corpora.length, creators: creators.length, claims: claims.length },
  }
}
