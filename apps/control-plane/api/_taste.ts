// What Krish has confirmed he likes, for the writers.
//
// The taste ledger (krishanraja/inspirationhouse) proposes claims about his
// taste; he approves, rewords or rejects each one on the board's lessons card.
// This reads the approved ones live from taste_profile_form, Make Your Mind
// Up's only (TASTE_VENTURE), which holds form claims only (how a piece is
// made, never what it is about), so taste can shape the writing without ever
// pushing a topic up the slate (the anti-echo rule).
//
// Drafting and revising only. A judge, ranker or scorer must never read this:
// scripts/check-taste-reader.ts fails CI if one does.
//
// It fails quiet by design: no claims, or an unreadable store, returns '' and
// the prompt is exactly what it was before the ledger existed.

export type TasteLane = 'voice' | 'strategy' | 'production' | 'visibility'

// The ledger is keyed by venture (Krish, 2026-10-28: "The ledger is keyed by
// venture not repository. Makeyourmindup as a separate venture to mindmake").
// This repository is Make Your Mind Up's, whose venture_registry slug is
// 'publication', so every read of the ledger here is publication's and never
// another venture's: no fallback, no shared tier.
export const TASTE_VENTURE = 'publication'

// What a venture is called where Krish reads it. venture_registry's own
// display_name for publication is "Content", so the names are said here.
const VENTURE_LABELS: Record<string, string> = {
  publication: 'Make Your Mind Up',
  mindmake: 'Mindmake',
  heartside: 'Heartside',
  full_time: 'Full Time',
  legibility: 'Legibility',
  mm_ctrl: 'CTRL',
  fractionl_pulse: 'Pulse',
  fractionl_circle: 'Circle',
  signal_noise: 'Signal & Noise',
  investor: 'Investor',
}

/** A proposal's venture: scope.venture, or publication when it has none (every
 *  proposal filed before the ledger was keyed by venture is Make Your Mind Up's). */
export function proposalVenture(scope: unknown): string {
  const v = scope && typeof scope === 'object' ? (scope as Record<string, unknown>).venture : undefined
  return typeof v === 'string' && v.trim() ? v.trim() : TASTE_VENTURE
}

/** The plain name of a venture; a slug with no name here is shown as it is, never hidden. */
export function ventureLabel(slug: string): string {
  return Object.hasOwn(VENTURE_LABELS, slug) ? VENTURE_LABELS[slug] : slug
}

/** A proposal with its venture said: the slug and its plain name, beside the row as it was read. */
export function withVenture<T extends { scope?: unknown }>(p: T): T & { venture: string; venture_label: string } {
  const venture = proposalVenture(p.scope)
  return { ...p, venture, venture_label: ventureLabel(venture) }
}

const MAX_CLAIMS = 12

export function renderTasteBlock(rows: Array<{ statement?: unknown; means?: unknown; layer?: unknown }>): string {
  const lines = rows
    .filter(r => typeof r.statement === 'string' && r.statement.trim())
    .slice(0, MAX_CLAIMS)
    .map(r => {
      const layer = typeof r.layer === 'string' ? `[${r.layer}] ` : ''
      const means = typeof r.means === 'string' && r.means.trim() ? ` So: ${r.means.trim()}` : ''
      return `- ${layer}${String(r.statement).trim()}${means}`
    })
  if (!lines.length) return ''
  return [
    'Krish approved each of these himself. They are about craft, not topic: apply them to how you write, never to what you write about.',
    ...lines,
  ].join('\n')
}

export async function loadTasteBlock(lanes: TasteLane[]): Promise<string> {
  try {
    const { supabase } = await import('./_supabase.js')
    const { data, error } = await supabase
      .from('taste_profile_form')
      .select('statement, means, layer, confidence')
      .eq('venture', TASTE_VENTURE)
      .in('lane', lanes)
      .order('confidence', { ascending: false })
      .limit(MAX_CLAIMS)
    if (error || !data) return ''
    return renderTasteBlock(data as Array<Record<string, unknown>>)
  } catch {
    return ''
  }
}
