// Video script formats, 15 seconds to 20 minutes. Every piece uses two of
// them: 3min (the long cut) and 90s (the short cut), house rule TWO_CUTS.
//
// The engine could already produce a "YouTube script" — one length, roughly
// five to nine minutes, prose in a spoken register with the beats marked. That
// is one of these six, and the other five are not it scaled up or down. A 15
// second hook and a 20 minute investigation are different objects: the short
// one spends its whole budget on a single turn and has no room to earn
// anything, the long one has to earn everything and cannot rely on a turn.
// Handing a model a word count and hoping is how you get a 20 minute script
// that is a 60 second script with padding.
//
// So each format carries its own SHAPE. The word targets are ~150 spoken words
// per minute, which is unhurried delivery rather than a read-aloud record.
//
// Mirrors VIDEO_FORMATS in src/lib/contentEngine.ts, which supplies the picker.
// scripts/check-video-formats.ts keeps the two in step.

export interface VideoFormat {
  id: string
  label: string
  seconds: number
  /** Spoken words, at ~150/min. */
  words: number
  /** The structure this length can actually carry. */
  shape: string
}

/** The most spoken words a script of this format may carry: the ceiling the
 *  writer is told and the line above which it is asked again. For the two
 *  cuts (TWO_CUTS) it is 495 for 3min and 220 for 90s, both inside the
 *  bounds scripts/post-pack/story_check.py holds (405 to 495, 160 to 225). */
export function wordCeiling(f: Pick<VideoFormat, 'words'>): number {
  return Math.round(f.words * 1.1)
}

export const VIDEO_FORMATS: VideoFormat[] = [
  {
    id: '15s', label: '15 second hook', seconds: 15, words: 40,
    shape: [
      'ONE claim, ONE turn, hard out. Three or four sentences total.',
      'Sentence one states the claim as though mid-argument. No setup, no "in this video", no naming the topic before making the point.',
      'The turn is the whole piece: the thing the viewer did not expect, arriving by the second sentence.',
      'End on the consequence, not a summary and not a question. Never a call to action.',
      'There is no room to earn anything here, so do not try: assert, turn, stop.',
    ].join(' '),
  },
  {
    id: '30s', label: '30 seconds', seconds: 30, words: 80,
    shape: [
      'Claim, proof, verdict. Three beats, roughly even.',
      'The claim lands in the first five seconds and is arguable, not descriptive.',
      'The proof is ONE specific artifact: a number, a named company, a dated event. One only; a second proof at this length costs the verdict.',
      'The verdict is forward-looking and hands the viewer something reusable.',
    ].join(' '),
  },
  {
    id: '60s', label: '60 second reel', seconds: 60, words: 160,
    shape: [
      'Hook, proof, turn, verdict.',
      'The hook is the surprising claim, inside ten seconds, with no throat-clearing.',
      'The proof grounds it in named specifics.',
      'The turn is the part the viewer did not see coming: the second-order effect, the counter-reading, the part that inverts the obvious take.',
      'The verdict is hard and forward-looking and answers the hook. No summary, no question. Then one short spoken outro line (STORY_OUTRO).',
    ].join(' '),
  },
  {
    // The short cut of every piece (house rule TWO_CUTS, Krish 2026-10-11):
    // YouTube Shorts, TikTok and Instagram Reels, at most 90 seconds. The
    // target sits under story_check.py's 160 to 225 so its ceiling (220)
    // does too; aiming at 225 made the writer overshoot what the check takes.
    id: '90s', label: '90 seconds', seconds: 90, words: 200,
    shape: [
      'Hook (the most provocative true thing, then the one question), then two beats, then the call, then a one-line spoken outro.',
      'Each beat is one point with its one number. No third beat: there is no room.',
      'The call answers the question in one sentence. The outro says the full article is free at makeyourmindup.ai and asks one question for the comments (STORY_OUTRO).',
    ].join(' '),
  },
  {
    id: '3min', label: '3 minutes', seconds: 180, words: 450,
    shape: [
      'Hook (one plain question the whole script answers), then three beats, then verdict, then a short spoken outro.',
      'Each beat makes ONE point and carries its own evidence. A beat that restates the one above it is cut.',
      'Beats escalate: the third should be the one that would not have been believed at the start.',
      'Mark the beats explicitly so the edit has cut points.',
      'The verdict answers the hook\'s question, then makes the call. It is a hard forward-looking read and never a recap of the three beats. The spoken outro follows it (STORY_OUTRO).',
    ].join(' '),
  },
  {
    id: '10min', label: '10 minutes', seconds: 600, words: 1500,
    shape: [
      'Cold open, four sections, close.',
      'The cold open is a scene or a concrete artifact, not a thesis statement. The thesis arrives after the viewer is already in.',
      'Each of the four sections advances the argument and ends on a hook into the next. A section that could be reordered freely is a list, not an argument.',
      'Pick ONE analogy and carry it the whole way, including through the part where it breaks, and say out loud where it stops working.',
      'Hold one genuine counterpoint, in full, before answering it.',
      'The close answers the cold open\'s question, gives a hard verdict plus the specific thing to watch next, then the spoken outro (STORY_OUTRO).',
    ].join(' '),
  },
  {
    id: '20min', label: '20 minutes', seconds: 1200, words: 3000,
    shape: [
      'Full investigative structure.',
      'Cold open on the artifact. State the belief being prosecuted. Take the load-bearing claim apart and check each part against dated evidence, attributing every number to whoever produced it.',
      'One analogy, carried the whole way, broken honestly where it stops mapping.',
      'Hold the strongest counterpoint in its best form, not a straw version, and answer it or concede it.',
      'Say plainly where the knowable record ends rather than papering over it.',
      'Close by answering the question the cold open asked, then a hard verdict and the terminal question the evidence actually leaves open, then the spoken outro (STORY_OUTRO).',
      'At this length the viewer will forgive slowness but not padding: every section must move the argument or come out.',
    ].join(' '),
  },
]

export function videoFormat(id?: string | null): VideoFormat | null {
  return VIDEO_FORMATS.find(f => f.id === id) || null
}

/** Spoken-delivery rules every length obeys. */
// Krish, 2026-10-06, of the Higgsfield launch script (walk log F75): it spoke the
// article's headings aloud, judged a claim it never set up, and "just ends
// randomly on 85%, with nothing after that, no outro". The story check he
// approved the same evening, as the script writer reads it. The house rules
// FOR_THE_EAR and STORY_ARC carry it to every other stage, and
// scripts/post-pack/story_check.py refuses to pack a script that fails it.
export const STORY_OUTRO = 'STORY_OUTRO: a script of a minute or more ends with one or two spoken lines after the call: what this was (the subchannel or makeyourmindup), that there is a full article, what it has that the video does not, that it is free and where it is (makeyourmindup.ai, said out loud so it works on every channel), one question for the comments, and Krish signing off without repeating his name, which the series line already said (HOOK_AND_CTA, SERIES_OPENER). This outro is the only call to action a script makes, and it never asks for likes or subscribes.'

export const SCRIPT_STORY = [
  'THE STORY CHECK (Krish, 2026-10-06). Before you answer, check the script against all five and fix any that fail:',
  '1. One opening question, said out loud in the first beat, that the whole script answers. Before it, in the first two sentences after the series line (SERIES_OPENER), the most provocative true thing in the piece (HOOK_AND_CTA).',
  '2. Every beat sets that question up or answers it, and follows from the beat before. A beat that could be moved anywhere is a list item: cut it or connect it.',
  '3. Every claim is set up before it is judged: say what was claimed and why it matters before calling it real or theatre.',
  '4. Every takeaway follows from a beat already told. Name the beat it comes from in your head; if there is none, cut the takeaway.',
  '5. The ending answers the opening question, then the call, then the spoken outro. Never end on the number.',
  '6. It sounds like Krish, with opinion (VOICE_ON_CAMERA): at least three of a dry self-deprecating line, a sarcastic line at the hype, an exaggeration obvious by its size, an analogy a twelve-year-old gets, and an opinion said as opinion ("my bet", "I think"). No joke inside a checked fact. Put a second option for each joke in "notes", never inside "say", so Krish can swap or cut.',
  'And it must make sense out loud: say what the thing is before taking it apart, explain each number as it is said, and never speak an article heading or a label the listener has not heard explained.',
  STORY_OUTRO,
].join('\n')

export const SPOKEN_RULES = [
  'This is spoken, not an essay read aloud. Contractions, asides, and sentences a person can say in one breath.',
  'Plain words even where the idea is not. Expand every acronym once, the first time it appears.',
  'It has to pass a read-aloud test: if a sentence needs a second pass to parse, it is written, not spoken.',
  'Dry humour that makes the next idea easier to hold. Aim it at the industry, the hype, or yourself, never at the viewer for not knowing.',
  'No "hey guys", no "in today\'s video", no "make sure to like and subscribe", no restating the title.',
  'No em dashes. Use commas, periods or parentheses.',
].join('\n')

// ── The script pass itself ────────────────────────────────────────────────
// Shared by both callers: a content piece (content-ideas/[id]/video-script)
// and the weekly brief (briefs/[week]/video-script). They differ only in where
// the draft comes from and where the result is stored, so the prompt, the
// spoken rules, the structure-per-length and the number check live here rather
// than being written twice and drifting.

import { unsupportedNumbers } from './_numbers.js'
import {
  callClaude, corpusForChannel, loadCorpus, loadVoiceBlock, materialsContext,
  robustJson, sanitizeVoice, type Material,
} from './_content.js'
import { UTILITY_MODEL } from './_models.js'
import { houseRulesBlock, seriesOpener } from './_houseRules.js'

export interface VideoBeat { t: string; say: string; shot: string }

// The read-back (house rule R7, the hard gate on every script). Krish,
// 2026-10-12: "Every single script should be understandable by a
// 12-year-old. I can't even understand what I'm reading off the
// teleprompter. I thought we had hard gates for this?" A reading formula
// misses a script that loses a child on its ideas, so two fresh readers hear
// it as a 12-year-old would. These are their words, the same ones
// .agents/skills/make-piece/SKILL.md gives a Claude Code session's two
// readers (tests/control-plane/house-rules.test.ts holds the two together).
export const READ_BACK_READERS: readonly string[] = Object.freeze([
  'You are a sharp but ordinary 12-year-old in the UK. You know what an app, AI, a company, a court and a deal are, but you have never studied law, business, money or technology. You hear this video script read aloud once (no rewinding). List every word, phrase or sentence that would genuinely lose you: one you would not understand, or that would make you stop following. Say "nothing" if nothing lost you. Then retell the whole video in three sentences.',
  'Pretend you are 12 years old, in Year 7. You use apps and have heard of AI, but you know nothing about how lawsuits, contracts, companies or money work. Someone reads you this video script out loud, once. Which words or sentences would you not understand, or would make you lose the thread? List each one exactly as it is said, or say "nothing" if you followed all of it. Then tell the whole video back in three sentences.',
])

/** One reader's answer: what lost them (empty when nothing did), and their
 *  retelling in three sentences. */
export interface ReadBackReader { reader: 'A' | 'B'; lost: string[]; retell: string; error?: string }
/** The read-back of a script the engine wrote: passed only when both readers
 *  answered and nothing lost either. Whether each retelling matches the
 *  script's point is for the session that makes the piece, which reads them. */
export interface ReadBack { passed: boolean; readers: ReadBackReader[]; checked_at: string }

/** Two fresh readers, each told to be an ordinary 12-year-old hearing the
 *  script once, in parallel. A reader whose call fails is said, and the
 *  read-back does not pass. */
export async function readBack(script: string, call: (o: { system: string; user: string }) => Promise<string>): Promise<ReadBack> {
  const ask = async (prompt: string, reader: 'A' | 'B'): Promise<ReadBackReader> => {
    try {
      const out = await call({
        system: `${prompt}\n\nAnswer as JSON only: {"lost": [each word, phrase or sentence exactly as it is said, or none], "retell": "your three sentences"}.`,
        user: `The video script:\n\n${script}`,
      })
      const parsed = (robustJson(out) || {}) as { lost?: unknown; retell?: unknown }
      const lost = (Array.isArray(parsed.lost) ? parsed.lost : [])
        .map(x => String(x || '').trim()).filter(x => x && !/^nothing\.?$/i.test(x))
      return { reader, lost, retell: String(parsed.retell || '').trim() }
    } catch (e: unknown) {
      return { reader, lost: [], retell: '', error: String((e as Error)?.message || e).slice(0, 200) }
    }
  }
  const readers = await Promise.all([ask(READ_BACK_READERS[0]!, 'A'), ask(READ_BACK_READERS[1]!, 'B')])
  return { passed: readers.every(r => !r.error && r.retell && r.lost.length === 0), readers, checked_at: new Date().toISOString() }
}

export interface VideoScript {
  duration: string
  label: string
  title: string | null
  hook: string | null
  beats: VideoBeat[]
  /** Plain text, in the shape growth_creative_queue.script wants. */
  script: string
  /** Plain text, in the shape growth_creative_queue.shot_notes wants. */
  shot_notes: string
  word_count: number
  target_words: number
  notes: string | null
  unsupported_numbers: string[]
  /** Two fresh 12-year-old readers on the spoken words (house rule R7). */
  read_back: ReadBack
  generated_at: string
  model: string
}

const MODEL = UTILITY_MODEL

export async function buildVideoScript(o: {
  format: VideoFormat
  source: string
  title?: string | null
  thesis?: string | null
  citations?: string[]
  materials?: Material[]
  hint?: string | null
  /** The piece's series (lane_slot): its script opens with that series'
   *  line (house rule SERIES_OPENER). */
  series?: string | null
}): Promise<VideoScript> {
  const citations = (o.citations || []).filter(Boolean).slice(0, 8)
  const materials = o.materials || []

  const [voice, corpus] = await Promise.all([
    loadVoiceBlock().catch(() => ''),
    loadCorpus().catch(() => ''),
  ])
  // The house already has a spoken register written down, under YouTube.
  const register = corpusForChannel(corpus, 'youtube')
  const f = o.format
  const ceiling = wordCeiling(f)
  const opener = seriesOpener(o.series)

  const system = [
    'You are cutting an existing piece into a spoken video script. The argument does not change. The length, register and scaffolding do.',
    voice ? `VOICE REFERENCE:\n${voice}` : '',
    register ? `CHANNEL REGISTER (bend the script toward THIS rather than doing a generic rewrite):\n${register}` : '',
    `TARGET LENGTH: ${f.label}. The spoken words across ALL beats must total no more than ${ceiling} words, and should land near ${f.words}. Count them before you answer.`,
    `This is a hard ceiling, not a style note: ${f.words} words is what fits in ${f.seconds} seconds at an unhurried pace. Going over does not produce a longer ${f.label}, it produces a script that overruns, and at the short lengths that is the difference between a hook and a rambling clip. If the material will not fit, cut material. Do not speed up the delivery to make room.`,
    `STRUCTURE FOR THIS LENGTH (not a suggestion, this is what this length can carry):\n${f.shape}`,
    SPOKEN_RULES,
    // Krish, 2026-10-12: every video script of a series opens with its line,
    // and his name is said once, there (house rule SERIES_OPENER).
    opener ? `THE SERIES LINE (SERIES_OPENER): the first beat's "say" starts with exactly these words, then the hook: "${opener}" They count toward the ${ceiling}-word ceiling. Never say "I'm Krish" again after it, in the outro or anywhere else.` : '',
    // Formats under a minute have no room for the outro; everything longer carries the full story check.
    f.seconds >= 60 ? SCRIPT_STORY : 'THE STORY CHECK, short form: one clear question or claim, answered by the last line. Explain any number as it is said.',
    // Krish's house rules reach the spoken words and the shots. Before 2026-10-05 a script
    // could say "this week" about a month-old event, and planned a "till ringing" shot that
    // explained nothing (walk log, piece 1 launch).
    houseRulesBlock('write'),
    `FOR EVERY "shot" (what is on screen):\n${houseRulesBlock('visual')}`,
    'You may cut, compress, reorder and re-voice. You may NOT add a claim the source piece did not earn. EVERY NUMBER MUST APPEAR VERBATIM IN THE SOURCE. Do not compute totals, differences, percentages or rates, even when the arithmetic looks obvious.',
    'Return JSON only: {"beats":[{"t":string,"say":string,"shot":string}],"title":string,"hook":string,"notes":string|null}',
    '"t" is an approximate timecode for the start of the beat, as m:ss (for example "0:00", "0:12"). "say" is only the spoken words for that beat, verbatim, ready to read: no stage directions, labels, timings, notes or lines about the script itself (SCRIPT_ONLY); everything else goes in "shot" or "notes". "shot" is what is on screen during it: framing, b-roll, on-screen text, or a cut instruction. Keep "shot" concrete and short.',
    '"title" is a working video title that states the claim rather than teasing it. "hook" is the first line, repeated on its own because it does the most work.',
  ].filter(Boolean).join('\n\n')

  const user = [
    `PIECE: ${o.title || '(untitled)'}`,
    o.thesis ? `THESIS: ${o.thesis}` : '',
    citations.length ? `Citations available:\n${citations.join('\n')}` : '',
    materials.length ? materialsContext(materials) : '',
    `DRAFT:\n${o.source.slice(0, 14_000)}`,
    o.hint ? `INSTRUCTION: ${o.hint}` : '',
  ].filter(Boolean).join('\n\n')

  const ask = async (extra?: string) => {
    const out = await callClaude({
      agent: 'video',
      timeoutMs: 110_000,
      model: MODEL,
      temperature: 0.5,
      // A 20 minute script is ~3000 spoken words plus shot notes and JSON
      // scaffolding, so the ceiling scales with the format or the long ones
      // truncate mid-beat.
      maxTokens: Math.min(8000, 1500 + f.words * 2),
      system,
      user: extra ? `${user}\n\n${extra}` : user,
    })
    const parsed = (robustJson(out) || {}) as { beats?: any[]; title?: string; hook?: string; notes?: string | null }
    const beats: VideoBeat[] = (Array.isArray(parsed.beats) ? parsed.beats : [])
      .map((x: any) => ({
        t: String(x?.t || '').trim(),
        say: sanitizeVoice(String(x?.say || '').trim()),
        shot: String(x?.shot || '').trim(),
      }))
      .filter(x => x.say)
    return { parsed, beats, words: beats.map(x => x.say).join(' ').split(/\s+/).filter(Boolean).length }
  }

  // Measure, then hold it to the budget. The word count is the one instruction
  // the model reliably nods at and ignores: asked for a 15 second script at 40
  // words it returned 77, which is a competent 31 second script and therefore
  // the wrong object. One corrective pass with the real numbers in front of it
  // fixes this where restating the rule up front does not. The retry fires
  // above the same ceiling the prompt states: a 1.15 tolerance let a 3min
  // script of 496 to 517 words through, which story_check then refused.
  let attempt = await ask()
  if (attempt.beats.length && attempt.words > ceiling) {
    const trimmed = await ask(
      `Your previous attempt ran to ${attempt.words} spoken words. The ceiling is ${ceiling} and the target is ${f.words}. ` +
      `That is ${Math.round((attempt.words / f.words - 1) * 100)}% over, which at ${f.seconds} seconds overruns badly. ` +
      'Cut material, do not compress delivery: drop the least load-bearing beat entirely, and shorten the sentences that remain. Keep the hook and the ending. Return the same JSON shape.',
    ).catch(() => null)
    // Keep the retry only if it actually helped; a shorter-but-empty answer is
    // not an improvement.
    if (trimmed?.beats.length && trimmed.words < attempt.words) attempt = trimmed
  }

  const { parsed, beats } = attempt
  if (!beats.length) throw new Error('script came back empty')
  // The series line is said first, word for word: when the writer left it
  // out, it is put in front of the first beat rather than trusted to a retry.
  if (opener && !beats[0]!.say.startsWith(opener)) beats.unshift({ t: '0:00', say: opener, shot: 'Krish to camera, the series line' })

  const spoken = beats.map(x => x.say).join(' ')
  // Same check channel-cut runs. A script is read to camera, so an invented
  // figure gets said out loud with total confidence.
  const grounding = `${o.source} ${materials.map(m => m.content || '').join(' ')} ${citations.join(' ')}`
  // The read-back (house rule R7): two fresh readers, each a 12-year-old hearing it once.
  const read_back = await readBack(beats.map(x => x.say).join('\n\n'), ({ system: sys, user: u }) => callClaude({
    agent: 'video', timeoutMs: 45_000, model: MODEL, temperature: 0.2, maxTokens: 700, system: sys, user: u,
  }))

  return {
    duration: f.id,
    label: f.label,
    title: String(parsed.title || '').trim() || null,
    hook: String(parsed.hook || '').trim() || null,
    beats,
    script: beats.map(x => x.say).join('\n\n'),
    shot_notes: beats.map(x => `${x.t || '-'} ${x.shot}`.trim()).filter(Boolean).join('\n'),
    word_count: spoken.split(/\s+/).filter(Boolean).length,
    target_words: f.words,
    notes: parsed.notes ? String(parsed.notes) : null,
    unsupported_numbers: unsupportedNumbers(spoken, grounding),
    read_back,
    generated_at: new Date().toISOString(),
    model: MODEL,
  }
}
