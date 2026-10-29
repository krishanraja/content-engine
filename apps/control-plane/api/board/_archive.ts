import type { SupabaseClient } from '@supabase/supabase-js'

// The board's Archive (W2.1; Krish, 2026-10-29: "backfill every piece we've done historically, and allow me to add a
// score out of 10 for narrative quality and production quality"): every piece published from the Launch on 6 October
// 2026, newest first, each with its date, series, title, live links and his scores. GET /api/board/<Monday>/archive is
// read-only; board_feed.py archive writes it beside the week's inputs and week_board.py --archive draws it. Only his
// scores are shown (piece_scores_current, which counts scored_by krish alone).

/** The first piece the engine published went out on 5 October 2026 and the Launch on 6 October; nothing older counts. */
export const ARCHIVE_FROM = '2026-10-05T00:00:00Z'
const SERIES = ['follow_the_money', 'under_the_hood', 'mind_the_gap'] as const
// The places a piece goes out, as making.py records them (meta.making.channels.<channel>.url), in the order he posts.
const CHANNEL_LABEL: Record<string, string> = {
  substack: 'Substack', youtube: 'YouTube', shorts: 'YouTube Shorts', tiktok: 'TikTok', reels: 'Instagram Reels',
  linkedin: 'LinkedIn', spotify: 'Spotify', feature_youtube: 'YouTube feature', feature_spotify: 'Spotify feature',
}

export interface ArchivePiece {
  id: string
  idea: string | null
  lane_slot: string | null
  scheduled_for: string | null
  published_at: string | null
  published_url: string | null
  meta: Record<string, any> | null
  transformed_outputs: Record<string, any> | null
}
export interface ArchiveScore { piece_id: string; basis: string; narrative: number; production: number; note: string | null; scored_at: string }
export interface ArchiveRow {
  piece_id: string
  date: string
  series: string | null
  title: string
  links: { label: string; url: string }[]
  scores: { at_publish?: Omit<ArchiveScore, 'piece_id' | 'basis'>; hindsight?: Omit<ArchiveScore, 'piece_id' | 'basis'> }
}

const https = (u: unknown): u is string => typeof u === 'string' && /^https:\/\/[^\s"<>]+$/.test(u) && u.length <= 2048

/** The Archive's rows from published pieces and his current scores: pure, newest first. */
export function archiveRows(pieces: readonly ArchivePiece[], scores: readonly ArchiveScore[]): ArchiveRow[] {
  const out: ArchiveRow[] = []
  for (const p of pieces) {
    const iso = (v: unknown) => v instanceof Date ? v.toISOString() : typeof v === 'string' ? v : null
    const at = iso(p.published_at) || iso(p.scheduled_for)
    if (!at || at < ARCHIVE_FROM.slice(0, at.length)) continue
    const title = [p.meta?.making?.pack?.headline, p.transformed_outputs?.youtube_package?.substack_title, p.idea]
      .find(t => typeof t === 'string' && t.trim()) as string | undefined
    const links: ArchiveRow['links'] = []
    const seen = new Set<string>()
    const add = (label: string, url: unknown) => { if (https(url) && !seen.has(url)) { seen.add(url); links.push({ label, url }) } }
    add('Substack', p.published_url)
    const channels = p.meta?.making?.channels
    if (channels && typeof channels === 'object') for (const [k, label] of Object.entries(CHANNEL_LABEL)) add(label, channels[k]?.url)
    const mine = scores.filter(s => s.piece_id === p.id)
    const pick = (basis: string) => {
      const s = mine.find(x => x.basis === basis)
      return s ? { narrative: s.narrative, production: s.production, note: s.note, scored_at: iso(s.scored_at) || '' } : undefined
    }
    const at_publish = pick('at_publish'), hindsight = pick('hindsight')
    out.push({
      piece_id: p.id, date: at.slice(0, 10),
      series: (SERIES as readonly string[]).includes(String(p.lane_slot)) ? String(p.lane_slot) : null,
      title: (title || 'Untitled').trim().slice(0, 300), links,
      scores: { ...(at_publish ? { at_publish } : {}), ...(hindsight ? { hindsight } : {}) },
    })
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || a.piece_id.localeCompare(b.piece_id))
}

// The score table comes with the Wave 2 migration batch (20261118090000_piece_scores.sql), applied after Krish's yes.
const MISSING_TABLE = new Set(['42P01', 'PGRST205'])

/** Read the Archive: published pieces and his scores. `scores` says whether the score table is there yet. */
export async function readArchive(db: SupabaseClient): Promise<{ rows: ArchiveRow[]; scores: 'live' | 'waits_on_migration' }> {
  const pieces = await db.from('content_ideas')
    .select('id, idea, lane_slot, scheduled_for, published_at, published_url, meta, transformed_outputs')
    .eq('state', 'published').is('buried_at', null).gte('published_at', ARCHIVE_FROM).limit(500)
  if (pieces.error) throw new Error('archive_unavailable')
  const scored = await db.from('piece_scores_current').select('piece_id, basis, narrative, production, note, scored_at').limit(5000)
  const missing = !!scored.error && MISSING_TABLE.has(String((scored.error as { code?: string }).code || ''))
  if (scored.error && !missing) throw new Error('archive_unavailable')
  return { rows: archiveRows((pieces.data || []) as ArchivePiece[], missing ? [] : (scored.data || []) as ArchiveScore[]), scores: missing ? 'waits_on_migration' : 'live' }
}
