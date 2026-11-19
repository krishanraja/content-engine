// Growth's audience brief of 16 Nov 2026 (Control Center material cbb90470; growth-makeyourmindup
// docs/briefs/2026-11-16-content-engine-what-the-audience-tells-us.md): nine production changes read from six weeks of
// audience numbers. Ruling (Krish, 2026-11-16): "apply 1 to 6 from the next piece you make this week". This file
// holds the six where they are enforced and the nine where they are recorded (config/learnings.json).
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import { HOUSE_RULES, SHORT_CUT, rulesFor } from '../../apps/control-plane/api/_houseRules.js'
import { articleSubscribeAsks, publishChecks } from '../../apps/control-plane/api/_publishChecks.js'

const py = process.platform === 'win32' ? 'python' : 'python3'
const rule = (id: string) => {
  const r = HOUSE_RULES.find(x => x.id === id)
  assert.ok(r, id)
  return r!
}

const ARTICLE = `Disney is paying Character.AI to put its films inside a chatbot.

Three pieces a week on what AI changes in your business, each ending on three things you can do tomorrow. Subscribe free.

## What happened

Fans chat with the heroes, and Disney gets paid each time.

## 3 things you can do tomorrow

- Ask your agency who owns your brand's chatbot chats.
- List the characters fans already talk to.
- Price one chat against one survey reply.

Three pieces a week on what AI changes in your business, each ending on three things you can do tomorrow. Subscribe free.
`

describe('Growth\'s audience brief of 16 Nov: changes 1 to 6 are enforced from the next piece', () => {
  test('the short cut is read from one block: 20 to 35 seconds from change 2, then 60 to 90 from his ruling of 17 Nov', () => {
    // Ruling (Krish, 2026-11-17): "75 word script is insanely short. the AI music short is about the right amount of
    // words, maybe just less" (config/script-floor/ai-music-short.said.txt).
    assert.deepEqual([SHORT_CUT.fewest_s, SHORT_CUT.most_s, SHORT_CUT.fewest_words, SHORT_CUT.most_words, SHORT_CUT.from], [60, 90, 160, 210, '2026-11-18'])
    const two = rule('TWO_CUTS')
    assert.match(two.text, /60 to 90 seconds as he says it, about the length of his AI music short/)
    assert.match(two.said, /apply 1 to 6 from the next piece you make this week/)
    assert.match(two.said, /75 word script is insanely short/)
    assert.match(rule('HOOK_AND_CTA').text, /inside 90 seconds/) // true again since 17 Nov
    assert.doesNotMatch(rule('SCRIPT_AS_HE_TALKS').text, /200 script words for the 90-second cut/)
  })

  test('each new rule is live from 16 Nov, carries his words and reaches the stages that make it (changes 1, 3 to 6)', () => {
    const want: Record<string, string[]> = {
      FIRST_TWO_SECONDS: ['visual', 'production'],
      ONE_CONCRETE_THING: ['judge_idea', 'write', 'judge_draft', 'final_pass'],
      FOR_THE_LEADER: ['write', 'judge_draft', 'final_pass'],
      WRITTEN_EDITION: ['production'],
      ARTICLE_SUBSCRIBE_ASK: ['write', 'publish_check'],
    }
    for (const [id, stages] of Object.entries(want)) {
      const r = rule(id)
      assert.equal(r.on, '2026-11-16', id)
      assert.equal(r.status, 'live', id)
      assert.deepEqual(r.stages, stages, id)
      assert.match(r.said, /apply 1 to 6 from the next piece you make this week/, id)
      assert.match(r.source, /audience brief of 16 Nov 2026/, id)
      assert.doesNotMatch(r.text, /—|!/, id)
    }
    for (const id of ['ONE_CONCRETE_THING', 'FOR_THE_LEADER', 'ARTICLE_SUBSCRIBE_ASK']) {
      assert.ok(rulesFor('write').some(r => r.id === id), `${id} reaches every writer`)
    }
  })

  test('the subscribe ask never promises a call or a public scorecard: change 7 is withdrawn with the prediction format (Rulings, Krish, 2026-11-17 and 2026-11-18)', () => {
    const text = rule('ARTICLE_SUBSCRIBE_ASK').text
    assert.match(text, /never a prediction, a call or a public scorecard/)
    assert.doesNotMatch(text, /dated call|scorecard of every call/)
    assert.match(text, /each ending on three things you can do tomorrow/)
  })

  test('an article that asks near the top and right after its three actions passes; each missing ask is named (change 6)', () => {
    assert.deepEqual(articleSubscribeAsks(ARTICLE), { ok: true, detail: 'Asks for the subscription near the top and right after the key takeaway.' })
    const noTop = ARTICLE.replace(/^Three pieces[^\n]*\n\n/m, '')
    assert.equal(articleSubscribeAsks(noTop).ok, false)
    assert.match(articleSubscribeAsks(noTop).detail, /near the top/)
    const noEnd = ARTICLE.trimEnd().split('\n').slice(0, -2).join('\n')
    assert.equal(articleSubscribeAsks(noEnd).ok, false)
    assert.match(articleSubscribeAsks(noEnd).detail, /right after the three actions/)
    // An ask written as a fourth action is no ask, and breaks the three as well.
    assert.equal(articleSubscribeAsks(noEnd.replace('- Price one chat against one survey reply.', '- Price one chat.\n- Subscribe free.')).ok, false)
  })

  test('the publish check carries it, not blocking until Krish has seen pieces carry it, as THREE_THINGS_TOMORROW', () => {
    const check = publishChecks(ARTICLE, { ok: false } as never).find(c => c.id === 'ARTICLE_SUBSCRIBE_ASK')
    assert.ok(check)
    assert.equal(check!.blocking, false)
    assert.equal(check!.ok, true)
  })

  test('the script check holds the short cut, the named opening and the leader stake; the written edition has its own check (changes 2 to 5)', () => {
    for (const script of ['scripts/post-pack/story_check.py', 'scripts/post-pack/written_edition_check.py']) {
      const run = spawnSync(py, [script, '--self-test'], { encoding: 'utf8' })
      assert.equal(run.status, 0, `${script}: ${run.stdout}${run.stderr}`)
    }
  })

  test('this week\'s off-day options, made before the ruling, still read; the week of 23 Nov\'s are held to the new short rules (since 17 Nov a 90-second take fits SHORT_CUT again, so ONE_CONCRETE_THING holds it)', () => {
    const py3 = ['import sys, json', "sys.path.insert(0, 'scripts/post-pack')", 'import week_plan as wb',
      "d = json.load(open('tests/fixtures/plans/2026-11-16-ideas.json', encoding='utf-8'))",
      "print(sorted(wb.read_offdays(d['offdays'], week='2026-11-16')))",
      'try:', "    wb.read_offdays(d['offdays'], week='2026-11-23'); print('passed')",
      'except wb.BoardError as e:', "    print('held' if 'ONE_CONCRETE_THING' in str(e) else str(e))"].join('\n')
    const run = spawnSync(py, ['-c', py3], { encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr)
    assert.deepEqual(run.stdout.trim().split('\n'), ["['sat', 'thu', 'tue']", 'held'])
  })

  test('ve lint holds a vertical from 16 Nov to SHORT_CUT and to its first event by the second word (changes 1 and 2)', () => {
    const lint = readFileSync('scripts/velib/lint.py', 'utf8')
    assert.match(lint, /def short_cut\(\)/)
    assert.match(lint, /house rule FIRST_TWO_SECONDS/)
  })
})

describe('a good-news option short of five stories reads when it says why (plan-week references/offdays.md)', () => {
  test('four stories with stories_short read; four without it, or none, do not; five always do', () => {
    const py5 = ['import sys, json', "sys.path.insert(0, 'scripts/post-pack')", 'import week_plan as wb',
      "s = {'headline': 'h', 'what': 'w', 'why': 'y', 'date': '2026-11-12', 'source': {'label': 'l', 'url': 'https://a'}, 'media': {'kind': 'photo', 'url': 'https://b'}}",
      "print(json.dumps([wb.story_problems([s] * 4, 'only four on the topic this week'), wb.story_problems([s] * 4), wb.story_problems([], 'none'), wb.story_problems([s] * 5)]))"].join('\n')
    const run = spawnSync(py, ['-c', py5], { encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr)
    const [shortWithWhy, shortBare, none, five] = JSON.parse(run.stdout)
    assert.deepEqual([shortWithWhy, five], [[], []])
    assert.equal(shortBare.length, 1)
    assert.equal(none.length, 1)
  })
})

describe('all nine are recorded in the learnings register, each citing the brief', () => {
  const register = JSON.parse(readFileSync('config/learnings.json', 'utf8'))
  const nine = register.learnings.filter((l: { brief?: { material?: string } }) => l.brief?.material === 'cbb90470-7d90-4f54-8d98-cf6ec704b5f2')

  test('nine entries, numbered 1 to 9, the first six encoded and the last three open', () => {
    assert.deepEqual(nine.map((l: { brief: { change: number } }) => l.brief.change), [1, 2, 3, 4, 5, 6, 7, 8, 9])
    assert.deepEqual(nine.map((l: { status: string }) => l.status),
      ['encoded', 'encoded', 'encoded', 'encoded', 'encoded', 'encoded', 'open', 'open', 'open'])
    for (const l of nine) {
      assert.match(l.brief.path, /growth-makeyourmindup docs\/briefs\/2026-11-16-content-engine-what-the-audience-tells-us\.md/)
      assert.ok(['floor', 'house_rule', 'skill', 'test', 'not_adopted_here'].some(k => (l.brief.becomes || []).includes(k)), l.id)
    }
  })
})
