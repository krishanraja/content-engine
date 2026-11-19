// The dated-prediction format is abandoned.
//
// Ruling (Krish, 2026-11-17): "I don't do dated-and-scored make-your-mind-up pieces because it felt quite tacky and
// gimmicky. I don't really have the clout such that my opinion can hold up in official scores."
// Ruling (Krish, 2026-11-18): "get rid of that - i have abandoned the prediction format, it feels lame".
//
// He had said it on 2026-10-26 ("I am kind of bored of making predictions"), and the engine answered with a table of
// per-piece exceptions while every other piece stayed blocked without a dated call. This file holds the whole rule:
// a piece with no prediction passes every publish check, and no house rule, writer prompt or judge asks for one.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import { HOUSE_RULES, houseRulesBlock, rulesFor } from '../../apps/control-plane/api/_houseRules.js'
import { publishChecks, publishStatus } from '../../apps/control-plane/api/_publishChecks.js'
import { VOICE_GUARDRAILS } from '../../apps/control-plane/api/_content.js'
import { VOICE_ABSOLUTES } from '../../apps/control-plane/api/_finalPass.js'

const factsOk = { ok: true, reason: null }

// A whole article in the house shape, with no prediction anywhere: a subscribe ask near the top, its sections, and
// "3 things you can do tomorrow" as the close with the second ask after it.
const NO_PREDICTION = `A small shop in Leeds now pays less for its AI helper than for its coffee.

Three pieces a week on what AI changes in your business, each ending on three things you can do tomorrow. Subscribe free.

## What happened

The shop moved its customer emails to a cheaper AI helper last month. Its bill fell by half, and the replies still read well.

## Why it matters

Small firms can now try the same tools the big ones use. The price of trying has dropped, so the risk of waiting has gone up.

## Where it leads

More small shops will treat their AI helper like a utility bill. They will shop around for it each year, and the sellers will compete on trust as well as price.

## 3 things you can do tomorrow

- List every AI tool your team pays for.
- Ask each seller what you pay per reply.
- Pick one task to try on a cheaper helper this week.

Three pieces a week on what AI changes in your business, each ending on three things you can do tomorrow. Subscribe free.
`

const RETIRED_CHECKS = ['CALL', 'CALL_HORIZON', 'CLEAR_STANCE']

describe('a piece with no prediction passes the publish checks', () => {
  test('the whole checklist is green, and no check asks for a date, a confidence or a stance', () => {
    const checks = publishChecks(NO_PREDICTION, factsOk)
    const status = publishStatus(checks)
    assert.equal(status.ok, true, status.reason ?? '')
    assert.deepEqual(checks.filter(c => !c.ok).map(c => c.id), [])
    for (const id of RETIRED_CHECKS) assert.ok(!checks.some(c => c.id === id), `${id} is back`)
    for (const c of checks) assert.doesNotMatch(`${c.name} ${c.detail}`, /predict|confidence|stance|how sure|due within/i, c.id)
  })

  test('the pieces that once needed Krish\'s exception pass with none: the per-piece tables are gone', () => {
    // 26 Oct: Friday's and Wednesday's pieces, closed on his own story instead of a call; 22 Oct: the retrospective.
    for (const file of ['docs/plans/2026-10-28-draft-body.md', 'docs/plans/2026-10-19-week/wednesday-article-draft.md']) {
      const checks = publishChecks(readFileSync(file, 'utf8').replace(/\r\n/g, '\n'), factsOk)
      for (const c of checks) assert.doesNotMatch(`${c.name} ${c.detail}`, /predict|exempt by krish|retrospective exception/i, `${file}: ${c.id}`)
    }
    const src = readFileSync('apps/control-plane/api/_publishChecks.ts', 'utf8')
    for (const gone of ['FRIDAY_HORIZON_EXCEPTION', 'WEDNESDAY_RETROSPECTIVE_EXCEPTION', 'NO_PREDICTION_PIECES', 'CALL_HORIZON_DAYS', 'CLEAR_STANCE_AT']) {
      assert.ok(!src.includes(gone), gone)
    }
  })

  test('a piece that still carries an old prediction is not rewarded for it: the same checks, nothing extra passes', () => {
    const withCall = NO_PREDICTION.replace('## 3 things you can do tomorrow', '## OUR PREDICTION\n\nBy 30 June 2027, half of small shops switch helpers.\n\nHow sure we are: 85%.\n\n## 3 things you can do tomorrow')
    assert.deepEqual(publishChecks(withCall, factsOk).map(c => c.id), publishChecks(NO_PREDICTION, factsOk).map(c => c.id))
  })
})

// A rule "asks for" a prediction when it names one outside a "no", "never", "not" or "without" earlier in the same
// sentence or clause (a semicolon ends a clause).
const ASKS = [/OUR PREDICTION/, /How sure we are/i, /\bconfidence\b/i, /\bdated (?:prediction|call)s?\b/i, /\bpredictions?\b/i,
  /\b(?:the|our|a) call\b(?! to action)/i, /\bscorecard\b/i, /\bkeeps? score\b/i]
const NEGATED = /\b(?:no|never|not|nothing|none|without)\b/i

function asksForAPrediction(text: string): string[] {
  const found: string[] = []
  for (const sentence of text.split(/(?<=[.?!;])\s+/)) {
    for (const ask of ASKS) {
      const m = ask.exec(sentence)
      if (m && !NEGATED.test(sentence.slice(0, m.index))) found.push(`${m[0]} in "${sentence.slice(0, 160)}"`)
    }
  }
  return found
}

describe('no house rule asks for a prediction', () => {
  test('CALL, CLEAR_STANCE and SHARP_PREDICTION are gone, and no rule text asks for a prediction, a call or a score', () => {
    for (const id of ['CALL', 'CLEAR_STANCE', 'SHARP_PREDICTION']) assert.ok(!HOUSE_RULES.some(r => r.id === id), `${id} is back`)
    for (const r of HOUSE_RULES.filter(x => x.id !== 'NO_DATED_PREDICTION')) assert.deepEqual(asksForAPrediction(r.text), [], r.id)
  })

  test('the detector catches the retired wording, so a rule that brings it back fails here', () => {
    assert.notDeepEqual(asksForAPrediction('Every piece ends with our prediction: what will happen, a date to check it by, and how sure we are as a percentage.'), [])
    assert.notDeepEqual(asksForAPrediction('The futures fork and never rejoin; the prediction sits on one of them.'), [])
    assert.deepEqual(asksForAPrediction('It is the last section, and never a dated prediction.'), [])
  })

  test('NO_DATED_PREDICTION is live, carries both rulings word for word, and reaches every writer, both judges and the final pass', () => {
    const r = HOUSE_RULES.find(x => x.id === 'NO_DATED_PREDICTION')
    assert.ok(r)
    assert.equal(r.status, 'live')
    assert.equal(r.on, '2026-11-18')
    assert.match(r.said, /I don't do dated-and-scored make-your-mind-up pieces because it felt quite tacky and gimmicky\. I don't really have the clout such that my opinion can hold up in official scores\./)
    assert.match(r.said, /get rid of that - i have abandoned the prediction format, it feels lame/)
    assert.match(r.text, /3 things you can do tomorrow/)
    assert.match(r.text, /says where it leads/)
    assert.match(r.text, /this rule wins/)
    for (const stage of ['judge_idea', 'judge_draft', 'write', 'final_pass'] as const) assert.ok(rulesFor(stage).some(x => x.id === r.id), stage)
    assert.ok(VOICE_GUARDRAILS.includes(r.text))
    assert.ok(VOICE_ABSOLUTES.some(a => a.includes(r.text)))
    assert.ok(houseRulesBlock('judge_draft', 'mind_the_gap').includes(r.text))
  })

  test('mind.the.gap names the pattern and says where it leads, with no date, no percentage and no verdict to mark later', () => {
    const t = HOUSE_RULES.find(x => x.id === 'TIMELINE')!.text
    assert.match(t, /names the pattern and says where it leads, with no date, no confidence percentage and no verdict to mark later/)
    assert.doesNotMatch(t, /the prediction sits on one of them/)
  })

  test('the writers are told no piece makes one, over any mandate that still asks; the house close asks for no verdict about the future', () => {
    for (const file of ['apps/control-plane/api/content-ideas/[id]/draft.ts', 'apps/control-plane/api/_revisePrompt.ts']) {
      const src = readFileSync(file, 'utf8')
      assert.doesNotMatch(src, /every piece still ends with a dated prediction/, file)
      assert.match(src, /no piece makes a dated prediction, whatever the mandate says/, file)
    }
    assert.doesNotMatch(VOICE_GUARDRAILS, /forward-looking verdict/)
    assert.match(readFileSync('apps/control-plane/api/_finalPass.ts', 'utf8'), /NO_DATED_PREDICTION wins and the piece makes none/)
  })

  test('nothing scores a prediction: the scoreboard feed is empty, and the market pin and the odds cron are gone', () => {
    assert.equal(existsSync('apps/control-plane/api/content-ideas/[id]/call-market.ts'), false)
    assert.equal(existsSync('apps/control-plane/api/signals/odds.ts'), false)
    assert.match(readFileSync('apps/control-plane/api/calls.ts', 'utf8'), /calls: \[\]/)
    assert.doesNotMatch(readFileSync('apps/control-plane/vercel.json', 'utf8'), /signals\/odds/)
  })
})
