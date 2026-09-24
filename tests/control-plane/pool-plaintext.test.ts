import { describe, expect, it } from 'vitest'
import { plainText } from '../../apps/control-plane/api/_pool.js'

// The Feed carried markup as prose for as long as it has existed. The pool's
// sources are mixed, and several hand back a raw RSS <description>, which the
// ingest wrote straight into content_ideas.thesis. Krish, 2026-09-23, reading
// one of them in the triage desk: "why can't we stop garbage characters and
// sentences from coming in".
//
// Every case below is a real thesis from content_ideas, not an invented one.
describe('plainText', () => {
  it('unwraps the fragment that was cut off mid-attribute', () => {
    // The column limit truncated this INSIDE an href, so the last tag never
    // closes. A stripper that only matches <...> leaves the opening bracket.
    const row = '<p>Yesterday was <a href="https://x.ai/news/grok-4-7">Grok 4.7</a> ' +
      '(<a href="https://news.ycombinator.com/item?id=49788838#49790209">pelicans</a>) and <a href="https:/'
    expect(plainText(row)).toBe('Yesterday was Grok 4.7 (pelicans) and')
  })

  it('drops a leading image and keeps the sentence after it', () => {
    const row = '<img src="https://storage.googleapis.com/gweb-uniblog-publish-prod/images/hero.webp">' +
      'We are expanding our AI & Economy team'
    expect(plainText(row)).toBe('We are expanding our AI & Economy team')
  })

  it('keeps a block boundary as a space rather than gluing two sentences', () => {
    expect(plainText('<p><strong>Release:</strong> datasette-auth-github 1.0</p><p>I run this</p>'))
      .toBe('Release: datasette-auth-github 1.0 I run this')
  })

  it('decodes named and numeric entities', () => {
    expect(plainText('Google&#8217;s AI &amp; Economy team &mdash; expanded'))
      .toBe('Google’s AI & Economy team — expanded')
  })

  it('leaves an entity it does not know rather than mangling it', () => {
    expect(plainText('a &weirdthing; b')).toBe('a &weirdthing; b')
  })

  it('returns null for markup that carried no prose at all', () => {
    // An empty thesis is honest. An empty-looking one reads as a real value
    // downstream and is the reason this returns null rather than ''.
    expect(plainText('<img src="x.png"><br/>')).toBeNull()
    expect(plainText('   ')).toBeNull()
  })

  it('returns null for anything that is not a string', () => {
    expect(plainText(null)).toBeNull()
    expect(plainText(undefined)).toBeNull()
    expect(plainText(42)).toBeNull()
  })

  it('removes a script block with its contents', () => {
    expect(plainText('Real text <script>var x = "<not a tag>";</script> more text'))
      .toBe('Real text more text')
  })

  it('leaves clean prose exactly as it found it', () => {
    const clean = 'Mike Bell, head of market strategy at RBC BlueBay Asset Management, ' +
      'discusses the outlook for bond yields.'
    expect(plainText(clean)).toBe(clean)
  })
})

describe('looksTruncated', () => {
  it('catches the row Krish flagged, cut inside an href', async () => {
    const { looksTruncated } = await import('../../apps/control-plane/api/_pool.js')
    expect(looksTruncated('<p>Yesterday was <a href="https://x.ai/n">Grok 4.7</a> and <a href="https:/')).toBe(true)
  })

  it('does not call a complete sentence truncated just because it lacks a full stop', async () => {
    // Guessing at missing punctuation would throw away real text. Only an
    // unterminated tag is proof the writer was cut off.
    const { looksTruncated } = await import('../../apps/control-plane/api/_pool.js')
    expect(looksTruncated('A complete thought with no full stop')).toBe(false)
    expect(looksTruncated('<p>A complete thought.</p>')).toBe(false)
    expect(looksTruncated(null)).toBe(false)
  })
})
