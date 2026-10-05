import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_supabase.js'
import {
  callClaude, loadVoiceBlock, materialsContext, pathId, readMaterials, robustJson, VOICE_GUARDRAILS,
} from '../../_content.js'
import { UTILITY_MODEL } from '../../_models.js'
import { guardEngine } from '../../_auth.js'
import { subchannelRulesBlock } from '../../_houseRules.js'
import { loadSubchannel } from '../../_subchannels.js'
import { emptyOutput, modelFailure } from '../../_stream.js'
import { classifyAnthropicFailure, describeFailure } from '../../_modelProvider.js'
import { MIN_RETRY_MS } from '../../_selfCheck.js'
import {
  failures, lintAnswer, packagingCorrection, packagingRequest, packagingRulesBlock, readAnswer, watchLabel,
  type PackageAnswer,
} from '../../_packaging.js'

// POST /api/content-ideas/:id/package
//   body: { thumbnail_text?: string, video_seconds?: number, hint?: string }
//
// Write and KEEP the YouTube title and description for a piece's video.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────
// Krish, 2026-10-05, about the video for piece 1: "whats a viral video title
// for this". His own draft was 112 characters, over YouTube's cap of 100, and
// the title that worked (59 characters) came out of one chat's reasoning. He
// then asked for everything like it to become "a part of the durable engine"
// (walk log F59). The engine could write the video's script (channel-cut
// 'youtube', api/_video.ts), whose title is only a working title; nothing
// wrote what he pastes into YouTube Studio. The rules that made the good
// title, and the checks a machine can make of them, are in api/_packaging.ts.
//
// ── WHAT IT DOES ─────────────────────────────────────────────────────────
// Reads the piece (a 409 no_draft without one, as channel-cut), the voice
// block, the house rules and the subchannel's mandate, and asks the utility
// model once for a title, two backups and a description. lintPackage checks
// the answer. When anything fails, the writer gets one more call listing each
// problem in plain words, and the answer with fewer failures is kept, the
// first on a tie. It never asks a third time: what still fails is stored and
// returned, so the person reading sees it.
//
// ── WHAT IT WRITES ───────────────────────────────────────────────────────
// transformed_outputs.youtube_package, beside the channel cuts, merged so the
// cuts survive. It never touches `body` and never publishes anything: Krish
// pastes the words into YouTube Studio himself. The write is guarded on
// updated_at, so a change made during the model call is never written over.

/** The time a request has for both calls: maxDuration (below), less 15
 *  seconds to write the row and answer. */
const BUDGET_MS = 135_000
/** One call's deadline. A title and a description are short. */
const CALL_MS = 60_000

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const started = Date.now()
  if (guardEngine(req, res)) return
  const id = pathId(req)
  if (!id) return res.status(400).json({ ok: false, error: 'id required' })

  const b = (req.body && typeof req.body === 'object' ? req.body : {}) as { thumbnail_text?: unknown; video_seconds?: unknown; hint?: unknown }
  const thumbnailText = typeof b.thumbnail_text === 'string' && b.thumbnail_text.trim() ? b.thumbnail_text.trim().slice(0, 300) : null
  const hint = typeof b.hint === 'string' && b.hint.trim() ? b.hint.trim().slice(0, 1600) : null
  let videoSeconds: number | null = null
  if (b.video_seconds !== undefined && b.video_seconds !== null && b.video_seconds !== '') {
    const n = Number(b.video_seconds)
    // YouTube's longest upload is 12 hours.
    if (!Number.isFinite(n) || n < 1 || n > 43_200) {
      return res.status(400).json({ ok: false, error: 'invalid video_seconds (the video\'s length in seconds, 1 to 43200)' })
    }
    videoSeconds = Math.round(n)
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' })
  }

  const { data: idea, error } = await supabase
    .from('content_ideas')
    .select('id,idea,thesis,body,meta,lane_slot,source_url,transformed_outputs,updated_at')
    .eq('id', id).single()
  if (error || !idea) return res.status(404).json({ ok: false, error: 'idea not found' })

  const source = String(idea.body || '').trim()
  if (source.length < 120) {
    // A title for nothing is a guess. Saying so beats writing a plausible
    // title out of a headline and storing it as if the piece had earned it.
    return res.status(409).json({
      ok: false,
      error: 'no_draft',
      hint: 'Write or generate the piece first. A title and description describe a piece that exists; they never invent one.',
    })
  }

  // The subchannel's mandate says what question its pieces answer, which is
  // the question a title leaves open. Read live, never a copy. An unrouted
  // piece still gets a title: it has a body, so it has a story.
  const [voice, sub] = await Promise.all([loadVoiceBlock(), loadSubchannel(idea.lane_slot)])
  const meta = (idea.meta || {}) as Record<string, unknown>
  const research = Array.isArray(meta.research) ? (meta.research as string[]) : []
  const sources = Array.isArray(meta.sources) ? (meta.sources as string[]) : []
  const citations = [...new Set([idea.source_url, ...research, ...sources].filter(Boolean))] as string[]
  const materials = readMaterials(idea.meta)
  const materialsBlock = materials.length ? `\n${materialsContext(materials)}` : ''
  const watch = watchLabel(videoSeconds)

  const system = [
    voice,
    sub ? `\n\nTHE SUBCHANNEL: ${sub.label}. Its mandate, which says the question its pieces answer:\n${sub.mandate}` : '',
    sub ? `\n\n${subchannelRulesBlock('write', sub.slug)}` : '',
    '\n\nYou write the YouTube title and description for the video made from one piece. Krish pastes them into YouTube Studio himself; the engine publishes nothing. ' +
    'The piece is the only source. You may compress and reorder it. You may NOT add a claim it does not make. ' +
    'EVERY NUMBER MUST APPEAR VERBATIM IN THE PIECE OR ITS SOURCES. Do no sums. No em dashes.',
    `\n\nHOUSE RULES\n${VOICE_GUARDRAILS}`,
    // The house rules ask a piece to end on a verdict, never a question or a
    // call to action. A title leaves a question open and a description points
    // to the piece, so for these two the rules below win.
    `\n\nTHE RULES FOR THE TITLE AND DESCRIPTION (for these two, they win where the house rules above ask for a verdict and no question or call to action)\n${packagingRulesBlock()}`,
  ].filter(Boolean).join('')

  const user = packagingRequest({ idea: idea.idea, thesis: idea.thesis, source, materialsBlock, thumbnailText, watch, hint })

  let firstText: string
  try {
    firstText = await callClaude({
      agent: 'cleo-package',
      model: UTILITY_MODEL,
      system,
      user,
      maxTokens: 2000,
      temperature: 0.7,
      timeoutMs: CALL_MS,
    })
  } catch (e) {
    // The typed answer revise and the fact gate give (api/_stream.ts), so a
    // session can tell a spent usage limit from a bad request.
    const failure = modelFailure('package_failed', 'The title and description', e)
    if (failure.retryAfterSeconds) res.setHeader('Retry-After', String(failure.retryAfterSeconds))
    return res.status(failure.status).json(failure.body)
  }
  const first = readAnswer(robustJson(firstText))
  if (!first) return res.status(502).json(emptyOutput('package_failed', 'The title and description'))

  // Every number checked against what the piece was cut from, Krish's own
  // pasted material and the video's length ("2 minute watch").
  const grounding = [
    materials.map(m => `${m.title || ''} ${m.content || ''} ${m.url || ''}`).join(' '),
    citations.join(' '),
    watch || '',
  ].join('\n')
  const ctx = { thumbnailText, source, grounding }

  let chosen: PackageAnswer = first
  let lint = lintAnswer(first, ctx)
  let retried = false
  let note: string | null = null
  if (failures(lint) > 0) {
    const left = started + BUDGET_MS - Date.now()
    if (left < MIN_RETRY_MS) {
      note = 'There was no time left in this request for a second try, so this is the first answer.'
    } else {
      try {
        const text = await callClaude({
          agent: 'cleo-package-retry',
          model: UTILITY_MODEL,
          system,
          history: [{ role: 'user', content: user }, { role: 'assistant', content: firstText }],
          user: packagingCorrection(first, lint),
          maxTokens: 2000,
          temperature: 0.7,
          timeoutMs: Math.min(CALL_MS, left),
        })
        retried = true
        const second = readAnswer(robustJson(text))
        const secondLint = second ? lintAnswer(second, ctx) : null
        if (!second || !secondLint) {
          note = 'The second try came back empty or unreadable, so this is the first answer.'
        } else if (failures(secondLint) >= failures(lint)) {
          note = 'The second try broke as many rules as the first, so this is the first answer.'
        } else {
          chosen = second
          lint = secondLint
        }
      } catch (e) {
        note = `The second try did not run. ${describeFailure(classifyAnthropicFailure(e))} This is the first answer.`
      }
    }
  }

  const youtubePackage = {
    title: chosen.title,
    alternates: chosen.alternates.map((a, i) => ({ ...a, lint: lint.alternates[i] ?? null })),
    description: chosen.description,
    why: chosen.why,
    thumbnail_text: thumbnailText,
    video_seconds: videoSeconds,
    hint,
    // What still breaks a rule, for the person reading. Nothing here blocks:
    // the engine publishes nothing, and the choice of title is Krish's.
    lint: { passed: lint.passed, problems: lint.problems },
    retried,
    note,
    generated_at: new Date().toISOString(),
    model: UTILITY_MODEL,
  }

  // Merge, never replace: the piece's channel cuts must survive.
  const existing = (idea.transformed_outputs || {}) as Record<string, unknown>
  const next = { ...existing, youtube_package: youtubePackage }

  const { data: written, error: upErr } = await supabase
    .from('content_ideas')
    .update({ transformed_outputs: next, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('updated_at', idea.updated_at)
    .select('id')
  if (upErr) return res.status(500).json({ ok: false, error: upErr.message })
  if (!written || !written.length) {
    // Someone else changed the row during the model call. Their change wins;
    // the package is returned so nothing is lost, but it is not written over them.
    return res.status(409).json({ ok: false, error: 'changed_during_package', package: youtubePackage })
  }

  return res.status(200).json({
    ok: true,
    package: youtubePackage,
    outputs: Object.keys(next),
  })
}

// Two short calls at most, each with its own deadline.
export const config = { maxDuration: 150 }
