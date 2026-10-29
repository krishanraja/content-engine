#!/usr/bin/env node
/**
 * The gate, proved in both directions.
 *
 *   node scripts/qa/kill-list-self-test.mjs
 *
 * A rule that never fires is decoration, and a rule that fires on clean copy
 * gets the gate switched off in week two. Both halves are asserted here, and
 * the second half is the one that matters: the clean piece at the bottom is
 * written the way the channel actually writes, and it must come back silent.
 */
import assert from 'node:assert/strict'
import { check } from './kill-list.mjs'

let run = 0, failed = 0
const test = (name, fn) => {
  run++
  try { fn() } catch (e) { failed++; console.log(`FAIL  ${name}\n      ${e.message}`) }
}
const ids = text => check(text).findings.filter(f => f.level === 'veto').map(f => f.id)
const warnIds = text => check(text).findings.filter(f => f.level === 'warning').map(f => f.id)

test('an em dash is a veto', () => {
  assert.ok(ids('The quote landed — and it landed hard.').includes('em_dash'))
})

test('an exclamation mark is a veto', () => {
  assert.ok(ids('The quote landed, and it landed hard!').includes('exclamation'))
})

test('a retired name is a veto', () => {
  assert.ok(ids('This ran in Built with AI last year.').includes('retired_name'))
  assert.ok(ids('Mindmaker Live covered it.').includes('retired_name'))
  assert.ok(ids('It was a split.the.bill piece.').includes('retired_name'))
  assert.ok(ids('It was a lift.the.lid piece.').includes('retired_name'))
  // Live again since the 2026-09-25 rename, so they must stay quiet.
  assert.ok(!ids('Mondays are follow.the.money.').includes('retired_name'))
  assert.ok(!ids('Open it up in under.the.hood.').includes('retired_name'))
})

test('a product name inside editorial is a veto', () => {
  assert.ok(ids('We built this in CTRL over a weekend.').includes('product_in_editorial'))
})

test('corporate filler is a veto', () => {
  assert.ok(ids('This is a game-changer for procurement.').includes('banned_vocabulary'))
  assert.ok(ids('Let us delve into the pricing page.').includes('banned_vocabulary'))
})

test('a closing moral is a veto', () => {
  assert.ok(ids('What this means for leaders is simple.').includes('preach_pattern'))
  assert.ok(ids('The lesson here is that defaults matter.').includes('preach_pattern'))
})

test('his name, a spelling or a handle of it is a veto', () => {
  // Ruling (Krish, 2026-10-28): "Remember, no content refers to Krish, ever."
  for (const named of [
    'By Krish Raja, 19 October 2026, six minute read',
    "Krish's take on the deal.",
    'KRISH’S CONFIDENCE',
    'Krishan Raja tested six models.',
    'Follow @TheRealKrisho for more',
    'Krisho on what just moved.',
    'More at krishraja.com',
    'Threads: krishraja1',
    'github.com/krishanraja/content-engine',
    'linkedin.com/in/krish-raja',
    // Another person called Krish is blocked too, with no override (Krish picked D4: "Yes, block it").
    'Krish Patel runs the chip team.',
  ]) {
    assert.ok(ids(named).includes('personal_name'), `not caught: ${named}`)
  }
})

test('other names that share his letters pass', () => {
  for (const other of [
    'Arvind Krishna said IBM will cut its AI prices.',
    'Raja Koduri left Intel to start a chip company.',
    'Sriram Krishnan advises the White House on AI.',
    'Krishi Network is an AI app for farmers in India.',
    'We ran the same prompt through DeepSeek and Claude. Our test, 23 October.',
  ]) {
    assert.deepEqual(ids(other), [], `a false block: ${other}`)
  }
})

test('no scope but canon lets his name through', () => {
  const scoped = (scope, body) => `---\nkill_list_scope: ${scope}\n---\n${body}\n`
  assert.ok(ids(scoped('paid_tier', 'A live session with Krish.')).includes('personal_name'), 'the paid tier does not relax it')
  assert.ok(ids(scoped('legal_entity', 'Mindmaker LLC, run by Krish Raja.')).includes('personal_name'), 'the legal entity scope does not relax it')
  assert.deepEqual(ids(scoped('canon', 'Ruling (Krish, 2026-10-28): no content refers to Krish.')), [],
    'canon must be allowed to record the rule it enforces')
})

test('paid tier may name CTRL and nothing else is relaxed', () => {
  const paid = body => `---\nkill_list_scope: paid_tier\n---\n${body}\n`
  assert.deepEqual(ids(paid('Beta access to CTRL.')), [], 'CTRL is the permitted paid-tier connection')
  assert.ok(ids('Beta access to CTRL.\n').includes('product_in_editorial'), 'CTRL stays vetoed outside the paid tier')
  assert.ok(ids(paid('Built by Mindmake.')).includes('product_in_editorial'), 'Mindmake stays vetoed in the paid tier')
  assert.ok(ids(paid('A line — with an em dash.')).includes('em_dash'), 'em dashes stay vetoed in the paid tier')
})

test('the legal entity scope allows the two company names and nothing else', () => {
  const legal = body => `---\nkill_list_scope: legal_entity\n---\n${body}\n`
  assert.deepEqual(ids(legal('Mindmaker LLC\nMindmaker Ltd')), [], 'the two operating companies may be named')
  assert.ok(ids('Run by Mindmaker LLC.\n').includes('retired_name'), 'the company name stays vetoed outside the scope')
  assert.ok(ids(legal('Mindmaker covered it.')).includes('retired_name'), 'bare Mindmaker stays vetoed in the scope')
  assert.ok(ids(legal('Mindmaker Live covered it.')).includes('retired_name'), 'Mindmaker Live stays vetoed in the scope')
  assert.ok(ids(legal('Built by Mindmake.')).includes('product_in_editorial'), 'Mindmake stays vetoed in the scope')
  assert.ok(ids(legal('Mindmaker LLC \u2014 a line.')).includes('em_dash'), 'em dashes stay vetoed in the scope')
  assert.equal(check(legal('Mindmaker LLC\nMindmaker covered it.')).findings.find(f => f.id === 'retired_name').line, 2,
    'line numbers survive the blanking')
})

test('canon is scanned for em dashes and nothing else', () => {
  const canon = '---\nkill_list_scope: canon\n---\nRetired: Built with AI, The Money of AI, Techonomic.\n'
  assert.deepEqual(ids(canon), [], 'canon must be allowed to name what it forbids')
  assert.ok(check(canon).canon)
  assert.ok(ids('---\nkill_list_scope: canon\n---\nA line — with an em dash.\n').includes('em_dash'),
    'the em dash rule still applies to canon')
})

test('a number with no named producer warns, and does not veto', () => {
  const w = check('Revenue growth fell to around 20% this year.')
  assert.ok(w.findings.some(f => f.id === 'unattributed_number' && f.level === 'warning'))
  assert.equal(w.findings.filter(f => f.level === 'veto').length, 0)
})

test('a number with its producer does not warn', () => {
  assert.deepEqual(
    warnIds('Reporting by the Financial Times put growth at around 20% this year.'),
    [], 'a named producer is the whole point of the rule',
  )
})

test('arithmetic with no evidence paragraph warns', () => {
  assert.ok(warnIds('So 340 x 12 gives the annual figure.').includes('evidence_before_arithmetic'))
})

test('arithmetic after an evidence paragraph is quiet', () => {
  const ok = 'We are doing arithmetic on estimates, so bear that in mind.\n\nSo 340 x 12 gives the annual figure.'
  assert.ok(!warnIds(ok).includes('evidence_before_arithmetic'))
})

test('the wrong day is a veto, and only when live format data is supplied', () => {
  const piece = '---\nformat: follow_the_money\ndate: 2026-09-18\n---\nThe renewal quote landed.\n'
  assert.deepEqual(ids(piece), [], 'without --formats the check is skipped, not guessed')
  assert.ok(check(piece).findings.some(f => f.id === 'day_check_skipped'))
  // 2026-09-18 is a Friday, and follow.the.money runs Mondays (since 2026-10-05).
  const live = { formats: { follow_the_money: 'Monday', under_the_hood: 'Wednesday', mind_the_gap: 'Friday' } }
  assert.ok(check(piece, live).findings.some(f => f.id === 'wrong_day' && f.level === 'veto'))
  // Its old day is now the wrong day.
  const oldDay = '---\nformat: follow_the_money\ndate: 2026-10-07\n---\nThe renewal quote landed.\n'
  assert.ok(check(oldDay, live).findings.some(f => f.id === 'wrong_day' && f.level === 'veto'))
  const right = '---\nformat: follow_the_money\ndate: 2026-10-05\n---\nThe renewal quote landed.\n'
  assert.deepEqual(check(right, live).findings.filter(f => f.level === 'veto'), [])
  // And under.the.hood moved to Wednesdays.
  const hood = '---\nformat: under_the_hood\ndate: 2026-10-07\n---\nThe part list came apart.\n'
  assert.deepEqual(check(hood, live).findings.filter(f => f.level === 'veto'), [])
})

test('a date is not a load-bearing number', () => {
  // This fired on every dated line in the canon before it was fixed, which is
  // how a gate trains people to scroll past its own warnings.
  for (const dated of [
    'Parked on 2026-09-19 and not live work.',
    'The relaunch was on 17 September 2026.',
    'Retired September 2026, before it ever ran.',
    'It has been true since 2026.',
  ]) {
    assert.deepEqual(warnIds(dated), [], `a date warned: ${dated}`)
  }
  // And the rule still fires on a real one.
  assert.ok(warnIds('Growth fell to around 20% in 2026.').includes('unattributed_number'))
})

test('clean copy comes back silent', () => {
  // Written the way the channel writes: names the subject in the first line,
  // attributes its number, no warm-up, no moral, ends on the observation.
  const clean = [
    'Canva cut its own growth forecast this week.',
    '',
    'Reporting by the Australian Financial Review put the revised figure at around 20 per cent,',
    'down from what the company had planned for, after the cost of running its generative',
    'features ran past budget.',
    '',
    'The interesting part is which line moved. The forecast went down. The price did not.',
  ].join('\n')
  const out = check(clean)
  assert.deepEqual(out.findings, [], `clean copy produced ${JSON.stringify(out.findings)}`)
})

console.log(failed === 0 ? `PASS  ${run} self-tests` : `${failed} of ${run} FAILED`)
process.exit(failed ? 1 : 0)
