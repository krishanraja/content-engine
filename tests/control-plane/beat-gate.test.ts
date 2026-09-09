import { describe, expect, it } from 'vitest'
import { onTeardownBeat } from '../../apps/control-plane/api/_beat.js'

// The gate existed and the route that fills the corpus never called it.
//
// api/_beat.ts was written from Krish's own 2026-08-06 definition of the beat
// and wired into the radar, investigations and creator posts. feed/ingest, the
// one route that actually writes the headline corpus, inserted everything the
// pool handed it, and shifts/detect clustered that corpus unfiltered. The
// classifier downstream did the filtering by hand instead and discarded 28 of
// 47 live arcs, a 60 percent rate sitting exactly on DISCARD_ALARM, whose own
// message reads "the corpus is wrong, not the ontology. Change the sources, not
// the lenses."
//
// The gate also had a hole. Its OFF_BEAT tier named governance and enterprise
// pilots; safety and security were not enumerated anywhere. Measured on 113
// live rows on 2026-09-09 it passed 88 percent, and 18 of the passing rows were
// safety, security and incident stories, several of them already tagged
// `governance` by the upstream pool. With the NEVER_BEAT tier it passes 75
// percent and leaks none.
//
// Every headline below is a real row from that corpus.

describe('the teardown beat gate', () => {
  it('refuses safety and security stories, which used to pass', () => {
    for (const headline of [
      'OpenAI paused its largest frontier training run. The safety math that forced it.',
      'Anthropic trained a checkpoint on exploitable RL environments. It wrote bioweapon plans 29% of the time.',
      'Investigation Reveals 700 OpenAI Agents Behind Hugging Face Hack',
      'AI agent suggests malware installation; engineer avoids it',
      'Anthropic researcher warns AI poses existential threat',
      "OpenAI's internal hack prompts urgent safety culture review",
      'The lethal trifecta: why every agent you run right now is one email away from exfiltrating your data',
    ]) {
      expect(onTeardownBeat(headline), headline).toBe(false)
    }
  })

  it('refuses a safety story even when the supporting sentence talks money', () => {
    // The whole reason NEVER_BEAT sits above ON_BEAT. A breach that cost money
    // is still a breach story, and the middle tier would otherwise rescue it.
    expect(onTeardownBeat(
      'OpenAI halts training of Astra model over safety concerns',
      'The pause wiped an estimated $400m of committed enterprise revenue this quarter.',
    )).toBe(false)
  })

  it('keeps a money story whose supporting sentence mentions a risk in passing', () => {
    // NEVER_BEAT reads the headline only. Testing it against the thesis too
    // killed this row, which is precisely the beat.
    expect(onTeardownBeat(
      'Companies struggle to achieve ROI from increased AI spending',
      'Buyers are cutting budgets after pilots stalled, and some cite security risk as the reason.',
    )).toBe(true)
  })

  it('keeps lawsuits, copyright and bans, which are money stories wearing a legal hat', () => {
    // Deliberately not in NEVER_BEAT. "Who actually gets paid when a machine
    // reads the work" is one of the eleven tracked questions, and a ban can be
    // the event that moves the economics.
    expect(onTeardownBeat('Seattle Times and Newsday sue OpenAI for copyright infringement')).toBe(true)
    expect(onTeardownBeat(
      'New York and Texas Both Banned Hyperscale Data Centers in August. The Frontier IPO Math Just Changed.',
    )).toBe(true)
  })

  it('still keeps the second-order economic stories the beat is for', () => {
    for (const headline of [
      'Anthropic hit $65B ARR in July. Seven months ago it was $9B.',
      'OpenAI implements outcome-based pricing for large customers',
      'Nvidia Buying Hugging Face Is a Distribution Play, Not a Model Play',
      'The harness is the product now. The model is just a part.',
    ]) {
      expect(onTeardownBeat(headline), headline).toBe(true)
    }
  })

  it('still rejects a bare capability announcement, which was always the rule', () => {
    expect(onTeardownBeat('OpenAI launches GPT-5.5 with a 2M token context window')).toBe(false)
    // ...and still rescues one whose payload is the economic effect.
    expect(onTeardownBeat('GPT-5.5 launch quietly repriced the whole agent market')).toBe(true)
  })
})
