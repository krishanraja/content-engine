import { describe, test } from 'vitest'
import assert from 'node:assert/strict'
import { catalogue, youtubeId, type CataloguePiece } from '../../apps/control-plane/api/_publicationCatalogue.js'

const piece = (over: Partial<CataloguePiece> & { channels?: Record<string, any> }): CataloguePiece => ({
  id: over.id ?? 'p1', idea: over.idea ?? 'An idea', lane_slot: over.lane_slot ?? 'follow_the_money',
  published_at: over.published_at ?? '2026-11-09T17:31:17Z', published_url: over.published_url ?? 'https://home.makeyourmindup.ai/p/one',
  meta: over.channels ? { making: { channels: over.channels } } : (over.meta ?? null), transformed_outputs: over.transformed_outputs ?? null,
})

describe('the public publication catalogue', () => {
  test('reads a YouTube id from every address form, and nothing else', () => {
    for (const u of ['https://youtu.be/dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3', 'https://youtube.com/shorts/dQw4w9WgXcQ?si=x', 'https://m.youtube.com/embed/dQw4w9WgXcQ'])
      assert.equal(youtubeId(u), 'dQw4w9WgXcQ', u)
    for (const u of ['https://vimeo.com/123', 'https://www.youtube.com/@makeyourmindup', 'https://youtube.com/watch?v=short', 'not a url'])
      assert.equal(youtubeId(u), null, u)
  })

  test('keeps the full video and the Short apart, in canonical form, from the receipts on the making record', () => {
    const c = catalogue([piece({ channels: {
      substack: { url: 'https://home.makeyourmindup.ai/p/one' },
      youtube: { url: 'https://youtu.be/AAAAAAAAAAA', posted_at: '2026-11-09T18:00:00Z' },
      shorts: { url: 'https://youtube.com/shorts/BBBBBBBBBBB?feature=share' },
    } })])
    assert.equal(c.entries.length, 1)
    assert.deepEqual(c.entries[0].video, { url: 'https://www.youtube.com/watch?v=AAAAAAAAAAA', id: 'AAAAAAAAAAA', posted_at: '2026-11-09T18:00:00.000Z' })
    assert.deepEqual(c.entries[0].short, { url: 'https://www.youtube.com/shorts/BBBBBBBBBBB', id: 'BBBBBBBBBBB', posted_at: null })
    assert.equal(c.entries[0].article_url, 'https://home.makeyourmindup.ai/p/one')
  })

  test('a video that has not gone out yet is null, and appears once its receipt lands', () => {
    const before = catalogue([piece({ channels: {} })])
    assert.equal(before.entries[0].video, null)
    const after = catalogue([piece({ channels: { youtube: { url: 'https://youtu.be/AAAAAAAAAAA' } } })])
    assert.equal(after.entries[0].video?.id, 'AAAAAAAAAAA')
  })

  test('an address that is not a YouTube video is held and named, never guessed', () => {
    const c = catalogue([piece({ channels: { youtube: { url: 'https://www.youtube.com/@makeyourmindup' } } })])
    assert.equal(c.entries[0].video, null)
    assert.deepEqual(c.held, [{ piece_id: 'p1', channel: 'youtube', reason: 'recorded address is not a YouTube video address' }])
  })

  test('one upload recorded as both cuts sits in one slot only', () => {
    const c = catalogue([piece({ channels: { youtube: { url: 'https://youtube.com/shorts/AAAAAAAAAAA' }, shorts: { url: 'https://youtube.com/shorts/AAAAAAAAAAA' } } })])
    assert.equal(c.entries[0].video, null)
    assert.equal(c.entries[0].short?.id, 'AAAAAAAAAAA')
    assert.equal(c.held.length, 1)
  })

  test('leaves out pieces before the engine began and anything private: only public facts leave', () => {
    const c = catalogue([
      piece({ id: 'old', published_at: '2026-03-10T00:00:00Z' }),
      piece({ id: 'new', meta: { making: { channels: {}, pack: { headline: 'The headline' }, notes: 'private' } }, transformed_outputs: { scores: 9 } }),
    ])
    assert.deepEqual(c.entries.map(e => e.piece_id), ['new'])
    assert.equal(c.entries[0].title, 'The headline')
    assert.deepEqual(Object.keys(c.entries[0]).sort(), ['article_url', 'piece_id', 'published_at', 'series', 'short', 'title', 'video'])
  })
})
