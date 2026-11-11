import type { VercelRequest, VercelResponse } from '@vercel/node'
import { guardCronRoute, guardEngine } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { withContentRun } from '../_runs.js'
import { makingStamp } from '../_making.js'
import { askChecksForPiece } from '../_controlCenter.js'
import { ASK_WITHIN_HOURS, PUBLICATION_ARCHIVE, WATCH_FROM, YOUTUBE_FEED, YOUTUBE_WATCH_FROM, matchPost, matchUpload, readPosts, readUploads, unmatchedItem, uploadWrite, type Candidate } from '../_publishWatch.js'

// GET (cron, hourly) or POST (an operator session): the publish watcher.
//
// Krish, 2026-10-11: board items "should really be chalked off automatically
// when we are done with a publish flow". The flow ends when the post is live
// on Substack, so the engine reads the publication's public archive (no key)
// and, for each post that matches one piece (_publishWatch.ts), marks the
// piece published: state, published_at, published_url, and, when the piece
// has a making record, the Substack tick on it. A piece already published
// with no published_url takes the address of the post that matched it, so
// the sweep's post_matched check can see the post question answered. This
// records a public fact; it publishes nothing, and it never unpublishes.
//
// A fresh post that matches no piece becomes one board item in progress for
// a session, held once, closes_on post_matched with the post's address; it is
// never put on Krish (nothing he can press answers it).
//
// The watcher closes no board item. Control Center's done-check sweep
// (api/_doneChecks.ts there, step 4) ends each by its kind from what this
// pass records: a piece's step or publish, a post question once a piece
// holds its address, and one no session touched for a week. Krish,
// 2026-10-11: "I am happy to Clear(complete)/Bump/Purge things off my lists
// as I go but the rest should be automatically done."

const PIECE_COLUMNS = 'id, idea, state, published_url, published_at, buried_at, meta, transformed_outputs, updated_at, scheduled_for'

async function handler(req: VercelRequest, res: VercelResponse) {
  // The cron's GET carries the cron secret; a session's POST, the engine key (or the dashboard's cookie).
  if (req.method === 'POST' ? guardEngine(req, res, ['POST']) : guardCronRoute(req, res)) return
  const now = new Date()
  let raw: unknown
  try {
    const r = await fetch(PUBLICATION_ARCHIVE, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15_000) })
    if (!r.ok) return res.status(502).json({ ok: false, error: `archive_unavailable: ${r.status}` })
    raw = await r.json()
  } catch (e: any) {
    return res.status(502).json({ ok: false, error: `archive_unreachable: ${String(e?.message || e).slice(0, 120)}` })
  }
  let read
  try { read = readPosts(raw) } catch (e: any) { return res.status(502).json({ ok: false, error: String(e?.message || e).slice(0, 160) }) }
  const posts = read.filter(p => p.posted_at >= WATCH_FROM)

  const { data, error } = await supabase.from('content_ideas').select(PIECE_COLUMNS)
    .in('state', ['drafting', 'review', 'approved', 'published']).is('buried_at', null).limit(800)
  if (error) return res.status(500).json({ ok: false, error: error.message })
  const pieces = (data || []) as Piece[]

  const report: Array<Record<string, unknown>> = []
  let published = 0, ambiguous = 0, held = 0
  for (const post of posts) {
    const m = matchPost(post, pieces)
    if (m.kind === 'ambiguous') { ambiguous++; report.push({ post: post.url, ambiguous: m.ids }); continue }
    if (m.kind === 'none') {
      const fresh = now.getTime() - Date.parse(post.posted_at) < ASK_WITHIN_HOURS * 3600_000
      if (post.type === 'newsletter' && fresh) {
        const item = unmatchedItem(post)
        const seen = await supabase.from('work_board_items').select('id').eq('id', item.id).maybeSingle()
        if (!seen.error && !seen.data) {
          const ins = await supabase.from('work_board_items').insert({ ...item, updated_by: 'engine: publish watcher', updated_at: now.toISOString() })
          if (!ins.error) held++
          // A refused question is said in the report, never dropped.
          else { report.push({ post: post.url, matched: null, question: item.id, held: false, note: `board_write_failed: ${ins.error.code || ''} ${ins.error.message || ''}`.trim().slice(0, 200) }); continue }
        }
      }
      report.push({ post: post.url, matched: null })
      continue
    }
    const piece = pieces.find(p => p.id === m.piece.id)!
    if (piece.state !== 'published') {
      const meta = piece.meta && typeof piece.meta === 'object' ? piece.meta : {}
      const stamp = now.toISOString()
      let nextMeta = meta
      if (meta.making && typeof meta.making === 'object') {
        const channels = { ...(meta.making.channels || {}) }
        if (!channels.substack) channels.substack = { url: post.url, posted_at: post.posted_at }
        nextMeta = { ...meta, making: { ...meta.making, channels, updated_at: makingStamp(meta.making, stamp), by: 'publish watcher' } }
      }
      const write = await supabase.from('content_ideas').update({
        state: 'published',
        published_at: piece.published_at || post.posted_at,
        published_url: piece.published_url || post.url,
        meta: nextMeta,
        updated_at: stamp,
      }).eq('id', piece.id).eq('updated_at', piece.updated_at).select('id')
      if (write.error || !write.data?.length) { report.push({ post: post.url, piece: piece.id, by: m.by, written: false, note: write.error?.message || 'the row changed; the next pass tries again' }); continue }
      piece.state = 'published'
      piece.meta = nextMeta
      piece.updated_at = stamp
      piece.published_at = piece.published_at || post.posted_at
      published++
      // The sweep looks at this piece's items now rather than at its next pass.
      await askChecksForPiece(piece.id)
    } else if (piece.published_url !== post.url) {
      // Already published, matched by the post a session recorded on it
      // (making.py <piece> posted substack <url>). The sweep's post_matched
      // check reads published_url, so an empty one takes the post's address;
      // one that names another address is kept and said.
      if (piece.published_url) { report.push({ post: post.url, piece: piece.id, by: m.by, written: false, note: `published under another address (${piece.published_url.slice(0, 120)}); kept` }); continue }
      const stamp = now.toISOString()
      const write = await supabase.from('content_ideas').update({
        published_url: post.url,
        published_at: piece.published_at || post.posted_at,
        updated_at: stamp,
      }).eq('id', piece.id).eq('updated_at', piece.updated_at).select('id')
      if (write.error || !write.data?.length) { report.push({ post: post.url, piece: piece.id, by: m.by, written: false, note: write.error?.message || 'the row changed; the next pass tries again' }); continue }
      piece.published_url = post.url
      piece.updated_at = stamp
    }
    report.push({ post: post.url, piece: piece.id, by: m.by, written: true })
  }

  // YouTube: record each recent upload on its piece (_publishWatch.ts, matchUpload). A feed that fails is reported in
  // the run, with its status, and changes nothing: the record keeps what it had.
  const youtube = await watchYoutube(pieces, now)
  return res.status(200).json({ ok: true, posts: posts.length, published, ambiguous, held, report, youtube })
}

type Piece = Candidate & { published_at: string | null; buried_at: string | null; updated_at: string }

async function watchYoutube(pieces: Piece[], now: Date) {
  let xml = ''
  // Bounded: two tries, then the run reports the failure; the hourly cron is the retry after that.
  for (let attempt = 0; attempt < 2 && !xml; attempt++) {
    try {
      const r = await fetch(YOUTUBE_FEED, { headers: { accept: 'application/atom+xml' }, signal: AbortSignal.timeout(10_000) })
      if (r.ok) xml = await r.text()
      else if (attempt === 1) return { ok: false, error: `youtube_feed_unavailable: ${r.status}` }
    } catch (e: any) {
      if (attempt === 1) return { ok: false, error: `youtube_feed_unreachable: ${String(e?.message || e).slice(0, 120)}` }
    }
  }
  const all = readUploads(xml)
  if (!all.length) return { ok: false, error: 'youtube_feed_empty_or_unreadable' }
  const uploads = all.filter(u => u.posted_at >= YOUTUBE_WATCH_FROM)
  const report: Array<Record<string, unknown>> = []
  let recorded = 0
  for (const up of uploads) {
    const m = matchUpload(up, pieces, all)
    if (m.kind !== 'one') { report.push({ video: up.url, kind: up.kind, matched: null, ...(m.kind === 'ambiguous' ? { ambiguous: m.ids } : {}) }); continue }
    const piece = pieces.find(p => p.id === m.piece.id)!
    const w = uploadWrite(up, piece)
    if ('skip' in w) { report.push({ video: up.url, kind: up.kind, piece: piece.id, by: m.by, written: false, note: w.skip }); continue }
    const stamp = now.toISOString()
    const making = piece.meta!.making
    const nextMeta = { ...piece.meta, making: { ...making, channels: { ...(making.channels || {}), [up.kind]: w.write }, updated_at: makingStamp(making, stamp), by: 'publish watcher' } }
    const write = await supabase.from('content_ideas').update({ meta: nextMeta, updated_at: stamp })
      .eq('id', piece.id).eq('updated_at', piece.updated_at).select('id')
    if (write.error || !write.data?.length) { report.push({ video: up.url, kind: up.kind, piece: piece.id, by: m.by, written: false, note: write.error?.message || 'the row changed; the next pass tries again' }); continue }
    piece.meta = nextMeta; piece.updated_at = stamp; recorded++
    report.push({ video: up.url, kind: up.kind, piece: piece.id, by: m.by, written: true })
  }
  return { ok: true, uploads: uploads.length, history_left: all.length - uploads.length, recorded, report }
}

export default withContentRun('publish_watch', handler)
