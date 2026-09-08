import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { guard } from '../../_auth.js'
import { corpusForChannel, laneToCorpusChannel, loadCorpus, loadVoiceBlock, pathId } from '../../_content.js'
import { supabase } from '../../_supabase.js'
import { deterministicFindings } from '../../_judges/deterministic.js'
import { runPanel } from '../../_judges/panel.js'
import { ROSTER_VERSION } from '../../_judges/roster.js'

// Put a piece in front of the panel.
//
//   POST /api/content-ideas/:id/judge            the idea gate
//   POST /api/content-ideas/:id/judge {gate:'draft', channel:'substack'}
//
// The panel reports and stops. It never changes the piece's state, never
// approves and never bins: those are Krish's, and the whole value of the panel
// depends on him staying the one who decides. What it returns is six or seven
// independent readings with their disagreement intact, which he can act on in
// one tap.
//
// Every run is stored against the exact artifact hash, so a verdict can never
// drift onto a version it did not read, and the calibration view can later ask
// the only question that matters about a judge: did it predict him.

const MIN_IDEA_CHARS = 40
const MIN_DRAFT_CHARS = 400
// A panel is six or seven small calls. The budget is the function's, not a
// user's patience: leave room for the slowest judge rather than truncating the
// panel into a partial answer.
const JUDGE_TIMEOUT_MS = 45_000

interface IdeaRow {
  id: string
  idea: string
  thesis: string | null
  body: string | null
  lane: string | null
  lane_slot: string | null
  state: string
  source_type: string | null
  meta: Record<string, unknown> | null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guard(req, res, ['POST'])) return

  const id = pathId(req)
  if (!id) return res.status(400).json({ ok: false, error: 'id_required' })

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>
  const gate = body.gate === 'draft' ? 'draft' : 'idea'
  const channel = typeof body.channel === 'string' ? body.channel.slice(0, 40) : null
  const idempotencyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key : randomUUID()

  const { data, error } = await supabase
    .from('content_ideas')
    .select('id, idea, thesis, body, lane, lane_slot, state, source_type, meta')
    .eq('id', id)
    .maybeSingle()
  if (error) return res.status(500).json({ ok: false, error: 'read_failed' })
  if (!data) return res.status(404).json({ ok: false, error: 'not_found' })
  const row = data as IdeaRow

  // What exactly is being judged. The idea gate reads the claim; the draft gate
  // reads the piece. Judging the wrong artifact is the easiest way to make a
  // panel useless, so it is explicit rather than inferred.
  const artifact = gate === 'idea'
    ? [row.idea, row.thesis].filter(Boolean).join('\n\n')
    : (row.body || '')
  if (!artifact.trim()) {
    return res.status(400).json({ ok: false, error: gate === 'draft' ? 'no_draft_to_judge' : 'no_idea_to_judge' })
  }

  // The free checks first, so a duplicate or a two-line thought never costs a
  // model call.
  let existing: { id: string; idea: string } | null = null
  if (gate === 'idea') {
    const { data: dupe } = await supabase
      .from('content_ideas')
      .select('id, idea')
      .eq('idea', row.idea)
      .neq('id', row.id)
      .is('buried_at', null)
      .limit(1)
    existing = (dupe?.[0] as { id: string; idea: string } | undefined) ?? null
  }
  const deterministic = deterministicFindings({
    text: artifact,
    minChars: gate === 'idea' ? MIN_IDEA_CHARS : MIN_DRAFT_CHARS,
    existing,
    checkVoice: gate === 'draft',
  })

  // What every judge may read. Recent ideas are here so the novelty judge has
  // something to be specific about rather than guessing at what is familiar.
  const [voice, corpus] = await Promise.all([loadVoiceBlock(), loadCorpus()])
  const { data: recent } = await supabase
    .from('content_ideas')
    .select('idea')
    .neq('id', row.id)
    .order('created_at', { ascending: false })
    .limit(40)
  const context = [
    '### How Krish writes', voice,
    '### What he has published', corpusForChannel(corpus, laneToCorpusChannel(row.lane, row.lane_slot)),
    '### Ideas already in the system (for the novelty judge)',
    (recent || []).map(r => `- ${String((r as { idea: string }).idea).slice(0, 160)}`).join('\n') || '(none)',
    channel ? `### The channel this is for\n${channel}` : '',
  ].filter(Boolean).join('\n\n')

  const panel = await runPanel({
    gate,
    subjectTable: 'content_ideas',
    subjectId: row.id,
    artifact,
    context,
    deterministic,
    idempotencyKey,
    timeoutMs: JUDGE_TIMEOUT_MS,
  })

  // Store the run, then the verdicts. A run that cannot be stored is still
  // returned: the panel already did the work, and losing the answer because the
  // ledger write failed would be the worst of both.
  const { data: stored, error: runError } = await supabase
    .from('panel_runs')
    .insert({
      idempotency_key: panel.idempotency_key,
      gate: panel.gate,
      subject_table: 'content_ideas',
      subject_id: row.id,
      artifact_hash: panel.artifact_hash,
      roster_version: ROSTER_VERSION,
      spread: panel.spread,
      dissent: panel.dissent,
      tiebreaker_used: false,
      cost_usd: panel.cost_usd,
      started_at: panel.started_at,
      finished_at: panel.finished_at,
    })
    .select('id')
    .maybeSingle()

  let panelRunId: string | null = (stored as { id: string } | null)?.id ?? null
  if (runError && !panelRunId) {
    // A replay of the same idempotency key is not an error: return the run that
    // already exists so the caller sees one panel, not a duplicate.
    const { data: prior } = await supabase
      .from('panel_runs')
      .select('id')
      .eq('idempotency_key', panel.idempotency_key)
      .maybeSingle()
    panelRunId = (prior as { id: string } | null)?.id ?? null
  }

  if (panelRunId) {
    await supabase.from('judge_verdicts').insert(panel.verdicts.map(v => ({
      panel_run_id: panelRunId,
      judge: v.judge,
      score: v.score,
      verdict: v.verdict,
      the_one_fix: v.the_one_fix,
      evidence: v.evidence,
      confidence: v.confidence,
      deterministic: v.deterministic,
      model: v.model,
      cost_usd: 0,
    })))
  }

  return res.status(200).json({
    ok: true,
    schema_version: 1,
    panel_run_id: panelRunId,
    gate: panel.gate,
    artifact_hash: panel.artifact_hash,
    roster_version: panel.roster_version,
    short_circuited: panel.short_circuited,
    dissent: panel.dissent,
    spread: panel.spread,
    verdicts: panel.verdicts,
    // Said plainly, because the whole contract is that the machine does not
    // decide. The UI shows this next to the buttons.
    decision: 'Krish decides. The panel has no vote.',
  })
}
