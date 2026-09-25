// _content — shared helpers for the Content Engine API routes
// (revise / challenge / score / push-to-cleo). Mirrors the inline helpers in
// transform.ts but de-duplicated, since four routes need the same primitives.

import { priceUsd } from './_prices.js'
import * as meter from './_meter.js'


import { UTILITY_MODEL, SYNTHESIS_MODEL, MODEL_PRICES, thinkingParam } from './_models.js'
import { fetchWithRetry } from './_retry.js'

/** Strip the cardinal sin — em dashes (and their lookalikes) — anywhere,
 *  replacing them with the comma/period Krish would actually use. Safe to run
 *  on any draft before it is shown, saved, or sent to the factory. Leaves
 *  hyphenated words and numeric en-dash ranges (2020–2024) intact. */
export function sanitizeVoice(input: string): string {
  if (!input) return input
  let t = String(input)
  // Em dash / horizontal bar / double-hyphen-as-dash -> comma.
  t = t.replace(/\s*[—―]\s*/g, ', ')
  t = t.replace(/(\S)\s+--\s+(\S)/g, '$1, $2')
  // En dash: keep numeric ranges (2020–2024), otherwise treat as a dash.
  t = t.replace(/(\d)\s*–\s*(\d)/g, '$1-$2')
  t = t.replace(/\s*–\s*/g, ', ')
  // Tidy the artefacts a comma swap can create.
  t = t.replace(/(^|\n)\s*,\s*/g, '$1')   // no line starting with a comma
  t = t.replace(/,\s*,/g, ',')
  t = t.replace(/\s+,/g, ',')
  t = t.replace(/,\s*([.!?;:])/g, '$1')   // ", ." -> "."
  t = t.replace(/([.!?])\s*,\s+/g, '$1 ') // ". ," -> ". "
  return t
}

export interface Material {
  id: string
  kind: 'paste' | 'link' | 'file' | 'research'
  title?: string | null
  content?: string | null
  url?: string | null
  bytes?: number
  at?: string
  /** Who put it on the piece: 'Krish', or the agent client that added it
   *  (claude_code, codex...). Absent on rows written before 2026-09-25, which
   *  materialsOf() reads as Krish's unless the kind is 'research'. */
  by?: string | null
  /** The filer's statement that `content` is the source's own text, copied
   *  word for word from `url`, not a summary. The fact gate lets a claim pass
   *  on one source only when that source is verbatim (api/_factGate.ts). */
  verbatim?: boolean
}

/** Whose a material is, for the label the writer sees. Engine research
 *  (dive-deeper, deepen, investigations) is the engine's; anything an agent
 *  session added is that agent's; the rest is Krish's. */
export function materialOwner(m: Material): 'krish' | 'engine' | string {
  if (m.by && m.by !== 'Krish') return m.by
  if (m.kind === 'research' && !m.by) return 'engine'
  return 'krish'
}

/** Read the materials a piece carries (lives in content_ideas.meta.materials). */
export function readMaterials(meta: any): Material[] {
  const m = meta && Array.isArray(meta.materials) ? meta.materials : []
  return m.filter((x: any) => x && typeof x === 'object')
}

/** Compact the corpus into a grounding block for the model. Truncates each item
 *  and the whole block so a large corpus never blows the context budget.
 *
 *  Until 2026-09-25 every material was introduced as "BACKGROUND MATERIALS
 *  Krish provided (his own research)", including research the engine fetched
 *  itself and anything an agent session attached (walk finding F12). A writer
 *  told that a claim is Krish's own research treats it as his position. Now
 *  only what Krish put on the piece carries his name; the rest is labelled by
 *  who gathered it, and is a source to check claims against, never his view. */
export function materialsContext(materials: Material[], perItem = 2400, total = 9000): string {
  if (!materials.length) return ''
  const groups = new Map<string, string[]>()
  let used = 0
  let full = false
  for (const m of materials) {
    if (full) break
    const head = m.title ? `### ${m.title}` : `### ${m.kind} material`
    const bodyRaw = m.kind === 'link' ? (m.url || '') : (m.content || '')
    const body = bodyRaw.slice(0, perItem)
    let block = `${head}\n${body}`.trim()
    if (used + block.length > total) { block = `${head}\n[trimmed, ${bodyRaw.length} chars]`; full = true }
    else used += block.length
    const owner = materialOwner(m)
    groups.set(owner, [...(groups.get(owner) || []), block])
  }
  const out: string[] = []
  const krish = groups.get('krish')
  if (krish) out.push(`BACKGROUND MATERIALS Krish provided (his own research, treat as primary source, ground claims in it, never invent beyond it):\n\n${krish.join('\n\n')}`)
  for (const [owner, parts] of groups) {
    if (owner === 'krish') continue
    const who = owner === 'engine' ? 'the engine' : `an agent session (${owner})`
    out.push(`RESEARCH ON FILE, gathered by ${who}, not by Krish (sources to ground and check claims against; never present any of it as his view or his words):\n\n${parts.join('\n\n')}`)
  }
  return out.join('\n\n')
}

export function slug(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 50)
}

/** Tolerant JSON extraction from an LLM text response (handles ```json fences). */
export function robustJson(txt: string): any {
  let t = String(txt || '').trim()
  if (t.startsWith('```')) t = t.split('```')[1].replace(/^json/, '').trim()
  try { return JSON.parse(t) } catch { /* fallthrough */ }
  const i = t.indexOf('{'), j = t.lastIndexOf('}')
  if (i >= 0 && j > i) { try { return JSON.parse(t.slice(i, j + 1)) } catch { /* noop */ } }
  return null
}

export function parseVal(v: unknown): any {
  if (typeof v === 'string') { try { return JSON.parse(v) } catch { return v } }
  return v
}

/** Load one or more system_config values by exact key. Returns key -> parsed value.
 *
 *  The Supabase client is imported HERE rather than at the top of the file, and
 *  that placement is load-bearing. `_supabase.ts` throws at module scope when
 *  SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are absent, so a static import made
 *  this module — and every prompt-building module downstream of it — impossible
 *  to import without a live database. That is what stopped the prompt layer from
 *  being testable offline: you could not so much as assemble a system prompt and
 *  read it back without credentials. Config reads are the only thing in this file
 *  that need the database, so they are the only thing that should pay for it. */
export async function loadConfig(keys: string[]): Promise<Record<string, any>> {
  const { supabase } = await import('./_supabase.js')
  const { data } = await supabase.from('system_config').select('key,value').in('key', keys)
  const out: Record<string, any> = {}
  for (const r of data || []) out[(r as any).key] = parseVal((r as any).value)
  return out
}

/** The krish voice block (system_config.content_voice_block), for grounding rewrites. */
export async function loadVoiceBlock(): Promise<string> {
  const c = await loadConfig(['content_voice_block'])
  const v = c['content_voice_block']
  return typeof v === 'string' ? v : (v ? JSON.stringify(v) : '')
}

/** The channel corpus (system_config.content_corpus), for the Five Standards gate. */
export async function loadCorpus(): Promise<string> {
  const c = await loadConfig(['content_corpus'])
  const v = c['content_corpus']
  return typeof v === 'string' ? v : (v ? JSON.stringify(v) : '')
}

// ── Channel-aware corpus slicing ──────────────────────────────────────────
// The corpus is one long markdown doc (the Five Standards + five channel
// playbooks + cross-channel rules). Feeding the whole thing into every
// drafting/revision call would blow the context budget, so for the iterative
// surfaces (Cleo chat, Refine) we hand the model only the sections that bear on
// the channel it is actually writing for: the Five Standards (always), the one
// matching channel playbook, and the cross-channel rules. The score gate still
// loads the full corpus — it is grading against every standard.

/** venture (+format) -> the corpus playbook key that applies.
 *
 *  The venture/format/channel split (Krish 2026-08-06): venture answers "what am
 *  I working on", format answers "what shape is this", channel answers "where
 *  does it go". Before this, `lane` fused venture and channel, which is why
 *  signal_noise and builder_economy existed as both a venture and a lane. */
export function laneToCorpusChannel(lane?: string | null, slot?: string | null): string | null {
  // THE LIVE SUBCHANNELS FIRST (2026-09-24). The judge ladder sets lane_slot to
  // a subchannel and never sets lane, so every routed piece arrived here with a
  // null lane and got no playbook at all. A live slot names its own playbook
  // (CHANNEL_HEADING maps follow_the_money and under_the_hood to their lineage's
  // sections; mind_the_gap has none and corpusForChannel says so).
  if (slot && (slot === 'follow_the_money' || slot === 'under_the_hood' || slot === 'mind_the_gap')
      && (lane == null || lane === 'publication' || lane === 'mindmaker_live')) {
    return slot
  }
  // THE LIVE MODEL (canon, 2026-08-28). One publication, exactly two channels:
  // The Money of AI and Built with AI. There is no third. Legacy slot values
  // ('paid', 'built', 'teardown', 'investigation') map forward, never rejected.
  const MONEY = new Set(['money_of_ai', 'paid', 'teardown', 'investigation'])
  const BUILT = new Set(['built_with_ai', 'built'])
  if (lane === 'publication' || lane === 'mindmaker_live') {
    if (slot && MONEY.has(slot)) return 'money_of_ai'
    if (slot && BUILT.has(slot)) return 'built_with_ai'
    return 'publication'   // the house register
  }
  // ── Legacy stored values, mapped never rejected ───────────────────────────
  // 'mindmake' was the content lane before the venture split; 'mymu' and
  // 'makeyourmindup' were the content brand before it became the CTRL lead
  // magnet; 'techonomic' was the retired investigative brand; signal_noise and
  // builder_economy were ventures until 2026-08-11.
  if (lane === 'mymu' || lane === 'makeyourmindup') {
    if (slot && MONEY.has(slot)) return 'money_of_ai'
    if (slot && BUILT.has(slot)) return 'built_with_ai'
    return 'publication'
  }
  if (lane === 'mindmaker' || lane === 'mindmake') {
    if (slot === 'field_learning') return 'linkedin'
    if (slot && MONEY.has(slot)) return 'money_of_ai'
    return 'publication'
  }
  if (lane === 'techonomic') return 'money_of_ai'
  if (lane === 'builder_economy' || lane === 'builder_economy_ig') return 'built_with_ai'
  // Still a real corpus playbook, just a channel rather than a venture now.
  if (lane === 'signal_noise') return 'signal_noise'
  return null
}

/**
 * Formats that exist in venture_formats and have NO section in the corpus.
 *
 * Declared rather than quietly pointed at a neighbour's playbook, because a
 * format wearing another format's register is worse than a format with none:
 * the output reads finished and is written to the wrong brief.
 *
 * This declaration used to live only in control-center's copy of this file,
 * which no longer serves any content route after ADR-019. It was therefore
 * true in a file nobody called and absent from the one that runs.
 */
export const NO_CORPUS_PLAYBOOK: Record<string, string> = {
  mind_the_gap:
    'The corpus in system_config.content_corpus was last written on 2026-08-28, when the canon still said the publication ran exactly two channels. mind.the.gap was added to venture_formats on 2026-09-17 and has no section in it. Writing that section is editorial work against venture_formats.mandate, not a rename, which is why it is declared here rather than pointed at follow.the.money or under.the.hood.',
}

// channel key -> a matcher against the playbook heading text in the corpus.
const CHANNEL_HEADING: Record<string, RegExp> = {
  // COLLISION RULE. These patterns are tested against every `##` heading in the
  // corpus (the heading TEXT, with the # markers already stripped) and the
  // FIRST match wins, so a heading must match exactly one key. The live corpus
  // headings are deliberately disjoint:
  //   ## 0. Publication house register   ## 1. The Money of AI   ## 2. Built with AI
  //   ## 3. Signal & Noise   ## 4. Maven   ## 5. Substack   ## 6. LinkedIn
  //   ## 7. YouTube   ## 8. Instagram   ## 9. Podcast
  //
  // THE TRAP, which has now bitten three times. A format name is also an
  // ordinary English word, so an UNANCHORED pattern captures the wrong section:
  //   - "Built" appears inside "How a piece gets built (the pipeline)", which
  //     is a real heading in this corpus and sits ABOVE the playbooks.
  //   - "Paid" appears in prose about the publication's paid tiers.
  // Both format patterns are therefore anchored to the START of the heading
  // text, past an optional section numeral. Never relax that anchor, and never
  // give a format an alternation that can match mid-heading.
  //
  // The house register is matched on the exact phrase "Publication house
  // register" so a bare "Publication" elsewhere cannot claim it.
  //
  // CANON 2026-08-28: the publication runs exactly two channels, The Money of
  // AI and Built with AI. 'paid' and 'built' remain as LEGACY aliases that
  // resolve to those same two playbooks, so a stored legacy row still gets its
  // real playbook instead of the whole-corpus fallback. Single anchored
  // patterns only, never an alternation.
  money_of_ai: /^#*\s*\d*\.?\s*(The\s+)?Money\s+of\s+AI\b/i,
  built_with_ai: /^#*\s*\d*\.?\s*Built\s+with\s+AI\b/i,
  paid: /^#*\s*\d*\.?\s*(The\s+)?Money\s+of\s+AI\b/i,
  built: /^#*\s*\d*\.?\s*Built\b/i,

  // ── The three live subchannels (venture_formats, renamed 2026-09-17) ──
  // Two are the same editorial lineage under a new name, which is exactly what
  // format_aliases records: money_of_ai -> follow_the_money, and
  // built_with_ai -> under_the_hood. They inherit those playbooks rather than
  // falling through to the whole-corpus synopsis, the same way the 'paid' and
  // 'built' legacy keys above already do.
  //
  // The corpus SECTIONS still carry the old titles, so these point at the old
  // headings on purpose. Rewriting those sections against the new mandates is
  // editorial work rather than a rename, and until that happens a piece gets
  // the playbook its lineage had.
  //
  // mind_the_gap is deliberately absent. It is new, not a rename, and the
  // corpus has no section for it: see NO_CORPUS_PLAYBOOK below.
  follow_the_money: /^#*\s*\d*\.?\s*(The\s+)?Money\s+of\s+AI\b/i,
  under_the_hood: /^#*\s*\d*\.?\s*Built\s+with\s+AI\b/i,

  publication: /Publication house register/i,
  signal_noise: /Signal\s*&?\s*Noise/i,
  maven: /Maven/i,

  // ── Distribution registers (added 2026-08-13) ──────────────────────────
  // Each of these now has its OWN section in the corpus. Before this, LinkedIn
  // pointed at the Built regex and the other four had no entry at all, so
  // "adapt for Substack" silently fell through to the one-paragraph synopsis
  // and produced a generic rewrite. A channel with no register is a channel
  // the engine cannot actually write for.
  //
  // Same anchoring discipline as the formats: past an optional numeral, tied
  // to the start of the heading text. "Podcast" in particular must not match
  // "Visibility (Nova, speaking, podcasts, CFPs...)", which it cannot, both
  // because that heading is an h3 (sliceSections only takes # and ##) and
  // because the anchor holds.
  substack: /^#*\s*\d*\.?\s*Substack\b/i,
  linkedin: /^#*\s*\d*\.?\s*LinkedIn\b/i,
  youtube: /^#*\s*\d*\.?\s*YouTube\b/i,
  instagram: /^#*\s*\d*\.?\s*Instagram\b/i,
  podcast: /^#*\s*\d*\.?\s*Podcast\b/i,

  // ── Legacy keys ────────────────────────────────────────────────────────
  // Kept ONLY so a corpus copy that has not been resynced, or an old stored
  // row, still resolves to something sane. Never offer these as a choice.
  investigation: /^#*\s*\d*\.?\s*Paid\b|Techonomic|Investigation|Teardown/i,
  makeyourmindup: /Publication house register|MYMU house register/i,
  mymu_weekly: /Publication house register|Make\s*Your\s*Mind\s*Up\s*\(the weekly\)/i,
  builder_economy: /^#*\s*\d*\.?\s*Built\b|Builder Economy/i,
}

/** Split markdown into level-1/2 sections (### stays inside its ## parent). */
function sliceSections(md: string): Array<{ title: string; body: string }> {
  const lines = md.split('\n')
  const out: Array<{ title: string; body: string }> = []
  let cur: { title: string; body: string } | null = null
  for (const line of lines) {
    const m = /^(#{1,2})\s+(.*)$/.exec(line)
    if (m) {
      if (cur) out.push(cur)
      cur = { title: m[2].trim(), body: `${line}\n` }
    } else if (cur) {
      cur.body += `${line}\n`
    }
  }
  if (cur) out.push(cur)
  return out
}

/**
 * Extract the corpus the model needs to write for ONE channel: the Five
 * Standards gate, the matching channel playbook, and the cross-channel rules.
 * Falls back to a trimmed slice of the whole corpus if it can't be parsed or the
 * channel is unknown (e.g. a free 'dynamic' piece). Capped so it never dominates
 * the prompt.
 */
export function corpusForChannel(corpus: string, channel?: string | null, cap = 6000): string {
  if (!corpus) return ''
  const sections = sliceSections(corpus)
  if (!sections.length) return corpus.slice(0, cap)
  const find = (re: RegExp) => sections.find(s => re.test(s.title))

  const picked: string[] = []
  const five = find(/Five Standards/i)
  if (five) picked.push(five.body.trim())

  const re = channel ? CHANNEL_HEADING[channel] : null
  const play = re ? find(re) : null
  if (play) picked.push(play.body.trim())
  else {
    // Unknown channel: hand over the tight one-paragraph synopsis instead of a
    // single playbook so the model still has the whole map.
    const onePara = find(/One-Paragraph Version/i)
    if (onePara) picked.push(onePara.body.trim())
    // A DECLARED gap is not the same as an unrecognised value, and the model
    // must not be left to infer a register from the house synopsis and write
    // as though it had a playbook. Say it in the prompt.
    const gap = channel ? NO_CORPUS_PLAYBOOK[channel] : null
    if (gap) {
      picked.unshift(
        `NO PLAYBOOK EXISTS FOR THIS FORMAT. ${gap} Work from the house register and the mandate you were given, and do not imitate another format's register.`,
      )
    }
  }

  const cross = find(/Cross-Channel Rules/i)
  if (cross) picked.push(cross.body.trim())

  const joined = picked.join('\n\n').trim()
  return (joined ? joined : corpus).slice(0, cap)
}

/** Models that reject temperature/top_p/top_k with a 400.
 *
 *  One list, because there were two behaviours. `_harness.ts` knew about this
 *  and guarded (its ladder runs on opus); the helpers here did not, and sent
 *  `temperature` unconditionally — so pointing callClaude() at an opus model
 *  400'd, and the streaming helper avoided that only by sending no temperature
 *  at all, which cost it sampling control on every model. Both now consult this.
 *  Update it here when the model list moves. */
export const NO_SAMPLING_MODELS = /^claude-(opus-4-7|opus-4-8|opus-5|sonnet-5|fable-5|mythos-5)/

/** Whether `model` accepts sampling parameters at all. */
export function supportsSampling(model: string): boolean {
  return !NO_SAMPLING_MODELS.test(model)
}

export interface ClaudeImage {
  /** e.g. 'image/png'. Must be one Anthropic accepts: png, jpeg, gif, webp. */
  mime: string
  /** Base64, WITHOUT the `data:...;base64,` prefix. */
  data: string
}

export interface ClaudeOpts {
  /** Abort after this many ms. Omit for no deadline (batch/cron callers). */
  timeoutMs?: number
  system: string
  /** The part of the prompt that does not change between calls, rendered
   *  BEFORE `system` so a prefix cache can hold it across them. A fan-out that
   *  shares a brief and varies one rubric belongs here. */
  systemStable?: string
  /** '1h' for a sweep, where the same brief is re-read for the length of the
   *  run and the default five minutes would expire mid-way. */
  cacheTtl?: '5m' | '1h'
  /** Rendered last, in the system role, AFTER the final cache breakpoint. For
   *  the part of the instruction that varies per call and must still carry
   *  system weight. */
  systemTail?: string
  /**
   * Cache the system prompt, for call sites that send the same one repeatedly.
   *
   * OFF BY DEFAULT, AND THAT IS NOT TIMIDITY. A cache write is priced ABOVE an
   * ordinary input token (1.25x for the five minute entry) and a read at a
   * tenth of one. So caching pays only when the prefix is genuinely re-sent
   * inside the TTL, and on a once-a-day cron it is a straight 25% surcharge on
   * the largest part of the request for a entry nobody ever reads. Turning it
   * on everywhere would have raised this bill, not lowered it.
   *
   * Turn it on where the same system prompt goes out more than once in quick
   * succession: a route that loops over items, and the composer, where the
   * whole point of the surface is iterating one draft to completion in a
   * sitting. `system` carries the rubric, the voice block and the corpus and
   * `user` carries the draft, so the stable part is already first, which is
   * what makes a prefix cache possible at all.
   *
   * Whether it is working is not a matter of opinion: meter_daily now carries
   * cache_read_tokens and cache_write_tokens separately, deliberately un-netted,
   * so a site that writes entries nobody reads shows up as exactly that.
   */
  cache?: boolean
  user: string
  /** Images to send alongside `user`, for the vision path.
   *
   *  Anthropic only accepts images inside a content-block array, so supplying
   *  this switches the message from the plain-string form to blocks. Images go
   *  BEFORE the text: Anthropic's own guidance is that a question placed after
   *  the image it refers to is answered more accurately. */
  images?: ClaudeImage[]
  model?: string
  maxTokens?: number
  temperature?: number
  /** Ask for adaptive thinking on models that support it.
   *
   *  Off by default and explicitly so. On Sonnet 5 and the Opus 5 family,
   *  OMITTING the thinking field means adaptive thinking runs, and it spends
   *  max_tokens before writing a word — a JSON call site budgeted for its
   *  answer alone comes back empty from a 200 response. So every request here
   *  states its intent, and a caller that turns this on must raise maxTokens to
   *  cover the reasoning as well as the answer. */
  think?: boolean
  /** Optional token accounting. Called once on a successful response.
   *
   *  `usage` was previously read off the wire and thrown away, which is fine for
   *  a route that only wants the text and fatal for anything that needs to know
   *  what a run cost — an eval comparing two prompts has to be able to say that
   *  the better one is also three times the price. Opt-in, so the twelve routes
   *  that just want text are unaffected. */
  onUsage?: (u: TokenUsage) => void
  /** Which agent this call is on behalf of, for the usage meter.
   *
   *  Anthropic's own per-agent spend is unreadable from an API key (the usage
   *  and cost reports need an Admin key, which an individual account cannot
   *  have), so the OS meters itself and this is the stamp that makes the
   *  numbers mean something. A call that omits it meters as 'unattributed' —
   *  a visible gap in the console, never folded into another agent's total. */
  agent?: string
  /**
   * NOT SENT TO THE MODEL. Which independent sample of an identical request
   * this is, for a transport that caches replies by request content.
   *
   * The batch transport keys a cached reply on a hash of the request body, so
   * two byte-identical requests resolve to one reply. That is right for a
   * fan-out and WRONG for the bury confirmation, which deliberately asks the
   * same question twice to find out whether the answer is stable — measured
   * 2026-09-24, only 2 of 10 seeds expanded to the same angle twice, and all
   * the score variance lived in the eight that did not. A cache hit there
   * would hand back the first expansion, the second panel would agree with
   * itself, and the row would claim a confirmation that never happened.
   *
   * So a call that must be an independent draw says so, and the transport keys
   * it separately. It changes nothing about what is sent.
   */
  sample?: number
}

/** A way of reaching the model. `callClaude` is the live one; the batch
 *  transport in _judges/batch.ts is the other, and the ladder takes either. */
export type ClaudeCall = (opts: ClaudeOpts) => Promise<string>

/**
 * The request body, exactly as it goes on the wire.
 *
 * Extracted so the Batches API sends the SAME body a live call would. A batch
 * `params` object is a Messages request minus `stream`, so a second hand-rolled
 * copy of this shape would be a fork of the one thing that must not drift:
 * judge a piece through a batch and through a live call and the two have to be
 * the same request, or the 50% saving was bought with a behaviour change
 * nothing in the output would show.
 */
export function claudeRequestBody(opts: ClaudeOpts): Record<string, unknown> {
  const model = opts.model || UTILITY_MODEL
  return {
    model,
    max_tokens: opts.maxTokens ?? 4000,
    ...thinkingParam(model, opts.think === true),
    ...(supportsSampling(model) ? { temperature: opts.temperature ?? 0.5 } : {}),
    system: cacheableSystem(opts),
    messages: [{ role: 'user', content: userContent(opts) }],
  }
}

export interface TokenUsage { input: number; output: number; model: string }

/** Cost of a usage record in USD. Unknown models price at 0 rather than guess;
 *  the rates live in api/_prices.ts, the only copy of them. */
export function usageCost(u: TokenUsage): number {
  return priceUsd(u.model, u.input, u.output)
}

type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

/** The `content` for the single user turn: a bare string when there are no
 *  images (unchanged for every existing caller), a block array when there are. */
function userContent(opts: ClaudeOpts): string | ContentBlock[] {
  if (!opts.images?.length) return opts.user
  return [
    ...opts.images.map((img): ContentBlock => ({
      type: 'image',
      source: { type: 'base64', media_type: img.mime, data: img.data },
    })),
    { type: 'text', text: opts.user },
  ]
}

/**
 * The Anthropic key, from the deploy env or the app_secrets fallback.
 *
 * Ported from control-center on 2026-09-19, which added it on 2026-09-16 after
 * a bad Vercel variable took down its Network tab with
 * "planner:anthropic_401:API key is invalid." and no recovery short of a
 * redeploy. The control plane moved out of that repo eight days before the fix
 * and never got it, so on 2026-09-17 and 2026-09-18 the identical 401 took out
 * the weekly investigation and blocked ten arcs in the weekly surfacing, and
 * there was no way back without a deploy either.
 *
 * The env still wins, so nothing changes for a healthy deploy. The anon client
 * cannot read app_secrets (RLS), so the row is only reachable server-side.
 * Cached per process, including the negative, so a missing key costs one query.
 *
 * NOTE this is a recovery mechanism, not a fix. Writing a working key into
 * either place is the fix.
 */
let cachedAnthropicKey: string | null | undefined
export async function getAnthropicKey(): Promise<string | null> {
  if (process.env.ANTHROPIC_API_KEY) return process.env.ANTHROPIC_API_KEY
  if (cachedAnthropicKey !== undefined) return cachedAnthropicKey
  try {
    const { supabase } = await import('./_supabase.js')
    const { data } = await supabase.from('app_secrets').select('value').eq('key', 'anthropic_api_key').maybeSingle()
    cachedAnthropicKey = data && typeof (data as { value?: unknown }).value === 'string'
      ? (data as { value: string }).value
      : null
  } catch {
    cachedAnthropicKey = null
  }
  return cachedAnthropicKey
}

/** Single-shot Anthropic Messages call. Returns the first text block (or throws). */
/**
 * The `system` field, with a cache breakpoint on it when the caller asked.
 *
 * Caching is a PREFIX match and the render order is tools, then system, then
 * messages, so a breakpoint at the end of `system` caches everything stable and
 * leaves the draft in `user` to vary freely. That is already how these prompts
 * are built, which is the only reason this is a one-line change.
 *
 * The floor is a real constraint, not defensive padding: a prefix shorter than
 * the model's minimum (512 to 4096 tokens depending on the model) is silently
 * not cached at all. Nothing errors and no entry appears, so a short prompt
 * asking for a breakpoint just quietly gets nothing. 6000 characters is roughly
 * 1500 tokens, comfortably clear of the common 1024 floor, and below it the
 * request is small enough that caching it was never the saving anyway.
 */
export function buildSystemBlocks(opts: Partial<ClaudeOpts>): unknown {
  return cacheableSystem(opts as ClaudeOpts)
}

function cacheableSystem(opts: ClaudeOpts): unknown {
  // TWO BREAKPOINTS, when the caller has something stable to put in front.
  //
  // A fan-out of nine blinded judges sends the same voice block, canon and
  // corpus nine times per idea, and the same voice block, canon and corpus on
  // every idea in a sweep. One breakpoint would re-write the whole prefix per
  // idea because the artifact inside it changes. Two splits the difference the
  // way the traffic actually repeats:
  //
  //   block 1  the stable brief    written once, read by every judge of every
  //                                idea for the life of the entry
  //   block 2  this idea's artifact written once per idea, read by the other
  //                                eight judges
  //
  // Caching is cumulative on the prefix, so block 2's entry is stable+artifact
  // and clears the model's minimum even when the artifact alone would not.
  const stable = opts.systemStable
  if (opts.cache && stable && stable.length >= 6000) {
    const ttl = opts.cacheTtl === '1h' ? { type: 'ephemeral', ttl: '1h' } : { type: 'ephemeral' }
    // `systemTail` stays in the SYSTEM role and after the last breakpoint. A
    // judge's rubric is its instruction and moving it to `user` to make room
    // for the cache would have traded a cost saving for a behaviour change,
    // which is the one thing this was not allowed to do.
    return [
      { type: 'text', text: stable, cache_control: ttl },
      ...(opts.system ? [{ type: 'text', text: opts.system, cache_control: ttl }] : []),
      ...(opts.systemTail ? [{ type: 'text', text: opts.systemTail }] : []),
    ]
  }
  // The floor is a real constraint: a prefix under the model's minimum is
  // silently not cached and nothing says so.
  const joined = [stable, opts.system, opts.systemTail].filter(Boolean).join('\n\n')
  if (!opts.cache || joined.length < 6000) return joined
  return [{ type: 'text', text: joined, cache_control: { type: 'ephemeral' } }]
}

export async function callClaude(opts: ClaudeOpts): Promise<string> {
  const apiKey = await getAnthropicKey()
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  // A deadline, because there was none. An upstream that stalls otherwise burns
  // the entire 60s function budget and the caller gets no response at all, which
  // on a phone is indistinguishable from the app being broken. Callers on a
  // user-facing path should pass something well under maxDuration.
  const model = opts.model || UTILITY_MODEL
  const ctrl = new AbortController()
  const tid = opts.timeoutMs ? setTimeout(() => ctrl.abort(), opts.timeoutMs) : null
  try {
    const r = await fetchWithRetry('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(claudeRequestBody(opts)),
      signal: opts.timeoutMs ? ctrl.signal : undefined,
    }, {
      // A 529 is Anthropic overloaded and a 429 is the account rate-limited.
      // Both are weather. On arcs/surface that weather used to cost one arc per
      // occurrence, and on shifts/detect or investigations it costs the week.
      onRetry: ({ attempt, status, waitMs }) =>
        console.warn(`[anthropic] ${opts.agent} retry ${attempt} after ${status ?? 'transport'}, waiting ${waitMs}ms`),
    })
    const j: any = await r.json().catch(() => ({}))
    if (!r.ok) {
      // The status and body ride along on the Error so a caller can tell a
      // spent credit balance (429 insufficient_quota / 400 credit balance too
      // low) from a malformed request. Without them the only signal is a
      // string, and "half enriched because Anthropic is out of credits" is
      // exactly the failure this has to stay distinguishable from.
      const e = new Error(`anthropic_${r.status}:${(j?.error?.message || '').slice(0, 120)}`) as Error & {
        status?: number; body?: string
      }
      e.status = r.status
      e.body = JSON.stringify(j?.error || j || {}).slice(0, 400)
      throw e
    }
    const inputTokens = Number(j?.usage?.input_tokens) || 0
    const outputTokens = Number(j?.usage?.output_tokens) || 0
    if (opts.onUsage) opts.onUsage({ input: inputTokens, output: outputTokens, model })
    // Unconditional, unlike onUsage: a route that does not care what it cost is
    // exactly the route whose spend nobody was watching.
    //
    // The RAW usage object, not the two counts plucked above. Those two drop
    // the cache read and cache creation fields on the floor, so a cached call
    // and an uncached one of the same size were indistinguishable in
    // meter_daily, and prompt caching would have been unmeasurable the day it
    // was switched on. Parsed in exactly one place, _prices.readUsage.
    await meter.anthropicCall({ agent: opts.agent, model, usage: j?.usage })
    return firstText(j)
  } catch (e: unknown) {
    if ((e as Error)?.name === 'AbortError') throw new Error(`anthropic_timeout_${opts.timeoutMs}ms`)
    throw e
  } finally {
    if (tid) clearTimeout(tid)
  }
}

/**
 * The first TEXT block of a response.
 *
 * `content[0].text` was right until a model could put a thinking block first,
 * at which point it silently returns undefined and every caller sees an empty
 * answer from a 200 response. Indexing by position was always an assumption
 * about the content array; this reads what it is actually looking for.
 */
function firstText(j: any): string {
  const blocks = Array.isArray(j?.content) ? j.content : []
  for (const b of blocks) if (b?.type === 'text' && typeof b.text === 'string') return b.text
  return ''
}

export interface ChatTurn { role: 'user' | 'assistant'; content: string }

/** Multi-turn Anthropic Messages call for the Cleo writing-assistant chat. */
export async function callClaudeMessages(
  system: string,
  messages: ChatTurn[],
  opts: { model?: string; maxTokens?: number; temperature?: number; think?: boolean; agent?: string } = {},
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  const model = opts.model || UTILITY_MODEL
  const clean = messages
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-16)
  if (!clean.length || clean[0].role !== 'user') clean.unshift({ role: 'user', content: 'Help me with this draft.' })
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 2000,
      ...thinkingParam(model, opts.think === true),
      ...(supportsSampling(model) ? { temperature: opts.temperature ?? 0.6 } : {}),
      system,
      messages: clean,
    }),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`anthropic_${r.status}:${(j?.error?.message || '').slice(0, 120)}`)
  await meter.anthropicCall({
    agent: opts.agent,
    model,
    usage: j?.usage,
    inputTokens: Number(j?.usage?.input_tokens) || 0,
    outputTokens: Number(j?.usage?.output_tokens) || 0,
  })
  return firstText(j)
}

/** Standard CORS + method preamble. Returns true if the request was handled (OPTIONS/bad method). */
export function preamble(req: any, res: any, methods = 'POST, OPTIONS'): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Cache-Control', 'no-store')
  if (req.method === 'OPTIONS') { res.status(200).end(); return true }
  // The methods string is the contract: a route declaring 'GET, PATCH, OPTIONS'
  // accepts exactly those. (Previously only POST ever passed, whatever was
  // declared, which 405'd the v2 GET/PATCH routes.)
  const allowed = methods.split(',').map(m => m.trim().toUpperCase())
  if (!allowed.includes(String(req.method).toUpperCase())) {
    res.status(405).json({ ok: false, error: 'Method not allowed' })
    return true
  }
  return false
}

/** Resolve the [id] path param. */
export function pathId(req: any): string | null {
  const id = req.query?.id
  const v = Array.isArray(id) ? id[0] : id
  return v || null
}

/** The KILL-LIST mechanics, restated for the model so rewrites never reintroduce tells. */
export const VOICE_GUARDRAILS = [
  'HARD RULES (never violate): No em dashes anywhere — use commas, periods, or parentheses.',
  'No self-credentialing, no company-name-dropping for credibility.',
  'No AI tells: no "hook line, gap, explanation" opening, no "here\'s the thing", no "the truth is", no "let\'s dive in", no "delve", no "unpack", no "deep dive".',
  'No synthetic enthusiasm ("excited", "thrilled"). No "leverage" (except "leverage audit"). No "utilise", "seamless", "empower", "journey", "landscape", "robust", "synergy".',
  'Active voice only. Dropped subject pronouns where natural ("Been thinking", not "I\'ve been thinking").',
  // Krish, 2026-09-24, asked what the rule is for this move: "Cut it everywhere."
  'Never use the "Not X, Y" construction, at any scale and in either order: no "Not X, Y", no "it\'s not X, it\'s Y", no "X isn\'t the story, Y is", no "Y, not X", no "never X, it was Y". State the sharper take directly. Plain factual negation ("Amazon did not say why") is fine. This overrides any voice note that calls it a habit.',
  'End on a hard, forward-looking verdict — never a summary, rhetorical question, or CTA.',
  'Specific over general. Never invent numbers, outcomes, or quotes; flag gaps instead.',
].join('\n')

/** One Anthropic call whose user turn carries native image and document
 *  blocks. callClaudeMessages takes strings, which is all the Composer needs;
 *  the inspiration lane reads screenshots, so it needs the block form. Metered
 *  the same way, because vision requests are the most expensive thing the
 *  engine does unattended. */
export async function callClaudeBlocks(
  system: string,
  content: Array<Record<string, unknown>>,
  opts: { model?: string; maxTokens?: number; temperature?: number; agent?: string } = {},
): Promise<{ text: string; inputTokens: number; outputTokens: number; model: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')
  const model = opts.model || SYNTHESIS_MODEL
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 8000,
      ...(supportsSampling(model) ? { temperature: opts.temperature ?? 0.2 } : {}),
      system,
      messages: [{ role: 'user', content }],
    }),
  })
  const j: any = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`anthropic_${r.status}:${(j?.error?.message || '').slice(0, 160)}`)
  const inputTokens = Number(j?.usage?.input_tokens) || 0
  const outputTokens = Number(j?.usage?.output_tokens) || 0
  await meter.anthropicCall({ agent: opts.agent, model, usage: j?.usage, inputTokens, outputTokens })
  return { text: firstText(j), inputTokens, outputTokens, model }
}
