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
//   asks         every card he typed words on (why_here, a typed why_like, would_do) in the ASK_DAYS before the week,
//                newest words first, whatever became of the card: dismissed, routed to study_style, routed to a piece
//                already. Each is in must_cover (ask: true): used, combined, or declined with a reason; a style-only
//                ask may be answered by an idea's style_from. Krish, 2026-10-31: the Sunday run ignored his asks (a
//                card dismissed on 26 Oct never reached it; one routed to study_style named its topic in his words).
//   recent       pieces scheduled in the RECENT_DAYS before the week, with the must_cover ids each answered: the
//                board may not offer them again (board_feed.py cover, no-repeat).
//
// Nothing here ranks for the judges (they stay blind, scripts/check-judges.ts) and nothing writes.

export const INSPO_FRESH_DAYS = 21
export const ASK_DAYS = 45
export const RECENT_DAYS = 21
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

/** A card he typed words on, and what became of it. */
export interface Ask {
  id: string
  name: string
  /** dismissed, style_only, piece (it already became one), routed (to make_piece), or open. */
  state: 'dismissed' | 'style_only' | 'piece' | 'routed' | 'open'
  dismissed: boolean
  style_only: boolean
  routed: boolean
  piece_id: string | null
  /** His words, verbatim: the paste-time note (why_here), a typed why_like, and would_do. */
  his_words: { why_here: string | null; why_like: string | null; would_do: string | null }
  words_at: string | null
  heard: string | null
  url: string | null
}

export interface RecentPiece { id: string; idea: string; state: string | null; scheduled_for: string | null; series: string | null; covers: string[] }

export interface InspirationBlock {
  routed: InspoCard[]
  study_style: InspoCard[]
  liked: InspoCard[]
  fresh: InspoCard[]
  corpora: Array<{ id: string; title: string; shape: string | null; platform: string | null; source_url: string | null; excerpt: string | null; created_at: string | null }>
  creators: Array<{ id: string; creator: string; post_url: string | null; why_it_works: string | null; krish_angle: string | null; idea_id: string | null; created_at: string | null }>
  claims: Array<{ id: string; layer: string | null; status: string; statement: string; his_words: string | null; support: number | null }>
  /** Ids the Ideas tab must carry (an idea's `covers`) or account for (ideas.json `accounted`), never drop silently. */
  must_cover: Array<{ id: string; what: string; his_words: string | null; endorsed: string | null; ask?: true; state?: Ask['state']; style_only?: boolean; piece_id?: string | null }>
  asks: Ask[]
  recent: RecentPiece[]
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
/** His typed words on a card: why_here (never a guess), why_like only when typed, would_do. Null when none. */
export function hisWords(r: Row): Ask['his_words'] | null {
  const w = { why_here: clip(r.why_here, 600), why_like: r.why_like_source === 'typed' ? clip(r.why_like, 600) : null, would_do: clip(r.would_do, 600) }
  return w.why_here || w.why_like || w.would_do ? w : null
}

/** Every card he typed words on within ASK_DAYS of the week, newest words first (see the header). */
export function buildAsks(weekStart: string, items: Row[], skip: (r: Row) => boolean = () => false): Ask[] {
  const since = new Date(Date.parse(`${weekStart}T00:00:00Z`) - ASK_DAYS * 86_400_000).toISOString()
  const seen = new Set<string>()
  const out: Ask[] = []
  for (const r of items) {
    const words = hisWords(r)
    const id = String(r.id)
    if (!words || seen.has(id) || skip(r)) continue
    const at = String(r.answered_at || r.created_at || '')
    if (!at || at < since) continue
    seen.add(id)
    const c = card(r)
    const dismissed = Boolean(r.dismissed_at)
    const styleOnly = c.routes.includes('study_style') && !c.routes.includes('make_piece')
    const routed = c.routes.includes('make_piece')
    const state: Ask['state'] = dismissed ? 'dismissed' : c.piece_id ? 'piece' : styleOnly ? 'style_only' : routed ? 'routed' : 'open'
    out.push({ id, name: c.name, state, dismissed, style_only: styleOnly, routed, piece_id: c.piece_id, his_words: words,
      words_at: at, heard: c.heard, url: c.link })
  }
  return out.sort((a, b) => String(b.words_at).localeCompare(String(a.words_at)))
}

/** Pieces scheduled in the RECENT_DAYS before the week, with the must_cover ids each answered (meta.covers). */
export function buildRecent(weekStart: string, rows: Row[]): RecentPiece[] {
  const start = Date.parse(`${weekStart}T00:00:00Z`)
  const since = new Date(start - RECENT_DAYS * 86_400_000).toISOString().slice(0, 10)
  return rows.filter(r => r.scheduled_for && String(r.scheduled_for).slice(0, 10) >= since && String(r.scheduled_for).slice(0, 10) < weekStart)
    .map(r => {
      const held = r.meta?.covers && typeof r.meta.covers === 'object' && !Array.isArray(r.meta.covers) ? Object.values(r.meta.covers) : []
      const covers = [...new Set(held.flatMap(v => (Array.isArray(v) ? v : [])).filter((x): x is string => typeof x === 'string'))]
      return { id: String(r.id), idea: String(r.idea || ''), state: r.state || null, scheduled_for: String(r.scheduled_for).slice(0, 10), series: r.lane_slot || null, covers }
    })
    .sort((a, b) => String(b.scheduled_for).localeCompare(String(a.scheduled_for)))
}

const ASK_WHAT: Record<Ask['state'], string> = {
  dismissed: 'you wrote on, then dismissed', style_only: 'you wrote on and routed to Study style (style used in an idea, or a topic)',
  piece: 'you wrote on; it already became a piece', routed: 'you wrote on and routed to Make a piece', open: 'you wrote on',
}

export function buildInspiration(input: { weekStart: string; items: Row[]; reads?: Row[]; moves?: Row[]; claims?: Row[];
  quotesStanding?: string[]; listedIdeas?: string[]; recentPieces?: Row[] }): InspirationBlock {
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

  const must_cover: InspirationBlock['must_cover'] = [
    ...routed.map(c => ({ id: c.id, what: `Inspiration card "${c.name}" you routed to Make a piece`, his_words: c.why_like || c.would_do || c.saved_why || null, endorsed: c.endorsed })),
    // A link he saved with his own words, not routed and not yet a piece: those words ask for something too.
    ...cards.filter(c => c.saved_why && !c.piece_id && !c.routes.includes('make_piece') && !c.routes.includes('study_style'))
      .sort(byNewest).map(c => ({ id: c.id, what: `Inspiration card "${c.name}" you saved with your words`, his_words: c.saved_why, endorsed: null })),
  ]
  // Every card he typed words on, dismissed and style-only included; a said card whose idea is already listed is
  // counted once, as that idea (twice). An id already owed above keeps its entry.
  const asks = buildAsks(input.weekStart, input.items.filter(r => !r.facets?.part_of), twice)
  const owed = new Set(must_cover.map(m => m.id))
  for (const a of asks) {
    if (owed.has(a.id)) continue
    const w = a.his_words
    must_cover.push({ id: a.id, what: `Inspiration card "${a.name}" ${ASK_WHAT[a.state]}${a.piece_id ? ` (piece ${a.piece_id})` : ''}`,
      his_words: [w.why_here, w.why_like, w.would_do].filter(Boolean).join(' / '), endorsed: null, ask: true, state: a.state,
      style_only: a.style_only, piece_id: a.piece_id })
  }
  const recent = buildRecent(input.weekStart, input.recentPieces || [])
  return {
    routed, study_style: studyStyle, liked, fresh, corpora, creators, claims, must_cover, asks, recent,
    counts: { routed: routed.length, study_style: studyStyle.length, liked: liked.length, fresh: fresh.length,
      corpora: corpora.length, creators: creators.length, claims: claims.length, asks: asks.length, recent: recent.length },
  }
}
