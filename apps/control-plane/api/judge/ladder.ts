import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'node:crypto'
import { guardCronRoute } from '../_auth.js'
import { supabase } from '../_supabase.js'
import { callClaude, loadCorpus, loadVoiceBlock, corpusForChannel } from '../_content.js'
import { UTILITY_MODEL, JUDGE_MODEL } from '../_models.js'
import { withContentRun } from '../_runs.js'
import { deterministicFindings } from '../_judges/deterministic.js'
import {
  artifactHash, buildRouterPrompt, parseRouterVerdict, runPanel, standing,
  READY_AT, ESCALATE_FLOOR, type PanelResult, type Standing,
} from '../_judges/panel.js'
import { ROSTER_VERSION, type RouterVerdict } from '../_judges/roster.js'

// The ladder. Judge, try to fix, and only then bother Krish.
//
// Krish, 2026-09-24: "the judges should literally judge, in the machine, before
// it's presented to me for triage with the judges scores. I should always be
// able to review and override on things that score between a 7>9 out of 10 if
// the machine could not find a way to improve the story to get it to a 10/10
// itself first by going deeper, finding contrarian evidence, asking why."
//
//   score = the weakest judge (see standing() in _judges/panel.ts)
//
//   >= READY_AT        ready. Never reaches him as a decision.
//   ESCALATE_FLOOR..   two repair attempts, re-judged blind each time. Still
//                      short after two, it is HIS, carrying both attempts.
//   < ESCALATE_FLOOR   one attempt, because a low score is sometimes a thin
//                      brief rather than a bad idea. Still short, it is buried
//                      with the weakest judge's evidence as the reason.
//
// THE BAND BETWEEN THE TWO IS HIS AND THIS ROUTE MUST NEVER RESOLVE IT. That
// is the whole point of the change to check-judges.ts invariant 3: the machine
// takes the obvious ends and shows its working on everything it could not fix.
//
// Every automatic decision is REVERSIBLE and RECORDED. A bury sets buried_at
// and buried_reason, the house archive verb, so detect.ts can still read the
// row and the desk's "what you have told me" view still shows it. Nothing is
// deleted.
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
  panel_run_id: string | null
}

const artifactOf = (i: { idea: string; thesis?: string | null }) => `${i.idea}\n\n${i.thesis || ''}`.trim()

async function persistPanel(subjectId: string, panel: PanelResult): Promise<string | null> {
  const { data, error } = await supabase.from('panel_runs').insert({
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
  }).select('id').single()
  // Said out loud rather than swallowed: a panel whose verdicts did not land
  // is a panel that never ran, and calibration would silently have nothing to
  // join on.
  if (error || !data) {
    console.warn(`[ladder] panel_runs insert failed for ${subjectId}: ${error?.message || 'no row'}`)
    return null
  }
  const runId = data.id as string
  const { error: vErr } = await supabase.from('judge_verdicts').insert(panel.verdicts.map(v => ({
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
  })))
  if (vErr) console.warn(`[ladder] judge_verdicts insert failed for ${runId}: ${vErr.message}`)
  return runId
}

/** One attempt at lifting a piece, briefed by the judges that held it down.
 *  Returns null when the model declined or returned nothing usable, which is a
 *  real outcome and not an error: some ideas cannot be rescued. */
async function repair(idea: Idea, s: Standing, mandate: string, voice: string): Promise<{ idea: string; thesis: string } | null> {
  const brief = s.brief.map(b => `- ${b.judge} (${b.score ?? 'n/a'}/10): ${b.fix}`).join('\n')
  const system = [
    'You are improving one content idea for Krish Raja so that it clears a judging panel it has just failed.',
    '',
    'A panel of blinded judges scored it. Its score is its WEAKEST axis, so fixing the weakest thing is the',
    'whole job. Do not polish what already works.',
    '',
    'HOW TO LIFT IT, in order of what usually works:',
    '- Go deeper. Replace the general claim with the specific mechanism underneath it.',
    '- Find the contrarian evidence. What would someone well informed say against this, and does the idea',
    '  survive it? If it does, say so in the thesis. If it does not, change the claim rather than hiding it.',
    '- Ask why, twice. The second answer is usually the piece.',
    '- Name what would prove it. An unfalsifiable idea scores low on evidence forever.',
    '',
    'You may change the claim. You may not invent a fact, a figure, a source or a quote. If the fix the judges',
    'asked for requires evidence that does not exist, say so in `cannot_fix` and change nothing.',
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
  ].join('\n')

  try {
    const raw = await callClaude({
      system, user, model: UTILITY_MODEL, maxTokens: 1200, temperature: 0.4,
      agent: 'ladder-repair', timeoutMs: REPAIR_TIMEOUT_MS,
    })
    const m = raw.match(/\{[\s\S]*\}/)
    if (!m) return null
    const parsed = JSON.parse(m[0]) as Record<string, unknown>
    if (parsed.cannot_fix) return null
    const nextIdea = typeof parsed.idea === 'string' ? parsed.idea.trim() : ''
    const nextThesis = typeof parsed.thesis === 'string' ? parsed.thesis.trim() : ''
    if (!nextIdea || nextIdea.length < 12) return null
    return { idea: nextIdea, thesis: nextThesis }
  } catch (e) {
    console.warn(`[ladder] repair failed for ${idea.id}: ${(e as Error)?.message?.slice(0, 120)}`)
    return null
  }
}

async function route(idea: Idea, mandates: { slug: string; label: string; mandate: string }[]): Promise<RouterVerdict | null> {
  try {
    const raw = await callClaude({
      system: buildRouterPrompt(mandates),
      user: artifactOf(idea),
      model: JUDGE_MODEL, maxTokens: 500, temperature: 0,
      agent: 'ladder-router', timeoutMs: 45_000,
    })
    return parseRouterVerdict(raw, mandates.map(m => m.slug))
  } catch (e) {
    console.warn(`[ladder] router failed for ${idea.id}: ${(e as Error)?.message?.slice(0, 120)}`)
    return null
  }
}

async function handler(req: VercelRequest, res: VercelResponse) {
  if (guardCronRoute(req, res)) return

  const body = (req.body || {}) as { limit?: number; ids?: string[]; dryRun?: boolean }
  const limit = Math.max(1, Math.min(60, Number(body.limit) || DEFAULT_LIMIT))
  const dryRun = body.dryRun === true

  try {
    const { data: mandateRows, error: mErr } = await supabase
      .from('venture_formats').select('slug,label,mandate').eq('active', true).not('mandate', 'is', null)
    if (mErr) throw new Error(`mandates unreadable: ${mErr.message}`)
    // The router reads the live mandates and nothing else. Krish rewrote all
    // three on 2026-09-24; a copy in code would already be wrong.
    const mandates = (mandateRows || [])
      .filter(m => ['split_the_bill', 'lift_the_lid', 'mind_the_gap'].includes(m.slug as string))
      .map(m => ({ slug: m.slug as string, label: m.label as string, mandate: m.mandate as string }))
    if (mandates.length !== 3) throw new Error(`expected 3 live subchannel mandates, found ${mandates.length}`)

    // Ideas with no body yet: the ones a dry run is waiting on. Over-fetch,
    // because the idempotency check below skips anything already judged at its
    // current wording and those should not eat the limit.
    const { data: rows, error: rErr } = await supabase.from('content_ideas')
      .select('id,idea,thesis,lane_slot,meta')
      .is('buried_at', null)
      .in('state', ['seeded', 'researching'])
      .or('body.is.null,body.eq.')
      .order('created_at', { ascending: false })
      .limit(limit * 3)
    if (rErr) throw new Error(rErr.message)

    const [voice, corpus] = await Promise.all([loadVoiceBlock(), loadCorpus()])
    const results: Record<string, unknown>[] = []
    let judged = 0, ready = 0, escalated = 0, buried = 0, skipped = 0, repairs = 0

    for (const raw of (rows || [])) {
      if (judged >= limit) break
      const idea = raw as unknown as Idea
      const meta = (idea.meta || {}) as Record<string, any>
      const hash = artifactHash(artifactOf(idea))
      // Idempotent on the artifact. Re-running is free and an edited idea is
      // re-judged, which is the behaviour a sweep needs to be safe to repeat.
      if (meta.ladder?.artifact_hash === hash) { skipped++; continue }

      const free = deterministicFindings({ text: artifactOf(idea), minChars: 80, checkVoice: true })
      let panel = await runPanel({
        gate: 'idea', subjectTable: 'content_ideas', subjectId: idea.id,
        artifact: artifactOf(idea),
        context: [
          corpusForChannel(corpus, idea.lane_slot || 'general'),
          `VOICE\n${voice.slice(0, 1500)}`,
        ].join('\n\n'),
        deterministic: free, shortCircuitOnKill: true,
        idempotencyKey: randomUUID(),
      })
      judged++
      let panelRunId = dryRun ? null : await persistPanel(idea.id, panel)
      let s = standing(panel.verdicts)
      const first = { score: s.score, weakest: s.weakest, band: s.band }
      const attempts: Attempt[] = []
      let current = { idea: idea.idea, thesis: idea.thesis || '' }

      const allowed = s.band === 'weak' ? 1 : s.band === 'repairable' ? MAX_ATTEMPTS : 0
      const mandate = mandates.find(m => m.slug === idea.lane_slot)?.mandate || mandates.map(m => m.mandate).join('\n\n')

      for (let n = 1; n <= allowed && s.band !== 'ready'; n++) {
        const fixed = await repair({ ...idea, ...current }, s, mandate, voice)
        const changed = Boolean(fixed) && artifactOf(fixed!) !== artifactOf(current)
        if (!fixed || !changed) {
          // An attempt that changed nothing is the most useful row here: it is
          // evidence the idea is finished or the fix was not actionable.
          attempts.push({ n, brief: s.brief, score_before: s.score, score_after: s.score, weakest_before: s.weakest, weakest_after: s.weakest, changed: false, panel_run_id: null })
          break
        }
        repairs++
        current = fixed
        panel = await runPanel({
          gate: 'idea', subjectTable: 'content_ideas', subjectId: idea.id,
          artifact: artifactOf(current),
          context: [corpusForChannel(corpus, idea.lane_slot || 'general'), `VOICE\n${voice.slice(0, 1500)}`].join('\n\n'),
          deterministic: deterministicFindings({ text: artifactOf(current), minChars: 80, checkVoice: true }),
          shortCircuitOnKill: true, idempotencyKey: randomUUID(),
        })
        const runId = dryRun ? null : await persistPanel(idea.id, panel)
        const before = s
        s = standing(panel.verdicts)
        if (runId) panelRunId = runId
        attempts.push({ n, brief: before.brief, score_before: before.score, score_after: s.score, weakest_before: before.weakest, weakest_after: s.weakest, changed: true, panel_run_id: runId })
      }

      const router = await route({ ...idea, ...current }, mandates)
      const ladder = {
        artifact_hash: artifactHash(artifactOf(current)),
        roster_version: ROSTER_VERSION,
        judged_at: new Date().toISOString(),
        first, final: { score: s.score, weakest: s.weakest, band: s.band },
        attempts,
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
      if (attempts.some(a => a.changed)) { patch.idea = current.idea; patch.thesis = current.thesis }
      // Never overwrite a subchannel a human chose. The router records its pick
      // either way and is graded on the disagreement.
      if (!idea.lane_slot && router?.winner && !router.contested.length) patch.lane_slot = router.winner

      if (s.band === 'weak') {
        patch.buried_at = new Date().toISOString()
        patch.buried_reason = `ladder: ${s.weakest || 'panel'} scored ${s.score ?? 'n/a'} after ${attempts.length} attempt(s)`
        buried++
      } else if (s.band === 'ready') ready++
      else escalated++

      if (!dryRun) {
        const { error: uErr } = await supabase.from('content_ideas').update(patch).eq('id', idea.id)
        if (uErr) console.warn(`[ladder] update failed for ${idea.id}: ${uErr.message}`)
      }

      results.push({
        id: idea.id, idea: current.idea.slice(0, 90),
        first_score: first.score, final_score: s.score, weakest: s.weakest, band: s.band,
        attempts: attempts.length, spread: panel.spread, dissent: panel.dissent,
        scores: Object.fromEntries(panel.verdicts.filter(v => !v.deterministic).map(v => [v.judge, v.score])),
        router: ladder.router, router_disagrees: ladder.router_disagrees,
      })
    }

    return res.json({ ok: true, dry_run: dryRun, judged, ready, escalated, buried, skipped, repairs, results })
  } catch (e: any) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) })
  }
}

export default withContentRun('judge_ladder', handler)
export const config = { maxDuration: 300 }
