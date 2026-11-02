import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

// Ruling, Krish, 2026-11-02: "only where i specifically give a quote to use - i dont want requests put verbatim in the
// posts". The board reads his words with the rule Growth uses (engine/offday.py note_parts); both run these cases.
const source = readFileSync('scripts/post-pack/week_board/week.js', 'utf8')
const body = source.slice(source.indexOf('// offdayNoteParts:start'), source.indexOf('// offdayNoteParts:end'))
const offdayNoteParts = new Function(`${body}; return offdayNoteParts`)() as (note: unknown) => unknown
const { cases } = JSON.parse(readFileSync('fixtures/offday-note-cases.json', 'utf8')) as { cases: Array<{ note: string; want: unknown }> }

describe('his words on an off-day option, read as Growth reads them', () => {
  it('has the shared cases', () => expect(cases.length).toBeGreaterThanOrEqual(5))
  for (const { note, want } of cases) {
    it(JSON.stringify(note).slice(0, 60), () => expect(offdayNoteParts(note)).toEqual(want))
  }
})
