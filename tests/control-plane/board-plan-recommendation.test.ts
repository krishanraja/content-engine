import { describe, expect, it } from 'vitest'
import { CAPTIONS, dayStyle, type MotionModule, type StyleInputs } from '../../apps/control-plane/api/board/_style.js'
import { mergeBaseSha, mergeWeekPlan } from '../../apps/control-plane/api/board/_view.js'

// A piece's production recommendation reaches its card (Ruling, Krish, 2026-11-17: "Why do recommendations in my UI
// never adapt to the piece?"). Fri 20 Nov: a session wrote ai-music-slam to main's plan, the week branch
// offday-revise/2026-11-16 still held living-screen, and the board read the branch alone; living-screen was rejected,
// so the card showed the channel's three and never the plan's own next choices.

type Body = Record<string, any>
const FRI = 'c00cd4e0-e1bb-4c60-b36f-cea92897e38c'
const OTHER = 'b019dbf8-8051-4cab-9b5e-2ad77b3f5118'

describe('the week plan the board reads, from main and the week branch', () => {
  const row = (id: string, motion: string, alts: string[]) => ({ id, title: id, style: { motion, motion_alternatives: alts, captions: 'art-directed' } })
  const base: Body = { week_start: '2026-11-16', days: { fri: [row(FRI, 'living-screen', ['ladder', 'ai-music-slam']), row(OTHER, 'eating-jobs-ladder', ['ladder'])] },
    offdays: { sat: [{ id: 'goodnews', topic: 'AI helping people speak', stories: [] }] } }
  // A session's write to main: Friday's production pick.
  const main: Body = structuredClone(base)
  main.days.fri[0] = row(FRI, 'ai-music-slam', ['eating-jobs-ladder', 'full-visual'])
  // A run's write to the week branch, made after the two split: the good news.
  const week: Body = structuredClone(base)
  week.offdays.sat[0] = { id: 'goodnews', topic: 'AI helping people speak and read', stories: ['one'] }

  it('takes a session\'s newer row from main while the week branch\'s row is the stale one', () => {
    const merged = mergeWeekPlan(base, main, week) as Body
    expect(merged.days.fri[0].style).toEqual({ motion: 'ai-music-slam', motion_alternatives: ['eating-jobs-ladder', 'full-visual'], captions: 'art-directed' })
    // ...and keeps the run's newer write on the week branch.
    expect(merged.offdays.sat[0]).toEqual({ id: 'goodnews', topic: 'AI helping people speak and read', stories: ['one'] })
    expect(merged.days.fri[1]).toEqual(base.days.fri[1])
  })

  it('keeps rows either side added, drops one either side removed, and keeps the week branch where both changed a value', () => {
    const m = structuredClone(main); m.days.fri.push(row('added-on-main', 'swiss', []))
    const w = structuredClone(week); w.days.fri = w.days.fri.filter((r: Body) => r.id !== OTHER); w.days.fri.push(row('added-on-week', 'morph', []))
    const merged = mergeWeekPlan(base, m, w) as Body
    expect(merged.days.fri.map((r: Body) => r.id)).toEqual([FRI, 'added-on-week', 'added-on-main'])
    const both = structuredClone(week); both.days.fri[0].style.motion = 'full-visual'
    expect((mergeWeekPlan(base, main, both) as Body).days.fri[0].style.motion).toBe('full-visual')
    // The same whatever the key order of either copy.
    expect(mergeWeekPlan(base, JSON.parse(JSON.stringify(base)), week)).toEqual(week)
  })

  it('asks GitHub where the two split, on the board\'s own token, and says null without one', async () => {
    const sha = 'a'.repeat(40)
    const calls: string[] = []
    const fetcher = async (url: string) => { calls.push(url); return { status: 200, text: async () => JSON.stringify({ merge_base_commit: { sha } }) } }
    expect(await mergeBaseSha(fetcher as never, { OFFDAY_REVISE_DISPATCH_TOKEN: 'x' }, 'm'.repeat(40), 'w'.repeat(40))).toBe(sha)
    expect(calls[0]).toMatch(/\/compare\/m{40}\.\.\.w{40}$/)
    expect(await mergeBaseSha(fetcher as never, {}, 'm', 'w')).toBeNull()
  })
})

describe('the plan\'s next choices, before the channel\'s own', () => {
  const m = (id: string, ve_route = ['headline'], krish_verdict = 'untested'): MotionModule =>
    ({ id, name: `The ${id} style`, how: `How ${id} moves.`, rules: [], point_types: ['number'], formats: ['long_video', 'short_video'], fits: 'often', krish_verdict, ve_route })
  const BANK = [m('swiss'), m('ladder', ['needs_device']), m('living-screen', ['needs_device']), m('dark-keynote'), m('eating-jobs-ladder'), m('retro', ['headline'], 'not for us')]
  const LOOKS = [{ id: 'face-with-proof', name: 'Face-led', pitch: 'His face.', status: 'proven' }, { id: 'why-ladder-v5', name: 'Why ladder', pitch: 'Moves.', status: 'trial' },
    { id: 'data-story', name: 'Data story', pitch: 'Numbers.', status: 'trial' }]
  const inputs = (extra: Partial<StyleInputs> = {}): StyleInputs => ({ pieceId: FRI, meta: {}, formats: ['long_video', 'short_video'], points: null,
    motion: BANK, looks: LOOKS as never, recommendedLook: null, ...extra })
  const rec = (o: Array<{ id: string; recommended: boolean; why: string | null }>) => o.filter(x => x.recommended).map(x => [x.id, x.why])

  it('shows a recorded retired pick without offering it for another pick', () => {
    const style = dayStyle(inputs({ meta: { style: { motion: 'ai-music-slam', captions: 'receipt-chip' } } }))
    expect(style.motion.picked).toBe('ai-music-slam')
    expect(style.captions.picked).toBe('receipt-chip')
    expect(style.motion.options.map(o => o.id)).not.toContain('ai-music-slam')
    expect(style.captions.options.map(o => o.id)).not.toContain('receipt-chip')
  })

  it('recommends the plan\'s first ready alternative when its motion was rejected on this piece, saying why', () => {
    const s = dayStyle(inputs({ meta: { style: { rejected: { motion: ['living-screen'] } } }, recommendedMotion: 'living-screen', motionAlternatives: ['ladder', 'dark-keynote'] }))
    expect(rec(s.motion.options)).toEqual([['dark-keynote', 'The production pick\'s next choice for this piece: its first, The living-screen style, is one you said Not this to.']])
    expect(s.motion.options[0]!.id).toBe('dark-keynote')
  })

  it('does the same for a motion ve cannot draw or one he called not for us, and the channel\'s three only when none stands', () => {
    expect(rec(dayStyle(inputs({ recommendedMotion: 'living-screen', motionAlternatives: ['eating-jobs-ladder'] })).motion.options))
      .toEqual([['eating-jobs-ladder', 'The production pick\'s next choice for this piece: its first, The living-screen style, cannot be drawn yet.']])
    expect(rec(dayStyle(inputs({ recommendedMotion: 'retro', motionAlternatives: ['swiss'] })).motion.options)[0]![1]).toMatch(/called not for us/)
    expect(rec(dayStyle(inputs({ recommendedMotion: 'dark-keynote', motionAlternatives: ['swiss'] })).motion.options))
      .toEqual([['dark-keynote', 'The production pick recommended for this piece.']])
    expect(rec(dayStyle(inputs({ recommendedMotion: 'living-screen', motionAlternatives: ['ladder'] })).motion.options).map(x => x[0]))
      .toEqual(['swiss', 'dark-keynote', 'eating-jobs-ladder'])
  })

  it('recommends the plan\'s next caption style when he said Not this to its first', () => {
    const [first, next] = [CAPTIONS[0]!, CAPTIONS[1]!]
    const s = dayStyle(inputs({ meta: { style: { rejected: { captions: [first.id] } } }, recommendedCaptions: first.id, captionsAlternatives: [next.id] }))
    expect(rec(s.captions.options)).toEqual([[next.id, `The production pick's next choice for this piece: its first, ${first.name}, is one you said Not this to.`]])
  })

  it('recommends the plan\'s next look when he said Not this to its first, before the proven one', () => {
    const s = dayStyle(inputs({ meta: { style: { rejected: { treatment: ['why-ladder-v5'] } } }, recommendedLook: 'why-ladder-v5', lookAlternatives: ['data-story'] }))
    expect(rec(s.treatment.options)).toEqual([['data-story', 'The production pick\'s next choice for this piece: its first, Why ladder, is one you said Not this to.']])
    expect(rec(dayStyle(inputs({ recommendedLook: 'why-ladder-v5' })).treatment.options)).toEqual([['why-ladder-v5', 'The Sunday room recommends it for this idea.']])
  })
})
