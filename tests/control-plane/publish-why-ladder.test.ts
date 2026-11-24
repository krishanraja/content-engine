import { describe, expect, it } from 'vitest'
import { publishChecks, publishStatus, whyLadderCheck } from '../../apps/control-plane/api/_publishChecks.js'
import { whysFromResearch } from '../../apps/control-plane/api/board/_whys.js'
import type { WhyLadder, WhyRung } from '../../packages/contracts/src/whys.js'

// The signature format's own blocking check (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys; get rid of
// everything that suggests predictions, calls, dated, odds or scores). A filed why-ladder blocks approval until every
// Why stands; a piece with no ladder on file is advisory, so pieces drafted before the switch can still ship.

const ev = (domain: string) => ({ url: `https://${domain}/report`, domain, date: '2026-11-02', quote: 'A verbatim line from the source.', tier: 'primary' })
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
const facts = { ok: true, reason: null }
const body = '# A piece\n\nThe label moved first. The rest followed, one by one, as the cost fell.\n'
const why = (whys: unknown) => publishChecks(body, facts, whys).find(c => c.id === 'WHY_LADDER')

describe('WHY_LADDER publish check', () => {
  it('passes a ladder where every Why stands, and blocks nothing', () => {
    const c = why({ ladder: ladder(), problems: [] })
    expect(c).toMatchObject({ blocking: true, ok: true })
    expect(c?.detail).toMatch(/^5 Whys/)
  })

  it('blocks a ladder with a Why that needs a second source, naming the Why', () => {
    const thin = ladder({ rungs: [rung(1), rung(2), rung(3, { evidence: [ev('sec.gov')] }), rung(4), rung(5)] })
    const c = why({ ladder: thin, problems: [] })
    expect(c).toMatchObject({ blocking: true, ok: false })
    expect(c?.detail).toMatch(/Why 3/)
    const status = publishStatus(publishChecks(body, facts, { ladder: thin, problems: [] }))
    expect(status.ok).toBe(false)
    expect(status.failing.map(f => f.id)).toContain('WHY_LADDER')
  })

  it('rereads the ladder as it is now, not the problems filed with it', () => {
    expect(why({ ladder: ladder(), problems: [{ rung: 3, problem: 'Why 3 needs a second source on a different domain' }] })?.ok).toBe(true)
  })

  it('blocks a landing that makes a forecast', () => {
    const c = why({ ladder: ladder({ landing: { shows: 'By 2027 every label will license stems.', open_question: 'Will yours?' } }), problems: [] })
    expect(c).toMatchObject({ blocking: true, ok: false })
  })

  it('blocks research whose block would not parse, with the parser\'s reason', () => {
    const filed = whysFromResearch('```why-ladder\n{"schema": "why-ladder/1", "rungs": [\n```', '2026-11-24T21:00:00Z')
    expect(filed?.ladder).toBeNull()
    const c = whyLadderCheck(filed)
    expect(c).toMatchObject({ blocking: true, ok: false })
    expect(c.detail).toMatch(/not valid JSON/)
  })

  it('is advisory when no ladder is on file, so a piece drafted before the switch still ships', () => {
    const c = why(undefined)
    expect(c).toMatchObject({ blocking: false, ok: false })
    expect(publishStatus(publishChecks(body, facts)).failing.map(f => f.id)).not.toContain('WHY_LADDER')
  })

  it('reads a ladder filed by Research it now end to end', () => {
    const text = `piece_id: 8287846b-6618-4a19-9fb8-23ad4eca2718\n\n\`\`\`why-ladder\n${JSON.stringify(ladder())}\n\`\`\`\n\n# The story\n`
    expect(whyLadderCheck(whysFromResearch(text, '2026-11-24T21:00:00Z'))).toMatchObject({ blocking: true, ok: true })
  })
})
