// One spine per piece (house rule ONE_SPINE).
//
// Krish, 2026-10-14, on Wednesday's Muse piece: "we ended up with an absolute
// ton of drift here. We were supposed to be scoring Muse and Siri, then we
// started talking about Apple and Walmart, then we started talking about ads,
// but then we have content about the three different types of AI. All of this
// could have been turned into something coherent, but it's ended up sprawling
// quite a lot ... the engine cannot do this again."
//
// Why it sprawled: every re-angle was added as new sections and none replaced
// the old spine. So a piece now carries one spine (a question and its
// one-line answer, approved by Krish at the outline), and this judge reads the
// draft section by section and asks whether each one answers that question.
// One "no" fails the check; making.py refuses scripts and the publish page
// until the section is cut or Krish approves a new spine (and a new outline).

import { bodyHash } from './_factGate.js'

export const SPINE_CHECK_VERSION = 1

export interface SpineSection { heading: string; text: string }
export interface SpineVerdict { heading: string; answers: boolean; why: string }
export interface SpineCheck {
  version: typeof SPINE_CHECK_VERSION
  ran_at: string
  body_hash: string
  spine: string
  answer: string
  sections: SpineVerdict[]
  passed: boolean
}

/** The draft's sections: the text before the first "## " heading is the
 *  opening, then one section per heading. The prediction is the piece's own
 *  call on the answer, so it is judged too. */
export function sectionsOf(body: string): SpineSection[] {
  const out: SpineSection[] = []
  let cur: SpineSection = { heading: 'OPENING', text: '' }
  for (const line of String(body || '').split('\n')) {
    const m = /^##\s+(.+?)\s*$/.exec(line)
    if (m) {
      if (cur.text.trim() || cur.heading !== 'OPENING') out.push(cur)
      cur = { heading: m[1]!, text: '' }
    } else {
      cur.text += line + '\n'
    }
  }
  if (cur.text.trim() || cur.heading !== 'OPENING') out.push(cur)
  return out.map(s => ({ heading: s.heading, text: s.text.trim() }))
}

export const SPINE_SYSTEM = [
  'You are a strict editor. A piece must answer ONE question, its spine, and every section must earn its place by helping answer it.',
  'For each section you are given, decide: does this section directly help the reader reach the spine\'s answer? A section that is interesting, true or related but answers a different question is a NO. A section that sets up, proves, complicates or applies the answer is a YES. The opening is a YES when it raises the spine question; the prediction is a YES when it is a call about the spine\'s answer; a closing "3 things you can do tomorrow" section is a YES when each action applies the answer.',
  'Be specific in "why": name the question the section actually answers when it is a NO.',
  'Reply ONLY with JSON: {"sections":[{"heading":"<as given>","answers":true|false,"why":"<one short sentence>"}]}',
].join('\n')

export function spineUser(spine: string, answer: string, sections: SpineSection[]): string {
  return JSON.stringify({ spine, answer, sections: sections.map(s => ({ heading: s.heading, text: s.text.slice(0, 4000) })) })
}

/** The model's answer, held to the sections it was given: a heading it left
 *  out, or an answer it did not give, counts as a NO, never a pass. */
export function readVerdicts(parsed: any, sections: SpineSection[]): SpineVerdict[] {
  const list: any[] = Array.isArray(parsed?.sections) ? parsed.sections : []
  return sections.map(s => {
    const v = list.find(x => x && String(x.heading || '').trim().toLowerCase() === s.heading.trim().toLowerCase())
    return v && typeof v.answers === 'boolean'
      ? { heading: s.heading, answers: v.answers, why: String(v.why || '').slice(0, 300) }
      : { heading: s.heading, answers: false, why: 'the judge gave no answer for this section' }
  })
}

export function spineResult(spine: string, answer: string, body: string, verdicts: SpineVerdict[], ranAt = new Date().toISOString()): SpineCheck {
  return {
    version: SPINE_CHECK_VERSION, ran_at: ranAt, body_hash: bodyHash(body), spine, answer,
    sections: verdicts, passed: verdicts.length > 0 && verdicts.every(v => v.answers),
  }
}

/** Whether the stored check covers these exact words and passed. */
export function spineStatus(meta: Record<string, any>, body: string): { ok: boolean; reason: string | null; check: SpineCheck | null } {
  const c = meta?.spine_check as SpineCheck | undefined
  if (!c) return { ok: false, reason: 'No spine check yet: run it with the approved spine.', check: null }
  if (c.body_hash !== bodyHash(body)) return { ok: false, reason: 'The words changed after the spine check. Run it again on this version.', check: c }
  if (!c.passed) {
    const off = c.sections.filter(s => !s.answers).map(s => `${s.heading} (${s.why})`)
    return { ok: false, reason: `These sections do not answer the spine: ${off.join('; ')}. Cut them, or ask Krish for a new spine and a new outline.`, check: c }
  }
  return { ok: true, reason: null, check: c }
}
