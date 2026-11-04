import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createBoardHandler } from '../../apps/control-plane/api/board/_handler.js'
vi.mock('../../packages/core/src/media-rollout.js', () => ({ mediaQualityEnforced: () => false, mediaQualityRollout: () => ({ status: 'candidate_pending_calibration' }) }))

// The standards page (/standards, api/board op standards): the rejection floor's 215 standards in about 20 decisions
// (Krish, 2026-11-04: "group the 215 floor standards for my approval"). Each press goes through the one decision write
// the Studio's learning-proposals route uses, on the board's own login, and only his.

const previous = { ...process.env }
afterEach(() => { for (const key of ['ACCESS_CODE', 'ENGINE_OPERATOR_TOKEN']) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] } })

const grouping = JSON.parse(readFileSync('config/floor-groups.json', 'utf8')) as { groups: { key: string; title: string; never_beneath: string; check: string; members: string[] }[] }
const id = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`
// The fixture: the twenty real groups, each with a synthetic card; group 3 has the most productions and group 0 is decided.
const groups = grouping.groups.map((g, i) => ({
  key: g.key, title: g.title, never_beneath: g.never_beneath, check_text: g.check, proposal_id: id(i),
  member_fingerprints: g.members.map(m => m.slice(1) + '0'.repeat(6)),
  card: { standards: g.members.length, productions: i === 3 ? 99 : i, members: g.members.map(m => ({ id: m, never_beneath: `Member ${m}`, check: 'Look again.' })),
    quotes: i === 3 ? [{ said: 'These look like <PowerPoint> cliparts.', on: '2026-10-28' }] : [] },
}))
const proposals = groups.map((g, i) => i === 0
  ? { id: g.proposal_id, status: 'corrected', decision_note: 'Real logos, always.', decided_at: '2026-11-04T10:00:00Z' }
  : { id: g.proposal_id, status: 'proposed', decision_note: null, decided_at: null })

function fakeDb() {
  const writes: { table: string; patch: unknown; filters: [string, unknown][] }[] = []
  return {
    writes,
    db: {
      from: (table: string) => {
        const filters: [string, unknown][] = []
        let patch: unknown = null
        const rows = () => table === 'taste_floor_groups' ? groups : table === 'mindmake_studio_learning_proposals' ? proposals : []
        const q: any = {
          select: () => q, in: () => q,
          eq: (col: string, v: unknown) => { filters.push([col, v]); return q },
          update: (p: unknown) => { patch = p; return q },
          maybeSingle: async () => ({ data: (rows() as Record<string, unknown>[]).find(r => filters.every(([c, v]) => r[c] === v)) || null, error: null }),
          then: (ok: (v: unknown) => unknown, bad: (e: unknown) => unknown) => {
            if (patch) {
              writes.push({ table, patch, filters })
              const open = proposals.find(p => p.id === filters.find(f => f[0] === 'id')?.[1] && p.status === 'proposed')
              return Promise.resolve({ data: open ? [{ id: open.id, status: (patch as { status: string }).status }] : [], error: null }).then(ok, bad)
            }
            return Promise.resolve({ data: rows(), error: null }).then(ok, bad)
          },
        }
        return q
      },
    },
  }
}

async function call(who: 'krish' | 'operator' | null, method = 'GET', body?: unknown) {
  process.env.ENGINE_OPERATOR_TOKEN = 'synthetic-operator'
  process.env.ACCESS_CODE = 'synthetic-standards-test'
  const fake = fakeDb()
  const handler = createBoardHandler(async () => fake.db as never)
  const cookie = `cc_access=${createHash('sha256').update(process.env.ACCESS_CODE).digest('hex')}`
  const headers = who === 'krish' ? { cookie, origin: 'https://content.krishraja.com' } : who === 'operator' ? { authorization: 'Bearer synthetic-operator' } : {}
  let status = 0; let out: any; const set: Record<string, string> = {}
  const res = {
    headersSent: false,
    setHeader(k: string, v: string) { set[k.toLowerCase()] = v },
    status(code: number) { status = code; return this },
    json(v: unknown) { out = v }, send(v: unknown) { out = v },
  } as unknown as VercelResponse
  await handler({ method, headers, body, query: { op: 'standards' } } as unknown as VercelRequest, res)
  return { status, out, set, writes: fake.writes }
}

describe('the standards page', () => {
  it('shows the twenty groups as cards, most productions first, with his words verbatim and escaped', async () => {
    const { status, out, set } = await call('krish')
    expect(status).toBe(200)
    expect(set['content-type']).toContain('text/html')
    expect(set['content-security-policy']).toContain("frame-ancestors 'none'")
    const page = String(out)
    expect(page.match(/<article class="std/g)).toHaveLength(20)
    const order = [...page.matchAll(/<article [^>]*data-key="([a-z_]+)"/g)].map(m => m[1])
    expect(order[0]).toBe(grouping.groups[3].key)
    expect(page).toContain('These look like &lt;PowerPoint&gt; cliparts.')
    expect(page).toContain(grouping.groups[0].never_beneath.replace(/'/g, '&#39;').replace(/&(?!#39;)/g, '&amp;').slice(0, 30))
    // A decided group shows his decision and his words, and no buttons; a waiting one shows all three presses.
    const decided = page.slice(page.indexOf(`data-key="${grouping.groups[0].key}"`)).split('</article>')[0]
    expect(decided).toContain('Reworded')
    expect(decided).toContain('In your words: Real logos, always.')
    expect(decided).not.toContain('data-act="approved"')
    const waiting = page.slice(page.indexOf(`data-key="${grouping.groups[1].key}"`)).split('</article>')[0]
    for (const act of ['approved', 'reword', 'rejected']) expect(waiting).toContain(`data-act="${act}"`)
    expect(page).toContain('1 of 20 decided')
    expect(page).not.toMatch(/[–—]/)
  })

  it('needs a login, and lets the operator read but never press', async () => {
    expect((await call(null)).status).toBe(401)
    expect((await call('operator')).status).toBe(200)
    const pressed = await call('operator', 'POST', { id: id(1), decision: 'approved' })
    expect(pressed.status).toBe(403)
    expect(pressed.writes).toHaveLength(0)
  })

  it('posts his press through the one decision write, with his words on a reword', async () => {
    const { status, out, writes } = await call('krish', 'POST', { id: id(2), decision: 'corrected', krish: '  Clean cuts, every time.  ' })
    expect(status).toBe(200)
    expect(out).toMatchObject({ ok: true, key: grouping.groups[2].key, proposal: { id: id(2), status: 'corrected' } })
    expect(writes).toHaveLength(1)
    expect(writes[0].table).toBe('mindmake_studio_learning_proposals')
    expect(writes[0].patch).toMatchObject({ status: 'corrected', decided_by: 'Krish', decision_note: 'Clean cuts, every time.' })
    expect(writes[0].filters).toEqual([['id', id(2)], ['status', 'proposed']])
  })

  it('refuses a reword without his words, a proposal that is not a group, and a second decision', async () => {
    expect((await call('krish', 'POST', { id: id(2), decision: 'corrected' })).out).toMatchObject({ error: 'corrected_needs_his_words' })
    const stranger = await call('krish', 'POST', { id: id(77), decision: 'approved' })
    expect(stranger.status).toBe(404)
    expect(stranger.writes).toHaveLength(0)
    const again = await call('krish', 'POST', { id: id(0), decision: 'approved' })
    expect(again.status).toBe(409)
  })

  it('posts from the page to its own address with the route\'s body', async () => {
    const { out } = await call('krish')
    const page = String(out)
    expect(page).toContain("fetch(location.pathname,{method:'POST'")
    expect(page).toContain('var body={id:card.getAttribute(\'data-id\'),decision:decision};if(words)body.krish=words;')
  })
})
