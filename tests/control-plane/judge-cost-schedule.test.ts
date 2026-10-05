import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, test } from 'vitest'

describe('the paid idea judges run after the free filter', () => {
  test('triage runs first, judging runs once a day, and buried ideas stay out', () => {
    const vercel = JSON.parse(readFileSync('apps/control-plane/vercel.json', 'utf8')) as {
      crons: Array<{ path: string; schedule: string }>
    }
    const schedule = (path: string) => vercel.crons.find(c => c.path === path)?.schedule

    assert.equal(schedule('/api/triage/sweep'), '0 3 * * *')
    assert.equal(schedule('/api/judge/sweep'), '0 5 * * *')

    const ladder = readFileSync('apps/control-plane/api/judge/ladder.ts', 'utf8')
    assert.match(ladder, /\.is\('buried_at', null\)\.in\('state', \['seeded', 'researching', 'drafting'\]\)/)
  })
})
