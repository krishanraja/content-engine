import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_supabase.js'
import { guardEngine } from '../../_auth.js'
import { pathId, callClaude, robustJson } from '../../_content.js'
import { SYNTHESIS_MODEL } from '../../_models.js'
import { readVerdicts, sectionsOf, SPINE_SYSTEM, spineResult, spineStatus, spineUser } from '../../_spine.js'

// POST /api/content-ideas/:id/spine-check  {spine, answer}
//   Judges every section of the piece's body against its one spine (house rule
//   ONE_SPINE) and stores the result as meta.spine_check, bound to the body's
//   hash. GET returns the stored check and whether it covers the current words.
//   The spine is the question and one-line answer Krish approved at the outline.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res, ['GET', 'POST'])) return
  const id = pathId(req)
  if (!id) return res.status(400).json({ ok: false, error: 'id required' })
  const { data: row, error } = await supabase.from('content_ideas').select('id,body,meta').eq('id', id).single()
  if (error || !row) return res.status(404).json({ ok: false, error: 'idea not found' })
  const meta = (row.meta || {}) as Record<string, any>
  const body = String(row.body || '')

  if (req.method === 'GET') {
    const status = spineStatus(meta, body)
    return res.status(200).json({ ok: true, current: status.ok, reason: status.reason, spine_check: status.check })
  }

  const spine = String(req.body?.spine || '').trim()
  const answer = String(req.body?.answer || '').trim()
  if (!spine.endsWith('?')) return res.status(400).json({ ok: false, error: 'spine must be the one question the piece answers, ending with "?"' })
  if (!answer) return res.status(400).json({ ok: false, error: 'answer (the one-line answer Krish approved) is required' })
  const sections = sectionsOf(body)
  if (!sections.length) return res.status(400).json({ ok: false, error: 'the piece has no body to judge' })

  let raw: string
  try {
    raw = await callClaude({
      agent: 'spine-check', model: SYNTHESIS_MODEL, maxTokens: 1500, temperature: 0, timeoutMs: 90_000,
      system: SPINE_SYSTEM, user: spineUser(spine, answer, sections),
    })
  } catch (e) {
    return res.status(503).json({ ok: false, error: `the judge could not be reached, so nothing was recorded: ${(e as Error).message}` })
  }
  const result = spineResult(spine, answer, body, readVerdicts(robustJson(raw), sections))
  const fresh = await supabase.from('content_ideas').select('meta').eq('id', id).single()
  const nowMeta = (fresh.data?.meta || meta) as Record<string, any>
  const { error: upErr } = await supabase.from('content_ideas').update({ meta: { ...nowMeta, spine_check: result } }).eq('id', id)
  if (upErr) return res.status(500).json({ ok: false, error: upErr.message })
  return res.status(200).json({ ok: true, passed: result.passed, spine_check: result })
}
