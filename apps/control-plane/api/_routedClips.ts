// Clips routed to a piece (Krish, 2026-10-31: "route the two videos to it once they're read, so a new session knows
// they will need to be referenced with audio on during my video post production"). An Inspiration card he links to a
// piece (inspiration_items.piece_id) reaches every session that makes it: make-piece reads them all before the
// creative direction, and post-production is told, loudly, of each clip he asked to play with its own sound that a cut
// has not placed.
//
// This file is the pure half. api/content-ideas/[id]/routed-clips.ts reads the cards and the making record and answers
// with presentClip and missingClips; scripts/post-pack/making.py reads that answer (`clips`, and a warning on `video`).
//
// Nothing here guesses from text. A linked card is a `reference` until the making record holds his own quoted words
// asking for its sound (clip_uses, written by `making.py <piece> clips sound <card_id> --krish-words "Krish, ..."`).
// Whether a missing clip should stop a cut, rather than warn, is his call and not made here.

export const ROUTED_CLIP_COLS = 'id,name,kind,drive_file_id,read_as,why_here,would_do,note_for_claude,facets,dismissed_at,created_at'

/** How the cut uses a linked card: shown with its own sound (his recorded words), or a reference the session reads. */
export type ClipUse = 'show_with_sound' | 'reference'

/** His words deciding one card's use, on the making record (clip_uses). */
export interface ClipUseRecord {
  use: ClipUse
  said: string
  at: string
  by: string
}

export interface RoutedClip {
  card_id: string
  name: string
  kind: string
  use: ClipUse
  /** His words that set `use`, quoted; null while it is a reference by default. */
  said: string | null
  drive_file_id: string | null
  drive_url: string | null
  source_url: string | null
  read_as: string | null
  his_words: { why_here: string | null; would_do: string | null }
  /** A session's note on the card: guidance, never his words. */
  note_for_claude: string | null
}

const PLAYABLE = new Set(['video', 'audio'])

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

export function presentClip(card: Record<string, any>, uses?: Record<string, ClipUseRecord> | null): RoutedClip {
  const facets = card.facets && typeof card.facets === 'object' ? card.facets : {}
  const link = facets.link && typeof facets.link === 'object' ? facets.link : {}
  const drive = text(card.drive_file_id)
  const held = uses && typeof uses === 'object' ? uses[String(card.id)] : undefined
  // Only a playable card can be played with its sound; an image keeps its record but stays a reference.
  const use: ClipUse = held && held.use === 'show_with_sound' && PLAYABLE.has(String(card.kind || '')) ? 'show_with_sound' : 'reference'
  return {
    card_id: String(card.id),
    name: String(card.name || ''),
    kind: String(card.kind || ''),
    use,
    said: held ? text(held.said) : null,
    drive_file_id: drive,
    drive_url: drive ? `https://drive.google.com/file/d/${drive}/view` : null,
    source_url: text(link.url),
    read_as: text(card.read_as),
    his_words: { why_here: text(card.why_here), would_do: text(card.would_do) },
    note_for_claude: text(card.note_for_claude),
  }
}

/** One clip's place in one cut, as the making record keeps it (clip_placements). */
export interface ClipPlacement {
  at_s?: number
  end_s?: number
  audio?: 'on' | 'off'
  /** Leaving it out of this cut, or playing it silent, takes his words: "Krish, YYYY-MM-DD: ...". */
  omitted?: boolean
  said?: string
  at: string
  by: string
}

/** Every clip his words ask to play with its sound that a cut has not placed with its sound on, nor left out on his
 *  words. A placement with audio off counts only with his words. */
export function missingClips(clips: RoutedClip[], placements: Record<string, ClipPlacement> | null | undefined): RoutedClip[] {
  const held = placements && typeof placements === 'object' ? placements : {}
  return clips.filter(c => {
    if (c.use !== 'show_with_sound') return false
    const p = held[c.card_id]
    if (!p) return true
    if (p.omitted || p.audio === 'off') return !(typeof p.said === 'string' && /^Krish\b/.test(p.said))
    return p.audio !== 'on'
  })
}
