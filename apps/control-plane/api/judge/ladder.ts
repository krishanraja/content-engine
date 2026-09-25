import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { guardCronRoute } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { callClaude, loadCorpus, loadVoiceBlock, corpusForChannel, sanitizeVoice, type ClaudeCall } from '../_content.js'
import { houseRulesBlock } from '../_houseRules.js'
import { webResearch } from '../_enrich.js'
import { isDeferred } from '../_judges/deferred.js'
import { UTILITY_MODEL, JUDGE_MODEL } from '../_models.js'
import { withContentRun } from '../_runs.js'
import { deterministicFindings } from '../_judges/deterministic.js'
import {
  artifactHash, buildRouterPrompt, parseRouterVerdict, runPanel, standing,
  READY_AT, ESCALATE_FLOOR, type PanelResult, type Standing,
} from '../_judges/panel.js'
import { ROSTER_VERSION, type RouterVerdict } from '../_judges/roster.js'
import { expand, expansionArtifact, type Expansion } from '../_judges/expand.js'

// The ladder. Judge, try to fix, and only then bother Krish.
//
// Krish, 2026-09-24: "the judges should literally judge, in the machine, before
// it's presented to me for triage with the judges scores. I should always be
// able to review and override on things that score between a 7>9 out of 10 if
// the machine could not find a way to improve the story to get it to a 10/10
// itself first by going deeper, finding contrarian evidence, asking why."
//
//   score = the MEDIAN judge; weakest = what a repair aims at
//   (see standing() in _judges/panel.ts for why the minimum was retired)
//
//   >= READY_AT        ready. Never reaches him as a decision.
//   ESCALATE_FLOOR..   two repair attempts, re-judged blind each time. Still
//                      short after two, it is HIS, carrying both attempts.
//   < ESCALATE_FLOOR   one attempt, because a low score is sometimes a thin
//                      brief rather than a bad idea. Still short, it is buried
//                      carrying the median and the weakest judge as the reason.
//
// THE BAND BETWEEN THE TWO IS HIS AND THIS ROUTE MUST NEVER RESOLVE IT. That
// is the whole point of the change to check-judges.ts invariant 3: the machine
// takes the obvious ends and shows its working on everything it could not fix.
//
// NOTHING HERE BURIES. A weak piece is counted, left where it is, and reaches
// Krish on the Sunday list — see the weak branch near the end of the loop for
// why, and for the seed that settled it. Burying stays what it always was: a
// thing he does at the desk, deliberately, on a piece he has read.
//
//   GET (CRON_SECRET) — scheduled   ·   POST — manual, { limit, ids, dryRun }

/** Two attempts total, per idea, whichever branch it came down. */
const MAX_ATTEMPTS = 2
/** A deliberately small default. Judging is cheap but not free, and a runaway
 *  sweep over a backlog is how a cheap thing becomes an expensive one. */
const DEFAULT_LIMIT = 10
const REPAIR_TIMEOUT_MS = 90_000

interface Idea {
  id: string
  idea: string
  thesis: string | null
  body: string | null
  lane_slot: string | null
  meta: Record<string, unknown> | null
}

interface Attempt {
  n: number
  brief: { judge: string; score: number | null; fix: string }[]
  score_before: number | null
  score_after: number | null
  weakest_before: string | null
  weakest_after: string | null
  changed: boolean
  /** Why nothing changed, when nothing changed. An attempt with no outcome and
   *  no reason is the failure this whole engine keeps re-learning: it reads as
   *  "we tried" and proves nothing. */
  /** `regressed` is a repair that was judged WORSE than what it replaced. The
   *  earlier wording is kept and the loop stops; both scores stay on the row,
   *  because a repair that went backwards says the judges' brief was wrong
   *  rather than the idea. */
  outcome: 'improved' | 'declined' | 'unchanged' | 'call_failed' | 'regressed'
  detail: string | null
  panel_run_id: string | null
  /** What the repair was given to work with. An attempt that declined for want
   *  of evidence WITH research in hand is a different fact from one that
   *  declined with none, and the first run could not tell them apart. */
  researched: boolean
  sources: string[]
}

const artifactOf = (i: { idea: string; thesis?: string | null }) => `${i.idea}\n\n${i.thesis || ''}`.trim()

/**
 * The research Krish brought himself.
 *
 * meta.materials[] is where research-topic.ts puts pasted research and where
 * /materials writes an attachment, so his Perplexity pass, a newsletter he kept
 * and a document from his inspiration folder all arrive in one shape. Read here
 * so the judging path stops being the one part of the engine that never looks
 * at it.
 */
function ownMaterials(idea: Idea): string {
  const raw = (idea.meta as Record<string, unknown> | null)?.materials
  if (!Array.isArray(raw)) return ''
  return raw
    .map(m => {
      const o = (m || {}) as Record<string, unknown>
      const content = typeof o.content === 'string' ? o.content.trim() : ''
      if (!content) return ''
      const title = typeof o.title === 'string' && o.title.trim() ? o.title.trim() : 'untitled'
      const url = typeof o.url === 'string' && o.url.trim() ? ` (${o.url.trim()})` : ''
      return `### ${title}${url}\n${content.slice(0, 4000)}`
    })
    .filter(Boolean)
    .slice(0, 4)
    .join('\n\n')
}

/**
 * The rows one panel produces, with the run id decided up front.
 *
 * Split from the write so the batched sweep can HOLD them until the idea it
 * belongs to finishes its walk. A batched idea is re-walked from the top on
 * every tick — that is how it advances one stage at a time without the ladder
 * knowing — so a panel that wrote itself the moment it was read would insert
 * the same panel_runs row again on every tick until the idea settled, and
 * judge_calibration would join against five copies of one reading.
 *
 * The id is generated here rather than read back from the insert, so the
 * attempt can carry it before the row exists.
 */
export function panelRows(subjectId: string, panel: PanelResult, runId: string) {
  return {
    run: {
      id: runId,
      idempotency_key: panel.idempotency_key,
      gate: panel.gate,
      subject_table: 'content_ideas',
      subject_id: subjectId,
      artifact_hash: panel.artifact_hash,
      roster_version: panel.roster_version,
      spread: panel.spread,
      dissent: panel.dissent,
      tiebreaker_used: false,
      cost_usd: panel.cost_usd,
      started_at: panel.started_at,
      finished_at: panel.finished_at,
    },
    verdicts: panel.verdicts.map(v => ({
      panel_run_id: runId,
      judge: v.judge,
      score: v.score,
      verdict: v.verdict,
      the_one_fix: v.the_one_fix,
      evidence: v.evidence,
      confidence: v.confidence,
      deterministic: v.deterministic,
      model: v.model,
      cost_usd: 0,
    })),
  }
}

async function persistPanel(subjectId: string, panel: PanelResult): Promise<string | null> {
  const runId = randomUUID()
  const { run, verdicts } = panelRows(subjectId, panel, runId)
  const { error } = await supabase.from('panel_runs').insert(run)
  // Said out loud rather than swallowed: a panel whose verdicts did not land
  // is a panel that never ran, and calibration would silently have nothing to
  // join on.
  if (error) {
    console.warn(`[ladder] panel_runs insert failed for ${subjectId}: ${error.message}`)
    return null
  }
  const { error: vErr } = await supabase.from('judge_verdicts').insert(verdicts)
  if (vErr) console.warn(`[ladder] judge_verdicts insert failed for ${runId}: ${vErr.message}`)
  return runId
}

/**
 * Everything the walk needs from the outside world.
 *
 * THE POINT OF THIS INTERFACE is that there is exactly one ladder. The batched
 * sweep does not re-stage the work, re-band the scores, re-implement the
 * two-attempt cap or re-derive the confirmation; it swaps `call` for a
 * transport that answers from a reply already paid for and throws when it has
 * not got one. Every decision below was fixed in place after a live run proved
 * it wrong, and a second copy of them is a second place for the next fix to be
 * forgotten.
 */
export interface LadderDeps {
  /** How this walk reaches the model. */
  call: ClaudeCall
  /** Go and look something up. Cached for the life of a batched sweep, because
   *  research that varies between ticks changes the repair REQUEST and the
   *  repair would never match its own cached reply. */
  research: (query: string) => Promise<Gathered | null>
  /** Record a panel and return the id it will have. */
  persist: (subjectId: string, panel: PanelResult) => Promise<string | null>
  /** The idea finished its walk: write anything held for it. */
  commit: () => Promise<void>
  /** The idea deferred: drop anything held for it, unwritten. */
  abandon: () => void
  /** Whether a deferral may be caught and the idea retried on a later tick.
   *  False on the live path, where a deferral cannot happen and would be a bug
   *  worth surfacing rather than counting. */
  deferrable: boolean
}

/**
 * Who is eligible to be judged, as one query with one set of rules.
 *
 * Exported because the batched sweep has to pick its ideas at creation and then
 * keep judging THAT set — a sweep that re-selected on every tick would pull in
 * whatever arrived meanwhile and never finish. Two copies of this filter would
 * be two definitions of "unjudged", and the filter has already been wrong once:
 * `body is null` read as "waiting on a dry run" and silently meant "everything
 * except the one route that carries Krish's own research".
 */
export function candidateQuery(limit: number, ids: string[]) {
  let q = supabase.from('content_ideas').select('id,idea,thesis,body,lane_slot,meta')
  q = ids.length
    ? q.in('id', ids)
    : q.is('buried_at', null).in('state', ['seeded', 'researching', 'drafting'])
  return q.order('created_at', { ascending: false }).limit(ids.length ? ids.length : limit * 3)
}

/** Which of those still need a real judgment. `unjudged` on the row is a run
 *  that could not reach the model, not a verdict, so it stays eligible — see
 *  the skip inside the walk for the sweep that stranded 64 ideas. */
export function needsJudging(row: { meta: Record<string, unknown> | null; idea: string; thesis: string | null }): boolean {
  const meta = (row.meta || {}) as Record<string, any>
  const band = meta.ladder?.final?.band
  if (!meta.ladder || !band || band === 'unjudged') return true
  return meta.ladder.artifact_hash !== artifactHash(artifactOf(row))
}

/** The live transport: call the model now, look things up now, write now. */
export function liveDeps(dryRun: boolean): LadderDeps {
  return {
    call: callClaude,
    research: webResearch2gathered,
    persist: dryRun ? async () => null : persistPanel,
    commit: async () => {},
    abandon: () => {},
    deferrable: false,
  }
}

/** One attempt at lifting a piece, briefed by the judges that held it down.
 *  Returns null when the model declined or returned nothing usable, which is a
 *  real outcome and not an error: some ideas cannot be rescued. */
// Keyed on a STRING outcome rather than a boolean `ok`. This tsconfig has
// strict off by design (see its header), which widens `ok: true` to `boolean`
// and silently stops a discriminated union discriminating. tsc caught it; the
// string discriminant narrows either way.
interface RepairResult {
  outcome: 'improved' | 'declined' | 'unchanged' | 'call_failed'
  idea?: string
  thesis?: string
  what_changed?: string
  detail?: string
}

/** Research gathered for one repair, or nothing. */
interface Gathered { text: string; sources: string[] }

/**
 * Go and look it up, the way Krish does before he writes.
 *
 * THE DEADLOCK THIS BREAKS. On the first ladder run every single repair
 * declined, and all ten gave the same reason in different words: the judges
 * asked for a named person, a verified figure or a real deal, and the repair
 * pass is forbidden to invent one. So the judges demanded the one thing the
 * repairer could not produce, and a refusal was the only legal move. The
 * machine was asking itself to remember facts instead of going to find them.
 *
 * Krish, 2026-09-24: "I often come up with angles and ideas and go and research
 * the thesis in perplexity first, so the engine should be able to account for
 * that too."
 *
 * webResearch() has been in _enrich.ts the whole time, Perplexity first with
 * Exa and Brave behind it. Nothing in the judging path had ever called it.
 *
 * The query is built from what the judges actually withheld marks for, not from
 * the headline, because the headline is the part that already passed.
 *
 * Fail-soft and COUNTED: no key, an empty return or a thrown call all end with
 * null, the repair runs unresearched exactly as it did before, and the attempt
 * records `researched: false`. A repair that declined with research in hand is
 * a finished idea; one that declined without it is a missing lookup, and a run
 * that cannot tell them apart teaches nothing.
 */
async function webResearch2gathered(query: string): Promise<Gathered | null> {
  try {
    const r = await webResearch(query)
    if (!r.text || r.text.trim().length < 80) return null
    return { text: r.text.trim().slice(0, 6000), sources: r.sources.slice(0, 12) }
  } catch (e) {
    console.warn(`[ladder] research failed: ${(e as Error)?.message?.slice(0, 160) || 'unknown'}`)
    return null
  }
}

/** The query the judges' own complaints imply, handed to whichever researcher
 *  the walk was given. Split from the lookup so a batched sweep can cache the
 *  ANSWER against this exact query: two ticks that ask differently would brief
 *  two different repairs, and the second would never match the first's reply. */
async function gather(
  current: { idea: string; thesis?: string | null }, s: Standing,
  research: (query: string) => Promise<Gathered | null>,
): Promise<Gathered | null> {
  const asks = s.brief.filter(b => b.fix).slice(0, 4).map(b => b.fix).join(' ')
  if (!asks) return null
  const query = [
    `Find verifiable, recent, citable facts for this claim: "${current.idea}".`,
    current.thesis ? `The argument: ${current.thesis}` : '',
    `Specifically find what these gaps need: ${asks}`,
    'Give named companies, dated announcements, published figures and prices with their sources.',
    'If a fact cannot be verified, say so plainly rather than offering a plausible one.',
  ].filter(Boolean).join(' ').slice(0, 1400)
  return research(query)
}

async function repair(
  idea: Idea, s: Standing, mandate: string, voice: string,
  research: Gathered | null, own: string, call: ClaudeCall,
): Promise<RepairResult> {
  const brief = s.brief.map(b => `- ${b.judge} (${b.score ?? 'n/a'}/10): ${b.fix}`).join('\n')
  const system = [
    'You are improving one content idea for Krish Raja so that it clears a judging panel it has just failed.',
    '',
    'A panel of blinded judges scored it. Its standing is the MEDIAN of their scores, but the brief below is',
    'ordered weakest first, and the weakest axes are the whole job. Do not polish what already works.',
    '',
    'HOW TO LIFT IT, in order of what usually works:',
    '- Go deeper. Replace the general claim with the specific mechanism underneath it.',
    '- Find the contrarian evidence. What would someone well informed say against this, and does the idea',
    '  survive it? If it does, say so in the thesis. If it does not, change the claim rather than hiding it.',
    '- Ask why, twice. The second answer is usually the piece.',
    '- Name what would prove it. An unfalsifiable idea scores low on evidence forever.',
    '',
    'You may change the claim. You may not invent a fact, a figure, a source or a quote.',
    research || own
      // The first run declined all ten repairs for want of evidence, so the
      // rule now names where evidence IS allowed to come from instead of only
      // where it is not. "Nothing was found" stays a legal answer: a repair
      // that quietly upgrades a thin research return into a confident claim is
      // the invention this rule exists to stop, wearing a citation.
      ? 'Facts below — the research gathered for this fix, and any material Krish brought himself — ARE available to you. ' +
        'Use them, and attribute each one to its source in the thesis. Anything not in them, or only half-supported by them, ' +
        'is still an invention: say so in `cannot_fix` rather than reaching for it.'
      : 'No research was available for this attempt. If the fix the judges asked for requires evidence that does not ' +
        'exist here, say so in `cannot_fix` and change nothing.',
    '',
    'THE MANDATE this belongs to:',
    mandate,
    '',
    'VOICE:',
    voice.slice(0, 2000),
    '',
    'Return ONE JSON object and nothing else:',
    '{"idea": "the sharpened one-sentence idea", "thesis": "2-4 sentences: the claim, the mechanism, and what would prove it wrong",',
    ' "what_i_changed": "one sentence", "cannot_fix": null or "why this cannot be lifted without inventing something"}',
  ].join('\n')

  const user = [
    '## The idea as it stands', artifactOf(idea), '',
    '## What the judges said to fix, weakest first', brief,
    // Krish's own research first, because he already decided it was worth
    // keeping and a lookup did not. Same meta.materials[] the composer and
    // revise read, so "research this for me" and "here is my research" reach
    // the judges through one door.
    ...(own ? ['', '## Research Krish brought himself', own] : []),
    ...(research ? ['', '## Research gathered for this fix', research.text,
      research.sources.length ? `\nSources: ${research.sources.join(' | ')}` : ''] : []),
  ].join('\n')

  try {
    const raw = await call({
      system, user, model: UTILITY_MODEL, maxTokens: 1200, temperature: 0.4,
      agent: 'ladder-repair', timeoutMs: REPAIR_TIMEOUT_MS,
    })
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return { outcome: 'call_failed', detail: 'the model did not return an object' }
    const parsed = JSON.parse(m[0]) as Record<string, unknown>
    // A refusal is a real answer and the most interesting one: it means the fix
    // the judges asked for needs evidence that does not exist.
    if (typeof parsed.cannot_fix === 'string' && parsed.cannot_fix.trim()) {
      return { outcome: 'declined', detail: parsed.cannot_fix.trim().slice(0, 400) }
    }
    const nextIdea = typeof parsed.idea === 'string' ? parsed.idea.trim() : ''
    const nextThesis = typeof parsed.thesis === 'string' ? parsed.thesis.trim() : ''
    if (!nextIdea || nextIdea.length < 12) {
      return { outcome: 'call_failed', detail: 'the model returned no usable idea' }
    }
    return {
      outcome: 'improved', idea: nextIdea, thesis: nextThesis,
      what_changed: typeof parsed.what_changed === 'string' ? parsed.what_changed.trim().slice(0, 300) : '',
    }
  } catch (e) {
    // "Not back yet" is not "the call failed". Recording it as a failed repair
    // would spend the idea's one attempt on a tick that never reached the
    // model, and the ladder caps attempts at two.
    if (isDeferred(e)) throw e
    const detail = (e as Error)?.message?.slice(0, 200) || 'unknown'
    console.warn(`[ladder] repair call failed for ${idea.id}: ${detail}`)
    return { outcome: 'call_failed', detail }
  }
}

async function route(
  idea: Idea, mandates: { slug: string; label: string; mandate: string }[], call: ClaudeCall,
): Promise<RouterVerdict | null> {
  try {
    const raw = await call({
      system: buildRouterPrompt(mandates),
      user: artifactOf(idea),
      model: JUDGE_MODEL, maxTokens: 500, temperature: 0,
      agent: 'ladder-router', timeoutMs: 45_000,
    })
    return parseRouterVerdict(raw, mandates.map(m => m.slug))
  } catch (e) {
    if (isDeferred(e)) throw e
    console.warn(`[ladder] router failed for ${idea.id}: ${(e as Error)?.message?.slice(0, 120)}`)
    return null
  }
}

export interface LadderReport {
  ok: true
  dry_run: boolean
  judged: number
  ready: number
  escalated: number
  weak: number
  unjudged: number
  skipped: number
  repairs: number
  /** Ideas whose next step is waiting on a batch. Always 0 on the live path.
   *  A deferred idea is untouched: nothing was written for it this pass. */
  deferred: number
  /** True when the pass stopped on its wall-clock budget rather than at the
   *  end of the list. The remaining ideas are untouched and eligible. */
  ran_out_of_time: boolean
  warning?: string
  results: Record<string, unknown>[]
}

/**
 * One pass of the ladder over a set of ideas.
 *
 * The live route and the batched sweep both call THIS. What separates them is
 * `deps`, and nothing else: how the model is reached, how a lookup is made, and
 * whether a reply that is not back yet may be caught and retried later.
 */
export async function runLadder(
  { limit, ids, dryRun, deps, deadlineMs }:
    { limit: number; ids: string[]; dryRun: boolean; deps: LadderDeps; deadlineMs?: number },
): Promise<LadderReport> {
  // A wall-clock budget, for the live path.
  //
  // Bounding the work by a COUNT of ideas is the obvious thing and it is the
  // wrong one: the ideas are wildly uneven. A ready piece needs one router call
  // and is done in a second; a repairable one needs research, two rewrites and
  // three panels. A fixed count either wastes most of the function's budget on
  // an easy batch or overruns on a hard one.
  //
  // Overrunning is cheap and safe here, which is what makes a deadline usable:
  // every reply is written to the cache the moment it arrives, and an idea's
  // rows are committed only when its walk finishes. A tick killed mid-idea
  // therefore loses nothing and re-buys nothing — the next tick re-walks that
  // one idea entirely from cache. The deadline exists to keep the ledger row
  // honest, not to protect the work.
  const deadline = deadlineMs ? Date.now() + deadlineMs : null
  {
    const { data: mandateRows, error: mErr } = await supabase
      .from('venture_formats').select('slug,label,mandate').eq('active', true).not('mandate', 'is', null)
    if (mErr) throw new Error(`mandates unreadable: ${mErr.message}`)
    // The router reads the live mandates and nothing else. Krish rewrote all
    // three on 2026-09-24; a copy in code would already be wrong.
    const mandates = (mandateRows || [])
      .filter(m => ['follow_the_money', 'under_the_hood', 'mind_the_gap'].includes(m.slug as string))
      .map(m => ({ slug: m.slug as string, label: m.label as string, mandate: m.mandate as string }))
    if (mandates.length !== 3) throw new Error(`expected 3 live subchannel mandates, found ${mandates.length}`)

    // Everything unjudged, whoever wrote it and however far it got.
    //
    // THE HOLE THIS CLOSES. The filter was `state in (seeded, researching) and
    // body is null`, which reads as "ideas a dry run is waiting on" and turned
    // out to mean something narrower: research-topic.ts — the ONE route that
    // exists to take a topic Krish names, or research he brings back himself,
    // and work it up — writes state 'drafting' WITH a body. So the single path
    // carrying his own thinking was the single path the judges never saw, and
    // the panel only ever graded what the machine had scraped.
    //
    // Krish, 2026-09-24, on his Perplexity habit and his inspiration folder:
    // "I am sure you have already wired all the avenues in to one cohesive
    // engine." It was not. This is that wire.
    //
    // A body is still not judged as a seed: `expand` is skipped for a piece
    // that already has one, because the body IS the expansion and re-expanding
    // it would judge a summary of his work instead of his work.
    //
    // Named ids override both filters. Asking for a row by its id is an
    // explicit instruction, and the case that matters most is re-judging
    // something a previous ladder run BURIED — which the buried_at filter would
    // otherwise make unreachable, so the route could never be pointed at its
    // own mistakes.
    const { data: rows, error: rErr } = await candidateQuery(limit, ids)
    if (rErr) throw new Error(rErr.message)

    const [voice, corpus] = await Promise.all([loadVoiceBlock(), loadCorpus()])

    // WHAT KRISH ACTUALLY DOES, for the standing judge.
    //
    // It rated a piece about encoding a leader's judgement a 3. Krish rated it
    // 7: "my business tries to encode decisions, judgment, standards, and taste
    // for a leader. This is the type of component that is missing." The judge
    // was not strict, it was uninformed: nothing in its context said what he
    // builds. The canon block at the head of the Cleo brief says exactly that,
    // and it has never been shown to a judge.
    //
    // Bounded to the canon block rather than the whole 30k brief: the rest is
    // drafting identity, and a judge reading his content preferences would be
    // the anti-echo failure check-judges.ts exists to prevent.
    let whatKrishDoes = ''
    try {
      const { data: brief } = await supabase.from('agents').select('brief_content').eq('id', 'cleo').maybeSingle()
      whatKrishDoes = String((brief as Record<string, unknown> | null)?.brief_content || '').slice(0, 2600)
    } catch (e) {
      console.warn(`[ladder] could not load the Cleo brief: ${(e as Error)?.message?.slice(0, 120)}`)
    }
    if (!whatKrishDoes) console.warn('[ladder] running WITHOUT the brief: the standing judge will score uninformed')
    const results: Record<string, unknown>[] = []
    let judged = 0, ready = 0, escalated = 0, weak = 0, skipped = 0, repairs = 0, deferred = 0
    let ranOutOfTime = false

    for (const raw of (rows || [])) {
      if (judged >= limit) break
      if (deadline && Date.now() > deadline) { ranOutOfTime = true; break }
      const idea = raw as unknown as Idea
      const meta = (idea.meta || {}) as Record<string, any>
      const hash = artifactHash(artifactOf(idea))
      try {
        // Idempotent on the artifact. Re-running is free and an edited idea is
        // re-judged, which is the behaviour a sweep needs to be safe to repeat.
        //
        // A RUN THAT COULD NOT JUDGE IS NOT A JUDGMENT. Measured 2026-09-24: the
        // Anthropic account hit its spend cap 38 ideas into a 102-idea sweep.
        // Every call after that failed, standing() correctly returned the
        // `unjudged` band because every judge had abstained, and the row was
        // written anyway with its artifact_hash. The next pass then skipped all
        // 102, so 64 ideas were stranded as permanently-judged-as-nothing and
        // no re-run would ever have picked them up.
        //
        // This reads the band rather than the presence of the record, so it
        // repairs the rows already written without a migration: they carry
        // `unjudged` and are now eligible again.
        const priorBand = meta.ladder?.final?.band
        if (meta.ladder?.artifact_hash === hash && priorBand && priorBand !== 'unjudged') { skipped++; continue }

        const mandateFor = (slug: string | null) =>
          mandates.find(m => m.slug === slug)?.mandate || mandates.map(m => m.mandate).join('\n\n')
        const judgeContext = [
          corpusForChannel(corpus, idea.lane_slot || 'general'),
          `VOICE\n${voice.slice(0, 1500)}`,
          whatKrishDoes ? `WHAT KRISH ACTUALLY DOES\n${whatKrishDoes}` : '',
          // His rulings reach the panel, not only the writers (api/_houseRules.ts).
          houseRulesBlock('judge_idea', idea.lane_slot),
        ].filter(Boolean).join('\n\n')

        // The seed is not the thing to judge. The angle is. See _judges/expand.ts:
        // the panel was two points harsher than Krish on ten ideas because it was
        // scoring headlines while he was scoring the piece underneath them.
        //
        // A failed expansion is NOT a fallback to judging the seed quietly. It is
        // recorded, and the seed is judged with that fact attached, so a run can
        // be read afterwards without guessing which ideas got the full treatment.
        //
        // A piece that already HAS a body skips the expansion: the body is the
        // expansion, written by Krish or researched on his instruction, and
        // expanding it again would hand the judges a summary of his work in
        // place of his work.
        const written = (idea.body || '').trim()
        const expansion: Expansion = written
          ? {
              angle: '', implications: [], scenarios: [], decision_rule: null, known: [], inferred: [],
              ok: false, why_not: 'already written: judged on its own body, not an expansion of it',
            }
          // All three mandates, never the row's current lane. The router runs
          // AFTER this and scores fit against all three, so binding the
          // expansion to one lane it may overturn is the wrong order, and the
          // cost is a refusal that leaves the piece judged as a raw headline.
          : await expand(artifactOf(idea), mandateFor(null), whatKrishDoes, { call: deps.call })
        const judged0 = written
          ? `${artifactOf(idea)}\n\n${written}`
          : expansion.ok ? expansionArtifact(artifactOf(idea), expansion) : artifactOf(idea)

        const free = deterministicFindings({ text: judged0, minChars: 80, checkVoice: true })
        let panel = await runPanel({
          gate: 'idea', subjectTable: 'content_ideas', subjectId: idea.id,
          artifact: judged0,
          context: judgeContext,
          deterministic: free, shortCircuitOnKill: true,
          idempotencyKey: randomUUID(), call: deps.call,
        })
        judged++
        let panelRunId = await deps.persist(idea.id, panel)
        let s = standing(panel.verdicts)
        const first = { score: s.score, weakest: s.weakest, band: s.band }
        const attempts: Attempt[] = []
        let current = { idea: idea.idea, thesis: idea.thesis || '' }

        const allowed = s.band === 'weak' ? 1 : s.band === 'repairable' ? MAX_ATTEMPTS : 0
        const mandate = mandateFor(idea.lane_slot)

        // What Krish already went and found, from meta.materials[] — the same
        // field research-topic.ts and /materials write. His Perplexity pass and
        // his inspiration drops land here, so a repair sees his work before it
        // spends anything looking for its own.
        const own = ownMaterials(idea)

        for (let n = 1; n <= allowed && s.band !== 'ready'; n++) {
          const found = await gather(current, s, deps.research)
          const fixed = await repair({ ...idea, ...current }, s, mandate, voice, found, own, deps.call)
          const changed = fixed.outcome === 'improved'
            && artifactOf({ idea: fixed.idea || '', thesis: fixed.thesis }) !== artifactOf(current)
          // An attempt that changed nothing is the most useful row here, but only
          // if it says WHY. Declined for want of evidence, returned the same text,
          // and the call fell over are three different facts, and reading them as
          // one is how "we tried" becomes a sentence nobody can act on. They are
          // split rather than ternaried because the compiler caught me conflating
          // the first two.
          const stop = (outcome: Attempt['outcome'], detail: string) => {
            attempts.push({
              n, brief: s.brief, score_before: s.score, score_after: s.score,
              weakest_before: s.weakest, weakest_after: s.weakest, changed: false,
              outcome, detail, panel_run_id: null,
              researched: Boolean(found || own), sources: found?.sources || [],
            })
          }
          if (fixed.outcome !== 'improved') { stop(fixed.outcome, fixed.detail || 'no reason given'); break }
          if (!changed) { stop('unchanged', 'the model returned the same idea'); break }
          repairs++
          const previous = current
          const repaired = { idea: fixed.idea as string, thesis: fixed.thesis || '' }
          panel = await runPanel({
            gate: 'idea', subjectTable: 'content_ideas', subjectId: idea.id,
            artifact: artifactOf(repaired),
            context: judgeContext,
            deterministic: deterministicFindings({ text: artifactOf(repaired), minChars: 80, checkVoice: true }),
            shortCircuitOnKill: true, idempotencyKey: randomUUID(), call: deps.call,
          })
          const runId = await deps.persist(idea.id, panel)
          const before = s
          const after = standing(panel.verdicts)
          if (runId) panelRunId = runId

          // A REPAIR MAY NEVER LEAVE A PIECE WORSE THAN IT FOUND IT.
          //
          // Caught on a live run, 2026-09-24: an idea the panel had scored 7 was
          // "improved", re-judged at 3 on the new wording, and buried on that 3.
          // The loop took the repaired text unconditionally, so the machine could
          // destroy a good idea by trying to sharpen it, and then file the wreck
          // as its own evidence for burying it. Nothing said so: it read as an
          // ordinary low score.
          //
          // The keep-the-better rule is not a rollback of the record. Both
          // versions were judged, both scores are on the attempt, and a repair
          // that went backwards is the single most useful row here — it says the
          // judges' brief was wrong, not the idea.
          if (after.score !== null && before.score !== null && after.score < before.score) {
            current = previous
            attempts.push({
              n, brief: before.brief, score_before: before.score, score_after: after.score,
              weakest_before: before.weakest, weakest_after: after.weakest, changed: false,
              outcome: 'regressed',
              detail: `the repair scored ${after.score} against ${before.score}; the earlier wording was kept`,
              panel_run_id: runId,
              researched: Boolean(found || own), sources: found?.sources || [],
            })
            break
          }

          current = repaired
          s = after
          attempts.push({
            n, brief: before.brief, score_before: before.score, score_after: s.score,
            weakest_before: before.weakest, weakest_after: s.weakest, changed: true,
            outcome: 'improved', detail: fixed.what_changed || null, panel_run_id: runId,
            researched: Boolean(found || own), sources: found?.sources || [],
          })
        }

        // ── NOTHING IS BURIED ON ONE READING OF ONE EXPANSION ────────────────
        //
        // Measured over three passes of the same ten ideas, same code, same
        // input: one idea Krish had graded 7 came out 4, 6, 6, so one run in
        // three would have buried work he rated well.
        //
        // The first version of this check re-judged the same wording with a
        // fresh panel, on the theory that the judges were noisy. A run proved
        // that wrong in the most direct way available: the second panel agreed
        // with the first, judge for judge, and the piece was buried anyway.
        //
        // The variance is not in the judges. It is HERE, in the expansion:
        //
        //   seeds whose expansion produced identical text   score range 0, 0
        //   seeds whose expansion produced different text   0,1,0,2,0,0,0,2
        //
        // Only 2 of 10 seeds expanded to the same angle twice. The other eight
        // became a genuinely different piece each run, and every point of
        // variance lives in that group. So a seed was never being buried for
        // being weak — it was buried for the one expansion it happened to draw,
        // and a second panel reading that same expansion could only agree.
        //
        // The confirmation therefore EXPANDS AGAIN and judges that. It asks the
        // question that matters: is this seed weak, or was that expansion bad?
        // A piece that already has a body has nothing to re-expand, so it is
        // re-judged as before — there the judges really are the only variable.
        let confirmation: Record<string, unknown> | null = null
        if (s.band === 'weak') {
          const reExpansion: Expansion | null = written
            ? null
            // sample: 2 says this must be an INDEPENDENT draw. Without it a
            // content-keyed batch cache would hand back the FIRST expansion,
            // the second panel would agree with itself, and the row would
            // claim a confirmation nothing tested.
            : await expand(artifactOf(current), mandateFor(null), whatKrishDoes, { call: deps.call, sample: 2 })
          const artifact = reExpansion?.ok
            ? expansionArtifact(artifactOf(current), reExpansion)
            : written ? `${artifactOf(current)}\n\n${written}` : artifactOf(current)
          const second = await runPanel({
            gate: 'idea', subjectTable: 'content_ideas', subjectId: idea.id,
            artifact,
            context: judgeContext,
            deterministic: deterministicFindings({ text: artifact, minChars: 80, checkVoice: true }),
            // sample: 2 for the same reason the re-expansion carries it. When
            // the re-expansion FAILED the artifact here is byte-identical to
            // the first panel's, and without this the batch would serve the
            // first panel's verdicts back as a second reading that agreed.
            shortCircuitOnKill: true, idempotencyKey: randomUUID(), call: deps.call, sample: 2,
          })
          const confirmId = await deps.persist(idea.id, second)
          if (confirmId) panelRunId = confirmId
          const c = standing(second.verdicts)
          confirmation = {
            first: { score: s.score, weakest: s.weakest, band: s.band },
            second: { score: c.score, weakest: c.weakest, band: c.band },
            agreed: c.band === 'weak',
            // Whether the second reading was a genuinely different piece or the
            // same one. Without this the row cannot say which question it
            // answered, and the first version of this check silently answered
            // the wrong one.
            re_expanded: Boolean(reExpansion?.ok),
            re_expansion_failed: reExpansion && !reExpansion.ok ? reExpansion.why_not : null,
            panel_run_id: confirmId,
          }
          // Two readings of two different expansions disagreeing means the seed
          // survives: the better one is what it is worth. The disagreement is
          // the useful record either way — it says the expansion is the unstable
          // part, which is what the weekly compiler should be watching.
          if (c.band !== 'weak') s = c
        }

        const router = await route({ ...idea, ...current }, mandates, deps.call)
        const ladder = {
          artifact_hash: artifactHash(artifactOf(current)),
          roster_version: ROSTER_VERSION,
          judged_at: new Date().toISOString(),
          first, final: { score: s.score, weakest: s.weakest, band: s.band },
          expansion: expansion.ok
            ? { angle: expansion.angle, parties: expansion.implications.map(i => i.party),
                scenarios: expansion.scenarios.length, decision_rule: Boolean(expansion.decision_rule),
                known: expansion.known.length, inferred: expansion.inferred.length }
            : { failed: expansion.why_not },
          attempts,
          // Present only when the piece reached the weak band, so its absence on
          // a row means the question never arose rather than that the check was
          // skipped.
          ...(confirmation ? { bury_confirmation: confirmation } : {}),
          panel_run_id: panelRunId,
          router: router ? { fits: router.fits, winner: router.winner, contested: router.contested, why: router.why } : null,
          // Recorded, never enforced: the router names its pick and a human pick
          // it disagrees with, and the weekly compiler measures who was right.
          router_disagrees: Boolean(router?.winner && idea.lane_slot && router.winner !== idea.lane_slot),
        }

        const patch: Record<string, unknown> = {
          meta: { ...meta, ladder },
          updated_at: new Date().toISOString(),
        }
        // Every other writer runs its words through sanitizeVoice before storing
        // them; the repair was the one that did not, so an em dash it wrote
        // stayed in the idea and the voice check then marked the idea down for it.
        if (attempts.some(a => a.changed)) { patch.idea = sanitizeVoice(current.idea); patch.thesis = current.thesis == null ? current.thesis : sanitizeVoice(current.thesis) }
        // Never overwrite a subchannel a human chose. The router records its pick
        // either way and is graded on the disagreement.
        if (!idea.lane_slot && router?.winner && !router.contested.length) patch.lane_slot = router.winner

        // ── THIS ROUTE DOES NOT BURY ─────────────────────────────────────────
        //
        // It used to, and two safeguards were built for it in one afternoon
        // before the measurement said the premise was wrong.
        //
        // The Jev seed, which Krish graded 7: `consequence`, `reader` and
        // `standing` each scored it 3 on FOUR independent expansions and panels.
        // Not a coin flip, not one rubric wobbling — a settled disagreement
        // between him and three judges. No amount of confirming, re-reading or
        // re-expanding averages that away, because there is nothing random in it
        // to average. The machine would have buried it every time, correctly by
        // its own lights, and he would never have seen it.
        //
        // Krish, 2026-09-24, choosing this over keeping the bury: weak pieces go
        // to a Sunday list, nothing buries. One judge doing all the killing shows
        // up in that list immediately, which is the quickest route to the rubric
        // that is actually wrong — and nothing is lost to a disagreement the
        // system has not learned yet.
        //
        // The band is on the row, so the list is a query rather than a table:
        //   meta->'ladder'->'final'->>'band' = 'weak'
        // Burying stays exactly what it was, a thing Krish does at the desk.
        if (s.band === 'weak') weak++
        else if (s.band === 'ready') ready++
        else escalated++

        if (!dryRun) {
          const { error: uErr } = await supabase.from('content_ideas').update(patch).eq('id', idea.id)
          if (uErr) console.warn(`[ladder] update failed for ${idea.id}: ${uErr.message}`)
        }

        results.push({
          id: idea.id, idea: current.idea.slice(0, 90),
          first_score: first.score, final_score: s.score, weakest: s.weakest, band: s.band,
          expanded: expansion.ok, expansion_failed: expansion.why_not,
          angle: expansion.ok ? expansion.angle.slice(0, 110) : null,
          // researched/sources are in this projection deliberately. The Attempt
          // carries them so a refusal can be read, and the first run that had
          // them left them OUT of the response — so the run reported "declined,
          // no research" for four repairs that had plainly read the research and
          // said so in their own reason. A field recorded but not surfaced is
          // indistinguishable from a field that was never set, which is the same
          // failure as reporting success for work that did not happen, inverted.
          attempts: attempts.map(a => ({
            n: a.n, outcome: a.outcome, detail: a.detail,
            score_before: a.score_before, score_after: a.score_after, weakest_before: a.weakest_before,
            researched: a.researched, sources: a.sources, briefed: a.brief.length,
          })),
          spread: panel.spread, dissent: panel.dissent,
          // Surfaced, not merely stored — the lesson from `researched`, which was
          // recorded on every attempt and left out of the response, and so read
          // as never having happened.
          bury_confirmation: confirmation,
          scores: Object.fromEntries(panel.verdicts.filter(v => !v.deterministic).map(v => [v.judge, v.score])),
          router: ladder.router, router_disagrees: ladder.router_disagrees,
        })
        // Everything this idea held is written only now, at the end of a walk
        // that completed. A batched idea is re-walked from the top on every
        // tick, so writing as it went would insert the same panel five times.
        await deps.commit()
      } catch (e) {
        // ── A DEFERRAL IS NOT A FAILURE, AND IT IS NOT A JUDGMENT ───────────
        //
        // The batched transport throws to say the reply is not back yet. The
        // idea is left EXACTLY as it was: nothing held for it is written, no
        // band is recorded, no attempt is spent, and meta.ladder is untouched,
        // so the next tick picks it up from the same place with one more stage
        // answered.
        //
        // Anything else rethrows. A deferral on the live path would be a bug
        // and counting it would hide one, so `deferrable` is false there.
        if (!deps.deferrable || !isDeferred(e)) { deps.abandon(); throw e }
        deps.abandon()
        deferred++
      }
    }

    // `weak` where `buried` used to be. The count is the Sunday list's length,
    // and calling it buried would be a lie about what happened to the rows.
    // `unjudged` is reported separately from the bands. A sweep where every
    // model call failed returned judged=102 with the same shape as a clean
    // one, which is the failure this engine keeps finding in other people's
    // code: success reported for work that did not happen.
    const unjudged = results.filter(r => (r as Record<string, unknown>).band === 'unjudged').length
    return {
      ok: true, dry_run: dryRun, judged, ready, escalated, weak, unjudged, skipped, repairs, deferred,
      // Said rather than inferred. A pass that stopped on the clock looks
      // exactly like one that finished the list, and reading the second as the
      // first is how a half-done sweep reports as a whole one.
      ran_out_of_time: ranOutOfTime,
      ...(unjudged ? { warning: `${unjudged} of ${judged} could not be judged at all and will be retried on the next run` } : {}),
      results,
    }
  }
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardCronRoute(req, res)) return

  const body = (req.body || {}) as { limit?: number; ids?: string[]; dryRun?: boolean }
  const limit = Math.max(1, Math.min(60, Number(body.limit) || DEFAULT_LIMIT))
  const dryRun = body.dryRun === true
  // `ids` was in this type and in the doc comment at the head of the file from
  // the day the route was written, and nothing ever read it: a caller asking
  // for ten named ideas silently got an arbitrary ten instead, with no error
  // and a well-formed response. Same shape as every other bug this week — the
  // option exists, nothing is wired to it.
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((v): v is string => typeof v === 'string' && v.length > 0).slice(0, 60)
    : []

  try {
    return res.json(await runLadder({ limit, ids, dryRun, deps: liveDeps(dryRun) }))
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}

export default withContentRun('judge_ladder', handler)
export const config = { maxDuration: 300 }
