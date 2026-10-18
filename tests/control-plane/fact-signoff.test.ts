import { describe, expect, test } from 'vitest'
import {
  applySignOffs, bodyHash, gateStatus, settle, signOff, signedOffUnread, sourcesHash, standingSignOffs, summarise,
  type CheckedClaim, type FactCheck,
} from '../../apps/control-plane/api/_factGate.js'

// Cost guard G9 (docs/COST_GUARDS.md): Krish passes a line the checker could not
// match, in his own words, so no paid rerun chases it. It touches the truth gate,
// so these are the limits: his words or nothing, never a contradicted line, a
// reworded line is checked again, and new evidence is always read.

const BODY = [
  'Cisco says a company with 90,000 employees is looking at $900 million a year in token costs, which is a number that should make every finance team sit up.',
  'A founder told me over dinner that his team spends more on tokens than on rent, and I believe him because I have seen the invoices myself.',
  'The rest of this piece explains why that matters for anyone who signs a software budget this year and wants to stay ahead.',
].join(' ')
const LINE = 'A founder told me over dinner that his team spends more on tokens than on rent, and I believe him because I have seen the invoices myself.'
const CISCO = BODY.split('. ')[0] + '.'
const META_SOURCES = { materials: [{ id: 'm1', kind: 'paste', title: 'Cisco', url: 'https://example.test', content: 'With 90,000 employees, a company is looking at $900 million annually.' }] }

const claim = (sentence: string, verdict: CheckedClaim['verdict']): CheckedClaim => ({
  sentence, claim: sentence.slice(0, 40), kind: 'other',
  on_file: { verdict: verdict === 'verified' ? 'supported' : 'not_found', quote: null, note: null },
  independent: { verdict: verdict === 'contradicted' ? 'contradicted' : verdict === 'verified' ? 'supported' : 'unclear', evidence: null, url: null, checker: 'perplexity:sonar-pro', correct_value: null },
  verdict,
})

function meta(verdict: CheckedClaim['verdict']): Record<string, any> {
  const fc = summarise([claim(CISCO, 'verified'), claim(LINE, verdict)], [], BODY, 'perplexity:sonar-pro', '2026-10-18T10:00:00Z')
  return { ...META_SOURCES, fact_check: fc }
}

const ASK = { sentence: LINE, said: 'That one is mine, I saw the invoices. Pass it.', decided_by: 'Krish' }

describe('a sign-off needs Krish and his words', () => {
  test('refused without decided_by Krish', () => {
    expect(signOff(meta('unverified'), BODY, { ...ASK, decided_by: 'operator' }).ok).toBe(false)
  })
  test('refused without his words, or with the line itself as the words', () => {
    expect(signOff(meta('unverified'), BODY, { ...ASK, said: '  ' }).ok).toBe(false)
    expect(signOff(meta('unverified'), BODY, { ...ASK, said: LINE }).ok).toBe(false)
  })
  test('refused for a line not in the piece word for word', () => {
    expect(signOff(meta('unverified'), BODY, { ...ASK, sentence: 'A founder told me something.' }).ok).toBe(false)
  })
  test('refused for a contradicted line: the evidence says it is wrong', () => {
    const r = signOff(meta('contradicted'), BODY, ASK)
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/evidence against/)
  })
  test('refused for a line with nothing unmatched', () => {
    expect(signOff(meta('verified'), BODY, ASK).ok).toBe(false)
  })
})

describe('what a sign-off does', () => {
  const m = meta('unverified')
  const r = signOff(m, BODY, ASK, '2026-10-18T11:00:00Z')
  const withOff = { ...m, fact_signoffs: r.signoffs }

  test('keeps his exact words on the piece with the line and the sources', () => {
    expect(r.ok).toBe(true)
    expect(r.signed).toMatchObject({ sentence: LINE, said: ASK.said, decided_by: 'Krish', sources_hash: sourcesHash(m) })
  })

  test('the stored check passes, with the line set aside in his words', () => {
    expect(gateStatus(m, BODY).ok).toBe(false)
    const fc = applySignOffs(m.fact_check, BODY, standingSignOffs(withOff, BODY))
    expect(fc.passed).toBe(true)
    expect(fc.blocking).toBe(0)
    expect(fc.claims).toHaveLength(1)
    expect(fc.set_aside[0].reason).toContain(ASK.said)
    expect(gateStatus({ ...withOff, fact_check: fc }, BODY).ok).toBe(true)
  })

  test('a contradicted claim in a signed-off line still blocks', () => {
    const fc = summarise([claim(LINE, 'contradicted')], [], BODY, 'perplexity:sonar-pro')
    expect(applySignOffs(fc, BODY, standingSignOffs(withOff, BODY)).blocking).toBe(1)
  })

  test('a reworded line is no longer signed off', () => {
    const changed = BODY.replace('over dinner', 'at lunch')
    expect(standingSignOffs(withOff, changed)).toEqual({})
  })

  test('a paid rerun does not read the line again while the sources are the same', () => {
    const c = [{ sentence: LINE, claim: 'tokens more than rent', kind: 'other' as const }, { sentence: CISCO, claim: '$900 million', kind: 'number' as const }]
    const same = signedOffUnread(BODY, c, standingSignOffs(withOff, BODY), sourcesHash(m))
    expect(same.toCheck.map(x => x.sentence)).toEqual([CISCO])
    expect(same.setAside[0].reason).toContain(ASK.said)
  })

  test('new evidence is always read: with other sources the line is checked again', () => {
    const c = [{ sentence: LINE, claim: 'tokens more than rent', kind: 'other' as const }]
    expect(signedOffUnread(BODY, c, standingSignOffs(withOff, BODY), 'another-hash').toCheck).toHaveLength(1)
  })

  test('his sign-off is never settled in the ledger as a checker result', () => {
    const fc = applySignOffs(m.fact_check as FactCheck, BODY, standingSignOffs(withOff, BODY))
    const ledger = settle(BODY, fc, null, sourcesHash(m))
    expect(Object.values(ledger.sentences).every(e => e.status === 'passed')).toBe(true)
    expect(fc.body_hash).toBe(bodyHash(BODY))
  })
})
