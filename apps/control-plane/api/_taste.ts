// What Krish has confirmed he likes, for the writers.
//
// The taste ledger (krishanraja/inspirationhouse) proposes claims about his
// taste; he approves, rewords or rejects each one on the board's lessons card.
// This reads the approved ones live from taste_profile_form, which holds form
// claims only (how a piece is made, never what it is about), so taste can shape
// the writing without ever pushing a topic up the slate (the anti-echo rule).
//
// Drafting and revising only. A judge, ranker or scorer must never read this:
// scripts/check-taste-reader.ts fails CI if one does.
//
// It fails quiet by design: no claims, or an unreadable store, returns '' and
// the prompt is exactly what it was before the ledger existed.

export type TasteLane = 'voice' | 'strategy' | 'production' | 'visibility'

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
      .in('lane', lanes)
      .order('confidence', { ascending: false })
      .limit(MAX_CLAIMS)
    if (error || !data) return ''
    return renderTasteBlock(data as Array<Record<string, unknown>>)
  } catch {
    return ''
  }
}
