import { materialsContext, readMaterials } from './_content.js'

// What a piece was written from: everything curation left on the row.
//
// Moved out of the draft route on 2026-09-24 because the draft judges need the
// same thing. Until then the draft gate's evidence judge was asked to grade
// the evidence of a piece while seeing none of the sources it was written
// from, so it trusted a draft with no sources (9 on the walk's first draft)
// and called a fully sourced one invented (3 on the eighth). Found on the
// three-piece walk (docs/walks/2026-09-three-piece-walk.md, H9).

const strings = (v: unknown, cap = 20): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, cap) : []

/** The curation context, as a model will see it. Exported so a test can
 *  check that nothing curation wrote is silently dropped. `budget` widens the
 *  materials allowance for a reader that must check evidence rather than
 *  write from it. */
export function curationBlock(
  row: { idea: string | null; thesis: string | null; meta: Record<string, any> | null },
  instruction: string | null,
  budget?: { perItem: number; total: number },
): string {
  const meta = row.meta || {}
  const expansion = meta.ladder?.expansion || {}
  const parts: string[] = []
  parts.push(`THE SEED, as it arrived:\n${[row.idea, row.thesis].filter(Boolean).join('\n\n')}`)
  if (typeof expansion.angle === 'string' && expansion.angle.trim()) {
    const parties = strings(expansion.parties, 8)
    parts.push(`THE ANGLE THE PANEL JUDGED, which is the argument to write:\n${expansion.angle.trim()}${parties.length ? `\nParties with a stake: ${parties.join('; ')}` : ''}`)
  }
  if (typeof meta.contrarian === 'string' && meta.contrarian.trim()) {
    parts.push(`THE COUNTER-CASE, which the piece must meet fairly rather than ignore:\n${meta.contrarian.trim()}`)
  }
  const stories = Array.isArray(meta.adjacent_stories) ? meta.adjacent_stories.slice(0, 8) : []
  if (stories.length) {
    parts.push('SOURCES ON FILE. Cite only these, or the research below, by publication name; where the record stops, say so:\n' +
      stories.map((s: any) => `- ${s?.title || 'untitled'} (${s?.published_date_iso || 'undated'}) ${s?.url || ''}\n  ${s?.why_relevant || ''}`).join('\n'))
  }
  const research = meta.research
  if (Array.isArray(research) && research.length) {
    parts.push('RESEARCH:\n' + research.slice(0, 12).map((r: any) => typeof r === 'string' ? `- ${r}` : `- ${r?.title || ''} ${r?.url || ''} ${r?.summary || r?.text || ''}`.trim()).join('\n'))
  } else if (typeof research === 'string' && research.trim()) {
    parts.push(`RESEARCH:\n${research.trim().slice(0, 6000)}`)
  }
  const mats = budget ? materialsContext(readMaterials(meta), budget.perItem, budget.total) : materialsContext(readMaterials(meta))
  if (mats) parts.push(`MATERIALS:\n${mats}`)
  const notes = Array.isArray(meta.krish_notes) ? meta.krish_notes.filter((n: any) => typeof n?.note === 'string') : []
  if (notes.length) {
    parts.push("KRISH'S NOTES ON THIS PIECE, in his own words:\n" + notes.map((n: any) => `- "${n.note.trim()}"`).join('\n'))
  }
  if (instruction) parts.push(`KRISH'S DIRECTION FOR THIS DRAFT:\n${instruction}`)
  return parts.join('\n\n')
}
