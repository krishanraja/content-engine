// The publish watcher's pure half: which piece a live Substack post is.
//
// Krish publishes by hand in Substack. Until 2026-10-11 nothing told the
// engine, so no piece was ever marked published and nothing that waited on
// a publish (the board, the strip, the learning) ever moved. The watcher
// reads the publication's public archive and matches each post to a piece:
//
//   1. by address: the piece's published_url, or the Substack link on its
//      making record (making.py <id> posted substack <url>), is the post's;
//   2. by title: the post's title equals, letter for letter once spacing,
//      case and punctuation are set aside, the piece's idea, its packaged
//      Substack title (transformed_outputs.youtube_package.substack_title),
//      or the headline its pack carried (meta.making.pack.headline);
//   3. by schedule (W2.1, 29 October 2026): an article whose title Krish
//      changed in Substack matches the one piece that was made (it has a
//      making record), is not published yet, and was due on the post's day
//      or up to three days before it. The record of 16, 21, 23 and 26 October
//      fell behind because every one of those posts went out under a new
//      title and no session answered the question each raised, so a renamed
//      post now matches its piece by when it was due, never by guesswork:
//      two such pieces are ambiguous and write nothing.
//
// One match writes; two are ambiguous and write nothing; none is reported.
// A title Krish changed in Substack at the last minute matches nothing, and
// the board then holds one item for a session, once: which piece it is. It
// is not on Krish, because nothing he can press answers it and it would not
// say how it closes; it closes itself (post_matched, Control Center's
// done-check sweep) once a session records the post on its piece and the
// watcher matches the post by address, and one no session touches for a
// week is let go by the same sweep.

export const PUBLICATION_ARCHIVE = 'https://home.makeyourmindup.ai/api/v1/archive?sort=new&limit=25'
/** Posts older than this are history the engine never tracked; the first piece it made went out on 5 October 2026. */
export const WATCH_FROM = '2026-10-05T00:00:00Z'
/** An unmatched post becomes a board question only while it is fresh. */
export const ASK_WITHIN_HOURS = 72
/** A renamed article matches the made piece that was due on its day or up to this many days before it. */
export const SCHEDULE_DAYS = 3

export interface Post { id: number; title: string; url: string; posted_at: string; type: string }
export interface Candidate {
  id: string
  idea: string | null
  state: string
  published_url: string | null
  meta: Record<string, any> | null
  transformed_outputs: Record<string, any> | null
  /** The day it was due (YYYY-MM-DD), for a match by schedule. */
  scheduled_for?: string | null
}

export function normTitle(s: string | null | undefined): string {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[‘’“”]/g, '').replace(/[^a-z0-9$]+/g, ' ').trim()
}

export function readPosts(raw: unknown): Post[] {
  if (!Array.isArray(raw)) return []
  const out: Post[] = []
  for (const p of raw as Array<Record<string, unknown>>) {
    const url = typeof p.canonical_url === 'string' ? p.canonical_url : ''
    const title = typeof p.title === 'string' ? p.title : ''
    const at = typeof p.post_date === 'string' ? p.post_date : ''
    if (!/^https:\/\//.test(url) || !title || Number.isNaN(Date.parse(at))) continue
    out.push({ id: Number(p.id) || 0, title, url, posted_at: at, type: typeof p.type === 'string' ? p.type : 'newsletter' })
  }
  return out
}

function titlesOf(c: Candidate): string[] {
  return [
    c.idea,
    c.transformed_outputs?.youtube_package?.substack_title,
    c.meta?.making?.pack?.headline,
  ].map(normTitle).filter(Boolean)
}

function addressesOf(c: Candidate): string[] {
  return [c.published_url, c.meta?.making?.channels?.substack?.url].filter((u): u is string => typeof u === 'string' && u.length > 0)
}

export type Match = { kind: 'one'; piece: Candidate; by: 'address' | 'title' | 'schedule' } | { kind: 'none' } | { kind: 'ambiguous'; ids: string[] }

/** Whether a made, unpublished piece was due on the post's day or up to SCHEDULE_DAYS before it. */
function dueFor(post: Post, c: Candidate): boolean {
  const due = typeof c.scheduled_for === 'string' ? Date.parse(`${c.scheduled_for.slice(0, 10)}T00:00:00Z`) : NaN
  const day = Date.parse(`${post.posted_at.slice(0, 10)}T00:00:00Z`)
  if (Number.isNaN(due) || Number.isNaN(day) || c.state === 'published' || !c.meta?.making) return false
  const days = (day - due) / 86_400_000
  return days >= 0 && days <= SCHEDULE_DAYS
}

export function matchPost(post: Post, pieces: readonly Candidate[]): Match {
  const byAddress = pieces.filter(c => addressesOf(c).includes(post.url))
  if (byAddress.length === 1) return { kind: 'one', piece: byAddress[0], by: 'address' }
  if (byAddress.length > 1) return { kind: 'ambiguous', ids: byAddress.map(c => c.id) }
  // A video post (type "podcast") goes out under its own title; it never
  // matches by a title that happens to resemble the article's. A video-only
  // piece (no article) still matches by schedule below, and a video that
  // goes out beside its article finds that piece published already.
  if (post.type === 'newsletter') {
    const t = normTitle(post.title)
    const byTitle = pieces.filter(c => titlesOf(c).includes(t))
    if (byTitle.length === 1) return { kind: 'one', piece: byTitle[0], by: 'title' }
    if (byTitle.length > 1) return { kind: 'ambiguous', ids: byTitle.map(c => c.id) }
  }
  const bySchedule = pieces.filter(c => dueFor(post, c))
  if (bySchedule.length === 1) return { kind: 'one', piece: bySchedule[0], by: 'schedule' }
  if (bySchedule.length > 1) return { kind: 'ambiguous', ids: bySchedule.map(c => c.id) }
  return { kind: 'none' }
}

/** The board item for an unmatched post: in progress, for a session. */
export function unmatchedItem(post: Post) {
  return {
    id: unmatchedItemId(post),
    lane: 'in_progress' as const,
    rank: 5,
    area: 'Published',
    title: `Which piece is this post? ${post.title}`.slice(0, 200),
    detail: 'It went out on Substack, but its title matches no piece, so the engine cannot mark anything published or close the items waiting on it. '
      + 'A session works out which piece it is and records the post on it (making.py <piece id> posted substack <the post link>); '
      + 'this item then closes itself once the watcher\'s next hourly pass matches the post. If it is not a piece, leave it: '
      + 'untouched for a week, it is let go.',
    link: post.url,
    link_label: 'Open the post',
    // How it ends (step 4's done-check sweep): once a piece's published_url is this post.
    closes_on: 'post_matched' as const,
    close_ref: { url: post.url },
  }
}

/** The id of a post's board item: one question for each post. */
export function unmatchedItemId(post: Pick<Post, 'id'>): string {
  return `post-${post.id}`.slice(0, 80)
}
