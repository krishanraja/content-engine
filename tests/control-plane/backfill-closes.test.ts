import { describe, expect, it } from 'vitest'
import { assertNeverCloses, dayOf, oneNewsletterOn, planWrites, readArchive, shareFileId, stripHeld, type BoardRow, type Facts } from '../../scripts/backfill_closes.js'
import { cleanItem } from '../../apps/control-plane/api/workbench.js'

// Backfill step 1 of step 4: every open item that says nothing about how it
// ends gets a kind, and the script never closes anything. Synthetic rows only.

const NOW = '2026-10-22T09:30:00.000Z'
const CARD = '0a1b2c3d-1111-4222-8333-444455556666_1200x800.png'
const LAUNCH = { id: 4242, url: 'https://example.substack.com/p/the-launch', posted_at: '2026-10-06T06:42:00Z', type: 'newsletter' }
const HELD = 'Held from your list on 12 October: it does not say how it closes itself. '

function board(): BoardRow[] {
  return [
    { id: 'you-launch-today', lane: 'in_progress', title: 'One cover left', detail: `${HELD}The launch post still shows the old card.`, link: 'https://claude.ai/artifact/a', closes_on: null },
    { id: 'you-engine-github-key', lane: 'in_progress', title: 'The key is refused', detail: `${HELD}Make a new token.`, link: 'https://vercel.com/dashboard', closes_on: null },
    { id: 'week-publish-board-2026-10-12', lane: 'in_progress', title: 'This week\'s publish board', detail: `${HELD}One page.`, link: 'https://claude.ai/artifact/b', closes_on: null },
    { id: 'you-welcome-days', lane: 'in_progress', title: 'Swap two days', detail: 'Held from your list on 12 October: it is not ready for one press and does not say how it closes itself. Change the two lines.', link: null, closes_on: null },
    { id: 'ruling-fascinating', lane: 'in_progress', title: 'A ruling', detail: 'In his words.', closes_on: null },
    { id: 'you-outside-tools', lane: 'in_progress', title: 'Tools', detail: 'x', closes_on: null },
    { id: 'doing-remote-studio', lane: 'in_progress', title: 'Studio', detail: 'x', closes_on: null },
    { id: 'doing-first-lease', lane: 'in_progress', title: 'Lease', detail: 'x', closes_on: null },
    { id: 'friday-record', lane: 'on_you', title: 'Record', closes_on: 'record' },
    { id: 'old-done', lane: 'done', title: 'Done', closes_on: null },
    { id: 'something-new', lane: 'in_progress', title: 'Not planned', closes_on: null },
  ]
}
const FACTS: Facts = { launch: LAUNCH, cardFileId: CARD, now: NOW }

describe('backfill step 1', () => {
  it('gives each planned item its kind, strips the held line, and leaves every lane alone', () => {
    const { writes, skipped } = planWrites(board(), FACTS)
    const by = Object.fromEntries(writes.map(w => [w.id, w]))
    expect(Object.keys(by).sort()).toEqual(['doing-first-lease', 'doing-remote-studio', 'ruling-fascinating', 'week-publish-board-2026-10-12', 'you-engine-github-key', 'you-launch-today', 'you-outside-tools', 'you-welcome-days'])
    expect(by['you-launch-today']).toEqual({
      id: 'you-launch-today', closes_on: 'share_image_changed', close_ref: { url: LAUNCH.url, was: CARD },
      link: 'https://home.makeyourmindup.ai/publish/post/4242', link_label: 'Open the post settings', detail: 'The launch post still shows the old card.',
    })
    expect(by['you-engine-github-key']).toMatchObject({ title: "Replace the engine's GitHub key, then press Redeploy", closes_on: 'job_ok', close_ref: { job: 'build_signals', after: NOW, probe: 'dry' } })
    expect(by['you-engine-github-key']!.detail).toBe('Make a new token. A changed key reaches the engine only after a redeploy.')
    expect(by['week-publish-board-2026-10-12']).toEqual({ id: 'week-publish-board-2026-10-12', closes_on: 'week_published', detail: 'One page.' })
    expect(by['you-welcome-days']).toMatchObject({ closes_on: 'his_word', link_label: 'Open the welcome email settings', detail: 'Change the two lines.' })
    expect(by['ruling-fascinating']).toEqual({ id: 'ruling-fascinating', closes_on: 'session' })
    for (const w of writes) {
      expect(w).not.toHaveProperty('lane')
      expect(w).not.toHaveProperty('closed_proof')
      expect(JSON.stringify(w)).not.toMatch(/\u2014/)
    }
    expect(skipped).toEqual([{ id: 'something-new', why: 'not in the step 4 plan; a session gives it a kind by hand' }])
  })

  it('each write passes the route as an edit of the row there, and keeps it in progress', () => {
    const rows = new Map(board().map(r => [r.id, r]))
    for (const w of planWrites(board(), FACTS).writes) {
      const before = rows.get(w.id)!
      const row = cleanItem(w, false, { ...before, closed_by: null, only_you: 'login', link: before.link ?? null, idea_id: null, closes_on: null } as never,
        { writer: 'control_center', krish: false, relayed: false, said: null, agent: false })
      expect(row.lane).toBeUndefined()
    }
  })

  it('is safe to run again: an item that already says how it ends is left alone', () => {
    const again = board().map(r => (r.id === 'you-welcome-days' ? { ...r, closes_on: 'his_word' } : r))
    const { writes, skipped } = planWrites(again, FACTS)
    expect(writes.map(w => w.id)).not.toContain('you-welcome-days')
    expect(skipped).toContainEqual({ id: 'you-welcome-days', why: 'already says how it ends (his_word)' })
  })

  it('an uncertain launch post or card leaves the launch item as it is, and says to ask', () => {
    for (const facts of [{ ...FACTS, launch: '2 newsletters went out on 2026-10-06, so which one it is is not certain' }, { ...FACTS, cardFileId: null, cardWhy: 'the Monday post shows no share image with a file id' }]) {
      const { writes, skipped } = planWrites(board(), facts)
      expect(writes.map(w => w.id)).not.toContain('you-launch-today')
      expect(skipped.find(s => s.id === 'you-launch-today')!.why).toContain('Ask Krish which post it is.')
    }
  })

  it('never closes, opens or puts anything on him', () => {
    for (const bad of [{ id: 'x', lane: 'done' }, { id: 'x', lane: 'on_you' }, { id: 'x', closed_proof: 'p' }]) expect(() => assertNeverCloses(bad)).toThrow(/refused/)
    expect(() => assertNeverCloses({ id: 'x', closes_on: 'session' })).not.toThrow()
  })

  it('reads the facts: the held line, the share image file id, the post on a day', () => {
    expect(stripHeld(`${HELD}Rest.`)).toBe('Rest.')
    expect(stripHeld('No held line here.')).toBe('No held line here.')
    const page = `<head><meta property="og:image" content="https://substackcdn.com/image/fetch/w_1200,c_fill/https%3A%2F%2Fbucket.s3.amazonaws.com%2Fpublic%2Fimages%2F${CARD}"></head>`
    expect(shareFileId(page)).toBe(CARD)
    expect(shareFileId(`<meta content="https://x/${CARD}" property="og:image">`)).toBe(CARD)
    expect(shareFileId('<meta property="og:title" content="x">')).toBe(null)
    expect(dayOf('2026-10-06T03:30:00Z')).toBe('2026-10-05')
    const posts = readArchive([
      { id: 1, canonical_url: 'https://example.substack.com/p/a', post_date: '2026-10-05T14:00:00Z', type: 'newsletter' },
      { id: 2, canonical_url: 'https://example.substack.com/p/a-video', post_date: '2026-10-05T15:00:00Z', type: 'podcast' },
      { id: 3, canonical_url: 'https://example.substack.com/p/b', post_date: '2026-10-07T14:00:00Z', type: 'newsletter' },
      { id: 4, canonical_url: 'https://example.substack.com/p/c', post_date: '2026-10-07T18:00:00Z', type: 'newsletter' },
    ])
    expect(oneNewsletterOn(posts, '2026-10-05')).toMatchObject({ id: 1 })
    expect(oneNewsletterOn(posts, '2026-10-07')).toBe('2 newsletters went out on 2026-10-07, so which one it is is not certain')
  })
})
