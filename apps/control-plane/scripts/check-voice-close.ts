// The voice check wins over the script close.
//
// Ruling (Krish, 2026-11-14): the voice check wins; no script or caption may end on "deep dive". The house rule
// SCRIPT_CLOSE made every script end on "The full deep dive is at makeyourmindup.ai." (his line of 2026-10-21),
// and Control Center's voice check (the krish-voice kill list) bans "deep dive", so every script from 9 November
// failed the voice check on its last line alone. Asked which rule wins, his answer: "stick to voice check". The
// close is now SCRIPT_CLOSE_LINE in apps/control-plane/api/_houseRules.ts, "The full story is free at
// makeyourmindup.ai.", which passes check_voice on the script and caption channels.
//
// This guard stops the phrase coming back into anything that tells a writer what to write:
//
//   1. The house rules: no rule's name or text says it, nor any stage's houseRulesBlock (what a writer, judge or
//      final pass reads), and the close line itself never does. A rule's `said` is Krish's own words, kept verbatim
//      as history; no model reads it (houseRulesBlock reads the name and the text).
//   2. The script writer's prompt (apps/control-plane/api/_video.ts): STORY_OUTRO, SCRIPT_STORY, SCRIPT_OPENING,
//      SPOKEN_RULES and every format's shape, and STORY_OUTRO names the close line.
//   3. Every file of every skill (.agents/skills, .claude/skills), every prompt builder under apps/ and packages/,
//      the lints and checks in scripts/post-pack, scripts/quick-edit, scripts/velib, scripts/ve and scripts/voice,
//      the golden examples, and the docs that state the script rules. A hit passes only where ALLOWED names it:
//      a line that bans the phrase, or reads it as the label of a research document, never one that asks for it;
//      in the house rules a `said:` line is his words. An entry ALLOWED no longer needs fails too, so the list
//      cannot quietly grow stale.
//   4. The learnings register (config/learnings.json), which every session reads first: no meaning, reason or
//      marker says it; Krish's own words (`krish`) stay verbatim.
//
//   npm run check:voice-close   (npx tsx apps/control-plane/scripts/check-voice-close.ts)
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
/** The guard names the phrase on purpose, to find it. */
const SELF = 'apps/control-plane/scripts/check-voice-close.ts'
/** The phrase the voice check bans, in any case, spaced or hyphenated, singular or plural. */
export const PHRASE = /\bdeep[\s-]*dives?\b/i
const SKIP_DIRS = new Set(['node_modules', '.git', '__pycache__', 'dist', '.cache', '.vercel', 'fixtures'])
const TEXT = /\.(md|ts|tsx|mts|mjs|js|py|json|txt|yml|yaml|html)$/

/** Where the phrase may stand, each by file and the exact words on its line, and why it is no ask to write it. */
export const ALLOWED: ReadonlyArray<{ file: string; holds: string; why: string }> = [
  { file: 'apps/control-plane/api/_content.ts', holds: 'no "deep dive".', why: 'the writer\'s AI tells: it bans the phrase' },
  { file: 'apps/control-plane/api/_humor.ts', holds: '"unpack", "deep dive").', why: 'the humour pass\'s AI tells: it bans the phrase' },
  { file: 'apps/control-plane/api/_factGate.ts', holds: "parts.push(`${SOURCE_MARK}deep dive\\n${d}`)", why: 'labels the piece\'s research document (meta.deep_dive) among the fact gate\'s sources; never words to write' },
  { file: 'apps/control-plane/api/_factGate.ts', holds: "parts.push(`${SOURCE_MARK}deep dive${question ? `: ${question}` : ''}", why: 'the same research label, with its question' },
  { file: 'scripts/post-pack/title_check.py', holds: '"game changer", "a closer look", "deep dive", "the future of";', why: 'the title check\'s docstring: titles it refuses' },
  { file: 'scripts/post-pack/title_check.py', holds: 'know|game[- ]changer|a closer look|deep dive|the future of|', why: 'the title check refuses the phrase in a title' },
  { file: 'scripts/post-pack/voice_check.py', holds: "'buckle up', 'let\\'s dive', 'dive in', 'deep dive',", why: 'the article voice check\'s stock phrases: it refuses the phrase' },
  { file: 'scripts/post-pack/idea_checks.py', holds: "deeper|depth|deep dive|perplexity", why: 'finds research depth in an idea\'s notes; never words to write' },
  { file: 'scripts/post-pack/story_check.py', holds: "RETIRED_CLOSE = 'The full deep dive is at makeyourmindup.ai.'  # retired 2026-11-14: refused, never written", why: 'the retired close, kept only so the story check can refuse it and its self-test prove so' },
]

export interface Hit { file: string; line: number; text: string }

/** Every line of a text that holds the phrase. */
export function phraseHits(file: string, text: string): Hit[] {
  return text.split(/\r?\n/).flatMap((t, i) => (PHRASE.test(t) ? [{ file, line: i + 1, text: t }] : []))
}

/** True when a hit is one of Krish's own words kept verbatim: a house rule's `said:` line, which no model reads. */
function hisWords(hit: Hit): boolean {
  return hit.file === 'apps/control-plane/api/_houseRules.ts' && /^\s*said:\s/.test(hit.text)
}

/** Why the files' text breaks the rule (each hit nothing ALLOWED names), and each ALLOWED entry no file needs. */
export function textProblems(files: Array<[string, string]>, allowed = ALLOWED): string[] {
  const used = new Set<number>()
  const out: string[] = []
  const scanned = new Set(files.map(([f]) => f))
  for (const [file, text] of files) {
    for (const hit of phraseHits(file, text)) {
      if (hisWords(hit)) continue
      const i = allowed.findIndex(a => a.file === hit.file && hit.text.includes(a.holds))
      if (i >= 0) { used.add(i); continue }
      out.push(`${hit.file}:${hit.line} asks for the phrase the voice check bans ("${hit.text.trim().slice(0, 110)}"): `
        + 'write the close as SCRIPT_CLOSE_LINE ("The full story is free at makeyourmindup.ai."), or name the line in ALLOWED only if it bans the phrase')
    }
  }
  allowed.forEach((a, i) => {
    if (!used.has(i) && scanned.has(a.file)) out.push(`ALLOWED names ${a.file} ("${a.holds.slice(0, 60)}") but no line there needs it any more: take it out`)
  })
  return out
}

/** Why the house rules or the writer's prompt carry the phrase, [] when neither does. */
export function promptProblems(input: {
  closeLine: string
  rules: ReadonlyArray<{ id: string; name: string; text: string }>
  blocks: Record<string, string>
  prompts: Record<string, string>
}): string[] {
  const out: string[] = []
  if (PHRASE.test(input.closeLine) || !/makeyourmindup\.ai\.$/.test(input.closeLine)) {
    out.push(`SCRIPT_CLOSE_LINE ("${input.closeLine}") must send the viewer to makeyourmindup.ai and pass the voice check`)
  }
  for (const r of input.rules) {
    if (PHRASE.test(r.name) || PHRASE.test(r.text)) out.push(`house rule ${r.id} says the phrase the voice check bans in its name or text`)
  }
  for (const [stage, block] of Object.entries(input.blocks)) {
    if (PHRASE.test(block)) out.push(`the house rules a ${stage} stage reads say the phrase the voice check bans`)
  }
  for (const [name, prompt] of Object.entries(input.prompts)) {
    if (PHRASE.test(prompt)) out.push(`the script writer's ${name} says the phrase the voice check bans`)
  }
  if (input.prompts.STORY_OUTRO !== undefined && !input.prompts.STORY_OUTRO.includes(input.closeLine)) {
    out.push('STORY_OUTRO does not end the script on SCRIPT_CLOSE_LINE')
  }
  return out
}

/** Why a JSON register says the phrase outside the keys that hold Krish's own words, [] when it does not. */
export function jsonProblems(file: string, data: unknown, hisKeys: ReadonlySet<string>): string[] {
  const out: string[] = []
  const walk = (v: unknown, at: string) => {
    if (typeof v === 'string') { if (PHRASE.test(v)) out.push(`${file} ${at} says the phrase the voice check bans ("${v.slice(0, 90)}")`); return }
    if (Array.isArray(v)) { v.forEach((x, i) => walk(x, `${at}[${i}]`)); return }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (!hisKeys.has(k)) walk(x, at ? `${at}.${k}` : k)
  }
  walk(data, '')
  return out
}

function walk(dir: string, out: string[] = []): string[] {
  let names: string[]
  try { names = readdirSync(join(ROOT, dir)) } catch { return out }
  for (const name of names) {
    const rel = `${dir}/${name}`
    if (SKIP_DIRS.has(name)) continue
    if (statSync(join(ROOT, rel)).isDirectory()) walk(rel, out)
    else if (TEXT.test(name) && !/\.test\.[cm]?[jt]sx?$/.test(name) && rel !== SELF) out.push(rel)
  }
  return out
}

/** The files rule 3 reads: what tells a writer, a judge or a lint what a script or a caption says. */
export function scopeFiles(): string[] {
  const dirs = ['.agents/skills', '.claude/skills', 'apps', 'packages', 'scripts/post-pack', 'scripts/quick-edit', 'scripts/velib', 'scripts/ve', 'scripts/voice']
  const docs = ['AGENTS.md', 'CLAUDE.md', 'docs/AGENTS-REFERENCE.md', 'docs/AMPLIFICATION.md', 'docs/CADENCE.md', 'docs/CONTENT_ENGINE.md',
    'docs/PUBLISH_BOARDS.md', 'docs/GROWTH-HANDOFF.md', 'docs/CAROUSEL-STANDARD.md', 'docs/ve/ENGINE.md', 'docs/ve/RUNBOOK.md', 'config/golden-examples.json']
  return [...dirs.flatMap(d => walk(d)), ...docs].map(f => relative(ROOT, join(ROOT, f)).split('\\').join('/'))
}

export async function check(): Promise<string[]> {
  const house = await import('../api/_houseRules.ts')
  const video = await import('../api/_video.ts')
  const stages = [...new Set(house.HOUSE_RULES.flatMap(r => r.stages))]
  const problems = promptProblems({
    closeLine: house.SCRIPT_CLOSE_LINE,
    rules: house.HOUSE_RULES,
    blocks: Object.fromEntries(stages.map(s => [s, house.houseRulesBlock(s)])),
    prompts: {
      STORY_OUTRO: video.STORY_OUTRO, SCRIPT_STORY: video.SCRIPT_STORY, SCRIPT_OPENING: video.SCRIPT_OPENING, SPOKEN_RULES: video.SPOKEN_RULES,
      ...Object.fromEntries(video.VIDEO_FORMATS.map(f => [`${f.id} shape`, f.shape])),
    },
  })
  const files = scopeFiles().flatMap(f => { try { return [[f, readFileSync(join(ROOT, f), 'utf8')] as [string, string]] } catch { return [] } })
  problems.push(...textProblems(files))
  problems.push(...jsonProblems('config/learnings.json', JSON.parse(readFileSync(join(ROOT, 'config/learnings.json'), 'utf8')), new Set(['krish'])))
  return problems
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const problems = await check()
  if (problems.length) {
    for (const p of problems) console.log(`FAIL  ${p}`)
    console.log(`voice-close guard: ${problems.length} problem(s). Ruling (Krish, 2026-11-14): the voice check wins over the script close ("stick to voice check").`)
    process.exit(1)
  }
  console.log('PASS  voice-close guard: no script rule, prompt, skill or lint asks for the phrase the voice check bans, and every script ends on SCRIPT_CLOSE_LINE')
}
