// Clips routed to a piece (Krish, 2026-10-31: "route the two videos to it once they're read, so a new session knows
// they will need to be referenced with audio on during my video post production"). An Inspiration card he links to a
// piece (inspiration_items.piece_id) reaches every session that makes it: make-piece reads them all, and post-production
// cannot record a cut as finished while a clip his words say to play with its sound has no place in that cut.
//
// This file is the pure half. api/content-ideas/[id]/routed-clips.ts reads the cards and the making record and answers
// with presentClip and missingClips; scripts/post-pack/making.py reads that answer before `making.py <piece> video`.
//
// Nothing here invents a rule for him. A card linked to a piece is only a reference unless his own words on it, or the
// note a session relayed from his words, say to keep its sound. Only then is it `show_with_sound`, and only then is it
// a gate.

export const ROUTED_CLIP_COLS = 'id,name,kind,drive_file_id,read_as,why_here,would_do,note_for_claude,facets,dismissed_at,created_at'

/** How the cut uses a linked card: shown with its own sound (his words say so), or a reference the session reads. */
export type ClipUse = 'show_with_sound' | 'reference'

/** His words that ask for a clip's own sound in the cut: "keep the video and audio", "audio on", "with its sound". */
const SOUND_ON = /\b(keep\s+(the\s+)?(video\s+and\s+)?(audio|sound)|(audio|sound)\s+(is\s+)?on\b|with\s+(its|the|their)\s+(own\s+)?(audio|sound)\b)/i
/** Words that ask for the opposite win: "audio off", "mute it", "no sound", "without sound". */
const SOUND_OFF = /\b((audio|sound)\s+(is\s+)?off\b|mute(d)?\b|no\s+(audio|sound)\b|without\s+(the\s+|its\s+)?(audio|sound)\b)/i

const PLAYABLE = new Set(['video', 'audio'])

export interface RoutedClip {
  card_id: string
  name: string
  kind: string
  use: ClipUse
  /** The words that decided `use`, quoted, so a session can show him why. */
  because: string | null
  drive_file_id: string | null
  drive_url: string | null
  source_url: string | null
  read_as: string | null
  his_words: { why_here: string | null; would_do: string | null }
  note_for_claude: string | null
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null
}

/** Which of his words (or the relayed note) ask for the sound, unless any of them asks it off. */
export function clipUse(card: Record<string, any>): { use: ClipUse; because: string | null } {
  if (!PLAYABLE.has(String(card.kind || ''))) return { use: 'reference', because: null }
  const words = [text(card.why_here), text(card.would_do), text(card.note_for_claude)].filter((w): w is string => !!w)
  // The relayed note may say "never mute it" while asking for the sound: "never mute" is not a request to mute.
  const off = words.find(w => SOUND_OFF.test(w.replace(/\bnever\s+mute(d)?\b|\bdo\s+not\s+mute\b|\bdon'?t\s+mute\b/gi, '')))
  if (off) return { use: 'reference', because: off }
  const on = words.find(w => SOUND_ON.test(w))
  return on ? { use: 'show_with_sound', because: on } : { use: 'reference', because: null }
}

export function presentClip(card: Record<string, any>): RoutedClip {
  const facets = card.facets && typeof card.facets === 'object' ? card.facets : {}
  const link = facets.link && typeof facets.link === 'object' ? facets.link : {}
  const drive = text(card.drive_file_id)
  const { use, because } = clipUse(card)
  return {
    card_id: String(card.id),
    name: String(card.name || ''),
    kind: String(card.kind || ''),
    use,
    because,
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

/** Every clip his words say to play with its sound that a cut has not placed with its sound on, nor left out on his
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
