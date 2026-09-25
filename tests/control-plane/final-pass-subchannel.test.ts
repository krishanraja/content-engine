import assert from 'node:assert/strict'
import { describe, test } from 'vitest'
import { buildFinalPassSystem, rubricFor, subchannelRubric } from '../../apps/control-plane/api/_finalPass.js'
import { corpusForChannel, laneToCorpusChannel } from '../../apps/control-plane/api/_content.js'

// The final pass for a live subchannel is judged against its own mandate.
//
// Found on the three-piece walk, 2026-09-24: every routed piece has lane null
// (the ladder sets lane_slot only), so final-pass fell to the 'dynamic'
// (Unassigned) rubric and every drafting route got no playbook. And the
// hand-written rubrics had drifted from the mandates rewritten on 2026-09-17:
// the `built` rubric instant-fails a piece Krish did not build, which is what
// the under.the.hood mandate requires. The mandate text below is an excerpt of
// the live venture_formats row.

const LIFT = {
  slug: 'under_the_hood',
  label: 'under.the.hood',
  mandate: 'Work out what actually goes together, and why this one worked. Take a shipped thing apart to show what is really in it, then draw the build lesson. HARD GATES, applied before scoring. NOT US: the subject is never Krish, mind/make, CTRL or his own builds, however available the material. NO PREACHING: no closing moral, no lesson for leaders, no sentence telling the reader what to conclude. The verdict is the reader\'s to reach.',
}

const system = (rubric: ReturnType<typeof rubricFor>) =>
  buildFinalPassSystem({ rubric, voice: '', channelCorpus: '', materialsBlock: '' })

describe('final pass: a live subchannel is judged against its mandate', () => {
  test('the mandate is the rubric, whole', () => {
    const s = system(subchannelRubric(LIFT))
    assert.match(s, /VENTURE: under\.the\.hood/)
    assert.match(s, /NOT US: the subject is never Krish/)
    assert.match(s, /The verdict is the reader's to reach/)
  })

  test("the retired 'Krish built it' rule never reaches an under.the.hood piece", () => {
    const s = system(subchannelRubric(LIFT))
    assert.doesNotMatch(s, /Krish did not build or watch being built/)
    // It is still in the legacy rubric, so this is a real difference, not an absence.
    assert.match(system(rubricFor('built')), /Krish did not build or watch being built/)
  })

  test('the mandate governs the close; the house verdict absolute stays for everything else', () => {
    const live = system(subchannelRubric(LIFT))
    assert.doesNotMatch(live, /End on a hard, forward-looking verdict/)
    assert.match(live, /THE CLOSE is whatever the MANDATE above asks for/)
    assert.match(system(rubricFor('paid')), /End on a hard, forward-looking verdict/)
  })

  test('an unverifiable claim is flagged for a subchannel, never silently blocked', () => {
    assert.equal(subchannelRubric(LIFT).unverifiedClaim, 'flag')
  })
})

describe('corpus: a routed piece with a null lane gets its playbook', () => {
  test('live slots name their own playbook whatever the lane', () => {
    assert.equal(laneToCorpusChannel(null, 'follow_the_money'), 'follow_the_money')
    assert.equal(laneToCorpusChannel(null, 'under_the_hood'), 'under_the_hood')
    assert.equal(laneToCorpusChannel(null, 'mind_the_gap'), 'mind_the_gap')
    assert.equal(laneToCorpusChannel('publication', 'follow_the_money'), 'follow_the_money')
  })

  test('legacy values still map as before', () => {
    assert.equal(laneToCorpusChannel('publication', 'money_of_ai'), 'money_of_ai')
    assert.equal(laneToCorpusChannel('publication', null), 'publication')
    assert.equal(laneToCorpusChannel(null, null), null)
  })

  test('follow.the.money takes its lineage playbook; mind.the.gap is told it has none', () => {
    const corpus = [
      '## 0. Publication house register', 'House body.',
      '## 1. The Money of AI', 'Money playbook body.',
      '## 2. Built with AI', 'Built playbook body.',
      '## One-Paragraph Version', 'Synopsis.',
    ].join('\n')
    assert.match(corpusForChannel(corpus, laneToCorpusChannel(null, 'follow_the_money')), /Money playbook body/)
    assert.match(corpusForChannel(corpus, laneToCorpusChannel(null, 'mind_the_gap')), /NO PLAYBOOK EXISTS FOR THIS FORMAT/)
  })
})
