import { describe, expect, it } from 'vitest'
import {
  NO_WHY_LADDER, WHY_LADDER_SCHEMA, checkWhyLadder, domainOf, landingVetoes, loopTarget, parseWhyLadder, siteOf,
  type WhyLadder, type WhyRung,
} from '../packages/contracts/src/whys'
import * as contracts from '../packages/contracts/src/index'

// The why-ladder contract (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys; get rid of everything that
// suggests predictions, calls, dated, odds or scores). Research comes back as a fenced why-ladder block; the ladder
// climbs 3 to 7 Whys, each backed by two sources on two domains, stops honestly where evidence runs out, and lands on
// what this shows plus an open question for the viewer.

const ev = (domain: string, quote = 'A verbatim line from the source.', date = '2026-11-02') =>
  ({ url: `https://${domain}/report`, domain, date, quote, tier: 'primary' })
const rung = (n: number, over: Partial<WhyRung> = {}): WhyRung => ({
  n, question: `Why does step ${n} happen?`, answer: `Because of cause ${n}, which the filings show plainly.`,
  evidence: [ev('sec.gov'), ev('reuters.com')], strength: 'documented', counter: { text: 'The company says demand did it.' }, stop: null, ...over,
})
const ladder = (over: Partial<WhyLadder> = {}): WhyLadder => ({
  schema: 'why-ladder/1', question: 'Why did the price of music stems double this year?', series: 'follow_the_money',
  rungs: [1, 2, 3, 4, 5].map(n => rung(n)),
  landing: { shows: 'The price follows who owns the masters, not what the AI costs to run.', open_question: 'Which part of your own work is priced by who owns it?' },
  ...over,
})
const fenced = (lang: string, value: unknown) => `piece_id: 8287846b-6618-4a19-9fb8-23ad4eca2718\n\n\`\`\`${lang}\n${JSON.stringify(value, null, 2)}\n\`\`\`\n\n# The story\n\nNarrative.`
const problemsOf = (l: WhyLadder) => checkWhyLadder(l).map(p => p.problem)

describe('parseWhyLadder finds the fenced block', () => {
  it('reads a ```why-ladder block after the piece_id line, with the Markdown after it', () => {
    const r = parseWhyLadder(fenced('why-ladder', ladder()))
    expect(r.problems).toEqual([])
    expect(r.ladder?.schema).toBe(WHY_LADDER_SCHEMA)
    expect(r.ladder?.rungs.map(x => x.n)).toEqual([1, 2, 3, 4, 5])
    expect(r.ladder?.landing.open_question).toMatch(/\?$/)
  })

  it('reads a ```json block only when its schema is why-ladder/1, and ignores other JSON', () => {
    const other = '```json\n{"schema": "something-else", "x": 1}\n```\n'
    expect(parseWhyLadder(other)).toEqual({ ladder: null, problems: [NO_WHY_LADDER] })
    const r = parseWhyLadder(other + fenced('JSON', ladder()))
    expect(r.ladder?.question).toMatch(/music stems/)
    expect(r.problems).toEqual([])
  })

  it('says so plainly when there is no block, so a paste with no ladder is still filed as Markdown', () => {
    expect(parseWhyLadder('# Just research\n\nNo ladder here.')).toEqual({ ladder: null, problems: [NO_WHY_LADDER] })
    expect(parseWhyLadder('')).toEqual({ ladder: null, problems: [NO_WHY_LADDER] })
  })

  it('names a block that is not valid JSON, and repairs only a trailing comma', () => {
    const broken = parseWhyLadder('```why-ladder\n{"schema": "why-ladder/1", "rungs": [\n```')
    expect(broken.ladder).toBeNull()
    expect(broken.problems[0]).toMatch(/not valid JSON/)
    const comma = JSON.stringify(ladder()).replace(/\}\]\s*,\s*"landing"/, '},],"landing"')
    expect(parseWhyLadder(`\`\`\`why-ladder\n${comma}\n\`\`\``).ladder?.rungs.length).toBe(5)
    const jsonBroken = parseWhyLadder('```json\n{"schema": "why-ladder/1", oops}\n```')
    expect(jsonBroken.problems[0]).toMatch(/not valid JSON/)
  })

  it('refuses a why-ladder block that names another schema, and accepts one that names none', () => {
    const wrong = parseWhyLadder(fenced('why-ladder', { ...ladder(), schema: 'why-ladder/0' }))
    expect(wrong.ladder).toBeNull()
    expect(wrong.problems[0]).toMatch(/names schema "why-ladder\/0"/)
    const { schema: _s, ...unnamed } = ladder()
    expect(parseWhyLadder(fenced('why-ladder', unnamed)).ladder?.schema).toBe('why-ladder/1')
  })

  it('reads the first of two blocks and says there were two', () => {
    const r = parseWhyLadder(fenced('why-ladder', ladder()) + '\n' + fenced('json', ladder({ question: 'Second?' })))
    expect(r.ladder?.question).toMatch(/music stems/)
    expect(r.problems).toEqual(['The research holds 2 why-ladder blocks: the first is read'])
  })

  it('keeps a malformed rung, read as plainly as it can be, and names what was wrong', () => {
    const raw = { ...ladder(), rungs: [
      { n: 1, question: 'Why?', answer: 'Because.', evidence: [{ url: 'https://www.ft.com/a', date: '2026-01-01', quote: 'q' }], strength: 'certain', counter: 'A rival view.', stop: 'gave_up' },
      'not a rung',
      { question: 'Why again?', answer: 'Because again.', strength: 'open', counter: { none_found: true, scope: 'FT, Reuters, SEC, 2025 to 2026' } },
    ] }
    const r = parseWhyLadder(fenced('why-ladder', raw))
    expect(r.ladder?.rungs.length).toBe(2)
    const [a, b] = r.ladder!.rungs
    expect(a).toMatchObject({ strength: 'inferred', stop: null, counter: { text: 'A rival view.' } })
    expect(a!.evidence[0]!.domain).toBe('ft.com')
    expect(b).toMatchObject({ n: 3, strength: 'open', counter: { none_found_scope: 'FT, Reuters, SEC, 2025 to 2026' } })
    expect(r.problems.join(' | ')).toMatch(/"strength" is "certain"/)
    expect(r.problems.join(' | ')).toMatch(/"stop" is "gave_up"/)
    expect(r.problems.join(' | ')).toMatch(/Why 2 is not an object/)
    expect(r.problems.join(' | ')).toMatch(/Why 3: "n" is missing/)
  })

  it('keeps a ladder with no rungs or landing, so the board shows the problem instead of nothing', () => {
    const r = parseWhyLadder('```why-ladder\n{"schema": "why-ladder/1", "question": "Why?"}\n```')
    expect(r.ladder).toMatchObject({ rungs: [], landing: { shows: '', open_question: '' } })
    expect(r.problems).toEqual(['The ladder has no "rungs" list', 'The ladder has no "landing" (what this shows, and the open question)'])
    expect(problemsOf(r.ladder!)).toContain('The ladder has no Whys')
  })
})

describe('checkWhyLadder: where a ladder falls short, rung by rung', () => {
  it('passes a five-rung ladder backed on every rung', () => {
    expect(checkWhyLadder(ladder())).toEqual([])
  })

  it('names a rung with one source: "Why 3 needs a second source", and keeps the rung', () => {
    const l = ladder()
    l.rungs[2] = rung(3, { evidence: [ev('sec.gov')] })
    expect(checkWhyLadder(l)).toEqual([{ rung: 3, problem: 'Why 3 needs a second source' }])
    expect(l.rungs.length).toBe(5)
  })

  it('needs two domains, counting a subdomain as its site', () => {
    const l = ladder()
    l.rungs[1] = rung(2, { evidence: [ev('ir.oracle.com'), ev('oracle.com')] })
    expect(problemsOf(l)).toEqual(['Why 2 needs a second source on a different domain'])
    l.rungs[1] = rung(2, { evidence: [] })
    expect(problemsOf(l)).toEqual(['Why 2 needs two sources'])
    expect(siteOf('news.bbc.co.uk')).toBe('bbc.co.uk')
    expect(domainOf('ftp://x.org/a')).toBe('')
  })

  it('needs every source dated, linked and quoted verbatim', () => {
    const l = ladder()
    l.rungs[0] = rung(1, { evidence: [ev('sec.gov', ''), { url: 'not a link', domain: 'reuters.com', date: '', quote: 'q' }, ev('ft.com')] })
    expect(problemsOf(l)).toEqual([
      'Why 1 source 1 (sec.gov) has no verbatim quote',
      'Why 1 source 2 (reuters.com) has no working link',
      'Why 1 source 2 (reuters.com) has no date',
    ])
  })

  it('needs the strongest counter-evidence, or none found with the scope searched', () => {
    const l = ladder()
    l.rungs[3] = rung(4, { counter: {} })
    expect(problemsOf(l)).toEqual(['Why 4 needs its strongest counter-evidence, or "none found" with the scope searched'])
    l.rungs[3] = rung(4, { counter: { none_found_scope: 'SEC filings and trade press, Jan to Nov 2026' } })
    expect(checkWhyLadder(l)).toEqual([])
  })

  it('caps an answer at 60 words', () => {
    const l = ladder()
    l.rungs[0] = rung(1, { answer: Array.from({ length: 61 }, () => 'word').join(' ') })
    expect(problemsOf(l)).toEqual(["Why 1's answer is 61 words: 60 at most"])
  })

  it('an open rung needs no evidence, ends the ladder with its stop, and is never climbed past', () => {
    const ending = ladder({ rungs: [rung(1), rung(2), rung(3, { strength: 'open', evidence: [], counter: {}, answer: 'No source explains this yet.', stop: 'evidence_exhausted' })] })
    expect(checkWhyLadder(ending)).toEqual([])
    const unstopped = ladder({ rungs: [rung(1), rung(2), rung(3, { strength: 'open', evidence: [], counter: {}, stop: null })] })
    expect(problemsOf(unstopped)).toEqual(['Why 3 is an open question: give it its stop (evidence_exhausted) so the ladder ends there honestly'])
    const climbed = ladder({ rungs: [rung(1), rung(2, { strength: 'open', evidence: [] }), rung(3), rung(4)] })
    expect(problemsOf(climbed)).toEqual(['Why 2 is an open question, so the ladder stops there: never climb past it (stop on it, or follow the evidenced branch)'])
  })

  it('3 to 7 rungs; fewer than 3 only with a stop; never padded past a stop', () => {
    expect(problemsOf(ladder({ rungs: [rung(1), rung(2)] }))).toEqual([
      'The ladder stops at Why 2 without saying why: fewer than 3 Whys needs a stop on the last one (evidence_exhausted, out_of_scope and so on), never padding',
    ])
    for (const stop of ['evidence_exhausted', 'motive_not_mechanism', 'restatement', 'abstraction_drift', 'out_of_scope', 'cap'] as const)
      expect(checkWhyLadder(ladder({ rungs: [rung(1), rung(2, { stop })] })), stop).toEqual([])
    expect(checkWhyLadder(ladder({ rungs: [rung(1, { stop: 'out_of_scope' })] }))).toEqual([])
    expect(checkWhyLadder(ladder({ rungs: [1, 2, 3, 4, 5, 6, 7].map(n => rung(n)) }))).toEqual([])
    expect(problemsOf(ladder({ rungs: [1, 2, 3, 4, 5, 6, 7, 8].map(n => rung(n)) }))).toEqual(['The ladder climbs 8 Whys: merge sub-steps so it climbs 7 at most (five is the target)'])
    expect(problemsOf(ladder({ rungs: [rung(1), rung(2, { stop: 'restatement' }), rung(3)] }))).toEqual(['Why 2 stops the ladder (restatement) but Why 3 climbs past it'])
    expect(problemsOf(ladder({ rungs: [rung(1), rung(2), rung(4)] }))).toEqual(['The Whys are numbered 1, 2, 4: number them 1 to 3 in order'])
  })

  it('an OR branch follows the better-evidenced answer and parks the other', () => {
    const strong = { answer: 'Labels bought the catalogue.', evidence: [ev('sec.gov'), ev('billboard.com')] }
    const weak = { answer: 'Fans paid more.', evidence: [ev('reddit.com')] }
    const good = ladder()
    good.rungs[2] = rung(3, { evidence: [], branch: { join: 'OR', answers: [strong, weak], followed: 0 } })
    expect(checkWhyLadder(good)).toEqual([])
    const wrongWay = ladder()
    wrongWay.rungs[2] = rung(3, { branch: { join: 'OR', answers: [strong, weak], followed: 1 } })
    expect(problemsOf(wrongWay)).toEqual([
      'Why 3 needs a second source for the branch it follows',
      'Why 3 follows the less-evidenced branch: follow the better-evidenced one and mark the other parked',
    ])
  })

  it('a branched rung short of sources is named once, for the branch it follows', () => {
    const one = { answer: 'Labels bought the catalogue.', evidence: [ev('sec.gov')] }
    const other = { answer: 'Fans paid more.', evidence: [] }
    const l = ladder()
    l.rungs[2] = rung(3, { evidence: [], branch: { join: 'OR', answers: [one, other], followed: 0 } })
    expect(problemsOf(l).filter(p => /source/.test(p))).toEqual(['Why 3 needs a second source for the branch it follows'])
  })

  it('an AND branch needs a source for both causes, and a branch is two answers at most', () => {
    const a = { answer: 'Chips got scarce.', evidence: [ev('tsmc.com'), ev('reuters.com')] }
    const and = ladder()
    and.rungs[1] = rung(2, { branch: { join: 'AND', answers: [a, { answer: 'Power got dear.', evidence: [] }], followed: 0 } })
    expect(problemsOf(and)).toEqual(['Why 2 says both causes were needed (AND) but the second has no source'])
    and.rungs[1] = rung(2, { branch: { join: 'AND', answers: [a, { answer: 'Power got dear.', evidence: [ev('eia.gov')] }], followed: 0 } })
    expect(checkWhyLadder(and)).toEqual([])
    and.rungs[1] = rung(2, { branch: { join: 'OR', answers: [a, a, a], followed: 5 } })
    expect(problemsOf(and)).toEqual(["Why 2's branch needs two answers (it splits into two at most), not 3", "Why 2's branch follows answer 6, which is not there"])
  })

  it('a loop is a rung whose answer returns to an earlier Why, and it may be the insight', () => {
    const l = ladder({ rungs: [rung(1), rung(2), rung(3), rung(4, { answer: 'Cheaper stems mean more tracks, which feeds back into Why 2: more supply, lower prices.', mechanism_type: 'feedback_loop' })] })
    expect(loopTarget(l.rungs[3]!)).toBe(2)
    expect(checkWhyLadder(l)).toEqual([])
    l.rungs[3] = rung(4, { answer: 'This loops back to Why 6.' })
    expect(problemsOf(l)).toEqual(['Why 4 loops back to Why 6, which is not an earlier Why on this ladder'])
    expect(loopTarget({ answer: 'No loop at all.' })).toBeNull()
  })

  it('the landing is an insight and an open question, never a forecast, odds, confidence or a lesson', () => {
    expect(problemsOf(ladder({ landing: { shows: '', open_question: '' } }))).toEqual(['The landing does not say what this shows', 'The landing hands the viewer no open question'])
    expect(problemsOf(ladder({ landing: { shows: 'Ownership sets the price.', open_question: 'Think about it.' } }))).toEqual(['The landing\'s open question is not a question: end it with "?"'])
    const bad = [
      ['AI will replace session players by 2028.', 'a forecast'],
      ['Labels are likely to win this.', 'a forecast'],
      ['The odds favour the labels.', 'odds'],
      ['There is a 70% chance the price keeps rising.', 'odds'],
      ['How sure we are: 80%.', 'a confidence number'],
      ['The lesson for leaders is to own your masters.', 'a verdict or a lesson'],
      ['Our call: the labels win.', 'a verdict or a lesson'],
    ] as const
    for (const [shows, kind] of bad) {
      const found = landingVetoes({ shows, open_question: 'Who owns the work you make?' })
      expect(found.map(f => f.kind), shows).toContain(kind)
      expect(problemsOf(ladder({ landing: { shows, open_question: 'Who owns the work you make?' } })).join(' '), shows).toMatch(/never a verdict, forecast, odds or a lesson/)
    }
    expect(landingVetoes({ shows: 'The fact is fine.', open_question: 'What is the real question for leaders here?' }).map(v => v.kind)).toEqual(['a verdict or a lesson'])
    expect(landingVetoes({ shows: 'The price follows ownership, as it did in 2019.', open_question: 'What would you check first?' })).toEqual([])
  })

  it('an open question may talk to "you", and a landing may name confidence as a fact', () => {
    const fine = [
      { shows: 'The outage broke the habit, not the tool.', open_question: 'What would you need to see before you trusted it again?' },
      { shows: 'The margin rests on one supplier.', open_question: 'What do you have to believe for that to keep working?' },
      { shows: 'Consumer confidence in the tool fell after the outage.', open_question: 'Who noticed first?' },
      { shows: 'The recall cut into the bottom line within a quarter.', open_question: 'Who paid for it?' },
      { shows: 'The likelihood of a recall was in the filing all along.', open_question: 'Who read it?' },
    ]
    for (const landing of fine) {
      expect(landingVetoes(landing), landing.shows).toEqual([])
      expect(checkWhyLadder(ladder({ landing })), landing.shows).toEqual([])
    }
    const still = [
      [{ shows: 'Leaders should act now.', open_question: 'Who owns the work you make?' }, 'a verdict or a lesson'],
      [{ shows: 'The labels hold the masters.', open_question: 'You need to own your masters.' }, 'a verdict or a lesson'],
      [{ shows: 'We are 70% confident the labels hold.', open_question: 'Who owns the work you make?' }, 'a confidence number'],
      [{ shows: 'The labels hold, 70% confident.', open_question: 'Who owns the work you make?' }, 'a confidence number'],
      [{ shows: 'The bottom line is that labels win.', open_question: 'Who owns the work you make?' }, 'a verdict or a lesson'],
    ] as const
    for (const [landing, kind] of still) expect(landingVetoes(landing).map(v => v.kind), landing.shows).toContain(kind)
  })

  it('is exported from the contracts package', () => {
    expect(contracts.WHY_LADDER_SCHEMA).toBe('why-ladder/1')
    expect(typeof contracts.parseWhyLadder).toBe('function')
    expect(typeof contracts.checkWhyLadder).toBe('function')
  })
})
