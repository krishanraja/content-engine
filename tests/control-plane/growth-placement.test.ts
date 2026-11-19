import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bufferUrl, channelWords, placementFor } from '../../apps/control-plane/api/board/_growthPlacement.js'

// vendor/makeyourmindup/mix.json is growth-makeyourmindup's mix.json (0118d32), byte for byte. Change Growth's file first,
// copy it here, and move this hash with it.
const MIX_SHA = 'a2085c1946e18e1efa5935837a7cb36b8b9caf427a4f2896907db23ca488c497'

describe('Growth places every post (Krish, 2026-11-19: never his choice)', () => {
  it('the vendored mix.json is Growth\'s file', () => {
    expect(createHash('sha256').update(readFileSync('vendor/makeyourmindup/mix.json')).digest('hex')).toBe(MIX_SHA)
  })
  it('a meme goes to Growth\'s four channels at its four slots', () => {
    const p = placementFor('meme')!
    expect(channelWords(p)).toBe('Instagram, YouTube, TikTok and X')
    expect(p.times).toEqual(['08:30', '12:30', '17:30', '20:30'])
  })
  it('every board kind has a lane', () => {
    for (const k of ['meme', 'explainer', 'supporting', 'good_news', 'voiceover']) expect(placementFor(k)).not.toBeNull()
  })
  it('a Drive link becomes the address Buffer fetches', () => {
    expect(bufferUrl('https://drive.google.com/file/d/1abcdefghijKLMN/view?usp=drivesdk')).toBe('https://drive.google.com/uc?export=download&id=1abcdefghijKLMN')
    expect(bufferUrl('https://drive.google.com/open?id=1abcdefghijKLMN')).toBe('https://drive.google.com/uc?export=download&id=1abcdefghijKLMN')
    expect(bufferUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
  })
})
