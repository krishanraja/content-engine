import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALLOWED, PHRASE, check, jsonProblems, promptProblems, scopeFiles, textProblems } from '../../apps/control-plane/scripts/check-voice-close.js'
import { HOUSE_RULES, SCRIPT_CLOSE_LINE, houseRulesBlock } from '../../apps/control-plane/api/_houseRules.js'
import { STORY_OUTRO } from '../../apps/control-plane/api/_video.js'

// Ruling (Krish, 2026-11-14): the voice check wins; no script or caption may end on "deep dive". SCRIPT_CLOSE's old
// last line, "The full deep dive is at makeyourmindup.ai.", failed Control Center's voice check on every script from
// 9 November; his answer, asked which rule wins: "stick to voice check". The guard (apps/control-plane/scripts/check-voice-close.ts)
// stops the phrase coming back into a rule, a prompt, a skill or a lint. Each rule here is shown failing on the
// tree as it stood before the ruling, or on a planted breach, and passing the tree as it is.

const ROOT = join(__dirname, '..', '..')
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8')
const OLD = 'The full deep dive is at makeyourmindup.ai.'

describe('the voice-close guard', () => {
  it('passes the tree as it is, and the close line passes the voice check\'s phrase', async () => {
    expect(await check()).toEqual([])
    expect(SCRIPT_CLOSE_LINE).toBe('The full story is free at makeyourmindup.ai.')
    expect(PHRASE.test(SCRIPT_CLOSE_LINE)).toBe(false)
    expect(PHRASE.test(OLD)).toBe(true)
    expect(STORY_OUTRO).toContain(SCRIPT_CLOSE_LINE)
  })

  it('rules 1 and 2: the house rules or the writer\'s prompt asking for the old line again fail', () => {
    const rules = HOUSE_RULES.map(r => ({ id: r.id, name: r.name, text: r.text }))
    const blocks = { write: houseRulesBlock('write') }
    const clean = { closeLine: SCRIPT_CLOSE_LINE, rules, blocks, prompts: { STORY_OUTRO } }
    expect(promptProblems(clean)).toEqual([])
    // The SCRIPT_CLOSE text as it stood before the ruling.
    const before = rules.map(r => (r.id === 'SCRIPT_CLOSE' ? { ...r, text: r.text.replace(SCRIPT_CLOSE_LINE, OLD) } : r))
    expect(promptProblems({ ...clean, rules: before })).toEqual(['house rule SCRIPT_CLOSE says the phrase the voice check bans in its name or text'])
    expect(promptProblems({ ...clean, blocks: { write: blocks.write.replace(SCRIPT_CLOSE_LINE, OLD) } })).toEqual(['the house rules a write stage reads say the phrase the voice check bans'])
    expect(promptProblems({ ...clean, closeLine: OLD })).toHaveLength(2) // the line itself, and STORY_OUTRO no longer ends on it
    expect(promptProblems({ ...clean, prompts: { STORY_OUTRO: STORY_OUTRO.replace(SCRIPT_CLOSE_LINE, OLD) } })).toEqual([
      'the script writer\'s STORY_OUTRO says the phrase the voice check bans',
      'STORY_OUTRO does not end the script on SCRIPT_CLOSE_LINE',
    ])
  })

  it('rule 3: the old close planted back into a skill, a lint or a rule doc fails; a ban, a research label and his own words pass', () => {
    const files: Array<[string, string]> = scopeFiles().map(f => { try { return [f, read(f)] as [string, string] } catch { return null } }).filter((x): x is [string, string] => !!x)
    expect(textProblems(files)).toEqual([])
    const plant = (file: string, from: string, to: string) => files.map(([f, t]) => [f, f === file ? t.replace(from, to) : t] as [string, string])
    const skill = '.agents/skills/make-piece/SKILL.md'
    expect(read(skill)).toContain('sentence, exactly "The full story is free at')
    const hits = textProblems(plant(skill, 'sentence, exactly "The full story is free at', 'sentence, exactly "The full deep dive is at'))
    expect(hits).toHaveLength(1)
    expect(hits[0]).toMatch(/^\.agents\/skills\/make-piece\/SKILL\.md:\d+ asks for the phrase the voice check bans/)
    const lint = 'scripts/post-pack/story_check.py'
    expect(textProblems(plant(lint, 'end on exactly "{close_line()}"', 'end on exactly "the full deep-dive"')).length).toBe(1)
    const doc = 'docs/AMPLIFICATION.md'
    expect(textProblems(plant(doc, '("The full story is free at makeyourmindup.ai."', `("${OLD}"`)).length).toBe(1)
    // A house rule's said: line is his words, which no model reads; its text is not.
    const rules = 'apps/control-plane/api/_houseRules.ts'
    expect(read(rules).split('\n').some(l => /^\s*said:/.test(l) && PHRASE.test(l))).toBe(true)
    expect(textProblems(plant(rules, 'then where the full story is free to read', 'then where the full deep dive is')).length).toBe(1)
    // An entry ALLOWED no longer needs is named, so the list cannot grow stale.
    const stale = textProblems(plant('apps/control-plane/api/_content.ts', 'no "deep dive".', 'no "dive in".'))
    expect(stale).toEqual([expect.stringMatching(/^ALLOWED names apps\/control-plane\/api\/_content\.ts .* no line there needs it any more/)])
    // Only the story check keeps the old line, and only to refuse it.
    expect(ALLOWED.filter(a => a.holds.includes(OLD)).map(a => a.file)).toEqual(['scripts/post-pack/story_check.py'])
  })

  it('rule 4: the learnings register may quote him, never ask for the phrase itself', () => {
    const learnings = JSON.parse(read('config/learnings.json'))
    expect(jsonProblems('config/learnings.json', learnings, new Set(['krish']))).toEqual([])
    const old = JSON.parse(JSON.stringify(learnings))
    old.learnings.find((l: { id: string }) => l.id === 'voice-check-wins-the-close').means = `Every script ends on "${OLD}"`
    expect(jsonProblems('config/learnings.json', old, new Set(['krish']))).toHaveLength(1)
    expect(learnings.learnings.some((l: { krish: string }) => PHRASE.test(l.krish))).toBe(true) // his words of 2026-10-21 stay verbatim
  })

  it('runs in verify, so every pull request is checked', () => {
    const pkg = JSON.parse(read('package.json'))
    expect(pkg.scripts['check:voice-close']).toBe('tsx apps/control-plane/scripts/check-voice-close.ts')
    expect(pkg.scripts.verify).toContain('npm run check:voice-close')
  })
})
