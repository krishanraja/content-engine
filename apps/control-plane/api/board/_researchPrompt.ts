import type { ModelItem, WeekModel } from './_weekModel.js'
import type { ViewMaterial } from './_writeBack.js'

// The Perplexity research prompt beside every piece's Claude production prompt (Ruling, Krish, 2026-11-17: "There should
// probably just be a Perplexity research prompt button that gathers everything we've gotten to date (including my latest
// comments if I've just made some in the box above) and turns that into a Perplexity research prompt instead of a Claude
// production prompt"; "Every prompt created for Claude or Perplexity should leave the new session with nothing to
// assume, and it should also close the loop on updating the board, the drive, and everything else as it goes").
//
// Perplexity cannot report to the board or file anything, so this prompt carries everything it needs in its own words
// (the publication, the piece, the signed story, what is already on file, his notes) and closes the loop through its
// answer: one Markdown document that starts with the piece's id line, which he drops on the piece with Paste research,
// where it is filed as research and copied into his Research library in Drive by itself.

export const PERPLEXITY_LABEL = 'Perplexity research prompt'
export const RESEARCH_NOTES_HEADING = "Krish's latest notes, in his own words (typed on the board just now). They come first: research what they ask before anything else."
/** The most of the signed story the prompt carries. */
const LOCK_CHARS = 8000
/** The most research already on file it lists. */
const ON_FILE_MAX = 30

export interface ResearchContext {
  item: Pick<ModelItem, 'title' | 'date' | 'line' | 'piece_id' | 'read'>
  series: string | null
  dayLabel: string
  lock: string | null
  materials: ViewMaterial[]
  saved: Array<{ at: string; text: string }>
}

const clean = (s: string) => s.replace(/—/g, ',').replace(/\s+\n/g, '\n').trim()

/** The prompt, self-contained: nothing in it assumes Perplexity has seen anything before. */
export function researchPromptFor(c: ResearchContext): string {
  const r = c.item.read
  const story = [r.so_what && `The point: ${r.so_what}`, r.story && `The story so far: ${r.story}`, r.why_now && `Why now: ${r.why_now}`,
    r.fact && `The fact it stands on: ${r.fact}`].filter(Boolean).join('\n')
  const lock = c.lock ? clean(c.lock.split('\n').filter(l => !/^Signed by Krish|^piece_id:/i.test(l.trim())).join('\n')).slice(0, LOCK_CHARS) : null
  const seen = new Set<string>()
  const onFile = c.materials.filter(m => ['research', 'corpus', 'note', 'paste', 'file', 'link', 'pdf'].includes(m.kind) && m.role !== 'krish_notes')
    .filter(m => { const k = m.title.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
    .slice(0, ON_FILE_MAX).map(m => `- ${m.title} (${m.kind}${m.at ? `, ${m.at.slice(0, 10)}` : ''})`)
  const sources = r.sources.slice(0, 15).map(s => `- ${s.label}${s.href ? `: ${s.href}` : ''}`)
  const notes = c.saved.map(n => `- ${n.at ? `${n.at.slice(0, 10)}: ` : ''}${n.text}`)
  return [
    'You are doing deep research for one piece of Make Your Mind Up, Krish Raja\'s publication about what AI is really doing to '
      + 'business, written for leaders who must decide what to do about it. You have no other context: everything you need is below.',
    `The piece: "${c.item.title}", published ${c.dayLabel} (${c.item.date})${c.series ? ` in the ${c.series} series` : ''}. Where it stands: ${c.item.line}`,
    story,
    lock ? `The story Krish signed, which the research must serve (its claims need evidence; if the evidence says otherwise, say so first):\n\n${lock}` : '',
    sources.length ? `Sources already found:\n${sources.join('\n')}` : '',
    onFile.length ? `Research already on file for this piece (do not repeat it; go past it, and correct it where it is wrong):\n${onFile.join('\n')}` : '',
    notes.length ? `Krish's earlier notes on this piece, newest first:\n${notes.join('\n')}` : '',
    'What to find: what is new, missing or wrong in what is on file. Use primary sources: company filings, earnings calls, regulators, '
      + 'the companies\' own pages and named reporting. Give every figure its date, its source and a link, mark every estimate as one, '
      + 'and say plainly where sources disagree. Look for the concrete, human examples a viewer would remember.',
    'How to answer: one Markdown document. Its first line is exactly:\n'
      + `piece_id: ${c.item.piece_id}\n`
      + 'Then: the five findings that matter most to this story, each in two sentences with its source; the detail under headings; a table '
      + 'of the numbers that matter with their dates and sources; what would change the story; and every source as a list of links at the '
      + 'end. Plain English, no padding. Krish files the whole answer on the piece, where it is kept as research in his library.',
  ].filter(Boolean).join('\n\n')
}

type PromptLike = { kind: string; label: string; prompt?: string; tool?: string; notes?: { ask: string; heading: string; save?: unknown; saved?: unknown } }

/** Beside each piece's Claude production prompt, its Perplexity research prompt, sharing the same notes box and save. */
export function withResearchPrompts(model: WeekModel, contextOf: (day: string, item: ModelItem) => Omit<ResearchContext, 'item'> | null): WeekModel {
  for (const d of model.days) {
    for (const it of d.items) {
      if (it.type !== 'piece' || !it.piece_id) continue
      const claude = [it.next, ...it.others].find(a => a && a.kind === 'prompt' && (a as PromptLike).tool !== 'perplexity') as PromptLike | undefined
      if (!claude?.notes || [it.next, ...it.others].some(a => a && (a as PromptLike).tool === 'perplexity')) continue
      const ctx = contextOf(d.day, it)
      if (!ctx) continue
      const action = { kind: 'prompt', label: PERPLEXITY_LABEL, tool: 'perplexity', prompt: researchPromptFor({ item: it, ...ctx }),
        notes: { ask: claude.notes.ask, heading: RESEARCH_NOTES_HEADING, ...(claude.notes.save ? { save: claude.notes.save } : {}) } }
      const at = it.others.indexOf(claude as never)
      if (at >= 0) it.others.splice(at + 1, 0, action as never)
      else it.others.push(action as never)
    }
  }
  return model
}
