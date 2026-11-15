import { describe, expect, it } from 'vitest'
import { mergeMaking, parseMakingPatch, type Making } from '../../apps/control-plane/api/_making.js'
import { THUMB_CHECKS, setDigest, thumbnailOptionsProblems } from '../../apps/control-plane/api/_thumbOptions.js'

// A piece's thumbnail options on its making record (thumbnail-designer; docs/production/COVER-STANDARD.md, point 8,
// approved by Krish on 2026-11-09: "Two or three options, never one, each shown in a mock of his grid beside the last
// five posts"). The record that stores the critic's verdict and his pick refuses either when its files' sha256s are
// not the set's (scripts/pages/thumb_options.py and scripts/post-pack/making.py write them).

const NOW = '2026-11-15T12:00:00.000Z'
const file = (id: string, shape: 'wide' | 'tall', hex: string) => ({
  shape, file: `options/${id}/thumb-${shape === 'wide' ? 'wide-1280x720' : 'tall-1080x1920'}.jpg`, sha256: hex.repeat(64),
})
const OPTIONS = [
  { id: 'a', note: 'the whole chart, the proof wide', files: [file('a', 'wide', '1'), file('a', 'tall', '2')] },
  { id: 'b', note: 'the last bar ringed', files: [file('b', 'wide', '3'), file('b', 'tall', '4')] },
]
// thumb_options.py set_digest on the same two options (computed there, so the two languages bind one set the same way).
const PY_DIGEST = 'ad67ba6d85e2433046ab521dd3b5ad8b8475ba675906c5ea3bf08febebe1e87b'
const passAll = Object.fromEntries(THUMB_CHECKS.map(k => [k, 'pass']))
const verdictOn = (options = OPTIONS) => ({
  reviewer: 'thumbnail-critic', reviewed_at: NOW, best: 'a', blocking: false,
  options: options.map(o => ({ id: o.id, files: o.files.map(f => ({ file: f.file, sha256: f.sha256 })), checks: { ...passAll }, blocking: false, findings: [] })),
})
const set = (extra: Record<string, unknown> = {}) => ({
  set_sha256: setDigest(OPTIONS), drawn_at: NOW, skin: 'neon', headline: 'GOOGLE PAID $2.7B FIRST', options: OPTIONS,
  grid_mock: { sha256: '5'.repeat(64), past_read: 5, note: 'Beside it: the last five posted covers, newest first.' }, ...extra,
})

function record(body: Record<string, unknown>, prev: Making | null = null) {
  const { patch, problems } = parseMakingPatch({ thumbnail_options: body }, NOW)
  if (problems.length) return { problems, making: prev }
  const bound = thumbnailOptionsProblems(prev?.thumbnail_options, patch.thumbnail_options)
  return bound.length ? { problems: bound, making: prev } : { problems: [], making: mergeMaking(prev, patch, 'Claude Code', NOW) }
}

describe('thumbnail options on the making record', () => {
  it('hashes a set the way thumb_options.py does', () => {
    expect(setDigest(OPTIONS)).toBe(PY_DIGEST)
  })

  it('keeps a set of two with the verdict on its own files', () => {
    const { problems, making } = record(set({ verdict: verdictOn() }))
    expect(problems).toEqual([])
    expect(making?.thumbnail_options?.options.map(o => o.id)).toEqual(['a', 'b'])
    expect(making?.thumbnail_options?.verdict?.best).toBe('a')
  })

  it('refuses one option: two or three, never one', () => {
    const one = [OPTIONS[0]]
    const { problems } = record({ ...set(), options: one, set_sha256: setDigest(one) })
    expect(problems.join()).toMatch(/two or three options/)
  })

  it('refuses a set whose hash is not its files\' (a file changed after drawing)', () => {
    const { problems } = record(set({ set_sha256: '9'.repeat(64) }))
    expect(problems.join()).toMatch(/not the hash of its options/)
  })

  it('refuses a verdict naming bytes that are not the set\'s', () => {
    const bad = verdictOn()
    bad.options[1].files[0].sha256 = '0'.repeat(64)
    const { problems } = record(set({ verdict: bad }))
    expect(problems.join()).toMatch(/verdict on other bytes is refused/)
  })

  it('refuses a verdict that skips an option', () => {
    const { problems } = record(set({ verdict: { ...verdictOn([OPTIONS[0]]), best: 'a' } }))
    expect(problems.join()).toMatch(/every option once/)
  })

  it('refuses a failed check left unanswered, and a best that blocks', () => {
    const v = verdictOn()
    ;(v.options[0].checks as Record<string, string>).title_hidden = 'maybe'
    expect(record(set({ verdict: v })).problems.join()).toMatch(/pass or fail/)
    const blocked = verdictOn()
    blocked.options[0].blocking = true
    expect(record(set({ verdict: blocked })).problems.join()).toMatch(/best is an option that does not block/)
  })

  it('keeps his pick, in his words, on the set on the record, once the verdict is there', () => {
    const first = record(set({ verdict: verdictOn() })).making
    const { problems, making } = record({ set_sha256: setDigest(OPTIONS), pick: { option: 'b', files: OPTIONS[1].files, krish_words: 'Krish, 2026-11-15: B, the ringed one' } }, first)
    expect(problems).toEqual([])
    expect(making?.thumbnail_options?.pick).toMatchObject({ option: 'b', krish_words: 'Krish, 2026-11-15: B, the ringed one', by: 'Claude Code' })
    expect(making?.thumbnail_options?.verdict?.best).toBe('a')
  })

  it('refuses a pick before the verdict, of other bytes, without his words, or for another set', () => {
    const unjudged = record(set()).making
    const pick = { option: 'b', files: OPTIONS[1].files, krish_words: 'Krish, 2026-11-15: B' }
    expect(record({ set_sha256: setDigest(OPTIONS), pick }, unjudged).problems.join()).toMatch(/only after the verdict/)
    const judged = record(set({ verdict: verdictOn() })).making
    expect(record({ set_sha256: setDigest(OPTIONS), pick: { ...pick, files: OPTIONS[0].files } }, judged).problems.join()).toMatch(/not option b's/)
    expect(record({ set_sha256: setDigest(OPTIONS), pick: { ...pick, krish_words: 'B looks best' } }, judged).problems.join()).toMatch(/Krish's own words/)
    expect(record({ set_sha256: '7'.repeat(64), pick }, judged).problems.join()).toMatch(/record holds no set/)
  })

  it('a new set replaces the old one whole, its verdict and pick with it', () => {
    const judged = record(set({ verdict: verdictOn() })).making
    const picked = record({ set_sha256: setDigest(OPTIONS), pick: { option: 'a', files: OPTIONS[0].files, krish_words: 'Krish, 2026-11-15: A' } }, judged).making
    const redrawn = OPTIONS.map(o => ({ ...o, files: o.files.map(f => ({ ...f, sha256: f.sha256.replace(/./g, 'c') })) }))
    const { problems, making } = record({ ...set(), options: redrawn, set_sha256: setDigest(redrawn) }, picked)
    expect(problems).toEqual([])
    expect(making?.thumbnail_options?.pick).toBeUndefined()
    expect(making?.thumbnail_options?.verdict).toBeUndefined()
  })
})
