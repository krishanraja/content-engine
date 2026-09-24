import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'
import { notXYConstruction, voiceMechanics } from '../../apps/control-plane/api/_judges/deterministic.js'
import { VOICE_GUARDRAILS } from '../../apps/control-plane/api/_content.js'

// Rule R2 (docs/walks/2026-09-three-piece-walk.md). Krish, 2026-09-24, asked
// what the rule is after the first walk draft used the "Not X, Y" move four
// times: "Cut it everywhere." The first four cases are the shapes that draft
// used; the negatives are ordinary sentences the check must leave alone, or it
// becomes noise people learn to ignore.

describe('the "Not X, Y" construction is flagged', () => {
  const flagged = [
    'Not a security story, a pricing story.',
    'The sponsored listing isn\'t competing on visibility anymore, it\'s competing on price.',
    'The open question isn\'t whether Amazon lets agents back in. It\'s whether the line item survives renewal.',
    'It\'s not a feature, it\'s a platform.',
    'Amazon moved first. Not the ad team, the lawyers.',
  ]
  for (const text of flagged) {
    test(text, () => {
      assert.ok(notXYConstruction(text), 'should be flagged')
      assert.match(voiceMechanics(text)?.evidence.join(' ') ?? '', /the "Not X, Y" construction/)
    })
  }
})

describe('ordinary negation is left alone', () => {
  const clean = [
    'Not everyone agrees, and that is fine.',
    'The fee is not refundable.',
    'It isn\'t cheap.',
    'Revenue is reported in dollars, not pounds.',
    'Amazon did not say why.',
  ]
  for (const text of clean) {
    test(text, () => assert.equal(notXYConstruction(text), null))
  }
})

describe('the rule reaches every writer', () => {
  test('the house rules every drafting and rewrite path reads carry it', () => {
    assert.match(VOICE_GUARDRAILS, /Never use the "Not X, Y" construction/)
  })

  test('no persona line, rubric or preset in the engine still teaches it', () => {
    for (const p of [
      'apps/control-plane/api/_revisePrompt.ts',
      'apps/control-plane/api/content-ideas/[id]/chat.ts',
      'apps/control-plane/api/_finalPass.ts',
      'apps/control-plane/scripts/eval/suites/revise.ts',
    ]) {
      assert.doesNotMatch(readFileSync(p, 'utf8'), /"Not X, Y"\)|\\?"Not X, Y\\?" clarifier/, p)
    }
  })
})
