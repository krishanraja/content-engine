import { describe, it, expect } from 'vitest'
import {
  verbatimCheck, longestSharedRun, postHash, normaliseForHash, MAX_VERBATIM_RUN,
} from '../../apps/control-plane/api/_creatorFingerprint.js'

// The premise of taking inspiration from named creators is that the move
// transfers and the wording does not. These two functions are what turns that
// from a prompt instruction into something the engine can refuse on.

const POST = [
  'Most founders think hiring is the bottleneck. It is not.',
  'The bottleneck is that nobody has written down how the work is actually done,',
  'so every new person relearns it from scratch.',
].join(' ')

describe('the verbatim gate', () => {
  it('refuses a lifted sentence and names the words it found', () => {
    const v = verbatimCheck('The bottleneck is that nobody has written down how the work is actually done.', POST)
    expect(v.ok).toBe(false)
    expect(v.run).toBeGreaterThan(MAX_VERBATIM_RUN)
    expect(v.phrase).toContain('nobody has written down')
  })

  it('allows the same claim in his own words, which is the whole point', () => {
    expect(verbatimCheck('Hiring is not the constraint. Undocumented process is.', POST).ok).toBe(true)
    expect(verbatimCheck('Everyone blames headcount. The real cost is the method living in one head.', POST).ok).toBe(true)
  })

  it('does not fire on grammar, however long the shared run', () => {
    const grammar = 'and it is not the same as it was in the way that we do it'
    expect(verbatimCheck(grammar, `x ${grammar} y`).ok).toBe(true)
  })

  it('fires as soon as a content word joins the run', () => {
    const withNoun = 'and it is not the same bottleneck as it was in the way that we do it'
    expect(verbatimCheck(withNoun, `x ${withNoun} y`).ok).toBe(false)
  })

  it('is empty rather than throwing when either side is missing', () => {
    expect(longestSharedRun('', POST)).toEqual({ run: 0, phrase: '' })
    expect(longestSharedRun(POST, '')).toEqual({ run: 0, phrase: '' })
    expect(verbatimCheck('', '').ok).toBe(true)
  })

  it('takes an explicit bound, so a lane can be stricter without editing the helper', () => {
    const shared = 'the bottleneck is that nobody has written down'
    expect(verbatimCheck(shared, POST, 20).ok).toBe(true)
    expect(verbatimCheck(shared, POST, 3).ok).toBe(false)
  })
})

describe('one post, one identity', () => {
  it('agrees between a scrape and a transcribed screenshot', () => {
    const scraped = `${POST} https://lnkd.in/abc?utm_source=share`
    const transcribed = POST.replace(/[.,]/g, '').replace(/\s+/g, '   ').toUpperCase()
    expect(postHash(scraped)).toBe(postHash(transcribed))
  })

  it('ignores the emoji and bullets a transcription invents or drops', () => {
    expect(postHash(POST)).toBe(postHash(`🚀 ${POST} • • •`))
  })

  it('separates two different posts', () => {
    expect(postHash(POST)).not.toBe(postHash('An entirely different post, about something else, at some length.'))
  })

  it('normalises to bare words', () => {
    expect(normaliseForHash('Hello,   WORLD!! 🎉  https://x.co/1')).toBe('hello world')
    expect(normaliseForHash('')).toBe('')
  })
})
