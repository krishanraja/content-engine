import type { CameraKeyframeV1, CameraPlanV1, NarrativeBeatV1, SourceVisualAnalysisV1 } from '@mindmake/contracts'

interface NormalizedBounds { x: number; y: number; width: number; height: number }
interface BoundsSample { at_ms: number; bounds: NormalizedBounds; confidence: number }
interface TimedDirection { track_id?: string; start_ms: number; end_ms: number; direction?: string; confidence?: number; target?: { x?: number; y?: number } }

export interface VirtualCameraPolicy {
  outputWidth: number
  outputHeight: number
  sampleIntervalMs: number
  minimumConfidence: number
  qualityFloor: number
  absoluteMaxZoom: number
  subjectZoom: number
  emphasisZoom: number
  leadRoomFraction: number
  eyeLine: number
  maximumPanPerSecond: number
  maximumZoomPerSecond: number
  jitterThreshold: number
  smoothing: number
}

export interface VirtualCameraSolveInput {
  analysis: SourceVisualAnalysisV1
  beat: NarrativeBeatV1
  sourceId: string
  subjectTrackIds?: string[]
  policy?: Partial<VirtualCameraPolicy>
}

export interface VirtualCameraSolution {
  source_id: string
  subject_track_ids: string[]
  keyframes: CameraKeyframeV1[]
  confidence: number
  fallback_used: boolean
  reset_at_ms: number[]
  lead_room: 'left' | 'right' | 'none'
  maximum_safe_zoom: number
  rationale: string[]
}

export type CameraPlanTemplate = Omit<CameraPlanV1, 'keyframes' | 'confidence'>

const DEFAULT_POLICY: VirtualCameraPolicy = {
  outputWidth: 1080, outputHeight: 1920, sampleIntervalMs: 250, minimumConfidence: 0.58, qualityFloor: 0.9, absoluteMaxZoom: 1.5, subjectZoom: 1.08, emphasisZoom: 1.18, leadRoomFraction: 0.12, eyeLine: 0.34, maximumPanPerSecond: 0.24, maximumZoomPerSecond: 0.18, jitterThreshold: 0.008, smoothing: 0.45,
}

function clamp(value: number, minimum: number, maximum: number): number { return Math.min(maximum, Math.max(minimum, value)) }
function rounded(value: number): number { return Number(value.toFixed(6)) }
function smoothstep(value: number): number { const bounded = clamp(value, 0, 1); return bounded * bounded * (3 - 2 * bounded) }

function baseCropForSource(width: number, height: number, outputWidth: number, outputHeight: number): NormalizedBounds {
  const sourceAspect = width / height
  const outputAspect = outputWidth / outputHeight
  if (sourceAspect > outputAspect) {
    const cropWidth = outputAspect / sourceAspect
    return { x: (1 - cropWidth) / 2, y: 0, width: cropWidth, height: 1 }
  }
  const cropHeight = sourceAspect / outputAspect
  return { x: 0, y: (1 - cropHeight) / 2, width: 1, height: cropHeight }
}

function maximumSafeZoom(baseCrop: NormalizedBounds, sourceWidth: number, sourceHeight: number, policy: VirtualCameraPolicy): number {
  const horizontal = baseCrop.width * sourceWidth / (policy.outputWidth * policy.qualityFloor)
  const vertical = baseCrop.height * sourceHeight / (policy.outputHeight * policy.qualityFloor)
  return Math.max(1, Math.min(policy.absoluteMaxZoom, horizontal, vertical))
}

function interpolateBounds(samples: readonly BoundsSample[], atMs: number): BoundsSample | null {
  if (!samples.length) return null
  const ordered = [...samples].sort((left, right) => left.at_ms - right.at_ms)
  const before = [...ordered].reverse().find((sample) => sample.at_ms <= atMs)
  const after = ordered.find((sample) => sample.at_ms >= atMs)
  if (!before) return after ?? null
  if (!after) return before
  if (after.at_ms === before.at_ms) return before
  const progress = (atMs - before.at_ms) / (after.at_ms - before.at_ms)
  const between = (left: number, right: number) => left + (right - left) * progress
  return { at_ms: atMs, bounds: { x: between(before.bounds.x, after.bounds.x), y: between(before.bounds.y, after.bounds.y), width: between(before.bounds.width, after.bounds.width), height: between(before.bounds.height, after.bounds.height) }, confidence: between(before.confidence, after.confidence) }
}

function unionBounds(samples: BoundsSample[]): BoundsSample | null {
  if (!samples.length) return null
  const left = Math.min(...samples.map((sample) => sample.bounds.x))
  const top = Math.min(...samples.map((sample) => sample.bounds.y))
  const right = Math.max(...samples.map((sample) => sample.bounds.x + sample.bounds.width))
  const bottom = Math.max(...samples.map((sample) => sample.bounds.y + sample.bounds.height))
  return { at_ms: samples[0]!.at_ms, bounds: { x: left, y: top, width: right - left, height: bottom - top }, confidence: samples.reduce((total, sample) => total + sample.confidence, 0) / samples.length }
}

function directionFrom(value: unknown): 'left' | 'right' | 'none' {
  const direction = String(value ?? '').toLowerCase()
  if (direction.includes('left')) return 'left'
  if (direction.includes('right')) return 'right'
  return 'none'
}

function chooseSubjects(input: VirtualCameraSolveInput, sourceStartMs: number, sourceEndMs: number): SourceVisualAnalysisV1['subjects'] {
  const available = input.analysis.subjects.filter((track) => track.source_id === input.sourceId && track.end_ms >= sourceStartMs && track.start_ms <= sourceEndMs)
  if (input.subjectTrackIds?.length) {
    const requested = new Set(input.subjectTrackIds)
    return available.filter((track) => requested.has(track.track_id))
  }
  const targetId = input.beat.primary_attention_target.target_id
  if (targetId) {
    const target = available.find((track) => track.track_id === targetId)
    if (target) return [target]
  }
  const midpoint = sourceStartMs + (sourceEndMs - sourceStartMs) / 2
  const activeSpeakers = input.analysis.active_speakers as unknown as Array<{ track_id?: string; source_id?: string; start_ms: number; end_ms: number; confidence: number }>
  const active = activeSpeakers.filter((speaker) => (!speaker.source_id || speaker.source_id === input.sourceId) && speaker.start_ms <= midpoint && speaker.end_ms >= midpoint).sort((left, right) => right.confidence - left.confidence)[0]
  if (active?.track_id) {
    const activeTrack = available.find((track) => track.track_id === active.track_id)
    if (activeTrack) return [activeTrack]
  }
  const requestedKind = String(input.beat.primary_attention_target.kind)
  if (/guest/i.test(requestedKind)) {
    const guest = available.find((track) => track.role === 'guest')
    if (guest) return [guest]
  }
  const krish = available.find((track) => track.role === 'krish')
  return krish ? [krish] : available.slice(0, 1)
}

function subjectAnchor(tracks: SourceVisualAnalysisV1['subjects'], sourceAtMs: number): BoundsSample | null {
  const samples = tracks.flatMap((track) => {
    const face = interpolateBounds(track.face_keyframes as readonly BoundsSample[], sourceAtMs)
    if (face) return [face]
    const body = interpolateBounds(track.body_keyframes as readonly BoundsSample[], sourceAtMs)
    return body ? [body] : []
  })
  return unionBounds(samples)
}

function activeDirection(analysis: SourceVisualAnalysisV1, trackIds: Set<string>, sourceAtMs: number, minimumConfidence: number): { direction: 'left' | 'right' | 'none'; target?: { x: number; y: number }; confidence: number } {
  const gestures = analysis.gestures as unknown as TimedDirection[]
  const gesture = gestures.filter((item) => (!item.track_id || trackIds.has(item.track_id)) && item.start_ms <= sourceAtMs && item.end_ms >= sourceAtMs && (item.confidence ?? 0) >= minimumConfidence).sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0))[0]
  if (gesture) {
    const target = gesture.target
    return { direction: directionFrom(gesture.direction), ...(target && Number.isFinite(target.x) && Number.isFinite(target.y) ? { target: { x: clamp(target.x!, 0, 1), y: clamp(target.y!, 0, 1) } } : {}), confidence: gesture.confidence ?? 0 }
  }
  const gazes = analysis.gaze as unknown as TimedDirection[]
  const gaze = gazes.filter((item) => (!item.track_id || trackIds.has(item.track_id)) && item.start_ms <= sourceAtMs && item.end_ms >= sourceAtMs && (item.confidence ?? 0) >= minimumConfidence).sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0))[0]
  return { direction: directionFrom(gaze?.direction), confidence: gaze?.confidence ?? 0 }
}

function impactBeat(beat: NarrativeBeatV1): boolean {
  return /hook|tension|reveal|payoff|consequence|land|surprise|stakes/i.test([beat.narrative_function, beat.viewer_task, beat.emotional_function].join(' '))
}

function stableFallback(sourceId: string, baseCrop: NormalizedBounds, startMs: number, endMs: number, resetAtMs: number[], maximumZoom: number, reason: string): VirtualCameraSolution {
  const times = [...new Set([startMs, ...resetAtMs, endMs])].sort((left, right) => left - right)
  return { source_id: sourceId, subject_track_ids: [], keyframes: times.map((at_ms) => ({ at_ms, crop: { x: rounded(baseCrop.x), y: rounded(baseCrop.y), width: rounded(baseCrop.width), height: rounded(baseCrop.height) }, zoom: 1, rotation_degrees: 0, confidence: 0 })), confidence: 0, fallback_used: true, reset_at_ms: resetAtMs, lead_room: 'none', maximum_safe_zoom: rounded(maximumZoom), rationale: [reason, 'A stable centre crop is safer than an uncertain automated move.'] }
}

export function solveVirtualCamera(input: VirtualCameraSolveInput): VirtualCameraSolution {
  const policy = { ...DEFAULT_POLICY, ...input.policy }
  const source = input.analysis.sources.find((item) => item.source_id === input.sourceId)
  if (!source) throw new Error(`source analysis does not contain ${input.sourceId}`)
  const baseCrop = baseCropForSource(source.width, source.height, policy.outputWidth, policy.outputHeight)
  const safeZoom = maximumSafeZoom(baseCrop, source.width, source.height, policy)
  const sourceSpan = input.beat.source_spans.find((span) => span.source_id === input.sourceId)
  const outputStartMs = input.beat.start_ms
  const outputEndMs = input.beat.end_ms
  const sourceStartMs = sourceSpan?.start_ms ?? Math.max(0, outputStartMs - source.canonical_offset_ms)
  const sourceEndMs = sourceSpan?.end_ms ?? Math.min(source.duration_ms, outputEndMs - source.canonical_offset_ms)
  if (outputEndMs <= outputStartMs || sourceEndMs <= sourceStartMs) return stableFallback(input.sourceId, baseCrop, outputStartMs, outputEndMs, [], safeZoom, 'The beat has no usable source-time span.')

  const sourceToOutput = (sourceAtMs: number) => Math.round(outputStartMs + (sourceAtMs - sourceStartMs) / (sourceEndMs - sourceStartMs) * (outputEndMs - outputStartMs))
  const outputToSource = (outputAtMs: number) => sourceStartMs + (outputAtMs - outputStartMs) / (outputEndMs - outputStartMs) * (sourceEndMs - sourceStartMs)
  const resetAtMs = input.analysis.shots.filter((shot) => shot.source_id === input.sourceId && shot.start_ms > sourceStartMs && shot.start_ms < sourceEndMs).map((shot) => sourceToOutput(shot.start_ms)).sort((left, right) => left - right)
  const tracks = chooseSubjects(input, sourceStartMs, sourceEndMs)
  if (!tracks.length) return stableFallback(input.sourceId, baseCrop, outputStartMs, outputEndMs, resetAtMs, safeZoom, 'No reliable subject track covers this beat.')

  const sampleTimes = new Set<number>([outputStartMs, outputEndMs, ...resetAtMs])
  for (let atMs = outputStartMs + policy.sampleIntervalMs; atMs < outputEndMs; atMs += policy.sampleIntervalMs) sampleTimes.add(Math.round(atMs))
  const orderedTimes = [...sampleTimes].sort((left, right) => left - right)
  const trackIds = new Set(tracks.map((track) => track.track_id))
  const directions: Array<'left' | 'right'> = []
  const raw = orderedTimes.flatMap((atMs) => {
    const sourceAtMs = outputToSource(atMs)
    const anchor = subjectAnchor(tracks, sourceAtMs)
    if (!anchor) return []
    const direction = activeDirection(input.analysis, trackIds, sourceAtMs, policy.minimumConfidence)
    if (direction.direction !== 'none') directions.push(direction.direction)
    const progress = (atMs - outputStartMs) / (outputEndMs - outputStartMs)
    const emphasis = impactBeat(input.beat)
    const requestedZoom = emphasis ? policy.subjectZoom + (policy.emphasisZoom - policy.subjectZoom) * smoothstep(progress) : policy.subjectZoom
    const zoom = clamp(requestedZoom, 1, safeZoom)
    const cropWidth = baseCrop.width / zoom
    const cropHeight = baseCrop.height / zoom
    let focusX = anchor.bounds.x + anchor.bounds.width / 2
    let focusY = anchor.bounds.y + anchor.bounds.height * 0.35
    if (direction.target) { focusX = focusX * 0.72 + direction.target.x * 0.28; focusY = focusY * 0.82 + direction.target.y * 0.18 }
    else if (direction.direction === 'left') focusX -= cropWidth * policy.leadRoomFraction
    else if (direction.direction === 'right') focusX += cropWidth * policy.leadRoomFraction
    const shotId = input.analysis.shots.find((shot) => shot.source_id === input.sourceId && shot.start_ms <= sourceAtMs && shot.end_ms > sourceAtMs)?.shot_id ?? 'unclassified'
    return [{ atMs, shotId, zoom, confidence: clamp((anchor.confidence * 0.85) + (direction.confidence * 0.15), 0, 1), crop: { x: clamp(focusX - cropWidth / 2, 0, 1 - cropWidth), y: clamp(focusY - cropHeight * policy.eyeLine, 0, 1 - cropHeight), width: cropWidth, height: cropHeight } }]
  })
  const meanConfidence = raw.length ? raw.reduce((total, frame) => total + frame.confidence, 0) / raw.length : 0
  if (!raw.length || meanConfidence < policy.minimumConfidence) return stableFallback(input.sourceId, baseCrop, outputStartMs, outputEndMs, resetAtMs, safeZoom, 'Subject tracking confidence is below the automated-camera threshold.')

  const keyframes: CameraKeyframeV1[] = []
  let previous: typeof raw[number] | undefined
  for (const frame of raw) {
    let solved = frame
    if (previous && previous.shotId === frame.shotId) {
      const elapsedSeconds = Math.max(0.001, (frame.atMs - previous.atMs) / 1000)
      const previousCentre = { x: previous.crop.x + previous.crop.width / 2, y: previous.crop.y + previous.crop.height / 2 }
      const desiredCentre = { x: frame.crop.x + frame.crop.width / 2, y: frame.crop.y + frame.crop.height / 2 }
      const dx = desiredCentre.x - previousCentre.x
      const dy = desiredCentre.y - previousCentre.y
      const distance = Math.hypot(dx, dy)
      const movementLimit = policy.maximumPanPerSecond * elapsedSeconds
      const movementScale = distance > movementLimit ? movementLimit / distance : 1
      const smoothing = distance < policy.jitterThreshold ? 0 : policy.smoothing
      const centre = { x: previousCentre.x + dx * movementScale * smoothing, y: previousCentre.y + dy * movementScale * smoothing }
      const zoomLimit = policy.maximumZoomPerSecond * elapsedSeconds
      const zoom = clamp(frame.zoom, previous.zoom - zoomLimit, previous.zoom + zoomLimit)
      const width = baseCrop.width / zoom
      const height = baseCrop.height / zoom
      solved = { ...frame, zoom, crop: { x: clamp(centre.x - width / 2, 0, 1 - width), y: clamp(centre.y - height / 2, 0, 1 - height), width, height } }
    }
    keyframes.push({ at_ms: solved.atMs, crop: { x: rounded(solved.crop.x), y: rounded(solved.crop.y), width: rounded(solved.crop.width), height: rounded(solved.crop.height) }, zoom: rounded(solved.zoom), rotation_degrees: 0, confidence: rounded(solved.confidence) })
    previous = solved
  }
  const leftCount = directions.filter((direction) => direction === 'left').length
  const rightCount = directions.filter((direction) => direction === 'right').length
  const leadRoom = leftCount === rightCount ? 'none' : leftCount > rightCount ? 'left' : 'right'
  return { source_id: input.sourceId, subject_track_ids: tracks.map((track) => track.track_id), keyframes, confidence: rounded(meanConfidence), fallback_used: false, reset_at_ms: resetAtMs, lead_room: leadRoom, maximum_safe_zoom: rounded(safeZoom), rationale: ['The crop follows the selected subject using shot-local tracking.', leadRoom === 'none' ? 'No reliable horizontal gesture or gaze required extra lead room.' : `Lead room is reserved to the ${leadRoom}.`, resetAtMs.length ? 'Camera smoothing resets at every detected source-shot boundary.' : 'The beat contains no internal source-shot boundary.'] }
}

export function materializeCameraPlan(template: CameraPlanTemplate, solution: VirtualCameraSolution): CameraPlanV1 {
  return { ...template, keyframes: solution.keyframes, confidence: solution.confidence }
}
