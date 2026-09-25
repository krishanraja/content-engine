import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { supabase } from '../../_supabase.js'
import {
  callClaude, corpusForChannel, loadCorpus, loadVoiceBlock, pathId,
  robustJson, sanitizeVoice, VOICE_GUARDRAILS,
} from '../../_content.js'
import { curationBlock } from '../../_curation.js'
import { operatorAttribution, sha256 } from '../../_editEvents.js'
import { UTILITY_MODEL } from '../../_models.js'
import { loadSubchannel } from '../../_subchannels.js'
import { subchannelRulesBlock } from '../../_houseRules.js'
import { guardEngine } from '../../_auth.js'

// POST /api/content-ideas/:id/draft
//   body: { instruction?: string }   Krish's direction for this draft, up to 1600 chars
//
// Writes a full draft into an idea that already exists.
//
// ── WHY THIS ROUTE EXISTS ────────────────────────────────────────────────
//
// Until 2026-09-24 nothing could. research-topic and synthesize create NEW
// rows; revise rewrites text it is handed; chat replies. So an idea the judge
// ladder had worked up and ranked ready (an angle, the parties, a counter-case,
// dated sources, Krish's own notes from grading it) had no way to become a
// piece without someone pasting it into a chat. None of the drafting-class
// routes had been called in 60 days. Found on the first piece of the
// three-piece walk (docs/walks/2026-09-three-piece-walk.md).
//
// ── WHAT IT READS, AND WHY EACH ONE ─────────────────────────────────────
//
// The mandate comes from venture_formats, live, never a copy: it is the test
// the piece must pass, and it decides the structure and the close. Everything
// curation produced goes in, because it was produced to be used here and until
// now nothing read it: the angle the panel judged (not the raw seed), the
// counter-case (meta.contrarian), the dated sources (meta.adjacent_stories),
// research and materials, and Krish's notes, verbatim, as his words.
//
// ── WHAT IT WRITES ──────────────────────────────────────────────────────
//
// body, state 'drafting' for a seeded or researching row, meta.drafts (the
// last ten, each with what the model said it inferred and what needs
// checking), and one magic_invoked row in the ledger so the verdict on the
// draft can pair with it. The write is guarded on updated_at: a model call
// takes a minute, and writing back a stale copy of meta is how every other
// drafting route loses concurrent work.

const MAX_DRAFTS = 10

interface Row {
  id: string
  idea: string | null
  thesis: string | null
  body: string | null
  lane: string | null
  lane_slot: string | null
  state: string
  updated_at: string
  meta: Record<string, any> | null
}

interface DraftOut {
  body?: string
  sources_cited?: unknown
  labelled_inferences?: unknown
  open_questions?: unknown
}

const strings = (v: unknown, cap = 20): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, cap) : []

// Re-exported for tests/control-plane/draft-context.test.ts.
export { curationBlock }

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res)) return
  const id = pathId(req)
  if (!id) return res.status(400).json({ ok: false, error: 'id_required' })
  const b = (req.body && typeof req.body === 'object' ? req.body : {}) as { instruction?: unknown }
  const instruction = typeof b.instruction === 'string' && b.instruction.trim() ? b.instruction.trim().slice(0, 1600) : null

  const { data, error } = await supabase
    .from('content_ideas')
    .select('id, idea, thesis, body, lane, lane_slot, state, updated_at, meta')
    .eq('id', id)
    .maybeSingle()
  if (error) return res.status(500).json({ ok: false, error: 'read_failed' })
  if (!data) return res.status(404).json({ ok: false, error: 'not_found' })
  const row = data as Row
  if (['published', 'dropped', 'absorbed'].includes(row.state)) {
    return res.status(409).json({ ok: false, error: `not_draftable_in_state_${row.state}` })
  }

  // A piece is written TO a mandate. With no subchannel there is no test to
  // write against, and guessing one is how a draft reads finished and is
  // written to the wrong brief.
  const sub = await loadSubchannel(row.lane_slot)
  if (!sub) return res.status(409).json({ ok: false, error: 'no_subchannel', detail: 'Route this idea to a subchannel before drafting it.' })

  const [voice, corpus] = await Promise.all([loadVoiceBlock(), loadCorpus()])
  const system = [
    `You are drafting one piece for Krish Raja's publication, in his voice, for the subchannel ${sub.label}.`,
    `=== THE MANDATE FOR ${sub.label.toUpperCase()} ===\n${sub.mandate}\n\nThe mandate is the test this piece must pass. It governs the question the piece asks, its structure and how it closes. Where the voice notes below disagree with the mandate about structure or the close, the mandate wins. Krish's house rules win over both: every piece still ends with a dated prediction.`,
    subchannelRulesBlock('write', sub.slug),
    voice ? `=== VOICE ===\n${voice}` : '',
    `=== HOUSE RULES ===\n${VOICE_GUARDRAILS}`,
    `=== THE CORPUS: house register and this subchannel's playbook ===\n${corpusForChannel(corpus, sub.slug)}`,
  ].filter(Boolean).join('\n\n')

  const user = curationBlock(row, instruction) + '\n\n' +
    'Write the piece. 700 to 1000 words, markdown, ready to read. No title card, no notes to Krish, no meta commentary.\n' +
    'Return ONLY one JSON object: {"body": string, "sources_cited": [the URLs of the sources on file you actually drew on], ' +
    '"labelled_inferences": [each claim in the body that is inference rather than sourced fact, quoted exactly as it appears], ' +
    '"open_questions": [each thing that must be checked before this publishes]}.'

  let out: DraftOut
  try {
    const text = await callClaude({
      agent: 'cleo-draft',
      model: UTILITY_MODEL,
      system,
      user,
      maxTokens: 4000,
      timeoutMs: 110_000,
    })
    out = (robustJson(text) || {}) as DraftOut
  } catch (e) {
    return res.status(502).json({ ok: false, error: String((e as Error)?.message || e).slice(0, 200) })
  }
  const body = sanitizeVoice(String(out.body || '')).trim()
  if (body.length < 400) return res.status(502).json({ ok: false, error: 'draft_too_short_or_unparseable' })

  const words = body.split(/\s+/).filter(Boolean).length
  const entry = {
    at: new Date().toISOString(),
    model: UTILITY_MODEL,
    subchannel: sub.slug,
    words,
    body_hash: sha256(body),
    instruction,
    sources_cited: strings(out.sources_cited),
    labelled_inferences: strings(out.labelled_inferences, 30),
    open_questions: strings(out.open_questions, 30),
  }
  const meta = row.meta || {}
  const drafts = Array.isArray(meta.drafts) ? meta.drafts : []
  const nextState = ['seeded', 'researching'].includes(row.state) ? 'drafting' : row.state

  const { data: written, error: writeError } = await supabase
    .from('content_ideas')
    .update({
      body,
      state: nextState,
      meta: { ...meta, drafts: [entry, ...drafts].slice(0, MAX_DRAFTS) },
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('updated_at', row.updated_at)
    .select('id')
  if (writeError) return res.status(500).json({ ok: false, error: 'write_failed' })
  if (!written || !written.length) {
    // Someone else changed the row during the model call. Their change wins;
    // the draft is returned so nothing is lost, but it is not written over them.
    return res.status(409).json({ ok: false, error: 'changed_during_draft', body })
  }

  const seed = [row.idea || '', row.thesis || ''].join('\n\n')
  const operator = operatorAttribution(req.headers.authorization, req.body)
  const editEventId = randomUUID()
  const { error: ledgerError } = await supabase.from('content_edit_events').insert({
    idempotency_key: editEventId,
    subject_table: 'content_ideas',
    subject_id: id,
    artifact_kind: 'draft',
    action: 'magic_invoked',
    mode: 'draft',
    value: sub.slug,
    instruction,
    before_hash: sha256(seed),
    chars_before: seed.length,
    chars_after: body.length,
    panel_run_id: typeof meta.ladder?.panel_run_id === 'string' ? meta.ladder.panel_run_id : null,
    // Who asked, from how they got in: the cookie is Krish in Control Center;
    // the operator bearer is a session acting as itself unless it relays him
    // (decided_by: 'Krish'), and its own calls are observations.
    confirmation_state: operator?.observation ? 'observation_only' : 'pending',
    surface: operator ? operator.surface : 'composer',
    client: operator ? operator.client : 'desktop',
    ...(operator ? { actor: operator.actor } : {}),
  })
  if (ledgerError) console.warn(`[edit-ledger] draft not recorded for ${id}: ${ledgerError.message}`)

  return res.status(200).json({
    ok: true,
    state: nextState,
    subchannel: sub.slug,
    words,
    body,
    sources_cited: entry.sources_cited,
    labelled_inferences: entry.labelled_inferences,
    open_questions: entry.open_questions,
    edit_event_id: ledgerError ? null : editEventId,
  })
}

export const config = { maxDuration: 120 }
