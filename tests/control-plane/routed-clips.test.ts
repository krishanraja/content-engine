import { describe, expect, it } from 'vitest'
import { mergeMaking, parseMakingPatch } from '../../apps/control-plane/api/_making.js'
import { missingClips, presentClip } from '../../apps/control-plane/api/_routedClips.js'

// Clips routed to a piece (Krish, 2026-10-31: "route the two videos to it once they're read, so a new session knows they
// will need to be referenced with audio on during my video post production").

const NOW = '2026-10-31T17:00:00.000Z'
const A = '90b654ca-204a-4aef-bffe-19cfa7a2db19'
const B = 'f6327ce0-a414-4365-98df-635c1780523c'

const card = (over: Record<string, unknown> = {}) => ({
  id: A, name: 'youtube_oEODyXtV49M.mp4', kind: 'video', drive_file_id: '1Dd2TMonugi1BWSj-i7zoa5ThRIpJwXtx', read_as: 'watch',
  why_here: null, would_do: null, note_for_claude: null, facets: { link: { url: 'https://www.youtube.com/shorts/oEODyXtV49M' } }, ...over,
})

describe('how a cut uses a card linked to its piece', () => {
  const said = 'Krish, 2026-10-31: keep the video and audio'
  const uses = { [A]: { use: 'show_with_sound' as const, said, at: NOW, by: 'Claude Code' } }
  it('plays it with its sound only when his words are on the record', () => {
    const c = presentClip(card(), uses)
    expect([c.use, c.said]).toEqual(['show_with_sound', said])
  })
  it('never guesses from the card text: sound words with no record stay a reference', () => {
    for (const words of ['keep the video and audio', 'audio ON', 'it must never be muted', 'the sound is on point']) {
      expect(presentClip(card({ why_here: words, note_for_claude: words })).use, words).toBe('reference')
    }
  })
  it('never plays an image, whatever the record says', () => {
    expect(presentClip(card({ kind: 'image' }), uses).use).toBe('reference')
  })
  it('gives the session the links, his words and the note apart', () => {
    const c = presentClip(card({ why_here: 'keep the video and audio', note_for_claude: 'a session note' }))
    expect(c.drive_url).toBe('https://drive.google.com/file/d/1Dd2TMonugi1BWSj-i7zoa5ThRIpJwXtx/view')
    expect(c.source_url).toBe('https://www.youtube.com/shorts/oEODyXtV49M')
    expect(c.his_words.why_here).toBe('keep the video and audio')
    expect(c.note_for_claude).toBe('a session note')
  })
})

describe('what a cut still lacks', () => {
  const clips = [presentClip(card(), { [A]: { use: 'show_with_sound', said: 'Krish, 2026-10-31: keep the audio', at: NOW, by: 'Claude Code' } }),
    presentClip(card({ id: B, why_here: 'nice style' }))]
  it('names a sound clip with no place, never a reference', () => {
    expect(missingClips(clips, {}).map(c => c.card_id)).toEqual([A])
  })
  it('passes a clip placed with its sound on', () => {
    expect(missingClips(clips, { [A]: { at_s: 10, audio: 'on', at: NOW, by: 'Claude Code' } })).toEqual([])
  })
  it('counts silence or leaving it out only on his words', () => {
    expect(missingClips(clips, { [A]: { at_s: 10, audio: 'off', at: NOW, by: 'Claude Code' } }).length).toBe(1)
    expect(missingClips(clips, { [A]: { omitted: true, said: 'Krish, 2026-11-05: leave it out', at: NOW, by: 'Claude Code' } })).toEqual([])
  })
})

describe('the making record keeps his words on each clip', () => {
  it('takes his words and merges card by card', () => {
    const one = parseMakingPatch({ clip_uses: { [A]: { use: 'show_with_sound', said: 'Krish, 2026-10-31: keep the video and audio' } } }, NOW)
    expect(one.problems).toEqual([])
    const two = parseMakingPatch({ clip_uses: { [B]: { use: 'show_with_sound', said: 'Krish, 2026-10-31: referenced with audio on' } } }, NOW)
    const next = mergeMaking(mergeMaking(null, one.patch, 'Claude Code', NOW), two.patch, 'Claude Code', NOW)
    expect(Object.keys(next.clip_uses || {}).sort()).toEqual([A, B].sort())
  })
  it('refuses a use without his words, or a bad use', () => {
    for (const bad of [{ [A]: { use: 'show_with_sound' } }, { [A]: { use: 'show_with_sound', said: 'the editor decided' } },
      { [A]: { use: 'loud', said: 'Krish, 2026-10-31: x' } }, { 'not-a-card': { use: 'reference', said: 'Krish, 2026-10-31: x' } }]) {
      const { patch, problems } = parseMakingPatch({ clip_uses: bad }, NOW)
      expect(problems.length, JSON.stringify(bad)).toBeGreaterThan(0)
      expect(patch.clip_uses).toBeUndefined()
    }
  })
})

describe('the making record keeps where each cut plays them', () => {
  it('takes a placement and merges cut by cut, clip by clip', () => {
    const one = parseMakingPatch({ clip_placements: { long: { [A]: { at_s: 12.5, end_s: 20, audio: 'on' } } } }, NOW)
    expect(one.problems).toEqual([])
    const first = mergeMaking(null, one.patch, 'Claude Code', NOW)
    const two = parseMakingPatch({ clip_placements: { short: { [A]: { omitted: true, said: 'Krish, 2026-11-05: not in the short' } } } }, NOW)
    expect(two.problems).toEqual([])
    const next = mergeMaking(first, two.patch, 'Claude Code', NOW)
    expect(next.clip_placements?.long?.[A]).toMatchObject({ at_s: 12.5, end_s: 20, audio: 'on' })
    expect(next.clip_placements?.short?.[A]).toMatchObject({ omitted: true })
  })
  it('refuses silence or leaving out without his words, and a bad place', () => {
    for (const bad of [
      { long: { [A]: { at_s: 1, audio: 'off' } } },
      { long: { [A]: { omitted: true } } },
      { long: { [A]: { omitted: true, said: 'the editor decided' } } },
      { long: { [A]: { at_s: 5, end_s: 4, audio: 'on' } } },
      { long: { [A]: { audio: 'on' } } },
      { long: { 'not-a-card': { at_s: 1, audio: 'on' } } },
      { reel: { [A]: { at_s: 1, audio: 'on' } } },
    ]) {
      const { patch, problems } = parseMakingPatch({ clip_placements: bad }, NOW)
      expect(problems.length, JSON.stringify(bad)).toBeGreaterThan(0)
      expect(patch.clip_placements).toBeUndefined()
    }
  })
})
