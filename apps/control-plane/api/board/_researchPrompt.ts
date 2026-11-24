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
//
// The research is the 5 Whys (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys; get rid of everything that
// suggests predictions, calls, dated, odds or scores). One sourced answer per Why, returned as a fenced why-ladder block
// (packages/contracts/src/whys.ts) right after the piece_id line, then the narrative. Paste research and Research it now
// read the block, check it rung by rung and keep it on the piece as meta.whys (_whys.ts). There is one research prompt:
// the day card's brief (_prompts.ts researchPrompt) is this one too.

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

/** Where Why 1 starts, by series (the plan's day table): each day asks its own first question. */
export const WHY_ONE: Readonly<Record<'follow_the_money' | 'under_the_hood' | 'mind_the_gap', { name: string; asks: string }>> = {
  follow_the_money: { name: 'follow.the.money', asks: 'who pays, and why the price moved. Follow the money: contracts, royalty splits, prices, '
    + 'and who ends up better or worse off.' },
  under_the_hood: { name: 'under.the.hood', asks: 'how it is built, and what broke. Open the thing up: how it works, what it is made of, '
    + 'what failed, and what is real and what is theatre.' },
  mind_the_gap: { name: 'mind.the.gap', asks: 'where the claim and the reality part. Put what is said beside what the evidence shows, '
    + 'and look for the pattern it repeats.' },
}

/** The series a name or id stands for ("follow.the.money", "follow_the_money", the retired money_of_ai), or null. */
export function seriesKey(series: string | null | undefined): keyof typeof WHY_ONE | null {
  const s = String(series || '').toLowerCase().replace(/[^a-z]+/g, '_').replace(/^_|_$/g, '')
  if (s === 'follow_the_money' || s === 'money_of_ai') return 'follow_the_money'
  if (s === 'under_the_hood' || s === 'built_with_ai') return 'under_the_hood'
  if (s === 'mind_the_gap') return 'mind_the_gap'
  return null
}

/** The ladder's shape as the answer must give it (packages/contracts/src/whys.ts, why-ladder/1). */
const ladderShape = (series: string) => '{"schema": "why-ladder/1", "question": "the piece\'s question, ending in ?", '
  + `"series": "${series}", "rungs": [`
  + '{"n": 1, "question": "Why ...?", "answer": "Because ... (60 words at most)", '
  + '"evidence": [{"url": "the full link to the source", "domain": "sec.gov", "date": "YYYY-MM-DD", "quote": "the source\'s own words, verbatim", "tier": "primary"}, '
  + '{"url": "the full link to a second source", "domain": "a-second-domain.com", "date": "YYYY-MM-DD", "quote": "...", "tier": "primary"}], '
  + '"strength": "documented", "counter": {"text": "the strongest competing explanation and its source"}, "mechanism_type": "pricing", "stop": null}], '
  + '"landing": {"shows": "what this shows, in one or two sentences", "open_question": "the question handed to the viewer?"}}'

/** Everything the one research prompt is built from, whichever press asks for it. */
export interface WhysPromptInput {
  pieceId: string
  title: string
  /** The day it publishes, as the board says it ("Mon 16 Nov (2026-11-16)"). */
  when: string
  series: string | null
  /** Where the piece stands on the board, when known. */
  where?: string | null
  /** What is known of the story so far, one line each ("The point: ..."). */
  story: string[]
  /** The signed story; its signature line and piece_id line are taken off here. */
  lock: string | null
  sources: string[]
  onFile: string[]
  notes: string[]
}

/** The one research prompt: the 5 Whys, one sourced answer per Why, returned as a fenced why-ladder block right after the
 *  piece_id line and then the narrative Markdown. The Perplexity prompt beside the Claude production prompt and the day
 *  card's research brief (Copy Perplexity prompt, Research it now) are both this prompt. */
export function whysResearchPrompt(c: WhysPromptInput): string {
  const key = seriesKey(c.series)
  const lock = c.lock ? clean(c.lock.split('\n').filter(l => !/^Signed by Krish|^piece_id:/i.test(l.trim())).join('\n')).slice(0, LOCK_CHARS) : null
  const fence = '```'
  return [
    'You are doing deep research for one piece of Make Your Mind Up, Krish Raja\'s publication about what AI is really doing to '
      + 'business, written for leaders who must decide what to do about it. You have no other context: everything you need is below.',
    `The piece: "${c.title}", published ${c.when}${c.series ? ` in the ${c.series} series` : ''}.${c.where ? ` Where it stands: ${c.where}` : ''}`,
    c.story.filter(Boolean).join('\n'),
    lock ? `The story Krish signed, which the research must serve (its claims need evidence; if the evidence says otherwise, say so first):\n\n${lock}` : '',
    c.sources.length ? `Sources already found:\n${c.sources.join('\n')}` : '',
    c.onFile.length ? `Research already on file for this piece (do not repeat it; go past it, and correct it where it is wrong):\n${c.onFile.join('\n')}` : '',
    c.notes.length ? `Krish's earlier notes on this piece, newest first:\n${c.notes.join('\n')}` : '',
    'How to research it: the 5 Whys. Start from the piece\'s question and ask why, then why again, one rung at a time, each answer '
      + 'joined to the one before by "because" or "but", never "and then". Five Whys is the target, not a rule: stop where the '
      + 'evidence runs out, even at the third, and never pad to five; seven at most.'
      + (key ? `\nWhere Why 1 starts, for ${WHY_ONE[key].name}: ${WHY_ONE[key].asks}` : ''),
    'For every Why:\n'
      + '- one answer in 60 words or fewer;\n'
      + '- at least two primary sources on different domains (company filings, earnings calls, regulators, court records, the '
      + 'companies\' own pages, named reporting), each with its link, its date and a verbatim quote that backs the answer;\n'
      + '- the strongest counter-evidence you found, with its source, or "none found" with the scope you searched (which sources, '
      + 'which dates);\n'
      + '- how strong the answer is: documented (the sources say it), inferred (the sources point to it) or open (nothing backs it yet);\n'
      + '- when the sources split, a branch: two answers, each with its own sources, joined by AND when both causes were needed or '
      + 'OR when they compete; follow the better-evidenced one and mark the other parked;\n'
      + '- a stop when the ladder should end there: evidence_exhausted (the evidence runs out), motive_not_mechanism (the answer is '
      + 'a motive, not how it works), restatement (it repeats an earlier Why), abstraction_drift (it drifts to something like '
      + '"because capitalism") or out_of_scope (it leaves the subject: name who owns that question). An open Why ends the ladder: '
      + 'never climb past it.\n'
      + 'When a Why lands on a person, ask how it made sense to them (their incentives and constraints), never who to blame. When '
      + 'an answer feeds back into an earlier Why, say "back to Why N": the loop can be the insight. Give every figure its date '
      + 'and its source, mark every estimate as one, and say plainly where sources disagree. Look for the concrete, human '
      + 'examples a viewer would remember.',
    'The landing, where the ladder ends: what this shows (the root insight, one or two sentences) and one open question handed '
      + 'to the viewer. Never a verdict, a forecast, odds, how sure anyone is, or a lesson for leaders.',
    'How to answer: one Markdown document. Its first line is exactly:\n'
      + `piece_id: ${c.pieceId}\n`
      + `Right after it, a fenced code block opened with ${fence}why-ladder and closed with ${fence}, holding the ladder as JSON in `
      + 'exactly this shape (one object per Why in "rungs"):\n'
      + ladderShape(key ?? 'the series id') + '\n'
      + 'In a rung, "counter" may instead be {"none_found_scope": "what you searched"}; a split Why adds "branch": {"join": "OR", '
      + '"answers": [{"answer": "...", "evidence": [...]}, {"answer": "...", "evidence": [...]}], "followed": 0}; "stop" is null '
      + 'or one of evidence_exhausted, motive_not_mechanism, restatement, abstraction_drift, out_of_scope, cap.\n'
      + 'Then the narrative in Markdown: each Why under its own heading with its sources, the counter-evidence, a table of the '
      + 'numbers that matter with their dates and sources, and every source as a list of links at the end. Plain English, no '
      + 'padding. Krish files the whole answer on the piece, where the ladder is read and checked rung by rung and the answer is '
      + 'kept as research in his library.',
  ].filter(Boolean).join('\n\n')
}

/** The prompt beside each piece's Claude production prompt, self-contained: nothing in it assumes Perplexity has seen
 *  anything before. */
export function researchPromptFor(c: ResearchContext): string {
  const r = c.item.read
  const story = [r.so_what && `The point: ${r.so_what}`, r.story && `The story so far: ${r.story}`, r.why_now && `Why now: ${r.why_now}`,
    r.fact && `The fact it stands on: ${r.fact}`].filter((x): x is string => Boolean(x))
  const seen = new Set<string>()
  const onFile = c.materials.filter(m => ['research', 'corpus', 'note', 'paste', 'file', 'link', 'pdf'].includes(m.kind) && m.role !== 'krish_notes')
    .filter(m => { const k = m.title.trim().toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true })
    .slice(0, ON_FILE_MAX).map(m => `- ${m.title} (${m.kind}${m.at ? `, ${m.at.slice(0, 10)}` : ''})`)
  return whysResearchPrompt({
    pieceId: c.item.piece_id || '', title: c.item.title, when: `${c.dayLabel} (${c.item.date})`, series: c.series, where: c.item.line,
    story, lock: c.lock, sources: r.sources.slice(0, 15).map(s => `- ${s.label}${s.href ? `: ${s.href}` : ''}`), onFile,
    notes: c.saved.map(n => `- ${n.at ? `${n.at.slice(0, 10)}: ` : ''}${n.text}`),
  })
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
