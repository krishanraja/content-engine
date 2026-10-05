import {
  ArtDirectorRepertoireV1Schema,
  DeviceLearningProposalV1Schema,
  DeviceSelectionTraceV1Schema,
  DeviceUsageEventV1Schema,
  type ArtDirectorRepertoireV1,
  type DeviceInventionProposalV1,
  type DeviceLearningProposalV1,
  type DeviceSelectionCandidateV1,
  type DeviceSelectionTraceV1,
  type DeviceUsageEventV1,
  type VisualDeviceDefinitionV1,
  type VisualNarrativeJobV1,
  seriesEligible,
  type StudioSeries,
} from '@mindmake/contracts'
import { createHash, randomUUID } from 'node:crypto'
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export interface DeviceSelectionContextV1 {
  traceId: string
  beatId: string
  series: StudioSeries
  sourceMode: 'extract' | 'solo' | 'short_native'
  editorialFormat?: string
  narrativeFunction: string
  viewerTask: string
  narrativeJob: VisualNarrativeJobV1
  treatmentLane: 'restrained' | 'premium' | 'experimental'
  availableInputs: string[]
  proofRequired: boolean
  preferredTechniqueIds?: string[]
  recentlyUsedTechniqueIds?: string[]
  prohibitedTechniqueIds?: string[]
  registryHash?: string
  inventionBrief?: { name: string; mechanism: string }
}

export interface VisualRecipeContextV1 {
  series: StudioSeries
  editorialFormat?: string
  treatmentLane: 'restrained' | 'premium' | 'experimental'
  availableInputs: string[]
  recentUseCount?: number
}

export function resolveVisualRecipe(repertoireInput: ArtDirectorRepertoireV1, recipeId: string, context: VisualRecipeContextV1) {
  const repertoire = ArtDirectorRepertoireV1Schema.parse(repertoireInput)
  const recipe = repertoire.recipes.find((item) => item.recipe_id === recipeId)
  if (!recipe) throw new Error(`unknown visual recipe ${recipeId}`)
  const available = new Set(context.availableInputs)
  const hardRejections: string[] = []
  if (!seriesEligible(recipe.eligible_series, context.series)) hardRejections.push(`not eligible for ${context.series}`)
  if (recipe.eligible_formats.length && (!context.editorialFormat || !recipe.eligible_formats.includes(context.editorialFormat))) hardRejections.push('not eligible for this editorial format')
  const missing = recipe.required_inputs.filter((input) => !available.has(input))
  if (missing.length) hardRejections.push(`missing inputs: ${missing.sort().join(', ')}`)
  if (!Number.isInteger(context.recentUseCount || 0) || (context.recentUseCount || 0) < 0) throw new Error('recent recipe use count must be a non-negative integer')
  if ((context.recentUseCount || 0) >= recipe.recurrence_cap_jobs) hardRejections.push(`recurrence cap reached: ${recipe.recurrence_cap_jobs} recent jobs`)
  if (recipe.experimental && context.treatmentLane !== 'experimental') hardRejections.push('experimental recipe requires the experimental treatment lane')
  const devices = new Map(repertoire.techniques.map((device) => [device.technique_id, device]))
  return {
    recipe_id: recipe.recipe_id,
    recipe_version: recipe.version,
    eligible: hardRejections.length === 0,
    hard_rejections: hardRejections,
    recurrence_cap_jobs: recipe.recurrence_cap_jobs,
    recent_use_count: context.recentUseCount || 0,
    steps: recipe.device_sequence.map((techniqueId, index) => {
      const device = devices.get(techniqueId)!
      return {
        step: index + 1,
        technique_id: device.technique_id,
        name: device.name,
        narrative_jobs: device.narrative_jobs,
        fallback: device.fallback,
      }
    }),
    fallback: recipe.fallback,
  }
}

function applies(values: string[], value: string | undefined): boolean {
  return values.length === 0 || Boolean(value && values.includes(value))
}

function hardRejections(device: VisualDeviceDefinitionV1, context: DeviceSelectionContextV1): string[] {
  const issues: string[] = []
  const available = new Set(context.availableInputs)
  if (!seriesEligible(device.eligibility.series, context.series)) issues.push(`not eligible for ${context.series}`)
  if (!device.eligibility.source_modes.includes(context.sourceMode)) issues.push(`not eligible for ${context.sourceMode}`)
  if (!applies(device.eligibility.editorial_formats, context.editorialFormat)) issues.push('not eligible for this editorial format')
  if (!applies(device.eligibility.narrative_functions, context.narrativeFunction)) issues.push('not eligible for this narrative function')
  if (!applies(device.eligibility.viewer_tasks, context.viewerTask)) issues.push('not eligible for this viewer task')
  const missing = [...device.required_inputs, ...device.eligibility.requires].filter((input) => !available.has(input))
  if (missing.length) issues.push(`missing inputs: ${[...new Set(missing)].sort().join(', ')}`)
  if (device.experimental && context.treatmentLane !== 'experimental') issues.push('experimental device requires the experimental treatment lane')
  if (context.prohibitedTechniqueIds?.includes(device.technique_id)) issues.push('explicitly prohibited for this plan')
  return issues
}

function scoreDevice(device: VisualDeviceDefinitionV1, context: DeviceSelectionContextV1) {
  const preferred = new Set(context.preferredTechniqueIds || [])
  const recent = new Set(context.recentlyUsedTechniqueIds || [])
  const narrative_fit = Math.min(30, 18
    + (device.narrative_jobs.includes(context.narrativeJob) ? 8 : 0)
    + (applies(device.eligibility.narrative_functions, context.narrativeFunction) ? 2 : 0)
    + (applies(device.eligibility.viewer_tasks, context.viewerTask) ? 2 : 0))
  const proof_value = context.proofRequired
    ? device.narrative_jobs.includes('prove') ? 25 : device.narrative_jobs.includes('explain') ? 12 : 3
    : device.narrative_jobs.includes('prove') ? 12 : 18
  const available_coverage = 20
  const series_format_fit = Math.min(10,
    (seriesEligible(device.eligibility.series, context.series) ? 5 : 0)
    + (applies(device.eligibility.editorial_formats, context.editorialFormat) ? 3 : 0)
    + (preferred.has(device.technique_id) ? 2 : 0))
  const novelty = recent.has(device.technique_id) ? 2 : 10
  const cost_risk = device.experimental ? 1 : device.cost_class === 'local' ? 5 : device.cost_class === 'hybrid' ? 3 : 2
  return {
    narrative_fit,
    proof_value,
    available_coverage,
    series_format_fit,
    novelty,
    cost_risk,
    total: narrative_fit + proof_value + available_coverage + series_format_fit + novelty + cost_risk,
  }
}

function inventionProposal(context: DeviceSelectionContextV1, fallbackTechniqueId: string): DeviceInventionProposalV1 {
  const digest = createHash('sha256').update(JSON.stringify({ beat: context.beatId, job: context.narrativeJob, mechanism: context.inventionBrief?.mechanism || '' })).digest('hex').slice(0, 12)
  return {
    proposal_id: `invent_${digest}`,
    beat_id: context.beatId,
    name: context.inventionBrief?.name || `New ${context.narrativeJob} device`,
    narrative_job: context.narrativeJob,
    gap: `No eligible existing device met the repertoire threshold for ${context.viewerTask}.`,
    mechanism: context.inventionBrief?.mechanism || 'Art-direct one bounded visual mechanism that performs the narrative job without becoming decorative spectacle.',
    fallback_technique_id: fallbackTechniqueId,
    treatment_lane: 'experimental',
    requires_styleframes: true,
    requires_animatic: true,
    approval_state: 'proposed',
  }
}

export function selectDevicesForBeat(repertoireInput: ArtDirectorRepertoireV1, context: DeviceSelectionContextV1): DeviceSelectionTraceV1 {
  const repertoire = ArtDirectorRepertoireV1Schema.parse(repertoireInput)
  const candidates: DeviceSelectionCandidateV1[] = repertoire.techniques.map((device) => {
    const rejections = hardRejections(device, context)
    const score = rejections.length ? null : scoreDevice(device, context)
    return {
      technique_id: device.technique_id,
      eligible: rejections.length === 0,
      hard_rejections: rejections,
      score,
      rationale: rejections.length
        ? rejections.join('; ')
        : `${device.name} scores ${score!.total} for ${context.narrativeJob}, proof, available coverage, series fit, novelty and production risk.`,
    }
  }).sort((left, right) => {
    if (left.eligible !== right.eligible) return left.eligible ? -1 : 1
    const scoreDelta = (right.score?.total || 0) - (left.score?.total || 0)
    return scoreDelta || left.technique_id.localeCompare(right.technique_id)
  })

  const credible = candidates.filter((candidate) => candidate.eligible && candidate.score!.total >= repertoire.selection_policy.minimum_score)
  const primary = credible[0]?.technique_id || null
  const selectedDevice = primary ? repertoire.techniques.find((device) => device.technique_id === primary) : undefined
  const support: string[] = []
  let signatureCount = selectedDevice?.signature ? 1 : 0
  let experimentalCount = selectedDevice?.experimental ? 1 : 0
  for (const candidate of credible.slice(1)) {
    const device = repertoire.techniques.find((item) => item.technique_id === candidate.technique_id)!
    if (device.signature && signatureCount >= repertoire.selection_policy.maximum_signature_devices_per_short) continue
    if (device.experimental && experimentalCount >= repertoire.selection_policy.maximum_experimental_devices_per_short) continue
    support.push(candidate.technique_id)
    if (device.signature) signatureCount += 1
    if (device.experimental) experimentalCount += 1
    if (support.length >= repertoire.selection_policy.maximum_support_devices) break
  }
  const safeFallback = candidates.find((candidate) => candidate.technique_id === 'stable-semantic-crop' && candidate.eligible)?.technique_id
    || candidates.find((candidate) => candidate.eligible && !repertoire.techniques.find((device) => device.technique_id === candidate.technique_id)?.experimental)?.technique_id
    || repertoire.techniques[0]!.technique_id
  const invention = primary ? null : inventionProposal(context, safeFallback)

  return DeviceSelectionTraceV1Schema.parse({
    schema_version: 1,
    trace_id: context.traceId,
    beat_id: context.beatId,
    registry_id: repertoire.registry_id,
    registry_version: repertoire.version,
    ...(context.registryHash ? { registry_hash: context.registryHash } : {}),
    policy_version: 'art-director-v1',
    threshold: repertoire.selection_policy.minimum_score,
    candidates,
    selected_primary: primary,
    selected_support: support,
    fallback_technique_id: safeFallback,
    invention,
    rationale: primary
      ? `Selected ${primary} as the strongest eligible device. Support is capped at two and tied choices resolve by stable device ID.`
      : 'No existing device cleared the threshold. One experimental invention proposal was created for review and cannot enter treatment without Krish approval.',
  })
}

export function validateShortDeviceSelections(repertoireInput: ArtDirectorRepertoireV1, traces: DeviceSelectionTraceV1[]): string[] {
  const repertoire = ArtDirectorRepertoireV1Schema.parse(repertoireInput)
  const parsed = traces.map((trace) => DeviceSelectionTraceV1Schema.parse(trace))
  const issues: string[] = []
  const selected = parsed.flatMap((trace) => [trace.selected_primary, ...trace.selected_support].filter((id): id is string => Boolean(id)))
  const definitions = new Map(repertoire.techniques.map((device) => [device.technique_id, device]))
  const signatures = selected.filter((id) => definitions.get(id)?.signature)
  const experimental = selected.filter((id) => definitions.get(id)?.experimental)
  const inventions = parsed.filter((trace) => trace.invention)
  if (signatures.length > repertoire.selection_policy.maximum_signature_devices_per_short) issues.push('a Short may use at most one signature hero device')
  if (experimental.length + inventions.length > repertoire.selection_policy.maximum_experimental_devices_per_short) issues.push('a Short may use at most one experimental or invented device')
  if (inventions.some((trace) => trace.invention?.approval_state !== 'approved')) issues.push('invented devices cannot enter treatment before exact Krish approval')
  return issues
}

export async function loadArtDirectorRepertoire(path: string): Promise<ArtDirectorRepertoireV1> {
  return ArtDirectorRepertoireV1Schema.parse(JSON.parse(await readFile(path, 'utf8')))
}

export async function appendDeviceUsageEvent(path: string, eventInput: DeviceUsageEventV1): Promise<DeviceUsageEventV1> {
  const event = DeviceUsageEventV1Schema.parse(eventInput)
  await mkdir(dirname(path), { recursive: true })
  await appendFile(path, `${JSON.stringify(event)}\n`, 'utf8')
  return event
}

export function createDeviceUsageEvent(input: Omit<DeviceUsageEventV1, 'schema_version' | 'event_id' | 'occurred_at'> & { eventId?: string; occurredAt?: string }): DeviceUsageEventV1 {
  const { eventId, occurredAt, ...event } = input
  return DeviceUsageEventV1Schema.parse({
    ...event,
    schema_version: 1,
    event_id: eventId || randomUUID(),
    occurred_at: occurredAt || new Date().toISOString(),
  })
}

export function inferDevicePreference(eventInput: DeviceUsageEventV1): { assertion: string; confidence: number; activation_allowed: false } {
  const event = DeviceUsageEventV1Schema.parse(eventInput)
  const replacement = event.replacement_technique_id ? ` in favour of ${event.replacement_technique_id}` : ''
  const reason = event.reason ? ` because ${event.reason}` : ''
  return {
    assertion: `You ${event.action} ${event.technique_id}${replacement}${reason}. I infer this preference only for ${event.scope.level} ${event.scope.key} until you confirm or correct it.`,
    confidence: event.evidence_strength === 'strong' ? 0.86 : 0.46,
    activation_allowed: false,
  }
}

function learningKey(event: DeviceUsageEventV1): string {
  return [event.technique_id, event.action, event.replacement_technique_id || '', event.scope.level, event.scope.key, event.reason?.trim().toLowerCase() || ''].join('|')
}

function learningAssertion(event: DeviceUsageEventV1): string {
  const replacement = event.replacement_technique_id ? ` with ${event.replacement_technique_id}` : ''
  const reason = event.reason ? ` because ${event.reason}` : ''
  const verbs: Record<DeviceUsageEventV1['action'], string> = {
    proposed: 'consider',
    approved: 'prefer',
    replaced: 'replace',
    removed: 'avoid',
    shortened: 'shorten',
    repositioned: 'reposition',
    praised: 'prefer',
    rejected: 'avoid',
  }
  return `For ${event.scope.level} ${event.scope.key}, ${verbs[event.action]} ${event.technique_id}${replacement}${reason}.`
}

export function aggregateDeviceLearning(eventInputs: DeviceUsageEventV1[]): DeviceLearningProposalV1[] {
  const events = eventInputs.map((event) => DeviceUsageEventV1Schema.parse(event))
  const groups = new Map<string, DeviceUsageEventV1[]>()
  for (const event of events) {
    if (event.action === 'proposed' || event.confirmation === 'observed') continue
    const key = learningKey(event)
    groups.set(key, [...(groups.get(key) || []), event])
  }

  return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([key, supporting]) => {
    const exemplar = supporting[0]!
    const jobs = new Set(supporting.map((event) => event.job_id))
    const sessions = new Set(supporting.map((event) => event.session_id))
    const contraryActions = new Set(exemplar.action === 'approved' || exemplar.action === 'praised'
      ? ['removed', 'rejected', 'replaced']
      : ['approved', 'praised'])
    const counterexamples = events.filter((event) =>
      event.technique_id === exemplar.technique_id
      && event.scope.level === exemplar.scope.level
      && event.scope.key === exemplar.scope.key
      && contraryActions.has(event.action),
    )
    const narrowCorrection = supporting.some((event) =>
      event.confirmation === 'corrected'
      && event.evidence_strength === 'strong'
      && ['job', 'treatment'].includes(event.scope.level),
    )
    const repeatedPattern = supporting.length >= 3 && jobs.size >= 2 && sessions.size >= 2
    const eligible = counterexamples.length === 0 && (narrowCorrection || repeatedPattern)
    const proposalHash = createHash('sha256').update(key).digest('hex').slice(0, 16)
    return DeviceLearningProposalV1Schema.parse({
      schema_version: 1,
      proposal_id: `device_rule_${proposalHash}`,
      technique_id: exemplar.technique_id,
      action: exemplar.action,
      ...(exemplar.replacement_technique_id ? { replacement_technique_id: exemplar.replacement_technique_id } : {}),
      scope: exemplar.scope,
      assertion: learningAssertion(exemplar),
      supporting_event_ids: supporting.map((event) => event.event_id).sort(),
      counterexample_event_ids: counterexamples.map((event) => event.event_id).sort(),
      independent_job_count: jobs.size,
      independent_session_count: sessions.size,
      lifecycle_state: eligible ? 'eligible' : 'observed',
      eligibility_reason: eligible
        ? narrowCorrection
          ? 'A strong, explicitly corrected preference is eligible only at its narrow job or treatment scope.'
          : 'The same confirmed preference appeared at least three times across at least two jobs and two sessions with no counterexample.'
        : counterexamples.length
          ? 'Contrary evidence exists, so the pattern remains an observation.'
          : 'The pattern needs three confirmed events across at least two jobs and two sessions before broader promotion.',
      requires_krish_approval: true,
      activation_allowed: false,
    })
  })
}

export async function loadDeviceUsageLedger(path: string): Promise<DeviceUsageEventV1[]> {
  const content = await readFile(path, 'utf8')
  return content.split(/\r?\n/).filter(Boolean).map((line) => DeviceUsageEventV1Schema.parse(JSON.parse(line)))
}
