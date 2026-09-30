import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { operatorAttribution, sha256 } from '../../_editEvents.js'
import { supabase } from '../../_supabase.js'
import { emptyOutput, failWith, modelFailure, openStream, send, streamClaude } from '../../_stream.js'
import { corpusForChannel, laneToCorpusChannel, loadCorpus, loadVoiceBlock, materialsContext, pathId, readMaterials, sanitizeVoice } from '../../_content.js'
import { isHumourRegister } from '../../_humor.js'
import { buildRevisePrompt, REVISE_MODES } from '../../_revisePrompt.js'
import { UTILITY_MODEL } from '../../_models.js'
import { guardEngine } from '../../_auth.js'
import { loadSubchannel } from '../../_subchannels.js'
import { guardConfidence, selfCheck } from '../../_selfCheck.js'

// POST /api/content-ideas/:id/revise
//   body: {
//     mode: 'tone' | 'length' | 'zoom' | 'feedback' | 'humor',
//     value: string,            // preset value (e.g. 'punchier') or feedback chip
//     instruction?: string,     // open-ended feedback (free text)
//     hint?: string,            // steer text from the client preset (TONE/LENGTH/ITERATE)
//     source_text: string,      // the draft currently on screen (body or a variant)
//     selection?: string,       // optional substring to rewrite in place
//   }
//
// In-place rewrite of the CURRENT draft (Phases 1 + 5). Does NOT mutate the row's
// body — returns the revised text so the card can preview-then-accept. A history
// entry is appended to meta.revisions[] for auditability.
//
// Success is a stream that ends with a `done` event whose `ok` is true. A
// failure is typed (ModelErrorBody in api/_stream.ts): known before the
// stream opens (a usage limit, a bad key, an overload the provider answered
// at once), it is a JSON body with a failure status; after it opens, it is
// the stream's last event, `error`, and no `done` follows. Neither writes
// meta.revisions or a ledger row. docs/CONTENT_ENGINE.md has the shapes.
//
// The publish gate's mechanical checks read the rewrite before `done`, and
// one more call fixes what they find (api/_selfCheck.ts). On 2026-09-30 a
// rewrite of piece 1 came back with two "Not X, Y" constructions, and a
// rewrite of one of those sentences, asked to remove it, returned it three
// times running. `done` says what the rewrite still breaks, as `self_check`.

// The time a request has for both calls: maxDuration (below), less 15
// seconds to record it and answer.
const BUDGET_MS = 285_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const started = Date.now()
  if (guardEngine(req, res)) return
  const id = pathId(req)
  if (!id) return res.status(400).json({ ok: false, error: 'id required' })

  const b = (req.body || {}) as {
    mode?: string; value?: string; instruction?: string; hint?: string
    source_text?: string; selection?: string; client?: string
  }
  const mode = b.mode || 'feedback'
  const sourceText = (b.source_text || '').trim()
  if (!sourceText) return res.status(400).json({ ok: false, error: 'source_text required' })
  if (!(REVISE_MODES as readonly string[]).includes(mode)) {
    return res.status(400).json({ ok: false, error: 'invalid mode' })
  }
  // Humour passes get a dedicated, examples-driven system prompt (see _humor.ts),
  // run hotter and on a stronger model — the generic rewriter does not produce it.
  const humour = mode === 'humor' || isHumourRegister(b.value)

  // Grab the idea for context (thesis/angle) — best effort.
  const { data: idea } = await supabase
    .from('content_ideas').select('idea,thesis,meta,lane,lane_slot').eq('id', id).single()

  const [voice, corpus] = await Promise.all([loadVoiceBlock(), loadCorpus()])
  // Adapt-to-lane (value 'adapt-<channel>') rewrites the draft FOR a different
  // channel, so the corpus must follow the target, not the piece's current lane.
  const adaptMatch = /^adapt-(.+)$/.exec(b.value || '')
  const corpusChannel = adaptMatch ? adaptMatch[1] : laneToCorpusChannel((idea as any)?.lane, (idea as any)?.lane_slot)
  const channelCorpus = corpusForChannel(corpus, corpusChannel)
  const materials = readMaterials((idea as any)?.meta)
  const materialsBlock = materials.length ? `\n\n${materialsContext(materials)}` : ''
  // The mandate follows the same target as the corpus: the subchannel being
  // adapted to, else the one the piece is routed to. Null for anything else.
  const sub = await loadSubchannel(adaptMatch ? adaptMatch[1] : (idea as any)?.lane_slot)

  const inPlace = !!(b.selection && sourceText.includes(b.selection))

  const { system, user } = buildRevisePrompt(
    {
      voice,
      channelCorpus,
      materialsBlock,
      idea: idea ? { idea: idea.idea, thesis: idea.thesis, contrarian: (idea as any)?.meta?.contrarian ?? null } : null,
      mandate: sub ? { label: sub.label, text: sub.mandate, slug: sub.slug } : null,
    },
    {
      mode, value: b.value, hint: b.hint, instruction: b.instruction,
      sourceText, selection: b.selection, humour,
    },
  )

  // Streamed. The user is watching their own draft being rewritten, which is
  // the single best case for streaming in the product: the text appearing IS
  // the progress indicator, and no honest placeholder can beat it.
  //
  // What streams is the raw fragment, as a preview. What the client APPLIES is
  // the `revised` value in the `done` event, after sanitizeVoice and (for an
  // in-place edit) the splice back into the full draft. Those cannot be done
  // per-token, and applying half-sanitised text would put em dashes into the
  // draft that the voice pass exists to remove.
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(503).json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' })

  const call = {
    // The single best place in the engine for a prefix cache. `system` holds
    // the rubric, the voice block and the channel corpus and does not change
    // between passes; `user` holds the draft. One piece gets revised many
    // times in a sitting, so from the second pass on the largest part of the
    // request is served at a tenth of the price.
    cache: true,
    apiKey,
    model: humour ? 'claude-opus-4-8' : UTILITY_MODEL,
    // Matches the other rewrite surfaces (channel-cut, synthesize) rather than
    // the provider default this silently ran at before streamClaude accepted a
    // temperature. Ignored on the humour path: opus rejects sampling params.
    temperature: 0.5,
    maxTokens: mode === 'length' && b.value === 'long' ? 3200 : 2200,
    system,
  }

  // The stream opens only once the provider has accepted the call, so a
  // refusal reaches the caller as a status it cannot mistake for success.
  let opened = false
  let firstText: string
  try {
    firstText = (await streamClaude({
      ...call,
      agent: 'cleo-revise',
      messages: [{ role: 'user', content: user }],
      onOpen: () => { openStream(res); opened = true },
      onText: chunk => send(res, 'delta', { text: chunk }),
    })).trim()
  } catch (e: unknown) {
    const failure = modelFailure('revise_failed', 'The rewrite', e)
    if (!opened) {
      if (failure.retryAfterSeconds) res.setHeader('Retry-After', String(failure.retryAfterSeconds))
      return res.status(failure.status).json(failure.body)
    }
    return failWith(res, failure.body)
  }
  // Strip stray surrounding quotes / em dashes the model may have slipped in.
  const clean = (text: string) => sanitizeVoice(text.trim().replace(/^["'`]+|["'`]+$/g, ''))
  const revisedFragment = clean(firstText)
  if (!revisedFragment) return failWith(res, emptyOutput('revise_failed', 'The rewrite'))

  // One more call when the rewrite breaks a blocking rule, metered on its own
  // key: the same system prompt, the first request and answer, and the
  // correction. Its text is not streamed: the preview already on screen is
  // the first answer, and `done` carries the one to apply. A passage has no
  // reading age of its own, so an in-place rewrite is checked without it.
  const checked = await selfCheck({
    first: revisedFragment,
    readingAge: !inPlace,
    answer: inPlace ? 'Return only the rewritten passage.' : 'Return only the whole rewritten text.',
    deadline: started + BUDGET_MS,
    minShare: inPlace ? 0 : 0.7,
    retry: async (correction, timeoutMs) => {
      const stop = new AbortController()
      const timer = setTimeout(() => stop.abort(), timeoutMs)
      try {
        return clean(await streamClaude({
          ...call,
          agent: 'cleo-revise-retry',
          messages: [{ role: 'user', content: user }, { role: 'assistant', content: firstText }, { role: 'user', content: correction }],
          signal: stop.signal,
          onText: () => {},
        }))
      } finally {
        clearTimeout(timer)
      }
    },
  })

  // How sure we are is Krish's to set: the rewrite keeps the source's, label
  // and number, and gets it back if the model dropped it (walk log F43).
  const confidence = guardConfidence(inPlace ? sourceText.replace(b.selection as string, checked.text) : checked.text, sourceText)
  const revised = confidence.text
  const self_check = { ...checked.self_check, confidence_restored: confidence.restored }

  // Append history (non-destructive; body is only changed when the user accepts).
  const meta = (idea?.meta || {}) as any
  const revisions = Array.isArray(meta.revisions) ? meta.revisions : []
  revisions.unshift({ mode, value: b.value || null, instruction: b.instruction || null, at: new Date().toISOString(), chars: revised.length })
  await supabase.from('content_ideas')
    .update({ meta: { ...meta, revisions: revisions.slice(0, 20) }, updated_at: new Date().toISOString() })
    .eq('id', id)

  // The ledger half. meta.revisions[] records that the button was pressed;
  // this records what it was pressed ON, so the composer can later resolve the
  // same event to accepted or rejected. Without the pairing we are back to
  // knowing which edits Krish tried and never which ones survived, which is the
  // gap that made meta.revisions[] unreadable for a year.
  //
  // Best effort on purpose: a ledger write must never cost him the rewrite he
  // just waited twenty seconds for. Swallowed, never thrown, but SAID.
  //
  // supabase-js RETURNS its errors rather than throwing them, so discarding the
  // result made a rejected row indistinguishable from a written one, and the
  // catch below never saw anything either. Every admission rule on this table
  // is a CHECK constraint, so the likely failure is a 23514 nobody has ever
  // seen. Same shape as the usage meter dropping meter_add's error for six
  // days, and it matters more here: the table had one row in it, a smoke test.
  const editEventId = randomUUID()
  const operator = operatorAttribution(req.headers.authorization, req.body)
  try {
    const { error } = await supabase.from('content_edit_events').insert({
      idempotency_key: editEventId,
      subject_table: 'content_ideas',
      subject_id: id,
      artifact_kind: 'draft',
      action: 'magic_invoked',
      mode,
      value: b.value ? String(b.value).slice(0, 120) : null,
      instruction: b.instruction ? String(b.instruction).slice(0, 1600) : null,
      selection_hash: b.selection ? sha256(String(b.selection)) : null,
      before_hash: sha256(sourceText),
      chars_before: sourceText.length,
      chars_after: revised.length,
      // An operator session's own rewrite is an observation, not his (see
      // operatorAttribution); a browser's is his, pending his verdict.
      ...(operator
        ? { confirmation_state: operator.observation ? 'observation_only' : 'pending', surface: operator.surface, client: operator.client, actor: operator.actor }
        : { confirmation_state: 'pending', surface: 'composer', client: typeof b.client === 'string' && b.client === 'mobile' ? 'mobile' : 'desktop' }),
    })
    if (error) console.warn(`[edit-ledger] magic_invoked not recorded for ${id}: ${error.message || error}`)
  } catch (e) {
    // The rewrite is the product; the ledger is the record of it.
    console.warn(`[edit-ledger] magic_invoked threw for ${id}: ${(e as Error)?.message || e}`)
  }

  // The client returns this to resolve the event when Krish accepts or keeps
  // the current version.
  send(res, 'done', { ok: true, revised, mode, value: b.value || null, edit_event_id: editEventId, self_check })
  return res.end()
}

// Claude/webhook calls here can run 20-60s; raise the function ceiling above
// the short platform default so the request finishes instead of being killed
// mid-call (the cause of the composer hanging then dropping back to the draft).
// Two such calls when the self-check asks for a second: see BUDGET_MS.
export const config = { maxDuration: 300 }
