import { describe, expect, it } from 'vitest'
import {
  beatPromptBlock,
  inFocusSector,
  onAvoidList,
  onTeardownBeat,
  poolCategoryOffBeat,
} from '../../apps/control-plane/api/_beat.js'

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

// Ruling (Krish, 2026-11-24): the engine brings stories in his focus sectors
// (media, entertainment, content, arts, music, creator tech, with the economics
// of AI inside them) and not governance, regulation, security or data breaches.
// The words are rows in config/beat.json. These headlines are invented.
describe('the creative beat (config/beat.json)', () => {
  it('keeps a focus-sector release, which the event rule used to drop', () => {
    // "releases" is an OFF_BEAT event word, and this headline carries no money
    // word, so before the focus tier it was dropped. It is the beat.
    expect(onTeardownBeat('Artist releases AI album')).toBe(true)
    expect(onTeardownBeat('Label partners with Suno')).toBe(true)
    expect(onTeardownBeat('Studio unveils AI dubbing for its whole film catalogue')).toBe(true)
  })

  it('refuses governance, regulation and breaches outright', () => {
    for (const headline of [
      'EU AI Act vote',
      'Data breach at AI firm',
      'Senate weighs AI governance framework',
      'New regulator for frontier models',
      'Privacy watchdog opens surveillance inquiry into AI glasses',
    ]) {
      expect(onTeardownBeat(headline), headline).toBe(false)
    }
    // A money sentence no longer rescues a regulation story: it was rescuable
    // in OFF_BEAT until 2026-11-24 and is on the avoid list since.
    expect(onTeardownBeat(
      'EU AI Act compliance deadline arrives for general purpose models',
      'Vendors expect compliance to add 4% to the price of every seat.',
    )).toBe(false)
  })

  it('does not keep enterprise productivity without a creative angle', () => {
    expect(onTeardownBeat('Enterprise rolls out Copilot to staff')).toBe(false)
    expect(onTeardownBeat(
      'Enterprise rolls out Copilot to staff',
      'Seat prices rose 30% at renewal.',
    )).toBe(false)
    // ...and keeps it when the same headline carries a focus sector.
    expect(onTeardownBeat('Publisher rolls out Copilot to its designers')).toBe(true)
  })

  it('reads the exception phrases before the keywords', () => {
    // "job security" is a labour story, not a security story.
    expect(onTeardownBeat('AI threatens musicians\' job security, and their royalties')).toBe(true)
    // "royalty policy" is the money of music, not a policy story.
    expect(onTeardownBeat('Spotify changes its AI royalty policy')).toBe(true)
    // "state of the art" is not an art story, so a launch is still a launch.
    expect(onTeardownBeat('Lab launches a state of the art reasoning model')).toBe(false)
  })

  it('keeps copyright and licensing on the beat', () => {
    expect(onTeardownBeat('Record labels sign licensing deal with AI music startup')).toBe(true)
    expect(onTeardownBeat('Authors win copyright case against AI lab')).toBe(true)
  })

  it('keeps a creative tool or platform launch, and a rollout is not enterprise by itself', () => {
    for (const headline of [
      'Adobe rolls out Firefly Video to Premiere Pro',
      'Midjourney rolls out its first video model',
      'ElevenLabs rolls out voice cloning for audiobooks',
      'Midjourney launches V8',
      'Runway unveils Gen-5',
      'OpenAI releases Sora 3',
      'Google debuts Veo 4 for YouTube Shorts',
    ]) {
      expect(onTeardownBeat(headline), headline).toBe(true)
    }
    // A finance runway is not the video tool.
    expect(inFocusSector('Lab launches with 18 months of runway')).toBe(false)
    expect(onTeardownBeat('Lab launches with 18 months of runway')).toBe(false)
  })

  it('drops the pool lanes that are off the beat', () => {
    expect(poolCategoryOffBeat('governance')).toBe(true)
    expect(poolCategoryOffBeat('security')).toBe(true)
    expect(poolCategoryOffBeat(' Security ')).toBe(true)
    expect(poolCategoryOffBeat('economics')).toBe(false)
    expect(poolCategoryOffBeat(null)).toBe(false)
  })

  it('builds the prompt block from the config, so the prompt and the gate read one list', () => {
    const block = beatPromptBlock()
    expect(block).toContain('THE BEAT')
    expect(block).toContain('Music')
    expect(block).toContain('Governance, regulation, compliance and policy')
    expect(block).toContain('a Reiki master wrote a UK number two')
    expect(block).toContain('we can still keep a focus on the economics of AI but in these focus sectors')
    expect(block).not.toMatch(/[–—]/)
  })

  it('keeps the two lists apart', () => {
    expect(onAvoidList('Labels and studios')).toBe(false)
    expect(inFocusSector('EU AI Act vote')).toBe(false)
  })
})
