// The reading brief for a folder full of screenshots.
//
// Carried across from the n8n sweep's Build Extraction Prompt node, which is
// the one part of that lane worth keeping exactly: the pillar bar, the evidence
// floor, the anti-pattern floor, the ALREADY SAID novelty floor and the
// paraphrase rejection were all learned from output Krish rejected. Rewriting
// them from memory would have quietly lowered the bar.
//
// Two things are new. The model is asked for the post's own URL when it is
// visible in the screenshot, because that is what makes a re-screenshot dedupe
// (see storyUrl in _scan.ts). And the creator block asks for the transferable
// MOVE rather than the post, which is what capability B will read.
//
// Pure: every input is an argument. Nothing here reads the database.

export interface Pillar {
  id: string
  name: string
  description?: string
  good_looks_like?: { voice?: string; source_patterns?: string; angle_patterns?: string; good_examples?: string }
  anti_patterns?: string[]
  evidence_required?: string[]
}

export interface CreatorRow { name: string; linkedin_slug?: string | null; why: string }
export interface YieldRow { newsletter_key: string; seeds: number; advanced: number; buried: number; recurrences: number }

export interface PromptInput {
  brief: string
  pillars: Pillar[]
  creators: CreatorRow[]
  recentAngles: string[]
  sourceYield: YieldRow[]
  minBrandFit: number
  imageCount: number
  pdfCount: number
  docCount: number
}

function pillarsBlock(pillars: Pillar[]): string {
  return pillars.map(p => {
    const gl = p.good_looks_like || {}
    const ap = (p.anti_patterns || []).map(x => `  - ${x}`).join('\n')
    const er = (p.evidence_required || []).map(x => `  - ${x}`).join('\n')
    return `### ${p.name} (id: ${p.id})\n`
      + `**Description:** ${p.description || ''}\n`
      + `**Voice:** ${gl.voice || ''}\n`
      + `**Source patterns:** ${gl.source_patterns || ''}\n`
      + `**Angle patterns:** ${gl.angle_patterns || ''}\n`
      + `**Good examples:** ${gl.good_examples || ''}\n`
      + `**Anti-patterns (REJECT if matched):**\n${ap}\n`
      + `**Evidence required (at least one must be present):**\n${er}`
  }).join('\n\n')
}

export function buildSystemPrompt(input: PromptInput): string {
  const creatorsBlock = input.creators.length
    ? input.creators.map(c => `- ${c.name}${c.linkedin_slug ? ` (${c.linkedin_slug})` : ''}: ${c.why}`).join('\n')
    : '(no curated creators on record)'
  const recentBlock = input.recentAngles.length
    ? input.recentAngles.map(a => `- ${a}`).join('\n')
    : '(no prior angles on record)'
  const trackBlock = input.sourceYield.length
    ? input.sourceYield.map(r => `- ${r.newsletter_key}: ${r.seeds} seeds, ${r.advanced} advanced to drafting or beyond, ${r.buried} buried, ${r.recurrences} recurrences`).join('\n')
    : '(no history yet)'

  return (input.brief ? `AGENT BRIEF:\n${input.brief}\n\n---\n\n` : '')
    + 'You are reading raw inspiration Krish saved to a Drive folder: screenshots (mostly LinkedIn posts), PDFs and text documents. Extract publish-ready content seeds mapped to one of Krish five pillars. The bar is high. Most input does NOT contain a seed worth surfacing. If nothing qualifies, return an empty array [].\n\n'
    + `## KRISH PILLARS\n\n${pillarsBlock(input.pillars)}\n\n`
    + '## KRISH VOICE RULES\n'
    + '- Declarative and specific. No hedging.\n'
    + '- Real numbers, real artifacts, real anecdotes.\n'
    + '- One sharp thought per piece. No bullet-soup.\n'
    + '- NO em dashes anywhere. Use commas, colons, parentheses, or line breaks.\n'
    + '- Plain English. Banned: leveraging, unlocking, delve into, fast-paced world, navigating, robust, synergies.\n\n'
    + '## THE BAR\n'
    + `Score each candidate brand_fit_score 1-10. Auto-reject below ${input.minBrandFit}. Promote to researching at 9-10.\n`
    + '- 10: Krish exact voice; novel thesis with real artifact; clear distribution lane; perfect pillar fit.\n'
    + '- 9: Strong fit, original angle, satisfies pillar evidence_required, no anti-pattern triggers.\n'
    + '- 8: Plausible content needs one more piece of evidence.\n'
    + '- 7: Real candidate but generic in places.\n'
    + '- 6: Borderline. Surface but flag.\n'
    + '- <=5: Drop. Set is_idea=false.\n\n'
    + '## EVIDENCE FLOOR\n'
    + 'Reject any seed that does not satisfy its pillar evidence_required list. List evidence in evidence_present array.\n\n'
    + '## ANTI-PATTERN FLOOR\n'
    + 'Reject any seed whose framing matches any of the pillar anti_patterns. Score <=4 if it does.\n\n'
    + `## SOURCE TRACK RECORD\n${trackBlock}\n`
    + 'Seeds from sources whose output keeps getting buried need a HIGHER bar. Sources whose seeds advance to drafting deserve closer reading.\n\n'
    + `## CREATORS KRISH RATES (curated, from content_creators)\n${creatorsBlock}\n`
    + 'When a screenshot is a post BY one of these people, treat it as prized inspiration and raise attention, not the bar. Extract the transferable MOVE: hook type, structure, any named concept, proof pattern, CTA type. Frame the seed as Krish own differentiated take on that move applied to his world, never a restatement of the post. A seed that paraphrases the post is a REJECT: is_idea=false, rejection_reason="paraphrase". Always fill poster_name and poster_handle for these, and name the borrowed move in the thesis.\n\n'
    + `## ALREADY SAID (hard novelty floor)\nThese are the angles already produced in the last 60 days:\n${recentBlock}\n\n`
    + 'A seed that restates any of them is a REJECT, not a variation. Rephrasing the same claim with different numbers, different companies, or a different headline is still the same angle. Set is_idea=false and rejection_reason="duplicate_angle" for those. A seed may revisit a subject already covered ONLY if it makes a claim the earlier piece did not: new evidence, a reversal, a second-order consequence, or a named counter-example. Say which in the thesis.\n\n'
    + '## TEMPORAL CLASS\n'
    + '- ephemeral: a single event (one launch, one funding round, one benchmark result). Worth an opinion this week, dead in two.\n'
    + '- developing: a storyline still unfolding across weeks; evidence is accumulating.\n'
    + '- durable: a structural change in how AI-first businesses operate; still true next quarter.\n'
    + 'Set expires_in_days honestly: ephemeral 5-14, developing 21-45, durable null.\n\n'
    + '## THE POST URL MATTERS\n'
    + 'For every screenshot, read any visible URL, permalink, or post address for the ORIGINAL post and return it as source_url. This is how the same post screenshotted twice is recognised as one idea rather than two. If no URL is visible in the image, set source_url to null and say so; do NOT invent one, do NOT guess a profile URL, and do NOT return the Drive link.\n\n'
    + '## OUTPUT\n'
    + 'Strict JSON array. No preamble, no markdown fence.\n'
    + '[\n'
    + '  {\n'
    + '    "is_idea": true,\n'
    + '    "idea": "headline-style framing in Krish voice (12+ chars)",\n'
    + '    "thesis": "1-2 sentences. Why this lands now.",\n'
    + '    "pillar_id": "pillar:agentic_ops",\n'
    + '    "distribution": ["linkedin", "newsletter"],\n'
    + '    "brand_fit_score": 9,\n'
    + '    "confidence": 0.9,\n'
    + '    "quality_score": "green",\n'
    + '    "temporal_class": "ephemeral | developing | durable",\n'
    + '    "expires_in_days": 10,\n'
    + '    "source_label": "the filename or the post author",\n'
    + '    "source_url": "the ORIGINAL post url if visible in the image, else null",\n'
    + '    "source_excerpt": "<=280 chars of the transcribed content",\n'
    + '    "evidence_present": ["named entity: X", "figure: $Y", "date: Z"],\n'
    + '    "image_source": "the filename this came from",\n'
    + '    "poster_name": null,\n'
    + '    "poster_handle": null,\n'
    + '    "rejection_reason": null\n'
    + '  }\n'
    + ']\n\n'
    + 'If nothing qualifies, return [].'
}

export interface ContentBlock { type: string; [k: string]: unknown }
export interface ReadableDoc { name: string; body: string; url: string }
export interface ReadableBinary { name: string; mime_type: string; base64: string; url: string }

/** The user turn: one text block naming what is attached, then the images and
 *  PDFs as native blocks. Filenames are repeated after each attachment because
 *  the model has to be able to say which file a seed came from. */
export function buildUserContent(docs: ReadableDoc[], images: ReadableBinary[], pdfs: ReadableBinary[]): ContentBlock[] {
  const docsBlock = docs.length === 0
    ? '(no inspiration text docs in this run)'
    : docs.map((d, i) => `--- DOC ${i + 1} ---\nFILE: ${d.name}\nURL: ${d.url}\nBODY:\n${d.body}`).join('\n\n')

  const out: ContentBlock[] = [{
    type: 'text',
    text: `=== INSPIRATION TEXT DOCS ===\n${docsBlock}\n\n`
      + `=== INSPIRATION IMAGES / PDFs ===\n${images.length + pdfs.length === 0 ? '(none)' : `Filenames: ${[...images, ...pdfs].map(x => x.name).join(', ')}`}\n\n`
      + 'Extract seeds now. Strict JSON array only.',
  }]
  for (const img of images) {
    out.push({ type: 'image', source: { type: 'base64', media_type: img.mime_type, data: img.base64 } })
    out.push({ type: 'text', text: `(above image: ${img.name})` })
  }
  for (const pdf of pdfs) {
    out.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdf.base64 } })
    out.push({ type: 'text', text: `(above PDF: ${pdf.name})` })
  }
  return out
}
