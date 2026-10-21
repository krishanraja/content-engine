import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from './_supabase.js'
import { guardEngine } from './_auth.js'
import { canonicalUrl, contentHash, titleNorm } from './_text.js'
import { VERDICTS, combineCandidates, nextPair, parseMark, parseTriage, present, queueMeta, type QueueMark, type TriageInput } from './_ideaQueue.js'

// The one idea queue. GET reads it; POST queues an idea, triages a queued one, or takes one out.
//
// Krish, 2026-10-19: ideas he likes but that are not time-sensitive are queued instead of picked for a week, and
// the queue "needs to survive everything and be the first thing in chat". It is content_ideas rows with queued_at
// set (migration 20261025090000), never a second store. The row also gets protected_at, which triage/sweep.ts, the
// grader and both stale-archive functions already spare; api/purge/run.ts names queued_at itself.
//
//   GET  /api/idea-queue
//     -> { queue: [idea], pair }   every queued idea, the oldest untriaged two as the A/B pair
//   GET  /api/idea-queue?combine=1
//     -> adds { combine: [group] }  queued ideas that could combine into one bigger piece: two to five, joined by their
//                                   stored embeddings (combineCandidates); no model call, nothing written. Combining
//                                   is synthesize, run only on his Combine tap or words.
//   POST /api/idea-queue { action: 'queue', id?|idea+so_what, why_now, fact, source_url, series, from_week, from_pick,
//                          verdict?, reason?, angle?, decided_by?: 'Krish', said? }
//   POST /api/idea-queue { action: 'triage', id, verdict, reason?, angle?, decided_by: 'Krish', said? }
//   POST /api/idea-queue { action: 'unqueue', id, decided_by: 'Krish' }
//     (a `question` on a queue call adds one clarifying question from the session to the idea; it is shown beside the idea
//      and is never a decision of his)
//   POST /api/idea-queue { action: 'prefer', winner, loser, decided_by: 'Krish' }   (the A/B tap: which of two he would run first)
//
// A verdict (story, angle, cute, curious, drop) is written only with decided_by 'Krish', from his own tap or words
// (AGENTS.md: your own actions are observations). 'drop' takes the idea out of the queue and marks it dropped.
// Nothing here picks, schedules, publishes or spends.

const COLS = 'id,idea,thesis,state,lane_slot,source_url,queued_at,protected_at,buried_at,meta,updated_at'

async function readQueue() {
  const { data, error } = await supabase.from('content_ideas').select(COLS).not('queued_at', 'is', null).order('queued_at', { ascending: true }).limit(500)
  if (error) throw new Error(error.message)
  return ((data || []) as Array<Record<string, any>>).map(present)
}

function triageBlock(t: TriageInput, at: string) {
  return { verdict: t.verdict, reason: t.reason, angle: t.angle, decided_by: t.decided_by, said: t.said, at }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return
  res.setHeader('Cache-Control', 'no-store')
  try {
    if (req.method === 'GET') {
      const queue = await readQueue()
      const out: Record<string, unknown> = { ok: true, queue, pair: nextPair(queue), verdicts: VERDICTS }
      if (['1', 'true'].includes(String(req.query?.combine || ''))) {
        const { data, error } = await supabase.from('content_ideas').select('id,idea,state,lane_slot,queued_at,embedding,meta')
          .not('queued_at', 'is', null).limit(500)
        if (error) return res.status(500).json({ ok: false, error: error.message })
        out.combine = combineCandidates((data || []) as Array<Record<string, any>>)
      }
      return res.status(200).json(out)
    }

    const b = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body) || {}
    const action = String(b.action || '')
    const now = new Date().toISOString()

    if (action === 'queue') {
      const { mark, problems } = parseMark(b)
      if (!mark) return res.status(400).json({ ok: false, error: 'bad_mark', problems })
      let triage: TriageInput | null = null
      if (b.verdict) {
        const t = parseTriage(b)
        if (!t.triage) return res.status(400).json({ ok: false, error: 'bad_triage', problems: t.problems })
        triage = t.triage
      }
      return await queueOne(res, mark, triage, now)
    }

    if (action === 'prefer') {
      if (b.decided_by !== 'Krish') return res.status(400).json({ ok: false, error: 'decided_by_krish_only', problems: ["decided_by must be 'Krish'"] })
      const winner = String(b.winner || ''), loser = String(b.loser || '')
      if (!winner || !loser || winner === loser) return res.status(400).json({ ok: false, error: 'bad_pair', problems: ['winner and loser must be two different queued ideas'] })
      const { data, error } = await supabase.from('content_ideas').select(COLS).in('id', [winner, loser]).not('queued_at', 'is', null)
      if (error) return res.status(500).json({ ok: false, error: error.message })
      const rows = (data || []) as Array<Record<string, any>>
      if (rows.length !== 2) return res.status(404).json({ ok: false, error: 'not_in_queue' })
      for (const r of rows) {
        const meta = r.meta || {}, q = { ...(meta.queue || {}) }
        const win = String(r.id) === winner
        const key = win ? 'beat' : 'lost_to'
        q[key] = [...(Array.isArray(q[key]) ? q[key] : []), { id: win ? loser : winner, at: now }]
        const upd = await supabase.from('content_ideas').update({ meta: { ...meta, queue: q } }).eq('id', r.id).eq('updated_at', r.updated_at).select('id').maybeSingle()
        if (upd.error) return res.status(500).json({ ok: false, error: upd.error.message })
        if (!upd.data) return res.status(409).json({ ok: false, error: 'changed_under_you', note: 'the row changed; read the queue and try again' })
      }
      return res.status(200).json({ ok: true })
    }

    if (action === 'triage' || action === 'unqueue') {
      const id = String(b.id || '')
      if (b.decided_by !== 'Krish') return res.status(400).json({ ok: false, error: 'decided_by_krish_only', problems: ["decided_by must be 'Krish'"] })
      const { data: row, error } = await supabase.from('content_ideas').select(COLS).eq('id', id).not('queued_at', 'is', null).maybeSingle()
      if (error) return res.status(500).json({ ok: false, error: error.message })
      if (!row) return res.status(404).json({ ok: false, error: 'not_in_queue' })
      const meta = (row as any).meta || {}
      const queue = { ...(meta.queue || {}) }
      let patch: Record<string, unknown>
      if (action === 'unqueue') {
        patch = { queued_at: null, meta: { ...meta, queue: { ...queue, unqueued_at: now, unqueued_by: 'Krish' } } }
      } else {
        const t = parseTriage(b)
        if (!t.triage) return res.status(400).json({ ok: false, error: 'bad_triage', problems: t.problems })
        queue.triage_history = [...(Array.isArray(queue.triage_history) ? queue.triage_history : []), ...(queue.triage ? [queue.triage] : [])]
        queue.triage = triageBlock(t.triage, now)
        patch = { meta: { ...meta, queue } }
        if (t.triage.verdict === 'drop') patch = { ...patch, queued_at: null, protected_at: null, state: 'dropped' }
      }
      const upd = await supabase.from('content_ideas').update(patch).eq('id', id).eq('updated_at', (row as any).updated_at).select(COLS).maybeSingle()
      if (upd.error) return res.status(500).json({ ok: false, error: upd.error.message })
      if (!upd.data) return res.status(409).json({ ok: false, error: 'changed_under_you', note: 'the row changed; read the queue and try again' })
      return res.status(200).json({ ok: true, idea: present(upd.data as any) })
    }

    return res.status(400).json({ ok: false, error: 'unknown_action', note: "action is 'queue', 'triage', 'unqueue' or 'prefer'" })
  } catch (e) {
    return res.status(500).json({ ok: false, error: (e as Error).message })
  }
}

async function queueOne(res: VercelResponse, mark: QueueMark, triage: TriageInput | null, now: string) {
  let id = mark.id
  let row: Record<string, any> | null = null
  if (!id) {
    // A board idea with no row yet: find it by title first so a re-mark never makes a second.
    const norm = titleNorm(mark.idea)
    const found = await supabase.from('content_ideas').select(COLS).eq('title_norm', norm).is('buried_at', null).limit(1)
    if (found.error) return res.status(500).json({ ok: false, error: found.error.message })
    row = ((found.data || []) as Array<Record<string, any>>)[0] || null
    id = row ? String(row.id) : null
  } else {
    const got = await supabase.from('content_ideas').select(COLS).eq('id', id).maybeSingle()
    if (got.error) return res.status(500).json({ ok: false, error: got.error.message })
    if (!got.data) return res.status(404).json({ ok: false, error: 'no_such_idea' })
    row = got.data as Record<string, any>
  }

  if (!row) {
    const ins = await supabase.from('content_ideas').insert({
      idea: mark.idea.slice(0, 300), thesis: mark.so_what, state: 'seeded', source_type: 'synthesis',
      source_url: mark.source_url, source_snippet: (mark.fact || mark.so_what).slice(0, 500), source_captured_at: now,
      lane: mark.series ? 'publication' : null, lane_slot: mark.series, origin: 'agent', distribution: [],
      canonical_url: canonicalUrl(mark.source_url), title_norm: titleNorm(mark.idea), content_hash: contentHash(mark.idea),
      queued_at: now, protected_at: now,
      meta: { queue: queueMeta(mark, undefined, now, 'idea-queue') },
    }).select(COLS).single()
    if (ins.error) return res.status(500).json({ ok: false, error: ins.error.message })
    row = ins.data as Record<string, any>
    if (triage) return await applyTriage(res, row, triage, now)
    return res.status(200).json({ ok: true, created: true, idea: present(row) })
  }

  const meta = row.meta || {}
  const upd = await supabase.from('content_ideas')
    .update({ queued_at: row.queued_at || now, protected_at: row.protected_at || now, buried_at: null, meta: { ...meta, queue: queueMeta(mark, meta.queue, now, 'idea-queue') } })
    .eq('id', id).eq('updated_at', row.updated_at).select(COLS).maybeSingle()
  if (upd.error) return res.status(500).json({ ok: false, error: upd.error.message })
  if (!upd.data) return res.status(409).json({ ok: false, error: 'changed_under_you', note: 'the row changed; read the queue and try again' })
  if (triage) return await applyTriage(res, upd.data as Record<string, any>, triage, now)
  return res.status(200).json({ ok: true, created: false, idea: present(upd.data as any) })
}

async function applyTriage(res: VercelResponse, row: Record<string, any>, triage: TriageInput, now: string) {
  const meta = row.meta || {}
  const queue = { ...(meta.queue || {}) }
  queue.triage_history = [...(Array.isArray(queue.triage_history) ? queue.triage_history : []), ...(queue.triage ? [queue.triage] : [])]
  queue.triage = triageBlock(triage, now)
  const patch: Record<string, unknown> = { meta: { ...meta, queue } }
  if (triage.verdict === 'drop') Object.assign(patch, { queued_at: null, protected_at: null, state: 'dropped' })
  const upd = await supabase.from('content_ideas').update(patch).eq('id', row.id).eq('updated_at', row.updated_at).select(COLS).maybeSingle()
  if (upd.error) return res.status(500).json({ ok: false, error: upd.error.message })
  if (!upd.data) return res.status(409).json({ ok: false, error: 'changed_under_you' })
  return res.status(200).json({ ok: true, idea: present(upd.data as any) })
}
