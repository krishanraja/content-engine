import { readFile } from 'node:fs/promises'
import {
  RenderCallV1Schema,
  TreatmentRegistryV1Schema,
  isLiveSeries,
  readPieceCall,
  type BrandThemeV1,
  type ProductionBriefV1,
  type RenderCallV1,
  type RenderManifestV2,
  type TreatmentRegistryV1,
} from '@mindmake/contracts'
import { loadJobV2, pinnedConfigPathV2 } from './job-store-v2.js'
import { loadBoundProductionBriefV2 } from './production-brief.js'

// The call card on a makeyourmindup Short shows the piece's dated prediction:
// the publication's promise ("every call scored in public"). A wrong date or
// percentage on it is a factual error in public, so the Studio takes the call
// from the approved text of the job's production brief (readPieceCall) and
// refuses a render whose call is missing or differs from it by a character.
// Only the house style draws the card, and only for a live subchannel; every
// other render (the retired series, unbranded, an older theme) is untouched.

/** Whether a render draws the call card: branded in a house style theme, for
 *  a live subchannel. */
export function drawsHouseCallV2(manifest: RenderManifestV2, theme: BrandThemeV1 | undefined): boolean {
  return manifest.branding.mode === 'series'
    && isLiveSeries(manifest.series)
    && Boolean(theme && theme.theme_id === manifest.branding.theme_id && theme.publication?.house_style)
}

/** The call a production brief's approved text makes, as a render manifest
 *  carries it on the beat that shows it. Throws with the reason when the text
 *  has no call the Studio can read, or the call would not fit the card. */
export function renderCallFromBriefV2(brief: ProductionBriefV1, beatId: string): RenderCallV1 {
  const reading = readPieceCall(brief.content.approved_text)
  if (!reading.ok) throw new Error(`production brief ${brief.brief_id} has no call the Studio can read in its approved text: ${reading.reason}`)
  const parsed = RenderCallV1Schema.safeParse({ beat_id: beatId, ...reading.call })
  if (!parsed.success) throw new Error(`the call in production brief ${brief.brief_id} cannot go on a call card: ${parsed.error.issues.map((issue) => `${issue.path.join('.') || 'call'}: ${issue.message}`).join('; ')}`)
  return parsed.data
}

/** Why a render's call does not match the job's approved text, or nothing
 *  when it matches or the render draws no call card. Pure. */
export function renderCallIssuesV2(manifest: RenderManifestV2, theme: BrandThemeV1 | undefined, brief: ProductionBriefV1 | undefined): string[] {
  if (!brief || !drawsHouseCallV2(manifest, theme)) return []
  const reading = readPieceCall(brief.content.approved_text)
  if (!reading.ok) return [`production brief ${brief.brief_id} has no call the Studio can read in its approved text: ${reading.reason} A Short in the house style ends on its call, so it cannot render until the approved text states one.`]
  const expected = reading.call
  const call = manifest.call
  if (!call) {
    return [`the render manifest has no call. A makeyourmindup Short ends on the piece's call: add "call": ${JSON.stringify({ beat_id: '<the beat that carries it>', ...expected })} to the manifest, as studio v2 call --job ${manifest.job_id} --beat <beat_id> prints it`]
  }
  const issues: string[] = []
  if (call.due !== expected.due) issues.push(`the call's due date is ${call.due}, and production brief ${brief.brief_id}'s approved text says ${expected.due}`)
  if (call.confidence_percent !== expected.confidence_percent) issues.push(`the call says ${call.confidence_percent}% sure, and production brief ${brief.brief_id}'s approved text says ${expected.confidence_percent}%`)
  if (call.statement !== expected.statement) issues.push(`the call's statement differs from production brief ${brief.brief_id}'s approved text, which says: ${JSON.stringify(expected.statement)}`)
  if (issues.length) issues.push(`print the exact call with studio v2 call --job ${manifest.job_id} --beat ${call.beat_id}`)
  return issues
}

/** The call gate for a render: loads the theme the job pinned and the
 *  production brief bound to the job, and returns renderCallIssuesV2. A render
 *  that draws no call card returns before reading anything. */
export async function boundRenderCallIssuesV2(manifest: RenderManifestV2, registry?: TreatmentRegistryV1): Promise<string[]> {
  if (manifest.branding.mode !== 'series' || !isLiveSeries(manifest.series)) return []
  const job = await loadJobV2(manifest.job_id)
  const pinned = registry ?? TreatmentRegistryV1Schema.parse(JSON.parse(await readFile(pinnedConfigPathV2(job), 'utf8')))
  const theme = pinned.brand_themes.find((candidate) => candidate.theme_id === manifest.branding.theme_id)
  if (!drawsHouseCallV2(manifest, theme)) return []
  return renderCallIssuesV2(manifest, theme, await loadBoundProductionBriefV2(job))
}
