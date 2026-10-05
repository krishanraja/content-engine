import { describe, expect, it } from 'vitest'
import {
  FILM_HARD_GATES,
  FILM_JUDGES,
  buildFilmJudgePrompt,
  parseFilmVerdict,
  summariseFilmJury,
  type FilmHardGateResult,
  type FilmJudgeVerdict,
} from '../../apps/control-plane/api/_judges/film.js'

const evidence = [{ kind: 'timecode' as const, locator: '00:03.000', observation: 'A specific observable action occurs.' }]

function passingVerdicts(): FilmJudgeVerdict[] {
  return FILM_JUDGES.map(judge => ({
    judge: judge.key,
    score: judge.adversarial ? 2 : 8.5,
    verdict: 'pass',
    the_one_fix: null,
    evidence,
    confidence: 0.9,
    adversarial: judge.adversarial === true,
  }))
}

function passingGates(): FilmHardGateResult[] {
  return FILM_HARD_GATES.map(gate => ({ gate: gate.key, status: 'pass', evidence, note: null }))
}

describe('the permanent film jury', () => {
  it('gives every independent judge one narrow question and one prosecutor', () => {
    expect(FILM_JUDGES.length).toBeGreaterThanOrEqual(14)
    expect(new Set(FILM_JUDGES.map(judge => judge.key)).size).toBe(FILM_JUDGES.length)
    expect(FILM_JUDGES.filter(judge => judge.adversarial).map(judge => judge.key)).toEqual(['prosecutor'])

    for (const judge of FILM_JUDGES) {
      expect(judge.question.trim().endsWith('?'), judge.key).toBe(true)
      expect((judge.question.match(/\?/g) ?? []).length, judge.key).toBe(1)
      expect(judge.rubric.length, judge.key).toBeGreaterThan(120)
      expect(judge.evidence.length, judge.key).toBeGreaterThan(40)
      const prompt = buildFilmJudgePrompt(judge, 'animatic')
      expect(prompt).toContain('THE ONLY QUESTION YOU OWN')
      expect(prompt).toContain('You cannot see the other judges')
      expect(prompt).toContain('Cite observable evidence')
      expect(prompt).toContain('Never let visual polish rescue unclear meaning')
    }
  })

  it('turns unsupported or malformed opinion into an abstention', () => {
    const judge = FILM_JUDGES[0]!
    const missingEvidence = parseFilmVerdict(judge, {
      score: 9,
      verdict: 'pass',
      the_one_fix: null,
      evidence: [],
      confidence: 0.9,
    })
    expect(missingEvidence.verdict).toBe('abstain')
    expect(missingEvidence.score).toBeNull()

    expect(parseFilmVerdict(judge, 'not json').verdict).toBe('abstain')
    expect(parseFilmVerdict(judge, { score: 20, verdict: 'pass', evidence }).verdict).toBe('abstain')
  })

  it('accepts a checkable verdict and preserves its locator', () => {
    const judge = FILM_JUDGES[0]!
    const verdict = parseFilmVerdict(judge, {
      score: 7.5,
      verdict: 'revise',
      the_one_fix: 'Make the transformation causal.',
      evidence,
      confidence: 0.84,
    })
    expect(verdict.score).toBe(7.5)
    expect(verdict.verdict).toBe('revise')
    expect(verdict.evidence[0]?.locator).toBe('00:03.000')
  })

  it('only raises the demanding award-ready signal when every lens and gate clears', () => {
    const ready = summariseFilmJury(passingVerdicts(), passingGates())
    expect(ready.award_ready).toBe(true)
    expect(ready.spread.prosecution?.score).toBe(2)
    expect(ready.spread.high?.judge).not.toBe('prosecutor')

    const lowCraft = passingVerdicts()
    lowCraft[0] = { ...lowCraft[0]!, score: 7.9, verdict: 'revise' }
    expect(summariseFilmJury(lowCraft, passingGates()).award_ready).toBe(false)

    const strongProsecution = passingVerdicts()
    const prosecutorIndex = strongProsecution.findIndex(verdict => verdict.adversarial)
    strongProsecution[prosecutorIndex] = { ...strongProsecution[prosecutorIndex]!, score: 4 }
    expect(summariseFilmJury(strongProsecution, passingGates()).award_ready).toBe(false)

    const failedGate = passingGates()
    failedGate[0] = { ...failedGate[0]!, status: 'fail' }
    const blocked = summariseFilmJury(passingVerdicts(), failedGate)
    expect(blocked.award_ready).toBe(false)
    expect(blocked.hard_gates.failed).toEqual([FILM_HARD_GATES[0]!.key])
  })

  it('preserves disagreement instead of averaging it away', () => {
    const verdicts = passingVerdicts()
    verdicts[0] = { ...verdicts[0]!, score: 3, verdict: 'kill' }
    verdicts[1] = { ...verdicts[1]!, score: 9, verdict: 'pass' }
    const summary = summariseFilmJury(verdicts, passingGates())
    expect(summary.dissent).toBe(true)
    expect(summary.spread.low).toEqual({ judge: verdicts[0]!.judge, score: 3 })
    expect(summary.spread.kills).toEqual([verdicts[0]!.judge])
    expect(summary).not.toHaveProperty('average')
  })

  it('refuses an incomplete roster or gate packet', () => {
    expect(() => summariseFilmJury(passingVerdicts().slice(1), passingGates())).toThrow(/roster mismatch/)
    expect(() => summariseFilmJury(passingVerdicts(), passingGates().slice(1))).toThrow(/gate mismatch/)
  })
})
