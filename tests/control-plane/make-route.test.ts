import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { NEVER_HEADLESS, ROUTE_RULING, makeRoute, routeLine } from '../../apps/control-plane/api/board/_makeRoute'
import { OFFDAY_KINDS, itemPrompt, offdayHead } from '../../apps/control-plane/api/board/_weekModel'

// The one route for a carousel, a meme, a Notes image and an off-day voiceover short (Rulings, Krish, 2026-11-13: "all
// the carousels should now be done in Claude, but using the Codex plug in as per the other usual workflows"; "memes and
// Notes images should go the same way"; "Off-day voiceover shorts should go the same way too"). Every prompt the board
// copies out for one of them, and every document that tells a session how to make one, says the route; the retired
// routes (the Studio's carousel commands and their renderer, Growth's Saturday art-direction run) are named nowhere
// outside docs/history and this guard. `findings` is the guard; the last block proves it can fail on the old words.

/** The retired routes, by every name they went by. */
export const RETIRED: Array<[RegExp, string]> = [
  [/studio carousel/i, 'the Studio carousel commands'],
  [/carousel engine/i, 'the old carousel engine'],
  [/carousel director/i, 'the old carousel director'],
  [/CAROUSEL_ENGINE_STATE/, 'the old carousel engine record (docs/history now)'],
  [/carousel-direction\.md/, 'the old carousel direction reference'],
  [/MindmakeCarouselSlide|HouseCarouselCard|renderCarousel|packageCarousel/, 'the old carousel renderer'],
  [/\bartdirect\b|ARTDIRECT_PROMPT/i, "Growth's retired Saturday art-direction run"],
]
/** A way of making one of these with no Claude session in it. */
export const HEADLESS: Array<[RegExp, string]> = [
  [/\bcodex exec\b|@openai\/codex|codex login --with-api-key/i, 'a headless Codex run'],
  [/\bin (?:the )?Canva\b[^.\n]{0,40}\b(?:memes?|notes? images?)\b|\b(?:memes?|notes? images?)\b[^.\n]{0,40}\bin Canva\b/i, 'memes or Notes images made in Canva'],
]

/** The text a session reads, with the blocks ai-harness renders (and owns) left out. */
export function ownText(text: string): string {
  return text.replace(/<!-- (krish-canon|krish-repo-context|krish-repo-admin):start[\s\S]*?<!-- \1:end -->/g, '')
}

/** Every retired route or headless way of making one that `text` names, as `<file>: <why>`. */
export function findings(file: string, text: string, rules = [...RETIRED, ...HEADLESS]): string[] {
  const own = ownText(text)
  return rules.filter(([re]) => re.test(own)).map(([, why]) => `${file}: names ${why}`)
}

// CRLF on a Windows checkout reads as LF here, so a source-text match means the same on every runner (full verify was
// red on Windows from 13 Nov over this file's produce_day.py match).
const read = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n')

/** The documents and prompts that tell a session how one of these is made. Each says the route. */
const TELLS_HOW = [
  'docs/CAROUSEL-STANDARD.md', 'docs/GROWTH-HANDOFF.md', 'docs/PUBLISH_BOARDS.md', 'AGENTS.md',
  '.agents/skills/plan-week/references/offdays.md', '.agents/skills/produce-video/SKILL.md', '.agents/skills/ve/SKILL.md',
  '.claude/skills/produce-video/SKILL.md', '.claude/skills/ve/SKILL.md', '.agents/skills/ve/references/pictures.md',
  'apps/control-plane/api/board/_makeRoute.ts',
]

/** Kept in the repository on purpose, each with its reason; nothing else outside docs/history may name a retired route. */
const DATED = new Map<string, string>([
  ['NOW.md', 'written only by the closeout fold on main (scripts/check_now_untouched.py); its stale-documents line goes at the next steward pass'],
  ['docs/walks/2026-09-three-piece-walk.md', 'a dated engineering walk of September 2026, describing the Studio as it was'],
  ['docs/handovers/2026-11-03-board-offdays-and-saturday.md', 'a dated handover of 3 November 2026'],
  ['tests/control-plane/make-route.test.ts', 'this guard'],
])

describe('the one route for carousels, memes, Notes images and off-day voiceover shorts (Rulings, Krish, 2026-11-13)', () => {
  it('sorts every off-day kind onto its route by what it is', () => {
    expect(OFFDAY_KINDS.map(k => k.key)).toEqual(['supporting', 'voiceover', 'explainer', 'good_news', 'meme'])
    const cases: Array<[string, string, ReturnType<typeof makeRoute>]> = [
      ['supporting', 'Level-up move, carousel, 4 cards, 4:5', 'still'],
      ['good_news', 'Uplifting AI news carousel, 6 cards, 4:5', 'still'],
      ['explainer', 'Explainer carousel, infographic, 5 cards, 4:5', 'still'],
      ['meme', 'Meme, 1 image, 4:5', 'still'],
      ['meme', 'Meme carousel, 3 cards, 4:5', 'still'],
      ['explainer', 'Substack Note with an image', 'still'],
      ['voiceover', 'Voiceover short with motion graphics, about 40 seconds, 9:16', 'motion'],
      ['good_news', 'Uplifting AI news short, voiceover over real footage, about 45 seconds, 9:16', 'motion'],
      ['meme', 'Meme video, 9:16', 'motion'],
      ['explainer', "30-second short, cut from Friday's video", null],
    ]
    for (const [kind, format, route] of cases) expect([kind, format, makeRoute(kind, format)]).toEqual([kind, format, route])
  })

  it('puts the route in the Claude prompt of every approved off-day post', () => {
    const base = { day: 'tue' as const, date: '2026-11-17', title: 'An approved post', line: 'Approved by you.', piece_id: null, key: 'off-tue-x' }
    const still = itemPrompt('2026-11-16', { ...base, kind_label: 'Carousel for Monday\'s piece' }, 'post', 'still')
    const motion = itemPrompt('2026-11-16', { ...base, kind_label: 'Voiceover short' }, 'post', 'motion')
    for (const a of [still, motion]) {
      expect(a.label).toBe('Copy prompt for Claude')
      if (a.kind !== 'prompt') throw new Error('not a prompt')
      expect(a.prompt).toContain(ROUTE_RULING)
      expect(a.prompt).toContain(NEVER_HEADLESS)
      expect(a.prompt).toContain('Codex plugin')
      expect(a.prompt).toContain('Keep the board current as you work')
      expect(findings('prompt', a.prompt)).toEqual([])
    }
    if (still.kind !== 'prompt' || motion.kind !== 'prompt') throw new Error('not a prompt')
    for (const words of ['scripts/carousel_check.py', 'scripts/ve.py card', 'config/brand-palette.json', '10/10 judges', '3 Posts', 'inspiration cards Krish ticked']) {
      expect(still.prompt).toContain(words)
    }
    for (const words of ['ve route', 'docs/ve/ENGINE.md', 'signed spec', 've verify-card', 'separate reviewer watches and listens', 'The voice comes from where it comes from today']) {
      expect(motion.prompt).toContain(words)
    }
    expect(routeLine('still')).not.toBe(routeLine('motion'))
    // A post neither route makes keeps the plain hand-off to Growth.
    expect(offdayHead(null)).toContain('Growth makes and posts off-day posts')
  })

  it('every document that tells a session how one is made says the route and names no retired one', () => {
    for (const file of TELLS_HOW) {
      const text = read(file)
      expect([file, findings(file, text)]).toEqual([file, []])
      const flat = ownText(text).replace(/\s+/g, ' ')
      expect([file, /Claude session/.test(flat) && /Codex plugin|ve route/.test(flat)]).toEqual([file, true])
    }
    const standard = read('docs/CAROUSEL-STANDARD.md').replace(/\s+/g, ' ')
    expect(standard).toContain('## How a carousel is made (Ruling, Krish, 13 November 2026)')
    for (const words of ['all the carousels should now be done in Claude', 'memes and Notes images should go the same way', 'Off-day voiceover shorts should go the same way too']) {
      expect(standard).toContain(words)
    }
  })

  it('names the retired routes nowhere in the repository outside docs/history', () => {
    const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean)
      .filter(f => !f.startsWith('docs/history/') && !DATED.has(f) && /\.(md|ts|tsx|mjs|js|py|json|ya?ml|ps1|sh|txt)$/.test(f))
    const found = files.flatMap(f => {
      let text: string
      try { text = read(f) } catch { return [] }
      return findings(f, text, RETIRED)
    })
    expect(found).toEqual([])
  })

  it('makes none of them in a scheduled job, a headless model run or a template engine', () => {
    const flows = execFileSync('git', ['ls-files', '.github/workflows'], { encoding: 'utf8' }).split('\n').filter(f => /\.ya?ml$/.test(f))
    expect(flows.length).toBeGreaterThan(5)
    for (const flow of flows) expect(findings(flow, read(flow), HEADLESS)).toEqual([])
    // The day runner makes series days only: an off-day short is made on the ve route from a Claude session.
    expect(read('scripts/produce_day.py')).toMatch(/off = offday_reason\(post_path\)\n\s+if off:\n\s+raise Stop\(off\)/)
  })

  it('can fail: the words the board and the documents carried before the ruling are refused', () => {
    // The off-day prompt as it stood on 12 Nov: no route in it.
    const old = 'Growth makes and posts off-day posts (krishanraja/growth-makeyourmindup), to content-engine docs/CAROUSEL-STANDARD.md and the rejection floor. Make or post exactly what Krish approved, nothing else.'
    expect(old.includes(ROUTE_RULING) || old.includes(NEVER_HEADLESS)).toBe(false)
    expect(findings('old', 'Use content-engine production and editorial guidance, its live mandate, docs/CAROUSEL_ENGINE_STATE.md and docs/STYLE_REFERENCES.md.')).toHaveLength(1)
    expect(findings('old', 'This is the current-state record of the Mindmake Carousel Engine (the `studio carousel` commands).')).toHaveLength(2)
    expect(findings('old', 'python3 growth.py run artdirect check render/pieces/off-sat-goodnews')).toHaveLength(1)
    expect(findings('old', 'Growth makes Substack Notes and memes in Canva, the formats content-engine does not cover')).toHaveLength(1)
    expect(findings('old', 'npm install --global @openai/codex@0.165.0 && printenv OPENAI_API_KEY | codex login --with-api-key')).toHaveLength(1)
    // The generated canon block is ai-harness's to change, so it is left out of a file's own text.
    expect(findings('AGENTS.md', '<!-- krish-canon:start x -->\n`docs/CAROUSEL_ENGINE_STATE.md`\n<!-- krish-canon:end -->')).toEqual([])
  })
})
