import type { VercelRequest, VercelResponse } from '@vercel/node'
import { supabase } from '../../_supabase.js'
import { guardEngine } from '../../_auth.js'
import { loadVoiceBlock, sanitizeVoice, VOICE_GUARDRAILS } from '../../_content.js'
import { emptyOutput, failWith, modelFailure, openStream, send, streamClaude } from '../../_stream.js'
import { loadStandingNotes, standingNotesPrompt } from '../../_briefNotes.js'
import { locateSpan } from '../../_selection.js'
import { buildHumourSystem, isHumourRegister } from '../../_humor.js'
import { SYNTHESIS_MODEL } from '../../_models.js'

// POST /api/briefs/:week/revise   body: { mode?, value?, hint?, instruction?, selection? }
//
// The brief's magic-edit engine (mockup set 2, pin 12): preset one-tap
// rewrites (tighten / sharper_open / harder_ending / more_data), the shared
// edit palette from src/lib/contentEngine.ts riding in on `hint`, a free
// instruction ("Tell Cleo", dictated on mobile), and span-scoped rewrites
// (selection replaced inside the full draft). Preview-only: returns the
// rewritten markdown, the client PATCHes it via /api/briefs/:week on Keep.
//
// Humour is not a steer you can bury in the general rewriter — "be sarcastic"
// produces the impression of a joke. Those passes swap in the examples-driven
// system prompt from api/_humor.ts and a stronger model, exactly as the
// composer's /revise has always done. This route simply never imported it, so
// six of the registers were unreachable from the brief.
//
// Every preset knows the brief is an ARGUMENT (see api/briefs/assemble.ts): a
// piece that contradicts a belief or confirms a twelve-month thesis, read
// through a commercial and strategic lens. A preset that treats it as a roundup
// sands the argument off, which is exactly how the weekly drifted before.
//
// Success is a stream that ends with a `done` event whose `ok` is true, as
// the piece's revise does. A failure is typed (ModelErrorBody in
// api/_stream.ts): known before the stream opens (a usage limit, a bad key,
// an overload the provider answered at once), it is a JSON body with 503,
// 429 or 502; after it opens, it is the stream's last event, `error`, and no
// `done` follows. docs/CONTENT_ENGINE.md has the shapes.

const ARGUMENT = 'This brief is an investigative opinion piece, not a roundup: the clues prosecute one belief, either contradicting it or confirming a twelve-month thesis, always through a commercial and strategic lens (pricing, margin, who pays, build versus buy, competitive position). Every edit must leave that argument intact or sharper, never flatter.'

const PRESETS: Record<string, string> = {
  tighten: 'Tighten the whole piece. Cut filler and any sentence that restates the one above it. Keep every fact and citation, do not change the structure or headings, and do not soften the verdict while shortening it.',
  sharper_open: 'Sharpen the claim. Make the title and standfirst state what is being argued and which way it came down, so a reader who sees only those knows the verdict. Then make the opening of each section land on its own point in the first sentence. Keep all facts, headings and citations.',
  harder_ending: 'Make the close land on a hard, forward-looking verdict with a commercial consequence and the specific thing to watch. Never end on a summary, a question, or "time will tell".',
  more_data: 'Where a claim is soft, sharpen it with the specific numbers, companies and dates already present in the piece, and tie each to the mechanism it moves (price, margin, who pays, buying behaviour). Never invent data. Where the evidence cannot carry the claim, say so plainly instead of padding it.',
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardEngine(req, res)) return
  const week = (req.query.week || '') as string
  if (!/^\d{4}-W\d{2}$/.test(week)) return res.status(400).json({ ok: false, error: 'week required (YYYY-Www)' })

  const b = (req.body || {}) as {
    mode?: string; value?: string; hint?: string; instruction?: string; selection?: string
  }
  const preset = b.mode ? PRESETS[b.mode] : null
  const hint = (b.hint || '').trim()
  const instruction = (b.instruction || '').trim()
  const steer = preset || hint || instruction
  if (!steer) return res.status(400).json({ ok: false, error: 'mode, hint or instruction required' })
  const humour = isHumourRegister(b.value)

  const { data: brief, error } = await supabase.from('weekly_briefs').select('week, body_md').eq('week', week).single()
  if (error || !brief?.body_md) return res.status(404).json({ ok: false, error: 'brief not found or empty' })

  // The client hands over what the USER highlighted, which is rendered text:
  // no markdown, citation markers that may or may not be in the stored copy,
  // single newlines between blocks, and whatever sanitizeVoice has since done
  // to the dashes. `body_md.includes(selection)` could never match that, and
  // returning 409 made the one feature that worked look broken. Match on the
  // words instead and resolve to the real markdown at those offsets, so the
  // span handed to the model is a substring of the draft it is being given.
  const rawSelection = (b.selection || '').trim()
  const hit = rawSelection ? locateSpan(brief.body_md, rawSelection) : null
  if (rawSelection && !hit) {
    return res.status(409).json({
      ok: false,
      error: 'that passage is not in the saved draft',
      detail: 'Save the brief and highlight it again. If it still fails, the passage may have been rewritten by another edit.',
    })
  }
  const selection = hit?.text || ''

  const [voice, standingNotes] = await Promise.all([loadVoiceBlock(), loadStandingNotes()])
  const system = [
    humour
      ? buildHumourSystem({ register: b.value as string, voice, channelCorpus: '', materialsBlock: '' })
      : 'You edit the the publication weekly brief. You write as Krish, for business leaders.',
    humour ? '' : (voice ? `VOICE:\n${voice}` : ''),
    humour ? '' : VOICE_GUARDRAILS,
    standingNotesPrompt(standingNotes),
    ARGUMENT,
    'Preserve the markdown structure (headings, lists, links) unless the instruction says otherwise. Only the clues are a bulleted list; keep bold text out of the prose sections, because the citation markers attach to bold bullets by position.',
    'HONESTY: never invent facts, numbers, companies or quotes. Keep every URL exactly as it is.',
    selection
      ? 'Rewrite ONLY the selected span; return the FULL draft with the span replaced and everything else byte-identical.'
      : 'Return the FULL rewritten draft.',
    'Reply with the markdown only. No preamble, no code fences.',
  ].filter(Boolean).join('\n\n')

  const user = [
    `EDIT INSTRUCTION: ${steer}`,
    selection ? `SELECTED SPAN:\n${selection}` : '',
    `DRAFT:\n${brief.body_md}`,
  ].filter(Boolean).join('\n\n')

  // Streamed: a whole-brief revision is the longest of these, and the editor
  // shows the result as a preview the user reads before accepting. Watching it
  // arrive is strictly better than watching a rail for a minute.
  //
  // The raw text streams as the preview; the `done` payload carries the version
  // that has been through sanitizeVoice and the fence strip, and that is the
  // one the editor accepts. The length guard also only means anything against
  // the finished text.
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(503).json({ ok: false, error: 'ANTHROPIC_API_KEY not configured' })

  // The stream opens only once the provider has accepted the call, so a
  // refusal reaches the caller as a status it cannot mistake for success. It
  // used to open first, and a usage limit came back as HTTP 200 carrying one
  // untyped event, the fault 1d6a1b0 fixed on the piece's revise (walk log
  // F31, F40).
  let opened = false
  let out: string
  try {
    out = await streamClaude({
      agent: 'briefs-revise',
      apiKey,
      model: humour ? 'claude-opus-4-8' : SYNTHESIS_MODEL,
      // Matches briefs/assemble.ts, which writes the brief this route edits.
      // Ignored on the humour path: opus rejects sampling params.
      temperature: 0.4,
      maxTokens: 4000,
      system,
      messages: [{ role: 'user', content: user }],
      onOpen: () => { openStream(res); opened = true },
      onText: chunk => send(res, 'delta', { text: chunk }),
    })
  } catch (e: unknown) {
    const failure = modelFailure('revise_failed', 'The rewrite of the brief', e)
    if (!opened) {
      if (failure.retryAfterSeconds) res.setHeader('Retry-After', String(failure.retryAfterSeconds))
      return res.status(failure.status).json(failure.body)
    }
    return failWith(res, failure.body)
  }
  const preview = sanitizeVoice(out.trim().replace(/^```(?:markdown|md)?\n?|\n?```$/g, ''))
  // A brief is a whole piece: under 100 characters it was cut short or never
  // written, and there is nothing to preview.
  if (!preview || preview.length < 100) {
    return failWith(res, { ...emptyOutput('revise_failed', 'The rewrite of the brief'), detail: 'The rewrite of the brief came back empty or under 100 characters, so nothing was produced. Run it again.' })
  }
  send(res, 'done', { ok: true, preview })
  return res.end()
}

export const config = { maxDuration: 120 }
