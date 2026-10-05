import { supabase } from './_supabase.js'

// The live subchannels, read from the database rather than copied into code.
//
// venture_formats holds each subchannel's slug, label and mandate, and
// format_aliases maps the retired spellings (paid, money_of_ai, built,
// built_with_ai) to the live slug. Both are the authority. Before 2026-09-24
// every drafting-class stage in this repo spoke only the retired keys, and the
// final-pass rubrics were hand-written copies of mandates that were rewritten
// on 2026-09-17, so an under.the.hood piece would have been graded against a rule
// ("Krish built it or watched it being built") that its own mandate forbids.
//
// research-topic.ts keeps a small in-code copy of the alias map and says this
// module is the real fix. New stages read from here.

export interface Subchannel {
  slug: string
  label: string
  mandate: string
}

/** The three publication subchannels. Only these carry a drafting mandate;
 *  `general` is the holding lane and never a destination for a piece. */
export const LIVE_SUBCHANNELS = ['follow_the_money', 'mind_the_gap', 'under_the_hood'] as const

/**
 * Resolve a stored slot (live slug or retired alias) to its live subchannel,
 * with the mandate as the database holds it now. Null when the value names no
 * live subchannel, which a caller must treat as "not routed yet", never as a
 * default.
 */
export async function loadSubchannel(value?: string | null): Promise<Subchannel | null> {
  const v = String(value || '').trim()
  if (!v) return null
  let slug = v
  if (!(LIVE_SUBCHANNELS as readonly string[]).includes(slug)) {
    const { data: alias } = await supabase.from('format_aliases').select('slug').eq('alias', v).maybeSingle()
    slug = (alias as { slug?: string } | null)?.slug || ''
    if (!(LIVE_SUBCHANNELS as readonly string[]).includes(slug)) return null
  }
  const { data } = await supabase
    .from('venture_formats')
    .select('slug, label, mandate, active')
    .eq('slug', slug)
    .maybeSingle()
  const row = data as { slug: string; label: string | null; mandate: string | null; active: boolean | null } | null
  if (!row || row.active === false || !row.mandate) return null
  return { slug: row.slug, label: row.label || row.slug, mandate: row.mandate }
}
