import { randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { FeedbackEventV1Schema, PreferenceRuleV1Schema, SCHEMA_VERSION, type FeedbackEventV1, type PreferenceRuleV1, type StageName } from '@mindmake/contracts'
import { hashValue } from './hash.js'
import { studioPaths } from './paths.js'
import { analyzeLoudness, detectSceneCuts, framePerceptualHashes, probeMedia, transcribeMedia } from './media.js'
import { recordJobEvent } from './job-store.js'

export async function analyzeMediaArtifactForFeedback(repoRoot: string, path: string, outputDirectory: string, label: string): Promise<Record<string, unknown>> {
  const [probe, loudness, cuts, frameHashes] = await Promise.all([
    probeMedia(path),
    analyzeLoudness(path),
    detectSceneCuts(path),
    framePerceptualHashes(path),
  ])
  let transcript: unknown = null
  let transcriptStatus = 'complete'
  try {
    transcript = await transcribeMedia(repoRoot, path, join(outputDirectory, `${label}-transcript.json`), 'base.en')
  } catch { transcriptStatus = 'unavailable' }
  return {
    probe,
    loudness,
    scene_cuts_ms: cuts,
    frame_ahashes: frameHashes,
    transcript,
    transcript_status: transcriptStatus,
    caption_ocr_status: 'not_run; supply an SRT sidecar for exact caption comparison',
  }
}

interface FlatValue { path: string; value: unknown }

const rulesPath = (): string => join(studioPaths().runtimeRoot, 'learning', 'rules.json')

export async function listRules(): Promise<PreferenceRuleV1[]> {
  try { return PreferenceRuleV1Schema.array().parse(JSON.parse(await readFile(rulesPath(), 'utf8'))) }
  catch { return [] }
}

async function saveRules(rules: PreferenceRuleV1[]): Promise<void> {
  const path = rulesPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, `${JSON.stringify(rules, null, 2)}\n`, 'utf8')
}

function flatten(value: unknown, prefix = ''): FlatValue[] {
  if (Array.isArray(value)) return value.flatMap((child, index) => flatten(child, `${prefix}[${index}]`))
  if (value && typeof value === 'object') return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => flatten(child, prefix ? `${prefix}.${key}` : key))
  return [{ path: prefix || '$', value }]
}

export function diffArtifacts(before: unknown, after: unknown): FeedbackEventV1['delta_features'] {
  const left = new Map(flatten(before).map((item) => [item.path, item.value]))
  const right = new Map(flatten(after).map((item) => [item.path, item.value]))
  const keys = [...new Set([...left.keys(), ...right.keys()])].sort()
  return keys
    .filter((key) => hashValue(left.get(key)) !== hashValue(right.get(key)))
    .map((key) => ({ feature: key, before: left.get(key), after: right.get(key) }))
}

export function inferRationale(deltas: FeedbackEventV1['delta_features'], note?: string): { rationale: string; confidence: number } {
  if (note?.trim()) return { rationale: note.trim(), confidence: 1 }
  const paths = deltas.map((delta) => delta.feature).join(' ')
  if (/hook|start_ms|trim/i.test(paths)) return { rationale: 'You changed the opening or trim, so I infer that this version should reach the tension and proof sooner.', confidence: 0.72 }
  if (/caption|emphasis|text/i.test(paths)) return { rationale: 'You changed caption wording or emphasis, so I infer that readability and selective emphasis mattered more than verbatim density.', confidence: 0.68 }
  if (/crop|position|scale/i.test(paths)) return { rationale: 'You changed the framing, so I infer that presenter stability and composition mattered more than automatic movement.', confidence: 0.65 }
  if (/audio|volume|music|lufs/i.test(paths)) return { rationale: 'You changed the audio balance, so I infer that speech clarity should take priority over production energy.', confidence: 0.66 }
  if (/scene_cuts|frame_ahashes|duration_seconds/i.test(paths)) return { rationale: 'You changed trims or shot timing, so I infer that the accepted version needed a tighter visual rhythm or different proof timing.', confidence: 0.64 }
  if (/transcript|srt|edl|fcpxml/i.test(paths)) return { rationale: 'You changed spoken wording, captions, or the edit decision list, so I infer that the accepted version improved clarity or meaning at those exact points.', confidence: 0.7 }
  return { rationale: 'You changed this artifact, but the intent is ambiguous. Keep this as an observation until you confirm the reason.', confidence: 0.35 }
}

export interface CaptureFeedbackInput {
  jobId: string
  artifactId: string
  stage: StageName
  action: 'accept' | 'reject' | 'revise' | 'praise'
  before: unknown
  after?: unknown
  note?: string
  scope: FeedbackEventV1['scope']
}

export async function captureFeedback(input: CaptureFeedbackInput): Promise<FeedbackEventV1> {
  const deltas = input.after === undefined ? [] : diffArtifacts(input.before, input.after)
  const inference = inferRationale(deltas, input.note)
  const event = FeedbackEventV1Schema.parse({
    schema_version: SCHEMA_VERSION,
    feedback_id: randomUUID(),
    job_id: input.jobId,
    artifact_id: input.artifactId,
    stage: input.stage,
    action: input.action,
    before_hash: hashValue(input.before),
    ...(input.after === undefined ? {} : { after_hash: hashValue(input.after) }),
    delta_features: deltas,
    ...(input.note ? { user_note: input.note } : {}),
    inferred_rationale: inference.rationale,
    confidence: inference.confidence,
    scope: input.scope,
    confirmation: inference.confidence < 0.5 ? 'observation_only' : 'pending',
    occurred_at: new Date().toISOString(),
  })
  const path = join(studioPaths().runtimeRoot, 'learning', 'feedback.jsonl')
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify(event)}\n`, 'utf8')
  await recordJobEvent(input.jobId, 'feedback_recorded', { feedback_id: event.feedback_id, stage: event.stage, action: event.action, confirmation: event.confirmation })
  return event
}

export async function proposeRule(event: FeedbackEventV1): Promise<PreferenceRuleV1> {
  if (event.confirmation !== 'confirmed' && event.confirmation !== 'corrected') throw new Error('feedback must be confirmed before a rule can be proposed')
  const rules = await listRules()
  const existing = rules.find((item) => item.assertion.toLowerCase() === event.inferred_rationale.toLowerCase() && item.scope.level === event.scope.level && item.scope.key === event.scope.key && item.status !== 'retired')
  if (existing) {
    if (!existing.evidence_feedback_ids.includes(event.feedback_id)) existing.evidence_feedback_ids.push(event.feedback_id)
    await saveRules(rules)
    return existing
  }
  const rule = PreferenceRuleV1Schema.parse({
    schema_version: SCHEMA_VERSION,
    rule_id: randomUUID(),
    assertion: event.inferred_rationale,
    scope: event.scope,
    evidence_feedback_ids: [event.feedback_id],
    counterexamples: [],
    regression_cases: [`preserve approved behaviour for ${event.scope.level}:${event.scope.key}`],
    status: 'confirmed',
  })
  rules.push(rule)
  await saveRules(rules)
  return rule
}

async function feedbackJobs(feedbackIds: string[]): Promise<Set<string>> {
  const path = join(studioPaths().runtimeRoot, 'learning', 'feedback.jsonl')
  let rows: FeedbackEventV1[] = []
  try { rows = (await readFile(path, 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => FeedbackEventV1Schema.parse(JSON.parse(line))) }
  catch { rows = [] }
  return new Set(rows.filter((row) => feedbackIds.includes(row.feedback_id)).map((row) => row.job_id))
}

export async function broadenRule(ruleId: string, scope: PreferenceRuleV1['scope']): Promise<PreferenceRuleV1> {
  const rules = await listRules()
  const source = rules.find((rule) => rule.rule_id === ruleId)
  if (!source) throw new Error('preference rule not found')
  const jobs = await feedbackJobs(source.evidence_feedback_ids)
  if (source.evidence_feedback_ids.length < 3 || jobs.size < 2) throw new Error('broader scope requires three confirmed instances across at least two jobs')
  const broadened = PreferenceRuleV1Schema.parse({
    ...source,
    rule_id: randomUUID(),
    scope,
    status: 'eligible',
    approved_by: undefined,
    approved_at: undefined,
  })
  rules.push(broadened)
  await saveRules(rules)
  return broadened
}

const transitions: Record<PreferenceRuleV1['status'], PreferenceRuleV1['status'][]> = {
  observed: ['inferred', 'retired'],
  inferred: ['confirmed', 'retired'],
  confirmed: ['trial', 'retired'],
  trial: ['eligible', 'retired'],
  eligible: ['user_approved', 'retired'],
  user_approved: ['active', 'retired'],
  active: ['retired'],
  retired: [],
}

export async function promoteRule(ruleId: string, target: PreferenceRuleV1['status'], activeConfigPath: string, approvedBy?: string): Promise<PreferenceRuleV1> {
  const rules = await listRules()
  const index = rules.findIndex((rule) => rule.rule_id === ruleId)
  if (index < 0) throw new Error('preference rule not found')
  const rule = rules[index] as PreferenceRuleV1
  if (!transitions[rule.status].includes(target)) throw new Error(`invalid rule transition ${rule.status} -> ${target}`)
  if ((target === 'user_approved' || target === 'active') && !approvedBy?.trim()) throw new Error(`${target} requires --approved-by`)
  const updated = PreferenceRuleV1Schema.parse({
    ...rule,
    status: target,
    ...((target === 'user_approved' || target === 'active') ? { approved_by: approvedBy?.trim(), approved_at: new Date().toISOString() } : {}),
  })
  rules[index] = updated
  await saveRules(rules)
  if (target === 'active') {
    const config = JSON.parse(await readFile(activeConfigPath, 'utf8')) as { active_preferences?: Array<Record<string, unknown>> }
    const active = config.active_preferences || []
    if (!active.some((item) => item.rule_id === updated.rule_id)) active.push(updated)
    config.active_preferences = active
    await writeFile(activeConfigPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8')
    const jobs = await feedbackJobs(updated.evidence_feedback_ids)
    for (const jobId of jobs) await recordJobEvent(jobId, 'rule_promoted', { rule_id: updated.rule_id, status: updated.status, scope: updated.scope })
  }
  return updated
}

export async function confirmFeedback(event: FeedbackEventV1, correction?: string): Promise<FeedbackEventV1> {
  const confirmed = FeedbackEventV1Schema.parse({
    ...event,
    inferred_rationale: correction?.trim() || event.inferred_rationale,
    confidence: 1,
    confirmation: correction?.trim() ? 'corrected' : 'confirmed',
  })
  const path = join(studioPaths().runtimeRoot, 'learning', 'confirmations.jsonl')
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify({ feedback_id: event.feedback_id, confirmation: confirmed.confirmation, rationale: confirmed.inferred_rationale, occurred_at: new Date().toISOString() })}\n`, 'utf8')
  return confirmed
}
