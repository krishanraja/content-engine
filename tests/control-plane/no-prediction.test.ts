import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'vitest'
import * as checksModule from '../../apps/control-plane/api/_publishChecks.js'
import { publishChecks, publishStatus } from '../../apps/control-plane/api/_publishChecks.js'
import { HOUSE_RULES } from '../../apps/control-plane/api/_houseRules.js'
import { PACKAGING_RULES } from '../../apps/control-plane/api/_packaging.js'
import { EXTRACT_SYSTEM, SECOND_LOOK_SYSTEM } from '../../apps/control-plane/api/_factGate.js'
import { SCRIPT_STORY, VIDEO_FORMATS } from '../../apps/control-plane/api/_video.js'
import { SPINE_SYSTEM } from '../../apps/control-plane/api/_spine.js'
import { rubricFor, subchannelRubric } from '../../apps/control-plane/api/_finalPass.js'

// Ruling (Krish, 2026-11-24): "the signature format is the 5 Whys; get rid of everything that suggests predictions,
// calls, dated, odds or scores." Learning why-ladder-close, which supersedes near-term-backed-predictions and
// no-required-predictions: no prediction check, rule or prompt line remains, and the 19 Nov opt-in went with them.
// This one test replaces the four that pinned the old call structure (no-required-prediction, no-prediction-exception,
// prediction-exception and wednesday-retrospective).

const facts = { ok: true, reason: null }
const plain = '# A piece\n\nThe bank moved first. Then the rest followed, one by one, as the cost fell.\n\n## 3 things you can do tomorrow\n\n1. Ask.\n2. Check.\n3. Compare.\n'
const withOldCall = `${plain}\n## OUR PREDICTION\n\nBy 1 January 2027, a second bank follows.\n\nHow sure we are: 55%.\n`
const PREDICTION_IDS = ['CALL', 'CALL_HORIZON', 'CLEAR_STANCE', 'SHARP_PREDICTION', 'PREDICTION']

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (name === 'node_modules') return []
    return statSync(path).isDirectory() ? walk(path) : /\.(ts|tsx|json)$/.test(name) ? [path] : []
  })
}

describe('no prediction check, rule or prompt line remains (why-ladder-close)', () => {
  test('the publish checks hold no prediction check and take no opt-in', () => {
    for (const body of [plain, withOldCall]) {
      const checks = publishChecks(body, facts)
      for (const id of PREDICTION_IDS) assert.equal(checks.find(c => c.id === id), undefined, id)
    }
    assert.equal(publishChecks.length, 2, 'publishChecks(body, factGate): no date, piece id or prediction opt-in')
    for (const name of ['predictionWanted', 'PREDICTION_CHECKS', 'NO_PREDICTION_NEEDED', 'callHorizon', 'confidenceOf', 'predictionCheck', 'CLEAR_STANCE_AT', 'CALL_HORIZON_DAYS']) {
      assert.equal(name in checksModule, false, `${name} is still exported`)
    }
    const src = readFileSync('apps/control-plane/api/_publishChecks.ts', 'utf8')
    assert.doesNotMatch(src, /FRIDAY_HORIZON_EXCEPTION|NO_PREDICTION_PIECES|WEDNESDAY_RETROSPECTIVE_EXCEPTION/)
  })

  test('the pieces once exempt from a prediction need no exception: their bodies pass on the remaining checks', () => {
    // Wednesday's retrospective of 22 October, and the two pieces of 26 October, each closed without a prediction.
    for (const path of ['docs/plans/2026-10-19-week/wednesday-article-draft.md', 'docs/plans/2026-10-28-draft-body.md']) {
      const body = readFileSync(path, 'utf8').replace(/\r\n/g, '\n')
      const checks = publishChecks(body, facts)
      for (const c of checks) assert.doesNotMatch(c.detail, /Exempt by Krish|prediction/i, `${path}: ${c.id}`)
      assert.equal(publishStatus(publishChecks(body, { ok: false, reason: 'Unresolved claims' })).failing.some(c => c.id === 'FACTS'), true)
    }
  })

  test('no house rule asks for, shapes or scores a prediction', () => {
    for (const id of PREDICTION_IDS) assert.equal(HOUSE_RULES.find(r => r.id === id), undefined, id)
    const asks = /OUR PREDICTION|How sure we are|dated prediction|the prediction sits|reasoned predictions|makes the call|after the call\b|the call, and|My prediction:|prediction record|after the prediction|backed at 80%/i
    for (const r of HOUSE_RULES) assert.doesNotMatch(r.text, asks, r.id)
    const timeline = HOUSE_RULES.find(r => r.id === 'TIMELINE')!
    assert.match(timeline.text, /the why-ladder lands on what the pattern shows and an open question handed to the reader/)
    assert.match(HOUSE_RULES.find(r => r.id === 'R1')!.text, /labelled inference/)
  })

  test('no packaging rule or fact-gate prompt carries the piece\'s own prediction', () => {
    for (const id of PREDICTION_IDS) assert.ok(!PACKAGING_RULES.some(r => r.id === id), id)
    for (const prompt of [EXTRACT_SYSTEM, SECOND_LOOK_SYSTEM]) {
      assert.doesNotMatch(prompt, /own prediction or bet/)
      assert.match(prompt, /The piece makes no prediction/)
    }
  })

  test('the video-script writers carry no opt-in and no verdict beat', () => {
    // Both video-script routes (content-ideas/[id]/video-script.ts, briefs/[week]/video-script.ts) send these.
    const optIn = /unless Krish asked|2026-11-19/
    assert.doesNotMatch(SCRIPT_STORY, optIn)
    assert.match(SCRIPT_STORY, /an open question handed to the viewer/)
    for (const f of VIDEO_FORMATS) {
      assert.doesNotMatch(f.shape, optIn, f.id)
      assert.doesNotMatch(f.shape, /verdict|forward-looking|hard read of what it means/i, f.id)
    }
  })

  test('the spine check judges the landing, never a prediction section', () => {
    assert.doesNotMatch(SPINE_SYSTEM, /prediction|a call about/i)
    assert.match(SPINE_SYSTEM, /the landing is a YES when it says what the ladder shows/)
    assert.doesNotMatch(readFileSync('apps/control-plane/api/_spine.ts', 'utf8'), /The prediction is the piece/)
  })

  test('no final-pass rubric accepts a prediction, and the no-prediction rule wins over the mandate\'s close', () => {
    assert.doesNotMatch(readFileSync('apps/control-plane/api/_finalPass.ts', 'utf8'), /Bold predictions are allowed/)
    assert.match(rubricFor('investigation').evidenceBar, /No prediction or forecast/)
    const live = subchannelRubric({ slug: 'follow_the_money', label: 'follow.the.money', mandate: 'THE CLOSE is a verdict.' })
    assert.match(live.mustHave.join(' '), /where the mandate asks for a verdict or what is coming, it lands on what the evidence shows/)
  })

  test('the writers are told the piece makes none, and the mandate\'s old close never reaches them', () => {
    const draft = readFileSync('apps/control-plane/api/content-ideas/[id]/draft.ts', 'utf8')
    assert.match(draft, /export const NO_PREDICTION_LINE = 'The piece makes no prediction: no call, no dated forecast, no odds and no confidence number\./)
    assert.doesNotMatch(draft, /make none|predictionWanted|guardConfidence/)
    const override = /This wins over any close the mandate asks for, including a verdict or what is coming\./
    assert.match(draft, override)
    assert.match(readFileSync('apps/control-plane/api/_revisePrompt.ts', 'utf8'), override)
    assert.doesNotMatch(readFileSync('apps/control-plane/api/_revisePrompt.ts', 'utf8'), /dated prediction/)
    assert.match(readFileSync('apps/control-plane/api/_subchannels.ts', 'utf8'), /mandate: mandateWithoutCall\(row\.mandate\)/)
  })

  test('no live control-plane file speaks the old call vocabulary', () => {
    // _mandate.ts names the old clause so it can take it out; nothing else may.
    const allowed = new Set([join('apps', 'control-plane', 'api', '_mandate.ts')])
    const banned = /OUR PREDICTION|How sure we are|predictionWanted|SHARP_PREDICTION|call_market|call_verdict|contracts\/src\/call|readPieceCall|claim_scoreboard/
    const hits = walk(join('apps', 'control-plane')).filter(f => !allowed.has(f) && banned.test(readFileSync(f, 'utf8')))
    assert.deepEqual(hits, [])
  })

  test('the shared call reader is gone from the contracts', () => {
    assert.equal(existsSync('packages/contracts/src/call.ts'), false)
    assert.doesNotMatch(readFileSync('packages/contracts/src/index.ts', 'utf8'), /'\.\/call\.js'/)
  })

  test('the learning register records the supersession', () => {
    const { learnings } = JSON.parse(readFileSync('config/learnings.json', 'utf8')) as { learnings: Array<{ id: string; means: string; status: string }> }
    const close = learnings.find(l => l.id === 'why-ladder-close')!
    assert.ok(close, 'why-ladder-close')
    assert.equal(close.status, 'encoded')
    for (const old of ['near-term-backed-predictions', 'no-required-predictions']) {
      assert.match(learnings.find(l => l.id === old)!.means, /^Superseded on 2026-11-24 by why-ladder-close/, old)
    }
  })
})
