import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_supabase.js'
import {
  callClaude, corpusForChannel, loadCorpus, loadVoiceBlock,
  materialsContext, pathId, readMaterials, robustJson, sanitizeVoice,
} from '../../_content.js'
import {
  applyAutofixes, buildFinalPassSystem, laneToVenture, normalizePass, rubricFor, subchannelRubric, type VentureKey,
} from '../../_finalPass.js'
import { guardEngine } from '../../_auth.js'
import { loadSubchannel } from '../../_subchannels.js'

// POST /api/content-ideas/:id/final-pass
//   body: { source_text: string, lenses?: string[] }
//
// The ship-moment editor. Runs Cleo over the WHOLE draft against the venture's
// rubric and returns a structured verdict the composer turns into a review gate:
//   - instant_fail  → Save Draft is disabled until it clears (Krish, Q1)
//   - autofixes     → real errors, applied to produce `cleaned_text` (Q2a)
//   - suggestions   → content improvements, dismissible one by one (Q2b/Q4)
//   - lenses        → (investigation) which investigative lenses landed (Q5)
//   - verify        → claims to source before shipping (Q12)
//   - standards     → the Five Standards, so this reads as one system with /score
//
// Read-only on the row except an audit stamp in meta.final_pass — the actual
// body change (accepting fixes/suggestions) happens client-side then rides the
// normal autosave + save-draft path. Nothing here fires the factory.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res)) return
  const id = pathId(req)
  if (!id) return res.status(400).json({ ok: false, error: 'id required' })

  const b = (req.body || {}) as { source_text?: string; lenses?: string[] }
  const sourceRaw = (b.source_text || '').trim()
  if (!sourceRaw) return res.status(400).json({ ok: false, error: 'source_text required — write a draft first' })

  const { data: idea } = await supabase
    .from('content_ideas').select('idea,thesis,meta,lane,lane_slot').eq('id', id).single()

  const materials = readMaterials(idea?.meta)

  // The lane picks the rubric, with one override: a piece carrying a verified
  // evidence manifest from the investigation pipeline is a teardown whatever
  // lane it sits in, so it is judged by the investigation rubric (five lenses,
  // an unverifiable load-bearing claim is an instant fail). Before Techonomic
  // was retired this only fired for lane='techonomic'; the depth engine now
  // publishes to MYMU as a Teardown and must not lose its bar on the way.
  //
  // A live subchannel is judged against its own mandate, read from
  // venture_formats now (see subchannelRubric). A null lane no longer drops a
  // routed piece onto the 'dynamic' (Unassigned) rubric: the ladder sets
  // lane_slot and never lane, so every walk piece arrived that way.
  const sub = hasInvestigationManifest(idea?.meta) ? null : await loadSubchannel(idea?.lane_slot)
  const venture: VentureKey = hasInvestigationManifest(idea?.meta)
    ? 'investigation'
    : sub ? sub.slug as VentureKey : laneToVenture(idea?.lane, idea?.lane_slot)
  const rubric = sub ? subchannelRubric(sub) : rubricFor(venture)

  const [voice, corpus] = await Promise.all([loadVoiceBlock(), loadCorpus()])
  const channelCorpus = corpusForChannel(corpus, rubric.corpusChannel)
  // The final pass verifies claims against these, so it reads more of each
  // source than a writer does. At the writer's allowance the oldest research
  // was cut to "[trimmed]" and the pass asked to verify figures that were on
  // file (walk finding F5, 2026-09-24).
  const materialsBlock = materials.length ? `\n${materialsContext(materials, 4000, 16000)}` : ''

  // Deterministic em-dash sanitize first, so the model never wastes an autofix on
  // it and the diff Krish reviews is the same text that will ship.
  const source = sanitizeVoice(sourceRaw)

  const lenses = Array.isArray(b.lenses) ? b.lenses.filter(x => typeof x === 'string') : undefined
  const system = buildFinalPassSystem({ rubric, voice, channelCorpus, materialsBlock, cfg: { lenses } })

  const ctx = idea
    ? `PIECE: ${idea.idea}${idea.thesis ? `\nTHESIS: ${idea.thesis}` : ''}\n\n`
    : ''
  const user = `${ctx}Run the final pass on this draft. Return only the JSON object.\n\nDRAFT:\n${source}`

  let result
  try {
    // The result echoes the whole cleaned draft inside its JSON, so a 900-word
    // piece plus its suggestions ran past 3,200 tokens and the JSON was cut off
    // mid-object: two of five walk runs returned 502 and lost their spend
    // (walk finding F6). 6,000 leaves room for a long piece.
    const txt = await callClaude({ agent: 'cleo-final-pass', cache: true, system, user, maxTokens: 6000, temperature: 0.3 })
    const parsed = robustJson(txt)
    if (!parsed) return res.status(502).json({ ok: false, error: 'could not parse final pass result' })
    result = normalizePass(parsed)
  } catch (e: any) {
    return res.status(502).json({ ok: false, error: String(e?.message || e) })
  }

  // Apply the auto-fixes (errors only) to produce the cleaned draft the UI adopts.
  // Re-sanitize in case a fix reintroduced a dash. Suggestions are NOT applied here.
  const cleaned = sanitizeVoice(applyAutofixes(source, result.autofixes))

  // The full review payload the composer renders — built once so the DB copy and
  // the HTTP response are identical.
  const payload = {
    venture,
    venture_label: rubric.label,
    has_lenses: !!rubric.lenses,
    cleaned_text: cleaned,
    changed: cleaned !== source,
    ...result,
  }

  // Durable result: persist the WHOLE payload (not just an audit stamp) keyed by a
  // hash of the exact input draft. This is what makes the review survive a dropped
  // response — if the browser tab is backgrounded / the connection blips / the
  // gateway 504s AFTER the function finished, the composer recovers this via the
  // content_ideas realtime channel instead of losing Cleo's work. `source_hash`
  // lets the client confirm the result still matches the draft on screen.
  const meta = (idea?.meta || {}) as any
  await supabase.from('content_ideas')
    .update({
      meta: {
        ...meta,
        final_pass: {
          venture,
          at: new Date().toISOString(),
          instant_fail: result.instant_fail.failed,
          verdict: result.verdict,
          counts: {
            autofixes: result.autofixes.length,
            suggestions: result.suggestions.length,
            verify: result.verify.length,
          },
          source_hash: hashText(sourceRaw),
          result: payload,
        },
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  return res.status(200).json({ ok: true, ...payload })
}

/** True when api/_investigation.ts has attached a verified evidence manifest to
 *  this row (materials entries carry `investigation_id`). */
function hasInvestigationManifest(meta: unknown): boolean {
  const list = (meta as { materials?: unknown } | null | undefined)?.materials
  if (!Array.isArray(list)) return false
  return list.some(m => Boolean((m as { investigation_id?: string } | null)?.investigation_id))
}

/** Stable, deterministic djb2 string hash (matches the composer's hashText). */
function hashText(s: string): string {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
  return (h >>> 0).toString(36)
}

// Claude/webhook calls here can run 20-60s; raise the function ceiling above
// the short platform default so the request finishes instead of being killed
// mid-call (the cause of the composer hanging then dropping back to the draft).
export const config = { maxDuration: 60 }
