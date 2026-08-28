import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { RadarFeedV1Schema, type RadarCandidateV1, type RadarFeedV1, type Series } from '@mindmake/contracts'
import { compareCorpusNovelty } from './indexer.js'

export interface RankedOpportunity {
  candidate: RadarCandidateV1
  series: Series
  editorial_eligible: boolean
  hard_blocks: string[]
  growth_score: number
  growth_dimensions: { first_beat_tension: number; clarity: number; surprise: number; payoff: number; visual_proof: number; share_save_value: number; qualified_fit: number; novelty: number }
  audience_problem: string
  why_now: string
  proposed_hook: string
  honest_payoff: string
  visual_proof: string
  source_mode: 'extract' | 'short_native'
  production_effort: 'low' | 'medium' | 'high'
  confidentiality_rights_risk: string
  novelty_note: string
  recommended_platform_treatment: string
  strongest_objection: string
  credible_contradiction: string
  safer_version: string
  stretch_version: string
  recommendation: string
}

const MONEY_TERMS = /\b(costs?|revenue|margin|pricing|enterprise|buyer|procurement|roi|economic|economics|market|company|workforce|budget|capital)\b/i
const BUILT_TERMS = /\b(build|ship|workflow|agent|tool|prototype|code|model|prompt|automation|operator|interface|product)\b/i

function fingerprint(candidate: RadarCandidateV1): string {
  const source = candidate.source_urls[0] || `${candidate.title} ${candidate.summary}`
  return source.toLowerCase().replace(/^https?:\/\/(www\.)?/, '').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120)
}

export function mergeRadarFeeds(feeds: RadarFeedV1[]): RadarCandidateV1[] {
  const byFingerprint = new Map<string, RadarCandidateV1>()
  for (const feed of feeds) {
    RadarFeedV1Schema.parse(feed)
    for (const candidate of feed.candidates) {
      const key = fingerprint(candidate)
      const existing = byFingerprint.get(key)
      if (!existing || candidate.corroboration > existing.corroboration) byFingerprint.set(key, candidate)
    }
  }
  return [...byFingerprint.values()]
}

function chooseSeries(candidate: RadarCandidateV1): Series {
  const body = `${candidate.title} ${candidate.summary} ${candidate.category}`
  const money = MONEY_TERMS.test(body)
  const built = BUILT_TERMS.test(body)
  if (money && !built) return 'money_of_ai'
  if (built && !money) return 'built_with_ai'
  return candidate.category.toLowerCase().includes('economic') ? 'money_of_ai' : 'built_with_ai'
}

function growthScore(candidate: RadarCandidateV1, nowMs: number): number {
  const ageHours = Math.max(0, nowMs - Date.parse(candidate.occurred_at)) / 3_600_000
  const freshness = 1 / (1 + ageHours / 72)
  const evidence = candidate.evidence_status === 'public_grounded' ? 1 : candidate.evidence_status === 'owned_grounded' ? 0.9 : 0.35
  const corroboration = Math.min(candidate.corroboration, 4) / 4
  const tension = /\b(but|instead|fails?|wrong|shift|replace|cost|risk|why|how)\b/i.test(`${candidate.title} ${candidate.summary}`) ? 1 : 0.55
  return Math.round((freshness * 25 + evidence * 30 + corroboration * 20 + tension * 15 + Math.min(1, candidate.summary.length / 180) * 10) * 10) / 10
}

export function rankRadarOpportunities(candidates: RadarCandidateV1[], now = new Date()): RankedOpportunity[] {
  return candidates
    .map((candidate) => {
      const series = chooseSeries(candidate)
      const hardBlocks: string[] = []
      if (candidate.sensitivity === 'internal_sanitized' && candidate.evidence_status === 'public_evidence_required') hardBlocks.push('public evidence required before scripting factual claims')
      if (candidate.source_urls.length === 0 && candidate.evidence_status === 'public_grounded') hardBlocks.push('public provenance missing')
      const hookLead = series === 'money_of_ai' ? 'The expensive part of AI is not the model.' : 'The useful part of this build is not the demo.'
      const objection = candidate.corroboration < 2 ? 'The signal may be a single-source announcement rather than a durable shift.' : 'The angle may be true but too familiar unless it includes an operator mechanism or artifact.'
      const publicEvidence = candidate.evidence_status === 'public_grounded'
      const dimensions = {
        first_beat_tension: /\b(but|instead|fails?|wrong|shift|replace|cost|risk|why|how)\b/i.test(`${candidate.title} ${candidate.summary}`) ? 0.9 : 0.55,
        clarity: candidate.summary.length >= 60 && candidate.summary.length <= 240 ? 0.82 : 0.58,
        surprise: /\b(not|instead|opposite|unexpected|shift)\b/i.test(`${candidate.title} ${candidate.summary}`) ? 0.84 : 0.56,
        payoff: candidate.summary.length >= 80 ? 0.8 : 0.6,
        visual_proof: candidate.source_urls.length ? 0.82 : 0.25,
        share_save_value: /\b(how|why|workflow|cost|risk|framework|mechanism)\b/i.test(`${candidate.title} ${candidate.summary}`) ? 0.82 : 0.57,
        qualified_fit: series === 'money_of_ai' ? 0.84 : 0.82,
        novelty: candidate.corroboration >= 3 ? 0.72 : 0.62,
      }
      return {
        candidate,
        series,
        editorial_eligible: hardBlocks.length === 0,
        hard_blocks: hardBlocks,
        growth_score: growthScore(candidate, now.getTime()),
        growth_dimensions: dimensions,
        audience_problem: series === 'money_of_ai' ? 'Leaders need to know which mechanism changes cost, control, or advantage.' : 'Builders need to know what changes in the actual workflow, not the launch copy.',
        why_now: `The source was observed ${candidate.occurred_at} and carries ${candidate.corroboration} corroborating source${candidate.corroboration === 1 ? '' : 's'}.`,
        proposed_hook: `${hookLead} ${candidate.title}`,
        honest_payoff: candidate.summary,
        visual_proof: candidate.source_urls.length ? 'Show the source, the operative claim, then the mechanism or working artifact.' : 'Acquire a public source or owned artifact before treatment approval.',
        source_mode: /build|workflow|tool|prototype/i.test(`${candidate.title} ${candidate.summary}`) ? 'short_native' : 'extract',
        production_effort: candidate.source_urls.length > 1 ? 'medium' : 'low',
        confidentiality_rights_risk: candidate.sensitivity === 'internal_sanitized' ? 'High until replaced with public evidence or explicitly approved case material.' : candidate.sensitivity === 'owned' ? 'Confirm consent and artifact rights at angle approval.' : 'Low for factual reference; third-party excerpts still require attribution and a recorded transformative purpose.',
        novelty_note: 'Compare this mechanism and hook against the indexed Mindmaker corpus before angle approval; the feed score is only a prior.',
        recommended_platform_treatment: series === 'money_of_ai' ? 'YouTube: mechanism-first evidence Short. LinkedIn: lead with the commercial consequence and one decision implication.' : 'YouTube: artifact-first build reveal. LinkedIn: lead with the operational change and the reusable lesson.',
        strongest_objection: objection,
        credible_contradiction: publicEvidence && candidate.corroboration >= 3 ? 'No credible contradiction found.' : 'The current evidence is too thin to claim there is no credible contradiction.',
        safer_version: `Explain only the verified mechanism behind: ${candidate.title}`,
        stretch_version: `Challenge the default interpretation of ${candidate.title} and prove the alternative with a concrete artifact.`,
        recommendation: hardBlocks.length ? 'Hold until the evidence block is cleared.' : 'Lead with the consequence, prove the mechanism in the first half, and end on the operational implication.',
      } satisfies RankedOpportunity
    })
    .sort((a, b) => b.growth_score - a.growth_score)
}

export function selectWeeklyBrief(ranked: RankedOpportunity[]): RankedOpportunity[] {
  const money = ranked.filter((item) => item.series === 'money_of_ai').slice(0, 3)
  const built = ranked.filter((item) => item.series === 'built_with_ai').slice(0, 3)
  const selected = new Set([...money, ...built].map((item) => item.candidate.id))
  const stretch = ranked.filter((item) => !selected.has(item.candidate.id)).slice(0, 2)
  return [...money, ...built, ...stretch]
}

export async function applyCorpusNovelty(ranked: RankedOpportunity[]): Promise<RankedOpportunity[]> {
  const annotated = await Promise.all(ranked.map(async (item) => {
    const result = await compareCorpusNovelty(`${item.candidate.title} ${item.candidate.summary}`)
    return {
      ...item,
      growth_score: Math.round(Math.max(0, Math.min(100, item.growth_score + (result.novelty - 0.5) * 10)) * 10) / 10,
      growth_dimensions: { ...item.growth_dimensions, novelty: result.novelty },
      novelty_note: result.nearest_candidate_id
        ? `Corpus novelty ${result.novelty.toFixed(2)}; nearest prior candidate ${result.nearest_candidate_id} at similarity ${result.similarity.toFixed(2)}.`
        : 'No indexed prior candidate was available; novelty remains an uncalibrated prior.',
    }
  }))
  return annotated.sort((left, right) => right.growth_score - left.growth_score)
}

export async function loadRadarFeed(path: string): Promise<RadarFeedV1> {
  return RadarFeedV1Schema.parse(JSON.parse(await readFile(path, 'utf8')))
}

export async function fetchRadarFeed(url: string, token: string): Promise<RadarFeedV1> {
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}`, accept: 'application/json' }, signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new Error(`radar provider returned ${response.status}`)
  return RadarFeedV1Schema.parse(await response.json())
}

export function sourceReferenceHash(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
