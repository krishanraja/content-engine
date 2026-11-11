import { describe, expect, test } from 'vitest'
import { matchUpload, readUploads, uploadWrite, YOUTUBE_FEED, YOUTUBE_WATCH_FROM, type PublishedPiece } from '../../apps/control-plane/api/_publishWatch.js'

const entry = (id: string, title: string, at: string, short = false) => `<entry><id>yt:video:${id}</id><yt:videoId>${id}</yt:videoId><title>${title}</title>
<link rel="alternate" href="https://www.youtube.com/${short ? 'shorts/' : 'watch?v='}${id}"/><published>${at}</published></entry>`
const feed = (...e: string[]) => `<?xml version="1.0"?><feed xmlns:yt="http://www.youtube.com/xml/schemas/2015">${e.join('')}</feed>`

const piece = (id: string, at: string, over: Partial<PublishedPiece> = {}): PublishedPiece => ({
  id, idea: `idea ${id}`, state: 'published', published_url: `https://home.makeyourmindup.ai/p/${id}`, published_at: at,
  meta: { making: { channels: {} } }, transformed_outputs: null, ...over,
})

describe('the watcher reads the channel YouTube really serves', () => {
  test('history is left to the reviewed backfill', () => { expect(YOUTUBE_WATCH_FROM).toBe('2026-11-11T00:00:00Z') })
  test('the feed is the @makeyourmind-up channel, by id', () => {
    expect(YOUTUBE_FEED).toBe('https://www.youtube.com/feeds/videos.xml?channel_id=UCvxmp6eKUqrjGGbCGl7f9-A')
  })
  test('reads full videos and Shorts apart, decodes titles, and drops malformed entries', () => {
    const ups = readUploads(feed(
      entry('GHN6GjGmCQ4', 'Why is Disney eating the scraps of bankrupt Character.AI?', '2026-11-09T17:40:00+00:00'),
      entry('_8vLveOXrj0', 'AI agents &amp; you', '2026-11-09T18:00:00+00:00', true),
      '<entry><title>no id</title></entry>'))
    expect(ups.map(u => [u.id, u.kind])).toEqual([['GHN6GjGmCQ4', 'youtube'], ['_8vLveOXrj0', 'shorts']])
    expect(ups[1].title).toBe('AI agents & you')
    expect(ups[1].url).toBe('https://www.youtube.com/shorts/_8vLveOXrj0')
  })
  test('an error page or an empty body is no uploads, never a catalogue of nothing', () => {
    expect(readUploads('<html>404</html>')).toEqual([])
    expect(readUploads('')).toEqual([])
  })
})

describe('an upload finds its piece', () => {
  const [up] = readUploads(feed(entry('AAAAAAAAAAA', 'A different title', '2026-11-09T19:00:00Z')))
  test('by the one piece published that day', () => {
    const m = matchUpload(up, [piece('a', '2026-11-09T17:31:00Z'), piece('b', '2026-11-06T17:00:00Z')])
    expect(m).toMatchObject({ kind: 'one', by: 'day', piece: { id: 'a' } })
  })
  test('two pieces that day are ambiguous and write nothing', () => {
    expect(matchUpload(up, [piece('a', '2026-11-09T08:00:00Z'), piece('b', '2026-11-09T17:00:00Z')])).toEqual({ kind: 'ambiguous', ids: ['a', 'b'] })
  })
  test('by exact title over the day, including the packaged YouTube title', () => {
    const [t] = readUploads(feed(entry('AAAAAAAAAAA', 'Higgsfield says $1bn. The maths says 4 weeks.', '2026-11-09T19:00:00Z')))
    const m = matchUpload(t, [piece('a', '2026-11-09T08:00:00Z'), piece('h', '2026-10-07T08:00:00Z', { transformed_outputs: { youtube_package: { title: 'Higgsfield says $1bn. The maths says 4 weeks.' } } })])
    expect(m).toMatchObject({ kind: 'one', by: 'title', piece: { id: 'h' } })
  })
  test('two uploads of one kind on the same day cannot be placed by date', () => {
    const two = readUploads(feed(entry('AAAAAAAAAAA', 'one', '2026-10-20T10:00:00Z'), entry('BBBBBBBBBBB', 'two', '2026-10-20T12:00:00Z')))
    expect(matchUpload(two[0], [piece('a', '2026-10-20T17:00:00Z')], two)).toEqual({ kind: 'none' })
    const mixed = readUploads(feed(entry('AAAAAAAAAAA', 'one', '2026-10-20T10:00:00Z'), entry('CCCCCCCCCCC', 'short', '2026-10-20T12:00:00Z', true)))
    expect(matchUpload(mixed[0], [piece('a', '2026-10-20T17:00:00Z')], mixed)).toMatchObject({ kind: 'one', by: 'day' })
  })
  test('a late upload on a day with no piece matches nothing and is reported', () => {
    expect(matchUpload(up, [piece('a', '2026-11-06T17:00:00Z')])).toEqual({ kind: 'none' })
  })
  test('pieces not yet published are never matched', () => {
    expect(matchUpload(up, [piece('a', '2026-11-09T17:00:00Z', { state: 'approved' })])).toEqual({ kind: 'none' })
  })
})

describe('what is written', () => {
  const [video] = readUploads(feed(entry('AAAAAAAAAAA', 'v', '2026-11-09T19:00:00Z')))
  test('fills the empty slot, keeping a tick he already made', () => {
    const p = piece('a', '2026-11-09T17:00:00Z', { meta: { making: { channels: { youtube: { posted_at: '2026-11-09T18:00:00Z' } } } } })
    expect(uploadWrite(video, p)).toEqual({ write: { url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA', video_id: 'AAAAAAAAAAA', posted_at: '2026-11-09T18:00:00Z', recorded_by: 'publish watcher' } })
  })
  test('never overwrites another video, and is idempotent', () => {
    const other = piece('a', '2026-11-09T17:00:00Z', { meta: { making: { channels: { youtube: { url: 'https://youtu.be/BBBBBBBBBBB' } } } } })
    expect(uploadWrite(video, other)).toEqual({ skip: 'slot holds another video (BBBBBBBBBBB); kept' })
    const same = piece('a', '2026-11-09T17:00:00Z', { meta: { making: { channels: { youtube: { url: 'https://youtu.be/AAAAAAAAAAA' } } } } })
    expect(uploadWrite(video, same)).toEqual({ skip: 'already recorded' })
  })
  test('a piece with no making record is reported, not invented', () => {
    expect(uploadWrite(video, piece('a', '2026-11-09T17:00:00Z', { meta: null }))).toEqual({ skip: 'no making record' })
  })
})
