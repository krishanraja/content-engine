import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { RadarFeedV1Schema, type RadarCandidateV1, type RadarFeedV1 } from '@mindmake/contracts'

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
