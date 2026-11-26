import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import type { WhyEvidence, WhyLadder, WhyRung } from '../packages/contracts/src/whys.js'
import { ladderFromText, main, normalise, probeCheck, urlKey, type Page, type Pages } from '../scripts/whys-probe-check.js'

// The pre-pick whys probe (story engine v5, commit 4). A rung counts as documented only when its quotes are found
// verbatim in the cached pages across two sites; a paraphrase is downgraded to inferred; a single-site ladder fails; a
// landing that reads as a forecast is vetoed; a page that could not be read is reported apart from a story that cannot
// hold the whys.

const PAGES: Record<string, string> = {
  'https://label.example/report': 'The label said streams rose 40 per cent after the deal.\nIt paid \u201Cless than a cent\u201D per play.',
  'https://news.example.co.uk/story': '<p>Artists were paid <em>less than a cent</em> per play, the filing shows.</p> The model was trained on the catalogue.',
  'https://ir.label.example/q3': 'Third quarter: licensing income doubled to $12m.',
}
const pages = (over: Record<string, Page> = {}): Pages => (url: string) => over[url] ?? (PAGES[url] !== undefined ? { text: PAGES[url] as string } : { unreadable: 'not cached' })

const ev = (url: string, quote: string): WhyEvidence => ({ url, domain: new URL(url).hostname, date: '2026-11-20', quote })
const A = ev('https://label.example/report', 'streams rose 40 per cent after the deal')
const B = ev('https://news.example.co.uk/story', 'Artists were paid less than a cent per play')
const rung = (n: number, over: Partial<WhyRung> = {}): WhyRung => ({
  n, question: `Why does step ${n} happen?`, answer: `Because of cause ${n}, which the sources show.`,
  evidence: [A, B], strength: 'documented', counter: { text: 'The label says demand did it.' }, stop: null, ...over,
})
const ladder = (over: Partial<WhyLadder> = {}): WhyLadder => ({
  schema: 'why-ladder/1', question: 'Why did the label pay so little per play?',
  rungs: [1, 2, 3, 4, 5].map(n => rung(n)),
  landing: { shows: 'The rate follows who owns the catalogue, not what the model costs.', open_question: 'Who set that rate, and who could change it?' },
  ...over,
})

describe('whys probe check', () => {
  it('counts a rung documented when its quotes are verbatim on two sites', () => {
    const r = probeCheck(ladder(), pages())
    expect(r).toMatchObject({ documented: 5, inferred: 0, sites: 2, landing_ok: true, unreadable: [] })
    expect(r.counter_rungs).toBe(5)
    expect(r.problems).toEqual([])
    // Markup, curly quotes and emphasis in the page do not stop a verbatim match.
    expect(r.rungs[0]?.verified_sites).toEqual(['example.co.uk', 'label.example'])
  })

  it('downgrades a paraphrased quote to inferred, and never upgrades a labelled inferred rung', () => {
    const para = ev('https://news.example.co.uk/story', 'Musicians got under one cent for each stream')
    const r = probeCheck(ladder({ rungs: [rung(1), rung(2, { evidence: [A, para] }), rung(3, { strength: 'inferred' }), rung(4), rung(5)] }), pages())
    expect(r.documented).toBe(3)
    expect(r.inferred).toBe(2)
    expect(r.rungs[1]?.counted).toBe('inferred')
    expect(r.rungs[2]?.counted).toBe('inferred')
    expect(r.problems.some(p => /Why 2: the quote from news\.example\.co\.uk is not in its page word for word/.test(p))).toBe(true)
    expect(r.problems.some(p => /Why 2: labelled documented, counted inferred/.test(p))).toBe(true)
  })

  it('a rung none of whose quotes survives does not count at all', () => {
    const made = [ev('https://label.example/report', 'An invented line'), ev('https://news.example.co.uk/story', 'Another invented line')]
    const r = probeCheck(ladder({ rungs: [rung(1, { evidence: made }), rung(2), rung(3)] }), pages())
    expect(r.rungs[0]?.counted).toBe('unsupported')
    expect(r).toMatchObject({ documented: 2, inferred: 0 })
  })

  it('fails a single-site ladder: every rung inferred, one site, and the contract names the domain problem', () => {
    const C = ev('https://ir.label.example/q3', 'licensing income doubled to $12m')
    const r = probeCheck(ladder({ rungs: [1, 2, 3, 4, 5].map(n => rung(n, { evidence: [A, C] })) }), pages())
    expect(r.sites).toBe(1)
    expect(r.documented).toBe(0)
    expect(r.inferred).toBe(5)
    expect(r.problems).toContain('The ladder stands on one site (label.example): verbatim quotes on two sites at least')
    expect(r.problems.some(p => /second source on a different domain/.test(p))).toBe(true)
  })

  it('reports a landing veto and marks the landing not ok', () => {
    const r = probeCheck(ladder({ landing: { shows: 'Labels will soon replace session players with models.', open_question: 'Who is next?' } }), pages())
    expect(r.landing_ok).toBe(false)
    expect(r.problems.some(p => /The landing reads as a forecast \("will soon"\)/.test(p))).toBe(true)
    expect(r.documented).toBe(5)
  })

  it('a landing with no question is not ok', () => {
    expect(probeCheck(ladder({ landing: { shows: 'The rate follows ownership.', open_question: 'Think about it.' } }), pages()).landing_ok).toBe(false)
  })

  it('reports an unreadable page apart, and a rung whose pages are all unreadable is unread, not unsupported', () => {
    const P = ev('https://paywall.example/a', 'some line')
    const Q = ev('https://paywall2.example/b', 'another line')
    const over = { 'https://paywall.example/a': { unreadable: 'paywall' } }
    const r = probeCheck(ladder({ rungs: [rung(1), rung(2), rung(3, { evidence: [P, Q] })] }), pages(over))
    expect(r.rungs[2]?.counted).toBe('unread')
    expect(r.unreadable).toEqual([{ url: 'https://paywall.example/a', reason: 'paywall' }, { url: 'https://paywall2.example/b', reason: 'not cached' }])
    expect(r.problems.some(p => /no quote survives/.test(p))).toBe(false)
    expect(r).toMatchObject({ documented: 2, inferred: 0 })
  })

  it('counts mechanism and counter rungs among documented rungs only', () => {
    const r = probeCheck(ladder({ rungs: [
      rung(1, { mechanism_type: 'training_data' }),
      rung(2, { mechanism_type: 'pricing', evidence: [A] }),
      rung(3, { counter: { none_found_scope: 'label filings and trade press' } }),
    ] }), pages())
    expect(r.mechanism_rungs).toBe(1)
    expect(r.counter_rungs).toBe(1)
  })

  it('reads a probe as a ladder, an option carrying whys, or a fenced block', () => {
    const l = ladder()
    expect(ladderFromText(JSON.stringify(l)).ladder?.rungs).toHaveLength(5)
    expect(ladderFromText(JSON.stringify({ id: 'mon-1', whys: l })).ladder?.rungs).toHaveLength(5)
    expect(ladderFromText('Notes\n```why-ladder\n' + JSON.stringify(l) + '\n```\n').ladder?.rungs).toHaveLength(5)
    expect(ladderFromText('no ladder here').ladder).toBeNull()
  })

  it('normalises only what a page renders differently', () => {
    expect(normalise('It\u2019s \u201Cfine\u201D \u2014 *really*')).toBe('It\'s "fine" - really')
    expect(urlKey('https://www.Label.example/report/#top')).toBe('https://label.example/report')
  })
})

describe('whys probe check, from the week folder', () => {
  const root = mkdtempSync(join(tmpdir(), 'whys-probe-'))
  const probe = join(root, 'docs', 'plans', '2026-11-30-week', 'probe')
  mkdirSync(join(probe, 'pages'), { recursive: true })
  writeFileSync(join(probe, 'pages', 'label.txt'), PAGES['https://label.example/report'] as string)
  writeFileSync(join(probe, 'pages', 'news.txt'), PAGES['https://news.example.co.uk/story'] as string)
  writeFileSync(join(probe, 'pages', 'index.json'), JSON.stringify({
    'https://label.example/report': { file: 'label.txt' },
    'https://www.news.example.co.uk/story/': { file: 'news.txt' },
    'https://paywall.example/a': { unreadable: 'paywall' },
  }))
  writeFileSync(join(probe, 'mon-1.whys.json'), JSON.stringify({ whys: ladder() }))
  afterAll(() => rmSync(root, { recursive: true, force: true }))

  it('checks one option, or every probe in the week', () => {
    const one = main(['2026-11-30', 'mon-1'], root)
    expect(one.code).toBe(0)
    expect(one.out).toMatchObject({ schema: 'whys-probe/1', documented: 5, sites: 2 })
    const all = main(['2026-11-30'], root)
    expect(all.code).toBe(0)
    expect(Object.keys(all.out as object)).toEqual(['mon-1'])
  })

  it('exits 2, never a pass, when there is no probe or no folder', () => {
    expect(main(['2026-11-30', 'wed-9'], root).code).toBe(2)
    expect(main(['2026-12-07'], root).code).toBe(2)
    expect(main([], root).code).toBe(2)
  })

  it('runs as a CLI with --ladder and --pages', () => {
    const tsx = join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs')
    const r = spawnSync(process.execPath, [tsx, join(process.cwd(), 'scripts', 'whys-probe-check.ts'), '--ladder', join(probe, 'mon-1.whys.json'), '--pages', join(probe, 'pages')], { encoding: 'utf8' })
    expect(r.status, r.stderr).toBe(0)
    expect(JSON.parse(r.stdout)).toMatchObject({ documented: 5, landing_ok: true, unreadable: [] })
  }, 30_000)
})
