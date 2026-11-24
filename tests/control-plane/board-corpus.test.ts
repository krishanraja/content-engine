import { describe, expect, it } from 'vitest'
import { buildView } from '../../apps/control-plane/api/board/_view'
import { corpusLines, corpusOf } from '../../apps/control-plane/api/board/_corpus'
import { thisWeek } from './board-week-model.test'

// Krish, 2026-11-19: "at this stage of every piece, I need to be able to drag and drop multiple files in (the perplexity
// repsonse and accompanying files images etc) ... the Claude production prompt should be able to refer to it as the corpus
// by which we are going to flesh out the full narrative arc and story, ensuring we trace everything back with the 5 Whys and
// also make the narrative incredibly fun to consume".
const FRI = 'f3fcd5e1-573e-4692-a413-db7c5823a10e'
const research = (id: string, title: string, kind = 'research', role: string | null = 'research') =>
  ({ id, kind, title, role, version: 1, piece_id: FRI, scope: FRI, at: '2026-11-12T10:00:00Z', content_type: null, sha256: null, bytes: 10, added_by: 'krish' })

/** The week with Friday's piece before its lock: no lock, no scripts, nothing made. */
function unsignedFriday() {
  const w = thisWeek()
  w.pieces = w.pieces.map(p => (String(p.id) === FRI ? { ...p, meta: { making: {} } } : p))
  w.picks = (w.picks || []).filter(p => !String(p.doc_id).startsWith('fri') && !String(p.doc_id).startsWith('yes-fri'))
  w.locks = { ...(w.locks || {}), fri: null } as never
  return w
}
const promptsOf = (it: { next: unknown; others: unknown[] }) => [it.next, ...it.others]
  .filter((a): a is { kind: string; prompt: string } => Boolean(a) && (a as { kind?: string }).kind === 'prompt').map(a => a.prompt)

describe('the research on a piece is the corpus its narrative is built from', () => {
  it('counts every research file, images and PDFs filed as research too, once each, and nothing else', () => {
    const c = corpusOf([
      research('a1', 'Perplexity answer: who owns design in 2028', 'research'),
      research('a2', 'adobe-max-keynote.png', 'image', 'research'),
      research('a3', 'canva-10k.pdf', 'file', 'research'),
      research('a1', 'Perplexity answer: who owns design in 2028', 'research'),
      research('b1', 'Proof v1', 'video', 'proof'),
      research('b2', 'cover.png', 'image', null),
    ])
    expect(c.map(x => x.id)).toEqual(['a1', 'a2', 'a3'])
  })

  it('tells the session to read each item, build the arc, trace it with the 5 Whys and make it fun, then file the lock', () => {
    const text = corpusLines([{ id: 'a1', title: 'Perplexity answer', kind: 'research' }])
    for (const words of ['a1: Perplexity answer', 'read_piece_material', 'narrative arc', '5 Whys', 'by id', 'incredibly fun to consume', 'narrative lock', 'never sign it for him'])
      expect(text).toContain(words)
    expect(corpusLines([])).toContain('Nothing is filed as research yet')
  })

  it('before the lock, the piece\'s Claude prompt names its research by id as the corpus', () => {
    const w = unsignedFriday()
    const v = buildView({ ...w, overlay: { sessions: [], materials: [research('r-perplexity', 'Perplexity answer: design in 2028'), research('r-img', 'adobe-max.png', 'image')] } })
    const fri = v.model!.days.find(d => d.day === 'fri')!.items.find(i => i.piece_id === FRI)!
    const prompts = promptsOf(fri as never)
    expect(prompts.length).toBeGreaterThan(0)
    const p = prompts.find(x => x.includes('The corpus'))
    expect(p).toBeDefined()
    expect(p).toContain('r-perplexity: Perplexity answer: design in 2028')
    expect(p).toContain('r-img: adobe-max.png')
  })

  it('once the lock is signed, the prompt no longer asks for the narrative to be built from the corpus', () => {
    const v = buildView(thisWeek())
    const fri = v.model!.days.find(d => d.day === 'fri')!.items.find(i => i.piece_id === FRI)!
    for (const p of promptsOf(fri as never)) expect(p).not.toContain('The corpus')
  })
})

describe('what he drops reaches Drive by itself (the research library, docs/DRIVE.md)', () => {
  it('a dropped Perplexity answer, image or PDF filed as research is copied into the piece\'s folder of 6 Research library', async () => {
    const { inLibrary, placeOf, RESEARCH_LIBRARY_FOLDER_ID } = await import('../../apps/control-plane/api/_researchLibrary')
    const base = { storage: 'bucket', bytes: 2048, archived_at: null, scope: FRI }
    expect(inLibrary({ ...base, kind: 'research', role: 'research', storage: 'text' })).toBe(true)
    expect(inLibrary({ ...base, kind: 'image', role: 'research' })).toBe(true)
    expect(inLibrary({ ...base, kind: 'file', role: 'research' })).toBe(true)
    // A link is not copied (its words are, when it is a Drive file: _researchLink.ts); a cover is not research.
    expect(inLibrary({ ...base, kind: 'image', role: null })).toBe(false)
    const m = { ...research('r1', 'Perplexity answer'), storage: 'text', week: '2026-11-09', day: 'fri', added_at: '2026-11-12T10:00:00Z' }
    const place = placeOf(m as never, { id: FRI, idea: 'Meta staff were ranked by AI use. They gamed it.', scheduled_for: '2026-11-13', series: 'mind_the_gap' })
    expect(place.slotName).toBe('Fri 13 Nov mind.the.gap - Meta staff were ranked by AI use. They gamed it. (f3fcd5e1)')
    expect(RESEARCH_LIBRARY_FOLDER_ID).toBe('12FKoQhLlUkzwJDKYao95YIY_H_HQupS6')
  })
})
