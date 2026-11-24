import { readFile } from 'node:fs/promises'
import {
  RenderLandingV1Schema,
  TreatmentRegistryV1Schema,
  isLiveSeries,
  parseWhyLadder,
  type BrandThemeV1,
  type ProductionBriefV1,
  type RenderLandingV1,
  type RenderManifestV2,
  type TreatmentRegistryV1,
} from '@mindmake/contracts'
import { loadJobV2, pinnedConfigPathV2 } from './job-store-v2.js'
import { loadBoundProductionBriefV2 } from './production-brief.js'

// The landing card on a makeyourmindup Short shows where the piece's
// why-ladder lands: what this shows, and the open question handed to the
// viewer (Ruling, Krish, 2026-11-24: "the signature format is the 5 Whys; get
// rid of everything that suggests predictions, calls, dated, odds or scores").
// No Short needs one. When a render carries a landing, the Studio takes it
// word for word from the job's production brief: content.landing, which the
// control plane binds from the piece's checked why-ladder (meta.whys) when it
// builds the brief. A brief made before that field falls back to a why-ladder
// block in its approved text (parseWhyLadder). The Studio refuses a render
// whose landing differs from it by a character. Only the house style draws the
// card, and only for a live subchannel; every other render is untouched.

/** Whether a render draws the landing card: branded in a house style theme,
 *  for a live subchannel. */
export function drawsHouseLandingV2(manifest: RenderManifestV2, theme: BrandThemeV1 | undefined): boolean {
  return manifest.branding.mode === 'series'
    && isLiveSeries(manifest.series)
    && Boolean(theme && theme.theme_id === manifest.branding.theme_id && theme.publication?.house_style)
}

type LandingReading = { ok: true; landing: { shows: string; open_question: string } } | { ok: false; reason: string }

function readBriefLanding(brief: ProductionBriefV1): LandingReading {
  // The brief's own landing first, bound from the piece's checked why-ladder
  // (meta.whys); the approved text is the piece body and never holds a ladder
  // (Ruling, Krish, 2026-11-24: the signature format is the 5 Whys). Older
  // briefs have no landing field, so their approved text is still read.
  const bound = brief.content.landing
  if (bound) return { ok: true, landing: { shows: bound.shows, open_question: bound.open_question } }
  const { ladder, problems } = parseWhyLadder(brief.content.approved_text)
  if (!ladder) return { ok: false, reason: problems.length ? problems.join('; ') : 'no why-ladder/1 block' }
  return { ok: true, landing: { shows: ladder.landing.shows, open_question: ladder.landing.open_question } }
}

/** The landing a production brief states (content.landing, or for an older
 *  brief a why-ladder in its approved text), as a render manifest carries it on
 *  the beat that shows it. Throws with the reason when the brief has none, or
 *  the landing would not fit the card. */
export function renderLandingFromBriefV2(brief: ProductionBriefV1, beatId: string): RenderLandingV1 {
  const reading = readBriefLanding(brief)
  if (!reading.ok) throw new Error(`production brief ${brief.brief_id} carries no landing from a checked why-ladder, and its approved text has none the Studio can read: ${reading.reason}`)
  const parsed = RenderLandingV1Schema.safeParse({ beat_id: beatId, ...reading.landing })
  if (!parsed.success) throw new Error(`the landing in production brief ${brief.brief_id} cannot go on a landing card: ${parsed.error.issues.map((issue) => `${issue.path.join('.') || 'landing'}: ${issue.message}`).join('; ')}`)
  return parsed.data
}

/** Why a render's landing does not match the job's production brief, or nothing
 *  when it matches, when the render carries no landing, or when it draws no
 *  landing card. Pure. */
export function renderLandingIssuesV2(manifest: RenderManifestV2, theme: BrandThemeV1 | undefined, brief: ProductionBriefV1 | undefined): string[] {
  const landing = manifest.landing
  if (!brief || !landing || !drawsHouseLandingV2(manifest, theme)) return []
  const reading = readBriefLanding(brief)
  if (!reading.ok) return [`production brief ${brief.brief_id} carries no landing from a checked why-ladder, and its approved text has none the Studio can read: ${reading.reason}. The landing card shows only the landing the production brief states: take "landing" out of the manifest, or file a why-ladder that stands on the piece and make its production brief again.`]
  const expected = reading.landing
  const issues: string[] = []
  if (landing.shows !== expected.shows) issues.push(`the landing's "what this shows" differs from production brief ${brief.brief_id}'s landing, which says: ${JSON.stringify(expected.shows)}`)
  if (landing.open_question !== expected.open_question) issues.push(`the landing's open question differs from production brief ${brief.brief_id}'s landing, which says: ${JSON.stringify(expected.open_question)}`)
  if (issues.length) issues.push(`print the exact landing with studio v2 landing --job ${manifest.job_id} --beat ${landing.beat_id}`)
  return issues
}

/** The landing gate for a render: loads the theme the job pinned and the
 *  production brief bound to the job, and returns renderLandingIssuesV2. A
 *  render that carries no landing or draws no card returns before reading anything. */
export async function boundRenderLandingIssuesV2(manifest: RenderManifestV2, registry?: TreatmentRegistryV1): Promise<string[]> {
  if (!manifest.landing || manifest.branding.mode !== 'series' || !isLiveSeries(manifest.series)) return []
  const job = await loadJobV2(manifest.job_id)
  const pinned = registry ?? TreatmentRegistryV1Schema.parse(JSON.parse(await readFile(pinnedConfigPathV2(job), 'utf8')))
  const theme = pinned.brand_themes.find((candidate) => candidate.theme_id === manifest.branding.theme_id)
  if (!drawsHouseLandingV2(manifest, theme)) return []
  return renderLandingIssuesV2(manifest, theme, await loadBoundProductionBriefV2(job))
}
