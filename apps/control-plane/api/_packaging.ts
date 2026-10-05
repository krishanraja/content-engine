// The YouTube title and description for a piece's video, and the title and
// subtitle the piece itself goes out under on Substack: the rules, as data,
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
// The same day he published article 1 on Substack and sent a screenshot of
// his publication's feed on his phone. The title, 122 characters, was cut off
// at about 110 ("who actuall"), and the subtitle after its first line.
// Substack also sends the title as the email's subject line, which a phone
// cuts sooner. He said: "Also bear in mind what happens to your artwork when
// I'm looking at the article in Substack once it's posted." So the same step
// writes the Substack title and subtitle too, under the same rules, cut to
// what a phone shows (walk log F65).
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
/** Where Substack's feed on a phone cut article 1's title off. The Substack
 *  title keeps TITLE_MAX, inside this cut, and aims for TITLE_AIM, because
 *  Substack also sends the title as the email's subject line, and a phone
 *  cuts a subject line short. */
export const FEED_CUT = 110
/** About one line of a subtitle, which is all Substack's feed on a phone
 *  shows of it. Email apps show the same start as the preview text. */
export const SUBTITLE_LINE = 60
/** A subtitle is a line or two under the title. */
export const SUBTITLE_AIM = 150

/** What the step writes: the YouTube title and description, and the title
 *  and subtitle the piece goes out under on Substack. */
export type PackageField = 'title' | 'description' | 'substack_title' | 'substack_subtitle'

export type RuleGroup = 'title' | 'description' | 'both' | 'substack_title' | 'substack_subtitle' | 'titles' | 'all'

/** Who a rule is for: one field, or a group of them, with the heading the
 *  writer reads it under, in the order the writer reads them. */
export const RULE_GROUPS: Readonly<Record<RuleGroup, { heading: string; fields: readonly PackageField[] }>> = Object.freeze({
  title: { heading: 'THE YOUTUBE TITLE', fields: ['title'] },
  description: { heading: 'THE YOUTUBE DESCRIPTION', fields: ['description'] },
  both: { heading: 'BOTH YOUTUBE FIELDS', fields: ['title', 'description'] },
  substack_title: { heading: 'THE SUBSTACK TITLE', fields: ['substack_title'] },
  substack_subtitle: { heading: 'THE SUBSTACK SUBTITLE', fields: ['substack_subtitle'] },
  titles: { heading: "BOTH TITLES, YOUTUBE'S AND SUBSTACK'S", fields: ['title', 'substack_title'] },
  all: { heading: 'ALL FOUR', fields: ['title', 'description', 'substack_title', 'substack_subtitle'] },
})

export interface PackagingRule {
  id: string
  field: RuleGroup
  /** The instruction the writer reads. */
  text: string
  /** 'code' when lintPackage or lintSubstack checks it; 'writer' when only the writer and
   *  the person reading the answer can. Said, so nobody mistakes a rule the
   *  machine cannot see for one it has checked. */
  checked: 'code' | 'writer'
}

export const PACKAGING_RULES: readonly PackagingRule[] = Object.freeze([
  { id: 'TITLE_LENGTH', field: 'title', checked: 'code',
    text: `Aim for ${TITLE_AIM} characters or fewer, so a phone shows the whole title. YouTube stops at ${TITLE_MAX}.` },
  { id: 'NAMES', field: 'titles', checked: 'code',
    text: 'Name the people or companies the piece is about, when it has them. Names people already know are what they notice and search for.' },
  { id: 'CONFLICT', field: 'titles', checked: 'writer',
    text: 'Put them in a plain conflict or change, with a plain verb: blocked, let in, paid, dropped, sued, bought.' },
  { id: 'OPEN_QUESTION', field: 'title', checked: 'writer',
    text: 'Leave one open question that the video answers, so the viewer clicks to find out why.' },
  { id: 'THUMBNAIL', field: 'title', checked: 'code',
    text: 'Add to the thumbnail text instead of repeating it. The two are read together, so the title tells the story the thumbnail only asks about.' },
  { id: 'TRUE_TO_SOURCE', field: 'all', checked: 'writer',
    text: 'Every word is true and in the piece. Make no claim the piece does not make, and state nothing it only guesses at as fact.' },
  { id: 'NUMBERS', field: 'all', checked: 'code',
    text: 'Every number is one the piece states, word for word. Do no sums.' },
  { id: 'NO_CLICKBAIT', field: 'all', checked: 'code',
    text: 'No made-up urgency or hype: no "just" as in "just happened", and no "breaking", "shocking", "insane" or "you won\'t believe".' },
  { id: 'NO_SHOUTING', field: 'all', checked: 'code',
    text: 'No words in capitals to shout. A name or a short acronym such as AI keeps its own capitals.' },
  { id: 'BANNED_PHRASE', field: 'all', checked: 'code',
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
  { id: 'SUBSTACK_TITLE_LENGTH', field: 'substack_title', checked: 'code',
    text: `Aim for ${TITLE_AIM} characters or fewer: Substack also sends the title as the email's subject line, and a phone cuts a subject line short. Never more than ${TITLE_MAX}, because Substack's feed on a phone cuts a title off at about ${FEED_CUT}.` },
  { id: 'SAME_STORY', field: 'substack_title', checked: 'writer',
    text: 'It may differ from the YouTube title, as long as it tells the same story and never contradicts it.' },
  { id: 'SUBTITLE_FIRST_LINE', field: 'substack_subtitle', checked: 'code',
    text: `Its first sentence fits in about ${SUBTITLE_LINE} characters, because Substack's feed on a phone shows only about one line of the subtitle, and an email shows its start as the preview text.` },
  { id: 'SUBTITLE_STANDS_ALONE', field: 'substack_subtitle', checked: 'writer',
    text: 'That first sentence makes sense on its own: who did what, in plain words, so a reader who sees nothing else still gets the news. Then one or two plain sentences on what the piece shows the reader.' },
  { id: 'SUBTITLE_LENGTH', field: 'substack_subtitle', checked: 'code',
    text: `Aim for ${SUBTITLE_AIM} characters or fewer in all: a line or two under the title.` },
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
  /** Article 1 as Krish published it on Substack the same day, and what the
   *  feed on his phone showed of it (walk log F65). The subtitle is the
   *  description's opening without the length, and the line under the
   *  headline on the piece's page (scripts/pages/example-who-gets-paid.json). */
  substack: Object.freeze({
    title: 'Muse, Dot and the next wave of agents are now going shopping. When an AI agent does your shopping, who actually gets paid?',
    why: 'The feed on his phone cut it off at "who actuall", so the question it asks was lost. An email\'s subject line shows even less.',
    subtitle: "Amazon blocked Meta's new AI shopping agent. Shopify plugged it into its checkout. Here's who an AI agent threatens, who it pays, and where you could get stung.",
    subtitleWhy: 'The feed showed only its first line. Its first sentence gives the news on its own, so that line still worked.',
  }),
})

/** Characters as a person counts them: an emoji or an accented letter is one. */
export const characters = (s: string): number => [...String(s ?? '')].length

/** "2 minute watch", as Krish ended the line, from the video's length. */
export function watchLabel(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) return null
  if (seconds < 60) return `${Math.round(seconds)} second watch`
  return `${Math.max(1, Math.round(seconds / 60))} minute watch`
}

/** The opening sentence of a text's first line: the hook of a description,
 *  and the part of a subtitle a phone's feed shows. */
export function firstSentence(text: string): string {
  const line = String(text ?? '').split('\n').map(l => l.trim()).find(Boolean) ?? ''
  return line.split(/(?<=[.!?]["'”’)]*)\s+/)[0] ?? ''
}

/** The rules as a block the writer reads, with the worked example. */
export function packagingRulesBlock(): string {
  const sections = (Object.keys(RULE_GROUPS) as RuleGroup[]).flatMap(group => {
    const rules = PACKAGING_RULES.filter(r => r.field === group).map(r => `- ${r.text}`)
    return rules.length ? ['', RULE_GROUPS[group].heading, ...rules] : []
  }).slice(1)
  const ex = WORKED_EXAMPLE
  return [
    ...sections,
    '', "A WORKED EXAMPLE, from the piece about Amazon, Meta's AI shopping agent and Shopify. Learn the reasoning; its words fit that piece only.",
    `Thumbnail text: "${ex.thumbnail}"`,
    `Krish's first try, ${characters(ex.draft)} characters, over YouTube's limit, shouting in capitals and partly repeating the thumbnail: "${ex.draft}"`,
    `The pick, ${characters(ex.pick)} characters: "${ex.pick}" ${ex.why}`,
    ...ex.alternates.map(a => `Backup: "${a.title}" (${characters(a.title)} characters). ${a.why}`),
    `The opening paragraph of the description Krish published: "${ex.opening}"`,
    `The title Krish published the piece under on Substack, ${characters(ex.substack.title)} characters, more than the ${TITLE_MAX} allowed: "${ex.substack.title}" ${ex.substack.why}`,
    `Its subtitle, whose first sentence is ${characters(firstSentence(ex.substack.subtitle))} characters: "${ex.substack.subtitle}" ${ex.substack.subtitleWhy}`,
  ].join('\n')
}

/** A rule's instruction, by its id: a packaging rule or one of Krish's house
 *  rules. Every problem lintPackage or lintSubstack reports names one of these. */
export function ruleText(id: string): string | null {
  return PACKAGING_RULES.find(r => r.id === id)?.text ?? HOUSE_RULES.find(r => r.id === id)?.text ?? null
}

// ── The check ───────────────────────────────────────────────────────────────

export interface PackageProblem {
  /** The rule broken: a packaging rule above, or a house rule's id. */
  rule: string
  field: PackageField
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
  /** The piece the video is made from, and the article on Substack. Its
   *  prediction is read from here. */
  source: string
  /** Other text a number may come from: the filed sources, the video's length. */
  grounding?: string
}

/** Software that acts for a person is an AI agent (house rule AI_AGENT).
 *  Whole words only: "robotics" and "chatbot" are other things. */
const ROBOT = /\b(?:robots?|bots?)\b/gi

/** Hype no title, description or subtitle may carry. "just" counts only as
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

/** The names in a title, YouTube's or Substack's, that the piece also names. */
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

/** How a problem names its field. YouTube's two keep the plain names they
 *  have always had. */
const FIELD_NAMES: Readonly<Record<PackageField, string>> = Object.freeze({
  title: 'title', description: 'description', substack_title: 'Substack title', substack_subtitle: 'Substack subtitle',
})

/** The checks every field gets: the house's own mechanical rules, the
 *  numbers, and the hype. */
function voiceProblems(field: PackageField, text: string, ctx: PackageContext): PackageProblem[] {
  const out: PackageProblem[] = []
  const fail = (rule: string, detail: string) => out.push({ rule, field, level: 'fail', detail })
  const name = FIELD_NAMES[field]
  const dashes = emDashes(text).length
  if (dashes) fail('NO_EM_DASH', `The ${name} has ${dashes === 1 ? 'an em dash' : `${dashes} em dashes`}. Use a comma or a full stop.`)
  for (const hit of notXYConstructions(text)) fail('R2', `The ${name} uses the "Not X, Y" move: "${hit}". Say the sharper thing straight.`)
  if (exclamationMarks(text).length) fail('NO_EXCLAMATION', `The ${name} has an exclamation mark.`)
  const us = americanSpellings(text)
  if (us.length) fail('BRITISH_SPELLING', `The ${name} uses American spelling: ${us.map(w => `${w.found} (write ${w.use})`).join(', ')}.`)
  const lower = text.toLowerCase()
  for (const phrase of BANNED_PHRASES) if (lower.includes(phrase)) fail('BANNED_PHRASE', `The ${name} uses a banned phrase: "${phrase}".`)
  const robots = [...new Set((text.match(ROBOT) || []).map(w => w.toLowerCase()))]
  if (robots.length) fail('AI_AGENT', `The ${name} says ${robots.map(w => `"${w}"`).join(' and ')}. Software that acts for a person is an AI agent.`)
  const inCapitals = new Set(withoutHeadings(ctx.source).match(/\b[A-Z]{5,}\b/g) || [])
  const shouting = [...new Set(text.match(/\b[A-Z]{5,}\b/g) || [])].filter(w => !KNOWN_CAPITALS.has(w) && !inCapitals.has(w))
  if (shouting.length) fail('NO_SHOUTING', `The ${name} shouts in capitals: ${shouting.join(', ')}. Write it in normal case.`)
  for (const [pattern, label] of CLICKBAIT) if (pattern.test(text)) fail('NO_CLICKBAIT', `The ${name} uses hype: ${label}. Say what happened instead.`)
  const numbers = unsupportedNumbers(text, [ctx.source, ctx.grounding || ''].join('\n'))
  if (numbers.length) fail('NUMBERS', `The ${name} has ${numbers.length === 1 ? 'a number' : 'numbers'} the piece does not state: ${numbers.join(', ')}. Use only numbers the piece gives, word for word.`)
  // YouTube's own refusal, so for its two fields only.
  if ((field === 'title' || field === 'description') && /[<>]/.test(text)) fail('YOUTUBE_LIMITS', `YouTube does not accept < or > in a ${name}.`)
  return out
}

/** A title that names nobody, when the piece names people: for both
 *  titles, YouTube's and Substack's. */
function namesProblems(field: 'title' | 'substack_title', title: string, source: string): PackageProblem[] {
  if (!sourceHasNames(source) || namesIn(title, source).length) return []
  return [{ rule: 'NAMES', field, level: 'warn', detail: `The ${FIELD_NAMES[field]} names nobody from the piece. Name the people or companies involved.` }]
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
  problems.push(...namesProblems('title', title, input.source))
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
  const hook = firstSentence(description)
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

/**
 * Check the title and subtitle the piece goes out under on Substack, the
 * same way. The title keeps the rules on truth, names, numbers and hype, and
 * is cut to what a phone shows: the feed cut article 1's title off at about
 * FEED_CUT, and an email's subject line shows less. The subtitle's first
 * sentence has to fit in the one line the feed shows. Whether the title tells
 * the same story as the YouTube title, and whether that first sentence makes
 * sense alone, only the writer and the person reading can say.
 */
export function lintSubstack(input: PackageContext & { substackTitle: string; substackSubtitle: string }): PackageLint {
  const title = String(input.substackTitle ?? '').trim()
  const subtitle = String(input.substackSubtitle ?? '').trim()
  const problems: PackageProblem[] = []
  const add = (rule: string, field: PackageField, level: PackageProblem['level'], detail: string) => problems.push({ rule, field, level, detail })
  if (!title) add('SUBSTACK_TITLE_LENGTH', 'substack_title', 'fail', 'There is no Substack title.')
  else {
    const n = characters(title)
    if (n > TITLE_MAX) add('SUBSTACK_TITLE_LENGTH', 'substack_title', 'fail', `The Substack title is ${n} characters. Substack's feed on a phone cuts a title off at about ${FEED_CUT}, so ${TITLE_MAX} is the most, and an email's subject line shows about ${TITLE_AIM}.`)
    else if (n > TITLE_AIM) add('SUBSTACK_TITLE_LENGTH', 'substack_title', 'warn', `The Substack title is ${n} characters. It is also the email's subject line, which a phone cuts off after about ${TITLE_AIM}, so aim for ${TITLE_AIM} or fewer.`)
    problems.push(...voiceProblems('substack_title', title, input), ...namesProblems('substack_title', title, input.source))
  }
  if (!subtitle) add('SUBTITLE_LENGTH', 'substack_subtitle', 'fail', 'There is no Substack subtitle.')
  else {
    // Article 1's subtitle ran to 160 characters and the feed showed one
    // line of it; its first sentence, "Amazon blocked Meta's new AI shopping
    // agent.", is 44, so the news was in the line that showed.
    const first = characters(firstSentence(subtitle))
    if (first > SUBTITLE_LINE) add('SUBTITLE_FIRST_LINE', 'substack_subtitle', 'warn', `The subtitle's first sentence is ${first} characters. Substack's feed on a phone shows about ${SUBTITLE_LINE}, so it would be cut off before it says what happened.`)
    const n = characters(subtitle)
    if (n > SUBTITLE_AIM) add('SUBTITLE_LENGTH', 'substack_subtitle', 'warn', `The subtitle is ${n} characters. Aim for ${SUBTITLE_AIM} or fewer: a line or two under the title.`)
    problems.push(...voiceProblems('substack_subtitle', subtitle, input))
  }
  return { passed: !problems.some(p => p.level === 'fail'), problems }
}

// ── The writer's answer ─────────────────────────────────────────────────────

export interface PackageAnswer {
  title: string
  description: string
  /** The title and subtitle the piece goes out under on Substack. Empty
   *  when the writer left one out: the check fails it, so the one retry
   *  asks for it, and the YouTube answer is kept either way. */
  substackTitle: string
  substackSubtitle: string
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
  return {
    title, description,
    substackTitle: unquote(clean(o.substack_title)),
    substackSubtitle: unquote(clean(o.substack_subtitle)),
    why: clean(o.why) || null, alternates,
  }
}

/** The main title and description, the Substack title and subtitle, and
 *  each backup title. A backup is checked without the thumbnail: one is for
 *  when the thumbnail changes, and on 2026-10-05 that backup was the
 *  thumbnail's own words, on purpose. */
export function lintAnswer(answer: PackageAnswer, ctx: PackageContext): AnswerLint {
  const main = lintPackage({ ...ctx, title: answer.title, description: answer.description })
  const substack = lintSubstack({ ...ctx, substackTitle: answer.substackTitle, substackSubtitle: answer.substackSubtitle })
  return {
    passed: main.passed && substack.passed,
    problems: [...main.problems, ...substack.problems],
    alternates: answer.alternates.map(a => lintTitle({ ...ctx, thumbnailText: null, title: a.title })),
  }
}

/** How many problems fail, across the main answer and the backups. */
export function failures(lint: AnswerLint): number {
  return [lint, ...lint.alternates].reduce((n, l) => n + l.problems.filter(p => p.level === 'fail').length, 0)
}

/** The message the writer's second, and last, call gets: each failing
 *  problem in plain words, with the rule it breaks. */
export function packagingCorrection(answer: PackageAnswer, lint: AnswerLint): string {
  const lines = ['Your answer breaks rules for the YouTube title and description, or the Substack title and subtitle. Fix each of these.']
  const list = (where: string, problems: PackageProblem[]) => {
    for (const p of problems.filter(x => x.level === 'fail')) {
      const rule = ruleText(p.rule)
      lines.push(`- ${where}: ${p.detail}${rule ? ` The rule: ${rule}` : ''}`)
    }
  }
  for (const field of ['title', 'description', 'substack_title', 'substack_subtitle'] as const) {
    list(`The ${FIELD_NAMES[field]}`, lint.problems.filter(p => p.field === field))
  }
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
    `\nTHE PIECE, the only source for the titles, the description and the subtitle:\n${o.source.slice(0, 14_000)}`,
    o.thumbnailText
      ? `\nTHUMBNAIL TEXT, read together with the YouTube title: "${o.thumbnailText}"`
      : '\nNo thumbnail text was given. Write the YouTube title so it works on its own.',
    o.watch
      ? `\nTHE VIDEO'S LENGTH: end the description's first paragraph with " | ${o.watch}".`
      : '\nThe video\'s length was not given. Leave it out.',
    o.hint ? `\nA STEER FROM THE PERSON ASKING: ${o.hint}` : '',
    '\nReturn ONLY one JSON object: {"title": string, "alternates": [{"title": string, "why": string}, {"title": string, "why": string}], "description": string, "substack_title": string, "substack_subtitle": string, "why": string}. ' +
    '"title", "alternates" and "description" are for YouTube. "alternates" are two backup titles: the first for search, the second for if the thumbnail changes. ' +
    '"substack_title" and "substack_subtitle" are the title and subtitle the piece itself goes out under on Substack. ' +
    '"why" says in one or two plain sentences why the YouTube title works. ' +
    'The description puts each of its parts on its own line.',
  ].filter(Boolean).join('\n')
}
