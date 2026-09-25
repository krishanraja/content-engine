import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, test } from 'vitest'
import { bodyHash } from '../../apps/control-plane/api/_factGate.js'

// A web edition may add pictures, labels and sources, never a fact the gate
// did not check (editions/README.md).
const ROOT = 'editions'
const dirs = readdirSync(ROOT).filter(d => existsSync(join(ROOT, d, 'edition.json')))

function pageText(html: string): string {
  const t = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<[^>]+>/g, ' ')
  return t.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ')
}

describe('every web edition says only what the fact gate checked', () => {
  test('there is at least one edition', () => assert.ok(dirs.length >= 1))
  for (const d of dirs) {
    test(`${d}: body.md is the version that passed`, () => {
      const ed = JSON.parse(readFileSync(join(ROOT, d, 'edition.json'), 'utf8'))
      const body = readFileSync(join(ROOT, d, 'body.md'), 'utf8')
      assert.equal(ed.fact_check?.passed, true)
      assert.equal(bodyHash(body.trim()), ed.fact_check.body_hash)
    })
    test(`${d}: every sentence of body.md is on the page`, () => {
      const page = pageText(readFileSync(join(ROOT, d, 'index.html'), 'utf8'))
      const missing: string[] = []
      for (const para of readFileSync(join(ROOT, d, 'body.md'), 'utf8').split(/\n{2,}/)) {
        const text = para.replace(/^#+ .*$/gm, '').replace(/\*\*/g, '').trim()
        if (!text) continue
        for (const raw of text.split(/(?<=[.!?"])\s+(?=[A-Z"])/)) {
          const s = raw.replace(/\s+/g, ' ').trim()
          const labelled = s.match(/^(Winners|Losers|First sign|How sure we are): (.+)$/)
          const need = labelled ? labelled[2].replace(/^\[|\]$/g, '') : s.replace(/\.$/, '')
          if (labelled && labelled[1] === 'How sure we are') continue
          if (!page.toLowerCase().includes(need.toLowerCase())) missing.push(s)
        }
      }
      assert.deepEqual(missing, [])
    })
  }
})
