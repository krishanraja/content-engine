// The YouTube title and description for a piece's video: the rules, as data,
// and the checks a machine can make of them.
//
// Krish, 2026-10-05, in chat about the video for piece 1 (Amazon, Meta's Muse
// and Shopify): "whats a viral video title for this". Then, closing the
// session: "lets close this session out by ensuring everything I have asked
// for in terms of the content engine (like a viral youtube title and
// description) becomes a part of the durable engine." The engine could write
// the video's script (channel-cut 'youtube', api/_video.ts), whose title is
// only a working title, and nothing wrote the title and description he pastes
// into YouTube Studio. So the reasoning that made a good title in that chat
// lives here, the route that asks for one (content-ideas/[id]/package.ts)
// reads it, and the ruling with his words is YOUTUBE_PACKAGE in
// api/_houseRules.ts, so every writer reads it too (walk log F59).
//
// Pure: no database, no network, no route code. The checks are the engine's
// own (the publish checks, the "Not X, Y" reader, the banned-phrase list, the
// verbatim-number check, the call reader); nothing here keeps a copy of them.

import { sanitizeVoice } from './_content.js'
import { HOUSE_RULES } from './_houseRules.js'
import { BANNED_PHRASES, notXYConstructions } from './_judges/deterministic.js'
import { unsupportedNumbers } from './_numbers.js'
import { americanSpellings, emDashes, exclamationMarks } from './_publishChecks.js'
import { titleNorm } from './_text.js'
// The one reader of a piece's call, shared with the publish checks and the
// Studio. Imported by its relative path, as they do.
import { callDateMentions, callSectionOf } from '../../../packages/contracts/src/call.js'

// ── The rules, as data ──────────────────────────────────────────────────────

/** Phones cut a title off well before YouTube does. 59 characters was the
 *  pick on 2026-10-05, and a phone showed all of it. */
export const TITLE_AIM = 60
/** YouTube refuses a longer title. Krish's first try was 112. */
export const TITLE_MAX = 100
/** About how much of a description YouTube shows before "more". */
export const HOOK_MAX = 150
/** YouTube refuses a longer description. */
export const DESCRIPTION_MAX = 5000
export const MAX_HASHTAGS = 3
/** The line every description carries, so a viewer can find the piece. */
export const READ_LINE = 'Read the full piece free at makeyourmindup.ai'

export interface PackagingRule {
  id: string
  field: 'title' | 'description' | 'both'
  /** The instruction the writer reads. */
  text: string
  /** 'code' when lintPackage checks it; 'writer' when only the writer and
   *  the person reading the answer can. Said, so nobody mistakes a rule the
   *  machine cannot see for one it has checked. */
  checked: 'code' | 'writer'
}

export const PACKAGING_RULES: readonly PackagingRule[] = Object.freeze([
  { id: 'TITLE_LENGTH', field: 'title', checked: 'code',
    text: `Aim for ${TITLE_AIM} characters or fewer, so a phone shows the whole title. YouTube stops at ${TITLE_MAX}.` },
  { id: 'NAMES', field: 'title', checked: 'code',
    text: 'Name the people or companies the piece is about, when it has them. Names people already know are what they notice and search for.' },
  { id: 'CONFLICT', field: 'title', checked: 'writer',
    text: 'Put them in a plain conflict or change, with a plain verb: blocked, let in, paid, dropped, sued, bought.' },
  { id: 'OPEN_QUESTION', field: 'title', checked: 'writer',
    text: 'Leave one open question that the video answers, so the viewer clicks to find out why.' },
  { id: 'THUMBNAIL', field: 'title', checked: 'code',
    text: 'Add to the thumbnail text instead of repeating it. The two are read together, so the title tells the story the thumbnail only asks about.' },
  { id: 'TRUE_TO_SOURCE', field: 'both', checked: 'writer',
    text: 'Every word is true and in the piece. Make no claim the piece does not make, and state nothing it only guesses at as fact.' },
  { id: 'NUMBERS', field: 'both', checked: 'code',
    text: 'Every number is one the piece states, word for word. Do no sums.' },
  { id: 'NO_CLICKBAIT', field: 'both', checked: 'code',
    text: 'No made-up urgency or hype: no "just" as in "just happened", and no "breaking", "shocking", "insane" or "you won\'t believe".' },
  { id: 'NO_SHOUTING', field: 'both', checked: 'code',
    text: 'No words in capitals to shout. A name or a short acronym such as AI keeps its own capitals.' },
  { id: 'BANNED_PHRASE', field: 'both', checked: 'code',
    text: 'None of the phrases on the house\'s banned list ("delve", "game-changer" and the rest).' },
  { id: 'YOUTUBE_LIMITS', field: 'both', checked: 'code',
    text: `YouTube's own limits: a title of ${TITLE_MAX} characters at most, a description of ${DESCRIPTION_MAX}, and no < or > in either.` },
  { id: 'HOOK', field: 'description', checked: 'code',
    text: `It opens with the hook: one sentence, well inside the first ${HOOK_MAX} characters, because YouTube shows only that much before "more".` },
  { id: 'BODY', field: 'description', checked: 'writer',
    text: 'Then two or three plain sentences: who is involved, what happened, and what it means for the viewer. When the video\'s length is given, this first paragraph ends with it, as Krish writes it: "... and where you could get stung. | 2 minute watch".' },
  { id: 'PREDICTION', field: 'description', checked: 'code',
    text: 'Then the piece\'s dated prediction, when it has one, with the date and the words the piece gives it.' },
  { id: 'READ_LINE', field: 'description', checked: 'code',
    text: `Then, on a line of its own: "${READ_LINE}".` },
  { id: 'HASHTAGS', field: 'description', checked: 'code',
    text: `No wall of hashtags: at most ${MAX_HASHTAGS} that fit the piece, on the last line, or none.` },
])

/** The case the rules came from, shown to the writer for its reasoning. Its
 *  words fit that piece only. */
export const WORKED_EXAMPLE = Object.freeze({
  thumbnail: 'When an AI agent does your shopping, who gets paid?',
  draft: 'AI AGENTS are Muse, Dot and the next wave of agents are now going shopping. When an AI agent does your shopping,',
  pick: "Amazon blocked Meta's AI shopping agent. Shopify let it in.",
  why: 'It names companies everyone knows, puts them in a conflict with a plain verb, and leaves a question the video answers: why did two giants do opposite things with the same AI agent? It adds the story to the thumbnail instead of repeating it, and a phone shows all of it.',
  alternates: Object.freeze([
    { title: "Why Amazon blocked Meta's AI shopping agent", why: 'For search: it starts with the question people type.' },
    { title: 'When an AI agent does your shopping, who gets paid?', why: 'Only if the thumbnail changes: today it is the thumbnail, word for word.' },
  ]),
  /** The opening paragraph Krish published in YouTube Studio. Its hook is
   *  the first sentence. */
  opening: "Amazon blocked Meta's new AI shopping agent. Shopify plugged it into its checkout. Here's who an AI agent threatens, who it pays, and where you could get stung. | 2 minute watch",
})

/** Characters as a person counts them: an emoji or an accented letter is one. */
export const characters = (s: string): number => [...String(s ?? '')].length

/** "2 minute watch", as Krish ended the line, from the video's length. */
export function watchLabel(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null
  if (seconds < 60) return `${Math.round(seconds)} second watch`
  return `${Math.max(1, Math.round(seconds / 60))} minute watch`
}

/** The rules as a block the writer reads, with the worked example. */
export function packagingRulesBlock(): string {
  const rules = (field: PackagingRule['field']) => PACKAGING_RULES.filter(r => r.field === field).map(r => `- ${r.text}`)
  const ex = WORKED_EXAMPLE
  return [
    'THE TITLE', ...rules('title'),
    '', 'THE DESCRIPTION', ...rules('description'),
    '', 'BOTH', ...rules('both'),
    '', "A WORKED EXAMPLE, from the piece about Amazon, Meta's AI shopping agent and Shopify. Learn the reasoning; its words fit that piece only.",
    `Thumbnail text: "${ex.thumbnail}"`,
    `Krish's first try, ${characters(ex.draft)} characters, over YouTube's limit, shouting in capitals and partly repeating the thumbnail: "${ex.draft}"`,
    `The pick, ${characters(ex.pick)} characters: "${ex.pick}" ${ex.why}`,
    ...ex.alternates.map(a => `Backup: "${a.title}" (${characters(a.title)} characters). ${a.why}`),
    `The opening paragraph of the description Krish published: "${ex.opening}"`,
  ].join('\n')
}

/** A rule's instruction, by its id: a packaging rule or one of Krish's house
 *  rules. Every problem lintPackage reports names one of these. */
export function ruleText(id: string): string | null {
  return PACKAGING_RULES.find(r => r.id === id)?.text ?? HOUSE_RULES.find(r => r.id === id)?.text ?? null
}

// ── The check ───────────────────────────────────────────────────────────────

export interface PackageProblem {
  /** The rule broken: a packaging rule above, or a house rule's id. */
  rule: string
  field: 'title' | 'description'
  /** 'fail' sends the writer back once (the route); 'warn' is for the
   *  person reading. Nothing here publishes, so neither blocks a post. */
  level: 'fail' | 'warn'
  /** What is wrong, in plain words. */
  detail: string
}

export interface PackageLint {
  /** True when nothing fails. Warnings may remain. */
  passed: boolean
  problems: PackageProblem[]
}

export interface PackageContext {
  thumbnailText?: string | null
  /** The piece the video is made from. Its prediction is read from here. */
  source: string
  /** Other text a number may come from: the filed sources, the video's length. */
  grounding?: string
}

/** Software that acts for a person is an AI agent (house rule AI_AGENT).
 *  Whole words only: "robotics" and "chatbot" are other things. */
const ROBOT = /\b(?:robots?|bots?)\b/gi

/** Hype a title or description has to do without. "just" counts only as
 *  urgency, before something that happened ("just blocked", "just made"),
 *  never as "only" ("it just needs to be cheap"). "breaking" counts only as
 *  a news flash, so "breaking its own rules" is left alone. */
const CLICKBAIT: ReadonlyArray<[RegExp, string]> = [
  [/\bshocking(?:ly)?\b/i, '"shocking"'],
  [/\byou won['’]?t believe\b/i, '"you won\'t believe"'],
  [/\binsane(?:ly)?\b/i, '"insane"'],
  [/^\s*breaking\b|\bbreaking(?:\s+news)?\s*[:|]/i, '"breaking"'],
  [/\bjust\s+(?:[a-z]+ed|made|did|got|went|became|broke|won|lost|sold|bought|told|said|took|hit|shut|let|cut|dropped)\b/i, '"just" as urgency'],
]

/** Long words in capitals that a name or acronym explains: NVIDIA writes
 *  itself that way. Anything the piece itself writes in capitals passes too. */
const KNOWN_CAPITALS = new Set(['NVIDIA', 'NASDAQ', 'ASEAN', 'UNESCO', 'UNICEF'])

/** Capitalised words that are not names. */
const NOT_NAMES = new Set([
  'AI', 'I', 'A', 'An', 'The', 'Why', 'How', 'What', 'When', 'Who', 'Where', 'Which',
  'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December',
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
])

const withoutHeadings = (s: string) => String(s ?? '').replace(/^#{1,6} .*$/gm, '')
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** A word the piece writes with a capital in the middle of a sentence, so a
 *  name and never just the first word of one. */
function namedInSource(word: string, source: string): boolean {
  return new RegExp(`[a-z0-9,;:)]['’"]?\\s+${escape(word)}(?![A-Za-z])`).test(source)
}

/** The names in a title that the piece also names. */
export function namesIn(title: string, source: string): string[] {
  const body = withoutHeadings(source)
  const tokens = (String(title ?? '').match(/\b[A-Z][A-Za-z0-9&'’-]*/g) || [])
    .map(t => t.replace(/['’]s$/, '').replace(/['’-]+$/, ''))
  return [...new Set(tokens)].filter(t => t.length > 1 && !NOT_NAMES.has(t) && namedInSource(t, body))
}

/** Whether the piece names anyone at all. */
function sourceHasNames(source: string): boolean {
  return [...withoutHeadings(source).matchAll(/[a-z0-9,;:)]['’"]?\s+([A-Z][A-Za-z]+)/g)].some(m => !NOT_NAMES.has(m[1]!))
}

/** 'same' when the title is the thumbnail text, or holds it whole; 'mostly'
 *  when most of the title's longer words are already on the thumbnail. */
export function repeatsThumbnail(title: string, thumbnail: string | null | undefined): 'same' | 'mostly' | null {
  const t = titleNorm(title)
  const th = titleNorm(thumbnail || '')
  if (!t || !th) return null
  if (t === th || (th.length >= 12 && t.includes(th)) || (t.length >= 12 && th.includes(t))) return 'same'
  const words = (s: string) => new Set(s.split(' ').filter(w => w.length > 3))
  const mine = words(t)
  const theirs = words(th)
  if (mine.size >= 3 && [...mine].filter(w => theirs.has(w)).length / mine.size >= 0.75) return 'mostly'
  return null
}

/** The date of the piece's prediction as the piece writes it ("30 June
 *  2027"), or null when it makes none. */
export function predictionDate(source: string): string | null {
  const section = callSectionOf(String(source ?? ''))
  if (!section) return null
  const first = callDateMentions(section)[0]
  return first ? first.text.replace(/^(?:by|on|before)\s+/i, '') : null
}

/** The checks both fields get: the house's own mechanical rules, the
 *  numbers, and the hype. */
function voiceProblems(field: PackageProblem['field'], text: string, ctx: PackageContext): PackageProblem[] {
  const out: PackageProblem[] = []
  const fail = (rule: string, detail: string) => out.push({ rule, field, level: 'fail', detail })
  const dashes = emDashes(text).length
  if (dashes) fail('NO_EM_DASH', `The ${field} has ${dashes === 1 ? 'an em dash' : `${dashes} em dashes`}. Use a comma or a full stop.`)
  for (const hit of notXYConstructions(text)) fail('R2', `The ${field} uses the "Not X, Y" move: "${hit}". Say the sharper thing straight.`)
  if (exclamationMarks(text).length) fail('NO_EXCLAMATION', `The ${field} has an exclamation mark.`)
  const us = americanSpellings(text)
  if (us.length) fail('BRITISH_SPELLING', `The ${field} uses American spelling: ${us.map(w => `${w.found} (write ${w.use})`).join(', ')}.`)
  const lower = text.toLowerCase()
  for (const phrase of BANNED_PHRASES) if (lower.includes(phrase)) fail('BANNED_PHRASE', `The ${field} uses a banned phrase: "${phrase}".`)
  const robots = [...new Set((text.match(ROBOT) || []).map(w => w.toLowerCase()))]
  if (robots.length) fail('AI_AGENT', `The ${field} says ${robots.map(w => `"${w}"`).join(' and ')}. Software that acts for a person is an AI agent.`)
  const inCapitals = new Set(withoutHeadings(ctx.source).match(/\b[A-Z]{5,}\b/g) || [])
  const shouting = [...new Set(text.match(/\b[A-Z]{5,}\b/g) || [])].filter(w => !KNOWN_CAPITALS.has(w) && !inCapitals.has(w))
  if (shouting.length) fail('NO_SHOUTING', `The ${field} shouts in capitals: ${shouting.join(', ')}. Write it in normal case.`)
  for (const [pattern, label] of CLICKBAIT) if (pattern.test(text)) fail('NO_CLICKBAIT', `The ${field} uses hype: ${label}. Say what happened instead.`)
  const numbers = unsupportedNumbers(text, [ctx.source, ctx.grounding || ''].join('\n'))
  if (numbers.length) fail('NUMBERS', `The ${field} has ${numbers.length === 1 ? 'a number' : 'numbers'} the piece does not state: ${numbers.join(', ')}. Use only numbers the piece gives, word for word.`)
  if (/[<>]/.test(text)) fail('YOUTUBE_LIMITS', `YouTube does not accept < or > in a ${field}.`)
  return out
}

/** The title on its own: for the main title and for each backup. */
export function lintTitle(input: PackageContext & { title: string }): PackageLint {
  const title = String(input.title ?? '').trim()
  const problems: PackageProblem[] = []
  const add = (rule: string, level: PackageProblem['level'], detail: string) => problems.push({ rule, field: 'title', level, detail })
  if (!title) {
    add('YOUTUBE_LIMITS', 'fail', 'There is no title.')
    return { passed: false, problems }
  }
  const n = characters(title)
  if (n > TITLE_MAX) add('TITLE_LENGTH', 'fail', `The title is ${n} characters. YouTube allows ${TITLE_MAX} at most, and a phone shows about ${TITLE_AIM}.`)
  else if (n > TITLE_AIM) add('TITLE_LENGTH', 'warn', `The title is ${n} characters. A phone cuts it off after about ${TITLE_AIM}, so aim for ${TITLE_AIM} or fewer.`)
  problems.push(...voiceProblems('title', title, input))
  const repeat = repeatsThumbnail(title, input.thumbnailText)
  if (repeat === 'same') add('THUMBNAIL', 'fail', 'The title repeats the thumbnail text. Use the title to tell the story the thumbnail only asks about.')
  else if (repeat === 'mostly') add('THUMBNAIL', 'warn', 'The title says mostly what the thumbnail already says. Add something the thumbnail does not.')
  if (sourceHasNames(input.source) && !namesIn(title, input.source).length) {
    add('NAMES', 'warn', 'The title names nobody from the piece. Name the people or companies involved.')
  }
  return { passed: !problems.some(p => p.level === 'fail'), problems }
}

/**
 * Check a YouTube title and description against the rules a machine can
 * check. Deterministic: the same words always get the same answer. Every
 * problem names its rule and says what is wrong in plain words. A rule only
 * the writer can keep (a plain conflict, an open question, true to the piece
 * beyond its numbers) is never reported here as kept or broken.
 */
export function lintPackage(input: PackageContext & { title: string; description: string }): PackageLint {
  const title = lintTitle(input)
  const description = String(input.description ?? '').trim()
  const problems: PackageProblem[] = [...title.problems]
  const add = (rule: string, level: PackageProblem['level'], detail: string) => problems.push({ rule, field: 'description', level, detail })
  if (!description) {
    add('YOUTUBE_LIMITS', 'fail', 'There is no description.')
    return { passed: false, problems }
  }
  const n = characters(description)
  if (n > DESCRIPTION_MAX) add('YOUTUBE_LIMITS', 'fail', `The description is ${n} characters. YouTube allows ${DESCRIPTION_MAX} at most.`)
  const lines = description.split('\n').map(l => l.trim()).filter(Boolean)
  // The hook is the opening sentence. Krish's own first paragraph on
  // 2026-10-05 ran to 177 characters, and its hook, "Amazon blocked Meta's
  // new AI shopping agent.", is 44: what has to fit is the hook itself.
  const hook = (lines[0] ?? '').split(/(?<=[.!?]["'”’)]*)\s+/)[0] ?? ''
  if (characters(hook) > HOOK_MAX) add('HOOK', 'warn', `The opening sentence is ${characters(hook)} characters. YouTube shows about ${HOOK_MAX} before "more", so the hook would be cut off.`)
  problems.push(...voiceProblems('description', description, input))
  const due = predictionDate(input.source)
  if (due && !description.toLowerCase().includes(due.toLowerCase())) {
    add('PREDICTION', 'warn', `The piece predicts what will happen by ${due}, and the description does not give that prediction.`)
  }
  const readLine = new RegExp(escape(READ_LINE), 'i')
  if (!lines.some(l => readLine.test(l))) add('READ_LINE', 'fail', `The description has no "${READ_LINE}" line.`)
  const tags = description.match(/(?:^|\s)#[\p{L}\p{N}_]+/gu) || []
  if (tags.length > MAX_HASHTAGS) add('HASHTAGS', 'fail', `The description has ${tags.length} hashtags. Use ${MAX_HASHTAGS} at most, or none.`)
  if (tags.length && lines.slice(0, -1).some(l => /(?:^|\s)#[\p{L}\p{N}_]+/u.test(l))) {
    add('HASHTAGS', 'warn', 'Hashtags belong on the last line only.')
  }
  return { passed: !problems.some(p => p.level === 'fail'), problems }
}

// ── The writer's answer ─────────────────────────────────────────────────────

export interface PackageAnswer {
  title: string
  description: string
  why: string | null
  /** Two backups: one for search, one for if the thumbnail changes. */
  alternates: Array<{ title: string; why: string | null }>
}

export interface AnswerLint extends PackageLint {
  /** One check per backup title, in order. */
  alternates: PackageLint[]
}

const unquote = (s: string) => (/^["“].*["”]$/s.test(s) ? s.slice(1, -1).trim() : s)
const clean = (v: unknown) => (typeof v === 'string' ? sanitizeVoice(v.trim()).trim() : '')

/** The writer's JSON, cleaned the way every write path cleans text, or null
 *  when it has no title or no description to use. */
export function readAnswer(parsed: unknown): PackageAnswer | null {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const o = parsed as Record<string, unknown>
  const title = unquote(clean(o.title))
  const description = clean(o.description)
  if (!title || !description) return null
  const alternates = (Array.isArray(o.alternates) ? o.alternates : []).flatMap(a => {
    const alt = a && typeof a === 'object' ? a as Record<string, unknown> : {}
    const t = unquote(clean(alt.title))
    return t ? [{ title: t, why: clean(alt.why) || null }] : []
  }).slice(0, 2)
  return { title, description, why: clean(o.why) || null, alternates }
}

/** The main title and description, and each backup title. A backup is
 *  checked without the thumbnail: one is for when the thumbnail changes, and
 *  on 2026-10-05 that backup was the thumbnail's own words, on purpose. */
export function lintAnswer(answer: PackageAnswer, ctx: PackageContext): AnswerLint {
  const main = lintPackage({ ...ctx, title: answer.title, description: answer.description })
  return { ...main, alternates: answer.alternates.map(a => lintTitle({ ...ctx, thumbnailText: null, title: a.title })) }
}

/** How many problems fail, across the main answer and the backups. */
export function failures(lint: AnswerLint): number {
  return [lint, ...lint.alternates].reduce((n, l) => n + l.problems.filter(p => p.level === 'fail').length, 0)
}

/** The message the writer's second, and last, call gets: each failing
 *  problem in plain words, with the rule it breaks. */
export function packagingCorrection(answer: PackageAnswer, lint: AnswerLint): string {
  const lines = ['Your answer breaks rules for a YouTube title and description. Fix each of these.']
  const list = (where: string, problems: PackageProblem[]) => {
    for (const p of problems.filter(x => x.level === 'fail')) {
      const rule = ruleText(p.rule)
      lines.push(`- ${where}: ${p.detail}${rule ? ` The rule: ${rule}` : ''}`)
    }
  }
  list('The title', lint.problems.filter(p => p.field === 'title'))
  list('The description', lint.problems.filter(p => p.field === 'description'))
  lint.alternates.forEach((l, i) => list(`Backup title ${i + 1} ("${answer.alternates[i]?.title ?? ''}")`, l.problems))
  lines.push('', 'Change only what these need. Add no new fact and no number the piece does not state. Return the same JSON object as before.')
  return lines.join('\n')
}

/** What the writer is asked: the piece, the thumbnail, the video's length,
 *  any steer, and the shape of the answer. */
export function packagingRequest(o: {
  idea: string | null
  thesis: string | null
  source: string
  materialsBlock?: string
  thumbnailText: string | null
  watch: string | null
  hint: string | null
}): string {
  return [
    `PIECE: ${o.idea || '(untitled)'}`,
    o.thesis ? `Thesis: ${o.thesis}` : '',
    o.materialsBlock || '',
    `\nTHE PIECE, the only source for the title and description:\n${o.source.slice(0, 14_000)}`,
    o.thumbnailText
      ? `\nTHUMBNAIL TEXT, read together with the title: "${o.thumbnailText}"`
      : '\nNo thumbnail text was given. Write the title so it works on its own.',
    o.watch
      ? `\nTHE VIDEO'S LENGTH: end the description's first paragraph with " | ${o.watch}".`
      : '\nThe video\'s length was not given. Leave it out.',
    o.hint ? `\nA STEER FROM THE PERSON ASKING: ${o.hint}` : '',
    '\nReturn ONLY one JSON object: {"title": string, "alternates": [{"title": string, "why": string}, {"title": string, "why": string}], "description": string, "why": string}. ' +
    '"alternates" are two backup titles: the first for search, the second for if the thumbnail changes. ' +
    '"why" says in one or two plain sentences why the title works. ' +
    'The description puts each of its parts on its own line.',
  ].filter(Boolean).join('\n')
}
