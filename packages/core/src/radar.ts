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

const GENERIC_HEADLINE = /^(how to\b|a guide to\b|guide:\s|\d+\s+(ways|strategies|tips|steps|tools)\b|best\s+\w+\s+for\b)|\b(ultimate guide|everything you need to know)\b/i
const PERSONNEL_HEADLINE = /\b(appoints?|hires?|names?|promotes?)\b.{0,45}\b(executive|chief|ceo|cto|cfo|president|leader|head)\b|\b(executive|chief|ceo|cto|cfo|president)\b.{0,45}\b(joins?|appointed|hired|named|promoted)\b/i
const LOW_AUTHORITY_HOST = /(^|\.)(slashdot\.org|reddit\.com|medium\.com|quora\.com)$/i
const PRIMARY_AUTHORITY_HOST = /(^|\.)(gov\.uk|europa\.eu|sec\.gov|justice\.gov|supremecourt\.gov|blog\.google|openai\.com|anthropic\.com|microsoft\.com|github\.com|huggingface\.co)$/i

function sourceHost(candidate: RadarCandidateV1): string | undefined {
  try { return new URL(candidate.source_urls[0] || '').hostname.toLowerCase() }
  catch { return undefined }
}

function normalizedText(value: string): string {
  return value.toLowerCase().replace(/&(?:#x?[a-f0-9]+|[a-z]+);/gi, ' ').replace(/[^a-z0-9]+/g, ' ').trim()
}

export function radarEditorialQualityBlocks(candidate: RadarCandidateV1, now = new Date()): string[] {
  const blocks: string[] = []
  if (candidate.source_kind !== 'public_signal') return blocks
  const host = sourceHost(candidate)
  const ageHours = Math.max(0, now.getTime() - Date.parse(candidate.occurred_at)) / 3_600_000
  const normalizedTitle = normalizedText(candidate.title)
  const normalizedSummary = normalizedText(candidate.summary)
  if (ageHours > 72) blocks.push('weekly news candidate is older than 72 hours')
  if (GENERIC_HEADLINE.test(candidate.title)) blocks.push('generic guide, listicle or service headline is not eligible for the weekly news brief')
  if (PERSONNEL_HEADLINE.test(candidate.title)) blocks.push('personnel appointment is not an opportunity without a specific operating or commercial consequence')
  if (!host) blocks.push('public source URL is missing or invalid')
  else if (LOW_AUTHORITY_HOST.test(host)) blocks.push('aggregator or discussion surface is not acceptable headline evidence')
  if (candidate.corroboration < 2 && (!host || !PRIMARY_AUTHORITY_HOST.test(host))) blocks.push('single-source public signal requires primary-authority evidence or independent corroboration')
  if (normalizedSummary.length < 45 || normalizedSummary === normalizedTitle || /https?\s|twitter com|&#x/i.test(candidate.summary)) blocks.push('summary does not state a specific, intelligible consequence')
  return blocks
}

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
    .flatMap((candidate) => (['money_of_ai', 'built_with_ai'] as const).map((series) => {
      const hardBlocks: string[] = []
      if (candidate.sensitivity === 'internal_sanitized' && candidate.evidence_status === 'public_evidence_required') hardBlocks.push('public evidence required before scripting factual claims')
      if (candidate.source_urls.length === 0 && candidate.evidence_status === 'public_grounded') hardBlocks.push('public provenance missing')
      hardBlocks.push(...radarEditorialQualityBlocks(candidate, now))
      hardBlocks.push('raw radar signal requires an approved Control Center editorial opportunity before production')
      const objection = candidate.corroboration < 2 ? 'The signal may be a single-source announcement rather than a durable shift.' : 'The eventual angle may still be too familiar unless it establishes a specific mechanism and useful proof.'
      const dimensions = {
        first_beat_tension: 0,
        clarity: 0,
        surprise: 0,
        payoff: 0,
        visual_proof: candidate.source_urls.length ? 0.5 : 0,
        share_save_value: 0,
        qualified_fit: 0,
        novelty: 0,
      }
      return {
        candidate,
        series,
        editorial_eligible: false,
        hard_blocks: hardBlocks,
        growth_score: growthScore(candidate, now.getTime()),
        growth_dimensions: dimensions,
        audience_problem: series === 'money_of_ai' ? 'Control Center must establish a second-order commercial or labour mechanism.' : 'Control Center must establish a specific workflow, implementation or artifact mechanism.',
        why_now: `The signal was observed ${candidate.occurred_at} and carries ${candidate.corroboration} corroborating source${candidate.corroboration === 1 ? '' : 's'}.`,
        proposed_hook: 'Pending approved Control Center editorial development.',
        honest_payoff: 'Pending approved Control Center editorial development.',
        visual_proof: candidate.source_urls.length ? 'Source evidence is available for Control Center to assess.' : 'Public or approved owned evidence is still required.',
        source_mode: 'extract',
        production_effort: candidate.source_urls.length > 1 ? 'medium' : 'low',
        confidentiality_rights_risk: candidate.sensitivity === 'internal_sanitized' ? 'High until replaced with public evidence or explicitly approved case material.' : candidate.sensitivity === 'owned' ? 'Confirm consent and artifact rights during editorial approval.' : 'Third-party excerpts require attribution and a recorded transformative purpose.',
        novelty_note: 'Novelty is not scored until Control Center has produced a concrete angle.',
        recommended_platform_treatment: 'No production treatment is selected from a raw signal.',
        strongest_objection: objection,
        credible_contradiction: 'Contradiction is assessed against the developed angle, not the source event.',
        safer_version: 'Return the signal to Control Center and develop the narrowest evidence-backed angle.',
        stretch_version: 'Return the signal to Control Center and test a more ambitious mechanism without exceeding the evidence.',
        recommendation: 'Do not produce this signal. Wait for an approved ProductionBriefV1 from Control Center.',
      } satisfies RankedOpportunity
    }))
    .sort((a, b) => Number(b.editorial_eligible) - Number(a.editorial_eligible) || b.growth_score - a.growth_score)
}

export function selectWeeklyBrief(ranked: RankedOpportunity[]): RankedOpportunity[] {
  const eligible = ranked.filter((item) => item.editorial_eligible)
  const money = eligible.filter((item) => item.series === 'money_of_ai').slice(0, 3)
  const built = eligible.filter((item) => item.series === 'built_with_ai').slice(0, 3)
  const selected = new Set([...money, ...built].map((item) => item.candidate.id))
  const stretch = eligible.filter((item) => !selected.has(item.candidate.id)).slice(0, 2)
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
